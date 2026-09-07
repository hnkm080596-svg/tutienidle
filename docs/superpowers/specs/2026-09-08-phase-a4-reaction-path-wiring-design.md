# Phase A4 — Wire Pháp Tu Reaction Path Into Live Combat

**Status:** Approved design, ready for implementation planning.

**Roadmap context:** `game/docs/roadmap.md` mục 0, Phase A4: "Reaction
Path nội dung thật (pool element skill + ultimate %)." Depends on A1
(done) and, for the resolver piece, on A3's `resolvePlayerSpecialUltimate()`
(spec/plan written, not yet executed — see Global Constraints).

**Reference:** `docs/superpowers/specs/2026-09-07-turn-based-combat-reference.md`.
No new mechanic — everything Reaction Path needs (`REACTION_PATH_POOL`,
`PHAP_TU_REACTION_SPECIAL`, `PHAP_TU_REACTION_ULTIMATE`,
`REACTION_EMPOWERMENT_BUFF`, the `selectRandomDistinctElementPair`
mechanism in `TurnBattleSystem.applyActionImpact()`) is already built
and unit-tested. This spec is pure wiring.

## Background

Survey found the roadmap's "content missing" framing is stale. The real
gap, found by reading `game/src/data/skill/TurnReactionPathSkills.ts`
(63 lines, fully authored) and `GameManager.ts`, is narrower:

1. **`GameManager.ts:2533` and `:3095`** both construct `TurnBattleSystem`
   with `reactionPathPool: undefined` and an inline comment
   `// reactionPathPool — not populated until roadmap A4`. So even a
   player who somehow had `phap_tu_reaction_special` equipped would
   always fall into the engine's "no pool" placeholder branch
   (`TurnBattleSystem.ts:747-748`) instead of the real 2-element-pick
   mechanism.
2. **No player ever gets `phap_tu_reaction_special`/`phap_tu_reaction_ultimate`
   assigned as their special/ultimate at all.** The node
   `reaction_path_unlock_<tag>` (`PhapTuNodes.ts:258-283`, one per
   element, granted on that element's first Reaction-specialization
   node) declares `effect.unlocksSkillIds: ['phap_tu_reaction_special',
   'phap_tu_reaction_ultimate']`. `GameManager.purchaseNode()`
   (`GameManager.ts:1073-1074`) runs `this.learnSkill(skillId)` for each
   — but no legacy `Skill` template with either id exists anywhere in
   `game/src/data/skill/Skills.ts` (confirmed by direct search), so this
   call is a no-op today: nothing is actually "learned," and even if it
   were, the legacy `Skill`→`SkillManager` pathway is the wrong mechanism
   here anyway — Reaction Path's content is already final, hand-authored
   `TurnSkillDefinition`s, not a `Skill` that needs `getEffectiveSkill()`
   resolution (unlike the 5 real elements, which A3 routes through the
   converter).

## Non-Goals

- **No rebalancing.** `REACTION_EMPOWERMENT_BUFF`'s +25%/4-turn numbers,
  and the special/ultimate's mana costs, stay as authored — the file's
  own header comment already flags them as "số liệu tune khi reaction
  turn-cutover" (a future balance pass, not this plan).
- **No new skill/buff content.** Everything needed already exists in
  `TurnReactionPathSkills.ts`.
- **No change to `ELEMENT_REACTIONS`/`TurnReactionManager`.** The
  reaction-triggering mechanism itself (A1) is untouched; this only
  makes sure a Reaction-path player's special skill actually gets to use
  it via 2 real element picks per cast.
