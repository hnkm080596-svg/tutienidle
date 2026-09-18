# Deep Adversarial QA — Reaction M4 (payoff emission + canonical data + Cam Cong)

- **Scope**: `StackExpr`, `ReactionOperations` payoff emitter, `CANONICAL_REACTIONS`
  (ten defs), `ReactionSystem` default-emitter wiring, `ReactionRegistry` seal-time
  payoff validation, `ActionValidator` + Cấm Công turn-selection integration
  (`TurnSkillAction`, `TurnBattleSystem`), `BuffTypes.forbiddenActionTags`,
  `ReactionTestFixtures` extension.
- **Mode**: deep (live turn-selection path touched; plan-required).
- **Date**: 2026-09-18. **Branch**: `feat/reaction-core` @ reaction-core worktree.

## Verification matrix (all from `game/`)

| Command | Result |
|---|---|
| `npm run test` | 663 files / 5636 passed / 4 expected-fail — PASS |
| `npm run type-check` | `vue-tsc --build` clean — PASS |
| `npm run build` | vite build clean (43.8s) — PASS |
| `npm run test:e2e` | 27 passed (14.0m) — PASS |

## System map (rebuilt independently)

- **BuffInstance runtime state** (stacks/modifiers/remaining) — owned by `BuffSystem`
  (buff2). Reaction emits typed ops (`ConsumeBuffStacks`, `AddBuffStacks`,
  `AddBuffModifier`, `ApplyBuff`, `ExtendBuffDuration`); BuffSystem executes. No
  direct mutation in `ReactionOperations` — verified by inspection.
- **Reaction evaluation** — `ReactionSystem.resolveCandidate` freezes a snapshot
  context (`ReactionContext`: participant stacks pre-consume, source/target ids,
  causation event id). `StackExpr` evaluates against the frozen context only —
  no live-pool reads at emission time.
- **Batch ordering** — consume ops first, then authored payoff order, deferred
  `heal_from_damage` trailing; execution delegated to `CombatOperationBatchRunner`
  (single batch authority). Mid-batch death → partial outcome + typed skips, no
  rollback (pinned by M3 batch tests).
- **Turn action selection** — `TurnBattleSystem.declareActorAction` computes the
  forbidden-tag set once per declare via `BuffPoolActionValidator` (live
  instances × registry defs), passes it to `selectAction`/`selectForcedAction`.
  Selection priority ultimate→special→basic preserved; each candidate filtered.
  No legal action → `NULL_ACTION` sentinel → declared `action: null`,
  `skillId: ''`, `ccBlocked: false`.
- **Action tags** — `actionTagsOfSkill`: explicit `actionTags` wins; else
  `damage !== undefined` → `['attack']`; else none. Slot-less fallback basic =
  `['attack']`. `NULL_ACTION` carries no tags.
- **Reaction recursion guard** — reaction-applied statuses carry
  `reactionEligibility:'suppressed'`; child-stack additions emit
  `AddBuffStacksOperation` (never `ApplyBuffOperation`) — structurally cannot
  re-enter the trigger gate. Pinned by `ReactionPayoff.noRecursion.test.ts`.

## Findings

### Fixed during audit (production code changed post-QA-start → re-verified)

1. **[Medium — fixed] Payload-swap laundering under Cấm Công.** The seal was
   validated at selection on the *root* def's tags. `empowerment` /
   `compositePicks` swap the resolved payload *post-selection* inside
   `declareActorAction`, so a `['buff']`-tagged root whose empowered payload is
   a damage skill would execute an attack while sealed. Fix: after
   `payloadSkill = execution.resolvedSkill`, the resolved payload's tags are
   checked against the forbidden set; a forbidden payload collapses the action
   to `NULL_ACTION` (empty sealed turn — no hidden fallback swing). Repro test
   added: `TurnBattleSystem.camCong.test.ts` — "empowered payload swaps cannot
   launder an attack through a legal root" (root `['buff']` + 100 Thể →
   empowered nuke → `action: null`, `affected: []`). Verified: 20/20 turn tests,
   646/646 reaction+turn scope.
