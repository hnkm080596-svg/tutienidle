# THỂ TU (body path) — Design Completeness Inventory

Repo `hnkm080596-svg/tutienidle`, branch `beta/rc`, app root `game/`. Read-only audit; all citations `file:line`.
Path ids: `cultivationPath: 'the_tu'`; ways `body_pathway` (hiện) and `hidden_body_pathway` (Ẩn / Thể Tu Ẩn — Ứng Thế Thần Quyết) — `src/core/player/CultivationPathKit.ts:64-67`.

## (a) EXISTS — with counts

### Skills (dimension 1)
- **12 `TurnSkillDefinition`s** in `src/data/skill/TheTuSkills.ts` (TheTuSkills are native turn defs, not `Skill` objects; no cast-leveling — file header lines 22-26):
  - Cuồng Chiến kit (3): `cuong_quyen`, `loan_dau`, `bat_tu_ba_the` — lines ~40-120; `CUONG_QUYEN_MISSING_HP_PER_PERCENT`/`CAP`, `BAT_TU_BA_THE_TURNS` (line ~28).
  - Trấn Thể kit (3): `tran_ap`, `phan_chinh` (`emblemOnly: true`), `son_nhac` — lines ~120-200; `SON_NHAC_WARD_RATIO` (line 28).
  - Ứng Thế fixed kit (3): `tham_the`, `tu_the`, `bach_ung` — "ung_the (The Tu An) — fixed kit granted at path choice (spec 6.1)" line 132.
  - Reactive payloads (3): `phan_kich`, `tro_kich`, `trong_phan_kich` (`progressionOwnerId: 'tham_the'`) — lines ~200-260.
- `THE_TU_KIT_BY_ROOT` map + `buildTheTuKit`/`buildTheTuAnKit` bake node modifiers into `structuredClone`d defs (registry never mutated) — TheTuSkills.ts:~200-300.
- **Gate skill**: `huy_quyen` cast-leveled `Skill` (CoreSkills.ts:114-160, maxLevel 3, attack_speed); Lv3/10.000 casts = the ONLY Ẩn-path reveal condition at the Initiation Ritual (comment 114-116).
- **12 buff defs** in `src/data/buff/TheTuBuffs.ts` (253 lines): `BAT_TU_BA_THE_BUFF`, `PHAN_CHINH_BUFF`, `SON_NHAC_BUFF`, `SON_NHAC_HO_THE_BUFF`, `KHIEM_KHICH_DEBUFF`, `UNG_THE_BUFF` (the_economy payloads), `HO_MON_MARKER`, `PHAN_MON_MARKER` (reactive_proc: onImpactLanded + onEvade→phan_kich), `TRO_MON_MARKER` (onAllyActionComplete→tro_kich), `TU_THE_BUFF` (procCostFlatDelta −5), `BACH_UNG_BUFF` (freeProcs + choang ailments), `HO_VE_BUFF`.
- **Display meta**: `src/data/skill/TurnSkillDisplayMeta.ts:80-126` covers 11/12 ids — `trong_phan_kich` deliberately has NO entry (internal payload).
- Related passives: `talent_passive_bat_tu_the` (TalentPassives.ts:170), `passive_kim_cang_y_chi` (PassiveSkills.ts:459), talent `bat_tu_the` (Talents.ts:119-127), `pham_cot` easter-egg talent (Talents.ts:138), `pham_nhan_chi_cot` reward talent (Talents.ts:258), `body_refinement_progress` talents 15/30/50% (BreakthroughTalentPools.ts:103-106).

