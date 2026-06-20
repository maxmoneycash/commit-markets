# commit-markets oracle — Aptos anchor

On-chain checkpoint for the off-chain signed, hash-chained ccusage stream
(`web/src/lib/oracle.ts`). The Move module re-verifies the ed25519 signature of
the latest tick **on-chain** (`aptos_std::ed25519::signature_verify_strict`),
recomputes the head with sha2-256 so the anchor is bound to the signed bytes,
and pins the Shelby blob name + content hash of the full tape.

## The full oracle pipeline

```
cm-oracle.mjs            ccusage → sign (ed25519) → POST /api/oracle/commit
   (edge)                server verifies sig + hash-chain, advances head
      │
cm-anchor.mjs            GET tape → upload to Shelby → submit head to Aptos
   (anchor)              oracle::submit re-verifies sig on-chain, pins blob hash
      │
oracle.move              Registry: handle → { seq, head, pubkey, blob_name, blob_hash, ts }
   (settlement)          markets resolve against this signed, monotonic checkpoint
```

One ed25519 identity, three independent verifiers (server, Aptos, anyone with
the Shelby tape). Signing proves authorship + non-repudiation; it does **not**
prove the numbers are true (ccusage reads local files) — provider-billing
anchoring is the later truth upgrade.

## Compile

```bash
aptos move compile --named-addresses commit_oracle=0xCAFE   # placeholder addr
```

## Publish (testnet)

```bash
aptos init --network testnet                                 # creates a profile + funds it
aptos move publish --named-addresses commit_oracle=<your-addr>
aptos move run --function-id <your-addr>::oracle::init       # publish the Registry
```

## Anchor a handle

```bash
export APTOS_PRIVATE_KEY=<submitter key>      # pays gas; also the Shelby signer
export ORACLE_REGISTRY_ADDR=<addr that ran oracle::init>
export CM_URL=https://commit-markets.vercel.app

# needs @shelby-protocol/sdk + @aptos-labs/ts-sdk + ShelbyUSD funds:
node tools/cm-anchor.mjs <handle>
# or anchor head-only (no Shelby) while storage creds are pending:
node tools/cm-anchor.mjs <handle> --no-shelby
```

## Read the anchor

```bash
aptos move view --function-id <addr>::oracle::get \
  --args address:<ORACLE_REGISTRY_ADDR> "hex:$(printf <handle> | xxd -p)"
```

## What I need to take this live

- A funded **testnet** Aptos account (`aptos init` + faucet) → publish + `init`.
- **ShelbyUSD** + APT for the anchor signer (`shelby faucet --network testnet`).
- `npm i @shelby-protocol/sdk @aptos-labs/ts-sdk` where `cm-anchor.mjs` runs.
