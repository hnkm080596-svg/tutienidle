# Reaction System M0 — Inventory + Prerequisite Verification

Baseline: `7b66ac5dc455a83ffc5f81b38299f4d88d068114` (`feat/reaction-core`,
branched from `feat/buff-core` @ Buff M3). All "current state" claims
reference this SHA. Worktree: `.agent-worktrees/reaction-core`.

## Step 2 — Foundation prerequisites (BLOCKING): ALL PRESENT

| Required | Location | Status |
| --- | --- | --- |
| `ConsumeBuffStacksOperation`, `AddBuffStacksOperation`, `AddBuffModifierOperation`, `ExtendBuffDurationOperation`, `ApplyBuffOperation`, `PushGaugeOperation`, `HealOperation`, `DealDamageOperation` | `contracts/operations.ts` | present (19-member union) |
| `CombatOperationOrigin` (sourceId on origin only) | `contracts/origin.ts` | present |
| `ResolvedCombatOperation`, `ReactionEligibility` | `contracts/operations.ts` | present |
| `ImmediateSettlement` union (`operations`/`batch`), `CombatOperationBatch` (preconditions + ordered ops), `DeferredOperation` (pre-minted `operationId` + `origin`), `BatchResultContext` | `contracts/settlement.ts` | present |
| `ElementalApplicationCommitted` | `contracts/events.ts:43` | present — union member + `Omit<…,'combatSequence'>` intake alias at :296 |
| `CombatCapabilityQuery { has(entityId, capabilityId) }` | `contracts/capability.ts:7` | present |
| `CombatScheduler`, `CombatOperationExecutor`, `BuffAuthority`/`DamageAuthority`/`GaugeAuthority` ports, `CombatAuthorityExecutionContext` | `runtime/scheduler/` | present (amended v7.x surface) |
| `BuffSystem` read+mutation surface (`getInstance`/`getForTarget`/`getByDefinition`/`getStacks`/`consumeStacks`/`addStacks`/`addModifier`/`extendDuration`/`apply`) | `core/buff2/` | present (M1–M3 landed; canonical-sorted queries) |
| `BuffDefinition.forbiddenActionTags` | `core/buff2/BuffDefinition.ts` | present |
| `BuffInstanceSnapshot.instanceId` | `core/buff2/BuffInstance.ts` | present |

No `src/core/reaction/` exists yet — clean slate, no parallel contract
types will be created.

## Step 3 — Legacy reaction path (stays live through M1–M6; M-INT deletes)

- `TurnReactionManager.checkAndTrigger` — `src/core/battle/turn/TurnReactionManager.ts:67`,
  called at `TurnBattleSystem.ts:2995` inside `applySkillAilments`,
  gated by `initiatesReactions` ← `actor.canInitiateWuxingReactions === true`
  (`TurnBattleSystem.ts:1458`, flag field at `:140`).
- Two-phase loop in ELEMENT_ORDER: Phase 1 sinh (Công Minh) amplifies the
  child via `scaleBuffPotency(child, 1 + CONG_MINH_AMP)` + `remainingTurns`
  /`remainingTime` *= 1.5; Phase 2 khắc (Khắc Chế) consumes both instances,
  `rawBurst = consumedStacks × elementalBasePower × KHAC_CHE_COEFF ×
  (1 + reactionEffectPercent)`, mitigated, dealt via
  `applyModifiedDirectDamage(..., 'reaction')` + `killIfDead`.
- Constants: `KHAC_CHE_COEFF = 1.0`, `CONG_MINH_AMP = 0.5`
  (`TurnReactionManager.ts:38–39`); rules engine `core/element/WuxingRelations.ts`.
- **STALE DOC confirmed:** `docs/systems/elements-reactions.md` references
  `core/element/ElementReaction.ts`, `core/element/ReactionManager.ts`,
  `core/element/ElementLoadout.ts` — none exist. Live path is
  `WuxingRelations.ts` + `TurnReactionManager.ts`. (M5 doc fix scope.)

## Step 4 — Turn-engine seams

