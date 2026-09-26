# KIẾM TU Design-Inventory — beta/rc @ 48fda66a

Read-only audit. All paths `game/src/`-relative under repo root unless noted.
Branch `beta/rc` worktree `.agent-worktrees/kiem-tu-audit`.

## Model map (ground truth)

- Path id `'sword'`; ways `'sword_pathway'` (hiện, Kiếm Phổ preset-combo orbs) +
  `'hidden_sword_pathway'` (ẩn, Ngự Kiếm Đạo phi-kiếm economy).
- Discriminator `player.cultivationWay`; canonical slice `player.swordPath:
  SwordPathState{preset: OrbId[], kiemY, kiemDaoCount, kiemDaoBase}`.
- **`huy_kiem` resolution:** the id `huy_kiem` never existed. Skill id `tram`
  carries name 'Huy Kiếm' (`data/skill/CoreSkills.ts:14-59`,
  `data/skill/TurnBasicAttacks.ts:17-22` `SWORD_BASIC`, display meta
  `TurnSkillDisplayMeta.ts:48`). Documented at
  `docs/specs/beta-creation-spec.md:94` — "`tram` IS Huy Kiếm". Its cast-leveled
  Lv3 (10 000 casts, `core/skill/CastLeveling.ts:16`) gates
  `hidden_sword_pathway` via `offerGate.requiresSkillLevel` reading the
  `core_tram` node mirror (`core/kiem-tu/KiemTuPath.ts:234`,
  `core/player/CultivationPathKit.ts:470-486`).

## (a) EXISTS — authored and wired

### 1. Skills / defs

| Content | Count | Location | Notes |
|---|---|---|---|
| `KIEM_PHO_ORBS` | 5 orbs | `data/skill/KiemPhoOrbs.ts:34-74` | orb_dam Đâm ×1.0; orb_chem Chém ×1.2 + `kiem_thuong`; orb_bo Bổ ×1.8 + `suy_nhuoc`; orb_hat Hất ×0.6 + `choang` 20%; orb_quet Quét ×0.8 + all-lanes. All `kind:'physical'`, `cooldownTurns:0`, `levelScaling:0.05`. |
| `ORB_UNLOCK_REALM` | 5 gates | `KiemPhoOrbs.ts` | dam@1 qi_refining, chem@2 foundation, bo@3 golden_core, hat@4 nascent_soul, quet@5 soul_transformation |
| `KIEM_PHO_COMBOS` | **37** (15 len3 + 12 len4 + 10 len5) | `data/skill/KiemPhoCombos.ts:44-87` | tier mults L3=2.5 / L4=4.0 / L5=7.0; `presetId:'kiem_combo_'+id`; **effects STUB** — see (b) |
| `NGU_KIEM_THUAT` | 1 action | `data/skill/NguKiemDaoSkills.ts:16-22` | base shape only; live mult/count injected by provider |
| Emblem defs | 2 | `NguKiemDaoSkills.ts:24-38` | `TU_KIEM_Y_EMBLEM`, `KIEM_DAO_CASCADE_EMBLEM` — `emblemOnly:true` HUD markers, never castable (`TurnSkillAction.ts:570`) |
| `tram` 'Huy Kiếm' | 1 | `CoreSkills.ts:14-59` | physical ×1, `execution:attack_speed`, maxLevel 3, cast-leveled |
| `passive_kiem_tam_lanh_liet` | 1 | `CoreSkills.ts:601-644` | sword_pathway initiation passive (crit → +1% critDmg/stack, max 30) |
| `talent_passive_kiem_quang` | 1 | `TalentPassives.ts:59-66` | talent `kiem_quang` (`data/talent/Talents.ts:19-25`) — creation talent, NOT path-locked; converts to `kiem_vuc` |
| `kiem_thuong` ailment | 1 | `data/buff/KiemPhoBuffs.ts:4-36` | physical DoT coefficient 0.25, maxStacks 3, 4 holder_turns |
| `kiem_vuc` buff | 1 | `data/buff/TalentBuffs.ts:14-24` | critRate flat 1, 8 holder_turns |
| Native core nodes | 6 | `data/progression/SkillCoreNodes.ts:42-63` | orbs+ngu in `NATIVE_CORE_SKILL_IDS`, maxLevel 10 damage-bearing |
| Display meta | 9 | `data/skill/TurnSkillDisplayMeta.ts:311-345` | 5 orbs + tram + 3 ngu ids; **37 combos deliberately absent** (K11/INV-7) |
| Techniques | 2 | `data/technique/Techniques.ts:87-134` | `sword_control_art` (hien), `myriad_swords_art` (ẩn) — regen-only gradeEffects |
| Realm coverage | — | — | Orbs/unlocks authored to r=5 (soul_transformation); combos need r≥6 for len5 |

