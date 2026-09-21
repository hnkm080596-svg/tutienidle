# P7 Progression Consolidation — System Inventory & Dispositions

Discovery census, 2026-09-21. Read-only reconstruction from current worktree (source is authoritative where docs conflict). Disposition vocabulary: `KEEP` / `FOLD` / `REPLACE` / `RETIRE` / `DEFER`. Every entry carries the evidence used to classify it.

Legend for proposed disposition column: **[P]** = proposed by this census, **[L]** = locked by user directive.

**STATUS UPDATE (2026-09-21): all six blocking notices resolved — see `decisions.md` D1–D6.** Proposed dispositions were approved: technique model = hybrid mastery/grade transaction (D1); realm passives → `realmRewards` (D2); generic loadout RETIRE (D3); body engines FOLD into `BodyProgression` chapter registry (D4); UI hybrid consolidation (D5); spine-English naming (D6).

---

## 1. Path / Way identity

| System | Files | What it does today | Disposition | Evidence |
|---|---|---|---|---|
| CultivationPathId union | `core/player/CultivationPathKit.ts` | Exactly `kiem_tu \| phap_tu \| the_tu` (v66). | KEEP [P] | Enum membership enforced in save validation. |
| cultivationWay pair | `core/player/Player.ts` (~L89-97), `CultivationPathSystem.applyPathChoice` | `(path, way)` written atomically inside the ritual; fail-closed resolution via `getActiveWayDefinition`. | KEEP [P] | M7 atomicity; all way-strict predicates exist. |
| Way modules | `core/phap-tu/PhapTuPath.ts`, `core/kiem-tu/KiemTuPath.ts`, `core/the-tu/TheTuPath.ts`, aggregated in `CultivationPathKit.ts` | Each way declares: `techniqueId`, `skillIds`, `unequipSkillIds`, `realmRewards`, stat facets, offer gates, tree/branch contract. | KEEP [P] | This is already the identity authority P7 wants. |
| Way realm rewards | `CultivationPathSystem.grantCultivationPathRealmReward`, `PhapTuPath.ts` L166 | `realmRewards[realmId].techniqueId` swaps the equipped technique on realm entry (only `ngu_hanh` → `dai_ngu_hanh_quyet_truc_co` at Trúc Cơ, with insight carryover). | REPLACE [P] | Directly violates candidate invariant 5 (technique ID stable across realms). |
| Way predicates | `isPhapTuNguHanh`, `isKiemTuHien/Ngu`, `isTheTuHien/UngThe` | Way-strict module predicates, fail closed. | KEEP [P] | Used by panels, ops, combat. |
| Path state slices | `PlayerData.phapTu` (required), `kiemTu?`, The Tu uses baseStats+nodes | Per-path persistent state, created by module contract at commit. | KEEP [P] | Single-owner per slice; kiemTu only for kiem_tu. |

## 2. Technique (Tâm Pháp)