### Realm coverage of skills
- Node trees: `src/data/progression/TheTuNodes.ts` (357 lines, **15 nodes**: 4 qi trunk minors + 2 foundation trunk minors + `CUONG_ROOT`+5 branch + `TRAN_ROOT`+5 branch; mutex roots; `requiredWay:'body_pathway'`); `src/data/progression/TheTuAnNodes.ts` (418 lines, **25 nodes**: 7 qi trunk incl. 3 economy + 4 foundation trunk + `HO/PHAN/TRO` non-mutex roots + 4/3/4 branch; `requiredWay:'hidden_body_pathway'`).
- Realm gates exist only on `qi_refining` and `foundation_establishment` — "beta content bound, spec section 11" (TheTuNodes.ts header). No Thể Tu content for golden_core+ (none designed).

### Hình ảnh (dimension 2)
- Trial UI exists: `hidden.trial.banner` i18n + `CombatTopBar.vue:46-47` survival-rounds banner.
- Enemy *data* complete: `MortalEnemies.ts` (~44 defs), `FoundationEnemies.ts` (20 foundation species + `FLOOD_DRAGON_PHASES` boss), `HiddenBeasts.ts` (`co_thu` mortal boss isBoss+undefeatable, zero rewards; `huyet_mong` qi_refining hidden beast, drops `tinh_hoa_pham_the`×12).
- `Enemy` type has **no art/sprite field** (`src/core/enemy/Enemy.ts`); art resolves by id convention only (`src/game/support/EnemyArt.ts`).

### Đột phát / realm rewards (dimension 3)
- `BODY_REFINEMENT_TIERS` — 6 tiers, caps 50/175/615/2150/7500/26300 (`src/data/realm/BodyRefinement.ts:48-101`).
- `MERIDIANS` — 8 authored on qi_refining (`src/data/realm/Meridians.ts`); 9th `ky_kinh_thien_dia_chi_kieu` RETIRED (comment lines 6-9).
- `ZHOU_TIAN_TOTAL_STEPS=36`, `zhouTianStepCost`, `zhouTianStepReward` (`src/data/realm/ZhouTian.ts`).
- `PHYSIQUE_GRADES` — 10 grades (`src/data/realm/PhysiqueLadder.ts`); `PHYSIQUE_ESSENCES` — 3/10 rungs (pham/bao/phap) + band drops + conversion ratio (`src/data/realm/PhysiqueEssence.ts`); band drops ARE now wired into StageDropTables/FamilyDropTables (M-QI-10 landed — PhysiqueEssence.ts header note stale).
- Realm passives `REALM_PASSIVES` — 2 entries with normal + enhanced builders (`src/data/realm/RealmPassives.ts:145-163`).
- Breakthrough pipeline wired end-to-end: `resolveBreakthroughType` (`core/realm/hidden/HiddenLineage.ts`), `getBreakthroughRequirements`/`CORE_REALM_LEVEL=12`/`EXTENDED_REALM_LEVEL=18` (`BreakthroughGate.ts:44,51` + `realmSystem.ts`), `closeHiddenLineage` on normal / `recordHiddenBreakthrough` on hidden (`GameManagerRealmAdvanceOps.ts:378-392`, `TribulationOutcomeService.ts:207-313`), `great_dao` outcomeGrade + `pham_cot`→`pham_nhan_chi_cot` conversion, `getEffectiveMainStatCap` +10pp/body (`StatCap.ts:58-59`).
- Breakthrough-scoped resources: `truc_co_dan` pill + `alchemy_truc_co_dan` recipe; `BREAKTHROUGH_SCOPED_MATERIAL_IDS=[]` (`BreakthroughScopedResources.ts` — `great_dao_seed` retired).
- HEAVEN grade requires 6/6 body tiers + 6/8 meridians + truc_co_dan (`BreakthroughGrades.ts`).