### 2. Node trees — `data/progression/KiemTuNodes.ts` (383 lines)

| Group | Count | Scope | Details |
|---|---|---|---|
| `ORB_BRANCHES` | 30 (5 branches × 5 growth + 1 capstone) | `requiredWay:'sword_pathway'`, `branchTag:'kiem_pho'`, `requiredCultivationPath:'sword'` | Growth = GENERIC stats (might/skillDmg/ailment/crit/pierce — shared pool is **intentional** per ruling 2026-09-16); capstones carry `effect.swordPathComboModifier` (minOrbCount + bonusDamageMultiplier / appliesBuff) |
| `NGU_CASCADE_NODES` | 3 | `requiredWay:'hidden_sword_pathway'`, `branchTag:'ngu_kiem'` | `cascadeUnlock` a@foundation, e@golden_core, d@nascent_soul |
| `NGU_GROWTH_NODES` | 3 | same | `levelGates techniqueRank 4 @L5` |
| `CUU_CUNG_OUTER` + `cuu_cung_trung` | 8 + 1 | same | `kiemYGrant` 5000→31000 realm-gated qi_refining→mahayana; center +1 `kiemDaoGrant`, requires all 8 + `kiemDaoBelowCap` |

NodeEffect primitives exist in `core/progression/ProgressionNode.ts:41,93-115`
(`kiemYGrant`, `kiemDaoGrant`, `cascadeUnlock`, `swordPathComboModifier`,
`kiemDaoBelowCap` prereq — evaluated `NodeSystem.ts:105`).

### 3. Mechanics — wired

| Mechanic | Evidence | State |
|---|---|---|
| Orb system | `core/kiem-tu/KiemPhoSystem.ts` — validatePreset (1-9, realm-unlocked), initKiemPhoBattle, nextOrb cursor | **Wired** |
| Combo matcher | `KiemPhoSystem.recordCastAndMatch` — tail-match longest-first, log cap 5, one fire/cast, `realmComboMax` (r<3→3, r3-5→4, r≥6→5) | **Wired** |
| Combo→extra hit | `KiemPhoProvider.ts` `onCastResolved → comboToExtraDef`, `progressionOwnerId = triggering orb` | **Wired** |
| Combo modifiers | `KiemPhoNodeModifiers.ts` — minOrbCount match, bonusDamageMultiplier, appliesBuff stack-merge | **Wired** |
| Phi-kiếm economy | `NguKiemDao.ts` — `forgeCost(r)=ceil(9999·1.3^(r-1))`, `kiemDaoCap=r+1`, MERGE_BONUS 0.3, `applyBreakthroughMerge` | **Wired** |
| Cascade rolls | `NguKiemDaoProvider.ts` — guaranteedHit + per-instance a/e/d rolls, injected rng; +1 kiemY/cast | **Wired** |
| Provider plumbing | `CultivationPathRegistry.ts:358-381` `buildDynamicBasic` per way + `emblemSlots` (hidden) → `GameManagerTurnBattleOps.ts:2011-2013` | **Wired** |
| Realm transition | `GameManagerRealmAdvanceOps.ts:157-165` `applySwordPathRealmTransition` → merge on `sword.sword_riding` capability | **Wired** |
| Entry gate | `KiemTuPath.ts:234` `offerGate:{requiresSkillLevel:{tram,3}}` — live eval `CultivationPathKit.ts:470-486`; ineligible ways hidden from offers (`QuanKhiPanel.vue:62-63`) | **Wired** (ritual-only; no mid-game flip) |
| Precursor lock | INV-KT-15 (QA ledger): equip gate + unequip at choice + authored-basic resolver | **Wired** |
| Preset editor | `QuanKhiPanel.vue:163-327` — direct `setKiemPhoPreset` writes, realm-gated palette, battle-lock, i18n | **Wired** |
| HUD bar | `kiemBarBridge.ts` — KIEM_BAR_READER_KEY; kiem_pho mode (strip+cursor+next+log) / ngu mode (Ý/forgeCost/count/base) | **Wired** |
| Basic slot | `TurnCombatSkillBar.vue` — `hasDynamicBasic`/`chooseDynamicBasic` orb picker owns basic | **Wired** |
| Invariants | `core/kiem-tu/invariants.test.ts` — INV-KT-1..15, 24 tests (QA ledger) | Pinned |
| `huy_kiem` flat scaling | `SkillSystem.ts:35` `getHuyKiemFlatDamageBonus` +1 flat/10 casts uncapped | **Wired** |