- **No resolution of the exact Reaction-vs-Pure-vs-Thuần mutual-exclusivity
  model beyond what's needed to answer "is this player running Reaction
  Path."** `PhapTuNodes.ts`'s per-element `keystoneReaction`/`keystonePure`
  fork and the cross-element `lap_dao_thuan_<element>` root are two
  different layers — this spec only needs a boolean ("has the player
  purchased any element's `reaction_path_unlock_<tag>`"), not a full
  model of how every node layer interacts. Implementer confirms at
  build time that a player can't simultaneously have `lap_dao_thuan_<el>`
  purchased AND a `reaction_path_unlock_<tag>` in a way that makes both
  branches true at once (if that turns out to be possible, Reaction Path
  takes precedence — see Component 2).

## Component 1: Wire the real pool into both `TurnBattleSystem` construction sites

### Design

Replace `undefined` with `REACTION_PATH_POOL` (imported from
`game/src/data/skill/TurnReactionPathSkills.ts`) at both
`GameManager.ts:2533` and `:3095`. This parameter is battle-level, not
per-player — passing the real pool unconditionally is harmless for every
non-Reaction-path participant, since `TurnBattleSystem.applyActionImpact()`
only consults it when `action.skillId === REACTION_PATH_SPECIAL_ID`
(`TurnBattleSystem.ts:744-746`), which no other build's skill id ever
matches. No conditional logic needed here — this is the "populate an
already-built optional parameter with its real value" shape, same as A2
Component 1's `bossTrigger` population.

## Component 2: Resolve Reaction Path as the player's special/ultimate

### Current state

A3's plan (`docs/superpowers/plans/2026-09-07-phase-a3-special-ultimate-content.md`,
Task 3) adds `GameManager.resolvePlayerSpecialUltimate(player: PlayerData):
{ special?: TurnSkillDefinition; ultimate?: TurnSkillDefinition }`,
which currently only branches on `getPhapTuThuanElement()` (the 5-element
Thuần chain). Reaction Path is a sibling choice at the node-tree level
(`reaction_path_unlock_<tag>`, one instance per element's Reaction
sub-branch) that A3's resolver has no knowledge of — a Reaction-path
player would incorrectly fall through to A3's `?? 'fire'` default and
get fire's special/ultimate instead of the reaction skills.

### Design

1. Add `GameManager.getPhapTuReactionElement(): ElementType | undefined`,
   mirroring `getPhapTuThuanElement()`'s exact shape
   (`GameManager.ts:500-514`) but checking `reaction_path_unlock_<element>`
   instead of `lap_dao_thuan_<element>`:
   ```ts
   getPhapTuReactionElement(): ElementType | undefined {
     if (!this.activePlayer) {
       return undefined
     }

     for (const element of Object.keys(CHAIN_SKILL_IDS) as ElementType[]) {
       const level = this.activePlayer.nodeLevels[`reaction_path_unlock_${element}`]

       if (level !== undefined && level > 0) {
         return element
       }
     }

     return undefined
   }
   ```
   (`CHAIN_SKILL_IDS`'s keys are the 5 `ElementType`s — reused purely as
   an existing enumerable element list, same trick `getPhapTuThuanElement()`
   already uses; no chain-specific meaning implied.) The return value's
   specific element doesn't matter for content selection (Reaction
   Path's special/ultimate are the same regardless of which element
   unlocked them) — only "is this defined at all" matters. A boolean
   `hasPhapTuReactionPath(): boolean` would be equally correct; keep the
   `ElementType | undefined` shape only if the implementer finds a
   reason elsewhere in the codebase to know *which* element unlocked it
   (e.g. future UI attribution) — otherwise prefer the simpler boolean,
   implementer's call.
2. In `resolvePlayerSpecialUltimate()` (A3 Task 3 Step 7), add a Reaction
   Path branch **checked before** the Thuần-element fallback:
   ```ts
   private resolvePlayerSpecialUltimate(
     player: PlayerData,
   ): { special?: TurnSkillDefinition; ultimate?: TurnSkillDefinition } {
     if (player.cultivationPath !== 'phap_tu') {
       return {}
     }

     if (this.getPhapTuReactionElement() !== undefined) {
       return { special: PHAP_TU_REACTION_SPECIAL, ultimate: PHAP_TU_REACTION_ULTIMATE }
     }

     const element = this.getPhapTuThuanElement() ?? 'fire'
     const [, specialId, ultimateId] = CHAIN_SKILL_IDS[element]
     // ...rest unchanged from A3 Task 3 Step 7
   }
   ```
   `PHAP_TU_REACTION_SPECIAL`/`PHAP_TU_REACTION_ULTIMATE` are used
   directly, as static `TurnSkillDefinition` values — no `Skill`/
   `getEffectiveSkill()`/converter involvement, matching how Kiếm Tu's
   `BAT_KIEM_THUAT` is also a static definition, not converter output.
   This is a real branch point (not a fallback default), so the two
   paths never blend.
