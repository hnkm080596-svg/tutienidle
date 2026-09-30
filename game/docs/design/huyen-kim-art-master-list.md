# ART MASTER v3 — LEAN BETA (Huyền Kim Sơn Thủy)

Phiên bản này thay v2 — thu theo **BETA SCOPE LOCK v2**: vertical slice Phàm Nhân → Pháp Tu Ngũ Hành → Luyện Khí → Trúc Cơ. Ít hơn nhưng đủ trường hợp — mọi thứ liệt kê đều beta-blocking trừ khi ghi POST-BETA.

**Scope đổi so với v2:**
- Enemy roster beta = **12 identity** (9 normal + 3 boss) — danh sách khác v2, đọc kỹ
- Icon beta-blocking = **14-17** (không còn 65)
- Không vẽ: Hung-normal sheet riêng, Huyết Mông, Cổ Thú, companion, Thể Tu player, orb-picker, passive emblem, Ultimate slot
- `frame-s-slot` + `scrollbar` tiếp tục HOLD

**Spec liên quan:** `huyen-kim-chrome-art-spec.md` (chrome contract) · `huyen-kim-component-state-matrix.md` (state contract — state của scope-hidden feature chỉ là reference, không render trong beta) · `beta-art-drawing-spec.md` (mô tả entity).

---

## A. SCENE MASTER CONCEPTS — 1672×941 + state strip nhỏ

| # | Scene | Mockup | State strip | Priority |
|---|-------|--------|-------------|----------|
| A1 | **M1 Động Phủ** | Top bar; thế giới ≥70%; Đạo Luân chỉ với **beta-visible destinations** (Character·Realm·Skill/Technique·Quest·Teleport/Encounter·Pill Room·Gathering·Chi Hiền Quán[Nhân Công only]·Equipment Hall·Settings — KHÔNG Artifact/Formation/Companion/future rings); Thiên Cơ Bảng drawer; buildings; depth layers | Wheel: normal·hover·active·locked(progression)·upgradeable·notification · Building: normal·hover·selected·locked·ready·upgradeable·active·hidden | ⭐ ĐẦU TIÊN |
| A2 | **M8 Combat** | Battlefield ≥75%; top bar gọn; **action rail chỉ Basic + Special (no Ultimate)**, responsive khi chỉ có Basic (Act I); entity HUD; safe regions VFX/damage; intro/countdown/pause/exit/victory/defeat/result | Rail: ready·hover/selected·cooldown+count·blocked-resource·locked·actionable · HUD: ally·enemy·targeted·low-HP·dead | ⭐ Cao |
| A3 | **M2 Character** | Study template; hero = Mortal hoặc Pháp Tu Ngũ Hành; talent seal | Talent: idle·hover·selected·available·locked·acquired·maxed·disabled | Cao |
| A4 | M3 Realm Thiên Lộ | Milestone 1→18 (13-18 tồn tại nhưng không quảng bá hidden) | completed·current·reachable·locked·release-hidden; CTA enabled/disabled | Sau A1-A3 |
| A5 | M4 Skill+Technique | **Single committed-element tree** + five_elements_art ring 10 rune | Node: hidden·locked·available·selected·learned·unlocking·levelled·maxed·gated | Sau A1-A3 |
| A6 | M5 Equipment | Paperdoll + bag — beta chỉ equip·compare·**Cường Hóa·Hóa Luyện** | Slot states đầy đủ (xem state contract §2.6) | Sau A1-A3 |
| A7 | M6 Pill Room | **5 recipe families** only: tu_linh/hoi_linh/khai_linh/thong_mach/truc_co | recipe·ingredient enough/insufficient·brew·brewing·output-ready | Sau A1-A3 |
| A8 | M7 Region | 3 Act landscape + landmark | normal·selected·locked·boss·perfect·current·auto-farm | Sau A1-A3 |
| A9 | Tribulation | master + 3 inset (lightning / mind / victory-defeat) | phase chain §9.6 | Cuối |

---

## B. CHROME — 18 slot vẽ + 2 HOLD (đúng như v2, ceremonial = GRAYSCALE)

Như v2 — xem `huyen-kim-chrome-art-spec.md` (đã fix count 20, divider 4/4). HOLD: `frame-s-slot`, `scrollbar`. `button-ceremonial` vẽ **grayscale** (game tô gold/cinnabar).

