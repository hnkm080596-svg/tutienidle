# Fixpoint r23 — COR audit (commit da0d553d)

Scope: independent re-audit of the r22 batch — `isBoundedTimestamp`
tightened to `|x| < 2^52` on every persisted timestamp cursor
(`saveShapeValidation.ts`), the `autoWorkerCapacity ≤ 65536` pin,
`boundTimedEffectClocks`/`payoutExpiresAtMs` losing the
`durationStackable` exemption (stores/player.ts), the stackable refresh
writer clamp `min(2^52-1, ...)`
(GameManagerPersistentEffectOps.ts:327-330), the O(1)
`accrueCultivationInsight` drain (CultivationInsight.ts), and the
`--pool=threads` slots-hang child probe (fixpointR20Cor.qa.test.ts).

Verdict: **PASS** — no Medium-or-higher correctness regression. Two Low
and two Nit findings below; all are either unreachable through honest or
crafted-admitted input, or deny-direction by design.

## Invariant ledger

| # | Attack | Result |
|---|--------|--------|
| 1 | Honest timed-effect paths wrongly clamped (stackable/rebuy/TLT chains, boundary, dead-at-save, payout split-window) | Clean with one accepted residual — boundary equalities verified exactly: `expires == provenance+24h` survives whole, `expires == lastSavedAt` takes the dead arm, `expires == lastSavedAt+1ms` is live and whole, TLT `== lastSavedAt+24h` survives while `+1ms` clamps. TLT dead-at-save + slow-clock dead arms hold. Honest stackable chains accumulated past `provenance+24h` truncate at the bound — deny-direction, bounded, needs ~440+ accumulated regen drinks in one group; pinned as R23-COR-2. |
| 2 | Writer clamp `min(2^52-1, …)` downstream arithmetic | Clean — the clamp lands exactly at `BOUND-1`, inside the admitted domain (`< 2^52`); roundtrip re-validation passes (r22 probe pin, re-verified); liveness read `expiresAtMs > now` and modifier emission in `getActiveTimedModifiers` unaffected at the clamp stamp (pinned). |
| 3 | `(2^52, 2^53)` band — honest writers emitting now-rejected stamps | Clean — full writer census: every persisted cursor is now-anchored (`Date.now()`/seconds-domain ~1.7e12) EXCEPT the stackable refresh (clamped at `BOUND-1`, admitted) and `ProductionOffline.fieldEpochShiftMs` re-stamps (bounded by clock-skew magnitude; cannot reach 4.5e15 from honest ~1.8e12 epochs). The band is only producible by crafted payloads — intended rejection. Band probes: `lastSavedAt`, stackable-regen `expiresAtMs` (isolated — the only effect arm with no forward bound), `autoFarmStage.lastCheckedMs` all reject at 4.6e15; `BOUND-1`/`BOUND` admit/reject exactly at the boundary. |
| 4 | O(1) insight drain vs old loop — float remainder equivalence | Equivalent in the honest domain (35k-case differential: boundaries ±ulp of every 2000-multiple + random sweep — identical minted count AND remainder). Two latent divergences pinned as R23-COR-1 (huge accumulator) and the data-hazard arm (fractional threshold, unauthored). |
| 5 | `--pool=threads` child probes | Clean — vitest 4.1.11 supports the pool; env-gate skips in normal runs, the spawned suite executes under `--pool=threads`, and `spawnSync` SIGTERM kills the process incl. worker threads (no pkill sweep needed). `NODE_OPTIONS=--max-old-space-size=768` bounds the hang's memory. Residual: if vitest's graceful SIGTERM teardown itself stalled, the 20s timeout still surfaces the regression as a spawnSync timeout. |
| 6 | `autoWorkerCapacity > 65536` pin | Clean — honest writer `1 + level*2` is bounded by building maxLevel (≤19 authored); `allocateWorkerSlots` floors+sanitizes regardless; the pin mirrors the `advanceWorkerLanes` slots guard 0..65536. Admission coherence verified: 65537 rejects, 65536 admits when a `chi_hien_quan` instance exists (F-W-16 requires it for capacity > 0). |

## Verification evidence