| System | Files | What it does today | Disposition | Evidence |
|---|---|---|---|---|
| Technique data type | `core/technique/Technique.ts` | `insight`, `insightMultiplier`, `tierEffects`, `passiveSkillIdsByRealm`, `innateSkillId`, `element`, `resourceLabel`, `combatModifiers`, `unlocked`, `equipped`. Contains contradictory comments: "KHÔNG còn cộng chỉ số" (2026-08-18) vs "CÓ cộng chỉ số trở lại" (PLAN HOÀN CHỈNH §5). | REPLACE [P] | Type must be re-authored around canonical rank/grade model; comment history documents unresolved identity. |
| TechniqueManager | `core/technique/TechniqueManager.ts` | Learned-technique list + single `equipped`. | REPLACE [P] | With one canonical technique per way and no mortal technique, "learned list + equip choice" is dead machinery; likely becomes a single holder or way-owned reference. |
| TechniqueSystem | `core/technique/TechniqueSystem.ts` | learn/equip/unequip; equip auto-unequips previous. | REPLACE [P] | Equip-as-choice goes away; grant becomes way-owned at ritual. |
| TechniqueTier | `core/technique/TechniqueTier.ts` | 4 insight-share tiers (`so_nhap/tieu_thanh/dai_thanh/vien_man`), `BASE_TECHNIQUE_INSIGHT_REQUIRED=1000`, thresholds at 0/10/30/60% of cap. | REPLACE [P] | Candidate invariants require rank 0–10 + grade + quality, not insight-share tiers. |
| Insight economy | `GameManagerRewardOps.gainEquippedTechniqueInsight`, `Technique.insight` | Insight is per-technique, capped by `insightMultiplier`; carried over (Math.max) on realm-reward swap. Granted from battle victory. | REPLACE [P] | P7 must decide the real progression currency (see Notice: technique progression model). |
| passiveSkillIdsByRealm | `Technique.ts` L89, `syncRealmPassive` (RealmAdvanceOps L333) | Equipped technique maps realmId → passive skill learned+equipped on realm entry. `tu_linh_quyet` carries all 9 realm passives. | REPLACE [P] | Mechanism may survive as way-owned realm rewards; data cannot stay on Technique if technique identity changes. |
| innateSkillId | `Technique.ts` L99, `equipTechnique` (RealmAdvanceOps L120-143) | Passive auto-learned+equipped when technique equipped (ngo_dao's third kit member). | FOLD [P] | Becomes a way-declared kit grant, not a technique side-effect. |
| `tu_linh_quyet` | `data/technique/Techniques.ts` | Universal starter technique; learned+equipped at boot (`App.vue` L550-551); carries all 9 `passiveSkillIdsByRealm`. | RETIRE [L] | Locked: remove completely — not as fallback, not as compat. Mortal has no canonical technique. |
| Realm-swap variant `dai_ngu_hanh_quyet_truc_co` | `data/technique/Techniques.ts` L57 | Trúc Cơ replacement for `dai_ngu_hanh_chan_quyet`. | RETIRE [P] | Invariant 5: same technique ID across realms; replacement becomes rank/grade unlock. |
| Other technique defs | `data/technique/Techniques.ts` | 9 defs total incl. per-way canonicals (`ngo_dao_chan_quyet`, `ngu_kiem`, `van_kiem_quyet`, `kim_cang_bat_hoai_the`, `ung_the_than_quyet`). | KEEP/FOLD [P] | Canonical per-way techniques survive conceptually but must be re-authored to the new model. |
| Learn-by-drop | `grantItemDrops` case `'technique'`; `TechniqueCodex` catalog | Item drops can teach arbitrary techniques from the catalog. | RETIRE [P] | One canonical technique per way ⇒ no technique library/drops. Codex becomes way-technique info or is removed. |

## 3. Skill system & combat roles

| System | Files | What it does today | Disposition | Evidence |
|---|---|---|---|---|
| Skill / SkillManager | `core/skill/Skill.ts`, `SkillManager.ts` | Learned list; `equipped`+`loadoutSlot(s)` embedded on each Skill; restore() detached. | KEEP [P] | Learned-set ownership is fine; loadout fields on Skill must change (see loadout row). |
| SkillSystem | `core/skill/SkillSystem.ts` | learn/equip/unequip/equipToSlot/equipWithoutSlot, cast recording (`recordCast`), cast-level mirror into PlayerData, `upgradeSkill` (insight cost). | KEEP w/ REPLACE parts [P] | Cast tracking + learn stay; slot-equip API retires with loadout. |
| Skill Loadout (generic 5 slots) | `SkillLoadoutSlots.ts`, `setSkillLoadoutSlot` (ProgressionOps L385), `getEquippedInSlot`, UI `SkillLoadoutStrip`/`RadialSkillSelector` | 5 realm-gated slots; ANY learned active can be slotted. **Post-path it is combat-inert**: the only production combat read of `getEquippedInSlot` is the MORTAL runtime in `CultivationPathRegistry.ts` L335 (slot 0 → basic). Path players can still slot skills that never reach combat (UI/domain incoherence). | REPLACE [P] | Role contract already won; loadout becomes mortal-only or is replaced by role display. Decision needed (Notice). |
| B/S/U role contract | `CultivationPathRuntime` (`core/player/CultivationPathRegistry.ts`), `TurnCombatSkillBar.vue` | Combat resolves `basic/special/ultimate` via way runtimes; dynamic basic (kiem_pho orbs), emblem/passive slots (ngo_dao). | KEEP [P] | Already the single semantic contract (invariant 11). |
| Way kit providers | `KiemPhoProvider`, `NguKiemDaoProvider`, PhapTu chain/route skills, TheTu kits | Way-owned skill resolution behind the role contract. | KEEP [P] | Invariant 12 satisfied. |
| Mortal precursors | `MORTAL_PRECURSOR_SKILL_IDS` (`KiemTuState.ts`), `unequipSkillIds` per way, equip gate (ProgressionOps L402) | `tram/linh_bao/huy_quyen` (latter two un-authored) — unequipped at ritual, re-equip blocked post-path. | KEEP/FOLD [P] | Mechanism satisfies invariant 13; `linh_bao`/`huy_quyen` ids reserved but not authored (dead refs). |
| Cast-leveled skills | `getCastLeveledSkillLevel`, thresholds 1000/10000 | Level 2/3 by cast count; feeds way offer gates. | KEEP [P] | Works; but only `tram` meaningful — `linh_bao`/`huy_quyen` thresholds exist without skills. |
| `skilldef` pipeline | `core/skilldef/*` (SkillDefinition, SkillResolver, SkillExecutor, LegacySkillAdapter) | Authored skill execution contract. | KEEP [P] | Out of P7 scope; combat execution authority. |
| Skill upgrade (insight) | `upgradeSkill`, `getSkillUpgradeInsightCost` | skillInsight spend on skill levels. | KEEP [P] | Pool shared with node purchases — economy question (Notice). |

## 4. Node / progression graph

| System | Files | What it does today | Disposition | Evidence |
|---|---|---|---|---|
| NodeSystem | `core/progression/NodeSystem.ts` | Single owner of `nodeLevels` writes, purchase/upgrade gates, `insightCost`, route/element/way/path applicability, `devResetBranch`, `switchRoute`/`previewRouteSwitch`. | KEEP [P] | Invariant 10 satisfied. |
| ProgressionNode type | `core/progression/ProgressionNode.ts` | `insightCost`, `revealWhen`, `requiredCultivationPath`, `requiredWay`, `branchTag`, `unlocksSkillIds`. | KEEP [P] | Gating vocabulary adequate; Technique-gated node conditions may be needed (invariant 9). |
| Node data | `data/progression/*` (PhapTuNodes, KiemTuNodes, TheTuNodes, TheTuAnNodes, RealmPassiveNodes) | Per-way trees + realm passive nodes. | KEEP [P] | Content, not structure. |
| skillInsight economy | `PlayerData.skillInsight`, `totalSkillInsightGained`, `cultivationInsightAccumulator` | One pool spent on BOTH node purchase/upgrade AND `upgradeSkill`. | KEEP [P] | Single writer OK; economy split is a product question (Notice). |

## 5. Realm / cultivation / breakthrough

| System | Files | What it does today | Disposition | Evidence |
|---|---|---|---|---|
| Realm data | `data/realms/realm.ts` | mortal/qi_refining/foundation_establishment real (max level 18); 7 higher realms placeholder; `CORE_REALM_LEVEL=12`, `EXTENDED_REALM_LEVEL=18`, `attributeCap` per realm. | KEEP [P] | Content endpoint = Trúc Cơ. |
| realmSystem | `core/realm/realmSystem.ts` | Realm lookup/index, next realm. | KEEP [P] | |
| CultivationSystem | `core/cultivation/CultivationSystem.ts` | Cultivation accumulation + cap, minor-tier breakthrough (realmLevel++, attributePoints++), overcharge banking; mortal → qi_refining blocked (ritual instead). | KEEP [P] | Single owner of cultivation. |
| Initiation Ritual | `chooseCultivationPath` (RealmAdvanceOps L168-275) | mortal lv≥12 → applyPathChoice + learn/equip way technique + kit grant + precursor unequip + realm entry + breakthroughGrade + mortalPerfection snapshot + passive syncs. | KEEP [P] | The transaction is right; contents change with technique model. |
| Tribulation chain | `TribulationDirector`, `TribulationOutcomeService`, `BreakthroughOutcomeService`, `useTribulation.ts` | Trúc Cơ Độ Kiếp battle, realm entry, foundation grade, artifact seed, way realm rewards. | KEEP [P] | Combat-grade breakthrough authority. |
| Foundation grades | `core/breakthrough/FoundationType.ts`, `data/breakthrough/BreakthroughGrades.ts`, `highestFoundationAchieved`, `greatDaoOpportunityLost`, `mortalPerfectionAchieved`, HiddenBeasts, meridian 9/9 gate | Đại Đạo/… formula with hidden conditions. | DEFER [L] | User: special breakthrough formulas deferred, must not force P7 architecture. Documented in `deferred-breakthrough.md`. |
| Realm passives | `RealmPassiveSystem`, `data/realm/RealmPassives.ts`, `grantedRealmPassiveIds`, `breakthroughGrade` | Nhập Đạo/Kiến Cơ… permanent modifiers by grade; idempotent grants. | KEEP [P] | |
| Realm pressure | `core/combat/RealmPressure.ts` | Pressure vs lower-grade opponents. | KEEP [P] | Orthogonal. |

## 6. Body progression

| System | Files | What it does today | Disposition | Evidence |
|---|---|---|---|---|
| BodyRefinement (Luyện Thể) | `core/realm/BodyRefinementSystem.ts`, `data/realm/BodyRefinement.ts`, `bodyRefinementCompletedTiers`, `bodyRefinementCurrentTierProgress` | 6 sequential tiers, auto-invested Tinh Hoa Phàm Thể, realm-level pace gate (bypassed post-mortal), feeds breakthroughGrade + direct stats. | FOLD [P] | Invariant 15/16: one body authority, chapters not engines. |
| Meridian Opening (Bát Mạch) | `core/realm/MeridianSystem.ts`, `data/realm/Meridians.ts`, `openedMeridianIds` | 9 meridians opened sequentially; 9/9 incl. Thiên Địa Chi Kiều = Đại Đạo gate. | FOLD [P] | Second chapter of same authority. Its Đại Đạo coupling is deferred-formula territory (see deferred doc). |
| Body stat application | `buildTierModifiers`, meridian effects → modifiers | Stats via static modifiers on PlayerData. | KEEP [P] | Aggregation stays. |
| Luyện Thể UI | `LuyenThePanel.vue` | Read-only 6-row progress list. | REPLACE [P] | Six-row mortal-only panel does not scale to multi-chapter body progression (invariants 16-17). UI decision needed (Notice). |

## 7. Attributes / stats

| System | Files | What it does today | Disposition | Evidence |
|---|---|---|---|---|
| Base stats + allocation | `baseStats`, `attributePoints`, `allocateAttributePoint`, `StatCap.ts` | 5 main stats, points from minor breakthroughs, per-realm caps. | KEEP [P] | |
| Stat pipeline | `StatCalculator`, `resolveAttributeTotals`, `resolvePlayerFinalStats`, way stat facets (`collectActiveWayStatModifiers`) | Raw→resolved assembly; way-gated channels emitted pre-calc (INV-6/INV-10). | KEEP [P] | ARCH-002 boundary already clean. |
| Modifier channels | `modifiers` (static), `externalModifiers` (aggregated each tick), `persistentTimedEffects` | Three provenance classes. | KEEP [P] | |

## 8. Secondary progression systems (orthogonal — mostly KEEP)

| System | Files | Disposition | Note |
|---|---|---|---|
| Equipment + ops (enhance/wash/refine/dissolve) | `core/equipment/*`, `EquipmentOpsSystem.ts`, Equipment Hall UI | KEEP [P] | Own authority, not a progression rival. |
| Artifact (Bản Mệnh Pháp Bảo) | `core/artifact/*`, `PlayerData.artifact` | KEEP [P] | One per character, path-gated, Trúc Cơ seed. |
| Companion roster/gacha | `core/companion/*`, `companions`, `duyenPhan` | KEEP [P] | Orthogonal roster system. |
| Formation (Trận Pháp) | `core/formation/*`, `formationLoadout`, `TranPhapPanel.vue` | KEEP [P] | Party placement, not character progression. |
| Talisman (Phù) | `core/talisman/*`, `data/talisman` | KEEP/DEFER [P] | Minimal skeleton; wheel slot is NEVER_AVAILABLE. |
| Talents | `data/talent/*`, `selectedTalentIds` | KEEP [P] | Creation-time choice; several feed progression counters. |
| Pills/alchemy | `core/pill`, `core/alchemy`, `data/pill`, `data/alchemy` | KEEP [P] | Economy/crafting. |
| Buildings/workers/production | `core/building`, `core/production`, `core/profession` | KEEP [P] | Economy. |
| Quests | `core/quest`, `data/quest` | KEEP [P] | Reward driver incl. techniqueInsight grants. |
| Stages/exploration/drops | `core/stage`, `core/drop`, `core/enemy`, `core/world-map` | KEEP [P] | Content delivery. |
| `TuLinhTranBalance` | `core/economy/TuLinhTranBalance.ts` | KEEP (rename debt) | Unrelated to `tu_linh_quyet` — a formation/balance module that shares the "tụ linh" morpheme; flag in naming migration to avoid wrong-file deletes. |

## 9. Persistence

| System | Files | Disposition | Note |
|---|---|---|---|
| Save version policy | `services/save/saveVersion.ts` (v67), `SaveSystem.ts` | KEEP [P] | Convention: no migrations in dev; version bump rejects old saves. P7 save-shape changes = v68+ rejection, not field translators. This *supersedes* the literal reading of candidate invariant 23 — there is no migration boundary to translate at; old saves die. |
| SkillManager/TechniqueManager persistence | `GameManagerSaveRestore.ts`, `SkillManager.restore`, `TechniqueManager.restore` | KEEP w/ REPLACE shape [P] | Skill `equipped`/`loadoutSlot(s)` and Technique `equipped` fields change meaning under P7. |

## 10. Cross-cutting findings (no single owner)

- **F1 — Loadout is combat-inert post-path but still presented as combat authority.** `SkillLoadoutStrip` shows 5 slots to every player; path combat ignores them. Players can equip skills that never fire.
- **F2 — Technique has 3 UI surfaces** (standalone `TechniquePanel`, `TechniqueSlotCard` reuse, `TechniqueCodex` catalog) for a system that is already auto-equip-only.
- **F3 — Technique identity is split across 4 ideas**: way canonical (ritual grant), realm-swap variant, universal starter (`tu_linh_quyet`), drop-learnable library. Each has a different persistence/equip story.
- **F4 — `dai_ngu_hanh_quyet_truc_co` swap proves realm-as-new-technique violates the target invariant** — it exists precisely because technique progression could not previously express "same art, higher grade".
- **F5 — `linh_bao`/`huy_quyen` are referenced (precursor list, cast-level thresholds) but never authored** — dead forward references.
- **F6 — Body progression is two engines with separate persisted fields and separate panels**, matching the "unlikely to scale" concern: any future body chapter must add new fields+system+panel today.
- **F7 — Save policy already resolves the migration question**: no translators needed; bump version, reject old saves. Invariant 23 should be reworded as "no dual-identity support inside gameplay".
- **F8 — Naming convention already exists** (`docs/naming-conventions.md`): mechanic ids English, content ids VN pinyin. Candidate invariants 21-22 conflict with N2 family rules unless P7 reclassifies skill/technique/path/way ids as mechanic identity — material decision.
