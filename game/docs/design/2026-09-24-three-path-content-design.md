# Three-Path Content Design — Beta Window (Pháp Tu / Kiếm Tu / Thể Tu)

Status: DESIGN DRAFT (synthesis of 3 path inventories gathered 2026-09-24 on `beta/rc` tip 48fda66a / master be1bdf8d) — **user rulings 2026-09-24 applied**: Pháp Tu scope locked to §0-R below.
Scope: every content dimension a player touches — skills, hình ảnh (sprites/icons/VFX), đột phát/realm rewards, mechanics hooks — for the three cultivation paths inside the playable window.
Authority model: this doc is a DESIGN layer. It names what to author and where it lands; all balance-flagged numbers (§BETA-BALANCE boundary) remain user-held.

---

## §0. The window problem (headline)

Release ceiling is Trúc Cơ (`core/realm/ReleasePolicy.ts:42`, `progressionCeilingRealmId='foundation_establishment'`). Measured against it, the three paths have wildly different *in-window* depth:

| Path | In-window experience | What's authored but unreachable |
|---|---|---|
| Pháp Tu (hiển) | **basic skill only** — kit `[basic, special, ultimate]` where special/ultimate are Kim Đan-gated (`linh_ngo_*` `requiredRealmId 'golden_core'`) | 10 B/D chain skills, 4 route skills, 5 god-ults, 10 empowered-ult payloads, all element-branch power nodes |
| Pháp Tu Ẩn (Ngộ Đạo) | 3-slot kit wired (multicast, reaction aura) | `PHAP_TU_AN_NODES = []` — whole node tree |
| Kiếm Tu (hiển) | 2 orbs (Đâm, Chém) + **6/37 combos** | 3 orbs, 31 combos, 2 cascade nodes, 7 Cửu Cung nodes, all len≥4 |
| Kiếm Tu Ẩn (Ngự Kiếm Đạo) | 1/3 cascade nodes | cascade e/d, most Cửu Cung |
| Thể Tu (both ways) | **most complete**: 12 skills + 12 buffs + 40 nodes + all 3 hidden bodies | deferred channels only (§6) |

Two design stances follow. (A) **Window re-gating** decisions — which authored content moves into the Trúc Cơ window — are USER RULINGS collected in §9. (B) Everything else is authored content this doc specifies.

---

## §1. Pháp Tu — content design

### 1.1 The unreachable-skill problem (design decision D-PT-1 — **SUPERSEDED by ruling R3**)

`SPELL_KIT_IDS` fixes the kit at `[basic(A), special(C), ultimate(E)]`. Ten B/D chain skills and 4 route skills exist with no unlock channel and no slot. Ruling R3 (user, 2026-09-24): **leave them** — authored-but-unreachable is accepted; no alternates layer is built in beta. Recorded for context only.

<details><summary>Rejected design (re-bin as C-slot alternates)</summary>

- The 3-slot kit stays. B/D skills become **alternate choices for the C (special) slot**, unlocked by new `unlocksSkillIds` nodes on each element branch within the beta window:
  - B-tier alternates (`nam_minh_liet_hoa`, `bat_dau_tran_thuy`, `xuan_sanh_doc_duc`, `thu_giap_kim_than`, `hau_tho_tran_ach`) unlock at a **Luyện Khí-tier node** on the element branch.
  - D-tier alternates (`chuc_dung_dan_no`, `hoi_luu_thon_no`, `van_moc_lan_doc`, `kim_chung_cong_huong`, `con_lon_chan_dia`) unlock at a **Trúc Cơ-tier node**.
  - Loadout rule: special slot accepts any unlocked C-tier-or-alternate; UI swap via existing `SkillRoleStrip` pattern. Default remains the authored C skill.
- Route skills (`dan_hoa_quyet` …, fire only): become **route-locked C-slot alternates** — selectable only while that route is committed; switching routes clears the pick (respec path already refunds).
- D-tier specialization unlocks: author nodes that use the existing `selectsSpecialization` `NodeEffect` (engine path exists at `GameManagerProgressionOps.ts:320-323`, zero nodes use it); remove the free UI toggle for gated specs — UI shows unlocked options only.

</details>

### 1.2 New content — scoped by rulings

In-beta scope (per §9 rulings):

