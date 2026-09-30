# BETA ART SPEC — danh sách + mô tả chi tiết (scope: Luyện Khí → Trúc Cơ)

## 0. Format contract (giống pipeline đợt trước — gửi PNG raw, packer lo phần còn lại)

- **1 file PNG / 1 clip** — frames xếp ngang hoặc lưới đều nhau trên 1 sheet (như idle_pham_nhan.png 33f đợt trước). Gửi file gốc là đủ, packer tự cắt/pack atlas.
- **Nền trong suốt** (alpha), nhân vật/quái chiếm ~85–95% chiều cao cell, **chân chạm đáy frame** (pivot = đáy giữa — feet-anchor).
- **Cell tối thiểu ~500×500px** vẽ thoải mái hơn cũng được (packer scale 0.75 + feet-anchor crop tự động).
- **Clip cần cho mỗi entity**:
  - `idle` — đứng thở/lặp (10–33 frames tuỳ ý, loop mượt)
  - `attack` — đòn đánh thường (8–17 frames, play-once)
  - `death` — ngã/chết (1–17 frames; 1 frame cũng được — packer tự làm synthetic)
  - `avatar` — 1 PNG vuông 512² (đầu/ngực, dùng làm icon trận); *không vẽ cũng được — packer extract từ sheet*
  - Boss/companion thêm `ult` (12–17 frames, chiêu lớn) nếu vẽ được
- **Ferocious (Hung X) KHÔNG cần vẽ** — packer recolor tự động như wave trước.

---

## 1. QUÁI LUYỆN KHÍ (Quật chapter, floors 1–6+) — 9 loài ⭐ ƯU TIÊN CAO NHẤT

*Đây là chỗ trần nhất: cả floor đầu chương 2 toàn silhouette. Vẽ theo thứ tự gặp trong game.*

| # | id | Tên game | Mô tả vẽ | Clips |
|---|-----|---------|----------|-------|
| 1 | `wild_wolf` | Dã Lang | Sói hoang xám-nâu, gầy dữ, mắt sáng. Mồm há/nanh khi attack | idle/attack/death |
| 2 | `bandit` | Sơn Tặc | Người cướp — áo rách, khăn quàng, cầm đao/con dao. Nhân dạng duy nhất của nhóm | idle/attack/death |
| 3 | `mountain_hawk` | Ó Núi | Đại bàng núi lớn, cánh rộng, mỏ cong; attack = lao mổ/chụp móng | idle/attack/death |
| 4 | `giant_earthworm` | Trùn Đất | Giun đất khổng lồ, da sậm đốt bùn, miệng tròn nhiều nanh; bò nhúc nhích | idle/attack/death |
| 5 | `flame_fox` | Viêm Hồ | Cáo đuôi bồng bềnh lửa, lông đỏ-cam viền lửa, khói nhẹ | idle/attack/death |
| 6 | `magma_boar` | Nham Trư | Heo rừng da nham thạch nứt phát sáng, ngà nóng đỏ, hơi nóng | idle/attack/death |
| 7 | `sand_lynx` | Sa Miêu | Linh miêu sa mạc, tai chùm lông dài, lông vàng-cát đốm đá | idle/attack/death |
| 8 | `rock_bear` | Nham Hùng | Gấu khổng lồ da như phiến đá nứt, vai mọc tảng đá | idle/attack/death |
| 9 | `blade_hawk` | Đoạn Nhận Ưng | Ưng linh — lông cánh như lưỡi kiếm kim loại, bay sượt; attack = chém cánh | idle/attack/death |

*Ferocious: packer tự recolor (như trước) — tổng coverage 15 enemy ids.*

## 2. QUÁI TRÚC CƠ (Foundation) — 7 loài

| # | id | Tên game | Mô tả vẽ | Clips |
|---|-----|---------|----------|-------|
| 1 | `foundation_lava_hound` | Dực Hỏa Khuyển | Chó săn cánh lửa, lông nham đỏ-rực, đuôi lửa | idle/attack/death |
| 2 | `foundation_sand_scorpion` | Sa Hắc | Bọ cạp sa mạc khổng lồ, giáp đen-bóng, đuôi độc cong | idle/attack/death |
| 3 | `foundation_rock_tortoise` | Thạch Giáp Quy | Rùa mai đá khổng lồ, mai như mỏm núi rêu phong | idle/attack/death |
| 4 | `foundation_mud_golem` | Nê Cự Nhân | Golem bùn — thân nhão đổ sệt, tay to ló đá | idle/attack/death |
| 5 | `foundation_metal_beetle_swarm` | Kim Giáp Trùng Quần | **Bầy** bọ cánh cứng ánh kim — vẽ 3–5 con nhỏ thành đám quây (không 1 con to) | idle/attack/death |
| 6 | `foundation_blade_hawk_king` | Đoạn Nhận Ưng Vương | Bản vương của blade_hawk — lớn gấp ~1.6x, mào/đuôi kiếm rực rỡ hơn | idle/attack/death |
| 7 | `foundation_mist_shark` | Vụ Cáp | Cá mập "bơi" trong sương, thân ma mị mờ nhòe viền sương | idle/attack/death |

