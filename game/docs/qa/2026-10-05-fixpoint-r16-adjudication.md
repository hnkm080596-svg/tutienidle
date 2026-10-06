# Fixpoint r16 adjudication — audit commit ed0f57e9 (the r15 batch)

Wave r16 (3 blind auditors: COR / AUT / INT) attacked the r15 epoch-split batch.
Verdicts: **COR FAIL (2 High + 1 Nit)**, **AUT FAIL (3 High, one shared root)**,
**INT FAIL (2 Medium + 2 Low + 1 Nit)**.

## The root class: one wrong direction + two epoch leaks

r15 re-expressed the offline cultivation window in the payload epoch but
anchored the skew shift at the window END (`clockSkewMs` against `untilMs`),
which positioned the payout window as `[lastSavedAt - elapsed, lastSavedAt]` —
the interval BEFORE the save. The offline span runs AFTER the save marker.
Every r16 mint resolves to this reversal or to the two reads disagreeing on
which copy of `expiresAtMs` determines liveness.

## Confirmed findings

| Finding | Sev | Disposition |
| --- | --- | --- |
| R16-COR-1 — backward payout window: pre-save death paid +25%, live-at-save buff paid full window regardless of real remaining life (562.5 vs 500; 6250 vs 5150; 550 vs 500) | High | FIXED — payload window re-anchored `[lastSavedAt, lastSavedAt + authorizedWidth]`; `clockSkewMs` removed. |
| R16-COR-2 — validator probes RAW `expiresAtMs` at `lastSavedAt` while `percentAtSave` probed the clamped payout copy: skew >24h admitted `cps = BASE*1.25` then paid it flat (6250 vs honest 5150) | High | FIXED — `percentAtSave` now samples the RAW payload effects at `lastSavedAt` (the validator's own probe semantics). Same defect as r16-INT-01 / r16-AUT-3. |
| COR-Nit — `savedTimedEffects` dead binding | Nit | FIXED — removed (restore map at :604 computes its own bound copy). |
| R16-AUT-1 — `expires == lastSavedAt` record minted +25% over the whole window | High | FIXED — dead-at-marker now sits at the window START boundary -> contributes 0%. Same root as COR-1. |
| R16-AUT-2 — save marker inside the authority window minted the pre-marker stretch | High | FIXED — same root as COR-1; the window no longer pays pre-marker time. |
| R16-AUT-3 — probe/sample divergence (skew >24h) minted (1+p)^2 | High | FIXED — same as COR-2/INT-01. |
| AUT-Low — pill regen `expires` unbounded (stackable chains) | Low | ACCEPTED RESIDUAL — extends the standing stackable-chain residual (r14-COR-3/INT-3): no honest bound exists for additive chains; honest chains reach the same shape. |
| r16-INT-01 — `percentAtSave` read the bound copy instead of raw stamps | Medium | FIXED — raw read at `lastSavedAt`. |
| r16-INT-02 — `reconcileBuildings` stamped new-instance `lastCollectedAt` with the server anchor while readers subtract `Date.now()` -> fast clock minted `min(skew, 10h)` accrual | Medium | FIXED — `SaveSystem.restoreGameSession` passes `Date.now()/1000` (the field's own epoch; `initializeCharacter` already used `nowSeconds()`). The r14-INT-6 premise was wrong: the anchor only ever stamped NEW grants, and a new building has no granted window to backpay. |
| r16-INT-03 — `ProductionOffline` spawned lane deadlines persisted in the settle-window (server) epoch into `workerCycles`, which `tickWorkers` reads against `Date.now()` -> every leftover spawned lane paid ~1 cycle early per site per boot | Low | FIXED — spawned pending lanes are re-stamped `+max(0, Date.now() - settleNowMs)` into the field epoch; saved lanes keep their stamps; shift is one-way (slow clock keeps bounded underpay). Existing offline/parity tests now pin `Date.now()` at their synthetic origin so the deterministic frame is unchanged. |
| r16-INT-04 — `questManager.restore` clamped `lastDailyResetAtMs` with `min(payload, authorityNow)` -> a fast clock dragged the marker a day back and refired the daily reset (wipe + re-arm) | Low | FIXED — clamp against `Date.now()` (field epoch); the r11-AUT freeze guard still kills future stamps. Beta scope-hidden, no live victim. |
| r16-INT-05 — stale r13-INT-03 comment + dead `savedTimedEffects` | Nit | FIXED — comment rewritten; binding removed. |

## Clean (audited, no defect)

- `settleAutoFarmOffline` Date.now() revert — bound `min(elapsed, now - lastCheckedMs)` cannot exceed the authorized window; both COR and AUT cleared it.
- 7d provenance allowance on the TLT gate — nothing it admits mints beyond the 24h live-claim bound at restore.
- Pill regen realm gate direction; effectGroup dedup vs probe; `durationStackable` boolean pin.
- INT-16 UX flag (cultivation vs production positioning under fast clock): same authorized width paid by both; only positioning differs — not a defect.

## Residual (documented, accepted)

- Live claims (`expires > lastSavedAt`) earn at most `provenance + 24h` — honest
  positioning under skew > 24h is unprovable, so a real mid-window tail under
  big skew underpays to flat (bounded deny; e.g. repro test 3 now yields 5000
  vs honest 5150).
- Stackable regen chains keep no expires bound (r14 residual, extended by the
  AUT-Low note above).

## Regression pins added

- `src/services/save/fixpointR16Cor.qa.test.ts` — merged COR repro file (4
  cases, expectations corrected to the fixed semantics) + the AUT-1/2
  dead-at-marker boundary pin.
- `src/stores/player.restoreFromSave.test.ts` — r15-COR-B pin rewritten as
  r16-COR-1 (death positioned INSIDE the honest window, skew +1h under the
  claim bound; cps folds the honest +25% snapshot) + a pre-save-death pin.
- `src/services/save/SaveSystem.timeAuthority.test.ts` — three new pins:
  INT-02 building grant stays field-epoch (server-behind clock => 0 stored);
  INT-03 spawned lane deadline stays ahead of `Date.now()`;
  INT-04 quest marker preserves the same-day stamp.
- `src/core/production/ProductionOffline.test.ts` +
  `ProductionSystem.offlineParity.test.ts` — `Date.now()` pinned to the
  synthetic origin so the deterministic deadline frame survives the
  field-epoch re-stamp.

## Verification

- `npm run type-check` — clean.
- `npx vitest run src/services/save src/stores src/core/production src/core/building src/core/quest` — 64 files / 1030 tests green (incl. all new pins).

## Note on r15-COR-B's original pin

The r15 pin asserted 562.5 as "honest" for a buff dead 250s before the save —
it encoded the mint. Corrected: the honest value is 500 (dead pre-save) or
562.5 only when the death truly lands inside the post-save window.
