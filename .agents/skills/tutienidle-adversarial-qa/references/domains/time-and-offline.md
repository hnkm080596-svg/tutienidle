# Time and Offline

## Load When

Changes touch `src/core/idle/`, `src/core/production/ProductionSystem.ts` or its offline-settlement path, `src/core/player/PersistentTimedEffect.ts`, `src/core/game/GameManager.ts`, `src/composables/useAutoRetryCountdown.ts`, `src/composables/useCadenceSmoothing.ts`, or save/boot code that supplies timestamps or applies offline work.

## State Owners and Boundaries

`src/core/idle/GameClock.ts` provides `GameClock.calculateOfflineTime()` as the elapsed-offline calculation boundary and clamps rollback/cap inputs. `src/core/idle/OfflineProgressSystem.ts` converts caller-supplied seconds and does not independently measure time. `src/core/game/GameManager.ts` coordinates timed systems and fixed-step combat catch-up. Save state supplies persisted timestamps; boot/app code is a handoff point that must not reapply the same elapsed interval.

## High-Risk Invariants

- Each elapsed-time calculation has one clock owner; conversion code consumes that result rather than computing a competing elapsed interval.
- Offline duration is bounded by the configured maximum and never negative, including a clock rollback.
- Applying a given offline interval twice does not duplicate its accrual.
- At a timer threshold, `deadline - 1 ms`, `deadline`, and `deadline + 1 ms` have deliberate, distinguishable behavior.
- Timer throttling, pause/resume, and large catch-up deltas do not bypass caps or produce uncontrolled repeated work.

## Attack Recipes

- Evaluate `calculateOfflineTime` with a timestamp before `lastOnlineAt`, at the cap, and one millisecond after the cap; observe non-negative duration and clamping.
- Restore a saved production/timed-effect state, apply offline settlement twice with the same now value, and observe no second reward or progress.
- Compare a combat interval delivered in many fixed steps with one throttled delta; observe equivalent in-cap combat progression and a bounded over-cap path.
- Pause a countdown immediately before its threshold, resume at threshold plus one millisecond, and observe one transition rather than zero or multiple.

## Cross-System Chains

- Saved timestamp → `GameClock` elapsed calculation → offline conversion/production settlement → save snapshot.
- Browser tab throttling → `GameManager.update()` fixed-step catch-up → battle/stage state → combat UI refresh.
- Auto-retry countdown → pause/resume lifecycle → stage/battle restart → persistence of resulting progression.

## Existing Test Seams

`OfflineProgressSystem.test.ts` covers cap, rollback, and non-negative conversion. `ProductionSystem.test.ts` covers offline sequential settlement, cap enforcement, and no duplicate roll. `GameManager.fixedStepCatchup.test.ts` covers split versus lumped combat deltas and the catch-up ceiling. `GameManager.timedEffect.test.ts`, `useAutoRetryCountdown.test.ts`, and `useCadenceSmoothing.test.ts` cover adjacent time behavior.

## Coverage Gaps to Look For

Seek a controlled time source at boot/save boundaries so repeated offline application is observable. Verify timer tests can model background throttling and pause/resume without wall-clock sleeps. Check whether threshold tests specify the unit used at each handoff (milliseconds versus seconds).