2. **[Low — fixed] Empty `min`/`max`/`add`/`mul` args.** An authored `min([])`
   evaluated to `Infinity` — degenerate payoff (infinite stacks/duration).
   `ReactionRegistry` now rejects empty variadic args at seal time.
3. **[Low — fixed] Negative heal fraction.** `heal_from_damage` fraction could
   evaluate negative → negative heal. Clamped `max(0, min(eval, capRatio))`.

### Confirmed safe (checked, no defect)

- `commitCast`/`onSkillCast`/`applyActionImpact` all guarded on
  `declared.action &&` — null action cannot leak into cast commit.
- `isChargeInit` reads `action.skill?.chargeTurns` — `NULL_ACTION.skill` is null
  → 0 → charge state untouched by a sealed turn.
- `consumesAllThe` pre-burn capture happens on `payloadSkill` before the
  collapse — `execution.theBurned` is set but the execution record is discarded
  in the null-action return; harmless.
- `specialAttackCounter`/`scriptedSpecial`/`targetScope`/`primaryTarget` all
  gated on `action.skillId !== ''` — sealed turn collects no targets, advances
  no scripted-special counter (a null action is not an action).
- `selectForcedAction` validates every forced role candidate (ultimate/
  special/basic/dynamic_basic pick) through the same `isActionAllowed`; a
  forbidden forced pick falls back to restricted normal selection — it cannot
  bypass and cannot produce an unfiltered fallback.
- `dynamicBasic` provider owns the basic slot; a forbidden provider def cannot
  fall through to a stale `participant.basic` — same filtered `basicAction`.
- `actionSource` now `undefined` on the empty action — matches the
  dead-attacker return shape.
- `BuffPoolActionValidator` ignores unknown buff ids (no crash on stale pool
  entries); unsealed path unchanged when no validator/registry is supplied.
- Determinism: no `Math.random` added; `StackExpr` is pure over the frozen
  context; op ids are deterministic (`rx.<eventId>.<reactionId>.<label>`);
  forbidden-set computation is a pure union over live instances.
- `canCrit:false`, `canMiss:false` on reaction damage ops;
  `reactionEligibility:'suppressed'` on every `apply_status` — pinned in
  `ReactionOperations.ts:183,222`.
- `when` gates evaluate on the frozen pre-consume snapshot; `tran_thuy`'s
  `A >= 3` Cấm Công gate verified both sides of the boundary.
- Mid-batch death / stale ops → typed skips; consumed stacks stay consumed;
  partial outcome — M3 contract preserved through the real emitter.
- Registry seal-time validation: expr role ↔ relation legality, `when.role`
  legality, relation-specific step kinds (khắc def authoring `add_child_stacks`
  rejected), `heal_from_damage` requires preceding `reaction_damage`, unknown
  status buff ids, duplicate ids/priorities/pairs, canonical ten-pair coverage.

### Deferred Low / documented boundaries (not blockers)

- **[Low] Queued/reactive bypasses execute under seal.** `pendingQueuedExecution`
  / `pendingReactiveEntry` return before selection — a counter/follow-up
  *committed* while unsealed still resolves under seal. Consistent with the
  spec (Cấm Công restricts action *selection*, not pre-committed payloads) —
  recorded as a boundary ruling, not a defect.
- **[Low] `stacks`-expr negative values.** Non-canonical authored exprs could
  emit `AddBuffStacks` ≤ 0 (drains). Canonical data never produces ≤0; the DSL
  trusts authored data validated at seal. Left unclamped deliberately.
- **[Low] `when.op:'lt'` branch** is implemented but has no canonical consumer;
  exercised only via the symmetric `gte` path in tests. Two-line symmetric
  operator — coverage gap recorded, no defect.
- **[Nit] Fixture approximations** (from M3): fixture op `ctx.events` shares the
  event-scoped sink; batch ops share `context.combatSequence` — documented
  inert-engine approximations, production path unaffected.

## Verdict

**PASS WITH EVIDENCE** — deep audit complete: independent system map rebuilt,
all four matrix commands green on the final state, one Medium laundering seam
found, fixed, and pinned with a failing-then-passing repro test; two Low
hardenings applied; remaining findings are documented Low/Nit boundaries.