*Ferocious: packer recolor — coverage 14 ids. Boss chương Trúc Cơ (Giao Sủng) đã có art `blood-locust-elder` — không cần vẽ.*

## 3. BOSS ẨN — 1 con cần vẽ (con kia free)

| id | Tên | Mô tả vẽ | Clips |
|----|-----|----------|-------|
| `huyet_mong` | Huyết Mông | Boss ẩn hệ máu — quái huyết-nguyệt: thân hình đỏ thẫm bán trong, khói huyết quanh mình, mắt trắng lạnh. Spawn ở kill-window band qi_refining | idle/attack/death (+ult nếu được) |
| `co_thu` | Cổ Thú | **KHÔNG cần vẽ** — tôi sẽ bind bộ `wugu-demon-king` đã pack sẵn (boss cổ thú ma tộc, hợp vai Ancient Beast bất-tử của trial) | — |

## 4. COMPANION — 2 con (chỉ 2 con player sở hữu được trong beta)

| id | Tên | Grade | Mô tả vẽ | Cần |
|----|-----|-------|----------|-----|
| `than_nong` | Thần Nông | huyền | Thần Nông — vị thánh nông-dược mộc hệ: già/nhân từ hoặc thần thú hiền, quanh thân dây leo-thảo dược xanh; basic đánh gai gỗ, heal đồng đội → dáng hỗ trợ hiền nhưng có sức mạnh cổ xưa | idle/attack/death + avatar + **card** (hình đứng đẹp cho gacha/panel, nền trong suốt) |
| `khai_minh` | Khai Minh | địa | Thú canh Côn Lôn **9 đầu** (truyền thuyết Khai Minh Thú): mình hổ sư tử vệ tinh, nhiều đầu xếp bán nguyệt, oai nghiêm gác cổng; claws + ward che chở party | idle/attack/death + ult + avatar + card |

## 5. NHÂN VẬT — 1 profile còn thiếu

| profile | Tên | Mô tả vẽ | Cần |
|---------|-----|----------|-----|
| `the_tu` | Thể Tu | Tu sĩ luyện **thân thể**: dáng võ sĩ trần/hở ngực, cơ bắp cuồn, không vũ khí (đấm tay không) hoặc găng/cui; khí huyết bốc lên khi cast. Phân biệt rõ với Phàm Nhân (nghèo tàn) và Ngự Kiếm (kiếm khách) | idle/attack/death + **ult** (thể tu là đường duy nhất emit ultimate slot) + cultivate (ngồi thiền vận huyết) + avatar |

*3 profile kia (pham_nhan/ngu_kiem/ngu_hanh) đã có set bạn vẽ — đủ.*

## 6. SKILL ICON — 5 icon vuông (pháp-trạng Pháp Tu Ẩn)

Style: vuông ~256², ink-wash + glow hệ tương ứng, giống 10 icon hiện có trong `public/assets/ui/skill/` — đặt đúng tên file:

| file | Tên | Gợi ý |
|------|-----|-------|
| `tam_muoi_chan_hoa.png` | Tam Muội Chân Hỏa | Ba tầng lửa chân hoả xếp chồng — hỏa đỏ-tím đậm |
| `thanh_tuyen_duong_linh.png` | Thanh Tuyền Dưỡng Linh | Suối thanh/giọt nước sáng ôm linh khí — lam-trắng dịu |
| `van_moc_sinh_co.png` | Vạn Mộc Sinh Cơ | Mầm cây nở + vòng sinh cơ lan — lục tươi |
| `kim_y_ngung_phong.png` | Kim Ý Ngưng Phong | Lưỡi/khí kim đông cứng không khí — kim-xám lạnh |
| `trong_nhac.png` | Trọng Nhạc | Hình chuông/vần âm nặng — thổ-nâu vang |

## 7. PILL ICON — 2 icon vuông (đan dược gate Trúc Cơ — đang fallback, chặn beta)

