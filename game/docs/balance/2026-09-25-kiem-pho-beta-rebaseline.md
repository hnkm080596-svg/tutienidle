# Kiem Pho Beta — fingerprint re-baseline + strengths-gate exception (2026-09-25)

## Delta

The KIEM PHO BETA content change (`devin/1790269261-kiem-pho-beta`) moved
`kiem_tu_hien` metrics on all 5 benchmarks: the new `nhat_tuyen [D,D,D]`
combo (x3.0) plus `thich_can` pierce node effects raise sword-path damage
well above the pre-change baseline. `EXPECTED_FINGERPRINTS` in
`src/core/simulation/benchmark/BalanceMatrix.test.ts` was regenerated for
the 5 `kiem_tu_hien/*` cells only — every other recipe's committed
fingerprints are unchanged (verified identical on the same run).

Per the oracle contract this re-baseline lands with the content change
that caused it (this branch).

## Exception (user-held)

The same change flips the exit-2 strengths gate: `the_tu_hien` has no
benchmark where it out-performs `kiem_tu_hien`, so `hasStrength=false`.

User ruling (2026-09-25, session chat): keep the numbers as authored; the
cross-path rebalance is user-owned scope and lands at BETA-BALANCE. The
strengths assertion is split into a `it.fails` block carrying this
exception so the rest of the gate battery still executes; the expected-
fail marker self-flags once the gate turns green and must then be
removed.

QA ledger: run `kiem-pho-beta-2026-09-25`, finding F-KP-CB-C1
(HUMAN_EXCEPTION, expires at BETA-BALANCE pass).
