#!/usr/bin/env bash
# Harvest per-commit numstat rows for every non-fork repo owned by one or more
# GitHub accounts, into newline-delimited JSON (one object per commit).
#
# Replicates the core of stoke-your-code's getGitRows(): for each commit we emit
#   { repo, ts, iso, author, added, deleted }
# summing added/deleted across all files in that commit (--no-renames).
#
# Repos already checked out under $SCAN_ROOT (default: $HOME) are read in place;
# anything missing is shallow-cloned with --no-checkout, extracted, and deleted,
# so peak disk stays at one repo.
#
# Usage:  scripts/harvest.sh <account> [<account> ...]
# Output: data/<account>.jsonl
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA="$ROOT/data"
SCAN_ROOT="${SCAN_ROOT:-$HOME}"
mkdir -p "$DATA" "$ROOT/scripts/clones"

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <account> [<account> ...]" >&2
  exit 1
fi

# Build a slug -> local-path map once, from existing checkouts under SCAN_ROOT.
MAP="$DATA/.local_map.tsv"
echo "scanning $SCAN_ROOT for local git repos..."
find "$SCAN_ROOT" -maxdepth 4 -name .git -type d 2>/dev/null \
  | sed 's#/.git$##' \
  | while read -r d; do
      url=$(git -C "$d" config --get remote.origin.url 2>/dev/null) || continue
      slug=$(printf '%s' "$url" | sed -E 's#^git@github.com:##; s#^https?://[^@]*@github.com/##; s#^https?://github.com/##; s#\.git$##')
      printf '%s\t%s\n' "$slug" "$d"
    done | awk -F'\t' '!seen[$1]++' | sort > "$MAP"
echo "  $(wc -l < "$MAP" | tr -d ' ') local repos indexed"

extract () {  # $1=slug  $2=gitdir  ->  stdout JSONL
  git -C "$2" log --all --reverse --date=iso-strict \
      --pretty=format:'__C__%x09%ct%x09%cI%x09%an' --numstat --no-renames 2>/dev/null \
  | awk -v repo="$1" '
      BEGIN{ts="";iso="";auth="";add=0;del=0;have=0}
      function flush(){ if(have){ printf "{\"repo\":\"%s\",\"ts\":%s,\"iso\":\"%s\",\"author\":\"%s\",\"added\":%d,\"deleted\":%d}\n",repo,ts,iso,auth,add,del } }
      /^__C__/ { flush(); split($0,a,"\t"); ts=a[2]; iso=a[3]; auth=a[4]; gsub(/"/,"",auth); add=0; del=0; have=1; next }
      NF>=2 { if($1 ~ /^[0-9]+$/ && $2 ~ /^[0-9]+$/){ add+=$1; del+=$2 } }
      END{ flush() }'
}

harvest_account () {
  local ACCT="$1"; local OUT="$DATA/${ACCT}.jsonl"; : > "$OUT"
  echo "[$ACCT] listing non-fork repos..."
  local LIST="$DATA/.${ACCT}.repos.txt"
  gh repo list "$ACCT" --limit 500 --json nameWithOwner,isFork \
      --jq '.[] | select(.isFork|not) | .nameWithOwner' > "$LIST"
  local TOTAL; TOTAL=$(wc -l < "$LIST" | tr -d ' '); local i=0 localn=0 clonen=0
  while IFS= read -r SLUG; do
    [ -z "$SLUG" ] && continue
    i=$((i+1))
    local P; P=$(awk -F'\t' -v s="$SLUG" '$1==s{print $2; exit}' "$MAP")
    if [ -n "$P" ]; then
      echo "[$ACCT] ($i/$TOTAL) local  $SLUG"
      extract "$SLUG" "$P" >> "$OUT"; localn=$((localn+1))
    else
      echo "[$ACCT] ($i/$TOTAL) clone  $SLUG"
      local DIR="$ROOT/scripts/clones/$(echo "$SLUG" | tr '/' '_')"; rm -rf "$DIR"
      if gh repo clone "$SLUG" "$DIR" -- --no-checkout --quiet 2>/dev/null; then
        extract "$SLUG" "$DIR" >> "$OUT"; clonen=$((clonen+1))
      else echo "    clone failed, skip"; fi
      rm -rf "$DIR"
    fi
  done < "$LIST"
  echo "[$ACCT] done: $localn local, $clonen cloned -> $(wc -l < "$OUT" | tr -d ' ') commit rows ($OUT)"
}

for ACCT in "$@"; do harvest_account "$ACCT"; done
echo "ALL DONE"
