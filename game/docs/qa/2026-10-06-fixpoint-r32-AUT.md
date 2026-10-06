# Fixpoint audit r32 — AUT (adversarial exploit)

Auditor: r32-AUT worker (Devin session). Base: `codex/hoa-cau-fireball-vfx`
@ `1d27aee4` (the full r31 adjudication). Role: assume every r31 fix is
exploitable — mint/wedge/self-brick paths through the new `[0, 2^52)`
non-negative persisted-clock domain, the mint-headroom guards
(`!(clock + Math.max(0, span) < 2**52)`, incl. its NaN complement), the
`restoreJobs` drop-vs-`restoreStates` park asymmetry, the `bootGame`
`simPaused = false` re-baseline, and the TLT-shaped `appliedAtMs`
push-arm clamp (`min(2^52 - 1, Date.now())`); then siblings of each
class (adjacent stamps, adjacent collections, adjacent seams, adjacent
throw-paths).

In-place audit on the audit commit (test+doc writes only — P1/P2
read-only on production code). Every claim below carries an EXECUTED
deterministic repro in `src/services/save/auditR32Aut.probe.test.ts`
(13 tests, all passing — `npx vitest run <file> --pool=threads`,
`@vitest-environment node`, `Date.now` mocked where the save clock
matters). Report branch: `devin/audit-r32-AUT-1d27aee4`.

Verification executed:
- `npx vitest run src/services/save/auditR32Aut.probe.test.ts --pool=threads`
  — 13/13 green.
- `npm run type-check` (vue-tsc --build) — clean.
- Full read of the r31 surfaces at the audit commit:
  `WorkerLaneAdvance.ts` (:146-171 — non-negative `< 0` denies on
  `nowMs`, `emptyLaneStartMs`, `pending[]` stamps + `+cycleMs` headroom
  on the two mint inputs; ordering deny `completesAtMs <= startedAtMs`;
  deadline-mode `skippedDues` fast-forward), `ProductionSystem.ts`
  (:129-189 `restoreStates` verbatim park + headroom-guarded shift,
  :387-470 `tickWorkers` observe-mode `emptyLaneStartMs: nowMs`),
  `ProductionOffline.ts` (:90-206 `settleWorkersOffline`,
  `emptyLaneStartMs: offlineSinceMs`, `fieldEpochShiftMs` re-stamp
  :184-191), `DecomposeSystem.ts` (:151-211 `tick` headroom, :242-299
  `restore` `clockOk` + `min()` mergedDeadline merge, :303-381
  `settleOffline` `nowMs`/`offlineSinceMs` bounds + 5000-settle loop
  bound), `AlchemySystem.ts` (:376-463 `restoreJobs` drop-check +
  foldable-digest shift re-derive, :486-560 `startJob` `invalid_clock`
  headroom :512-518, :660-790 `tick` settle-only, :792-810
  `settleOffline`), `GameManagerSaveRestore.ts` (:363-475 —
  `restoreClockMs`/`settleNowMs`/`offlineSinceMs` all `min(…, Date.now())`,
  `lastAppliedPayloadHash` same-payload dedup :160/:586),
  `GameManagerPersistentEffectOps.ts` (:307-385 stackable/non-stackable/
  push arms), `useAppLifecycle.ts` (:346 `simPaused = false` baseline,
  :258-298 pause/resume gates), `TribulationDirector.ts` (:843-894
  `restoreRuntime` `min()` cooldown clamp), `QuestManager.ts` (:144-200
  `restore` `min()` marker clamp), `saveShapeValidation.ts` (:421-426
  bound helpers, :1588-1680 `persistentTimedEffects` stamp/group/TLT
  pins, :2430 `lastSavedAt` symmetric bound, :2516-2522
  `lastCheckedMs`, :3374 `lastDailyResetAtMs`, :3484-3587 `workerCycles`
  span+ordering+realm+`startedAtMs <= lastSavedAt` pins, :3708-3849
  `alchemyJobs` ordering+span+reservation-witness admission,
  :4595-4665 `decompose`/`tribulation.cooldownUntil` bounds),
  `ProductionBalance.ts` (`CYCLE_BASE_SECONDS_BY_REALM` covers all 10
  authored realms — span-skip unreachable), `AlchemyJob.fixture.ts`,
  `Player.ts` `boundTimedEffectClocks` (:119-164 live/dead-arm clamps),
  `BuildingSystem.ts` `claim`/`getStoredAmount` elapsed cap.

