//! commit-markets engine (`cmkt`)
//!
//! Turns GitHub commit history into a tradeable **activity index**.
//!
//!   cmkt harvest <account> [<account> ...]   # repos -> data/<acct>.jsonl  (parallel)
//!   cmkt index   <account> [<account> ...]   # jsonl -> index + summary
//!   cmkt all     <account> [<account> ...]   # harvest then index
//!
//! Replaces the original Python/bash prototype. The work — locating/cloning
//! every repo an account owns and parsing `git log --numstat` — fans out across
//! all cores via rayon, which is the real speedup over the sequential prototype.

use anyhow::{Context, Result};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

/// One commit, with churn summed across all files (matches the prototype's
/// per-commit row so any metric can be recomputed without re-harvesting).
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Row {
    repo: String,
    ts: i64,
    iso: String,
    author: String,
    added: u64,
    deleted: u64,
}

#[derive(Debug, Deserialize)]
struct GhRepo {
    #[serde(rename = "nameWithOwner")]
    name_with_owner: String,
    #[serde(rename = "isFork")]
    is_fork: bool,
}

fn data_dir() -> PathBuf {
    // repo-root/data, relative to the binary's invocation cwd
    PathBuf::from("data")
}

fn main() {
    if let Err(e) = run() {
        eprintln!("error: {e:#}");
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.len() < 2 {
        eprintln!("usage: cmkt <harvest|index|all> <account> [<account> ...]");
        std::process::exit(2);
    }
    let cmd = args[0].as_str();
    let accounts = &args[1..];
    fs::create_dir_all(data_dir()).ok();

    match cmd {
        "harvest" => {
            let map = scan_local(&home(), 4);
            eprintln!("indexed {} local repos under {}", map.len(), home().display());
            for a in accounts {
                harvest(a, &map)?;
            }
        }
        "index" => {
            for a in accounts {
                index(a)?;
            }
        }
        "all" => {
            let map = scan_local(&home(), 4);
            eprintln!("indexed {} local repos under {}", map.len(), home().display());
            for a in accounts {
                harvest(a, &map)?;
                index(a)?;
            }
        }
        other => {
            eprintln!("unknown command: {other}");
            std::process::exit(2);
        }
    }
    Ok(())
}

fn home() -> PathBuf {
    std::env::var("HOME").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from("."))
}

// ----------------------------------------------------------------------------
// Local repo discovery: slug -> path, by parsing .git/config for origin url.
// ----------------------------------------------------------------------------

fn scan_local(root: &Path, max_depth: usize) -> HashMap<String, PathBuf> {
    let mut out = HashMap::new();
    walk(root, max_depth, &mut out);
    out
}

fn walk(dir: &Path, depth_left: usize, out: &mut HashMap<String, PathBuf>) {
    // If this dir is itself a git repo, record it and do not descend further.
    let gitcfg = dir.join(".git").join("config");
    if gitcfg.is_file() {
        if let Some(slug) = origin_slug(&gitcfg) {
            out.entry(slug).or_insert_with(|| dir.to_path_buf());
        }
        return;
    }
    if depth_left == 0 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else { return };
    for e in entries.flatten() {
        let Ok(ft) = e.file_type() else { continue };
        if !ft.is_dir() || ft.is_symlink() {
            continue;
        }
        let name = e.file_name();
        let name = name.to_string_lossy();
        // skip heavy / irrelevant dirs
        if matches!(name.as_ref(), "node_modules" | "target" | ".cache" | "Library"
            | ".Trash" | "Pictures" | "Movies" | "Music")
            || name.starts_with('.') && name != ".config"
        {
            continue;
        }
        walk(&e.path(), depth_left - 1, out);
    }
}

fn origin_slug(config_path: &Path) -> Option<String> {
    let text = fs::read_to_string(config_path).ok()?;
    let mut in_origin = false;
    for line in text.lines() {
        let t = line.trim();
        if t.starts_with('[') {
            in_origin = t.contains("remote \"origin\"");
            continue;
        }
        if in_origin && t.starts_with("url") {
            if let Some((_, url)) = t.split_once('=') {
                return normalize_slug(url.trim());
            }
        }
    }
    None
}

/// `git@github.com:owner/repo.git` / `https://github.com/owner/repo` -> `owner/repo`
fn normalize_slug(url: &str) -> Option<String> {
    let mut s = url.to_string();
    if let Some(rest) = s.strip_prefix("git@github.com:") {
        s = rest.to_string();
    } else if let Some(idx) = s.find("github.com/") {
        s = s[idx + "github.com/".len()..].to_string();
    } else {
        return None;
    }
    let s = s.strip_suffix(".git").unwrap_or(&s).to_string();
    let parts: Vec<&str> = s.split('/').filter(|p| !p.is_empty()).collect();
    if parts.len() >= 2 {
        Some(format!("{}/{}", parts[0], parts[1]))
    } else {
        None
    }
}

