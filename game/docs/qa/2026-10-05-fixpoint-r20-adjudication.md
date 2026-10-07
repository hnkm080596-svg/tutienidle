# Fixpoint r20 adjudication — audit commit 060826af (the r19 batch)

Wave r20 (3 blind auditors: COR / AUT / INT) attacked the r19 batch.
Verdicts: **AUT PASS WITH EVIDENCE (19 probes, 2 mechanism notes)**,
**INT PASS WITH EVIDENCE (0 Medium+ + 1 Nit)**,
**COR FAIL WITH REASON (1 High + 1 Low)**.

Note on loop criteria: from r20 onward the fixpoint predicate is the
product-owner ruling — zero ACTIONABLE findings at ANY severity across
all three auditors (every Low/Nit is fixed or formally excepted with a
recorded reason), not merely zero Medium+.

## Confirmed findings

| Finding | Sev | Disposition |
| --- | --- | --- |
| R20-INT-01 — `player.ts:613` restore-map call-site comment "shared helper above" left over from r15 (same class as R19-INT-01) | Nit | FIXED — comment now names `boundTimedEffectClocks` and the `payoutExpiresAtMs` sibling explicitly. |
| R20-AUT A2 — mechanism-level blind spot: a finite reversed-span record (`started > completes`) passes the non-finite guard, computes headCost = 0, and grants one free completion per crafted entry. Not client-reachable (validator's F-A11-4 ordering + exact-span pins reject the shape upstream; every feed is validator-gated or runtime-minted) | Low | FIXED — the defensive guard now also rejects `completesAtMs <= startedAtMs`, mirroring the validator's ordering pin. 1 pin added (reversed + zero span) in `ProductionOffline.test.ts`. |
| R20-AUT A1 — preserve-then-persist: a guard trip returns `pending` verbatim and settle re-saves it, so a crafted bad record freezes its whole site's lane set (deny-direction: freeze, never mint) | Nit | ACCEPTED — atomicity is by design: dropping an unverifiable entry silently would corrupt honest lanes when the guard ever trips on a genuinely transient caller bug; freeze is bounded, self-evident, deny-direction. Reachability corrected in r21 (INT-02): the non-finite/ordering arms are unreachable from saves (validator pins finite + ordered upstream), but the r20 magnitude arm IS save-reachable — a crafted pending pair at >=2^53 with an even span passes the validator's exact-span check and wedges its site verbatim. Bounded self-denial, by design. |
|| R20-COR-1 — the r19 guard pinned finiteness only, not magnitude: at `|emptyLaneStartMs| >= ~1e21` float64 absorbs `start + cycleMs` back into start (headCost = 0 forever, dues never reach nowMs) — an unbounded settle loop minting free completions to OOM. Reachable from a crafted save: `lastSavedAt = -1e308` passes the validator (isFinite pin only, no floor) and flows through `min(lastSavedAt, authorityNow - elapsed)` into the seed start | High | FIXED — the guard now rejects `|stamp| >= 2^53` (the exact-integer-ms domain edge where a ms-delta can absorb) on `emptyLaneStartMs` AND both pending stamps, plus `completesAtMs <= startedAtMs`. Honest stamps are epoch-ms, orders of magnitude inside the domain. The validator still admits `lastSavedAt = -1e308` (pinned by repro (a)) — the mechanism now owns the bound, so any future derived-feed path is covered too. Repros (b)/(c) flipped to deny pins; the child-process hang probe now asserts a clean exit. |
|| R20-COR-2 — sibling member of the same guard class: non-finite `slots` (`+Infinity`) makes the seed `for` loop push lanes forever (OOM). Not client-reachable (allocator clamps) — same defensive class r19-AUT established | Low | FIXED — `!Number.isFinite(slots)` added to the guard; widened further in r21 (INT-01) to the bounded non-negative-integer contract. |

## Clean (audited, no defect)

- **AUT**: every feed into `advanceWorkerLanes` is validator-gated or
  runtime-minted — no migration/checkpoint/warm-load/dev-console
  bypass. TLT bound matrix held at every boundary (`expires ==
  lastSavedAt` dead arm, `+1ms` self-bounded, `+24h+7d` ceiling stored
  `+24h`); percent `-0`/`NaN`/`0.25+eps` rejected, `0.25`/`MIN_VALUE`
  admitted with probe parity; non-finite `lastSavedAt`/`expiresAtMs`
  rejected at the gate — every `!isFinite` raw-passthrough arm
  unreachable. Re-stamp kill invariant: seeded heads always land in
  `(max(settleNow, Date.now()), +cycleMs]` for ANY skew; crafted
  windows only shrink; saved-lane residual bounded <=1 cycle/lane
  <=3 lanes. Epoch-flip deny pins hold (forged marker + marker-dead
  expires -> stored dead + flat payout; ceiling expires -> `until+24h`
  never raw). 19 probes green.
- **INT**: zero-advance result coherent for both callers — observe-mode
  preserves object refs with `completed: []` (no grant, no
  double-grant; `activeWorkerSlots` already assigned upstream);
  settle-mode `seededPending: []` skips the re-stamp map and
  `budgetMs -= 0` isolates the poisoned site's budget. Bound-pair
  invariant verified: `provenance <= lastSavedAt` always, so stored
  `<=` payout bound on every path; both maps unconditional in
  restoreFromSave; legacy/undefined authority passes the same args.
  Flipped R19-COR-1 pins match the adjudicated deny semantics. 5
  probes green.
- **COR**: guard order runs before lane construction; `pending.some()`
  side-effect-free; NaN cycleMs/baseSeconds benign (canSpawn false);
  r18 batch intact at tip; the flipped r19 deny pins are strong (a
  mint regression fails them); siblings (budget drain, restore order,
  autofarm/decompose/alchemy caps) clean.
- Documented residuals re-verified bounded: stackable expiry
  passthrough (mint ceiling = one modifier <=1.5x authored rate,
  realm-gated, group-dedup'd — the standing D-01 exception); crafted
  deep-past seeds jump-bounded O(1).

## Verification

`npm run type-check` clean; scoped `npx vitest run src/core/production
src/services/save src/stores` — 1053 passed / 1 skipped (the env-gated
slots-hang spec, child-spawned only), incl. adopted auditor probes
(`auditR20Aut.probe.test.ts` 19, `auditR20Int.probe.test.ts` 5,
`fixpointR20Cor.qa.test.ts` 4 — repros (b)/(c)/(COR-2) flipped to pin
the fixed deny semantics).
