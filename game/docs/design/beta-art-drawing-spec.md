# BETA ART SPEC v3 — danh sách + mô tả chi tiết (LEAN BETA: 6 enemy + 7 icon)

Thu theo **BETA SCOPE LOCK v2** (`src/core/betaScope.ts`, `frontend-contract.md`). Mọi phần v2 ngoài scope đã gỡ: companion (Thần Nông/Khai Minh), hidden boss (Huyết Mông/Cổ Thú), Thể Tu player, ~58 icon kỹ năng (orb Kiếm, Ngộ Đạo, kit Thể Tu, companion), ferocious-sibling sheets. Chúng là dormant data — KHÔNG vẽ trong beta.

Roster authority: `BETA_ENEMY_ROSTER`; enemy ids sống trong `src/data/enemy/MortalEnemies.ts` (act I + II) và `FoundationEnemies.ts` (act III).

## 0. Format contract (giữ pipeline đợt trước — gửi PNG raw, packer lo)

- **1 file PNG / 1 clip** — frames xếp ngang hoặc lưới đều nhau trên 1 sheet. Gửi file gốc là đủ, packer tự cắt/pack atlas.
- **Nền trong suốt** (alpha), nhân vật/quái chiếm ~85–95% chiều cao cell, **chân chạm đáy frame** (pivot = đáy giữa — feet-anchor).
- **Cell tối thiểu ~500×500px** (vẽ lớn hơn cũng được — packer scale + feet-anchor crop tự động).
- **Clip contract theo role:**
  - normal: `idle` (10–33f loop) · `attack` (8–17f play-once) · `death` (1–17f; 1 frame cũng được — packer synthetic)
  - boss: `idle · attack · special · death` (`special` = clip đòn `water_surge`/phase telegraph)
  - `avatar` — 1 PNG vuông 512² đầu/ngực; *không vẽ cũng được — packer extract từ sheet*
- **BẮT BUỘC `impactFrame`/`impactFrames[]`** trên mỗi clip `attack`/`special` (pipeline `game/art/animation-impact-markers.json` đưa damage về đúng frame chạm). Ghi trên sheet hoặc kèm khi giao, vd `windup 1-4 → impact 5 → recovery 6-10`.
- **Elite/Hung (Tinh Anh) KHÔNG cần vẽ** — runtime modifier (tint + aura), không phải species riêng trong beta.

## 1. Roster beta — 12 identity (3 normal + 1 boss mỗi act)

**6/12 đã có art bind — không vẽ lại:**

| Act | id | Tên | Art hiện có |
|-----|-----|-----|-------------|
| I | `mortal_wild_boar` | Dã Trư | `tusked-mountain-boar` (animated) |
| I | `mortal_savage_tiger` | Man Hổ | `mortal-savage-tiger-v1.png` (static) |
| I | `mortal_water_wolf` | Thủy Lang | `mortal-water-wolf-v1.png` (static) |
| I | `mortal_ferocious_giant_crocodile` | Hung Cự Ngạc (Boss I) | `bloodflower-tree-fiend-mudboss-ferocious` |
| II | `ferocious_flood_serpent` | Hung Giao Xà (Boss II) | `streamscale-forkman-floodserpent-ferocious` |
| III | `foundation_ferocious_flood_dragon_whelp` | Hung Giao Sủng (FINAL BOSS) | `blood-locust-elder` (boss art thật) |

*3 boss chỉ có idle/attack/death → `special` telegraph render runtime (aura tint + marker); optional top-up clip sau, không blocking.*

## 2. QUÁI CẦN VẼ — 6 normal ⭐ trần nhất beta

### Act II — Luyện Khí (Quật, floors 1–9) — vẽ trước
| id | Tên game | Hệ/role | Mô tả vẽ | Clips |
|----|----------|---------|----------|-------|
| `wild_wolf` | Dã Lang | Mộc · melee | Sói hoang xám-nâu, gầy dữ, mắt sáng; mồm há/nanh khi attack | idle/attack/death |
| `flame_fox` | Viêm Hồ | Hỏa · ranged | Cáo đuôi bồng bềnh lửa, lông đỏ-cam viền lửa, khói nhẹ; attack = phun/tung hỏa từ xa | idle/attack/death |
| `giant_earthworm` | Trùn Đất | Thổ · caster, lane underground | Giun đất khổng lồ, da sậm đốt bùn, miệng tròn nhiều nanh; bò nhúc nhích; attack = trồi từ đất (telegraph) | idle/attack/death |

