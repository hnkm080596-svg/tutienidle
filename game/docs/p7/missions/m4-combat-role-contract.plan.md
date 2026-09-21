# P7 — M4 Plan: Combat-Role Contract Unification

Status: PLAN_PASS (ChatGPT review; v1: 5, v2: 3, v3: 3, v4: 1 findings fixed).
Spec: `m4-combat-role-contract.spec.md` (SPEC_PASS, v5).
Base: M3 `e9a0bd32` + notes `38b56a03` on `feat/p7-progression-consolidation`, worktree `.agent-worktrees/p7-progression-consolidation`.

## Execution notes

- TDD order: write/adjust failing tests first per task, then implement, then re-run the touched scope.
- Large mechanical sweep (~46 production files touch the retired identifiers, most as data-template lines or unrelated same-name domains). Behavior deltas are ONLY spec §4.5b (spell-pre-element + body-pre-root resolve starter basic instead of `GENERIC_PHYSICAL_BASIC`) — everything else is byte-identical role resolution.
- Ordering is load-bearing: new contract lands (T1–T5), then old surface is deleted (T6–T9). While both coexist the new code is already authoritative. Callers of a retired member are always re-pointed/deleted in an EARLIER task than the member's deletion — T6 re-points `syncRealmPassive`/`equipWithoutSlot` usage and T7 clears every `setSkillLoadoutSlot`/`unequipSkill`/`getEquippedInSlot`/`equipToSlot`/`unequip` caller before T8 deletes the ops and system methods, so no task boundary leaves the tree uncompilable. Test files are NOT exempt: `tsconfig.app.json` covers `src/**/*.test.ts`, so T8 additionally migrates every test caller/fixture of the deleted identifiers in the same task; T10 remains the residual behavioral cleanup + full verify.
- Non-skill domains share identifier names (`equipment.equipped`, bag `getEquippedInSlot`, node `unlocked` emits, companion/orb `unlocked`, `unlockedElements`) — all untouched; sweep only skill-domain members listed per task.
- i18n: no locale key changes; role labels reuse existing vocabulary (§T4 pin).
- All edits inside the worktree. Local commit only after all gates pass.

## Task 0 — G0/G1 evidence

