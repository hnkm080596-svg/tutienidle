# FRONTEND CONTRACT — BETA SCOPE LOCK v2

Audience: Codex (frontend implementation) and Minh. This is the canonical
map from UI surface to the backend read-model/mutation API it must consume.
**The frontend never rederives a scope/progression predicate from raw
`PlayerData`** — every surface reads its verdict from the read-models below.
Everything here lands on branch `devin/beta-scope-v2` (merged PRs #82–#89).

Verdict semantics (single vocabulary, `core/betaScope.ts`):

| state | meaning | UI treatment |
|---|---|---|
| `available` | in scope AND progression met | render normally |
| `progression-locked` | in scope, gate unmet | render with lock treatment + `reason` |
| `scope-hidden` | out of beta scope entirely | do not render; no teaser, no "locked" |

Files: `game/src/core/betaScope.ts` (feature/way/element/roster/recipe/tab authority),
`game/src/core/betaScopeSkillDomain.ts` (combat rail + skill tree read-models),
`game/src/core/betaScopeSurface.ts` (navigation/wheel/building/panel/realm/ending/save surfaces).
Generic gate: `betaScopeVerdict({offered, progressionMet})`, `betaSurfaceVerdict(surfaceId, ctx)`,
`betaSurfaceVisible(surfaceId, ctx)`.

---

## A. Creation (new character)

- Writable fields: **name + talentIds only**. No skill pick, no way pick, no element pick.
- Talent offer list: `BETA_CREATION_TALENT_IDS` (18 ids; `pham_cot` excluded). Callers filter
  `CHARACTER_CREATION_TALENTS` through `isBetaCreationTalentId(id)` — backend already enforces
  the same allow-list in the Supabase creation RPC, so a tampered client cannot inject.
- Every created mortal starts with `mortalBasicSkillId = 'linh_bao'`
  (`BETA_MORTAL_STARTER_SKILL_ID`). `tram`/`huy_quyen` are never writable picks.
- Render: name input + talent picker. Do not render skill/way/element choosers.

## B. Ngũ Hành Initiation (Phàm Nhân → Luyện Khí)

- **One atomic mutation:** `gameManager.realmAdvanceOps.commitFiveElementInitiation(element, player)`
  → `{ ok: true } | { ok: false; reason: FiveElementInitiationFailure }`.
  One call commits path+way+element+realm+root node together; on failure the save is
  byte-equivalent rolled back — the UI only needs to render `reason` (15 codes:
  `invalid_element, not_mortal, already_committed, realm_level_too_low, in_combat,
  way_unavailable, way_not_offered, element_committed, missing_technique,
  technique_occupied, technique_grade_exceeds, missing_element_root,
  element_root_blocked, missing_kit_skill, commit_failed`).
- `chooseCultivationPath` refuses `declaresElementAxis` ways — the element commit is the
  only admission path for `spell_pathway`. Do not call chooseCultivationPath for it.
- Elements offered: all five (`BETA_PLAYABLE_ELEMENTS`).

## C. Combat rail (skill bar)

`betaCombatRolesFor(player, { hasSkill })` → `[basic, special, ultimate]` always 3 entries:

| role | mortal (uncommitted) | committed spell, no element | committed + element |
|---|---|---|---|
| basic | starter precursor, `available` | `linh_bao`, `available` | element kit basic, `available` |
| special | `progression-locked` `realm-gate` | `progression-locked` `element-uncommitted` | `available` when keystone gates met + learned, else `progression-locked` (`realm-gate`/`not-learned`) |
| ultimate | `scope-hidden` `out-of-beta-scope` | same | same (permanent — there is no ultimate in beta) |

Suppressed legacy surfaces: `betaCombatSurfacesFor(player, deps)` → verdicts for
`sword-dynamic-basic` (Kiếm orb picker) and `an-ultimate-emblem` — both `scope-hidden` in beta.
Never render an ultimate slot as "locked"; it is absent.

## D. Skill tree (Đạo Luân)

`betaSkillTreeFor(player, tree?)` / `activeElementTreeFor(player, tree?)` → `BetaSkillTree`:
`{ element, realmId, way, wayName, wayNodeTreeTag, elementCasting,
nodes: BetaSkillTreeNode[] }`. Node `state`:
`purchased | purchasable | available | progression-locked | scope-hidden`
(`reason`: `initiation-pending | prerequisites-unmet |
insufficient-insight | unresolved-way-state | non-beta-way |
grant-only-node | foreign-stamp | other-element-branch | undefined`).

- Mortal: whole tree `progression-locked` `initiation-pending` (in scope, behind ritual).
- Post-commit: the 4 non-committed element branches are `scope-hidden` (NOT locked);
  foreign-way nodes `scope-hidden` `non-beta-way`; grant-only nodes `scope-hidden` `grant-only-node`.
- Per-node `prerequisites[]` + `levelGates[]` carry `met` flags + display targets —
  render them verbatim; never recompute.
- `nextLevelCost`, `affordable`, `canUpgrade`, `effectiveMaxLevel` are precomputed.
- `wayName`, `wayNodeTreeTag`, `elementCasting` are the canonical identity
  fields - `SkillPathPanel` reads them instead of `CultivationPathSystem`/
  `getActiveWayDefinition`/`hasStaticPathCapability` calls.
- `SkillPathPanel`, `NodeTreePanel`, `NodeInspector`, `SkillRoleStrip`,
  `TheTuTreePanel` render ONLY from this model (via
  `progressionOps.betaSkillTreeFor`) - no `NodeSystem` predicate
  (`canPurchaseNode`, `getNodeLevel`, `getEffectiveNodeMaxLevel`,
  `getNextLevelCost`, `hasPrerequisite`, `nodePathApplies`, `nodeWayApplies`,
  `isNodeElementActive`, `ownedNodeIds`, `getBlockingNodeLevelGates`) and no
  `getSkillCoreLevel` may be imported into `components/`. Reveal-hide stays
  the `gate:'reveal'` row's `met` flag; route-stamp mismatches surface as
  `scope-hidden` `foreign-stamp`.
- Mutation: existing `progressionOps` purchase/upgrade calls; rejection reasons unchanged.

## E. Encounter / stage surfaces

`gameManager.stageOps.getStageSurfaceModels(player)` → `StageSurfaceModel[]` (roster-filtered):
`{ stageId, act, realmId, floor, state, isBossFloor, displayEnemy, rewardPreview,
autoFarmAvailable, startAvailable, disabledReason }`.
`state`: `locked | current | available | completed | perfect`.
`disabledReason`: `{kind:'realm'|'floor'|'progress'|'busy'}`.
Only roster enemies ever appear in `displayEnemy`/rewards — the spawn funnel
(`stageSpawnableEnemyIds`) already keeps out-of-roster enemies off stages.

## F. Economy surfaces

- **Equipment hall** — tabs via `BETA_EQUIPMENT_TABS`/`isBetaEquipmentTab`:
  only `enhance` + `dissolve` render. Wash/refine/ore-decompose return
  `{ok:false, reason:'scope_hidden'}` at the domain API — a surfaced button would be dead.
- **Alchemy** — `gameManager.alchemyOps.getBetaAlchemyRecipeModels(player)` →
  `BetaAlchemySurfaceModel{roomLevel, maxConcurrentJobs, activeJobs, recipes[]}`.
  Each recipe carries `variants[].sufficient`, `spiritStoneCost/Owned`,
  `specialIngredients[].sufficient`, `craftable`, `realmMatchesPlayer`,
  `breakthroughAvailable`, `activeJob?`. Render `recipes` directly.
- **Technique** — `gameManager.realmAdvanceOps.getBetaTechniqueSurfaceModel(player)` →
  `BetaTechniqueSurfaceModel{techniqueId?, state('unavailable'|'available'), name?, grade?,
  rank?, mastery?, icon?, description?, element?, quality?, tier?, masteryForNextRank?,
  rankCapped?, sections, gradeAdvance{available, disabledReason
  ('no-technique'|'grade-ceiling'|'realm-gate'|'insufficient-material'|'busy'|null),
  targetGrade?, materialId?, materialName?, cost?, owned?}}`. The UI never calls
  `canAdvanceTechniqueGrade`/cost functions or compares bag quantities itself —
  the model resolves all of it. Mutation stays `tryAdvanceTechniqueGrade`.
- **Worker lodge (FINAL POLICY)** — Chi Hiền Quán is **hidden completely** from
  the beta UI: `getWorkerLodgeSurfaceModel()` resolves EVERY authored tab —
  `nhan_cong` included — to `scope-hidden` (`nhan_cong` is bound to
  `manualWorkforce` via `WORKER_LODGE_TAB_FEATURE`). Automatic production keeps
  running as a background system with no UI. Never import `CompanionAvailability`.
- **Quests** — `gameManager.questOps.getBetaQuestSurfaceModels()` →
  `BetaQuestSurfaceModel[]{id, name, description, cadence:'once', progress, target,
  targetLabel|null, rewards[] (admitted lines only), claim{available, claimed,
  disabledReason('incomplete'|'missing-turnin-items'|'already-claimed'|null)},
  turnIn?{materialId, required, owned}}`. The panel never imports `ReleasePolicy`
  or touches `itemDrops` — `isQuestRewardDropAdmitted` is the ONE predicate,
  shared by `claim()` and the model. Only `isBetaQuestEnabled`-admitted quests
  ever appear; no daily cadence exists.
- **Realm ladder** — `betaRealmLadderNodes()` = mortal rung + in-window passives only;
  `betaNextRealmSurfaceFor(player)` returns `null` at the ceiling (Trúc Cơ → Kim Đan) —
  render NO major-breakthrough CTA there.

## G. Navigation chrome

- Wheel: `betaWheelSlots()` — render exactly this list; per-slot `available()`/
  `disabledReason()` still apply on top.
- Buildings: `isBetaBuildingSurface(id)` — `teleport_array, pill_room, gathering_outpost,
  equipment_hall, vendor` live; `chi_hien_quan` bound to `manualWorkforce` (hidden).
- Standalone panels: `isBetaStandalonePanel(id)` — `skill, realm, quan_khi, quest` live;
  `artifact, tran_phap, companion` `scope-hidden`.
- Left-panel modes: `isBetaLeftPanelMode(id)` — all live except `worker_lodge`.

## H. Ending & save safety

- `betaCompletionFor(player)` → `{ act3FinalBossDefeated, betaComplete }` —
  true when the stage carrying `foundation_ferocious_flood_dragon_whelp` is cleared.
  This is the deliberate beta ending beat; there is no Kim Đan CTA.
- Save safety: `betaSupportedFor(player)` / `unsupportedReleaseReason(player)` →
  `realm_beyond_release | way_out_of_scope | hidden_progression_state |
  companion_owned | artifact_owned | formation_loadout | null`.
  Legacy saves deserialize intact (dormant, never corrupted) and carry a reason —
  render a notice; do not auto-migrate.

## I. Dormant systems — never referenced by beta UI

Companion (all surfaces incl. pulls/gifts/EXP), Trận Pháp, artifact/pháp_bảo,
hidden content (beasts/lineage/ngo_dao, Nghịch Chu Thiên, `hidden_window_opened` cue),
manual workforce (incl. the whole Worker Lodge surface, `nhan_cong` tab and
Production-panel allocation UI), Kiếm/Thể/hidden ways, wash/refine/decompose,
daily quests, ultimate slot.
These stay implemented + unit-tested behind the feature table — they are dormant,
not deleted, so no UI may mention them.

## J. Precursor growth law (all three mortal precursors)

`tram`, `linh_bao`, `huy_quyen` share: **+1 flat damage per 10 completed casts,
uncapped** (`getPrecursorFlatDamageBonus`), cast levels cap at Lv3
(`CAST_LEVELING_THRESHOLDS` 1000/10000 casts). If a cast-count progress meter is
shown, read `player.skillCastCounts[skillId]` — do not invent a separate counter.