// ----------------------------------------------------------------------------
// Harvest: account -> data/<acct>.jsonl (parallel across repos)
// ----------------------------------------------------------------------------

fn list_repos(account: &str) -> Result<Vec<String>> {
    let out = Command::new("gh")
        .args([
            "repo", "list", account, "--limit", "500", "--json",
            "nameWithOwner,isFork",
        ])
        .output()
        .context("running `gh repo list` (is gh installed + authenticated?)")?;
    if !out.status.success() {
        anyhow::bail!("gh repo list {account}: {}", String::from_utf8_lossy(&out.stderr));
    }
    let repos: Vec<GhRepo> = serde_json::from_slice(&out.stdout)?;
    Ok(repos
        .into_iter()
        .filter(|r| !r.is_fork)
        .map(|r| r.name_with_owner)
        .collect())
}

fn harvest(account: &str, local_map: &HashMap<String, PathBuf>) -> Result<()> {
    let repos = list_repos(account)?;
    let total = repos.len();
    eprintln!("[{account}] {total} non-fork repos");
    let done = AtomicUsize::new(0);
    let cloned = AtomicUsize::new(0);

    let rows: Vec<Row> = repos
        .par_iter()
        .flat_map(|slug| {
            let n = done.fetch_add(1, Ordering::Relaxed) + 1;
            let rows = if let Some(path) = local_map.get(slug) {
                eprintln!("[{account}] ({n}/{total}) local  {slug}");
                git_log_rows(path, slug)
            } else {
                eprintln!("[{account}] ({n}/{total}) clone  {slug}");
                cloned.fetch_add(1, Ordering::Relaxed);
                clone_and_log(slug)
            };
            rows.unwrap_or_default()
        })
        .collect();

    // stable order: by timestamp
    let mut rows = rows;
    rows.sort_by_key(|r| r.ts);

    let path = data_dir().join(format!("{account}.jsonl"));
    let mut f = fs::File::create(&path)?;
    for r in &rows {
        writeln!(f, "{}", serde_json::to_string(r)?)?;
    }
    eprintln!(
        "[{account}] done: {} cloned -> {} commit rows ({})",
        cloned.load(Ordering::Relaxed),
        rows.len(),
        path.display()
    );
    Ok(())
}

fn clone_and_log(slug: &str) -> Result<Vec<Row>> {
    let dir = std::env::temp_dir()
        .join("cmkt-clones")
        .join(slug.replace('/', "_"));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(dir.parent().unwrap()).ok();
    let status = Command::new("gh")
        .args(["repo", "clone", slug])
        .arg(&dir)
        .args(["--", "--no-checkout", "--quiet"])
        .status();
    let rows = match status {
        Ok(s) if s.success() => git_log_rows(&dir, slug),
        _ => Ok(Vec::new()),
    };
    let _ = fs::remove_dir_all(&dir);
    rows
}

/// Same invocation as the prototype: all branches, reverse, numstat, no renames.
fn git_log_rows(dir: &Path, slug: &str) -> Result<Vec<Row>> {
    let out = Command::new("git")
        .arg("-C")
        .arg(dir)
        .args([
            "log", "--all", "--reverse", "--date=iso-strict",
            "--pretty=format:__C__%x09%ct%x09%cI%x09%an",
            "--numstat", "--no-renames",
        ])
        .output()?;
    if !out.status.success() {
        return Ok(Vec::new());
    }
    Ok(parse_git_log(&String::from_utf8_lossy(&out.stdout), slug))
}

fn parse_git_log(text: &str, slug: &str) -> Vec<Row> {
    let mut rows = Vec::new();
    let mut cur: Option<Row> = None;
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("__C__\t") {
            if let Some(r) = cur.take() {
                rows.push(r);
            }
            let mut it = rest.split('\t');
            let ts = it.next().and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
            let iso = it.next().unwrap_or("").to_string();
            let author = it.next().unwrap_or("").replace('"', "");
            cur = Some(Row { repo: slug.to_string(), ts, iso, author, added: 0, deleted: 0 });
        } else if !line.is_empty() {
            if let Some(r) = cur.as_mut() {
                let mut it = line.split('\t');
                let a = it.next().and_then(|s| s.parse::<u64>().ok());
                let d = it.next().and_then(|s| s.parse::<u64>().ok());
                if let (Some(a), Some(d)) = (a, d) {
                    r.added += a;
                    r.deleted += d;
                }
            }
        }
    }
    if let Some(r) = cur.take() {
        rows.push(r);
    }
    rows
}

// ----------------------------------------------------------------------------
// Index: rows -> activity index + summary
// ----------------------------------------------------------------------------

const WEEK: i64 = 7 * 86_400;
const CHURN_CAP: i64 = 50_000; // per-commit |delta| cap for the LOC variant

#[derive(Serialize)]
struct Candle {
    ts: i64,
    iso: String,
    repo: String,
    open: i64,
    close: i64,
    high: i64,
    low: i64,
    volume: u64,
    delta: i64,
}

