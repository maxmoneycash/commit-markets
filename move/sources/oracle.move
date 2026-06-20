/// commit-markets oracle anchor.
///
/// On-chain checkpoint for the off-chain signed, hash-chained ccusage stream
/// (see web/src/lib/oracle.ts). Each `submit` carries the EXACT canonical bytes
/// of the latest tick plus its ed25519 signature; the module verifies the
/// signature on-chain with `aptos_std::ed25519`, recomputes the head hash with
/// sha2-256 (so the anchor is bound to the signed bytes, not a claimed value),
/// and pins the Shelby blob name + content hash of the full tape.
///
/// Trust model: the signature proves the handle's registered key authored this
/// tick (TOFU — first submission fixes the key; it can't change afterward). The
/// module does NOT re-walk the whole hash chain — that's verifiable off-chain
/// and from the Shelby tape; on-chain we keep a cheap, signed, monotonic
/// checkpoint that markets resolve against.
module commit_oracle::oracle {
    use std::signer;
    use std::hash;
    use aptos_std::table::{Self, Table};
    use aptos_std::ed25519;
    use aptos_framework::timestamp;

    /// Registry not published at the given address.
    const E_NOT_INITIALIZED: u64 = 1;
    /// Registry already exists for this account.
    const E_ALREADY_INITIALIZED: u64 = 2;
    /// ed25519 signature did not verify over the submitted tick bytes.
    const E_BAD_SIGNATURE: u64 = 3;
    /// seq must strictly increase per handle.
    const E_SEQ_NOT_MONOTONIC: u64 = 4;
    /// the signing identity for a handle is fixed at first submission.
    const E_PUBKEY_CHANGED: u64 = 5;

    /// Latest anchored checkpoint for one handle.
    struct Commitment has store, copy, drop {
        seq: u64,
        head: vector<u8>,      // sha2-256 of the signed last-tick bytes
        pubkey: vector<u8>,    // 32-byte ed25519 identity (sticky per handle)
        blob_name: vector<u8>, // Shelby blob name of the full signed tape
        blob_hash: vector<u8>, // sha-256 of that Shelby blob
        ts: u64,               // on-chain seconds at anchor time
    }

    /// One registry per host account; maps utf8(handle) -> latest commitment.
    struct Registry has key {
        commitments: Table<vector<u8>, Commitment>,
    }

    /// Publish the registry under the caller's account.
    public entry fun init(host: &signer) {
        assert!(!exists<Registry>(signer::address_of(host)), E_ALREADY_INITIALIZED);
        move_to(host, Registry { commitments: table::new() });
    }

    /// Anchor a new checkpoint. Permissionless: anyone may submit, but only a
    /// tick signed by the handle's registered key is accepted.
    public entry fun submit(
        _submitter: &signer,
        registry_addr: address,
        handle: vector<u8>,
        seq: u64,
        tick_bytes: vector<u8>,
        signature: vector<u8>,
        pubkey: vector<u8>,
        blob_name: vector<u8>,
        blob_hash: vector<u8>,
    ) acquires Registry {
        assert!(exists<Registry>(registry_addr), E_NOT_INITIALIZED);

        // Verify the signed bytes against the supplied key.
        let sig = ed25519::new_signature_from_bytes(signature);
        let pk = ed25519::new_unvalidated_public_key_from_bytes(pubkey);
        assert!(ed25519::signature_verify_strict(&sig, &pk, tick_bytes), E_BAD_SIGNATURE);

        // Bind the anchor to the signed bytes (don't trust a claimed head).
        let head = hash::sha2_256(tick_bytes);
        let now = timestamp::now_seconds();

        let reg = borrow_global_mut<Registry>(registry_addr);
        if (table::contains(&reg.commitments, handle)) {
            // Read prior values out first so the immutable borrow ends before
            // we take the mutable one below.
            let prev = table::borrow(&reg.commitments, handle);
            let prev_seq = prev.seq;
            let prev_pubkey = prev.pubkey;
            assert!(seq > prev_seq, E_SEQ_NOT_MONOTONIC);
            assert!(prev_pubkey == pubkey, E_PUBKEY_CHANGED);
            let c = table::borrow_mut(&mut reg.commitments, handle);
            c.seq = seq;
            c.head = head;
            c.blob_name = blob_name;
            c.blob_hash = blob_hash;
            c.ts = now;
        } else {
            table::add(&mut reg.commitments, handle, Commitment {
                seq, head, pubkey, blob_name, blob_hash, ts: now,
            });
        }
    }

    #[view]
    public fun get(registry_addr: address, handle: vector<u8>): Commitment acquires Registry {
        *table::borrow(&borrow_global<Registry>(registry_addr).commitments, handle)
    }

    // Accessors so consumers (markets) and tests can read a Commitment's fields.
    public fun commitment_seq(c: &Commitment): u64 { c.seq }
    public fun commitment_head(c: &Commitment): vector<u8> { c.head }
    public fun commitment_pubkey(c: &Commitment): vector<u8> { c.pubkey }
    public fun commitment_blob_name(c: &Commitment): vector<u8> { c.blob_name }
    public fun commitment_blob_hash(c: &Commitment): vector<u8> { c.blob_hash }
    public fun commitment_ts(c: &Commitment): u64 { c.ts }

    #[view]
    public fun has(registry_addr: address, handle: vector<u8>): bool acquires Registry {
        exists<Registry>(registry_addr)
            && table::contains(&borrow_global<Registry>(registry_addr).commitments, handle)
    }
}