### 4. Realm/đột phát rewards for a Kiếm Tu player

| Item | Content | Location |
|---|---|---|
| Realm-entry passives | `composeRealmRewards()` — **generic ladder only, zero overrides** on both ways (`KiemTuPath.ts:206,230`) | `data/progression/RealmPassiveLadder.ts` (9 passives, all paths identical) |
| Sword-scoped realm progression | orb unlocks (hien), `realmComboMax` raise (hien), `kiemDaoCap` raise + breakthrough merge (ngu), Cửu Cung node realm gates (ngu) | `KiemPhoOrbs.ts`, `KiemPhoSystem.ts`, `NguKiemDao.ts`, `KiemTuNodes.ts` |
| Foundation grades | `resolveKienCoGrade` — path-agnostic | `data/breakthrough/BreakthroughGrades.ts` |

### 5. VFX / imagery

| Asset | State |
|---|---|
| `kiem_combo_*` presets ×37 | `data/vfx/CombatVfxPresets.ts` — tier-scaled procedural (len3 hybrid 1.15/280ms; len4 1.3/330ms; len5 screen 1.5/400ms + shake 140ms/0.005), golden-angle distinct colors. Authored *procedurally* — all Graphics primitives, no sprite textures (`ActionImpactVfx.ts` renders fillPoints/strokeEllipse only) |
| `slash` preset | shared generic — used by ALL 5 orbs + `ngu_kiem_thuat` |
| Technique icons | declared paths (`ngu_kiem.png`, `van_kiem_quyet.png`) — **dangling**; no `public/assets/techniques/` dir exists (all paths affected) |
| Kiem-tu player art | **4 authored PNGs exist on disk**: `public/assets/characters/player/kiem-tu/player-kiem-tu-seven-swords-concept-v5.png`, `-one-sword-black-white-concept-v2/v3`, `-equipment-set-04-no-guan-concept-v2`; plus `characters/sword-cultivator/sword-cultivator.png`. **Zero references in `game/src`** |
| VFX concept art | `public/assets/vfx/kiem-tu/yin-yang-dragon-sword-vfx-concept-v3.png` — referenced only by QA manifests, never loaded |
| Spritesheet library | 568 files under `public/assets/vfx/spritesheets/` (Slash_7.png etc.) — **unused by impact VFX** |
| Equipment art | `base_kiem` weapon family (5 PNGs) + drop tables — shared/generic, not path-locked |
| `metal_slash` preset | exists (elemental system), unused by sword |

## (b) STUB / PLACEHOLDER

