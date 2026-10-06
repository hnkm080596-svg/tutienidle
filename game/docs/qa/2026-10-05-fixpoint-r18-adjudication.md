# Fixpoint r18 adjudication — audit commit cef2af9e (the r17 batch)

Wave r18 (3 blind auditors: COR / AUT / INT) attacked the r17 batch.
Verdicts: **INT FAIL (1 Medium-latent + 1 Nit)**, **AUT FAIL (1 Medium-High +
1 Nit)**, **COR FAIL (2 Medium + 1 Low + residual note)**.

## The root class: the r17 duration bound picked the wrong anchor

Two auditors independently converged on the same defect from different
doors. The r17-COR-B1 fix anchored the live-claim bound at
`min(appliedAt, anchor) + duration` — reasoning that a claim's honest
expiry is "one duration past its apply stamp". That reasoning missed the
writer's merge semantics: `applyTimedEffect` keeps `appliedAtMs` at the
FIRST purchase and max-extends `expiresAtMs` on every rebuy, so the honest
shape of a refreshed Tú Linh Trận is `expires = lastApply + dur` with
`lastApply <= lastSavedAt` — a span legitimately LONGER than one duration
(the validator's r13-COR-1 note documents exactly this class). The
correct class bound is `lastSavedAt + duration`, not `appliedAt +
duration`.

Resolution, split by purpose like r17 intended but with the right anchors:

- **Payout** (`payoutExpiresAtMs`): `min(expires, lastSavedAt + dur)` —
  the payload-epoch honest-max. Admits every honest shape (single buys,
  rebuy chains, skewed stamps) while capping a forged claim at the same
  class maximum; the paid width stays inside the authorized window.
  Strictly recovers the r17 bound: it preserves the COR-B1 skew
  correction AND restores chains.
- **Storage** (`boundTimedEffectClocks`): `min(expires, provenance + dur)`
  where `provenance = min(lastSavedAt, authorityNow)` — the tightest
  authority-anchored cap that admits the whole honest class under a
  synced or slow clock. Under a fast clock the honest tail beyond
  `until + dur` is still unprovable (indistinguishable from a
  far-future mint) — irreducible bounded loss, documented since r17.
- **Dead arm** keeps the r17 `min(nowMs, Date.now())` clamp — orthogonal
  and unchanged.

## Confirmed findings

| Finding | Sev | Disposition |
| --- | --- | --- |
| R18-INT-01 / R18-AUT-1 — `min(appliedAt, .)+24h` kills honest non-stackable rebuy chains: a live PAID buff (applied 30h ago, rebought ~1-2h before save, expires = save+22-23h) clamps to firstBuy+24h < save -> buff reaped at boot AND the offline payout loses its buffed tail (320 vs 400; 200 vs 250). Regression authored by the r17 batch itself — the r14/r16 bound never cut this shape. Latency note (INT): zero production callers for the only non-stackable writer today; fires the moment one ships | Medium (latent) / Medium-High | FIXED — bounds re-anchored at the claim-class honest-max: `lastSavedAt + dur` for payout, `provenance + dur` for storage. Both auditors' repro pins (4 tests, cherry-picked verbatim) now green. |
| R18-INT-02 — stale r14-AUT-2 comment still described the removed provenance bound contradicting the r17 block below it | Nit | FIXED — comment rewritten to describe the provenance bound that IS in force (now restored) and the rebuy-chain merge shape. |
| R18-AUT-N1 — the O(1) settle jump counts the whole remaining chain in `forfeited` where the per-iteration path counted one before the lane died | Nit | DOCUMENTED — accounting only; no payout consumer reads `forfeited` (dead counter). |
|| R18-COR-1 — same defect as INT-01/AUT-1, confirmed independently with two validator-admitted honest-shape repros (stored expiry killed + payout unbuffed) | Medium | FIXED — same re-anchored bounds; COR repro pins green. |
|| R18-COR-2 — the r17-AUT-1 O(1) jump only armed at `budgetLeftMs <= 0`; a leftover in (0, cycleMs) — the common case (cycleMs never divides the cap; cheaper saved heads; multi-site residue) — left the unbounded per-due forfeit walk live (repro: 2_857 iterations on a 200M window, Delta +1_429 per 2x depth) | Medium | FIXED — jump guard now arms when BOTH the head's cost AND cycleMs exceed the leftover (`headCostMs > budgetLeftMs && cycleMs > budgetLeftMs`); an affordable head still pays first, its cycle-priced successor jumps. COR pin: both depths now ~1_030 shifts, Delta ~0. |
|| R18-COR-3 — the r17 jump counted the whole remaining `skippedDues` tail into `forfeited` even when the lane died (oversubscribed/no-respawn), where the walked path counted the head's forfeit only | Low | FIXED — forfeit parity restored: `skippedDues` counts only when the lane re-inserts under `deadline && canSpawn && inFlight < slots`; a dying lane counts 1. |
|| R18-COR-4 — the field-epoch re-stamp ran ONLY for lanes the caller flagged server-epoch (`offlineSinceIsServerEpoch`); a CLIENT-anchored seed chain (deep-past lastSavedAt, or lastSavedAt < until-elapsed under slow clock) persisted its pending head raw — ~1 cycle early-paid at the next tickWorkers | Low | FIXED — the flag is gone: `advanceWorkerLanes` now marks chains ROOTED at a settle-time seed (`LaneCursor.seeded`, inherited by successors) and the persister re-stamps exactly those `seededPending` heads. A seeded head encodes "remaining work at settle" relative to nowMs, so the one-way shift is correct for every anchor epoch — honest chains defer by their remaining work, crafted deep-past heads lose the early-pay. Saved-lane chains keep their own client deadlines (COR-D1 preserved). `offlineSinceIsServerEpoch` removed from ProductionOffline/ProductionSystem/GameManagerSaveRestore. Residual kept: an ancient SAVED-chain head still pays ~1 cycle early once (bounded, one-time — re-stamping it would break real deadlines). |

## Clean (audited, no defect)

- Online parity: `tickWorkers` passes no `budgetMs` -> the jump
  block is unreachable online; `seededPending` is only consumed by
  ProductionOffline so observe-mode stamps are untouched.
- `pending <-> lanes` index alignment is 1:1 and deterministic;
  double-shift is impossible (shifted entries persist as saved lanes,
  whose chain root is not `seeded`).
- Jump math equivalent to walked forfeits for pay/forfeit/respawn
  ordering; zero-cost heads unreachable under the exact-span pin; the
  10h budget bounds the pre-jump walk — the boot-hang vector from
  r17-AUT-1 stays closed under the widened guard (COR-2).
- Timed-effect mint direction stays closed by the validator pins
  (`appliedAt <= lastSavedAt`, `expires <= marker + 24h + 7d`, source
  resolution, cps probe parity); `appliedAt > lastSavedAt` still
  rejected.
- AUT residual confirmations: `expires == lastSavedAt` dead-at-marker
  consistent across probes; stackable expiry passthrough remains the
  documented r14 residual; `lastSavedAt = 0` / `startedAtMs = -1e15`
  shapes now jump O(1).

## Verification

`npm run type-check` clean; scoped `npx vitest run src/core/production
src/services/save src/stores` — **988 tests, all green** (includes the
cherry-picked auditor repro pins: `src/stores/auditR18Int.repro.test.ts`,
`src/stores/player.r18Aut.test.ts`,
`src/services/save/fixpointR18Cor.qa.test.ts`). One auditor pin bound
re-calibrated with a recorded reason: COR-2's `<= 600` absolute shift
bound undercounted the constant +515 build-side `Array.shift` calls
inside the instrument — the O(1) invariant it exists to prove is the
depth Delta (~0), kept verbatim.
