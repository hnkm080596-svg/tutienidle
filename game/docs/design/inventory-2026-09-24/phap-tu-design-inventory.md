# PHÁP TU — Design-Completeness Inventory

Repo: `hnkm080596-svg/tutienidle`, branch `master`, app root `game/`. Read-only audit; no code touched.
All paths below are relative to `game/src/` unless noted.

## Global frame (apply to every section)

- Two Pháp Tu **ways**, both designed and live: `SPELL_PATHWAY` ('spell_pathway', Ngũ Hành kit, owns element/route/The) and `HIDDEN_SPELL_PATHWAY` ('hidden_spell_pathway', Ngộ Đạo, fixed kit) — `core/phap-tu/PhapTuPath.ts:210-387`.
- **Release ceiling = Trúc Cơ** (`foundation_establishment`): `progressionCeilingRealmId` — `core/realm/ReleasePolicy.ts:42`. All Kim Đan (golden_core) content is authored-but-dormant. Almost every Pháp Tu power node sits above the ceiling.
- Kit model is **3 slots** `[basic, special, ultimate]` per element (`SPELL_KIT_IDS` — `data/skill/Skills.ts:24-30`); runtime resolves exactly those 3 (`core/player/CultivationPathRegistry.ts:383-450`). Anything outside the kit has no combat slot.

---

## 1. Skills / chiêu thức

### (a) EXISTS — with counts

| Group | Symbol / file | Count | Reachable today? |
|---|---|---|---|
| Element roots (A) | `CORE_SKILLS` — `hoa_cau_thuat`, `thuy_tien_thuat`, `doc_chuong`, `diem_kim_thuat`, `tho_cau_thuat` (`data/skill/CoreSkills.ts`) | 5 | Yes — granted by element root node (`selectSpellPathElement`, `GameManagerProgressionOps.ts:451-514`) |
| Chain skills B–E | `PHAP_TU_SKILLS` (`data/skill/PhapTuChainSkills.ts`) | 20 (4 per element) | **Partially** — only C (special) + E (ultimate) are in the kit |
| God-ults | same file, buildTag `'ult'` (`tat_phuong_giang_the`, `bat_thu_can_quet`, `kien_moc_thong_thien`, `kim_phat_thu_sat`, `hau_tho_thanh_luy`) | 5 | As phap-tuong payload swap at ≥100 The (`CultivationPathRegistry.ts:429`) — gated by `linh_ngo_<godUlt>` node |
| Empowered ults | `PHAP_TU_EMPOWERED_ULTS` (`data/skill/PhapTuEmpoweredUlts.ts:142`) — Record<Element, {detonate, nuke}> | 10 TurnSkillDefinitions | Engine-side only, gated same as god-ults |
| Route skills | `PHAP_TU_ROUTE_SKILLS` (`data/skill/PhapTuRouteSkills.ts`) — `dan_hoa_quyet`, `xich_viem_xuyen_tam`, `phan_thien_hoa_vuc`, `cuu_tieu_viem_bao` | 4 (fire only) | **No unlock source exists** |
| Specialization variants | `specializations[]` on C and D chain skills | 20 (2 per C, 2 per D, ×5 elements) | C-tier specs: yes (free UI toggle, `SkillRoleStrip.vue:184-199`); D-tier: no (base skill unreachable) |
| Ngộ Đạo kit | `van_phap_tuy_tam`, `da_phap_lien_tuyen`, `ngo_dao_hon_don` (`CoreSkills.ts`) + `applyAnKitToBasic/Special` (`data/skill/TurnAnKitSkills.ts`) | 3 | Yes — granted at ritual via `skillIds` on the way |
| Mortal precursors | `tram`, `linh_bao` (offer-gate at cast-Lv3), `huy_quyen` (ung_the gate) | 3 | Yes |
| Realm passives | `PASSIVE_SKILLS` (`PassiveSkills.ts`) — `passive_linh_khi_cam_ung` … `passive_do_kiep_chi_tam` + extras | 11 | Via `CANONICAL_REALM_PASSIVE_LADDER` (9 realm→passive entries, `RealmPassiveLadder.ts`) |
| Talent passives | `TALENT_PASSIVE_SKILLS` | 12 | Path-agnostic |
| Skill cores | `SKILL_CORE_NODES` — auto-generated `core_<id>` per Skill with maxLevel>1 (`SkillCoreNodes.ts:79-81`) | covers all Pháp Tu skills | Nodes exist even for unreachable skills |

