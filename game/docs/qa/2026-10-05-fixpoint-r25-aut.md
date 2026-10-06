# Fixpoint r25 — AUT audit (2a3f95a9)

Blind adversarial audit of the r24 adjudication batch at `2a3f95a9`
(branch `codex/hoa-cau-fireball-vfx`). Objective per assignment: attack
the batch for MINT/WEDGE/BRICK — (a) does the degraded
`{kind:'live-replacement', nowMs: Date.now()}` open a new paying path,
(b) does the `settleNowMs` `Date.now()` clamp leave survivors,
(c) `QUEST_LIST_CAP` craft-around + unbounded sibling collections,
(d) stamp classes that slip the `|x| < 2^52` domain check.

**Verdict: FAIL — two CONFIRMED self-brick residuals of R24-INT-01's
fix.** The batch's clamp bounds the settle *end* (`settleNowMs`) but not
the window *start*: seeded worker-lane heads stamp `offlineSinceMs` raw,
so an in-domain future `sinceMs` + future-dated `lastSavedAt` persists
`workerCycles[].startedAtMs > now` — and the next save's own
`startedAtMs <= lastSavedAt` pin rejects it (`'corrupted'` → recovery
surface) for the full crafted skew, arbitrarily long. The sharper
sibling needs no settle at all: the pin compares against the payload's
*own* marker, so a future `lastSavedAt` admits crafted future lane heads
under any authority — including none. Plus one fail-open arm:
`sanitizeRestoreAuthority` honors an *unknown* `kind` verbatim, which
both restores then read as the legacy client window — a hole shaped
exactly like the one r24 closed for corrupt stamps. Probe suite:
`src/services/save/auditR25Aut.probe.test.ts` (11 probes, all green —
the two RESIDUAL tests pin the defect, not the desired behavior).

## The r24 batch under audit

- `sanitizeRestoreAuthority` (saveTypes.ts:298): corrupt authority →
  `{kind:'live-replacement', nowMs: Date.now()}` (zero-accrual) instead
  of `undefined`.
- `GameManagerSaveRestore.ts:424-428`: `settleNowMs =
  min(lastSavedAt + elapsed*1000, authorityNowMs, Date.now())`.
- `saveShapeValidation.ts`: `QUEST_LIST_CAP = 1024` on
  `quests.active` / `completedOnceIds` / `questFlags`.
- `CultivationInsight.ts`: comment-only.

## Attack arm A — does the degraded anchor mint?

**Deny — verified end-to-end.** `{kind:'live-replacement'}` resolves
`elapsedOfflineSeconds = 0` by kind at the manager seam
(`GameManagerSaveRestore.ts:390-391`) and the player seam
(player.ts:372-402). Consequences, all pinned by probe A1/A2:

- `elapsed <= 60` → production `settleOffline`, decompose
  `settleOffline`, and the full autofarm settle never run; an armed farm
  reaches only the `settleAutoFarmOffline(player, 0)` re-anchor (0
  cycles, `lastCheckedMs = now`).
- The unconditional alchemy settle runs `tick(settleNowMs)` with
  `settleNowMs = min(lastSavedAt + 0, degraded-nowMs≈now, now) =
  min(lastSavedAt, now)` — dues strictly inside `(lastSavedAt, now]`
  are *not* delivered. That is tighter than the absent-authority path
  (`min(lastSavedAt + clientElapsed, now) = now`).
- Store seam: `elapsedSeconds = 0`, `cultivation = 0` — vs the same
  payload under `undefined` paying `min(clientWindow, 24h) = 86400s`.
  Probe A2 pins the strict inequality side-by-side.

So the degraded anchor is strictly ≤ the absent-authority payout on
every channel — no new mint; the only concession vs an honest
live-replacement is alchemy dues inside `(serverNow, clientNow]` on a
fast local clock — bounded by the player's own clock skew, deny-consistent.

**Nit (informational):** the two seams sanitize *independently*, so a
degraded authority anchors at two different `Date.now()` reads (sub-ms
divergence between the player and manager windows). Harmless under
`elapsed = 0`; noted only because the r23 seam-blindness class exists.

## Attack arm B — `Date.now()` settle clamp survivors

