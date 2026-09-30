# DANH SÁCH ART MASTER v2 — thứ tự + kích thước + yêu cầu (Huyền Kim Sơn Thủy)

Tổng khối: **A. Scene concepts → B. Chrome 20 slot (2 HOLD) → C. Entity 20 set → D. ~65 icon**.
Vẽ theo đúng thứ tự — phần trước unblock phần sau.

**Spec liên quan (đã commit trong repo):**
- `game/docs/design/huyen-kim-chrome-art-spec.md` — chrome slot contract
- `game/docs/design/huyen-kim-component-state-matrix.md` — **state contract**: mọi state runtime → visual treatment (đọc trước khi vẽ state strip)
- `game/docs/design/beta-art-drawing-spec.md` — mô tả chi tiết entity/icon
- `TuTienIdle_UI_UX_Redesign_HuyenKimSonThuy_FinalSpec.md` — spec tổng (§9 motion, §46-47 states)

**Nguyên tắc:** 1 base art + runtime state. KHÔNG vẽ sheet per-state. Vẽ thêm "state strip" nhỏ trên concept để khóa cách state trông — không cần ảnh full-screen mỗi state.

---

## A. SCENE MASTER CONCEPTS (vẽ trước — khóa ngôn ngữ thị giác)

**Format:** 1 mockup PNG mỗi scene, **1672×941** (16:9) + **state strip** nhỏ bên cạnh (1 hàng thumbnail ~96-192px mỗi ô) khóa visual của các trạng thái. Gửi file cho Devin — đưa vào `docs/design/`.

| # | Scene | Phải có trong mockup | State strip bắt buộc | Priority |
|---|-------|---------------------|----------------------|----------|
| A1 | **M1 Động Phủ** | Top bar (avatar+tên+cảnh giới trái · tài nguyên giữa · utility seals phải); thế giới ≥70%; Đạo Luân dưới-giữa (center Tu Luyện + inner ring + outer ring, các slot thật: Character/Realm/Skill/Quest/Artifact/Formation/Companion/Teleport/Pill Room/Gathering/Chiêu Hiền/Equipment/Scripture/Settings); Thiên Cơ Bảng drawer phải; buildings trên vách; layer depth sky→far→mid→mist→foreground | **Wheel slot:** normal·hover·active·locked·upgradeable·notification · **Building:** normal·hover/focus·selected·locked·ready·upgradeable·active·hidden | ⭐ VẼ ĐẦU TIÊN |
| A2 | **M8 Combat** | Battlefield ≥75%; top bar gọn; action rail phải (BASIC/SPECIAL/ULT dọc); entity HUD bám actor; combat log collapsed; central zone không panel; VFX + damage-number safe regions; KHÔNG quên intro/countdown/pause/exit-confirm/victory/defeat/result | **Action rail:** ready·hover/selected·cooldown+turn-count·blocked-resource·locked/unreleased·passive-emblem·orb-picker(Kiếm Tu) · **Entity HUD:** ally·enemy·targeted·damaged/low-HP·dead | ⭐ Cao — song song A1 |
| A3 | **M2 Character (Study)** | Template Study: nav trái + hero giữa (nhân vật + elemental disc + meridian) + info rail phải + action rail dưới; talent seal nhỏ + hover detail. **Ruling: Huyền Kim thay SYSTEM skin hoàn toàn** (sys-*/hologram sẽ bị gỡ) | Talent/seal: idle·hover·selected·available·locked·acquired·maxed·disabled | Cao |
| A4 | M3 Realm (Thiên Lộ) | Đường núi dốc milestone 1→18; breakthrough panel | Milestone: completed·current·reachable·locked·release-hidden; CTA: enabled/disabled; req: met/unmet | Sau A1-A3 |
| A5 | M4 Skill+Technique (Đạo Mạch + Đạo Quyển) | Node graph tỏa từ core; technique 10-rune ring | **Node:** hidden(không render)·locked(ink+glyph)·available(gold)·selected(gold+ring)·learned(jade)·unlocking(pulse)·levelled n/N·maxed(jade+mark)·gated(ink+req) · Connection: locked/active/unlocking · Rune ring: empty/current/completed/available/locked | Sau A1-A3 |
| A6 | M5 Equipment+Bag | Paperdoll giữa, slot vòng quanh, bag grid dày | **Slot board đầy đủ:** available·disabled·locked·idle·selected·processing·valid/invalid/missing·equipped·new·upgrade/downgrade·empty/filled·hover·rarity·quality-aura·max-rarity·enhance | Sau A1-A3 |
| A7 | M6 Pill Room | Lò đan lớn giữa, recipe scroll trái, nguyên liệu quanh lò, output phải | Recipe: normal/selected · ingredient: enough/insufficient · brew: available/blocked·brewing(progress)·cancel·output-ready | Sau A1-A3 |
| A8 | M7 Region/Encounter | Landscape toàn màn, landmark trong tranh | Landmark: normal·selected·locked·boss·completed/perfect·current-target·auto-farm; Start: enabled/disabled | Sau A1-A3 |
| A9 | Tribulation (Thiên Uy) | **1 master + 3 inset**: environment chain calm→mây tụ→sét (master) + inset Lightning chapter + inset Mind chapter (question+answers+countdown) + inset Victory/Defeat | Phase states theo §9.6 | Cuối nhóm |