Totals: 5 roots + 20 chain + 5 god-ults + 10 empowered-ult payload defs + 4 route skills + 3 Ấn-kit + 3 mortal + 11 path passives + 12 talent passives + 20 specialization variants.

### (b) STUB / PLACEHOLDER (exact symbols)

- `passive_nguyen_anh_minh_triet` — `passiveModifiers: []` explicitly empty pending redesign (`PassiveSkills.ts:149-157`).
- `van_phap_tuy_tam` / `da_phap_lien_tuyen` — header comment "DATA SHELLS only… payloads below are placeholders" (`CoreSkills.ts:162-167, 219-222`); real semantics live in `TurnAnKitSkills.ts`.
- `PHAP_TU_ULTIMATE_IDS` + `PHAP_TU_ULTIMATE_PROFILES` (`PhapTuUltimates.ts:30` lines) — registry/profiles only; payload data lives in the chain file's god-ults.
- `PHAP_TU_AN_NODES: ProgressionNode[] = []` — empty by design, deferred to spec §5.3 (`data/progression/PhapTuAnNodes.ts:16`).
- Chain-skill authored fields the turn engine cannot execute (`collectUnsupportedSkillSemantics`, `core/skilldef/LegacySkillAdapter.ts:711-738`): `scope` on `van_moc_lan_doc` + 2 specs (`PhapTuChainSkills.ts:448,467,482`), `refresh` on `kim_chung_cong_huong` + specs (`:615,632,647`), `hitCount` folded comment on `bat_thu_can_quet` (`:869`).
- `SPELL_ROUTE_SKILL_IDS` — `water/wood/metal/earth: []` (`Skills.ts:40-46`) — declared "other elements fill in as authored".
- `dao_insight_art` — `gradeEffects` authored for grade 1 only (`data/technique/Techniques.ts`); no Trúc Cơ (grade-2) table for the hidden way.
- Realm passives beyond Trúc Cơ: `REALM_PASSIVES` has **2** entries total (`data/realm/RealmPassives.ts`) — `qi_refining` (NHẬP ĐẠO, includes spell-domain maxMp/manaRegenPerTurn) and `foundation_establishment` (KIẾN CƠ, main-stat % by grade). Enhanced variants `NHAP_DAO_ENHANCED_PERCENT`, `KIEN_CO_ENHANCED_MAIN_STAT_PERCENT` marked NON-CANONICAL pending balance.
- `BREAKTHROUGH_SCOPED_MATERIAL_IDS = []` (`data/breakthrough/BreakthroughScopedResources.ts`) — empty census; only `truc_co_dan` pill/recipe exists.
- `the_man_{fire,water,wood,metal,earth}` buffs (`data/buff/ThuanHeBuffs.ts`) — orphaned (only `buffs.test.ts` references).

### (c) MISSING ENTIRELY

