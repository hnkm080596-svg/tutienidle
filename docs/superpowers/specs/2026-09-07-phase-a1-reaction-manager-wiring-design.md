# Phase A1 — Wire ReactionManager into TurnBattleSystem

**Status:** Approved design, ready for implementation planning.

**Roadmap context:** `game/docs/roadmap.md` mục 0, Phase A1: "Wire
ReactionManager/SkillEffectSystem vào TurnBattleSystem — reaction thật
kích trong turn combat." A1 is a dependency for A4 (Reaction Path
content) and, together with A2, for C1 (deleting `battle/legacy/`).

**Reference:** governed by
`docs/superpowers/specs/2026-09-07-turn-based-combat-reference.md` (no
changes to that document's scope — no new mechanic beyond what's
described here) and follows the same conversion precedent as
`TurnBuffSystem`'s port from `BuffSystem` (verbatim logic, unit
relabeling only, no shared runtime coupling between the legacy and
turn-based engines).

## Goals

1. Make elemental reactions (the existing 10-pair `ELEMENT_REACTIONS`
   table — Bốc Hơi, Độc Viêm, Dung Nham, Trói Chân, Độc Thế, Khai Sơn,
   Thiêu Huyết, Huyết Độc, Ngưng Lộ, Độc Thủy) actually trigger during
   real (turn-based) combat. Today they never fire — the turn-based
   engine has zero reference to `ReactionManager`.
2. Give the 5 base Pháp Tu elemental skills (`PHAP_TU_BASICS`) the
   ability to apply their element's ailment on hit, with the same
   per-skill chance already authored in the legacy engine — without
   this, there is nothing for a wired `ReactionManager` to react to.

## Non-Goals

- **No new reaction pairings, no rebalancing of `ELEMENT_REACTIONS`'s
  existing numbers.** The table (`game/src/core/element/ElementReaction.ts`)
  is reused exactly as-is — it is already engine-agnostic data.
- **No Reaction Path content** (the hidden "cast 2 random elements"
  skill, `reactionEffectPercent` buff scaling). That is roadmap item A4,
  which depends on A1 but is a separate future brainstorm — this plan
  does not touch `TurnReactionPathSkills.ts`'s inert scaffolding beyond
  what's needed to not break it.
- **No `SkillEffectSystem` port.** Survey found the turn-based engine
  does not need a full port of `SkillEffectSystem` — its `'debuff'` case
  is one specific behavior (roll ailment chance → apply → check
  reaction) that this spec's Component 2 replicates directly inline at
  the turn engine's existing per-hit-target loop, not by porting the
  whole multi-effect-type dispatcher. `SkillEffectSystem` handles many
  other effect types (heals, resource, stat-shred, etc.) that are out of
  scope here and, if needed later, are each their own future addition.
- **No `battle/legacy/` deletion or `spawnLavaZone`/AoE zone system.**
  The zone-as-persistent-area mechanic for Dung Nham (Thổ+Hỏa) is
  already decided against (`ĐẢO NGƯỢC: KHÔNG xây TurnHazardZoneSystem —
  zone = DoT qua AOE + buff`, per roadmap mục 9.3) — the turn-based
  reaction manager drops `checkAndTrigger`'s `spawnLavaZone` parameter
  entirely; `appliesAilmentId: 'dung_nham'` alone already produces the
  DoT, matching the decided design.
- **No new buff content.** Survey found all 11 buffs this spec needs
  (`bong`, `te_cong`, `trung_doc`, `chay_mau`, `thach_hoa`, `dung_nham`,
  `troi_chan`, `doc_the`, `khai_son`, `ngung_lo`, `huyet_doc`) already
  exist as fully-authored legacy `BuffDefinition` entries in
  `game/src/data/buff/buffs.ts`, and are therefore already present in
  `TURN_BUFF_REGISTRY` via the existing `toTurnBuffDefinition()`
  converter (the same mechanism confirmed in the Phase A2 spec). This is
  a real narrowing from the roadmap's original framing — A1 needed no
  content-authoring component once this was checked.

## Component 1: `TurnReactionManager`

### Current state

`game/src/core/element/ReactionManager.ts` — one public method,
`checkAndTrigger(targetBuffs: BuffSystem, newBuffId: string, source: CombatEntity, target: CombatEntity, combatSystem: CombatSystem, buffRegistry?: BuffRegistry, sourceBuffs?: BuffSystem, spawnLavaZone?: (...) => void, reactionKeepChance?: number)`.
Stateless (constructor takes only `eventBus`), purely called at the
moment an ailment is applied — confirmed no `deltaSeconds`/tick coupling,
directly reusable logic per the survey. It scans the target's currently
active buff ids for one that pairs with the newly-applied ailment in
`ELEMENT_REACTIONS`, computes damage, applies one of
(`appliesAilmentId` | `appliesBuffId` | plain damage | `maxHpReductionPercent`),
emits an `'reaction'` event, and fires **at most once** per call.