| # | Item | Location | Status |
|---|---|---|---|
| 1 | **37 combo effects = STUB** | `KiemPhoCombos.ts` header: "Effects: STUB — spec §11 (user ruling 2026-09-15) defers authored combo effects to a separate content pass" | Every combo carries only `{damage:{multiplier}}` — no appliesBuffs/targeting/unique kit. Differentiation = name + mult tier only |
| 2 | All orbs `presetId:'slash'` | `KiemPhoOrbs.ts` comment "every orb uses the generic 'slash' preset for now" | No per-orb VFX |
| 3 | `ngu_kiem_thuat` `presetId:'slash'` | `NguKiemDaoSkills.ts:21` | Same generic |
| 4 | Player visual `kiem_tu` = mortal fallback | `PlayerVisualProfiles.ts:140-161` comment "Chưa có art riêng" | **Stale comment** — authored PNGs now exist on disk (a5), still unbound; `CombatPreload.ts:70,142` reuses Mortal art |
| 5 | No `kiem_thuong` / `kiem_vuc` entries | `data/vfx/StatusVfxPresets.ts` — falls to regex/polarity fallback | Signature ailment has no status icon |
| 6 | Technique icons | `Techniques.ts:91,122` paths → nonexistent files | All technique icons dangling (not sword-specific) |
| 7 | Technique gradeEffects = regen only | `Techniques.ts:99-107,124-132` — hpRegenFlat/mpRegenFlat only | Spec-suggested Kiếm Ý gain / cascade-rate tiers NOT authored |
| 8 | Realms ≥ golden_core = placeholder data | `data/realms/realm.ts` comment "các cảnh giới từ Kim Đan trở đi mới là dữ liệu giữ chỗ" | Orbs Bổ/Hất/Quét, len4/5 combos, cascade e/d, Cuu Cung r≥3 nodes all live beyond authored content |
| 9 | `van_kiem_vu` buff = orphan | `data/buff/LegacyBuffs.ts:314-337` + its StatusVfxPresets icon | Zero production consumers (kiem_tran on-hit consumer retired); def+icon remain |
| 10 | `passive_thai_hu_kiem_y` = orphan | `PassiveSkills.ts:412-456` comment "nothing grants this passive today (orphan catalog entry)" | Retired technique innate kept as catalog data |
| 11 | `hidden_sword_pathway` lacks `sealedOffer` | `KiemTuPath.ts:225-245` (no field) vs `QuanKhiPanel.vue:236` sealed card for `hidden_spell_pathway` | Ẩn entry renders as plain button + generic confirm (`confirmPathBody`); no hidden-flavored permanent-warning card |
| 12 | First-pass balance values | Bổ→`suy_nhuoc` (spec: simplest defense-down), Hất stun 0.2 (spec first-pass 15-25%), forge pacing ~2.43M Ý ideal curve, Roll-2 node-level scaling "content decision" | All spec §11 deferred — parked deliberately |
| 13 | Emblem defs carry display meta only | `NguKiemDaoSkills.ts:24-38`, `TurnSkillDisplayMeta.ts:334-345` | Name-only HUD markers; no emblem icon/art |
| 14 | `tu_luc` preset | `CombatVfxPresets.ts` — legacy Bạt Kiếm channel art "thay sau" | Parked VFX for removed mechanic (replaced by `chargingTurnsRemaining` Bạt Kiếm or dead) |

## (c) MISSING ENTIRELY

| # | Gap | Evidence |
|---|---|---|
| 1 | **Authored combo effects (the 37-combo kit)** — the path's primary fantasy (ruling 2026-09-16). 37 names × damage tiers exist; zero unique mechanics. No spec file for the deferred effects pass exists yet | spec §11; `KiemPhoCombos.ts` |
| 2 | **Sword-specific realm rewards** — no `artifactId` (Phap Tu gets `ngu_hanh_chau`, `PhapTuPath.ts:259`; neither sword way declares one), no sword realm-passive overrides (`composeRealmRewards()` bare on both ways), no sword breakthrough stat flavor | `KiemTuPath.ts:206,230` |
| 3 | **Sword-themed enemies/encounters** — zero sword-path enemies; `data/enemy/` has no kiem-tu-authored set | grep `data/enemy/` |
| 4 | **Sword quests** — zero sword-path quest lines | grep `data/quest/` empty |
| 5 | **Specialization skills** — infra exists, zero Kiếm Tu specialization-authored skills | kiem-tu-profile §1.5 + scan |
| 6 | **Elemental flavor on orbs** — all 5 orbs `kind:'physical'`; metal channel unused (metal is phap-tu domain) | `KiemPhoOrbs.ts` |
| 7 | **Combo discovery UI/telemetry** — deliberate per K11/INV-7 (no-name rule); catalog reachable only via playtesting | spec §10-11 |
| 8 | **Per-orb authored VFX** — all 5 orbs + ngu def on generic `slash` | (b2) |
| 9 | **Status icons for signature buffs** — `kiem_thuong`, `kiem_vuc` absent from STATUS_PRESETS | `StatusVfxPresets.ts` |
| 10 | **Technique combat mechanics** — no Kiếm Ý-gain/cascade grade tiers on sword techniques | `Techniques.ts:87-134` |
| 11 | **Sealed-card warning for hidden_sword_pathway** — no `sealedOffer` field on the way | `KiemTuPath.ts:225-245` vs `QuanKhiPanel.vue:236` |
| 12 | **Emblem slot art** — emblemOnly defs render as name-only text slots; no icon/badge markup for ngu emblems (only `isAnPath` reaction-aura emblem markup exists in `TurnCombatSkillBar.vue`) | component scan |
| 13 | **Wired authored player art** — 5 kiem-tu PNGs on disk, 0 references | (a5) |
| 14 | **Content-scope reality** — playable product ends at Trúc Cơ (r=2): **2 orbs (Đâm, Chém), 6/37 combos reachable**, 1/3 cascade nodes (a only), 2/9 Cửu Cung nodes. Everything beyond is authored-but-unreachable | reachability computation below |

### Combo reachability per realm (computed from `ORB_UNLOCK_REALM` × `realmComboMax`)