---

## C. ENEMY ART — **12 identity** (đúng roster §13 spec, ID đã verify tồn tại trong data)

**Format:** 1 PNG sheet/clip; nền trong suốt; cell ~500×500; chân chạm đáy; boss +`special` clip + phase/enrage feedback cho final boss. **BẮT BUỘC `impactFrame` / `impactFrames[]`** mỗi clip attack/special (impact-sync pipeline). Hung-normal = runtime tint/aura, KHÔNG vẽ sheet riêng.

### Act I — Phàm Nhân (mortal)
| id | Tên | Role | Clips |
|---|---|---|---|
| `mortal_wild_boar` | Dã Trư | melee thẳng | idle·attack·death |
| `mortal_savage_tiger` | Man Hổ | melee áp lực | idle·attack·death |
| `mortal_water_wolf` | Thủy Lang | nhanh/mobile | idle·attack·death |
| `mortal_ferocious_giant_crocodile` | Hung Cự Ngạc | **Boss I** | idle·attack·special·death (+enrage feedback) |

### Act II — Luyện Khí
| id | Tên | Role | Clips |
|---|---|---|---|
| `wild_wolf` | Dã Lang | melee baseline | idle·attack·death |
| `flame_fox` | Viêm Hồ | ranged | idle·attack·death |
| `giant_earthworm` | Trùn Đất | caster/underground telegraph | idle·attack·death |
| `ferocious_flood_serpent` | Hung Giao Xà | **Boss II** (giữ water_surge mỗi 4 action) | idle·attack·special·death |

### Act III — Trúc Cơ — FINAL BOSS beta
| id | Tên | Role | Clips |
|---|---|---|---|
| `foundation_lava_hound` | Dực Hỏa Khuyển | melee | idle·attack·death |
| `foundation_sand_scorpion` | Sa Hắc | ranged | idle·attack·death |
| `foundation_mud_golem` | Nê Cự Nhân | caster/heavy | idle·attack·death |
| `foundation_ferocious_flood_dragon_whelp` | Hung Giao Sủng | **FINAL BOSS** — phase 50%/25% transition + special telegraph + enrage + death feedback riêng | idle·attack·special·death |

**POST-BETA / NON-BLOCKING (không vẽ bây giờ):** 6 normal + 4 boss dormant khác, Huyết Mông, companion, Thể Tu player.

---

## D. ICONS — **14 core + 3 conditional = 17 tối đa**, ~256² ink-wash nền tối

| Nhóm | Icons | Số |
|---|---|---|
| Starter | `linh_bao` (Linh Bạo) | 1 |
| Basic Ngũ Hành | `hoa_cau_thuat` · `thuy_tien_thuat` · `doc_chuong` · `diem_kim_thuat` · `tho_cau_thuat` | 5 |
| Special Ngũ Hành | `tam_muoi_chan_hoa` · `thanh_tuyen_duong_linh` · `van_moc_sinh_co` · `kim_y_ngung_phong` · `trong_nhac` | 5 |
| Technique | `five_elements_art` (Đại Ngũ Hành Chân Quyết) | 1 |
| Pill gate | `thong_mach_dan` · `truc_co_dan` → `public/assets/pills/` | 2 |
| Conditional | `tu_linh_dan` · `hoi_linh_dan` · `khai_linh_dan` — **chỉ nếu** chưa có art đạt chuẩn (kiểm tra trước) | +3 |

Đặt skill icons tại `public/assets/skills/`. **Acceptance:** tôi (Devin) phải wire `iconKey` + `SKILL_ICON_MANIFEST` + verify HUD resolve — giao icon theo đợt.

**POST-BETA:** 30+ icon companion, orb icons, hidden spell, Thể Tu kit.

---

## Thứ tự tổng v3
1. **A1 Động Phủ + state strip** (unblock mọi thứ)
2. **D pill icons** (`truc_co_dan` + `thong_mach_dan` — production đang fallback)
3. **B1 chrome Động Phủ** (5 slot)
4. **C Act I 4 identity** (3 normal + boss I)
5. **A2 Combat + rail state board** → **A3 Character**
6. **C Act II + Act III** (final boss quality budget cao nhất)
7. **B2/B3 chrome** (ceremonial grayscale, divider 4/4)
8. **D basics + specials + technique + utility pills nếu cần**
9. **A4-A9 còn lại**