### Design

Port to `game/src/core/battle/turn/TurnReactionManager.ts`, following the
`TurnBuffPool`/`TurnBuffSystem` precedent exactly (verbatim logic, no
import from the legacy file):

- `targetBuffs: BuffSystem` → `targetBuffs: TurnBuffPool`
- `sourceBuffs?: BuffSystem` → `sourceBuffs?: TurnBuffPool`
- `buffRegistry?: BuffRegistry` → `buffRegistry?: TurnBuffRegistry`
- `spawnLavaZone?: (...) => void` parameter **dropped entirely** (Non-Goals)
- `combatSystem: CombatSystem` — unchanged, shared type between both
  engines already (`combatSystem.applyModifiedDirectDamage(...)` is not
  a turn-specific vs. legacy-specific API — confirm at implementation
  time that this method is reachable/correct for a turn-based actor
  before assuming it needs no change)
- `source`/`target: CombatEntity` — unchanged, shared type
- Buff application calls inside the ported method
  (`targetBuffs.apply(...)`, `sourceBuffs.apply(...)`) become
  `new TurnBuffSystem(targetBuffs).apply(...)` /
  `new TurnBuffSystem(sourceBuffs).apply(...)`, matching the exact call
  shape already used throughout `TurnBattleSystem.ts`
  (`new TurnBuffSystem(actor.buffs).apply(definition, actor.entity, actor.entity, this.registry)`).
- `ELEMENT_REACTIONS`/`ElementReactionDefinition` from
  `game/src/core/element/ElementReaction.ts` are imported and reused
  UNCHANGED — no new file, no format conversion needed (already
  confirmed engine-agnostic: ids reference buffs by string, resolved
  through whichever registry is passed at call time).
- `maxHpReductionPercent` handling ("Thiêu Huyết") reads/writes
  `CombatEntity.totalMaxHpReductionPercent` — already a shared
  `CombatEntity` field (per prior project history, the KimPath
  redesign), no turn-specific change expected, verify at implementation
  time.
