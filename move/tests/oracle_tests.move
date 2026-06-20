#[test_only]
module commit_oracle::oracle_tests {
    use std::hash;
    use std::signer;
    use aptos_framework::timestamp;
    use commit_oracle::oracle;

    // Real ed25519 test vector generated off-chain over the canonical bytes of:
    //   {"handle":"maxmoneycash","metrics":{"costUsdTotal":128.44,
    //    "tokensTotal":9876543},"prev":"","seq":0,"ts":1750000000000}
    // Same canonicalization as web/src/lib/oracle.ts.
    const PUBKEY: vector<u8> = x"8c75fe766b57ac8a96e34c47106c20052a1fde314a0b4fd60611e65baee99422";
    const SIG: vector<u8> = x"909ece299c3152ed0c26c21ca2d8fc7123f2bc69d5ecaa136847b70d54e6dc2fbf608e3aacb604d2ce7c9006cffff69cde8d7801855385ac8df417bee60a4500";
    const TICK: vector<u8> = x"7b2268616e646c65223a226d61786d6f6e657963617368222c226d657472696373223a7b22636f7374557364546f74616c223a3132382e34342c22746f6b656e73546f74616c223a393837363534337d2c2270726576223a22222c22736571223a302c227473223a313735303030303030303030307d";
    const HEAD: vector<u8> = x"096b8edb46edea0e7d5bc1cfcee378aae4fe51740ff757b21109a7f259bb757d";

    fun setup(framework: &signer, host: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        oracle::init(host);
    }

    #[test(framework = @aptos_framework, host = @commit_oracle)]
    fun submit_verifies_signature_and_binds_head(framework: &signer, host: &signer) {
        setup(framework, host);
        let addr = signer::address_of(host);
        oracle::submit(host, addr, b"maxmoneycash", 0, TICK, SIG, PUBKEY, b"cm/oracle/mmc/tape-0.json", x"aa");

        assert!(oracle::has(addr, b"maxmoneycash"), 100);
        let c = oracle::get(addr, b"maxmoneycash");
        assert!(oracle::commitment_seq(&c) == 0, 101);
        // head is the ON-CHAIN sha2-256 of the signed bytes — and matches the
        // head our off-chain server computed independently.
        assert!(oracle::commitment_head(&c) == hash::sha2_256(TICK), 102);
        assert!(oracle::commitment_head(&c) == HEAD, 103);
        assert!(oracle::commitment_pubkey(&c) == PUBKEY, 104);
    }

    // A tampered signature must be rejected by on-chain verification.
    #[test(framework = @aptos_framework, host = @commit_oracle)]
    #[expected_failure(abort_code = 3, location = commit_oracle::oracle)]
    fun submit_rejects_bad_signature(framework: &signer, host: &signer) {
        setup(framework, host);
        let addr = signer::address_of(host);
        let bad = SIG;
        *std::vector::borrow_mut(&mut bad, 0) = 0; // flip first sig byte
        oracle::submit(host, addr, b"maxmoneycash", 0, TICK, bad, PUBKEY, b"x", x"aa");
    }

    // seq must strictly increase per handle.
    #[test(framework = @aptos_framework, host = @commit_oracle)]
    #[expected_failure(abort_code = 4, location = commit_oracle::oracle)]
    fun submit_rejects_non_monotonic_seq(framework: &signer, host: &signer) {
        setup(framework, host);
        let addr = signer::address_of(host);
        oracle::submit(host, addr, b"maxmoneycash", 0, TICK, SIG, PUBKEY, b"x", x"aa");
        // re-submitting seq 0 (same signed tick) must abort
        oracle::submit(host, addr, b"maxmoneycash", 0, TICK, SIG, PUBKEY, b"x", x"aa");
    }
}
