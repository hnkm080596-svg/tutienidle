# QA Review: M10 authored-execution parity + Hoi Xuan Dan retirement

- Date: 2026-09-14
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - game/src/core/game/SkillToTurnSkillConverter.ts
  - game/src/core/game/GameManager.ts
  - game/src/core/game/GameManagerTurnBattleOps.ts
  - game/src/core/game/GameManagerPillOps.ts
  - game/src/core/game/GameManagerAlchemyOps.ts
  - game/src/core/battle/turn/TurnBattleSystem.ts
  - game/src/core/battle/turn/TurnSkillAction.ts
  - game/src/core/buff/BuffSystem.ts
  - game/src/core/alchemy/AlchemySystem.ts
  - game/src/core/pill/Pill.ts
  - game/src/data/pill/PillFamilies.ts
  - game/src/data/pill/pills.ts
  - game/src/data/alchemy/alchemyRecipes.ts
  - game/src/components/panels/AlchemyView.vue
  - game/src/components/panels/bag-sections/PillBagSection.vue
  - game/src/core/game/GameManager.authoredParity.test.ts
  - game/src/core/game/SkillToTurnSkillConverter.test.ts
  - game/src/core/pill/PillSystem.profession.test.ts

## Scope and Risk Map

Changed systems: skill->turn-skill conversion, production basic-attack
resolution, buff application duration override, pill consumption gate,
alchemy job start gate, two Vue surfaces (alchemy list filter, pill bag
reason text).

Mapper domains: combat-and-tribulation, economy-and-progression,
pinia-phaser-sync, time-and-offline, ui-input-lifecycle.
`deepAuditCandidate: true` was returned because alchemy paths sit adjacent
to the time-and-offline boundary. Bounded by code inspection: the change
adds only a `retired` early-return in `AlchemySystem.startJob` and
`GameManagerAlchemyOps.startAlchemyJob`. Job timing, `tick`/`settleOffline`
math, `restoreJobs`, save shape, and offline accrual are untouched — no
time ownership or offline-settle rule changed. Escalation not required.

Unmapped task-owned paths (`core/game/*Ops.ts`, converter + tests) were
manually routed: `GameManagerTurnBattleOps` -> combat-and-tribulation;
`GameManagerAlchemyOps`/`GameManagerPillOps` -> economy-and-progression;
converter -> combat-and-tribulation. Test files carry no production risk.

