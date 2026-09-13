# QA Review: Phase A2 — Boss Enrage Content + Talent Passive-Conversion Rewiring

- Date: 2026-09-07
- Mode: quick
- Verdict: PASS WITH EVIDENCE (after one in-session production fix, see QA-2026-09-07-001 — QA exited, fix applied in dev workflow per P4/P12, full suite re-run green)
- Task-owned paths:
  - `game/src/core/enemy/Enemy.ts`
  - `game/src/core/enemy/Enemy.bossTrigger.test.ts`
  - `game/src/core/combat/CombatEntity.ts`
  - `game/src/core/game/TurnBattleAdapter.ts` (+ test)
  - `game/src/core/game/GameManager.ts`
  - `game/src/core/game/GameManager.talentv4.qa.test.ts`
  - `game/src/data/buff/buffs.ts` (+ test)
  - `game/src/data/enemy/Enemies.ts` (+ test)
  - `game/src/data/talent/Talents.test.ts`
  - `game/src/core/battle/turn/TurnBattleSystem.test.ts`
  - `game/src/core/battle/turn/TurnBattleSystem.ts` (QA finding fix)
  - `game/src/core/battle/turn/TurnBattleSystem.bossTriggerUnknownId.qa.test.ts` (reproduction → regression)

## Scope and Risk Map

Risk map (`changed-risk-map.mjs`) over the 6 production paths returned domains
`combat-and-tribulation`, `economy-and-progression`, `pinia-phaser-sync`,
`time-and-offline` and `deepAuditCandidate: true` (cross-system ≥4 domains +
"critical state boundary: time-and-offline"). Manual bounding applied and
recorded here:

- **time-and-offline**: no clock owner, timestamp, or offline-settlement path
  touched. The only fixed-step consumer (`GameManager.updateBattleFixedStep`)
  is a one-hop read of unchanged timing logic; A2 changes what data flows into
  the turn engine, not when ticks run. Risk bounded by code inspection.
- **economy-and-progression**: no reward/cost path touched. Talent
  passive-conversion buffs are combat-battlefield-only state (pool inside
  `TurnBattle`), not persisted (INV-4 already covers non-persistence).
- **pinia-phaser-sync**: no Vue/Pinia/Phaser ownership change; boss enrage
  surfaces only through the existing entity-snapshot event path.
- **combat-and-tribulation**: primary domain — reviewed in depth below.

