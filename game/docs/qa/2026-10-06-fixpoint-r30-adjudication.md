# Fixpoint r30 — adjudication

Audited tip: `33ade943` (r29 batch). Auditors: COR `93f46fef`, AUT `88a8234f`,
INT `a01323d5`.
Verdicts: COR PASS (3 Low + 3 Nit — adjudicated + pushed `b6c7410d`),
AUT FAIL (2 Medium + 1 Low + 1 Nit), INT PASS (1 Medium + 1 Nit).
Aggregate at intake: 3 Medium + 4 Low + 5 Nit = 12 actionable.

## Confirmed → fixed

### Unified persisted clock domain — every ms-clock seam now denies outside `[0, 2^52)`

R30-AUT-3 started as a Low guard-window asymmetry and was promoted to the
wave's doctrine fix: previously only *restore* clocks were pinned to the
persisted stamp domain; originate/tick/settle inputs still admitted the
`[2^52, 2^53)` window (stamps minted there self-refuse on the next save
write — a wedge) and *negative* clocks (`-(2^52)-1`, finite, admitted by the
old `|x| < 2^53` guards) re-anchored queues deep-past so the next honest
tick minted them whole (probe: shifted `startedAtMs === -(2^52)-1`, honest
`tick(now)` delivered the pill).

New law: every ms-clock seam — restore, originate, tick, settle, window
inputs — denies `!Number.isFinite(x) || x < 0 || x >= 2**52`. Honest feeds
are unchanged (production callers derive `min(lastSavedAt, Date.now())`,
always in-domain).

| Seam | Old behavior | New |
|---|---|---|
| `AlchemySystem.restoreJobs` restoreNowMs | `-(2^52)-1` re-anchored the queue deep-past → next tick minted all | `clockOk` requires `[0, 2^52)` → verbatim park (deny) |
| `AlchemySystem.startJob` nowMs | `[2^52, 2^53)` stamped a job the next save write self-refused | `invalid_clock` refuse before cost/burn |
| `AlchemySystem.tick` / `DecomposeSystem.tick` | negative/huge nowMs minted or poisoned deadlines | zero-advance outside `[0, 2^52)` |
| `ProductionSystem.restoreStates`, `TribulationDirector.restoreRuntime`, `QuestManager.restore` | same seam class | already `[0, 2^52)` — kept, pinned |
| `WorkerLaneAdvance.advanceWorkerLanes` | `nowMs` admitted up to `2^53`; minted dues could exceed persisted bound | `nowMs < 0` or `!(nowMs + max(0, cycleMs) < 2^52)` denies (NaN-safe complement); pending/seed stamps tightened to `\|x\| < 2^52` |

### R30-AUT-1 (Medium) — `settleOffline` sibling input unguarded

`DecomposeSystem.settleOffline(nowMs, offlineSinceMs)` guarded `nowMs` but
not `offlineSinceMs`: `NaN` → `windowStartMs = NaN` →
`fastForwardEndMs = NaN` → confiscation arm's `nextCycleAt <= NaN` never
fires → the settle loop paid the full backlog to the 5000-cycle bound
(probe: 5000 minted settles vs 2 honest). Fixed: both window inputs deny
`!finite || < 0 || >= 2^52`. Repro flipped to deny pins (zero settle,
`nextCycleAt` parked verbatim).

### R30-AUT-2 (Medium) — `locked`/`favorite` accepted non-boolean

`validateEquipmentEntries` typed `equipped` but never `locked`/`favorite`:
a crafted `locked: 'yes'` validated clean, restored verbatim, read truthy
to every consumer (dissolve/refine refuse, auto-dissolve excludes) —
500 crafted entries wedged the equipment channel permanently (honest drops
self-dissolved on arrival). Fixed: both flags are optional-boolean —
`undefined` or boolean only, anything else refuses.

### R30-INT-1 (Medium) — combat channel unfrozen under local coded refuse

Turn battles run on `CombatClock` (RafClockSource/MainProcessClockSource),
stepped by `advanceCombat` with no `entryStage` consultation. The r29 tick
gate froze the world sim behind the mounted error surface, but under LOCAL
authority `observeSaveResult` early-returns (no reconnect dep), so no
`freezeCombat` ever fired — a live battle kept resolving behind
SaveIncompatibleScreen (bounded: writes refuse, remedies reload).
Fixed: the coded-refuse arm in `App.vue` now calls
`lifecycle.pauseSimulation()` BEFORE `bootFlow.fail()` — the identical
freeze chain the remote tier gets via `enterTerminal → onPause('terminal')`.
Ordering is load-bearing (`pauseSimulation` self-guards on
`entryStage === 'game'`) and pinned by a source-ordering assertion + a
frozen-battle behavior probe in `auditR30Int.probe.test.ts` F1.

### R30-AUT-4 (Nit) — resolved by the INT-1 fix

AUT called `pauseSimulation` unreachable-dead on the refuse path; it is now
the live freeze signal there.

### R30-COR Lows (pushed `b6c7410d`)

- `selectedTalentIds` + `persistentTimedEffects` element walks past the
  cap-gate → bound at the binding (`ID_COLLECTION_CAP`).
- `applyTimedEffect` non-stackable writer arms unclamped → clamped
  `expiresAtMs` into `|x| <= 2^52 - 1`.
- Legacy equipment entries (dropped at restore) no longer counted toward
  bag/protection caps.

### Stale-pin flips

Prior probes asserting the old `2^53`/negative-clock semantics re-pinned to
the `[0, 2^52)` domain: `auditR21Aut` (`TWO_POW_52`, 4e15 edges), `auditR21Int`
(-4e15, boundary asserts), `auditR28Cor` (verbatim +60_000 shift titles),
`auditR29Aut`/`auditR29Cor` (deny boundaries `±2^52`/`2^53-1`, admit
`2^52-1`), `auditR30Cor` (DENY_CLOCKS + admit edges), `auditR30Aut` (F1/F2/F3a
deny pins), `auditR30Int` (F1 freeze-ordering pin).

## Accepted (documented, no fix)

- **INT R-leg**: negative-magnitude `lastSavedAt` stays admitted — every
  derivation collapses to the deep-past class the gate already admits;
  pair-pins vs `lastSavedAt` collapse the admittable payload further.
- **`+0`/`-0` clocks**: both stamp the tiny past — lying-clock semantics,
  outside the broken-clock doctrine (no epoch floor exists).
- **COR N2/N3 (from `b6c7410d`)**: `buildings.lastCollectedAt` carries no
  validator pin — accrual is already double-bounded (storage cap + restore
  clamp); ±1-2ms boundary rounding is inherent to float domains.

## Verification

- `npm run type-check` clean; eslint clean on all touched files (one stale
  unused import in `auditR21Int` removed).
- `npx vitest run src/services/save --pool=threads` — 68 files / 1385 pass.
- `npx vitest run src/core src/App --pool=threads` — 512 files / 4998 pass.
- P15 ASCII `//` comments verified on every changed file.