Style: vuông ~256², cùng style 8 icon đan có sẵn trong `public/assets/pills/` (duong_than_dan, hoi_linh_dan, ...): viên đan tròn trên nền đơn/chén, ink-wash, viền hào quang theo hệ. Cả hai là đan HUYỀN-grade 'material' (không uống, giữ/ngốn qua hệ thống) — nên nhìn quý hơn đan hồi phục thường, hơi "bảo vật".

| file | Tên | Gợi ý vẽ |
|------|-----|----------|
| `truc_co_dan.png` | Trúc Cơ Đan | Đan vững căn cơ — vật chứng bậc Địa/Thiên của gate đột phá Trúc Cơ. Viên đan to, màu nền nâu-vàng đất + vân nổi như nền móng/gốc rễ bên trong, hào quang vàng-đất đậm. Cảm giác "nặng, gốc, nền tảng". Đây là icon QUAN TRỌNG nhất beta — hiện ở mọi breakthrough Trúc Cơ |
| `thong_mach_dan.png` | Thông Mạch Đan | Đan khai thông kinh mạch — tiêu qua Bát Mạch (meridian). Viên đan xanh-lam/ngọc với các đường mạch sáng chạy quanh (như kinh lạc phát quang), hào quang thanh-lam. Cảm giác "dòng chảy thông suốt" |

*2 icon này đang render chữ-fallback trên production — cần trước beta.*


## 8. ICON KỸ NĂNG THIẾU (~58 cái — audit 2026-09-30: chỉ 15/75 skill có icon, còn lại render chữ-fallback)

*Style: vuông ~256², cùng style 10 icon có sẵn trong `public/assets/skills/` (tram, hoa_cau_thuat, ...): nét ink-wash, nền tối, một hình tượng trung tâm rõ ở cỡ nhỏ. Ưu tiên theo thứ tự — player gặp đầu trước.*

### 8a. Ưu tiên 1 — Thể Tu + mortal (15 icon, player thấy ngay)
| file | Tên skill | Gợi ý vẽ |
|------|-----------|----------|
| `generic_physical.png` | Vật Công | Nắm đấm/vệt đánh thường, không nguyên tố |
| `cuong_quyen.png` | Cuồng Quyền | Quyền cuồng bạo — nắm đấm bùng huyết khí đỏ |
| `loan_dau.png` | Loạn Đấu | Chuỗi đấm loạn — nhiều vệt nắm đấm chồng nhau, vệt máu |
| `bat_tu_ba_the.png` | Bất Tử Bá Thể | Thân hình bất diệt — hào quang đỏ-đen, vết nứt da phát sáng |
| `tran_ap.png` | Trấn Áp | Áp lực trấn ép — bàn tay/lực trường đè xuống vùng |
| `phan_chan.png` | Phản Chấn | Khiên phản — ấn phản chấn văng lại đòn |
| `son_nhac.png` | Sơn Nhạc | Thân như núi — hình người hóa vách đá chắn trước |
| `tham_the.png` | Thám Thế | Con mắt/dấu ấn quan sát trên mục tiêu |
| `tu_the.png` | Tú Thế | Nhịp thế tích tụ — hình xoáy/gió thu vào người |
| `bach_ung.png` | Bách Ứng | Trăm phản ứng — vệt phản kích tỏa từ trung tâm |
| `quan_the.png` | Quán Thế | Toàn trường quan sát — con mắt lớn/mắt lưới phủ vùng |
| `phan_kich.png` | Phản Kích | Vệt đánh trả ngược mũi đòn địch |
| `tro_kich.png` | Trợ Kích | Đòn hỗ trợ — bóng người thứ hai đánh theo |
| `trong_phan_kich.png` | Trọng Phản Kích | Phản kích nặng — vệt đỏ lớn văng trả |
| `water_surge.png` | Nuốt Sáng (boss) | Sóng nước dâng quét ngang (đặc biệt Thủy Giáp Long) |

### 8b. Ưu tiên 2 — orb Kiếm Phổ + Ngự Kiếm (6 icon)
| file | Tên | Gợi ý vẽ |
|------|-----|----------|
| `orb_dam.png` | Đâm | Lưỡi kiếm đâm thẳng |
| `orb_chem.png` | Chém | Nhát chém nặng, vệt máu |
| `orb_bo.png` | Bổ | Đường bổ phá giáp — giáp nứt |
| `orb_hat.png` | Hất | Nhát hất ngược, choáng — vệt cong lên |
| `orb_quet.png` | Quét | Vệt kiếm quét ngang toàn trận |
| `ngu_kiem_thuat.png` | Ngự Kiếm Thuật | Phi kiếm bay — nhiều kiếm xếp thứ tự |

