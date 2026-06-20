#!/usr/bin/env node
// cm-anchor — anchor the oracle head on Aptos + mirror the tape to Shelby.
//
//   node tools/cm-anchor.mjs <handle> [--no-shelby]
//
// Pipeline (the back half of the oracle core):
//   1. GET the signed tape + head from /api/oracle/<handle>?full=1
//   2. upload the full tape blob to Shelby  → durable, auditable availability
//   3. submit the head to commit_oracle::oracle::submit on Aptos, which
//      RE-VERIFIES the ed25519 signature on-chain and pins the Shelby blob hash
//
// The same signed last-tick bytes are verified here, on Aptos, and by the
// server — one identity, three independent verifiers.
//
// env:
//   CM_URL                (default http://localhost:3000)
//   APTOS_PRIVATE_KEY     submitter key (also pays gas; Shelby signer)
//   ORACLE_REGISTRY_ADDR  account that published the Registry (where init ran)
//   APTOS_NETWORK         testnet (default)

import { createHash } from "node:crypto";

const HANDLE = (process.argv[2] || "").toLowerCase();
const NO_SHELBY = process.argv.includes("--no-shelby");
const CM_URL = process.env.CM_URL ?? "http://localhost:3000";
const PK = process.env.APTOS_PRIVATE_KEY;
const REG = process.env.ORACLE_REGISTRY_ADDR;
const NODE = "https://api.testnet.aptoslabs.com/v1";
const SHELBY_RPC = "https://api.testnet.shelby.xyz/shelby";

if (!HANDLE) die("usage: cm-anchor <github-handle> [--no-shelby]");
if (!PK) die("APTOS_PRIVATE_KEY is required");
if (!REG) die("ORACLE_REGISTRY_ADDR is required (account that ran oracle::init)");

function die(m) { console.error("[cm-anchor]", m); process.exit(2); }
function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const k = Object.keys(v).sort();
  return `{${k.map((x) => `${JSON.stringify(x)}:${canonical(v[x])}`).join(",")}}`;
}
const hexToBytes = (h) => Uint8Array.from(Buffer.from(h, "hex"));
const utf8 = (s) => new TextEncoder().encode(s);
const sha256hex = (b) => createHash("sha256").update(b).digest("hex");

// 1. fetch tape + head
const res = await fetch(`${CM_URL}/api/oracle/${HANDLE}?full=1`).then((r) => r.json());
if (!res.ok || !res.head) die(`no oracle chain for ${HANDLE}`);
const tape = res.tape ?? [];
const last = tape[tape.length - 1];
if (!last) die("empty tape");
const tickBytes = utf8(canonical(last.tick));
const localHead = sha256hex(tickBytes);
if (localHead !== res.head.head) die(`head mismatch: server=${res.head.head} local=${localHead}`);
console.log(`[cm-anchor] ${HANDLE} seq=${res.head.seq} head=${localHead.slice(0, 12)}…`);

// 2. mirror tape to Shelby (optional)
let blobName = "";
let blobHash = "";
if (!NO_SHELBY) {
  const tapeJson = JSON.stringify({ handle: HANDLE, head: res.head, tape });
  blobHash = sha256hex(Buffer.from(tapeJson));
  blobName = `cm/oracle/${HANDLE}/tape-${res.head.seq}-${blobHash.slice(0, 12)}.json`;
  try {
    const { ShelbyNodeClient } = await import("@shelby-protocol/sdk/node");
    const { Ed25519Account, Ed25519PrivateKey, Network } = await import("@aptos-labs/ts-sdk");
    const client = new ShelbyNodeClient({
      network: Network.TESTNET,
      aptos: { network: Network.TESTNET, fullnode: NODE },
      rpc: { baseUrl: SHELBY_RPC },
    });
    const signer = new Ed25519Account({ privateKey: new Ed25519PrivateKey(PK) });
    await client.upload({
      signer,
      blobData: Buffer.from(tapeJson),
      blobName,
      expirationMicros: (Date.now() + 1000 * 60 * 60 * 24 * 30) * 1000,
    });
    console.log(`[cm-anchor] shelby ← ${blobName} (${blobHash.slice(0, 12)}…)`);
  } catch (e) {
    die(`shelby upload failed (need @shelby-protocol/sdk + ShelbyUSD funds): ${e.message}\n  re-run with --no-shelby to anchor head-only`);
  }
}

// 3. submit to Aptos Move module (verifies the signature on-chain)
const { Aptos, AptosConfig, Network, Ed25519Account, Ed25519PrivateKey } = await import("@aptos-labs/ts-sdk");
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET, fullnode: NODE }));
const signer = new Ed25519Account({ privateKey: new Ed25519PrivateKey(PK) });
const tx = await aptos.transaction.build.simple({
  sender: signer.accountAddress,
  data: {
    function: `${REG}::oracle::submit`,
    functionArguments: [
      REG,
      utf8(HANDLE),
      String(res.head.seq),
      tickBytes,
      hexToBytes(last.sig),
      hexToBytes(last.pubkey),
      utf8(blobName),
      hexToBytes(blobHash || ""),
    ],
  },
});
const pending = await aptos.signAndSubmitTransaction({ signer, transaction: tx });
await aptos.waitForTransaction({ transactionHash: pending.hash });
console.log(`[cm-anchor] aptos ✓ ${pending.hash}`);
console.log(`  explorer: https://explorer.aptoslabs.com/txn/${pending.hash}?network=testnet`);