### Act III — Trúc Cơ (floors 1–9)
| id | Tên game | Hệ/role | Mô tả vẽ | Clips |
|----|----------|---------|----------|-------|
| `foundation_lava_hound` | Dực Hỏa Khuyển | Hỏa · melee | Chó săn cánh lửa, lông nham đỏ-rực, đuôi lửa | idle/attack/death |
| `foundation_sand_scorpion` | Sa Hắc | Hỏa · ranged | Bọ cạp sa mạc khổng lồ, giáp đen-bóng, đuôi độc cong; đốm lửa/nóng rực dưới kẽ giáp | idle/attack/death |
| `foundation_mud_golem` | Nê Cự Nhân | Thổ · caster/heavy | Golem bùn — thân nhão đổ sệt, tay to ló đá | idle/attack/death |

## 3. SKILL ICON — 5 icon vuông (Special của 5 element kit `SPELL_KIT_IDS`)

Style: vuông ~256², ink-wash + glow theo hệ, giống 10 icon hiện có trong `public/assets/skills/` — đặt đúng tên file:

| file | Tên | Hệ | Gợi ý |
|------|-----|-----|-------|
| `tam_muoi_chan_hoa.png` | Tam Muội Chân Hỏa | Hỏa | Ba tầng lửa chân hoả xếp chồng — hỏa đỏ-tím đậm |
| `thanh_tuyen_duong_linh.png` | Thanh Tuyền Dưỡng Linh | Thủy | Suối thanh/giọt nước sáng ôm linh khí — lam-trắng dịu |
| `van_moc_sinh_co.png` | Vạn Mộc Sinh Cơ | Mộc | Mầm cây nở + vòng sinh cơ lan — lục tươi |
| `kim_y_ngung_phong.png` | Kim Ý Ngưng Phong | Kim | Lưỡi/khí kim đông cứng không khí — kim-xám lạnh |
| `trong_nhac.png` | Trọng Nhạc | Thổ | Chuông/vần âm nặng — thổ-nâu vang |

*(Basic của 5 kit — hoa_cau_thuat/thuy_tien_thuat/doc_chuong/diem_kim_thuat/tho_cau_thuat — và starter `linh_bao` đã có icon; technique `five_elements_art` đã có `dai_ngu_hanh_chan_quyet.png`.)*

## 4. PILL ICON — 2 icon vuông (đan gate Trúc Cơ — production đang chữ-fallback, chặn beta)

Style: vuông ~256², cùng style 8 icon đan có sẵn trong `public/assets/pills/` — viên đan tròn trên nền đơn/chén, ink-wash, hào quang theo hệ. Cả hai là đan HUYỀN-grade 'material' (không uống — giữ/ngốn qua hệ thống) nên nhìn quý hơn đan hồi phục, hơi "bảo vật".

| file | Tên | Gợi ý vẽ |
|------|-----|----------|
| `truc_co_dan.png` | Trúc Cơ Đan | Đan vững căn cơ — vật chứng gate đột phá Trúc Cơ. Đan to, nền nâu-vàng đất + vân nổi như nền móng/gốc rễ, hào quang vàng-đất đậm. Icon QUAN TRỌNG nhất beta — hiện ở mọi breakthrough Trúc Cơ |
| `thong_mach_dan.png` | Thông Mạch Đan | Đan khai thông kinh mạch — tiêu qua Bát Mạch. Đan xanh-lam/ngọc, đường mạch sáng chạy quanh (kinh lạc phát quang), hào quang thanh-lam |

*(3 family còn lại — `tu_linh_dan`, `hoi_linh_dan`, `khai_linh_dan` — đã có icon trong `assets/pills/`.)*

## 5. CONDITIONAL — 1 material icon (không blocking, làm nếu rảnh)

| file | Tên | Vì sao |
|------|-----|--------|
| `yeu_dan_hung_giao.png` | Yêu Đan | Nguyên liệu chính của cả 2 recipe gate (drop 100% từ boss Hung Giao Xà); hiện render text-fallback trên ingredient row + drop preview. Đặt `public/assets/materials/` |

## TÓM TẮT v3

- **6 enemy sheet** (idle/attack/death + `impactFrame`) — 3 Act II + 3 Act III
- **7 icon** — 5 Special + 2 đan gate (+1 Yêu Đan conditional)
- **0 boss vẽ mới** — 3 boss beta đã bind art; special clip = optional top-up
- KHÔNG vẽ: companion, hidden beasts, Thể Tu/Kiếm Tu player, ferocious siblings, mọi icon ngoài list trên