- **B and D chain skills are unreachable**: 10 of 20 (`nam_minh_liet_hoa`, `chuc_dung_dan_no`; `bat_dau_tran_thuy`, `hoi_luu_thon_no`; `xuan_sanh_doc_duc`, `van_moc_lan_doc`; `thu_giap_kim_than`, `kim_chung_cong_huong`; `hau_tho_tran_ach`, `con_lon_chan_dia`). Not in `SPELL_KIT_IDS` (kit = A/C/E), and no node grants them — `unlocksSkillIds` appears only on element roots (basic) and `linh_ngo_<special>` (special+ultimate). Old spec promised "node chuỗi (Task 11, §1.7)" — that task layer was superseded by the 3-slot reimagine and the nodes were never authored.
- **Route skills unreachable**: `PHAP_TU_ROUTE_SKILLS` (4 fire skills) — in `ownedContent.skillIds` and route-factor scope, but no unlock channel grants them; kit slots are fixed at [basic, special, ultimate] so they could never occupy a slot anyway.
- **Route kits for water/wood/metal/earth** — 0 authored (fire only).
- **D-tier specialization unlock design** — `selectsSpecialization` engine path exists (`GameManagerProgressionOps.ts:320-323`) but no node authors it; UI allows free toggling instead — design intent (E-8 node-gated) vs current behavior mismatch.
- **`van_moc_lan_doc` poison-spread mechanic** — description says copy Trúng Độc from primary target to all enemies, but no authoring field exists (`spreadsAilmentId` referenced only in a stale comment, `SkillMechanicDescriptions.ts:7`); the spread payload is unimplemented in data.
- **No per-realm skill unlocks for Pháp Tu** — no requiredRealmId on skills, no skill reward tables per minor realm.
- **`scope`, `refresh`, `hitCount`, `realmDamageRatio`, `grantsZone`, `swordZone*`, `breakDamagePerHit`, `knockbackDistance` semantics** — authored on Pháp Tu skills but reported unsupported by the turn-engine adapter (warn-and-drop, `LegacySkillAdapter.ts:704-738`).

---

## 2. Hình ảnh (sprites / icons / VFX)

### (a) EXISTS

- Player combat sprite: `player-phap-tu-v1.png` — `public/assets/characters/player/phap-tu/player-phap-tu-v1.png`, bound via `PlayerVisualProfiles.ts` (`phap_tu` combat profile) and `CombatPresentationCatalogue.ts:114`. **Explicitly flagged placeholder** (`placeholderArtEntityKeys()` = `['player-phap-tu-v1']`, roadmap:877-879 — art debt ratcheted).
- Cultivate texture: falls back to mortal (`PlayerVisualProfiles.ts:214`).
- Generic VFX preset seam: `vfxPresetForSkill` = `skill.vfxPresetId ?? vfxPresetForElement(element)` (`core/battle/CombatAction.ts:164-198`); element→preset map: wood→`wood_spikes`, fire→`fire_burst`, water→`water_surge`, earth→`earth_shockwave`, metal→`metal_slash`, primordial→`shadow_burst`, default→`arcane_impact` (`data/vfx/CombatVfxPresets.ts`).
- Status/seal icons: `data/vfx/StatusVfxPresets.ts` — covers `hoa_an`, `doc_can`, `liet_thuong`, `han_tuc`, `tran_an`, reaction statuses, `van_phap_than_hoa` — all procedural shape/color placeholders ("Placeholder = hình học thuần; asset thật thay sau").
- Element UI icons + banners: `public/assets/ui/elements/` (used via `ElementLabels.ts`).
- Enemy roster: 20 mortal templates with textures (`core/game/support/EnemyArt.ts` `MORTAL_ENEMY_TEMPLATE_IDS`); 20 foundation enemies + 3-phase dragon boss authored in `data/enemy/FoundationEnemies.ts` with `elemental: {element, power}` identities (one authored `specialAttacks`: water_surge on `foundation_ferocious_flood_dragon_whelp` at :414).

### (b) STUB / PLACEHOLDER

