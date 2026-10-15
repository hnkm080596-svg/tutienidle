# Enemy Art Wave 1 — Blood-Fir-Forest Reskin — Spec

Status: v1 — DRAFT (chưa review)
Depends on: hiện trạng combat presentation (`ENTITY_ART_MODE='static'`,
uniformity contract 2026-09-19), `EnemyArt.ts` canonical-id registry,
`pack-mortal-combat-art.mjs` atlas format (TexturePacker JSON Hash),
`measure-entity-extents.mjs` extent measuring convention.
Mission-graph scope: reskin enemy hiện có ≤ Trúc Cơ (mortal + qi_refining +
foundation_establishment) bằng bộ art mới trong `public/NEWSPRITE`, gồm
combat animation (idle/attack/death), avatar, và per-monster attack SFX.
**KHÔNG** trong scope: VFX monster (`vfx/skill-anim-vfx/monster/`),
character/player art (`character/*`), UI/icons/fonts/scene/loading,
enemy data mới (stats/names/drops giữ nguyên — đây là reskin), boss
multi-skill anims (enrage/stomp/devour — phase 2), save migration.

## 1. Intent

`public/NEWSPRITE/Assets/Resources/assets/enemy/` là một Unity asset dump
(AssetRipper-style: mỗi PNG kèm `.json` metadata chứa `m_Pivot`,
`m_TextureRect`, `m_PhysicsShape`, `m_PixelsToUnits`). Roster:

- `monster-library/` — 15 loài, mỗi loài `{idle(7-13f), attack(2f),
  death(1f), avatar(0-1f)}`, canvas 960×960 RGBA, subject neo
  bottom-center (pivot ~0.43,~0.02 theo Unity metadata).
- `forest-region/` — 6 loài, flat layout (`*-idle-N.png`, `*-attack-N.png`,
  1 static PNG gốc), không có death/avatar riêng.
- `boss/` — `region1-boss-blood-locust-elder` (idle 12f + attack 2f +
  death 1f + `bloodwood-devour` skill anim + `11-blood-locust-elder.png`
  card) và `trial-tower-boss-wugu-demon-king` (idle/attack/death/enrage/
  stomp/avatar — 82 PNG, multi-skill).
- `audio/sfx/enemy-sfx/01-blood-fir-forest/` — per-monster `.ogg` theo
  3 tốc độ (`*-attack.ogg`, `*-attack-x1.5.ogg`, `*-attack-x2.ogg`).

Irrregularities trong dump cần pipeline xử lý, không sửa tay source:
- `character/*` dùng đuôi kép `*.png.png` (artifact của dump);
- 4 loài thiếu avatar (whiteshell-venom-beetle, mushroom-stone-toad,
  shadowrobe-phantom, rotbone-armored-corpse) → derive từ idle frame 1;
- `.json` Unity metadata chỉ cần `m_Pivot` (anchor) — discard sau khi
  trích.

## 2. Decision D1 — reskin mapping (APPROVED 2026-09-28)

User directive: ưu tiên art mới để mô tả enemy; **9 loài tự chọn, 3 loài
mỗi cảnh giới** từ Phàm Nhân → Trúc Cơ; boss cảnh giới thấp dùng
**recolor** của art loài cảnh giới cao hơn.

### 2.1 Final table — 9 normal + boss variants

| Cảnh giới | Species art | → Enemy id | Note |
|---|---|---|---|
| mortal | `08-graymane-wolf` | `mortal_feral_dog` | sói/chó hoang |
| mortal | `forest-region/tusked-mountain-boar` | `mortal_wild_boar` | heo rừng |
| mortal | `37-bloodarm-ox-demon` | `mortal_mud_ox` | trâu quỷ |
| qi_refining | `24-mudbelly-green-toad` | `pool_toad` | cóc |
| qi_refining | `09-whiteshell-venom-beetle` | `metal_beetle` | bọ càng |
| qi_refining | `29-witherfir-vineman` | `forest_fiend` | mộc yêu |
| foundation | `forest-region/drybranch-treant` | `foundation_wood_ape` | cây/mộc tinh |
| foundation | `forest-region/spore-flower-spirit` | `foundation_stone_fungus` | nấm/bào tử |
| foundation | `33-streamgrudge-nymph` | `foundation_flood_dragon_whelp` | thủy oán linh |

### 2.2 Boss variants — recolor pipeline (approved)

Game mechanic: boss không phải entity riêng — `Stages.ts` promote một
species "boss-eligible" làm `bossEnemyId` (floor 10 only; x1.6 HP + enrage
trigger). Boss-eligible ids nhận diện qua `bossTrigger`/`enrage` fields.

| Boss-eligible enemy | Realm | Art base | Recolor |
|---|---|---|---|
| `mortal_giant_crocodile` + `mortal_ferocious_giant_crocodile` (bossTrigger) | mortal | `forest-region/bloodflower-tree-fiend` | shift xanh-tối (đầm lầy); ferocious = recolor đậm hơn |
| `flood_serpent` + `ferocious_flood_serpent` (bossTrigger) | qi_refining | `25-streamscale-forkman` (thủy quái → giao) | shift lam-đen; ferocious = recolor đậm hơn |
| `foundation_ferocious_flood_dragon_whelp` (chapter boss floor 10) | foundation | `boss/region1-boss-blood-locust-elder` | — (boss art thật) |

