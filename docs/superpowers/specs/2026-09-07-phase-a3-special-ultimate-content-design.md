# Phase A3 — Special/Ultimate Skill Content for Turn-Based Combat

**Status:** Approved design, ready for implementation planning.

**Roadmap context:** `game/docs/roadmap.md` mục 0, Phase A3: "Special/
ultimate skill content cho mọi build trong turn-based." Depends on
nothing (A1/A2 are siblings, not prerequisites), but shares patterns with
both — the ailment-on-hit hook added by A1 and the boss-trigger mechanism
populated by A2 are reused here, not rebuilt.

**Reference:** governed by
`docs/superpowers/specs/2026-09-07-turn-based-combat-reference.md`. This
spec introduces exactly one new mechanic beyond what that document
describes — a `'the'` `SkillResourceType` variant and its turn-start gain
hook — everything else is content authored through existing turn-engine
primitives (`TurnSkillDefinition`, `appliesAilment` from A1,
`TurnBossTrigger` from A2).

## Goals

1. Every build (`phap_tu`'s 5 elements + `kiem_tu`) has a real special
   and ultimate skill usable in turn-based combat, sourced from existing
   legacy content — not new skill design.
2. Ultimates are resource-gated by a real, ported mechanic
   (`currentThe`/`TheResourceSystem`), not left uncapped or gated by an
   ad-hoc turn-engine-only field.
3. The 3 realm-final bosses (same 3 as Phase A2, all water-elemental)
   get a `specialAttacks`-style periodic attack, matching the one
   existing example already in `Enemies.ts`.

## Non-Goals

- **No new skill design.** Every special/ultimate ported here already
  exists as full legacy content in `game/src/data/skill/Skills.ts` or
  `BatKiemThuat.ts` — this is a content port + one new Kiếm Tu ultimate
  that is an explicit stronger variant of an existing skill (per the
  earlier-locked decision), not invention.
- **No new specialization mechanism.** Specialization resolution
  (which of a special skill's 2 branch variants is active) already lives
  entirely in the skill system: `SkillSystem.selectSpecialization()`
  mutates `Skill.selectedSpecializationId` when a node is purchased
  (`GameManager.ts:1077-1081`), and `SkillSystem.getEffectiveSkill()` is
  the one mandatory read-point that resolves the active variant's
  `effectsOverride`/`targeting`. Turn-based combat's only job here is to
  **read** through `getEffectiveSkill()` when building a
  `TurnSkillDefinition` — it does not decide, store, or branch on
  specialization state itself.
- **No new Reaction Path content.** That's roadmap A4, depends on A1,
  separate future brainstorm.
- **No rebalancing of existing legacy numbers.** Damage multipliers,
  ailment chances, resource costs are copied verbatim from the legacy
  skill definitions; only unit conversions (seconds→turns, per the
  project's locked "number preserved" policy) apply.
- **No `battle/legacy/`/`UltimateSystem.ts` deletion.** Both stay in
  place; this spec only adds a parallel turn-based path, following the
  same non-destructive precedent as A1/A2.

## Component 1: Fix the `buildId` plumbing bug

### Current state

`TurnBattleAdapter.ts:17-19`'s `SPECIALS_BY_BUILD` is keyed by
`'kiem_tu'` (correct) but the caller passes whatever `buildId` the
player's `CultivationPathId` resolves to. `CultivationPathKit.ts:12`
defines `CultivationPathId = 'phap_tu' | 'kiem_tu'` — a Pháp Tu player's
`buildId` is the flat string `'phap_tu'`, not element-specific
(`'phap_tu_fire'` etc.), because build selection and element selection
are two different choices in this game (path first, element second, via
the node tree). Component 2 below needs a way to know *which* of the 5
elements a Pháp Tu player is actually running in order to look up their
special/ultimate — `buildId` alone can't carry that.

### Design

Do not invent a `'phap_tu_fire'`-shaped buildId. Instead, Component 2's
converter takes the player's already-equipped `Skill` objects directly
(read off `SkillManager`/loadout, the same way the game already knows
which element skill is equipped) rather than doing a buildId string
lookup at all. This makes the buildId bug moot for Pháp Tu — the lookup
that was broken (`SPECIALS_BY_BUILD['phap_tu']` → undefined) is replaced
outright, not patched. Kiếm Tu keeps the existing `buildId === 'kiem_tu'`
branch (its ultimate is native turn-based content, not sourced from a
`Skill`, see Component 3).

## Component 2: `Skill` → `TurnSkillDefinition` converter (5 Pháp Tu elements)

### Current state

`SPECIALS_BY_BUILD` is a static `Record<string, TurnSkillDefinition>`
populated only for `kiem_tu`. The 5 Pháp Tu elements each have a full
special (Trúc Cơ, e.g. `tam_muoi_chan_hoa`) and ultimate (later realm,
e.g. `hoa_ha_cuu_thien`) already authored as legacy `Skill` objects in
`Skills.ts`, each carrying a `specializations: SkillSpecialization[]`
array (2 branch variants, resolved via
`selectedSpecializationId`/`getEffectiveSkill()` — see Non-Goals).

### Design

1. Add `toTurnSkillDefinition(skill: Skill, effective: EffectiveSkill):
   TurnSkillDefinition` (new file
   `game/src/core/game/SkillToTurnSkillConverter.ts` — keeps the mapping
   logic out of `TurnBattleAdapter.ts`, which stays focused on
   participant construction). It is a pure field mapper:
   - `id`: `skill.id`
   - `cooldownTurns`: derived from the skill's existing cooldown field
     (implementer confirms exact field name/unit on `Skill` — legacy
     cooldowns are real-seconds, convert using the same "number
     preserved" policy already used for buff durations, i.e. treat the
     numeric value as turns directly, matching A1/A2's precedent)
   - `resourceType`/`resourceCost`: read off `skill.resourceType`/
     `skill.cost` (existing `SkillResourceType` fields — for a special
     skill this is typically `'mana'`; for an ultimate, see Component 4)
   - `damage`: built from `effective.effects` — find the `'damage'`-type
     `SkillEffect` and map its `value`/element into `ActionDamageInfo`,
     matching the shape `PHAP_TU_BASICS` already uses in
     `TurnBasicAttacks.ts`
   - `targeting`: `effective.targeting ?? skill.targeting`, mapped to
     `ActionTargeting` (implementer confirms the legacy targeting shape
     maps cleanly onto the turn engine's `ActionTargeting` — both already
     share `shape`/`laneRadius`/`columnRadius` per the turn-based combat
     reference doc's targeting-system note; flag any shape the turn
     engine doesn't yet support, e.g. anything beyond
     `single`/`area`/`line`/`all_lanes`/`cross`)
   - `appliesAilment`: if the skill's effects include a `'debuff'`-type
     `SkillEffect` with an ailment chance/id (the same shape A1's
     `PHAP_TU_BASICS` content already uses), map it through — reusing
     A1's field, not inventing a second one
2. **The caller always resolves through `getEffectiveSkill()` first**:
   wherever a Pháp Tu player's special/ultimate participant field is
   populated (`toTurnBattleParticipant()` or its caller in
   `GameManager.ts`), call
   `skillSystem.getEffectiveSkill(skill)` to get the already-resolved
   `EffectiveSkill` (specialization branch already applied, if any is
   selected), then pass both `skill` and that `effective` result into
   `toTurnSkillDefinition()`. The converter itself never reads
   `selectedSpecializationId` or `specializations` — it only sees
   whatever `getEffectiveSkill()` already resolved. This is the corrected
   division of responsibility: node system mutates the skill, skill
   system resolves the effective content, turn engine reads the result.
3. Replace the Pháp Tu branch of `SPECIALS_BY_BUILD`'s lookup: instead of
   a static map keyed by buildId, `toTurnBattleParticipant()` (or its
   caller) looks up the player's equipped special/ultimate `Skill`
   objects (however the game already identifies "the player's current
   special skill" — implementer reads `SkillManager`/loadout code to find
   the existing accessor, likely something keyed by loadout slot or
   `buildTag`) and converts each through steps 1-2 above. Kiếm Tu's
   `BAT_KIEM_THUAT` stays a static `TurnSkillDefinition` (Component 3) —
   it was never sourced from a `Skill` object with specializations.

## Component 3: Kiếm Tu ultimate

### Current state

`BatKiemThuat.ts:23-29` (`BAT_KIEM_THUAT`) is Kiếm Tu's existing
turn-based special (id `'bat_kiem_thuat'`, `cooldownTurns: 5`,
`chargeTurns: 3`, physical multiplier 3, single target, no
`resourceType`). It already occupies the `special` slot. No ultimate
exists for Kiếm Tu on the turn-based side; legacy `UltimateSystem.ts`
encodes a Kiếm Tu-specific manual-button ultimate
(`truTienKiemTranCost(swordCount) = 10 × swordCount`) that is a dead
shell since the Slice 6 cutover and not directly reusable (different
resource model, manual-trigger UI that doesn't exist in the turn-based
flow).

### Design

Per the earlier-locked decision ("bản mạnh hơn của special hiện có"),
add a new static `TurnSkillDefinition` — `TRU_TIEN_KIEM_TRAN` (or
whatever id the implementer picks matching this project's naming
convention) in `BatKiemThuat.ts`, alongside `BAT_KIEM_THUAT`:
- Same shape as `BAT_KIEM_THUAT` (single target, physical) but stronger:
  higher damage multiplier (implementer picks a starting value —
  suggest 5x physical as a "clearly an ultimate, not a bigger special"
  jump from `BAT_KIEM_THUAT`'s 3x; flag as a playtesting starting point,
  same convention A2 used for boss enrage magnitudes)
- Longer `cooldownTurns` than the special (suggest 8, starting point)
- Gated by `resourceType: 'the'` (Component 4) instead of no resource
  gate at all — unlike `BAT_KIEM_THUAT`'s deliberate no-resource design
  (comment explains it's cooldown-only by design), the ultimate should
  be resource-gated like every other element's ultimate, for parity
- Wired into `TurnBattleAdapter.ts`'s `kiem_tu` branch as `.ultimate`,
  alongside the existing `.special` assignment

## Component 4: Port `TheResourceSystem` for ultimate gating

### Current state

`TheResourceSystem.ts` is the unified resource pool
(`CombatEntity.currentThe`, optional field) that already gates ultimates
in the legacy engine: `gainTheOnChainLink()` (+10 per chain-link hit),
`THE_GAIN_PER_FINISHER = 20`, `MAX_THE = 100`,
`consumeTheForUlt()`, and `theManBuffId` (a per-element buff whose
presence gates *which* element's ultimate is allowed to fire). Thủy Thế
and Mộc Thế are NOT poolable resources (Thủy Thế is a static defensive
stat, Mộc Thế has no runtime field at all) — confirmed by survey, which
is why `currentThe` (not per-element pools) is the correct port target
for gating all 6 ultimates uniformly.

### Design

1. Add `'the'` to `SkillResourceType` (`SkillTypes.ts:33-37`) and to
   `RESOURCE_FIELD` in `TurnSkillAction.ts:41-48`, mapped to
   `'currentThe'`. This is a pure extension of the existing generic
   resource-gating mechanism (`hasResourceFor`/`consumeResourceFor`
   already iterate through `RESOURCE_FIELD` for any resource type) — no
   new gating code path, no turn-engine-specific branching.
2. Port the gain side: add a turn-based gain hook mirroring
   `gainTheOnChainLink()`'s trigger condition (chain-link hit vs.
   finisher hit — implementer reads `ChainStateSystem.ts`/legacy call
   sites to confirm exact trigger semantics before porting) into
   `TurnBattleSystem.applyActionImpact()`'s existing per-target hit loop
   — the same hook point A1 used for `appliesAilment`, not new
   architecture. Values ported verbatim: `+10` per chain-link,
   `+20` per finisher, capped at `MAX_THE = 100`.
3. `theManBuffId`'s per-element gating (which ultimate is *allowed* to
   fire, distinct from *can afford* to fire) — implementer verifies at
   plan-writing time whether this is a persistent (not turn-scoped) buff
   already present on the player entity outside combat (e.g. granted by
   a node purchase, read the same way `selectedSpecializationId` is) or
   whether it needs a turn-based equivalent constructed. If it's a
   persistent buff already readable off `CombatEntity`/`SkillManager`
   state, the turn engine only needs to check its presence before
   allowing `selectAction()` to pick that ultimate slot — another read,
   not new state.
4. `hasResourceFor(entity, ultimateSkill)` (already generic) now covers
   the "can afford" gate automatically once `'the'` is wired into
   `RESOURCE_FIELD` — no ultimate-specific check needed in
   `selectAction()`/`selectForcedAction()` beyond what already exists.

## Component 5: Ailment/ward-consume damage bonus (3 of the 5 ultimates)

### Current state

3 of the 5 Pháp Tu ultimates use a legacy `SkillEffect` mechanic (type
`'damage'` with `consumesAilmentId`/`damagePerStack`, or
`consumesWardForDamage`/`damagePerWardPoint`) — "cash in" an ailment's
current stacks (or the source's `currentWard`) for a true-damage bonus,
then clear that ailment/ward. This is resolved today by
`SkillEffectSystem.apply()`, which calls `BuffSystem.getStacks()` then
`BuffSystem.removeAllById()` — the buff system, not the skill-effect
caller, owns reading and clearing stack state; `SkillEffectSystem` only
orchestrates the "roll this into damage" decision.

### Design

Mirrors that division exactly on the turn-based side, using the same
per-target hit-loop hook point A1/Component 4 already established in
`applyActionImpact()`:
1. Add `getStacks(id: string, sourceId?: string): number` to
   `TurnBuffSystem`, ported verbatim from `BuffSystem.getStacks()`
   (`BuffSystem.ts:397-402`) — sits alongside the `getActiveIds`/
   `remove`/`renewWithExtension` methods A1's plan already adds. This is
   the state-owning read; nothing outside `TurnBuffSystem`/`TurnBuffPool`
   computes stack counts itself.
2. Add `consumesAilmentId?: string` / `damagePerStack?: number` and
   `consumesWardForDamage?: boolean` / `damagePerWardPoint?: number` to
   `TurnSkillDefinition`'s damage info (or wherever
   `ActionDamageInfo`/the skill definition most naturally carries them —
   implementer confirms the cleanest home, matching `appliesAilment`'s
   placement precedent from A1).
3. In `applyActionImpact()`'s per-target loop, after the base damage is
   resolved: if the acting skill has `consumesAilmentId` set, call
   `target.buffs.getStacks(consumesAilmentId)` (a read on the *target's*
   `TurnBuffPool`, via `TurnBuffSystem`), compute
   `stacks × damagePerStack` as true damage (bypassing armor/resistance,
   same as legacy), apply it, then call
   `target.buffs.remove(consumesAilmentId, ...)`/an equivalent
   full-clear (implementer checks whether `removeAllById`-equivalent is
   needed on `TurnBuffPool` vs. the existing single-source `remove`).
   Ward consumption follows the same shape but reads/clears the
   *source's* `currentWard` field on `CombatEntity` directly (not a buff
   pool — `currentWard` is a plain resource field, ported as-is, no new
   buff-system involvement needed for that half).
4. This logic lives in `applyActionImpact()` only as an orchestration
   call into `TurnBuffSystem`'s new `getStacks()`/existing `remove()` —
   it does not re-implement stack bookkeeping. If a future task ports a
   full `TurnSkillEffectSystem` (A1 explicitly decided against this for
   now), this block is the natural piece to move into it; not blocking
   for A3.

## Component 6: Boss `specialAttacks` for the 3 A2 bosses

### Current state

`Enemies.ts` already has one live example
(`ferocious_flood_serpent`'s or a sibling's `specialAttacks` field,
confirmed shape `EnemySpecialAttack { everyNth: number; damageMultiplier:
number; presetId: string }` at `Enemy.ts:22-30`, example at
`Enemies.ts:1764`: `water_surge`, `{everyNth:4, damageMultiplier:2.5,
presetId:'water_surge'}`). All 3 realm-final bosses in scope
(`mortal_ferocious_giant_crocodile`, `ferocious_flood_serpent`,
`foundation_ferocious_flood_dragon_whelp`) are confirmed water-elemental.

### Design

Add one `specialAttacks` entry per boss (or reuse the existing
`water_surge` entry where a boss doesn't already have one), following
the confirmed shape exactly — `everyNth`/`damageMultiplier`/`presetId`
tuned per-boss as a playtesting starting point (implementer picks
values proportional to each boss's realm, same "starting point, not
locked balance" framing used for A2's enrage percentages). Implementer
confirms at plan-writing time whether the turn-based engine already
reads `Enemy.specialAttacks` (via `specialAttackCounter` on
`BattleEnemy`, currently a legacy-only field per `Battle.ts:52`) or
whether this needs a turn-based equivalent counter on
`TurnBattleParticipant` — if the turn engine has no reader for this
field at all today, that reader is in scope for this component (mirrors
A2 Component 1's "populate + wire the reader" shape for `bossTrigger`).

## Testing Strategy

- **Component 1**: no standalone test (bug fix folded into Component 2's
  integration test — the failure mode was "the lookup never worked,"
  which Component 2's real end-to-end skill-cast test proves is fixed).
- **Component 2**: unit test that `toTurnSkillDefinition()` correctly
  maps a specialization-bearing `Skill` through `getEffectiveSkill()`
  (assert the resolved variant's damage/targeting is what's produced,
  for both branches of at least one element's specialization pair);
  integration test that a Pháp Tu player's special/ultimate actually
  fires in a real turn battle.
- **Component 3**: unit test for the new ultimate's damage/cooldown/
  resource gate; integration test proving `currentThe` gates it
  correctly (can't fire until threshold, fires and consumes once
  affordable).
- **Component 4**: unit tests for `hasResourceFor`/`consumeResourceFor`
  with `'the'` (mirrors existing `mana`/`sword_intent` test patterns in
  `TurnSkillAction.test.ts`); unit test for the chain-link/finisher gain
  hook in isolation; one integration test driving a real battle to
  `MAX_THE` and confirming an ultimate becomes usable.
- **Component 5**: unit test for `TurnBuffSystem.getStacks()` (mirrors
  `BuffSystem.getStacks()`'s existing test); integration test for one
  `consumesAilmentId` ultimate (apply ailment, cast ultimate, assert
  bonus damage + ailment cleared) and one `consumesWardForDamage`
  ultimate (set `currentWard`, cast, assert bonus damage +
  `currentWard` cleared).
- **Component 6**: extend `TurnBattleSystem.test.ts`'s existing
  special-attack-counter pattern (if one already exists for the legacy
  side — port its shape) with one test per boss confirming the special
  attack fires on the Nth hit.
- Full suite + type-check + build per standing verification requirements.
  No P14 trigger (pure data/logic, no new render surface) unless the
  plan author finds an existing VFX/preset hookup this newly exercises.

## Open Items For The Implementation Plan (not decided here)

- Exact accessor for "the player's currently equipped Pháp Tu
  special/ultimate `Skill` objects" (Component 2, point 3) —
  implementer reads current `SkillManager`/loadout code.
- Exact `Skill` cooldown field name/unit for the seconds→turns
  conversion (Component 2, point 1).
- Exact damage multiplier/cooldown starting values for the new Kiếm Tu
  ultimate (Component 3) — playtesting starting points, not locked.
- Whether `theManBuffId` gating needs new turn-based state or is a
  simple existing-buff read (Component 4, point 3).
- Whether `TurnBuffPool` needs a new `removeAllById`-equivalent or the
  existing single-source `remove()` suffices for Component 5's ailment
  clear.
- Whether the turn engine already reads `Enemy.specialAttacks` at all,
  and if not, the exact shape of its `TurnBattleParticipant`-side
  counter (Component 6).
- Per-boss `everyNth`/`damageMultiplier` values (Component 6) — balance
  detail.