| Item | Lands | Notes |
|---|---|---|
| Basic-path node tree design | element branches `PhapTuNodes` | **The design focus of this round** — see §1.2a |
| Node-tree honesty | progression UI | Nodes `requiredRealmId` above ceiling render dimmed + "khóa Kim Đan" instead of purchasable-looking |
| `van_moc_lan_doc` description | `SkillMechanicDescriptions.ts` | Strip the spread claim (mechanic never existed; skill unreachable anyway — text must not lie) |
| Presentation layer | §5 | display meta for reachable skills, per-skill VFX, icons, player art, technique icons dir |
| Breakthrough rewards | §4-b | brainstorm pass (user direction) |

Deferred by ruling (recorded, not authored this round): route kits for 4 elements; Ẩn node tree (`PHAP_TU_AN_NODES`); `dao_insight_art` grade-2; Kim Đan+ realm passives; specialization-unlock nodes; `spreads_ailment`/`scope`/`refresh`/`hitCount` etc. unsupported-field bindings (decision table deferred with the skills they ride on).

### 1.2a Basic-path node tree — the design focus

The Pháp Tu beta experience = basic skill + element branch of the node tree. What the basic branch must deliver (to be authored):

- **Identity per element**: each of the 5 element roots already grants its basic; the branch below it must make the same basic *feel different* per element — node effects that read the element's own mechanics (Hỏa: đốt/stack rider; Thủy: heal/slow rider; Mộc: độc spread depth — data-only flavors; Kim: pierce/crit; Thổ: ward/DR).
- **Depth ladder within the window**: nodes must span qi_refining → foundation_establishment gates only; a node a player cannot buy in-window does not exist for beta (they render dimmed per §1.2 honesty rule).
- **The-economy tease without the spend**: The pool is wired (`SPELL_ESSENCE_GAIN_*`); basic-branch nodes may grant The-generation or The-capacity riders so the bar matters before the spend unlocks (spend stays Kim Đan per R1).
- **Element seal prep**: `hoa_an` is the only authored elemental-seal spec — basic nodes may surface seal-adjacent riders only where the buff already exists in data (`hoa_an`/`doc_can`/`liet_thuong`/`han_tuc`/`tran_an` all have `StatusVfxPresets` entries).
- **Budget**: ~10-11 nodes per element branch (glyph-plan constraint); **shape is asymmetric per element — the tree takes the shape of the element's glyph** (火/水/木/金/土), ruling 2026-09-24 #2.