---

## B. CHROME — 20 slot manifest (18 vẽ + 2 HOLD)

**Format:** PNG trong suốt, vẽ KÍN `sourceWidth×sourceHeight`, đặt `game/public/assets/ui/huyen-kim/<id>@1x.png` (+`@2x.png` gấp đôi). `slices` = mép không kéo giãn. **`tintable ✓` = vẽ GRAYSCALE** — game tô jade/gold/cinnabar/ink per state (xem state contract doc).

### B1 — Nhóm M1 Động Phủ ⭐ vẽ trước trong B
| id | Vai trò | 1x size | slices L/R/T/B | tint |
|---|---|---|---|---|
| `dao-luan-center` | Mặt huy chương trung tâm (Tu Luyện) | 192×192 | full-bleed | — (active = glow overlay runtime) |
| `dao-luan-node` | Nút vòng Đạo Luân inner/outer | 96×96 | full-bleed | ✓ |
| `surface-l-drawer` | Drawer/thẻ Thiên Cơ Bảng | 384×384 | 48/48/48/48 | — |
| `icon-button-utility` | Nút tròn top-bar (mail/bag/settings) | 96×96 | 30/30/30/30 | ✓ |
| `resource-pill` | Viên đếm tài nguyên top-bar | 160×48 | 24/24/14/14 | — |

### B2 — Nhóm Study/panel
| id | Vai trò | 1x size | slices | tint |
|---|---|---|---|---|
| `surface-m-panel` | Thân panel Study | 256×256 | 32/32/32/32 | — |
| `button-standard` | Nút thường Study | 192×72 | 32/32/20/20 | ✓ |
| `frame-xs-tooltip` | Khung tooltip | 96×96 | 20/20/20/20 | ✓ |
| `entity-bar` | Thanh HP entity — **PNG chỉ là frame/track, fill HP là runtime** | 192×32 | 20/20/10/10 | ✓ |
| `frame-m-modal` | Khung modal feature | 256×256 | 40/40/40/40 | — |
| `seal-chip` | Ấn nhỏ (talent/yêu cầu) | 128×48 | 24/24/14/14 | ✓ |
| `rune-node` | Đỉnh node graph — 1 grayscale + tint theo state matrix §2.5 | 64×64 | full-bleed | ✓ |
| `tab-seal` | Ấn tab/nav | 96×64 | 20/20/16/16 | ✓ |

### B3 — Nhóm lễ/phụ
| id | Vai trò | 1x size | slices | tint |
|---|---|---|---|---|
| `button-compact` | Nút compact combat rail | 160×56 | 28/28/16/16 | ✓ |
| `button-ceremonial` | CTA chính — **vẽ GRAYSCALE** (game tô gold/cinnabar theo variant) | 256×96 | 40/40/24/24 | ✓ |
| `frame-xl-ceremony` | Khung lễ | 512×512 | 72/72/72/72 | — |
| `surface-xl-scroll` | Cuộn lễ | 512×640 | 64/64/96/96 | — |
| `divider-ornament` | Gạch ngang hoa văn | 256×16 | **96/96/4/4** | ✓ |

### HOLD — KHÔNG vẽ (chờ ruling)
| id | Lý do |
|---|---|
| `frame-s-slot` | SlotView cố tình không dùng (clutter lưới dày). Chỉ vẽ khi có consumer chủ đích. |
| `scrollbar` | App ẩn scrollbar toàn cục. Chỉ vẽ khi surface bật lại scroll. |