The clamp narrows every settle cursor to `<= now`; each elapsed-driven
channel is additionally self-bounded within the approved window
(verified): cultivation ≤ 24h store cap, autofarm
`min(elapsed, 86400s, anchorGap) × 0.5`, production 10h budget +
lane ceiling, decompose `max`-window + 5000-cycle loop bound, alchemy
persisted dues only. Dues deferred to `(now, untilMs]` re-pay at real
times — no loss.

**But the clamp does not bound `offlineSinceMs`:**

```
settleNowMs   = min(F + e*1000, untilMs, now)     // clamped
offlineSinceMs = min(lastSavedAt, untilMs - e*1000) // = min(F, sinceMs) - NOT clamped vs now
```

For a cold-boot, `untilMs - e*1000 = sinceMs`. When **both** the payload
marker `F` and the approved window start `sinceMs` exceed `now`, the
window inverts: `offlineSinceMs = min(F, sinceMs) > now = settleNowMs`.
`settleWorkersOffline` passes it as `emptyLaneStartMs` —
`advanceWorkerLanes` (WorkerLaneAdvance.ts:195-205) seeds lanes
`{startMs: offlineSinceMs, dueMs: +cycleMs}` — all dues land past
`nowMs` so the loop breaks immediately and every seeded head persists
in `workerCycles` with `startedAtMs = min(F, sinceMs)`. The
`fieldEpochShiftMs = max(0, Date.now() - nowMs)` re-stamp is inert
(`nowMs = Date.now()` → shift 0). Next `buildGameSave` stamps
`lastSavedAt = Date.now()`, and the F-TC10-WC pin rejects the game's
own write → `'corrupted'` → SaveIncompatibleScreen. Brick duration =
`min(F, sinceMs) - now` — attacker-settable up to the domain bound
(~1.4e5 years), though any positive skew suffices.

### R25-AUT-1 — window-start seed survives the settle-end clamp — **Medium, residual of the r24-INT-01 fix (PRE-EXISTING class)**

- **Invariant**: a save emitted after restore must re-admit under
  `validateGameSaveShape` (round-trip closure).
- **Repro** (probe `R25-AUT-1 RESIDUAL`): `lastSavedAt = NOW + 24h`,
  cold-boot `{sinceMs: NOW + 24h, untilMs: NOW + 24h + 600s}` —
  `elapsed = 600 > 60` → seeds at `offlineSinceMs = NOW + 24h` →
  heads' `startedAtMs === NOW + 24h` persist → repackaged save fails
  `startedAtMs > lastSavedAt` → `shape.ok === false`. The store seam
  still pays the approved 600s (`elapsedSeconds === 600`) — the
  accrual channels obey the window while the persistence seam bricks.
- **Reachability**: crafted save (future marker) + corrupt/future
  authority stamps — both admitted in-domain by design. Honest arm is
  narrow: a save written under a forward-set clock *plus* a server
  checkpoint stamp ahead of the client clock — the same honest-skew
  class R24-INT-01 already accepted as reachable (it rated the
  `untilMs > now` arm honest-reachable at ~skew/cycleMs; this arm
  needs *both* clocks forward of now).
- **Why the fix misses it**: `settleNowMs` clamps the settle *end*;
  the seed *start* (`emptyLaneStartMs`) derives from `offlineSinceMs`,
  which has no `Date.now()` bound. Same invariant, sibling arm.
- **Candidate direction** (adjudication, not scope): clamp
  `offlineSinceMs = Math.min(lastSavedAt, untilMs - elapsed*1000,
  Date.now())` — window start can never exceed now; or re-stamp
  seeded heads symmetrically (`|Date.now() - nowMs|`, the r16 shift
  made two-way).

### R25-AUT-2 — the own-marker pivot: payload-declared future lane heads — **Medium, same class, no settle or authority needed**

- **Mechanism**: the admission pin `workerCycles[].startedAtMs <=
  lastSavedAt` compares against the payload's *own* marker — and
  `isBoundedTimestamp` admits any finite `|x| < 2^52` `lastSavedAt`,
  future included. A crafted save declares `lastSavedAt = NOW + 24h`
  and lane heads at `NOW + 60s` → passes the pin, restores verbatim
  (absent authority → `elapsed = 0` → no settle → lanes untouched) →
  the next write stamps `lastSavedAt = Date.now()` → same rejection.