---

## Verdict: PASS WITH EVIDENCE (0 Critical / 0 High / 0 Medium / 2 Low / 4 Nit)

The r31 batch holds on every production-reachable surface: the new
`[0, 2^52)` domains drop or park crafted stamps in the deny direction,
every `+span` mint on the hot paths carries the companion headroom, the
`!(…)` form denies NaN spans, and the `appliedAtMs` push clamp emits a
domain-admitted stamp for all honest inputs. The findings below are all
residual parity/arithmetic gaps on defense-in-depth seams whose only
reachable trigger is a validator-bypassed payload or an ungated caller
clock — the same reachability profile adjudicated at Low in r30/r31
(F3b / R31-AUT-1/2 precedent).

| ID | Severity | Class | Surface |
|---|---|---|---|
| R32-AUT-1 | Low | parity gap / mint | `AlchemySystem.restoreJobs` drop-check mirrors the validator's bound pins (finite, `>= 0`, `< 2^52`, :395-404) but NOT its ordering pin (`completesAtMs > startedAtMs`, saveShapeValidation.ts ordering check on `alchemyJobs`). An in-domain INVERTED pair `{startedAtMs: t, completesAtMs: t - 500}` is not dropped: it restores verbatim (started <= restoreNow → no shift), sits live, and settles on the next honest tick — `nowMs >= completesAtMs` → settle arm → `verifyAlchemyJobReservation` replays (the digest folds the crafted stamps, self-consistent) → pill mints. PROBED: `restoreJobs([jobAt(now-1000, 'job_inverted_pair', now-1500)], now)` → `getJobs() === 1` → `tick(now)` → settlement event `{success: true, delivered >= 1}`. Sibling contrast PROBED: the identical inverted `ProductionCycle` into `advanceWorkerLanes` is ordering-denied (zero-advance, `pending` retains it) — the two engines diverge on the same crafted input. Reachability: validator-bypassed payloads only — the load gate refuses the pair before `restoreJobs` ever sees it; the drop-check is precisely the bypass defense-in-depth, so this is a parity hole in that wall. Deny-side note: persisted, the pair also fails the ordering pin on the next write (wedge). |
| R32-AUT-2 | Low | parity gap / mint+wedge | Both restore shift arms mint INVERTED pairs: the r31 headroom `restoreNowMs + (completesAtMs - startedAtMs) < 2**52` is trivially satisfied by a NEGATIVE span, so a post-dated inverted pair (`startedAtMs > restoreNowMs`, `completesAtMs < startedAtMs`) shifts to `{startedAtMs: restoreNowMs, completesAtMs: restoreNowMs + (negative span)}` — an inverted minted pair. PROBED (alchemy): `restoreJobs([jobAt(now+2000, 'job_shift_inverted', now+1000)], now)` → `getJobs()[0] = {startedAtMs: now, completesAtMs: now-1000}` → `tick(now)` settles it instantly (already due) → mint event. PROBED (production): `restoreStates` mints the same `{started: now, completes: now-1000}` pair into `workerCycles` — `advanceWorkerLanes` then ordering-denies it → parked forever AND fails the persisted-shape ordering pin on every subsequent write (wedge). Same bypass reachability as F1: only a validator-bypassed payload can present `startedAtMs > restoreNow` with a negative span (the span pin and `startedAtMs <= lastSavedAt` pin both refuse the honest-load path). |
| R32-AUT-3 | Nit | arithmetic / wedge | `DecomposeSystem.restore` `mergedDeadline = Math.min(Math.max(0, restoredDeadline), restoreNowMs + this.cycleMs)` (:292-296) — the CAP is itself a minted stamp: `restoreNowMs + cycleMs` carries no headroom. When `restoredDeadline >= restoreNowMs + cycleMs` AND `restoreNowMs` sits within `cycleMs` of the bound, `nextCycleAt` mints `>= 2^52` and the next write self-refuses (`isNonNegativeBoundedTimestamp` on `.decompose.nextCycleAt`). PROBED: `restore({nextCycleAt: 2^52 + 1000, started: true, workers: 1}, 2^52 - 1)` → `getSaveState().nextCycleAt === 2^52 + 1000`; end-to-end, a wire save carrying `decompose.nextCycleAt = 2^52 + 1000` refuses at `validateGameSaveShape`. Sibling: `TribulationDirector.restoreRuntime` `Math.min(cooldownUntil, restoreNowMs + TRIBULATION_COOLDOWN_SECONDS * 1000)` (:870-878) is the same shape (code-verified). Nit rationale: needs BOTH a bypassed out-of-domain payload stamp AND an ungated near-bound restore clock — two unreachables deep. Not the same as the r31 `min()` rejection (recorded in R31-AUT-3): there `min(bounded, restoreNow + span) <= bounded` held because the bound operand was admission-bounded; here the bound operand `restoreNowMs + cycleMs` is the arithmetic that escapes the domain. |
| R32-AUT-4 | Nit | arithmetic / wedge | `ProductionOffline.settleWorkersOffline` re-stamps seed-rooted lane heads by `fieldEpochShiftMs = Math.max(0, Date.now() - nowMs)` (:184-191) with NO headroom — every clock INPUT (`restoreNowMs`/`settleNowMs`/`offlineSinceMs`) is `min(…, Date.now())`-clamped, but the raw `Date.now()` delta re-enters through the shift: a client clock crafted ~`2^52` ms ahead of the settle epoch mints `startedAtMs`/`completesAtMs` `>= 2^52` → next write refuses. PROBED: `Date.now()` mocked to `settleNow + 2^52`, `settleProductionOffline({states, …}, 'mortal', settleNow, {workerCapacity: 1, offlineSinceMs: settleNow - 1})` → `workerCycles[0] = {startedAtMs >= 2^52, completesAtMs >= 2^52}`. Nit rationale: crafted-clock class (system clock ≈ year 143000) — same reachability family as the adjudicated crafted-clock residuals; recorded because this is the ONE seam where a far-future `Date.now()` still mints out-of-domain stamps while every sibling input stays clamped. |
| R32-AUT-5 | Nit | NaN persistence / wedge | `applyTimedEffect` push arm (:377-384): `Math.max(-(2^52-1), effect.appliedAtMs)` propagates NaN — a caller-crafted `appliedAtMs: undefined/NaN` produces `Math.min(2^52-1, Date.now()) → NaN` persisted, and `isBoundedTimestamp(NaN)` refuses the next `buildGameSave` write (NaN serializes to `null`, refused either way). PROBED: `applyTimedEffect(player, {appliedAtMs: NaN, expiresAtMs: now+1000, …})` → `player.persistentTimedEffects[0].appliedAtMs` is `NaN`; a wire save carrying `appliedAtMs: null` refuses at `validateGameSaveShape` (`player.persistentTimedEffects[].appliedAtMs`). Ungated-caller input only — every production writer stamps `Date.now()`. The r31 clamp bounds the ceiling but not the NaN case (same NaN-persistence class as the pinned `expiresAtMs` residual — the new line extends it to `appliedAtMs`). |
| R32-AUT-6 | Nit | ungated-input / bounded buff | `applyTimedEffect` stackable arm (:328-331) derives `duration = Math.max(0, effect.expiresAtMs - effect.appliedAtMs)` from the RAW caller stamps, not the clamped domain: a `{-2^52+1 … 2^52-1}` span pushes `existing.expiresAtMs` to the `2^52 - 1` ceiling — a near-permanent in-session buff through the documented ungated-caller channel. PROBED: existing `{expiresAtMs: now+1000, effectGroup: 'probe_group'}` + crafted `{durationStackable: true, appliedAtMs: -(2^52-1), expiresAtMs: 2^52-1}` → `existing.expiresAtMs === 2^52 - 1`. Outcome still self-bounds at the domain edge and `boundTimedEffectClocks` re-clamps at restore — Nit. |