Sửa khi implement (2026-09-28): `foundation_dragon_phase1/phase2/enrage`
trong spec draft là **buff ids**, không phải enemy ids — boss thật là
`foundation_ferocious_flood_dragon_whelp` (bossEligible + bossTrigger +
tribulationPhases). Boss map vào đó; `foundation_flood_dragon_whelp`
thường giữ art `streamgrudge-nymph` (cùng dòng Giao Sủng: con → hung =
nymph → locust elder).
| `boss/trial-tower-boss-wugu-demon-king` | — | RESERVED | không có enemy id trial-tower trong data → pack sẵn, chưa wire |

Recolor chạy **offline trong pack script** (không runtime, không vẽ tay):
canvas hue-shift chỉ trên dải hue dominant, giữ màu mắt/điểm nhấn sáng;
output là sheet PNG recolored trên disk. Boss sprite scale-up ~10-15% khi
spawn với modifier boss (nếu presentation layer hỗ trợ scale — check, else
giữ scale gốc wave 1).

### 2.3 Ferocious variants — recolor same species (approved)

Ferocious = cùng loài, bản hung mãnh → **recolor cùng species art**
(hue-shift + điểm nhấn), KHÔNG map sang species khác. Ferocious của loài
được map: `ferocious_pool_toad`, `ferocious_metal_beetle`,
`ferocious_wild_wolf` (nếu chọn wolf pair)… nhận variant recolor. Ferocious
của loài không map → giữ PNG cũ.

### 2.4 Coverage rule

- Unmapped enemies giữ nguyên static pipeline hiện tại (PNG + idleMotion
  tween) — reskin là additive, không subtractive.
- `HiddenBeasts` (2 con) ngoài scope wave 1.
- 12 loài art mới chưa dùng → reserve cho wave 2 (cảnh giới cao hơn).

## 3. Decision D2 — animation contract amendment

Contract hiện tại: `CombatAnimationCatalogue { idle, standby, death }`
bắt buộc; attack đọc qua shared lunge tween; `ENTITY_ART_MODE` là global
compile-time switch — 'animated' = MỌI entity là clip set, 'static' = mọi
entity là 1 PNG + idleMotion.

Vấn đề: reskin wave 1 chỉ có art animated cho ~15-17 species. Flip global
switch sẽ đẩy TOÀN BỘ enemy còn lại về placeholderClips (32-frame generic
figure) — regression nghiêm trọng so với PNG thật hiện có.

**Quyết định:** sửa đổi contract thành per-entity resolution.

- `ENTITY_ART_MODE` giữ `'static'`; catalogue thêm registry
  `ANIMATED_ENEMY_SET` (canonical enumeration, tương tự
  `MORTAL_ENEMY_TEMPLATE_IDS`).
- `presentationFor(entityKey)` resolve: key ∈ ANIMATED_ENEMY_SET →
  `kind:'animated'` với clips thật; else → static như hiện tại.
- Contract mở rộng: `CombatAnimationCatalogue.attack?: AtlasClip` —
  optional, `repeat: 0`, play-once trên action_impact của entity đó rồi
  return idle (playback đã có cơ chế play-with-idle-return).
  `CombatAnimationName` + `COMBAT_ANIMATION_NAMES` mở rộng tương ứng;
  REQUIRED không đổi.
- `standby` cho enemy animated = reuse idle frames (dump không có standby
  art riêng; 2-frame attack làm loop standby sẽ giật).
- Entity unanimated khi mode 'static' vẫn đi đúng path hiện tại; khi nào
  TOÀN BỘ roster có art thật mới xem xét flip global switch.

Uniformity contract amendment phải ghi trong spec để tests/doc đồng bộ —
đây là thay đổi contract chủ động, không phải lách.

## 4. Decision D3 — atlas packing pipeline

Script mới `scripts/pack-enemy-art.mjs` (sibling của pack-mortal,
dùng `canvas` đã có — không dependency mới):

- Input: `public/NEWSPRITE/Assets/Resources/assets/enemy/{monster-library,
  forest-region,boss}/`.
- Per-species: gom idle/attack/death frames → pack ngang 1 hàng (hoặc grid
  N columns) vào 1 sheet PNG `enemy-<slug>-sheet.png`, viết atlas JSON Hash
  `enemy-<slug>-atlas.json` với frame names
  `<slug>-<clip>-<NNN>.png` (khớp `framePrefix/frameSuffix/zeroPad` của
  contract). PADDING=2 giữa frames.
- Trích `m_Pivot` từ Unity json frame idle-1 → normalize thành anchor
  `{x,y}` lưu vào registry; mọi frame cùng canvas 960×960 nên 1 pivot/species
  là đủ cho alignment.
- Output: `public/assets/enemies/animated/<slug>/` (sheet + atlas +
  avatar.png + sfx refs); source dump KHÔNG mutate — giữ nguyên làm
  provenance.