**Ruled design contract (user rulings #1-#10, 2026-09-24):**

- **Node semantics**: nodes grant power to THE SKILL, not the character — base stats of the skill (damage, rider chance, rider depth) and authored mechanic riders. Each node has LEVELS; per direction a maxed node contributes at most **+10%** of the skill's base power.
- **Element identity map (approved)**: Hỏa = đốt/stack đốt; Thủy = hồi máu + chậm; Mộc = độc sâu + lan; Kim = xuyên giáp + bạo kích; Thổ = giáp/giảm thương + phản.
- **Capstone = 2-way variance split**: the last tier of each element branch forks into two mutually-flavored variants of the same basic (two authored specialization variants selected through existing machinery).
- **Gating rule**: cảnh giới lớn (qi_refining vs foundation_establishment) decides which nodes OPEN; tiểu cảnh (minor tier within realm) decides each node's LEVEL CAP. Thế-granting nodes open only at foundation_establishment+ (ruling #5 — no The sink below).
- **Seal riders**: only after each seal is properly spec'd (ruling #6 — do each ấn thoroughly first, then wire into its element). Beta nodes may ride `hoa_an` (the authored seal); the other four elements get non-seal mechanic riders until their seal specs land.
- **Honesty rule (ruling #16 = C)**: nodes above ceiling render dimmed with tooltip preview "mở ở Kim Đan"; no end-of-content banner (ruling #17).

### 1.3 Stubs to resolve

`passive_nguyen_anh_minh_triet` (empty passiveModifiers), `van_phap_tuy_tam`/`da_phap_lien_tuyen` data shells (real semantics in `TurnAnKitSkills.ts` — reconcile the split), `PHAP_TU_ULTIMATE_IDS/_PROFILES` registry-only, orphaned `the_man_*` buffs (delete or wire), `BREAKTHROUGH_SCOPED_MATERIAL_IDS=[]`.

---

## §2. Kiếm Tu — content design

### 2.1 The 37-combo kit (design decision D-KT-1)

`KIEM_PHO_COMBOS` = 37 entries carrying only `{damage:{multiplier}}` — header marks Effects STUB ("spec §11 defers authored combo effects"). The path's stated primary fantasy is combo discovery; today all differentiation is name + multiplier tier.

**Design: signature-pattern effect table.** Do NOT author 37 bespoke skills; author effects by *pattern signature* so every combo is mechanically distinct but the space stays tractable:

- Effect = f(first orb, last orb, length tier). The 15 len-3 / 12 len-4 / 10 len-5 combos partition into authored effect cells (e.g. `*→Bổ` = suy_nhuoc nuke rider; `*→Hất` = choang extension; `Hất→*` = interrupt setup). Author the cell table (~15-20 cells) covering all 37; each combo maps to exactly one cell + its damage tier stays.
- `presetId:'kiem_combo_*'` already exists per combo — VFX naming stays.
- Spec amendment required: `2026-09-15-kiem-tu-reimagined-design.md` §11 lists this as deferred — this doc supersedes it for the effect pass.

### 2.2 Realm/đột phát rewards

- `composeRealmRewards()` is **bare on both ways** (`KiemTuPath.ts:206,230`) — author sword-scoped realm passive overrides (per-realm stat flavor) instead of the generic ladder only.
- Kiếm Tu artifact slot is empty (Pháp Tu has `ngu_hanh_chau` at golden_core) — author one or record deliberate asymmetry ruling (§9).
- Technique `gradeEffects` are regen-only (`sword_control_art`, `myriad_swords_art`) — author the spec-suggested Kiếm Ý gain / cascade-rate tiers.

### 2.3 Presentation debt

- Per-orb VFX presets (all 5 + `ngu_kiem_thuat` share `slash`) — author 6 presets.
- 37 `kiem_combo_*` presets exist procedurally; upgrade tier len5 to spritesheet-backed art once §5 manifest lands.
- Status icons: `kiem_thuong`, `kiem_vuc` absent from `StatusVfxPresets`.
- `hidden_sword_pathway` has no `sealedOffer` (Pháp Tu Ẩn has one) — add the permanent-warning card.
- Emblem slots render name-only — add icon/badge markup (pattern exists for `isAnPath` reaction-aura emblem).
- **Free art already on disk**: 5 authored player PNGs (`public/assets/characters/player/kiem-tu/*.png` + `sword-cultivator.png`) unbound — bind the combat + cultivate profiles (stale comment at `PlayerVisualProfiles.ts:140-161` claims none exist).

### 2.4 Orphans/stubs

`van_kiem_vu` buff + icon (zero consumers), `passive_thai_hu_kiem_y` (orphan catalog entry), `tu_luc` preset (retired channel art) — wire or delete per impl pass.

---

## §3. Thể Tu — content design

Mechanically the most complete path (both ways shipped, hidden bodies live end-to-end). The debt is almost entirely **art/VFX + balance-flagged values**.

### 3.1 VFX authoring (zero today)

Every Thể Tu def resolves to `DEFAULT_PRESET_ID 'arcane_impact'`. Author per-kit presets:

- Cuồng Chiến kit (`cuong_quyen`, `loan_dau`, `bat_tu_ba_the`): heavy-impact physical family.
- Trấn Thể kit (`tran_ap`, `phan_chinh`, `son_nhac`): ward/guard family (distinct from generic `externalWard` visuals).
- Ứng Thế kit (`tham_the`, `tu_the`, `bach_ung`) + reactive payloads (`phan_kich`, `tro_kich`, `trong_phan_kich`): counter-proc family — the path's signature visual identity.
- Status icons for `BAT_TU_BA_THE_BUFF`, `PHAN_CHINH_BUFF`, `SON_NHAC_*`, `KHIEM_KHICH_DEBUFF`, `UNG_THE_BUFF`, `HO/PHAN/TRO_MON_MARKER`, `TU_THE_BUFF`, `BACH_UNG_BUFF`, `HO_VE_BUFF` (all fall to red/green polarity fallback today).

### 3.2 Deferred mechanics channels (author the payloads)

`TheTuNodes.ts:27-32` lists authored-but-channel-less effects: tran_ap debuff riders, Bất Tử leech/kill-extend, son_nhac self-DR scaling; roadmap B6 adds AoE interception. Each needs its NodeEffect→skill-payload binding designed and wired.

### 3.3 Realm/đột phát

All body content is mortal/qi_refining/foundation-scoped by design (strict-prefix `HiddenBodyRealms.ts`). In-window coverage is complete; Kim Đan+ body chapters are post-beta scope — record as such, no authoring.

### 3.4 Missing surfaces

- Thể Tu artifact — deferred in roadmap B6; author or rule deliberate asymmetry (§9).
- `public/assets/techniques/` does NOT exist → both body technique icons broken (and all 6 technique icons project-wide dead paths — §5.3).
- Enemy art: `co_thu` (the trial centerpiece) and `huyet_mong` (hidden beast) render the shared placeholder entity — they are the two highest-value art targets in the whole project.

---

## §4. Đột phát / realm-reward design (cross-path)

Today's breakthrough rewards are path-agnostic (grade passive + technique grade table + shared realm-passive ladder). Design adds **path-flavored breakthrough grants** so the grade choice feels different per path:

- Per-realm `realmRewards` entries on each way's kit record (`CultivationPathKit` already owns `realmRewards` field — authored content is empty/generic).
- Suggested shape per way: minor-realm grant = small authored unlock (orb alt, node discount, kit-scoped stat rider); Trúc Cơ grant = the path's signature upgrade (Pháp: special-slot alternate unlock + The threshold feature; Kiếm: orb unlock advance / combo-effect seed; Thể: deferred channel activation).
- Grade differentiation (human/earth/heaven/great_dao) stays on `kien_co` % — path flavor rides the reward table, not the grade formula.

---

## §4-b. Breakthrough-reward brainstorm — Pháp Tu (user direction)

Constraint: rewards must be reachable in-window and must not unlock spend mechanics ruled out by R1. Candidate pool (design-level, numbers stay BALANCE):

| Tier | Candidate reward | Why it fits |
|---|---|---|
| Trúc Cơ đột phá | **Element-locked master table**: grant the element's authored seal talent line (hoa_an spec exists for Hỏa — others get the parallel rider their data supports) | Makes element choice visible at the gate |
| Trúc Cơ đột phá | **The-pool awakening**: The capacity unlocks as a stored resource visibly filling (spend still locked — creates anticipation, zero new mechanic) | Uses wired economy without violating R1 |
| Trúc Cơ đột phá | **Cast-leveling acceleration**: the basic skill's cast-XP curve gains a multiplier tier | Rewards the only verb the player has in-window |
| Minor realms (LQ tiers) | Element-branch node discounts / node-level seeds on the basic branch | Feeds §1.2a — realms visibly feed the tree |
| Hidden (Ẩn way) | Reaction-aura amplification row + multicast-depth row | Ẩn has mechanics, just no tree — a breakthrough grant can seed it without authoring the whole tree |

**User pick (2026-09-24):** (a) element mastery line + (b) Thế-pool awakening. Reward model per ruling #19: **only 2 grant kinds — `normal` and `hidden` — same grant, different numbers** (no per-grade multi-tier). Land on each way's `realmRewards` entry: normal = mastery rider + The-pool activation at `foundation_establishment`; hidden = same grants with stronger numbers via the hidden-lineage channel.

## §5. Cross-cutting asset systems (design)

### 5.1 Skill icon channel

`Skill`/`TurnSkillDefinition` has **no icon field**; `TURN_SKILL_DISPLAY_META` is the right carrier — add `iconKey?: string` there, resolved against a manifest `data/ui/SkillIconManifest.ts` mapping iconKey → asset path under `public/assets/icons/skills/` (new dir). HUD reads meta.iconKey → manifest; absence falls back to element glyph (already exists).

### 5.2 VFX manifest

`public/assets/vfx/spritesheets/` holds ~1137 (phap-tu audit) / ~568 (kiem-tu audit, overlapping count) unreferenced spritesheet files. Author a `VfxAssetManifest` binding `presetId` → spritesheet(s) + frame metadata; `ActionImpactVfx` currently renders Graphics primitives only — manifest is the upgrade seam, presets keep procedural fallback.

### 5.3 Technique icons

Create `public/assets/techniques/` + one icon per technique (6 dead paths today: `five_elements_art`, `dao_insight_art`, `sword_control_art`, `myriad_swords_art`, `diamond_body_art`, `responsive_body_art`).

### 5.4 Enemy art ladder

Mortal batch exists (20 PNGs, `MORTAL_ENEMY_TEMPLATE_IDS`). Author per-tier sets: qi_refining + foundation (20 authored species + flood-dragon boss + tribulation enemies) — plus the two hidden beasts (§3.4). `EnemyArt.ts` resolves by id convention; no schema change needed.

### 5.5 Player art

Pháp Tu `player-phap-tu-v1.png` is the flagged placeholder ratchet; Kiếm Tu PNGs exist unbound (§2.3); Thể Tu player art unauthored. Art batch: 3 paths × (combat + cultivate) profiles.

---

## §6. Doc-hygiene items (carry into impl PR)

- `docs/game-guide.md`: still claims 9 meridians + "Thể Tu not playable" — both stale.
- `docs/systems/body-refinement.md`: claims `body_refinement_progress` resolves dead — talents exist now.
- `PhysiqueEssence.ts` header: "unwired until M-QI-10" — landed.
- `docs/systems/cultivation-paths.md` body predates the Path→Way model (header warns); `node-tree.md` describes retired branches; `phap-tu-profile.md` / `kiem-tu-profile.md` are frozen pre-rework snapshots — mark historical in headers.

---

## §7. BETA-BALANCE boundary (user-held — design does not author)

Everything marked §18/NON-CANONICAL stays with the user's BETA-BALANCE phase: 6 `baseGains` (BodyRefinement), `NHAP_DAO/KIEN_CO_ENHANCED` percent constants, ZhouTian/Nghịch/Quán Thể/Ancient-Beast constants, `PHYSIQUE_GRADES` per-grade stats, `PHYSIQUE_ESSENCES` remaining 7 rungs, technique grade-inheritance coefficients, first-pass combat constants (`CUONG_QUYEN_*`, `SON_NHAC_*`, forge pacing, Hất stun 0.2, Bổ rate), Lv12→18 curve.

This doc authors *structure and content placement*, not those numbers.

---

## §8. Implementation slicing (suggested mission order)

1. **DESIGN-ART-1**: asset manifests + technique icons + bind on-disk kiem-tu PNGs + enemy art ladder + hidden-beast art (art batch, no mechanics).
2. **DESIGN-VFX-2**: per-skill/per-kit presetIds (all 3 paths) + status icons + display-meta gap fill (Pháp Tu 29 skills missing HUD meta).
3. **DESIGN-SKILL-3** (Pháp Tu beta scope per rulings): basic-skill node tree design + node-tree honesty (dim/hide Kim Đan+ nodes); description-claim fix on `van_moc_lan_doc`; Kiếm combo effect cells (D-KT-1) — deferred to Kiếm Tu's own round; stubs/orphans pass on reachable Pháp Tu content only.
4. **DESIGN-REALM-4**: per-way realmRewards + Thể Tu deferred channels + technique grade tables.
5. Doc-hygiene sweep rides whichever PR last touches each file.

## §9. User rulings (RESOLVED 2026-09-24)

| # | Question | Ruling |
|---|---|---|
| R1 | Re-gate Pháp Tu special/The into Trúc Cơ window? | **NO — intentional design.** Basic-only in beta is deliberate; keep all Kim Đan gating as authored. |
| R2 | Move a third orb into the beta window? | Deferred — Kiếm Tu work comes after Pháp Tu. |
| R3 | D-PT-1 re-bin vs retire B/D + route skills | **Leave them.** 10 B/D chain skills + 4 route skills stay authored-but-unreachable; no re-bin, no alternates layer. |
| R4 | Kiếm Tu / Thể Tu artifacts | Deferred with the path work. |
| R5 | `van_moc_lan_doc` poison-spread | Not needed in beta (skill unreachable); fix the *description claim* only so it stops lying — no mechanic authored. |
| R6 | Pháp Tu Ẩn (Ngộ Đạo) node tree | **Out of scope.** Beta designs only the basic-path node tree. |
| R7 | Specialization unlock design | Out of scope this round (spec unlock nodes deferred). |

**Locked Pháp Tu beta scope (from rulings):** basic skill + its node tree; presentation layer (display meta, per-skill VFX, icons, player art, technique icons dir); node-tree honesty for the basic path (hide/dim Kim Đan+ nodes); lying-description fix; beta-needed orphans only; breakthrough-reward brainstorm (§4-b).