- `npx vitest run src/services/save src/stores/player.ts src/core/cultivation src/core/game` at da0d553d in worktree `.agent-worktrees/audit-r23-cor`: **190 files, 1937 passed / 4 expected-fail / 4 skipped**.
- New probe: `src/services/save/auditR23Cor.probe.test.ts` — **15/15 pass**:
  - 7 restore-boundary pins through the real `restoreFromSave` seam
    (live-arm equality, dead-arm equality, +1ms liveness, TLT equality
    and +1ms clamp, >24h honest-chain truncation residual, fast-clock
    provenance narrowing, slow-clock dead arm).
  - 4 admission-band pins through the real `validateGameSaveShape`
    (`lastSavedAt`, stackable `expiresAtMs`, `autoFarmStage.lastCheckedMs`,
    `autoWorkerCapacity`, each with boundary positive controls).
  - 1 writer-clamp downstream pin (clamped `BOUND-1` expiry stays live
    in `getActiveTimedModifiers`).
  - 3 insight-drain pins (honest-domain differential equivalence vs a
    faithful loop replica; the `acc ≥ ~4.6e18` remainder break with the
    follow-on `validateGameSaveShape` rejection; the fractional-threshold
    divergence demonstration).

## Findings

### R23-COR-1 — Low: O(1) drain remainder can exit `[0, threshold)` at mechanism-level magnitude

`accrueCultivationInsight` computes `acc - floor(acc/t)*t`. Once
`steps*threshold ≥ 2^53` the product is inexact and the remainder leaves
the invariant the loop guaranteed. Demonstrated at `acc =
4_600_000_000_007_372_800` (fed as a single `gained`):

- `steps = 2_300_000_000_000_037` minted to `skillInsight` /
  `totalSkillInsightGained`
- `cultivationInsightAccumulator` lands at **−512** → the NEXT save's
  `requireNonNegativeNumber` rejects it (verified end-to-end via
  `buildGameSave` → `validateGameSaveShape` → `ok: false`).

Reachability: none through real input. Honest accumulators are always
`< threshold` (≤2000 authored); honest `gained` is a cultivation delta
bounded by cps×tick and the offline cap clamp — orders of magnitude
below 1e18. A crafted save carrying such an accumulator dies at
admission anyway (F-A11-2: `accumulator ≥ threshold` rejects;
non-negativity pin). The old loop's failure mode at the same input was a
hang; the new mode is a quick shape violation — strictly better, but the
code comment's "mints the identical result" claim is false past the
2^53-product line. Recommend a comment tightening only; no code change
needed.

### R23-COR-2 — Low (accepted residual, pinned): honest stackable chains past `provenance+24h` lose their tail

Since r22 removed the `durationStackable` exemption, an honestly
accumulated regen chain whose tail extends past `provenance+24h` is
truncated on every restore (`expires = prov+24h`). This is the
deliberate deny-direction loss already documented in
`boundTimedEffectClocks` (r18 comment) — expiry only shrinks, never
mints, and the truncation needs ~440+ consecutive drinks in a single
regen group (durations 60–195s). Pinned in the probe so the loss shape
is locked if the bound is ever revisited.

### R23-COR-3 — Nit: `payoutExpiresAtMs`'s stackable bound is unreachable in practice

The stackable arm of the payout bound can only matter for a record that
is (a) `durationStackable` and (b) feeds `splitCultivationSpeedWindow` —
which filters `effectGroup === 'tu_linh_tran'` + `sourceItemId ===
'tu_linh_tran'` + `cultivationSpeedPercent ∈ (0, 0.25]`. The validator
rejects `sourceItemId === 'tu_linh_tran'` with `durationStackable ===
true` outright, and authored stackable pill regen carries no
cultivation-speed percent. Defense-in-depth; correct as written, just
defending a shape no admitted payload can hold.

### R23-COR-4 — Nit: stale narration in the audited batch's own comments

- `auditR22Cor.probe.test.ts:79` claims `boundTimedEffectClocks` passes
  a stackable `expiresAtMs` "through verbatim" — true when the probe was
  written, false under the code it now tests (stackable clamps at
  provenance+24h). The test's assertions are unaffected (it constructs
  the player directly, bypassing restore), but the comment lies about
  the seam it documents.
- `CultivationInsight.ts` comment "mints the identical result" —
  overstated past the 2^53-product line and for fractional thresholds
  (R23-COR-1).
- `GameManagerPersistentEffectOps.ts` comment "the parked buff stays
  parked" — overstates: a parked far-future stackable expiry clamps to
  `provenance+24h` at the next restore.

## Sibling surface checked

- `ProductionOffline.fieldEpochShiftMs` re-stamps only settle-spawned
  (`seededPending`) cycles; saved-lane chains keep client-epoch stamps —
  consistent with the tightened admission since the shift is bounded by
  `Date.now() - nowMs` skew magnitude.
- `getActiveCultivationSpeedPercent` samples RAW payload stamps at
  `lastSavedAt` for the un-buff divide — unchanged and consistent with
  the r16-INT-01 rationale; bounded payout positions are used only for
  the split.
- `advanceWorkerLanes` mechanism guard (`|stamp| < 2^53`, integer slots
  0..65536) remains the wider complement of the admission bound —
  sub-bound admitted values park inside it harmlessly.