One-hop consumers inspected in current code: `GameManagerTickOps` alchemy
tick + settlement-event drain; `GameManagerSaveRestore` alchemy
restore/settle; `toTurnBattleParticipant` basic slot; `BuffSystem.apply`
callers (self + target branches); `PillBagSection.drinkPill` reason map;
`AlchemyView` recipe list. No exclusions.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-M10-1 | Player basic / `GameManager.resolvePlayerBasicAttack` | Battle construction resolves basic via canonical converter or static fallback | Authored kit preserved; unsupported kit rejected loudly, never silently physical-x1 | Reorder (specialization swap), stale state (skill unlearned) | `getTurnBattle().players[0].basic` fields | Integration (GameManager) | High — verified: tram x1001, doc_chuong no damage, hoa_cau_thuat elemental+scaling |
| INV-M10-2 | Turn cadence / `TurnBattleOps` | Converted basic normalized to cooldownTurns 0, resourceType none | Boundedness/cadence — every-turn swing preserved | Value mutation (authored cost/cooldown would break cadence) | `basic.cooldownTurns === 0` | Integration | High — verified |
| INV-M10-3 | Buff duration / `BuffSystem.apply` | `appliesBuff.duration` overrides registry base pre-resist | Conservation of authored semantics | Value mutation (undefined vs authored) | buff.duration > 7.5 (8*0.998) vs registry 5.988 | Integration | High — verified |
| INV-M10-4 | Retired pill / `PillBag` + registry | `usePillDetailed` on `hoi_xuan_dan_mortal` | Atomicity — reject, no consume, no effect | Repeat, stale state (old-save bag entry) | `{ok:false, reason:'retired'}`, bag count unchanged | Integration | High — verified |
| INV-M10-5 | Retired recipe / `AlchemySystem` | `startAlchemyJob`/`startJob` on retired recipe | Rejection before slot/cost gates | Reorder (full slots still reports 'retired') | reason 'retired' | Integration | High — verified |
| INV-M10-6 | In-flight job / `AlchemySystem.jobs` | `settleOffline` on job started pre-retirement | Recoverability — completes once, delivers pill, recipe still resolvable | Interruption (save mid-job -> reload -> settle) | settled=1, pill in bag, job removed | Integration | High — verified (new test) |
| INV-M10-7 | Unsupported authored fields / converter | `grantsHoaThePerCast` on fire basic | Reported via warn, executable kit still runs | Degraded capability | console.warn fires; damage/ailment fields intact | Integration | Medium — verified (warn observed in test output) |
| INV-M10-8 | Consume surface / `usePill` wrapper | Non-detailed consume path | Same gate — delegates to usePillDetailed | Bypass | code inspection: `usePill` returns `usePillDetailed(...).ok` | Unit (static) | Medium — verified by inspection; no alternate consume surface exists (grep: only PillBagSection caller) |
| INV-M10-9 | Craft surface / `AlchemyView` | Retired recipe hidden from craft list | Synchronization UI<->domain | Stale state | `recipe.retired !== true` filter + domain gate stays as backstop | Static + domain gate | Medium — verified |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/game/GameManager.authoredParity.test.ts` | 8/8 pass | incl. new in-flight settle test |
| `npx vitest run src/core/game/SkillToTurnSkillConverter.test.ts` | 16/16 pass | duration + strict-trigger contracts |
| `npx vitest run src/core/pill/PillSystem.profession.test.ts` | 9/9 pass | retired-pill rejection + live mp_regen pill |
| `npx vitest run src/core/battle/turn src/core/buff src/core/pill src/core/alchemy src/core/game src/data/skill` | 1022 pass, 4 expected-fail | expected-fail = quarantined perfectClear fixtures (documented debt, unchanged by M10) |
| `npm run type-check` | clean | vue-tsc build mode |
| `npx eslint` on all 16 touched files | clean | no new warnings |
| Code inspection: `AlchemySystem.tick`/`settleOffline` recipe+pill resolution | retired entries still resolve; flag never consulted on settle path | AlchemySystem.ts:333-335 |
| Code inspection: `PillBagSection` reason chain | 'retired' mapped to user-facing Vietnamese string | line ~186 |

## Findings

No confirmed defects.

## New or Changed QA Tests

- `game/src/core/game/GameManager.authoredParity.test.ts` — added
  "an alchemy job started BEFORE retirement still settles and delivers
  the pill": restores a legacy job for `alchemy_hoi_xuan_dan_mortal`
  and settles offline; proves recipe resolvability + delivery + job
  removal for the retirement boundary.

## Gaps and Residual Risk

- `collectUnsupportedSkillSemantics` warns once per battle construction;
  under `turnBattleRepeatContinuously` the warn re-fires per cycle.
  Bounded, operator-visible, acceptable — not a defect.
- `hoa_cau_thuat`'s authored `grantsHoaThePerCast` remains unexecuted by
  the turn engine (warned, not granted). This is the explicitly reported
  limitation the mission card sanctions; a resource-grant runtime is
  parked as future scope, not silently dropped.
- P14 visual check deferred per the worktree exception: AlchemyView
  filter + PillBagSection reason text are logic-verified only; a live
  browser pass should confirm the retired recipe is absent from the
  list and the toast renders the retirement message during branch
  finishing on an authorized checkout.
- E2E surface (full battle loop with canonical basics) is covered by the
  existing Playwright suite baseline rather than a new spec; unit/
  integration evidence is decisive for the changed contracts.

## Pre-existing Failures

- `GameManager.perfectClear.feasibility.test.ts` — 4 `it.fails`
  quarantined fixtures (documented playtest debt,
  `docs/qa/2026-09-14-perfectclear-debt.md`). Unrelated to this change;
  output confirms they still fail for the recorded reason.