### 8c. Ưu tiên 3 — Ngô Đạo (1)
| `ngo_dao_hon_don.png` | Ngô Đạo Hỗn Độn | Quả cầu hỗn độn ngũ sắc xoáy |

### 8d. Ưu tiên 4 — companion ×12, mỗi con 3 icon (36 icon; vẽ sau nhất, có thể dùng 1 icon "cá tính" rồi 2 biến thể)
| companion | basic | special | ultimate |
|-----------|-------|---------|----------|
| Hồ Ly Tinh | `ho_ly_tinh_basic` Trảo Kích (vuốt cáo) | `ho_ly_tinh_special` Hồ Hỏa (lửa hồ ly lam) | `ho_ly_tinh_ultimate` Tam Vĩ Diễm (3 đuôi lửa) |
| Khai Sơn Lực Sĩ | `khai_son_luc_si_basic` Trọng Quyền (đấm nặng) | `khai_son_luc_si_special` Khai Sơn Trảm (chém mở núi) | `khai_son_luc_si_ultimate` Bàn Sơn Thế (núi đè vùng) |
| Linh Hạc | `linh_hac_basic` Vũ Nhận (lông dao) | `linh_hac_special` Sương Vũ Tán (quạt sương) | `linh_hac_ultimate` Băng Vũ Thiên La (lưới băng) |
| Dược Đồng Tử | `duoc_dong_tu_basic` Dược Trụ (chày giã thuốc) | `duoc_dong_tu_special` Ngũ Độc Tán (bột độc 5 màu) | `duoc_dong_tu_ultimate` Vạn Độc Quy Tông (độc kích nổ) |
| Vân Du Kiếm Khách | `van_du_kiem_khach_basic` Tùy Hành Kiếm | `van_du_kiem_khach_special` Phi Kiếm Thứ (kiếm xuyên hàng) | `van_du_kiem_khach_ultimate` Tuyệt Kiếm Nhất Thứ (nhất kích tất sát) |
| Thủy Linh Xà | `thuy_linh_xa_basic` Xà Nhai (cắn băng) | `thuy_linh_xa_special` Giao Long Ngập Thủy (lụt cột) | `thuy_linh_xa_ultimate` Cửu Thủy Phong Ba (9 sóng) |
| Thiết Y Tăng | `thiet_y_tang_basic` Côn Pháp (gậy sắt) | `thiet_y_tang_special` Kim Cang Hộ Thể (thân kim cang) | `thiet_y_tang_ultimate` Phật Chưởng Trấn Ma (chưởng Phật) |
| Kim Quang Thánh Nhân | `kim_quang_thanh_nhan_basic` Kim Quang Chỉ (tia vàng) | `kim_quang_thanh_nhan_special` Vạn Kiếm Quyết (vạn kiếm quang) | `kim_quang_thanh_nhan_ultimate` Kim Quang Phá Giáp (quét giáp rạn) |
| Huyền Vũ | `huyen_vu_basic` Quy Giáp Trùng (mai rùa) | `huyen_vu_special` Huyền Vũ Trấn Địa (đất nứt chữ thập) | `huyen_vu_ultimate` Hậu Thổ Gia Thân (địa trụ khiên) |
| Cửu Thiên Huyền Nữ | `cuu_thien_huyen_nu_basic` Tinh Hoa Kiếm Quang | `cuu_thien_huyen_nu_special` Lạc Tinh Thứ (sao rơi) | `cuu_thien_huyen_nu_ultimate` Cửu Thiên Tinh Lạc (vãn tinh) |
| Thần Nông | `than_nong_basic` Dược Thảo Kích (gai thảo mộc) | `than_nong_hoi_phuc_thuat` Hồi Phục Thuật (dược lực xanh) | `than_nong_than_dang` Thần Đằng Dược Vương (dây thần hồi) |
| Khai Minh | `khai_minh_basic` Cửu Thủ Trảo (vuốt) | `khai_minh_ho_ve_thuat` Hộ Vệ Thuật (gầm buff đội) | `khai_minh_thanh_an` Thanh Ấn Côn Lôn (ấn che chở) |

*Companion không cần 3 icon riêng hẳn nếu nặng — có thể vẽ 1 icon đặc trưng + 2 biến thể màu/khung (basic/special/ultimate).*

## TÓM TẮT MỚI

- **~19 set entity** như bảng trên + **5 icon pháp-trạng** + **2 icon đan** (như cũ)
- **+ ~58 icon kỹ năng** section 8 (ưu tiên 8a→8d; vẽ theo thứ tự, dùng template cùng style)
- **Tổng ~19 set + ~65 icon**