- `selectAction` `TurnSkillAction.ts:500`, `selectForcedAction` `:536`,
  `FALLBACK_BASIC_ATTACK` `:426` (skillId-less fallback, `damage` present →
  R-E2 `['attack']` inference applies).
- `applySkillAilments` `TurnBattleSystem.ts:~2959` (ailment roll →
  legacy `BuffSystem(target.buffs).apply` → gated `checkAndTrigger`).
- `enqueueFollowUpExecutions` multicast roll ~`:2217–2263` (per plan;
  region exists, exact lines drift with WIP).
- `resolveDeclaredHit` `:2087` call site passes `canInitiateWuxingReactions`.
- `ActionGauge`: `GAUGE_MAX = 1000` (`ActionGauge.ts:6`);
  `refundGauge` `:40` clamps `[0, GAUGE_MAX]`, positive-only — pushback
  needs negative-delta support via the GaugeAuthority port (contract owns it).

## Step 5 — Capability candidates

- Precedent: `TurnBattleParticipant.canInitiateWuxingReactions` stamped at
  battle build from `activeStatDomains.includes('phap_tu')`
  (`src/core/game/TurnBattleAdapter.ts:60` — file moved from
  `battle/turn/`; plan's path stale).
- `resolvePathRuntime` seam at `GameManagerTurnBattleOps.ts:856` (private
  impl; injectable `deps.resolvePathRuntime` at `:254`).
- Buff `capabilities` descriptors exist on `BuffDefinition` (buff spec §47).
- Recommendation per plan: `CombatCapabilityQuery` impl = battle-build
  participant flag map → later buff capability descriptors.
- `elemental_reaction_enabled` stays UNGRANTED through M1–M6 AND M-INT
  (R7/r4: Ngộ Đạo hidden-path scope only; never the visible `phap_tu` seam).

## Step 6 — Damage/vitals seam

- `CombatSystem.applyModifiedDirectDamage` `CombatSystem.ts:144`,
  `applyDirectDamage` `:128`, `applyHealing` `:164`, `killIfDead` `:130`.
- `VitalsChangeReason` already includes `'reaction'`
  (`EntityVitalsSystem.ts:5`) — no new reason needed.
- `elementalBasePower(source, element)` — `ElementDamageCalculator.ts`
  (input the `reaction_damage` profile resolves).
- `getResistanceMitigationPercent` — `Resistance.ts`.

## Step 7 — Authority matrix + ruling assumptions (sign-off table)

| ID | Ruling | Status |
| --- | --- | --- |
| R3 | Legacy `TurnReactionManager` + `canInitiateWuxingReactions` stay live and untouched through M1–M6; deletion owned by **M-INT inside the buff M4 worktree** (same branch, pre-merge — the cutover deletes the `BuffPool` it reads/mutates). NO replacement grant; legacy auto-react is retired, not preserved. M-INT registers NO `ReactionDispatcher` (no valid production `ReactionRegistry` before canonical content). | LOCKED (r3/r4/r5) |
| R7 | Engine lands capability-ungranted M1–M6 AND M-INT grants `elemental_reaction_enabled` to nobody; Ngộ Đạo grant = hidden-path content scope (seal batch). Production `.has()` always false in this program. | LOCKED (r4/r5) |
| R-E2 | `actionTags` inference: no authored tags → `['attack']` iff def carries `damage`; slot-less `basic_attack` fallback always `['attack']`. Explicit `actionTags` wins. | PROVISIONAL — real taxonomy lands with skill-definition pipeline |
| R-F | `operationId`s deterministic: `rx.${event.eventId}.${reactionId}.${index}` incl. DeferredOperation entries; `combatSequence` NEVER copied (scheduler sole allocator). | LOCKED |
| CON-23 | No core special cases — no reaction-id/element branches in engine code; relations + payoffs are data. | LOCKED |

## M0 verdict

UNBLOCKED — every prerequisite verified present and compiling at
`7b66ac5d`. Legacy path + seams documented; M1 may proceed.