- **Repro** (probe `R25-AUT-2 RESIDUAL`): `validateGameSaveShape(save)
  .ok === true` on the crafted payload, then repackaged
  `shape.ok === false`.
- **Root-cause note**: the fix clamps a *producer* (settle); the pin's
  reference frame is the defect — any `stamp <= ownMarker` pin admits
  stamps past real-now whenever the marker itself is forged forward.
  Sibling pins with the same pivot: `alchemyJobs[].startedAtMs`,
  `persistentTimedEffects[].appliedAtMs` (both also persist → same
  delayed brick). Only the workerCycles arm is probe-verified here.
- **Suggested direction**: either pin `lastSavedAt <=
  Date.now()`-relative stamps at admission (a tolerance-bounded
  `startedAtMs <= lastSavedAt` *and* `startedAtMs <= ~now`), or pin
  the marker itself `lastSavedAt <= Date.now() + skewTolerance`.

## Attack arm C — QUEST_LIST_CAP + unbounded collections

- **Cap semantics verified** (probe C1): `active`, `completedOnceIds`,
  `questFlags` deny at 1025, admit at 1024. Per-entry cost inside the
  cap is trivial.
- **R25-AUT-3 — cap ordering inconsistency (Low)**: `active` checks
  `length > CAP` *before* iterating; `completedOnceIds`/`questFlags`
  evaluate `.every(isString)` and `new Set(...)` on the unbounded
  array *first* — a pathological list pays the full `O(n)` Set
  allocation before the cap rejects it. Saves sized in megabytes make
  this a real (if modest) boot-time wedge; hoist the length check to
  match `active`.
- **Per-entry strings unbounded** (informational): `questId`/flag
  string length is byte-bounded only — consistent with every string
  field in the file; no distinct defect.
- **Sibling collections without count caps** (informational, verified
  by reading + probe C2): `materials`, `pills`, `talismans`,
  `formations`, `equipment` (protected entries are exempt from
  `EQUIPMENT_BAG_SOFT_CAP`), `skills`, `buildings`,
  `equipmentSlots`, `companions`, `companionGifts`,
  `persistentTimedEffects`, and every `Record<string,int>` map
  (`hiddenChannelCycles`, `skillCastCounts`, `nodeLevels`,
  `perfectClearSeconds`, `talentLevels`, `nodeFreePurchaseRecord`,
  `nodeOneShotGrants`, `hiddenBeastKills`). All bounded only by payload
  bytes + registry/realm pins — the dedup writers make counts
  "producible-bounded" nowhere else the way quests' were; a
  QUEST_LIST_CAP-style bound on the big restore-iterated lists is the
  same hardening shape. Deny direction (write-size/iterate cost).