## Attack log — rejected candidates (verified held)

- **Exact-boundary mint `nowMs + cycleMs === 2^52`** — PROBED both arms:
  `advanceWorkerLanes` denies at equality (`!(2^52 < 2^52)`), admits one
  ms below with minted dues `< 2^52`. `DecomposeSystem.tick` denies at
  `2^52 - cycleMs + 1` (nextCycleAt untouched) and mints `2^52 - 1` at
  `2^52 - cycleMs - 1`. Float-tiebreak is safe: the headroom expression
  is byte-identical to the mint expression, so rounding cannot split
  them.
- **`!(…)` NaN-complement on every new site** — `Math.max(0, NaN)` =
  NaN → `nowMs + NaN < 2^52` false → deny. Held on `WorkerLaneAdvance`
  (both arms), `startJob`, `DecomposeSystem.tick`/`settleOffline`, and
  both restore shift arms.
- **`restoreJobs` out-of-domain drop (the r31 fix itself)** — PROBED:
  `{startedAtMs: -1}` and `{startedAtMs: 2^52}` both drop →
  `getJobs() === 0`.
- **`startJob` headroom** — PROBED: `nowMs = 2^52 - span + 1` →
  `{ok: false, reason: 'invalid_clock'}`; `nowMs = 2^52 - span - 1`
  passes the gate (fails later at `wrong_herb` on the empty registry —
  the headroom itself admits).