### Mechanics (dimension 4) — DONE surfaces
- Body chapters: `BodyRefinementChapter`, `MeridianChapter`, `ZhouTianChapter` (36 steps, `unlocksAfterChapters:['meridian']`), `BodyChapterEssenceSubstitution` (M-QI-09 downward-only), `BodyProgressionSystem` + `collectBodyBaseStatDeltas` — `src/core/realm/body/`.
- Hidden mechanisms — all 3 IMPLEMENTED (not skeleton): `AncientBeastTrial.ts` (`ANCIENT_BEAST_ENEMY_ID='co_thu'`, SURVIVAL_ROUNDS=8, ENCOUNTER_CHANCE=0.05, PITY=30, eligibility mortal+open lineage+6/6 refinement; registers resolver/runner/validator at module load), `QuanTheDiversion.ts` (`QUAN_THE_REQUIRED_CULTIVATION=50_000`, requires 8/8 meridians), `NghichChuTian.ts` (36 steps, essenceCost 40+level·10, stoneCost 1+⌊level/3⌋, successChance max(0.01, 1−level·0.99/35), pityLimit 3+⌊level/4⌋) — `src/core/realm/hidden/`.
- `HiddenBattleReplacement.ts` resolver+runner registry seam; `HiddenPerfection.ts` state + `HIDDEN_MECHANIC_STATE_VALIDATORS` registry; `HiddenLineage.ts` strict-prefix authority (discover/complete/close/record; `isHiddenBreakthroughEligible` = realmLevel≥18 ∧ hidden body ∧ 5 mains at effective cap ∧ canTriggerBreakthrough).
- Combat channels: Hộ intercept window, Phản evade window, Trợ ally-action window, `externalWard` protection pool, `reactive_bypass` execution kind, `fixed_holder_turns` duration policy, Thế economy (`TheEconomy.ts`, `MAX_THE`), `hiddenBodyReactiveModifiers` (STR/DEX→counter, VIT/DEX→protect, DEX/INT→followUp), `bodyEnduranceModifiers` — `src/core/the-tu/`.
- UI: `BodyRefinementSection.vue` (hidden mortal row), `MeridianSection.vue` (Quán Thể row + progress), `ZhouTianSection.vue` (full Nghịch section incl. attempt + pity/chance), `QuanKhiPanel.vue` (hidden-way offer gating), `SkillPathPanel.vue` (tree tags), `PlayerHudLayer.ts` Thế bar; `hidden.*` i18n keys complete in vi.json + en.json (lines 1234+).
- DEFERRED (authored but no channel): TheTuNodes.ts:27-32 — tran_ap debuff riders, Bất Tử leech/kill-extend, son_nhac self-DR scaling; roadmap B6 also lists AoE interception.

### Design docs (dimension 5)
- `docs/design/2026-09-23-hidden-perfection-lineage.md` (917 lines, FINAL/DESIGN LOCKED, 20 sections).
- `docs/specs/2026-09-23-hidden-perfection-lineage-master-spec.md` (670 lines).
- `docs/superpowers/specs/2026-09-15-the-tu-reimagined-design.md` (696 lines) + plan v2.4.
- `docs/systems/body-refinement.md` (35 lines, "Trạng thái: Live").
- `docs/specs/m-f-body-perfection-spec.md` (400) + `docs/specs/m-f-body-hidden-spec.md` (557) — SUPERSEDED (see below).
- `docs/roadmap.md` B6 (lines 2247-2330), §0.6 (1947-1975), §2690.

## (b) STUB / PLACEHOLDER — symbol names + locations