3. **Confirmed bug**: `TURN_BUFF_REGISTRY` (`game/src/data/buff/TurnBuffRegistry.ts:61-63`)
   is built exclusively from `LIVE_BUFFS` (the legacy `game/src/data/buff/buffs.ts`
   array) via `toTurnBuffDefinition()`. `REACTION_EMPOWERMENT_BUFF` is a
   standalone `TurnBuffDefinition` declared in `TurnReactionPathSkills.ts`
   — it is never added to `LIVE_BUFFS`, so `TURN_BUFF_REGISTRY.get('reaction_empowerment')`
   throws `Error: TurnBuffRegistry: unknown buff id "reaction_empowerment"`
   today. Casting `phap_tu_reaction_ultimate` would crash the battle the
   moment its `appliesBuff` resolution runs. Fix: add a legacy
   `BuffDefinition` for `reaction_empowerment` to `buffs.ts` (matching
   every other Turn-side buff's provenance — they all originate from this
   one array, converted automatically), then delete `TurnReactionPathSkills.ts`'s
   standalone `REACTION_EMPOWERMENT_BUFF` export (it becomes dead
   duplicate data once the real source of truth is `buffs.ts`) and update
   any import of it (`TurnReactionPathSkills.test.ts` per the survey)
   to reference the registry instead.
4. The dead `unlocksSkillIds: ['phap_tu_reaction_special',
   'phap_tu_reaction_ultimate']` effect on `reaction_path_unlock_<tag>`
   (`PhapTuNodes.ts:275-278`) is left as-is (Non-Goals) — it's a
   currently-harmless no-op (`learnSkill()` on a nonexistent template id
   presumably no-ops rather than throwing; **implementer confirms this
   at build time** — if `learnSkill()` throws or logs an error on an
   unknown id, that's a pre-existing defect this plan should also fix by
   removing the dead `unlocksSkillIds` entries, since they serve no
   purpose once Component 2's resolver handles content selection
   directly via node-level checks).

## Testing Strategy

- **Component 1**: extend `TurnBattleSystem.test.ts`'s existing Reaction
  Path unit coverage (`TurnBattleSystem.test.ts:1841-1891`, per survey)
  if it currently constructs the system with a hand-built pool — add or
  confirm one test that constructs the battle the same way
  `GameManager.ts` now does (real `REACTION_PATH_POOL`) and asserts a
  cast of `phap_tu_reaction_special` produces 2 distinct real element
  hits, not the placeholder branch.
- **Component 2**: unit test for `getPhapTuReactionElement()` (mirrors
  whatever test coverage `getPhapTuThuanElement()` already has). Real
  end-to-end test: give a test player the `reaction_path_unlock_fire`
  node level 1, start a turn-based battle via `startBattleWithPlayer()`,
  and assert `turnBattle.players[0].special?.skill.id ===
  'phap_tu_reaction_special'` and `.ultimate?.skill.id ===
  'phap_tu_reaction_ultimate'`. A second test: cast the ultimate, assert
  `reaction_empowerment` appears in the player's `TurnBuffPool` (proving
  point 3's registry wiring is real, not just type-correct).
- Full suite + type-check + build. No P14 trigger — no new render
  surface (Reaction Path's 2-element-pick presentation, if any VFX
  distinction is warranted, already exists per A1's per-target hit loop
  presentation, unchanged here).

## Open Items For The Implementation Plan (not decided here)

- (Resolved during spec-writing: `learnSkill()` returns `false` on an
  unresolvable id, `GameManager.ts:1038-1046` — confirmed harmless
  no-op, the dead `unlocksSkillIds` entries stay as-is per Non-Goals.)
- Whether `ElementType | undefined` or a plain `boolean` is the better
  return shape for the new reaction-path-detection accessor — implementer's
  call per Component 2, point 1.
- Confirm this plan is sequenced to execute AFTER A3's plan (Component 2
  edits a function A3's plan introduces) — if A3 hasn't landed yet when
  this plan starts, the implementer adds `resolvePlayerSpecialUltimate()`
  fresh, incorporating both branches together, rather than blocking.