- **`simPaused = false` re-baseline** — rejected: `pauseSimulation`
  additionally requires `entryStage === 'game'` (:261), so a real pause
  cannot have been orphaned before the boot baseline clears the stale
  latch; a failed boot leaves `simPaused` false with no running clock
  to expose. Verified statically across `bootGame`/`stopAll` ordering.
- **`QuestManager.restore` marker clamp** — `min(lastDailyResetAtMs,
  nowMs)` output `<=` in-domain `nowMs`: no `+span` term exists, so no
  over-bound mint is constructible; bad-clock verbatim arm parks
  (deny). Held.
- **`TribulationDirector.restoreRuntime`** — same `min()`-cap mint
  shape as R32-AUT-3 (folded into it as a sibling, not a separate
  finding).
- **`alchemySecondsFor` non-finite `roomLevel`** — `multipliers[NaN]` →
  `?? 1` → honest span mint; the persisted `roomLevelAtStart: NaN`
  would wedge on `isFiniteNumber` — ungated-caller input only, same
  family as R32-AUT-5.
- **`jobSuccessPercent` non-finite bonus** — `NaN` percent →
  `floor(NaN/100)`/`NaN % 100` → `pills` NaN → `pills > 0` false →
  fail path (deny), no mint.
- **`buildProductionCycle` `rollSeed = floor(rng() * 0x7fffffff)`** —
  `rng() >= 1` mints over-bound int → validator int-bound refuses;
  `sessionRng` is `mulberry32` `[0,1)`. Ungated-rng only.
- **Deep-past-0 pairs `(0, span)` under the new non-negative domain** —
  admitted, settle instantly, but bounded by `budgetMs` /
  `PRODUCTION_OFFLINE_CAP_SECONDS` / the 5000-cycle settle bound — the
  adjudicated deep-past residual class, not a new finding.
- **`emptyLaneStartMs > nowMs` inverted window** — seeds future-dated
  lanes whose `startedAtMs` can persist `> lastSavedAt` (ordering-pin
  wedge) — but `offlineSinceMs <= settleNowMs` holds by `min()`
  arithmetic on every production caller; ungated-caller only.
- **`lastAppliedPayloadHash` same-payload re-restore mint** — the dedup
  blocks identical-payload re-application; a payload differing outside
  `alchemyJobs` re-applies the job list verbatim — consistent because
  the writer emits live state, not stale stamps.
- **WorkerAllocator / capacity-derived `maxLanes`** — lane count only
  inflates persisted size; per-lane output stays budget-capped.
- **`restoreStates` verbatim park of out-of-domain stamps** — the
  documented asymmetry: parked stamps self-harm their own channel AND
  the write gate refuses them — both directions are deny; no mint
  path opens (F2's inverted shifted pair is the wedge form of the same
  class and is counted there).

## What this wave confirms

The r31 batch's own attack surface is closed: the only surviving
vectors require an already-bypassed payload (F1/F2) or an ungated clock
two hops from any reachable caller (F3/F4), plus caller-crafted
non-finite stamps (F5/F6). None open a production-reachable mint,
wedge, or self-brick. If the coordinator's fixpoint bar is "zero Medium
or above", this wave qualifies; the Lows/Nits are parity/armor-depth
items on seams that only hostile-bypassed content reaches.