| Symbol | Location | Marker |
|---|---|---|
| `baseGains` ×6 (luyen_bi…luyen_mach) | `BodyRefinement.ts:57,65,73,81,93,101` | `// P7-M-F PLACEHOLDER - pending dedicated balance phase` — roadmap: "owned by the deferred BETA-BALANCE phase (user ruling 2026-09-24)" |
| Tier caps 50/175/615/2150/7500/26300 | `BodyRefinement.ts:48-50` | "first pass" |
| `NHAP_DAO_ENHANCED_PERCENT=0.3`, `KIEN_CO_ENHANCED_MAIN_STAT_PERCENT=0.2` | `RealmPassives.ts:41,104` | "sec.18 BALANCE-deferred placeholder — NON-CANONICAL" |
| `zhouTianStepCost`/`zhouTianStepReward` values | `ZhouTian.ts:25` | "per-step COST VALUES are content-deferred" (36-step reward magnitudes = design sec.18) |
| `QUAN_THE_REQUIRED_CULTIVATION=50_000`, Nghịch cost/chance/pity constants, Ancient Beast 0.05/8/30 | `QuanTheDiversion.ts`, `NghichChuTian.ts`, `AncientBeastTrial.ts` | all BALANCE-marked per design sec.18 |
| `PHYSIQUE_GRADES` per-grade stats | `PhysiqueLadder.ts:4` | "no stat bonuses ride the ladder (per-grade stats deferred to balance phase, QI-D4d)" |
| `PHYSIQUE_ESSENCES` | `PhysiqueEssence.ts` | only 3/10 rungs authored (pham/bao/phap) |
| Tunable combat constants (`CUONG_QUYEN_*`, `SON_NHAC_*`, `KHIEM_KHICH_TURNS`, `PHAN_CHINH_*`, Thế gain fields) | `TheTuSkills.ts:28`, `TheTuBuffs.ts` | "Tunable first-pass constants (spec section 11: playtest-tunable)" |
| `tu_luc` VFX preset | `CombatVfxPresets.ts:95-103` | Kiếm Tu channel tick, marked "art sau" |
| Deferred Thể Tu channels | `TheTuNodes.ts:27-32` | tran_ap debuff riders / Bất Tử leech/kill-extend / son_nhac self-DR scaling |
| Lv12→18 cultivation curve | design doc line 17 | "exact curve is BALANCE" |
| `computeTechniqueGradeInheritance` | `TechniqueProgression.ts:132-137` | returns `{}` — coefficients deferred to balance pass |

## (c) MISSING ENTIRELY

- **Thể Tu VFX**: ZERO authored presets — no `presetId` set on any Thể Tu def → all resolve `DEFAULT_PRESET_ID 'arcane_impact'` (`CombatAction.ts` `vfxPresetForSkill`; `TurnActionPresentationEvents.ts:22-23`). Contrast: 30 authored `kiem_combo_*` presets for Kiếm Tu ("DATA ONLY until the presentation pass registers diễn xuất" — `CombatAction.ts:121-122`).
- **Enemy art beyond mortal batch**: only 20 `mortal_*` PNGs exist (`public/assets/enemies/mortal/*.png`, `MORTAL_ENEMY_TEMPLATE_IDS` in EnemyArt.ts). `co_thu` (the Ancient Beast trial centerpiece!), `huyet_mong`, all qi_refining + foundation species → shared `PLACEHOLDER_ENTITY_KEY` (`combat-animation-playback.ts:90-99`). Roadmap acknowledges: "Rectangle fallback for non-mortal entities = future art-batch content".
- **Technique icons**: `diamond_body_art` + `responsive_body_art` both `icon: '/assets/techniques/iron_body_scripture.png'` (`Techniques.ts:145,173`); directory `public/assets/techniques/` does NOT exist → broken icon path (rendered by `TechniqueSlotCard.vue:105,123`). Affects all techniques, not just body.
- **Thể Tu artifact**: none — only `ngu_hanh_chau` (Pháp Tu) exists in `src/data/artifact/`; "Thể Tu artifact grants" on the deferred list (roadmap B6:2503).
- **Body content beyond foundation_establishment**: hidden bodies authored only for mortal/qi_refining/foundation (`HiddenBodyRealms.ts:17-35`, strict-prefix); meridian page only qi_refining; body_refinement mortal-exclusive by design. Golden_core+ realms have no body chapters/nodes — beta bound, by design.
- **bodyPerfection material surface**: RETIRED by design — `data/realm/BodyPerfection.ts` absent; `bodyPerfection` slice gone (saveVersion.ts:180 comment: "RETIRED"; design sec.14/15 forbids generic hidden-material perfection). Only comment residue remains in `GameManagerQuestOps.ts:57`, `saveShapeValidation.ts:794`.
- **9th meridian / `thien_dia_chi_kieu` material**: retired (Meridians.ts:6-9; huyet_mong signature line reduced to `tinh_hoa_pham_the`×12 — HiddenBeasts.ts:7-9).
- **Exploration/random-encounter acquisition channel**: confirmed ABSENT in m-f-body-hidden-spec (no roaming channel kind exists).