*Slot pending vẫn render CSS fallback — gửi PNG đúng tên là tự vào.*

---

## C. ENTITY SETS — **20 set** (đã đối chiếu ID runtime)

**Format:** 1 PNG sheet/clip, frames xếp đều; nền trong suốt; cell ~500×500; nhân vật 85-95% chiều cao; **chân chạm đáy frame**. Clips: `idle` (10-33f loop), `attack` (8-17f), `death` (1-17f), `avatar` 512² (optional — packer extract), boss/companion +`ult`.

**⭐ MỚI — impact-frame contract (BẮT BUỘC):** repo có pipeline `game/art/animation-impact-markers.json` + IMPACT-SYNC đưa damage về đúng frame chạm. **Mỗi clip attack/ult phải khai `impactFrame`** (multi-hit → `impactFrames[]`). Ghi trên sheet hoặc kèm khi giao — ví dụ `windup 1-4 → impact 5 → recovery 6-10`. Vẽ xong mà không khóa impact frame → damage/VFX lệch lúc đòn chạm.

### C1 — 9 quái Luyện Khí ⭐ trần nhất, vẽ trước
wild_wolf · bandit · mountain_hawk · giant_earthworm · flame_fox · magma_boar · sand_lynx · rock_bear · blade_hawk — idle/attack/death (mô tả `beta-art-drawing-spec.md` §1)

### C2 — 7 quái Trúc Cơ
foundation_lava_hound · foundation_sand_scorpion · foundation_rock_tortoise · foundation_mud_golem · foundation_metal_beetle_swarm (bầy 3-5) · foundation_blade_hawk_king · foundation_mist_shark — idle/attack/death (§2)

### C3 — Boss ẩn + companion + nhân vật
- `huyet_mong` Huyết Mông (idle/attack/death +ult) — `co_thu` bind art sẵn có
- `than_nong` + `khai_minh` — idle/attack/death + ult + avatar + card đứng (§4)
- `the_tu` Thể Tu — idle/attack/death + ult + cultivate + avatar (§5)

---

## D. ICONS — 65 cái, vuông ~256², ink-wash nền tối

### D1 ⭐ 2 icon đan gate Trúc Cơ — **drop-in thật** (production đang chữ-fallback)
`truc_co_dan.png` · `thong_mach_dan.png` → `public/assets/pills/`

### D2 5 icon pháp-trạng → `public/assets/skills/`
tam_muoi_chan_hoa · thanh_tuyen_duong_linh · van_moc_sinh_co · kim_y_ngung_phong · trong_nhac

### D3 58 icon kỹ năng → `public/assets/skills/` (8a→8d)
- **8a — 15 icon Thể Tu/mortal**: generic_physical, water_surge, cuong_quyen, loan_dau, bat_tu_ba_the, tran_ap, phan_chan, son_nhac, tham_the, tu_the, bach_ung, quan_the, phan_kich, tro_kich, trong_phan_kich
- **8b — 6 icon**: orb_dam/chem/bo/hat/quet + ngu_kiem_thuat
- **8c — 1 icon**: ngo_dao_hon_don
- **8d — 36 icon companion** — **re-scope beta: chỉ 6 icon cho than_nong + khai_minh là beta-blocking**; 30 icon còn lại = future catalog, vẽ sau (mô tả §8d)

**⭐ MỚI — D3 integration acceptance:** SkillIconManifest trên master chưa map hết 58 key. Vẽ xong ≠ game tự dùng — Devin phải (1) thêm iconKey vào skill definition nếu thiếu, (2) map vào SKILL_ICON_MANIFEST, (3) verify HUD/Skill Panel resolve đúng. Giao icon theo đợt, tôi wire song song.

---

## Thứ tự tổng v2
1. **A1 Động Phủ concept + state strip** (unblock M1)
2. **D1 — 2 đan** (production đang fallback)
3. **B1 — 5 chrome Động Phủ** (bỏ frame-s-slot)
4. **C1 — 9 quái LQ + impact frames** (trần nhất gameplay)
5. **A2 Combat + combat state board** → A3 Character + study state board
6. **B2/B3 chrome còn lại** (ceremonial grayscale, divider 4/4)
7. **D2 pháp trạng → D3 player-facing → 6 companion icons beta**
8. **C2/C3 entity còn lại**
9. **30 companion icons future** → A4-A9 + state inset tương ứng