- Task card: mission-graph M4 + spec v5 §3 scope (7 bullets).
- Measured facts (re-verified on `38b56a03`):
  - `CombatBuild.resolveCombatBuild` (`CombatBuild.ts:222-247`): `basic = runtime?.resolveBasic`, `specialUltimate = runtime?.resolveSpecialUltimate`, kit = `{basic, special: su?.special, ultimate: su?.ultimate, reactivePayloads: su?.reactivePayloads, statDomains, emblem: runtime?.emblemSlots?.(), buildDynamicBasic: bound thunk}`; `entity.maxThe = su?.maxThe ?? (override===undefined ? runtime?.resolveMaxThe : keep)`. `kit.emblem` readers (complete census): `CombatBuild.ts:334` collectClones precedence AND `GameManagerTurnBattleOps.ts:1972-1978` which overwrites `playerParticipant.special`/`ultimate` with emblem defs — BOTH deleted when the seam resolves emblem into `kit.special`/`ultimate`.
  - `CultivationPathRuntime` interface (`CultivationPathRuntime.ts:21-69`): `resolveBasic`, `resolveSpecialUltimate` (returns `{special?, ultimate?, reactivePayloads?, maxThe?} | undefined`), `resolveMaxThe`, `resolveStatDomains`, `buildDynamicBasic?`, `buildSurviveSources?`, `emblemSlots?`, `grantsElementalReactionAura?`. Deps Pick: `'get' | 'has' | 'getEquippedInSlot'` (:76).
  - Mortal runtime (`CultivationPathRegistry.ts:331-349`): sole slot read `getEquippedInSlot(0)` ∩ `CAST_LEVELING_THRESHOLDS` → else `'tram'` → `resolveAuthoredBasic` → `BASIC_ATTACKS_BY_BUILD` → `GENERIC_PHYSICAL_BASIC`.
  - Spell runtime (:373-431): element-kit basic via `SPELL_KIT_IDS[element][0]` → build-map → generic. NO starter fallback today — pre-element basic is `BASIC_ATTACKS_BY_BUILD['spell']`/generic.
  - Body runtime (:474-502): `resolveBodyKit()?.basic ?? GENERIC_PHYSICAL_BASIC`.
  - Hidden body (:504-522): fixed kit + `reactivePayloads` + `maxThe` — the seam must carry these.
  - Sword (:351-371): static filler basic + `buildDynamicBasic`; hidden adds `emblemSlots` (`TU_KIEM_Y_EMBLEM`/`KIEM_DAO_CASCADE_EMBLEM`).
  - Ritual (`RealmAdvanceOps.ts:140-272`): guards → way resolve → technique preflights → `skillIds`/`passiveSkillIds` template checks → `applyPathChoice` → `unequipSkillIds` loop (:211-213) → `learnSkill`+`equipToSlot(index)` (:215-218) → passive learn+`equipWithoutSlot` (:223-228) → realm promotion block (:233-263) → `grantCanonicalTechnique` (:269).
  - `Skill.ts:123-158`: `loadoutSlot?: number`, `loadoutSlots?: number[]`, `unlocked: boolean`, `equipped: boolean`.
  - `SkillManager.ts:36-73`: `getActiveSkills` (type active + equipped), `getPassiveSkills` (type passive + equipped — sole consumer `SkillSystem.getScaledPassiveModifiers:230-248`), `getEquippedInSlot`, `getLoadoutEntries`, `getLoadoutSkills`.
  - `SkillSystem.ts`: `learn` mints `{unlocked:true, equipped:false}` (:300-315); `progressionOf` projects `unlocked/equipped/loadoutSlots` (:187-202); `equipToSlot` (:325-348), `unequipFromSlot` (:350-358), `equipWithoutSlot` (:361-377), `unequip` (:379-392); `selectSpecialization`/`getSkillUpgradeInsightCost`/`upgradeSkill` already membership-only (`manager.get` — no `unlocked` read).
  - `SkillProgressionState` (`skilldef/SkillProgressionState.ts`): `unlocked, equipped, loadoutSlots` fields.
  - `TurnSkillPlanRuntime.progressionStub` (:378-387) mints `{unlocked:true, equipped:true, loadoutSlots:[]}`.
  - `MORTAL_PRECURSOR_SKILL_IDS` (`KiemTuState.ts:57`): consumers `KiemTuPath:182,235` (unequipSkillIds — deleted anyway), `GameManagerProgressionOps:400` (K3 gate), tests (`GameManager.kiemTuState.test.ts:7,103`, `invariants.test.ts:10,689`).
  - `unequipSkillIds` values: `KiemTuPath:182,235` = MORTAL_PRECURSOR_SKILL_IDS; `TheTuPath:214,294` = `['tram','huy_quyen']`; spell ways declare none. Field decl `CultivationPathKit.ts:258`.
  - `setSkillLoadoutSlot` (`ProgressionOps:383-410`): null→unequipFromSlot; realm slot-count check (`getSkillLoadoutSlotCount`); K3 precursor gate; `has+unlocked` learned check; `equipToSlot`. `unequipSkill` (:412-414) delegates.
  - `SkillLoadoutSlots.ts`: `REALM_SLOT_TABLE` mortal:1→tribulation:5, `getSkillLoadoutSlotCount`, `MAX_SKILL_LOADOUT_SLOTS=5` — consumers `setSkillLoadoutSlot` + `SkillLoadoutStrip` only.
  - `SkillLoadoutStrip.vue`: 5-slot row from `getEquippedInSlot`, locked tiers, spec chips under open slot, `RadialSkillSelector` child.
  - `RadialSkillSelector.vue` consumers: only `SkillLoadoutStrip` (import+usage) + `OverlayLayers.ts:26` comment mention.
  - `SkillPathPanel.vue:146`: `getAll().filter(s => s.unlocked && s.type === 'active')` — the "learned actives" library.
  - `App.vue:534-559` (onNewCharacter: learn tram, setSlot(0,'tram'), restore-branch setSlot again, precursor learns; onRestoreOk: learn tram + setSlot(0,'tram') + learn linh_bao/huy_quyen), `EarlyGameBootstrap.ts:51-57` same shape.
  - `useLoadoutActions.ts:32-37`: `unequipSkill` + `setSkillLoadoutSlot` wrappers.
  - Save: `skills: Skill[]` (`saveTypes.ts:160`); `validateIdEntries(skills,'skills')` at `saveShapeValidation.ts:1206` (id-only, extra-key tolerant); restore `structuredClone`s entries — retired keys would survive; `preflightSaveRegistryReferences` (`GameManagerSaveRestore.ts:107`) = hard-fail seam; `CURRENT_SAVE_VERSION=70` (`saveVersion.ts:87`), v<current → 'incompatible' (`SaveSystem.ts:470-475`).
  - `createDefaultPlayer` (`Player.ts:308`): Pinia toRefs convention — every optional field declared explicitly (comment :328-337).
  - `getActiveWayDefinition` (`CultivationPathKit.ts:426`): strict pair resolve, no fallback; imported by registry consumers — importing it INTO `CultivationPathRegistry.ts` is acyclic (Kit imports way modules + CastLeveling, never the registry).
  - `resolvePathRuntime` binding (`GameManager.ts:791-800`): the turn-battle ops already receive `(player) => resolveCultivationPathRuntime(player, {skillManager, skillSystem, skillTemplates, nodeRegistry, getNodeLevel, getSpellPathElement, routeProfileProvider})` — the ONE runtime-resolution binding. `getResolvedSkillRoles` consumes THE SAME binding injected into `progressionOps` deps (no second deps-literal: hoist the object into a ctor-level `pathRuntimeDeps`/binding shared by both ops).
  - `describeDynamicBasic` labels: `kiemBarBridge.ts:129` already labels the sword basic 'Kiếm Phổ'; hidden_sword machinery = `buildNguKiemDaoProvider` (Ngự Kiếm Đạo cascade; `TurnSkillDisplayMeta.ts:313` 'Kiếm Đạo Liên Toát' is the cascade SKILL name, not the role label).