- Extent: chạy `measure-entity-extents.mjs` mở rộng (hoặc packer tự đo
  opaqueBounds như pack-mortal) per-species trên tallest frame → emit
  `ArtExtent` constants vào registry module.

## 5. Decision D4 — registry & runtime wiring

- `EnemyArt.ts` mở rộng thành reskin map: template id →
  `{ slug, animated: true, sheetKey, avatarKey, sfxKey }` (hoặc module mới
  `MonsterArt.ts` + EnemyArt delegate — chọn 1 owner: **MonsterArt.ts**,
  EnemyArt giữ nguyên vai trò template-id enumeration; resolveEnemyTextureKey
  mở rộng trả art descriptor thay vì chỉ texture key).
- `CombatPresentationCatalogue.buildCatalogue()`: các template id trong
  ANIMATED_ENEMY_SET register với clips thật (idle/standby/death + attack
  optional); các enemy còn lại giữ `kind:'static'`.
- `AssetBundleCatalog` 'combat' bundle: thêm atlas+sheet keys; parity test
  CombatPreload↔bundle phải cập nhật (script packer emit manifest cho
  test pin).
- `CombatScene`/`combat-animation-playback`: registerClipCatalogue đã
  generic — chỉ cần thêm `attack` vào name set + hook `ActionImpactEvent`
  play attack clip cho acting entity, fallback lunge tween khi clip absent.
- Anchor: `bodyAnchor`/combatBodyAnchors giữ nguyên; pivot từ registry đặt
  sprite origin (bottom-center), verify vs BattleGridProjection.

## 6. Decision D5 — audio (sampled SFX channel)

- `AudioManager` hiện là Tone.js synth library (SOUND_LIBRARY recipes) —
  KHÔNG có sampled channel. Thêm: `public/assets/audio/enemies/<slug>/`
  stage ogg files; `combatAudioBinding` map `action_impact` của enemy
  entity → per-species attack ogg qua Phaser `scene.sound` (đi cùng
  lifecycle scene).
- Speed variants `x1/x1.5/x2`: **không dùng** — game không có combat speed
  multiplier; chỉ stage + wire file `*-attack.ogg` (x1). File x1.5/x2 vẫn
  được copy sang output dir nhưng không wire (reserve).
- Coverage thật: sfx chỉ có cho monster-library + blood-locust-elder.
  Species thiếu sfx (tusked-mountain-boar, drybranch-treant,
  spore-flower-spirit, bloodflower-tree-fiend) → **silent**, thiết kế sfx
  sau (user ruling 2026-09-28).

## 7. Decision D6 — avatar

- Avatar PNG → `public/assets/enemies/animated/<slug>/avatar.png`;
  register `avatarUrl` trong MonsterArt.
- Surfaces dùng: enemy info/roster UI nếu có, combat nameplate — kiểm
  consumer thật trước khi wire (nếu không có consumer nào, stage art nhưng
  chưa wire — tránh dead code claim).
- 4 loài thiếu avatar: derive `avatar.png` = crop alpha-bbox của idle-1.

## 8. Out of scope / deferred

- Boss multi-skill anims (enrage/stomp/bloodwood-devour): contract chỉ
  có optional `attack`; skill anims cần `skill` clip + trigger points —
  phase 2 sau khi wave 1 proven.
- VFX (`vfx/skill-anim-vfx/monster/`), character art, UI icons, fonts,
  glb, music — không đụng wave này.
- `_reskin-demo/` — palette experiments của user, không vào pipeline.
- Enemy stats/names/drops — giữ nguyên (reskin only).
- Save schema — không đụng.

## 9. Risks

- **Perf**: 960×960×~12 frames × 17 species ≈ 200MB pixel-space; sheet
  PNG ~1-2MB/species sau trim. Phaser atlas load + GPU texture size cap
  (4096/8192) — packer phải enforce max sheet width, wrap sang rows.
- **Mixed static+animated** trong cùng battle: visual inconsistency là
  trade-off có chủ đích (user directive); spec ghi rõ.
- **Death clip 1-frame**: contract yêu cầu death repeat 0; 1 frame lặp
  xó nhanh — cần hold-last-frame + fade tween hiện có bù.
- **Pivot drift**: Unity pivot per-frame có thể khác nhau — dùng idle-1
  pivot cho mọi clip của species, verify bằng visual QA pass.
- **Ferocious missing art**: enemies ferocious không map được vẫn PNG cũ
  → mixed-era visuals, chấp nhận wave 1.

## 10. Verification gates (theo Internal QA authority)

- P3 quick: type-check + vitest scope art/presentation.
- P13/P14: real runtime — combat battle với ≥1 reskinned enemy animated
  (Playwright evidence).
- P18 OCR delegation trên diff.
- P4 adversarial quick (visual/state edge: unmapped enemy, missing
  avatar, death mid-anim).
- P5 ≥3 sequential passes.
- Ledger run `enemy-art-wave1-*` ghi evidence; không claim fixed-point
  nếu còn finding mở.