## (d) Constraints / authority files constraining Thể Tu authoring

| File | Constraint |
|---|---|
| `docs/design/2026-09-23-hidden-perfection-lineage.md` | FINAL/DESIGN LOCKED. §2 exactly two breakthrough types (no intermediate tiers); §3 strict-prefix lineage, normal breakthrough closes it permanently, freeze-on-close; §4 hidden content must not leak; §6 +10pp main-stat cap per hidden body; §7 hidden body ≠ hidden breakthrough gate ordering; §8 enhanced passives authored per realm (no universal multiplier); §18 balance-deferred list; §19 migration audit census |
| `docs/specs/2026-09-23-hidden-perfection-lineage-master-spec.md` | HIDDEN-A/B/C mission contract; mechanism registry/validator ownership |
| `docs/superpowers/specs/2026-09-15-the-tu-reimagined-design.md` + plan §"Known limitations" | Kit/root model, chance-stat domain rule (nodes never grant counterChance/protectChance/followUpChance — attribute-derived only), Thế proc-fuel economy, deferred-content list |
| `docs/specs/2026-09-16-cultivation-path-framework-spec.md` | 5-ID model retired; ways offered only at Initiation Ritual behind offer gates (huy_quyen Lv3); `_an` ids survive only as domain/branch tags |
| `docs/specs/m-f-body-perfection-spec.md` + `m-f-body-hidden-spec.md` | SUPERSEDED — kept as acquisition-channel census reference; bodyPerfection surface retired by ruling |
| `docs/systems/body-refinement.md` | Live doc for the 6-tier chain. NOTE stale claims: says `luyen_the_ky_tai` dead/resolves 1 — but `body_refinement_progress` talents exist (BreakthroughTalentPools.ts:103-106) |
| `docs/game-guide.md` | STALE: line 22 still describes 9 meridians incl. Thiên Địa Chi Kiều; line 74 says Thể Tu not a playable path — both outdated post-reimagine/HIDDEN-C |
| `src/data/realm/PhysiqueEssence.ts` header | STALE: says band drops "unwired until M-QI-10" — M-QI-10 landed (StageDropTables.ts:53,70) |
| `src/core/realm/hidden/HiddenBodyRealms.ts` + `HiddenLineage.ts` | Strict-prefix registry + module-load assertion; sole authority for lineage lifecycle |
| `src/core/realm/body/BodyChapter.ts:307-328` | Strict 1:1 chapter↔state-slice coherence — any new body chapter must register here |
| `AGENTS.md` P7 | No commit/push/merge without explicit authorization |

## Bottom line

Thể Tu is the **most mechanically complete** of the three paths in the beta window: both ways shipped, 12 turn-skills + 12 buffs + 40 nodes, all three hidden bodies fully implemented with UI + i18n, and the hidden-breakthrough pipeline (enhanced passives, great_dao, talent conversion) wired end-to-end. The path's remaining debt is almost entirely **art/VFX** (zero authored presets; placeholder entity for co_thu/huyet_mong and all post-mortal enemies; broken technique-icon dir) and **balance** (6 baseGains + all sec.18 constants marked NON-CANONICAL pending BETA-BALANCE). Feature gaps are few and deliberate: tran_ap riders / Bất Tử leech / son_nhac scaling / AoE intercept (deferred), Thể Tu artifact (deferred), physique-grade stats (QI-D4d).