- Cycle constraint: `CultivationPathRoles.ts` is a leaf — imports types + `CultivationPathRuntime` only; `CombatBuild` and `GameManagerProgressionOps` import it (one direction, no cycle). `MortalPrecursors.ts` imports nothing.

## Task 1 — `core/skill/MortalPrecursors.ts` + contract test (TDD)

New leaf `src/core/skill/MortalPrecursors.ts`:

```ts
export const MORTAL_PRECURSOR_SKILL_IDS = ['tram', 'linh_bao', 'huy_quyen'] as const
export const MORTAL_DEFAULT_BASIC_ID = 'tram'
export function isMortalPrecursorSkillId(id: string): boolean {
  return (MORTAL_PRECURSOR_SKILL_IDS as readonly string[]).includes(id)
}
```

`MortalPrecursors.test.ts` (red):
- `Object.keys(CAST_LEVELING_THRESHOLDS)` equals the precursor set (drift guard).
- `isMortalPrecursorSkillId` member/non-member.
- `MORTAL_DEFAULT_BASIC_ID` is a member.

Re-point: `KiemTuState.ts` deletes its export; `KiemTuPath` imports switch to the leaf (until T6 deletes `unequipSkillIds`); `GameManagerProgressionOps` import re-points (K3 gate is replaced by `setMortalBasicSkill` guard in T2 but keep the import working until then); test imports re-point.

## Task 2 — `mortalBasicSkillId` + `setMortalBasicSkill` + mortal runtime re-point (TDD)