- **Stack `amount` unbounded in the gate** (probe C3): the validator
  pins non-negative only — `materials: [{id, amount: 1e12}]` admits —
  but `MaterialBag.add` clamps at `material.stackLimit ??
  MAX_STACK_AMOUNT` (1000) and returns overflow → the seam denies;
  Nit-level gate/seam drift (the F-CULT-OVERCAP convention would pin
  `amount <= stackLimit`; spirit stones' `stackLimit =
  MAX_SAFE_INTEGER` is intentionally unbounded).
- **Quest `progress` mint** (documented residual, by-convention):
  `addProgress` has no writer bound, so `progress >= condition.amount`
  on a declared `claimed:false` quest is producible-consistent and
  `claim()` pays the authored reward. Unpinnable under the
  validator's own "unproducible" rule — same accepted class as
  mirror-bounded accumulators (`skillCastCounts` feeding the
  `totalExperience` pin). No new arm vs the batch.

## Attack arm D — stamp classes vs `|x| < 2^52`

- **Admitted verbatim** (probe D-matrix): `-0`, fractional ms,
  subnormals, deep-past/future in-domain magnitudes — all behave as
  their numeric value downstream; deny direction (a `-0`/`deep-past`
  window pays nothing not already owed).
- **Fail closed** (probe D-matrix): strings, `null`, coercible
  objects (`{valueOf}` → `Number.isFinite` is false), `NaN`, `±Inf`,
  `|x| >= 2^52` — all degrade to the zero-accrual anchor.
- **R25-AUT-4 — unknown `kind` is honored (Low, fail-open arm)**: a
  `kind` other than `'cold-boot'` takes the `nowMs` stamp branch; if
  that field is present and in-domain the *object passes verbatim*,
  and both restores' `kind` ladder falls through to the legacy
  client-window `elapsed`. Probe D-rogue: `{kind:'server-approved',
  nowMs: NOW-300s}` pays `elapsedSeconds === 300` — exactly the
  "present-but-untrusted pays the client window" widening r24 closed
  for corrupt *stamps*. Unreachable today (`kind` is
  client-constructed in `useAppLifecycle`), but the sanitizer is the
  documented fail-closed gate — the kind check is the hole. Cheap fix:
  honor only `kind === 'cold-boot' | 'live-replacement'`, degrade the
  rest.
- **Authority re-parse**: `sanitizeRestoreAuthority` runs once per seam
  on the caller's object; no downstream consumer re-parses raw stamps —
  the two `Date.now()` degraded anchors are the only divergence
  (arm-A nit).
- **`null`/non-object authority** reaches `timeAuthority.kind` and
  throws → caught by `restoreGameSession` → `'rejected'` (recovery
  surface) — deny, Nit.

## Findings ledger

| # | Severity | Status | One-line |
|---|----------|--------|----------|
| R25-AUT-1 | Medium | Confirmed (probe) | Window-start seed stamps `min(F, sinceMs)` — future marker + future `sinceMs` → self-brick (`startedAtMs > lastSavedAt`) |
| R25-AUT-2 | Medium | Confirmed (probe) | `startedAtMs <= lastSavedAt` pivot: forged future marker admits future lane heads directly — bricks on next write, no authority needed |
| R25-AUT-3 | Low | Confirmed (code) | `completedOnceIds`/`questFlags` run `.every`+`new Set` on unbounded input before the `> 1024` check |
| R25-AUT-4 | Low | Confirmed (probe) | Unknown authority `kind` with in-domain stamps is honored → client-window elapsed (fail-open vs the fail-closed contract) |
| Nit | Nit | Code-verified | Stack `amount` unbounded in gate, clamped at `bag.add` (deny at seam); two independent `Date.now()` degraded anchors per restore; `null` authority throws → rejected |

## Evidence table

| Arm | Path | Evidence |
|-----|------|----------|
| A | degraded authority → all channels | probes A1/A2: 0 accrual, only alchemy cursor = marker; absent pays 86400s |
| B1 | inverted window → seeded future heads → brick | probe `R25-AUT-1 RESIDUAL`: `startedAtMs === NOW+24h`, `shape.ok === false` |
| B2 | future marker admits crafted heads → brick | probe `R25-AUT-2 RESIDUAL`: admission `ok`, repackage `ok === false` |
| B3 | past window → `settleNowMs = untilMs` denies | probe B3: production/alchemy cursors `= NOW - 1h`, repackage `ok` |
| C | cap boundary + ordering + siblings | probes C1-C3; validator/seam reads |
| D | stamp classes | probes D-matrix; rogue-kind probe D pays 300s |

## Pre-existing notes (not charged to this batch)

- R25-AUT-1/2 are residuals of a documented pre-existing class
  (R24-INT-01 / r19 carried observation). The r24 fix correctly closed
  the settle-end arm — these sibling arms survive it and suggest the
  pin frame (`<= own lastSavedAt`) is the durable fix surface.
- The unbounded-collection inventory and quest-progress mint are
  accepted-convention residuals — listed for adjudication awareness.

## Verdict

**FAIL — FAIL WITH REASON**: the batch holds its deny guarantee on
arm A (no new mint through the degraded anchor) but the R24-INT-01 fix
is incomplete at the class level — two self-brick producers remain
(Medium), plus two Low hardening gaps. All defects are deny/wedge
direction; no MINT was found on any reachable path through the batch.