fn load_rows(account: &str) -> Result<Vec<Row>> {
    let path = data_dir().join(format!("{account}.jsonl"));
    let text = fs::read_to_string(&path)
        .with_context(|| format!("reading {} (run `cmkt harvest {account}` first)", path.display()))?;
    let mut rows: Vec<Row> = text
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect();
    rows.sort_by_key(|r| r.ts);
    Ok(rows)
}

fn index(account: &str) -> Result<()> {
    let rows = load_rows(account)?;
    if rows.is_empty() {
        println!("\n{account}: no rows");
        return Ok(());
    }

    // --- LOC variant (legacy metric, with churn cap) ---
    let mut loc: i64 = 0;
    let mut candles = Vec::with_capacity(rows.len());
    let mut authors: HashMap<&str, usize> = HashMap::new();
    let mut repos: std::collections::HashSet<&str> = std::collections::HashSet::new();
    let (mut big_up, mut big_dn) = (0i64, 0i64);
    let (mut up_at, mut dn_at) = (String::new(), String::new());
    for r in &rows {
        *authors.entry(r.author.as_str()).or_insert(0) += 1;
        repos.insert(r.repo.as_str());
        let raw = r.added as i64 - r.deleted as i64;
        let delta = raw.clamp(-CHURN_CAP, CHURN_CAP);
        let before = loc;
        let after = (before + delta).max(0);
        loc = after;
        if after - before > big_up {
            big_up = after - before;
            up_at = format!("{} {}", &r.iso[..r.iso.len().min(10)], r.repo);
        }
        if after - before < big_dn {
            big_dn = after - before;
            dn_at = format!("{} {}", &r.iso[..r.iso.len().min(10)], r.repo);
        }
        candles.push(Candle {
            ts: r.ts,
            iso: r.iso.clone(),
            repo: r.repo.clone(),
            open: before,
            close: after,
            high: before.max(after),
            low: before.min(after),
            volume: r.added + r.deleted,
            delta: after - before,
        });
    }

    // --- velocity index (commits per week) — the metric of record ---
    let first_ts = rows.first().unwrap().ts;
    let last_ts = rows.last().unwrap().ts;
    let mut weekly: HashMap<i64, u64> = HashMap::new();
    for r in &rows {
        *weekly.entry((r.ts - first_ts).div_euclid(WEEK)).or_insert(0) += 1;
    }
    let span_weeks = ((last_ts - first_ts).div_euclid(WEEK) + 1).max(1);
    let peak_week = weekly.values().copied().max().unwrap_or(0);
    let last_7 = rows.iter().filter(|r| last_ts - r.ts < WEEK).count();
    let last_30 = rows.iter().filter(|r| last_ts - r.ts < 30 * 86_400).count();
    let avg_per_week = rows.len() as f64 / span_weeks as f64;

    let mut top: Vec<(&&str, &usize)> = authors.iter().map(|(k, v)| (k, v)).collect();
    top.sort_by(|a, b| b.1.cmp(a.1));

    println!("\n{}", "=".repeat(64));
    println!("{account}  (account activity index)");
    println!("{}", "=".repeat(64));
    println!("  repos with commits : {}", repos.len());
    println!("  commits            : {}", rows.len());
    println!("  contributors       : {}", authors.len());
    println!("  span               : {}  ->  {}",
        &rows.first().unwrap().iso[..10.min(rows.first().unwrap().iso.len())],
        &rows.last().unwrap().iso[..10.min(rows.last().unwrap().iso.len())]);
    println!("  -- VELOCITY (metric of record) --");
    println!("  commits last 7d    : {last_7}");
    println!("  commits last 30d   : {last_30}");
    println!("  avg commits/week   : {avg_per_week:.1}");
    println!("  peak week          : {peak_week} commits");
    println!("  -- LOC variant (churn-capped @ {CHURN_CAP}) --");
    println!("  current LOC        : {loc}");
    println!("  biggest +candle    : +{big_up}  ({up_at})");
    println!("  biggest -candle    : {big_dn}  ({dn_at})");
    println!("  top contributors   :");
    for (a, n) in top.iter().take(6) {
        println!("      {n:>6}  {a}");
    }

    // write artifacts
    let cpath = data_dir().join(format!("{account}.candles.json"));
    fs::write(&cpath, serde_json::to_string(&candles)?)?;
    let mut vel: Vec<(i64, u64)> = weekly.into_iter().collect();
    vel.sort_by_key(|x| x.0);
    let vel_series: Vec<serde_json::Value> = vel
        .iter()
        .map(|(w, c)| serde_json::json!({ "week_ts": first_ts + w * WEEK, "commits": c }))
        .collect();
    fs::write(
        data_dir().join(format!("{account}.velocity.json")),
        serde_json::to_string(&vel_series)?,
    )?;
    println!("  artifacts          : {} , {account}.velocity.json", cpath.display());
    Ok(())
}