- `PlayerData` (`Player.ts`): `mortalBasicSkillId?: string` + `createDefaultPlayer` declares `mortalBasicSkillId: undefined` (Pinia key convention — documented comment).
- `GameManagerProgressionOps.setMortalBasicSkill(player, skillId): boolean` — guards in order: `player.cultivationPath === undefined`; `isMortalPrecursorSkillId(skillId)`; `skillManager.has(skillId)`; writes `player.mortalBasicSkillId = skillId`. (The ONLY role write; replaces the K3 gate's job.)
- Mortal `resolveBasic` re-points:

```ts
const pick = player.mortalBasicSkillId
const authoredBasicId =
  pick !== undefined && isMortalPrecursorSkillId(pick) && deps.skillManager.has(pick)
    ? pick
    : MORTAL_DEFAULT_BASIC_ID
```

then the existing `resolveAuthoredBasic → BASIC_ATTACKS_BY_BUILD → GENERIC_PHYSICAL_BASIC` chain unchanged. `getEquippedInSlot` stays alive until T7 (deps Pick narrows there) — mortal runtime just stops reading it.

Tests (red): op guards (post-path false / non-precursor false / unlearned false / success writes + returns true); runtime resolves linh_bao/huy_quyen when picked+learned; absent/illegal pick → tram path; unlearned pick → tram path.

## Task 3 — `way.starterBasicSkillId` + starter fallbacks + ritual starter guarantee (TDD)

- `PathWayDefinition.starterBasicSkillId?: string` (`CultivationPathKit.ts:258` area). `SPELL_PATHWAY.starterBasicSkillId = 'linh_bao'` (`PhapTuPath`), `BODY_PATHWAY.starterBasicSkillId = 'huy_quyen'` (`TheTuPath`); other four ways declare none.
- Spell `resolveBasic` — insert starter fallback between element kit and build-map:

```ts
resolveAuthoredBasic(deps, player, element ? SPELL_KIT_IDS[element]?.[0] : undefined, true) ??
resolveAuthoredBasic(deps, player, getActiveWayDefinition(player)?.starterBasicSkillId, true) ??
(player.cultivationPath ? BASIC_ATTACKS_BY_BUILD[player.cultivationPath] : undefined) ??
GENERIC_PHYSICAL_BASIC
```

(`resolveAuthoredBasic` already does the learned `has(id)` check + template→TurnSkill pipeline; passing undefined starter skips to next fallback.)
- Body `resolveBasic`: `resolveBodyKit()?.basic ?? resolveAuthoredBasic(deps, player, getActiveWayDefinition(player)?.starterBasicSkillId, true) ?? GENERIC_PHYSICAL_BASIC`.
- Ritual (`chooseCultivationPath`): pre-commit check `way.starterBasicSkillId !== undefined → skillTemplates.has(starter)`; inside commit block (alongside kit grant): `if (way.starterBasicSkillId) this.deps.progressionOps.learnSkill(way.starterBasicSkillId)` — idempotent, repairs missing starter.
- `CultivationPathRegistry` imports `getActiveWayDefinition` (acyclic — Task 0).

Tests (red): spell pre-element resolves linh_bao def; post-element resolves element kit basic (starter is fallback, not override); body pre-root resolves huy_quyen; post-root resolves kit basic; authored-read pin — mutating the authored way value changes resolution (no literal); ritual with missing starter entry → learned post-commit; ritual pre-commit failure leaves player untouched (joins existing zero-mutation assertions).

## Task 4 — `resolveCombatSkillRoles` seam + CombatBuild consumption + `describeDynamicBasic` (TDD)

New leaf `src/core/player/CultivationPathRoles.ts` — verbatim spec §4.7 shape:

```ts
export interface CombatRoleComposition {
  basic: TurnSkillDefinition
  basicIsDynamic: boolean
  special?: TurnSkillDefinition
  ultimate?: TurnSkillDefinition
  reactivePayloads?: Record<string, TurnSkillDefinition>
  maxThe?: number
}
export function resolveCombatSkillRoles(player, runtime): CombatRoleComposition
```

- `CultivationPathRuntime` gains `describeDynamicBasic?(): { name: string }`; sword runtimes return `{ name: 'Kiếm Phổ' }` (sword_pathway — matches `kiemBarBridge.ts:129`) / `{ name: 'Ngự Kiếm Đạo' }` (hidden_sword_pathway).
- `CombatBuild.resolveCombatBuild` consumes the seam:

```ts
const roles = runtime ? resolveCombatSkillRoles(source, runtime) : undefined
const kit: ResolvedCombatKit = {
  basic: roles?.basic ?? GENERIC_PHYSICAL_BASIC,
  special: roles?.special,
  ultimate: roles?.ultimate,
  reactivePayloads: roles?.reactivePayloads,
  statDomains,
  buildDynamicBasic: runtime?.buildDynamicBasic ? (rng) => runtime.buildDynamicBasic!(source, nodes, rng) : undefined,
}
```

`kit.emblem` deleted from `ResolvedCombatKit`; `collectClones` reads `[kit.basic, kit.special, kit.ultimate]` (already emblem-resolved); `entity.maxThe` reads `roles?.maxThe` in place of `specialUltimate?.maxThe`. **Second `kit.emblem` reader deleted:** `GameManagerTurnBattleOps.ts:1970-1978` — the emblem overwrite block that re-stamps `playerParticipant.special`/`ultimate` (the participant build at :1950-1955 already receives the seam-resolved `kit.special`/`kit.ultimate`). Gate: zero production `kit.emblem` / `ResolvedCombatKit.emblem` references after this task (`emblemSlots` on the runtime interface stays — the seam consumes it).

Tests (red): seam on mortal (`basicIsDynamic:false`, no su), sword_pathway (`basicIsDynamic:true`, su undefined→no special), hidden_sword (emblem wins over su), hidden_body (`reactivePayloads`+`maxThe` carried); CombatBuild parity — hidden_sword participant clone-buffs resolve emblem defs; `entity.maxThe` = kit-declared cap on hidden_body; participant special/ultimate = emblem defs (post-TurnBattleOps deletion, via build or ops test).

## Task 5 — `getResolvedSkillRoles` accessor + UI rework (TDD-ish; UI verified at P13/P14)

- `GameManagerProgressionOps.getResolvedSkillRoles(player)`:

```ts
type ResolvedRoleEntry =
  | { kind: 'def'; def: TurnSkillDefinition; skill?: Skill }
  | { kind: 'dynamic'; label: string }
{ basic: ResolvedRoleEntry; special?: {def, skill?}; ultimate?: {def, skill?} }
```

**Runtime wiring (pinned, override-aware):** hoist the `resolveCultivationPathRuntime` deps literal out of `GameManager.ts:791-800` into a ctor-level `pathRuntimeDeps` object, and hoist the dev/test OVERRIDE out of `turnBattleOps` up to GameManager: `GameManager` owns `private pathRuntimeResolverOverride` and the single injected binding is `(player) => (this.pathRuntimeResolverOverride ?? ((p) => resolveCultivationPathRuntime(p, pathRuntimeDeps)))(player)`. `setPathRuntimeResolver` (`GameManager.ts:985`) writes the GameManager field (public API name preserved); `turnBattleOps.pathRuntimeOverride`/`setPathRuntimeResolver` are deleted (verify no direct `turnBattleOps.setPathRuntimeResolver` callers — migrate any to the GameManager seam) — combat and the UI accessor read the SAME override-aware binding, so a test-installed fake_path runtime resolves identically for both. Inject the binding into `turnBattleOps` deps (unchanged behavior) AND `progressionOps` deps as `resolvePathRuntime(player: PlayerData): CultivationPathRuntime`. The accessor calls `deps.resolvePathRuntime(player)` → `resolveCombatSkillRoles(player, runtime)`, then decorates: `basicIsDynamic` → `{kind:'dynamic', label: runtime.describeDynamicBasic?.().name ?? 'Căn Bản'}`; else `{kind:'def', def, skill: skillManager.get(def.id)}`. Same for special/ultimate. No precedence logic here. Test: `setPathRuntimeResolver` parity — an installed override changes what `getResolvedSkillRoles` returns AND what the participant build stamps (same seam).
- `SkillLoadoutStrip.vue` rewrite: three role cards (`Căn Bản`/`Đặc Biệt`/`Tuyệt Kỹ` headers), `SlotView` + name + `Lv. x/max`; `kind:'dynamic'` card renders the label; empty roles render muted `Trống`. Mortal-only: basic card opens a 3-item chooser (learned precursors via `skillManager.getAll()` ∩ `MORTAL_PRECURSOR_SKILL_IDS`) → `setMortalBasicSkill`; current pick = `player.mortalBasicSkillId ?? 'tram'` highlighted. Spec chips under the opened role card only when `entry.skill?.specializations?.length`. Drop the locked-tier row + `getSkillLoadoutSlotCount`/`MAX_SKILL_LOADOUT_SLOTS` imports + `RadialSkillSelector` child.
- `RadialSkillSelector.vue` deleted (sole consumer was the strip; `OverlayLayers.ts:26` comment mention updated).
- `useLoadoutActions`: `setSkillLoadoutSlot`+`unequipSkill` → `setMortalBasicSkill: (skillId) => withBump(progressionOps.setMortalBasicSkill(player.$state, skillId))`.
- `SkillPathPanel.vue:146`: `filter(s => s.type === 'active')`.

## Task 6 — Ritual re-shape + `unequipSkillIds` retirement (TDD)

- `chooseCultivationPath` kit block → learn-only + starter learn (T3 already added) + `player.mortalBasicSkillId = undefined` inside the `realmId==='mortal'` promotion region (commit-side, after `applyPathChoice` — per §4.6 atomicity pin: pre-commit failures leave it byte-identical).
- **Passive authority flips FIRST (ordering pin):** `SkillManager.getPassiveSkills` re-points to `skill.type === 'passive'` (membership only) HERE — before any equip call is removed. Sole consumer `getScaledPassiveModifiers`; today's grants always learn+equip so the filter change alone is behavior-neutral, but it is load-bearing for the next line: passives learned after this task must already contribute modifiers with `equipped === false`.
- `syncRealmPassive` (`GameManagerRealmAdvanceOps.ts:379-385`) → learn-only: drop the `equipWithoutSlot(skillId)` call and its "Passives do NOT belong to the Skill Loadout" comment — learned ≡ active per §4.7, so the M2 grant becomes `learn(template)` alone. This is the LAST production `equipWithoutSlot` caller; T8 can then delete the method. Migrate the realm-passive test here to assert membership + `getScaledPassiveModifiers` contribution — NOT `equipped === true`.
- `PathWayDefinition.unequipSkillIds` deleted; values dropped at `KiemTuPath:182,235`, `TheTuPath:214,294`; `MORTAL_PRECURSOR_SKILL_IDS` import in `KiemTuPath` removed (T1's re-point was transitional — T6 removes the last use; check `KiemTuState`'s export deletion lands here if still referenced).
- Update the stale M9 comment (:204-210) — kit grant is learn-only; roles resolve via runtime.

Tests (red): ritual zero-mutation assertions extended — every pre-commit failure leaves `mortalBasicSkillId` byte-identical: unknown way, missing technique template, occupied holder, grade ceiling, missing skill/passive/starter template, **AND a valid way rejected by `applyPathChoice` offer gating** (e.g., `hidden_spell_pathway` picked without its `linh_bao` Lv3 cast-count offer condition — the offerGate failure path inside `applyPathChoice` is also a pre-commit rejection); post-commit cleared; kit skills are learned-only at T6 — assert `skillManager.has(id)` AND no slot occupancy (`getEquippedInSlot` does not return them / `equipped === false` on the still-live field). Literal field-absence assertions (`'equipped' in skill === false`, `'unlocked' in skill === false`) cannot exist at T6 — `learn()` mints those fields until T8; they move to T8.

## Task 7 — Retired-op caller cleanup (BEFORE the deletions)

Caller-first ordering — this task removes every production/test-mock caller of the members T8 deletes:

- `EarlyGameBootstrap.ts:51-57` + `App.vue` `onNewCharacter` (:534-545) + `onRestoreOk` (:553-559): `learnSkill('tram')`, `learnSkill('linh_bao')`, `learnSkill('huy_quyen')` only — no slot writes (default resolves tram; the tram-to-slot-0 repair disappears).
- `useAppLifecycle` test mock's `setSkillLoadoutSlot` entry re-points to `setMortalBasicSkill` or drops per its usage.
- `progressionOps.setSkillLoadoutSlot` + `progressionOps.unequipSkill` methods deleted HERE (their last callers — `useLoadoutActions` re-pointed in T5, `App.vue`/`EarlyGameBootstrap` cleaned above — are already gone); the K3 precursor gate lives on as the `setMortalBasicSkill` mortal guard (T2).

## Task 8 — Skill model + manager + system sweep (TDD: assert absence)

- `Skill.ts`: delete `loadoutSlot`, `loadoutSlots`, `equipped`, `unlocked` + rewrite stale comments (:123-126).
- `SkillManager.ts`: delete `getActiveSkills`, `getEquippedInSlot`, `getLoadoutEntries`, `getLoadoutSkills`; `getPassiveSkills` → `skill.type === 'passive'` only.
- `SkillSystem.ts`: `learn` mint drops `unlocked/equipped`; `progressionOf` drops the three projections; delete `equipToSlot`/`unequipFromSlot`/`equipWithoutSlot`/`unequip`; `getScaledPassiveModifiers` untouched (consumer re-point is the manager).
- `SkillProgressionState`: drop `unlocked/equipped/loadoutSlots`.
- `TurnSkillPlanRuntime.progressionStub`: drop the three fields.
- `CultivationPathRuntimeDeps.skillManager`: Pick narrows to `'get' | 'has'`; `CultivationPathRegistry` drops `getEquippedInSlot` import usage (CAST_LEVELING_THRESHOLDS import may remain for nothing — mortal gate now via `isMortalPrecursorSkillId`; check and remove if dead).
- `SkillLoadoutSlots.ts` deleted.
- Skill data templates (`CoreSkills`, `PassiveSkills`, `PhapTuChainSkills`, `PhapTuRouteSkills`, `KiemPhoOrbs`, `TalentPassives`, `Skills.ts`, `TheTuSkills`, `NguKiemDaoSkills`, `PhapTuUltimates`, `PhapTuEmpoweredUlts`, `TurnAnKitSkills` as applicable): sweep `unlocked`/`equipped` declarations — **including authored-TRUE lines**: `TalentPassives.ts:38-39` authors `unlocked: true, equipped: true` in the `talentPassive` factory; delete both fields there and update any header/factory comment that leans on equipped-passive semantics (learned ≡ active now).
- `SkillExecutor.testkit.ts`: drop fields if minted there.
- **Same-task test migration — ALL of it:** `tsconfig.app.json` includes `src/**/*.test.ts`, so every test caller of the deleted APIs (`equipToSlot`/`unequipFromSlot`/`equipWithoutSlot`/`unequip`/`getEquippedInSlot`/`getLoadoutEntries`/`getLoadoutSkills`/`getActiveSkills`/`getSkillLoadoutSlotCount`) and every fixture minting `unlocked`/`equipped`/`loadoutSlot(s)` is migrated IN THIS TASK — the tree must type-check at the T8 boundary. That includes whole-file subjects of the retired surface (`SkillSystem.loadoutSlots.test.ts` and siblings consist entirely of deleted APIs — rewrite to new-contract tests or delete the file HERE; nothing retired waits for T10).
- Residue census: zero production `unlocked|equipped|loadoutSlot|equipToSlot|unequipFromSlot|equipWithoutSlot|getEquippedInSlot|getLoadout|getActiveSkills|getSkillLoadoutSlotCount|MAX_SKILL_LOADOUT_SLOTS` on skill domain.

## Task 9 — Save v71 (TDD)

- `CURRENT_SAVE_VERSION = 71` + version comment header update (`saveVersion.ts:85-87` region — add v71 line: retired skill fields rejected; `mortalBasicSkillId` contract; v70 rejected).
- `saveShapeValidation.ts:1206`: `validateIdEntries(skills)` → new `validateSkillEntries` — id check PLUS reject entries carrying `'loadoutSlot'|'loadoutSlots'|'equipped'|'unlocked'` keys (corrupt payload, never sanitize-then-load).
- `preflightSaveRegistryReferences` (`GameManagerSaveRestore.ts:107`): `save.player.mortalBasicSkillId` present → must be `MORTAL_PRECURSOR_SKILL_IDS` member AND `save.player.cultivationPath` absent — else throw (same hard-fail seam as M3's way-holder check).

Tests (red): literal v70 payload rejects 'incompatible'; `it.each(['loadoutSlot','loadoutSlots','equipped','unlocked'])` — a v71 skill entry carrying each retired key rejects; `mortalBasicSkillId='huy_quyen'` on a mortal player passes, on a path-committed player rejects, non-precursor id rejects; fresh mortal save carries no `mortalBasicSkillId`.

## Task 10 — Residual characterization/integration updates + full verify

- T8 already migrated every test caller/fixture of deleted identifiers INCLUDING whole-file retired-surface subjects. What remains here: only characterization/integration updates unrelated to deleted APIs — e.g., `EarlyGameSession.test.ts` re-characterization if the starter-basic window shifts its loop, e2e flows that staged slot state through removed helpers.
- `npm run verify` from `game/`.
- Balance/sim: spell-pre-element + body-pre-root builds now resolve starter basics — document any sim drift in `docs/balance/` (expected minimal; `EarlyGameSession.test.ts` characterization may shift again — investigate honestly if it does).

## Gate chain (same as M3)

P3 `npm run verify` → P18 OCR → P13/P14 live matrix (mortal pick switch → battle uses linh_bao; sword ritual → dynamic basic label renders; spell ritual → starter basic until element pick; hidden_body → reactivePayloads+maxThe intact) → P4 adversarial QA → P5 3 sequential passes → external review → commit.