- `keepsAilmentId`'s `waterReactionExtensionSeconds`-gated "don't consume
  this side" behavior reads a `source.skillStats` field — verify this
  field is populated identically for turn-based actors before assuming
  the ported logic needs no adjustment; if the field doesn't exist on
  the turn side yet, this specific sub-behavior (Thủy's Dẫn Lưu major)
  degrades to "always consume both sides" (the pre-existing default
  behavior when the condition isn't met) rather than blocking the rest
  of the port — not a blocking gap, flag it as a known reduced-fidelity
  spot in the plan's task for this component.

## Component 2: Ailment application on skill hit (`appliesAilment`)

### Current state

`TurnSkillDefinition` (`game/src/core/battle/turn/TurnSkillAction.ts:22-34`)
has `appliesBuff?: { definitionId: string; target: 'self' | 'target' }`
— an unconditional, always-applies buff, consumed once per action in
`TurnBattleSystem.ts`'s `applyActionImpact()` (~line 868-888), AFTER the
per-target damage loop, not per-target-in-a-loop. This field is used
today for boss triggers indirectly (no — boss triggers use
`TurnBossTrigger`, a separate mechanism per the Phase A2 spec;
`appliesBuff` is a plain skill-effect field) and must not be repurposed
— it has an existing, different meaning (deterministic single
application) that a chance-gated ailment field would violate ("one
field, one meaning").

The correct hook point is `applyActionImpact()`'s existing per-target
damage loop (~line 835-857): after `this.combat.resolveActionHit(actor.entity, target.entity, declared.scaledDamage)`,
the code already does `this.registry`-gated per-target follow-up work
(`rollOnHitEffects`, `rollReactiveTrigger`) for every hit target in an
AOE-correct way. This is where ailment application belongs — it
naturally handles multi-target hits the same way existing on-hit
mechanisms do, unlike the later single-shot `appliesBuff` block.

### Design

1. Add a new field to `TurnSkillDefinition`:
   ```ts
   appliesAilment?: { buffDefinitionId: string; chance: number }
   ```
   Deliberately separate from `appliesBuff` — different semantics
   (probabilistic vs. deterministic), matching this project's "one
   state, one flag, one meaning" principle (see the combat reference
   doc's Design Principle 2).
2. In `applyActionImpact()`'s per-target loop, after the existing
   `rollOnHitEffects`/`rollReactiveTrigger` block, add: if
   `action.skill?.appliesAilment` is set and `this.registry` exists,
   roll `Math.random() < appliesAilment.chance`; on success, resolve the
   buff via `this.registry.get(appliesAilment.buffDefinitionId)`, apply
   it to the target via `new TurnBuffSystem(target.buffs).apply(definition, actor.entity, target.entity, this.registry)`,
   then call `TurnReactionManager.checkAndTrigger(target.buffs, appliesAilment.buffDefinitionId, actor.entity, target.entity, this.combat, this.registry, actor.buffs)`
   — passing the ailment id that was JUST applied as `newBuffId`, matching
   the legacy `SkillEffectSystem`'s call shape (roll chance → apply →
   check reaction against the buff that was just added).
3. `TurnBattleSystem` needs to own a `TurnReactionManager` instance
   (constructed once, alongside how it already owns `this.registry` —
   read the constructor to find the right place; likely takes the same
   `eventBus` the class already threads through for other event
   emission, confirm at implementation time rather than assuming a new
   constructor parameter is required if `eventBus` is already
   accessible).

## Component 3: Content — wire the 5 base elemental skills

Add `appliesAilment` to each of `PHAP_TU_BASICS`'s 5 entries
(`game/src/data/skill/TurnBasicAttacks.ts:23-29`), with chances copied
exactly from the legacy `Skills.ts` definitions of the same 5 starter
skills (confirmed by direct read, not estimated):

| Element | Skill id | Ailment | Chance (from `Skills.ts`) |
|---|---|---|---|
| fire | `hoa_cau_thuat` | `bong` | 0.5 |
| water | `thuy_tien_thuat` | `te_cong` | 0.5 |
| wood | `doc_chuong` | `trung_doc` | 1.0 |
| metal | `diem_kim_thuat` | `chay_mau` | 0.4 |
| earth | `tho_cau_thuat` | `thach_hoa` | 1.0 |

No new buff authoring (Non-Goals) — every `buffDefinitionId` above
already resolves through `TURN_BUFF_REGISTRY` today.

## Testing Strategy

- **Component 1**: port `ReactionManager.test.ts`'s existing test
  coverage (if it exists — verify at plan-writing time) the same way
  `TurnBuffSystem`'s test suite mirrors `BuffSystem.test.ts`'s cases,
  turn-typed. At minimum, one test per distinct reaction OUTPUT SHAPE
  (plain damage, `appliesAilmentId`, `appliesBuffId`,
  `maxHpReductionPercent`, `keepsAilmentId`) — not all 10 pairs
  individually, since they share 5 output shapes; pick one
  representative pair per shape unless the plan author judges full
  10-pair coverage is cheap enough to include, matching this project's
  "thorough over expedient" default given `#8` earlier decided
  "prioritize the most manageable approach."
- **Component 2**: unit test that a skill with `appliesAilment` set
  applies the buff on a successful roll and doesn't on a failed one
  (mock `Math.random()` or use `chance: 1`/`chance: 0` to make it
  deterministic, matching how existing `TurnBuffSystem` proc tests
  handle randomness — check the established pattern before inventing a
  new one).
- **Integration**: one end-to-end test proving two real production
  ailments (e.g. `bong` + `te_cong`, "Bốc Hơi") combine into the correct
  reaction when both are present on the same target via real skill
  hits — mirroring the Phase A2 plan's Task 3 Step 7 pattern (real
  `defineEnemy`/production data driven through the real engine, not
  hand-built fixtures only).
- Full suite + type-check + build. No P14 trigger (pure logic/data, no
  rendering change) unless the plan author finds a UI surface (e.g. a
  reaction VFX/toast) already wired to the `'reaction'` event that this
  change would newly make fire in production — check before assuming
  none exists.

## Open Items For The Implementation Plan (not decided here)

- Exact current `TurnBattleSystem` constructor signature and where
  `this.registry`/`eventBus` are stored, to determine the cleanest way
  to construct and hold a `TurnReactionManager` instance — implementer
  reads current code, not guessed here.
- Whether `ReactionManager.test.ts` exists and its exact test names/
  fixtures to port from, if it does.
- The `keepsAilmentId`/`waterReactionExtensionSeconds` reduced-fidelity
  spot noted in Component 1 — confirm at implementation time whether
  the field already exists on the turn side (making this a non-issue)
  or genuinely needs the degraded-fallback behavior documented in a
  code comment.