- **0 authored per-skill VFX**: no `vfxPresetId` set anywhere under `data/` (grep empty) — every Pháp Tu skill renders via the generic element preset.
- **0 HUD display-meta entries** for chain/ult/route skills: `TURN_SKILL_DISPLAY_META` (`data/skill/TurnSkillDisplayMeta.ts`) covers roots + Ấn kit + other paths; the 20 chain skills, 5 god-ults, and 4 route skills have no display names/tooltips/icons for combat HUD (HUD reads meta — likely falls back to skill name).
- Status icons are geometric placeholders (above).
- `player-phap-tu-v1` is the named placeholder art target.
- 20 `foundation_*` enemies, tribulation enemies, companions render as Rectangle fallback (roadmap:2639).
- Technique icons: `data/technique/Techniques.ts` icon fields point into `public/assets/techniques/` — **that directory does not exist** → all 6 technique icons dead paths.
- Orphan art committed but unreferenced: `public/assets/characters/spell-cultivator/spell-cultivator.png`, `sword-cultivator.png` (commit 6a331415).
- `public/assets/vfx/spritesheets/` — ~1137 raw FX spritesheet files, **zero code references** (no manifest binds them).
- `public/assets/ui/skill/` — contains only `ink-go-board-19x19-v1.png` (unreferenced); **no Skill icon field exists** on `Skill`/`TurnSkillDefinition` at all.

### (c) MISSING ENTIRELY