Escalation to deep audit is **not** applied: the deepAuditCandidate flag was
investigated and every material cross-system chain is bounded by existing
green integration seams plus the new regression test; the single Confirmed
defect found was fixed in-session and re-verified (full suite 2852/2852).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-A2-1 | `TurnBossTrigger` on enemy participant (`TurnBattleSystem` boss-trigger block) | Enemy turn reaches `afterTurns` → registry lookup → buff apply | Exactly-once: trigger fires once, `firedAlready` guards re-apply | Repeat (61+ `resolveNextStep` calls) | `buffs.hasAny('mortal_crocodile_enrage')` + `firedAlready === true`, single buff entry | Unit (`TurnBattleSystem.test.ts` new e2e-content test) | High — A2 makes real data reach this path for the first time |
| INV-A2-2 | Same block | `buffDefinitionId` not present in `TURN_BUFF_REGISTRY` | Recoverability: unknown id must not crash the battle tick | Value mutation (unknown id at lookup boundary) | `resolveNextStep` does not throw; battle stays `fighting`; `firedAlready` stays `false` | Unit (reproduction → regression `TurnBattleSystem.bossTriggerUnknownId.qa.test.ts`) | **Critical reachability** — content drift would hard-crash every fixed-step tick from the trigger moment |
| INV-A2-3 | `PassiveSystem` buffApplier (`GameManager`) | 10 crit events → `tryConvertAtThreshold` → apply `kiem_vuc` | Conservation/targeting: burst buff lands on the live turn-based player pool, not the legacy real-time one | Stale state (legacy battleSystem reads during turn-based gameplay) | `getTurnBattle().players[0].buffs.hasAny('kiem_vuc') === true` | Integration (`GameManager.talentv4.qa.test.ts` INV-2/INV-2b) | High — this IS the silent-gap bug being fixed |
| INV-A2-4 | Same, second battle | New battle → fresh pool, stacks reset | Idempotency across battles: no carry-over of converted buff | Repeat (2 consecutive battles) | second battle `hasAny === false`; passive stacks `0` | Integration (INV-3) | Medium |
| INV-A2-5 | `PassiveSystem` hpReader | HP-gated passive condition during turn battle | Synchronization: reads the live turn-based player entity | Stale state | ratio read from `players[0].entity` (code-level, same accessor pattern as buffApplier; covered by shared test fixture wiring) | Code inspection + INV-2 wiring | Medium |
| INV-A2-6 | Enemy data (`Enemies.ts`) × registry | All 3 realm-final bosses carry `bossTrigger` resolving in `TURN_BUFF_REGISTRY` | Determinism/conservation: authored ids resolve; buffs are permanent +attack/+speed | Value mutation (each id) | `it.each` over 3 ids; duration `Infinity`; both statModifiers present | Unit (`Enemies.test.ts` Phase A2 block) | Medium |
| INV-A2-7 | `Talents.passiveConvertsTo` ids | Runtime consults `TURN_BUFF_REGISTRY` post-cutover | Synchronization: test validates the registry actually consulted | Stale state (test vs runtime registry drift) | `TURN_BUFF_REGISTRY.get(id)` does not throw per passive skill | Unit (`Talents.test.ts`) | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npx vitest run` (full suite, worktree) | **2852/2852 pass, 436 files** (435→436 with the new regression test; 2849→2852 across A2 additions) | post-fix re-run |
| `npm run type-check` (vue-tsc --build) | 0 errors | run after every task |
| `npm run build` | ✓ built in 4.25s | Task 4 gate |
| Reproduction test `TurnBattleSystem.bossTriggerUnknownId.qa.test.ts` vs pre-fix code | FAILED for the intended reason: `Error: TurnBuffRegistry: unknown buff id "buff_id_not_in_registry"` thrown from the 2nd `resolveNextStep` (enemy's first turn) | intended-failure evidence for QA-2026-09-07-001 |
| Same test post-fix | PASSES (both calls no-throw, `firedAlready === false`, battle still `fighting`) | regression coverage retained |
| `npx vitest run` on the 3 buff/enemy/talent test files | 35/35 pass | focused gate |

## Findings

### QA-2026-09-07-001: Unguarded `TURN_BUFF_REGISTRY.get()` in the boss-trigger block crashes the battle tick on unknown buff ids

- Severity: High (combat corruption — every subsequent fixed-step tick of the
  battle throws; in the real app this manifests as a frozen battle from the
  trigger moment, the P13 "silence" class)
- Status: **Confirmed** (intended-failing reproduction test) → **fixed in-session**
- Invariant: Recoverability — INV-A2-2
- Preconditions: any enemy participant whose `bossTrigger.buffDefinitionId`
  does not resolve in the injected `TurnBuffRegistry`. A2 makes
  `bossTrigger` reachable with real data for the first time (3 bosses now
  carry it); a future rename/typo in `buffs.ts` or `Enemies.ts` reaches this
  path in ordinary play.
- Reproduction: fixture battle with `bossTrigger = { afterTurns: 1,
  buffDefinitionId: 'buff_id_not_in_registry' }`; call
  `resolveNextStep` twice (turn 1 = player, turn 2 = enemy actor reaches the
  trigger block).
- Expected: lookup failure skips the buff; battle continues.
- Actual (pre-fix): `Error: TurnBuffRegistry: unknown buff id` propagates out
  of `declareActorAction` through `resolveActorTurn`/`tickPacing` — no
  try/catch exists anywhere on this path (verified: 0 `try` blocks in
  `TurnBattleSystem.ts`; none in `TurnBuffSystem.ts`/`CombatSystem.ts`).
- Evidence: reproduction test failed pre-fix, passes post-fix (see table).
- Test file: `game/src/core/battle/turn/TurnBattleSystem.bossTriggerUnknownId.qa.test.ts`
- Owner subsystem: `TurnBattleSystem` boss-trigger block (~line 666).
- Blast radius: battle tick loop only; no persistence or progression side
  effects. Fix mirrors the established formation-buff skip pattern at
  `GameManager.ts:2426` (try/catch → `undefined` → skip), keeping
  `firedAlready = false` so a corrected id can still fire later. This
  satisfies the plan's own Global Constraint ("every call site that looks up
  a buff by id at runtime must wrap it in try/catch") which the untouched
  original block predated.

Note: `TurnBattleSystem.ts:869` (`appliesBuff` lookup) has the same
unguarded shape, but its only reachable data today is
`reaction_empowerment` (Pháp Tu reaction ultimate, documented known-gap in
roadmap mục 9.8 — currently unwired to any ultimate slot). Classified as
**Suspected** with a known follow-up; not task-owned. Recommendation: same
try/catch when reaction-path ultimates ship (roadmap 9.5 #12).

### Suspected / coverage notes (non-blocking)

- `Talents.test.ts` now validates against `TURN_BUFF_REGISTRY` (INV-A2-7) —
  prevents test/runtime registry drift.
- Pre-existing mojibake in `Enemies.ts` legacy `FLOOD_DRAGON_ENRAGE` strings
  and `TurnReactionPathSkills.ts` — untouched (P10 scope discipline).

## New or Changed QA Tests

- `game/src/core/battle/turn/TurnBattleSystem.bossTriggerUnknownId.qa.test.ts`
  (new): proves the boss-trigger lookup survives unknown ids without
  throwing and without marking `firedAlready`. Fails on pre-fix code for
  exactly the intended reason.
- `game/src/core/battle/turn/TurnBattleSystem.test.ts` (extended): real
  production content (`mortal_crocodile_enrage`) fires through the full
  chain Enemy → CombatEntity → participant → engine tick → buff pool after
  60 boss turns (fixture corrected during review: 650 calls + 1M HP player
  because gauge build-up means ~10 calls per enemy turn and the default HP
  fixture dies first).
- `GameManager.talentv4.qa.test.ts` INV-2/INV-2b/INV-3 updated: asserts on
  the turn-based pool post-cutover (INV-2b also locks the realm-free stage
  fixture requirement discovered during review — `STAGES[0]` requires
  `qi_refining` and rejects a default mortal player).
- `Enemies.test.ts` / `Talents.test.ts` / `buffs.test.ts`: Phase A2 content
  guards (3 ids resolve, +attack/+speed permanent shape, 51-entry count).

## Gaps and Residual Risk

- `appliesBuff` lookup unguarded (Suspected, non-task-owned, see note above).
- Visual confirmation of the enrage buff in any player-facing tooltip/VFX is
  out of scope per the spec's Testing Strategy (no rendering change in A2).
- P14 live-browser check not applicable (pure data/logic change; no UI, no
  Phaser scene, no interaction touched).

## Pre-existing Failures

None observed — full suite green before and after the task on this branch.