| Realm (index) | Orbs unlocked | Max len | Combos reachable |
|---|---|---|---|
| qi_refining (1) | D | 3 | **1** (tam_thich) |
| foundation (2) | D,C | 3 | **6** |
| golden_core (3) | D,C,B | 4 | **14** |
| nascent_soul (4) | D,C,B,H | 4 | **22** |
| soul_transformation (5) | all 5 | 4 | **27** |
| void_refinement+ (≥6) | all 5 | 5 | **37** (all) |

## (d) Constraints / authority files

| File | Authority it exerts |
|---|---|
| `docs/superpowers/specs/2026-09-15-kiem-tu-reimagined-design.md` | **Design authority.** K1-K20 locked decisions; §3 orb table (5 orbs, fixed unlock realms/mults/ailments); §4.3 the 37-combo pattern table is FIXED (suffix-free; 3 corrected len4 patterns end H/Q — new combos need spec amendment); §5 Ngu kit shape (1 active + 2 emblems); §5.3 economy constants; §6 node-tree layout; §7 kill list (all executed — only comments remain); §10 invariants; §11 deferred list |
| `docs/specs/2026-09-16-cultivation-path-framework-spec.md` | **Structural authority.** (path, way) canonical pair; ẩn = ritual-time offer only, `offerGate {tram, Lv3}`, free entry, hien→ngu mid-game conversion permanently removed; per-path NodeEffect fields accepted (`kiemYGrant`/`kiemDaoGrant`/`cascadeUnlock`/`swordPathComboModifier`); way owns `subpaths.preset` |
| `docs/specs/beta-creation-spec.md` §1e | `tram` IS the 'Huy Kiếm' creation pick — no `huy_kiem` id ever to be introduced |
| `docs/roadmap.md` B6 (lines 2247-2366) | Ruling 2026-09-16: generic-stat orb branches are INTENTIONAL (combo discovery = primary fantasy); residual debt = (a) presentation honesty of branch descriptions, (b) rate-shopping (Bổ strictly best-rate), (c) `effect.kiemTuOrbModifier{orb,...}` as the cheap seam for future orb-scoped authored effects |
| `core/kiem-tu/invariants.test.ts` | INV-KT-1..15 pinned: provider separation, preset bounds, one-fire/cast, suffix-free data guard, additive combo hit, realm tiers, no-combo-import-in-presentation, conversion atomicity (now ritual), cascade RNG call-count bound, economy conservation, base monotonicity, dead-id scan, manual=auto determinism, no `currentThe` under kiem-tu, precursor lock |
| `SkillCoreNodes.ts:21-27` | `levelsSkillId` must never target emblem/combo/sub-actions — combo extras inherit parent's core via `progressionOwnerId`; whitelist edits require eligibility note + census test update |
| `docs/systems/*.md` drift | `cultivation-paths.md` body still documents retired Bạt Kiếm/Kiếm Trận routes + old `kiem_tu`/`mode` vocab and `kiem_tu.kiem_pho` capability names (actual: `sword.sword_scroll`/`sword.sword_riding`); `node-tree.md:44` describes retired `kiem_tran`/`bat_kiem` branches; `skills.md:33` mentions dead `swordIntentDamageRatio`. **Stale — do not treat as authority for current authoring.** `kiem-tu-profile.md` is a 2026-09-02 pre-rework snapshot (historical only) |
| `AGENTS.md` + `tutienidle-skill-design` skill | Gate for any new `data/skill`/`data/progression` entry or SkillEffect/ProgressionNode type extension |
| `docs/qa/2026-09-15-kiem-tu-reimagined-quick.md` | Ship-time verdict PASS WITH GAPS; browser-drive evidence of preset editor, orb picker, combo presetId events, ngu emblem slots, Kiếm Ý bank |

## Bottom line

The Kiếm Tu machinery (orb economy, combo matcher, cascade rolls, Cửu Cung,
preset editor, HUD bridges, precursor/way gates) is fully wired and invariant-
pinned. The **content layer is scaffolded, not authored**: 37 named combos with
a single differentiator (damage tier), orbs sharing one generic VFX preset, no
sword-specific realm rewards/artifact/quest/enemy/flavor pass, and 5 authored
player-art PNGs sitting unbound on disk while the profile renders mortal
fallback. Within the current Trúc Cơ content scope a hien player experiences
2 orbs and 6 combos; the remaining 31 combos, 3 orbs, 2 cascade unlocks, and 7
Cửu Cung nodes are data behind placeholder realms.