- Per-skill icon system (no data field for it).
- Per-skill authored VFX channel (`vfxPresetId` field exists in code but no data consumer).
- Authored cult-state art for `phap_tu` (cultivation scene).
- Foundation/tribulation-tier enemy sprite sets.
- VFX for the Ấn-kit composite picks, multicast storm, reaction bursts, empowered-ult detonate/nuke (no distinct presets — they'd resolve through element map).
- Spawn/death/telegraph art bound to Pháp Tu-relevant enemies beyond the single water_surge special attack.

---

## 3. Đột phát / realm rewards for Pháp Tu

### (a) EXISTS

- **mortal → qi_refining** (Initiation Ritual, `chooseCultivationPath`, `CORE_REALM_LEVEL=12`, `core/realm/realmSystem.ts:43`): atomic (path, way) write; SPELL gets `five_elements_art` auto-equipped + starter `linh_bao` + element/commit deferred to `selectSpellPathElement`.
- **qi_refining → foundation_establishment** (Trúc Cơ Độ Kiếp, `TribulationDirector`): grade resolution `resolveKienCoGrade` → human/earth/heaven; `great_dao` reachable only via hidden lineage channel (`data/breakthrough/BreakthroughGrades.ts`); Trúc Cơ Đan as breakthrough-scoped pill; on success: realm passive `kien_co` main-stat % (human 0 / earth 0.05 / heaven 0.1 / great_dao 0.2) + `five_elements_art` grade-2 folded table (insightMultiplier 4 + tierEffects ladder).
- Realm passives shared ladder: `CANONICAL_REALM_PASSIVE_LADDER` (9 realm→passive entries, `data/progression/RealmPassiveLadder.ts`).
- Realm-entry stat passives: `REALM_PASSIVES` — `nhap_dao` (per-grade ×0.03 incl. spell-domain maxMp/manaRegen) + `kien_co` (above) — only these 2 authored.
- Domain gates reachable within Beta: none Pháp Tu-specific beyond the above.

### (b) STUB / PLACEHOLDER

- `REALM_PASSIVES` covers only qi_refining + foundation_establishment; the ladder references passives for later realms that exist in `PASSIVE_SKILLS` but Kim Đan+ realm passive STAT data is unauthored.
- `BREAKTHROUGH_SCOPED_MATERIAL_IDS = []` (empty census).
- Hidden-lineage `great_dao` channel exists (`TribulationDirector.breakthroughType`) but its Pháp Tu-specific reward table is not differentiated.
- Ngũ Hành Châu artifact: `unlockRealmId = 'golden_core'` (`core/artifact/ArtifactDomain.ts:15`) — **NOT obtainable in Beta** (doc claiming Trúc Cơ unlock is stale); milestone copy is description-only ("combat presentation chain removed (Mission G), runtime parked").

### (c) MISSING ENTIRELY

- **No Pháp Tu-specific breakthrough reward tables**: breakthroughs grant only shared realm passives + technique grade tables; no per-realm Pháp Tu unlocks (skills, slots, stances).
- **Every kit-power unlock is Kim Đan-gated** (`linh_ngo_<special>` `requiredRealmId 'golden_core'`, `PhapTuNodes.builders.ts:192-196`; `linh_ngo_<godUlt>` behind it + techniqueRank 5; `truong_the_*` realmRankGate golden_core) → in the playable window a Pháp Tu runs **basic skill only**; special/ultimate/The-spend/phap-tuong all dormant.
- Realm passives for golden_core+ — none authored.
- Technique `dao_insight_art` grade-2 (Trúc Cơ) table — absent; only grade 1.
- Breakthrough-scoped materials beyond `truc_co_dan` — none.

---

## 4. Mechanics / hooks (wired vs deferred)

| Mechanic | Status | Evidence |
|---|---|---|
| Element pick + route commit | **Wired** — atomic `selectSpellPathElement`, mutex root nodes, `phapTu.element/route` state + save validation | `GameManagerProgressionOps.ts:451-514` |
| Route profiles (dot/nu) | **Wired** — `PHAP_TU_ROUTES` directMultiplier/ailmentChanceFactor/stackBonus + 'dot' detonate/'no' nuke empowerment params; kit-scoped provider | `core/phap-tu/PhapTuRoutes.ts:24-137`, `GameManager.ts:582` |
| Route switching + respec refund | **Wired** — free switch out of combat; routeTag nodes auto-reset refunding 75% | spec 2026-09-14 P3; `selectsSpecialization`/route ops |
| The (Thế) pool | **Wired** — `SPELL_ESSENCE_GAIN_BASIC=5`, `_SPECIAL=15`, `critTheGain` on 'no' route (`SPELL_ESSENCE_GAIN_CRIT=3`), `SPELL_EMPOWERMENT_ESSENCE_THRESHOLD=100`, battle-scoped reset | `PhapTuRoutes.ts`, `CultivationPathRegistry.ts:131` |
| Empowered ult (phap-tuong) | **Authored, dormant above ceiling** — payload swap at ≥100 The with `linh_ngo_<godUlt>` owned; consumes all The; cast identity stays on chain-E slot | `PhapTuPath.ts` capability `spell.empowered_ult`, `CultivationPathRegistry.ts:429`, spec §3.3 |
| Reaction engine | **Wired** — `CANONICAL_REACTIONS` all 10 Wuxing pairs authored (`data/reaction/ReactionDefinitions.ts`, 216 lines); aura `van_phap_than_hoa` grants `elemental_reaction_enabled` party-wide | roadmap:2092 |
| Reaction aura capability | **Wired** — conditional `spell.reaction_aura` on `ngo_dao_hon_don` learned; binds `grantsElementalReactionAura` | `PhapTuPath.ts`, systems/cultivation-paths.md P1 note |
| Ấn kit multicast | **Wired** — `AN_MULTICAST_CHANCE=0.25`, `AN_SPECIAL_FIRES=3`, `MAX_MULTICAST` cap, compositePicks element-basic pool | `data/skill/TurnAnKitSkills.ts:63`, `PhapTuPath.ts:301` |
| Ấn offer gate | **Wired** — `linh_bao` cast-Lv3 (`HUY_KIEM`-style cast leveling, 10k casts) at ritual | `PhapTuPath.ts` offerGate/sealedOffer |
| Ấn node tree | **EMPTY stub** — `PHAP_TU_AN_NODES = []`, deferred to spec §5.3 | `data/progression/PhapTuAnNodes.ts` |
| Specialization engine | **Wired at UI level** — `SkillRoleStrip.vue` free toggle; `selectsSpecialization` node machinery exists but **0 nodes author it** (design said E-8 node-gated) | `GameManagerProgressionOps.ts:320-323` |
| `unlocksElement` / Element Loadout | **RETIRED by spec** — mono-element via `phapTu.element`; Ngũ Hành rotation must derive `[phapTu.element]` | spec 2026-09-14:513 |
| Thế-chain machinery (`ChainStateSystem`, `setChainDefinition`, link/finisher) | **RETIRED by spec** — 5-slot chain condensed to 3-kit; runtime machinery removed | spec 2026-09-14:514 |
| `the_man_*` ward buffs | **Orphaned data** — authored but only referenced by tests | `data/buff/ThuanHeBuffs.ts` |
| Pháp Bảo (artifact) combat | **Parked** — domain-locked golden_core, runtime removed Mission G | `ArtifactDomain.ts:15`, `NguHanhChau.ts` header |
| Unsupported effect fields on authored skills | **Reported-dropped** — see §1(c) | `LegacySkillAdapter.ts:704-738` |
| Element-branch `*Power` stats | **Wired** — `minor_<el>_intensity` +10lv w/ techniqueRank gates | `PhapTuNodes.builders.ts:141-155` |
| Technique-rank gates | **Wired** — rank ceiling = realmLevel (`TechniqueProgression.ts:89`) | — |
| Realm stat-passives sync | **Wired** — `syncRealmPassive`/`syncRealmStatPassive` on every breakthrough | `BreakthroughOutcomeService.ts`, `GameManagerRealmAdvanceOps.ts:572` |

Deferred-by-design (documented): Ấn tree (§5.3), elemental-seal specs for water/wood/metal/earth (only `hoa_an` spec exists — `docs/specs/2026-09-17-hoa-an-ailment-system-spec.md`), route kits for 4 elements, Kim Đan+ content.

---

## 5. Design-doc coverage (`game/docs/`)

### Authoritative / active

| Doc | What it pins down |
|---|---|
| `docs/superpowers/specs/2026-09-14-phap-tu-reimagined-design.md` (693 lines) | **Primary spec.** P1-P15 rulings: 3-slot kit, 2 routes, The loop + phap-tuong consume contract (P5/P13, THE_ULT_THRESHOLD=100), route respec 75% refund (P3), Ấn way as separate permanent path with fixed kit (P6, §5.3 defers its node tree), retirement list (Element Loadout, chain machinery, reaction_path kit) §"Supersession", INV-11/13/14/16/18/21 invariants |
| `docs/specs/2026-09-17-hoa-an-ailment-system-spec.md` (1816 lines) | Ailment authority for Hỏa (sections 62/74 pin the 4 route-skill semantics + balance draft; D1 ruling: ailments = canonical `BuffSystem` `kind:'ailment'` `per_source` buffs; `bong→hoa_an` destructive migration). Template for the other 4 element-seal specs |
| `docs/superpowers/plans/2026-09-19-megaplan-canonical-seals-ngo-dao-reaction-v2.md` | Canonical seals + Ngộ Đạo reaction activation batch rulings |
| `docs/specs/2026-09-23-hidden-perfection-lineage-master-spec.md` | Hidden breakthrough (great_dao) channel |
| `docs/balance/2026-09-23-three-path-baseline.md` | Live balance baseline: `phap_tu_ngu_hanh` + `phap_tu_ngo_dao` measured over 8-seed × 5-benchmark harness; attrition is the Pháp Tu weak cell (13% ngu_hanh win) — balance constraints |
| `docs/skill-constellation-glyph-plan.md` | Node Tree presentation: Pháp Tu branches render as 火木水金土 glyph constellations; node-count budget per branch (10-11) is a presentation constraint |
| `docs/systems/{skills,cultivation-paths,node-tree,elements-reactions,techniques}.md` | System contracts; **note staleness** — cultivation-paths.md body predates P1 ways model (header warns); skills.md still lists `TurnReactionPathSkills`/`SkillRuntimeStats` (deleted) |
| `docs/phap-tu-profile.md` | Frozen 2026-09-02 state snapshot — **stale** relative to Reimagined (describes pre-route legacy tree, hoaThe/thuyThe resources removed) |
| `docs/roadmap.md` | Chapter state; `placeholderArtEntityKeys` debt ratchet for phap_tu art |
| QA reports | `docs/qa/*phap-tu*` + `docs/qa/2026-09-03-phap-tu-thuan-he-*` — prior QA gates + open defects (QA-001 unequip, QA-004 bar Thế, deferred ult-button Task 14) |

### Design-doc gaps (nothing written)

- No spec for the 4 non-fire element seals (doc_can/liet_thuong/han_tuc/tran_an have data but no authored spec docs).
- No spec for route kits beyond fire (`SPELL_ROUTE_SKILL_IDS` empty for 4 elements).
- No spec for B/D chain-skill unlocks (the "node chuỗi" layer was named in comments `PhapTuChainSkills.ts:14` but the spec that defined it — `newPhapTuDesignSpec.md` §0.b, `2026-09-03-phap-tu-thuan-he` plan — is **not present in the repo**; only QA reports reference it).
- No design for per-realm Pháp Tu unlock/reward tables (breakthrough grants are all shared/path-agnostic).
- No VFX/icon asset manifest design (skills have no icon field; spritesheet library unbound).
- Ấn way node tree spec (§5.3 explicitly deferred).
- Kim Đan+ realm passives unauthored.
- `docs/systems/skills.md` and `cultivation-paths.md` bodies are stale relative to the reimagine — authoritative header notes exist but body text describes retired systems (turn reaction path, SkillRuntimeStats resources, Element Loadout).

---

## Constraints / authority files a designer must respect

1. **Kit = exactly 3 slots** `[basic, special, ultimate]` per element — `data/skill/Skills.ts:24-30`; runtime resolves those only (`CultivationPathRegistry.ts:405-448`). New skills need a slot story (replace/empowerment variant) or they're dead data.
2. **Unlocks flow through `unlocksSkillIds` on nodes** (`NodeEffect`) — only element roots + `linh_ngo_<special>` use it today.
3. **Realm gates**: Beta ceiling `foundation_establishment` (`ReleasePolicy.ts:42`); current unlock nodes deliberately target `golden_core`.
4. **Spec authority**: `2026-09-14-phap-tu-reimagined-design.md` is the current-law spec; comments citing "spec 2026-09-03 §x" refer to the superseded Thuần Hệ spec (not in repo).
5. **Effect authoring surface**: `SkillEffect` fields the turn engine can execute = `damage`/`debuff`/`buff`/`add_stack` + `consumesAilmentId/damagePerStack`, `consumesAilmentScope`, `scalesWithAilmentStacks`, `ailmentInteractions`, `healPercentOfDamage`, `consumesWardForDamage`, `manaScalingRatio`, `attributeScaling`, `components`, `targeting`. Everything else (`hitCount`, `scope`, `refresh`, `grantsZone`, `realmDamageRatio`, `skillExperienceRatio`, `breakDamagePerHit`, `knockbackDistance`, non-`onCast` triggers) is warn-and-drop (`LegacySkillAdapter.ts:704-769`).
6. **Ailment channel**: canonical seals `hoa_an/doc_can/liet_thuong/han_tuc/tran_an` via `BuffSystem` per-source instances (D1 ruling) — author through `ailmentInteractions`/`consumesAilment*`, never new fields.
7. **Capability model**: downstream systems read `hasPathCapability` — `spell.elemental_casting`, `spell.essence_pool`, `spell.empowered_ult`, `spell.reaction_aura` (`PhapTuPath.ts:268-374`); new mechanics bind capabilities, not skill-id checks.
8. **The economy**: `THE_ULT_THRESHOLD=100` constant, consume-all contract, battle-scoped reset, no persistence (spec P5/P13, INV-14/16).
9. **Cores**: every Skill with maxLevel>1 auto-owns `core_<id>` node (`SkillCoreNodes.ts:79`) — leveling a skill is free-standing of ownership; design must decide if cores for unreachable skills should be hidden.
10. **Glyph layout budget**: node tree renders as Chinese-character constellations; branch node count changes need glyph-slot care (`skill-constellation-glyph-plan.md`).
11. **Naming/i18n**: data files carry inline Vietnamese name/description (no locale indirection for skill data); P16 applies to UI chrome.
12. **Balance evidence**: `docs/balance/2026-09-23-three-path-baseline.md` harness recipes `phap_tu_ngu_hanh`/`phap_tu_ngo_dao` are the regression baseline for power changes.
