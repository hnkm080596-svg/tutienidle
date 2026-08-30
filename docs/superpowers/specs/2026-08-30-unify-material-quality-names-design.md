# Spec: Thống nhất trục "chất" nguyên liệu theo hệ tuổi

Ngày: 2026-08-30
Branch/Worktree: `agent/unify-material-quality-names` tại `E:/tutienidle-material-names`

## Bối cảnh & vấn đề

Nguyên liệu của Khí Đường (Linh Mộc/Linh Khoáng) và Đan Phòng (Linh Thảo)
đang dùng hai hệ nhãn "chất" khác nhau trong khi về bản chất cùng thể hiện
bậc hiếm/bậc chất lượng trong một cảnh giới:

- Linh Khoáng/Linh Mộc (phẩm): Hoàng → Huyền → Địa → Thiên → Tiên (5 bậc).
- Linh Thảo (niên đại): Thập Niên → Bách Niên → Thiên Niên → Vạn Niên (4 bậc).

Hệ quả: nhiều material trùng tên hiển thị hoàn toàn (ví dụ 5 loại
`mortal_ore_*` đều tên "Cửu Phẩm Linh Khoáng"; 3 realm của một họ thảo
đều tên "Tụ Linh Thảo"), người chơi khó phân biệt trong túi, hàng chi phí
đan phương và vendor.

## Quyết định thiết kế (đã duyệt cùng người chơi)

1. **Thống nhất một hệ nhãn "chất" cho cả ba loại: hệ TUỔI.**
   - Gỗ/Khoáng bỏ nhãn Hoàng/Huyền/Địa/Thiên/Tiên, dùng hệ tuổi 5 bậc:

     | quality key (id KHÔNG đổi) | Nhãn mới |
     |---|---|
     | `hoang` | Thập Niên |
     | `huyen` | Bách Niên |
     | `dia` | Thiên Niên |
     | `thien` | Vạn Niên |
     | `tien` | Thượng Cổ |

   - Gỗ thường từ Lâm (`<realm>_wood`, không có phẩm) hiển thị
     "Thập Niên Linh Mộc" (mức thấp nhất).
   - Thảo giữ 4 nhãn tuổi hiện có: Thập/Bách/Thiên/Vạn Niên.

2. **Tên hiển thị = "Tuổi + Tên gốc"** (không có phẩm nghề trong chữ):
   - "Thập Niên Tụ Linh Thảo", "Vạn Niên Tụ Linh Thảo"
   - "Bách Niên Linh Khoáng", "Thượng Cổ Linh Mộc"

3. **Màu thể hiện phẩm nghề theo cảnh giới (realm)** — hai tín hiệu tách bạch:
   - Màu TÊN: render qua `NameSegment.tone` (đã có hạ tầng) tại các bề mặt
     hiển thị segments (slot túi, hàng chi phí).
   - Màu KHUNG slot: `BagCell.rarityRank = professionGradeRank(grade)` —
     SlotView sẵn có prop `rarityRank` dùng thang `--rank-color-1..9`.

   Nguyên tắc: **nhìn tên biết tuổi/chất, nhìn màu biết cảnh giới.**
   Hai trục không bao giờ va chạm.

4. **Tooltip nguyên liệu thêm dòng "Cảnh giới"** (label realm + phẩm nghề)
   để người dùng không phân biệt được màu (color-blind) vẫn đọc được realm.

## Không đổi (giữ nguyên)

- Mọi material id (`<realm>_ore_<quality>`, `<herb>_<realm>_<age>`,
  `<realm>_wood`, `<realm>_wood_<quality>`...).
- Cơ chế roll, trọng số `ORE_QUALITY_WEIGHTS`/`HERB_AGE_WEIGHTS`, số lượng
  theo phẩm, tỷ lệ thành đan theo niên đại.
- Quy đổi tier (`MaterialTierConversionBalance` — quáng giữ quality key).
- Recipe/đan phương, chi phí Cường Hóa (`ore_hoang`), chi phí nâng cấp
  nguồn sản xuất, save shape. Giai đoạn dev không cần migration save.
- `ProfessionGrade` vẫn là nguồn sự thật phẩm-nghề-theo-realm, chỉ là không
  còn xuất hiện trong CHỮ tên nguyên liệu.

## Phạm vi sửa file

1. `game/src/data/materials/materials.ts` — sinh tên hiển thị mới:
   - Bảng nhãn 5 bậc tuổi thay `ORE_QUALITY_LABELS` (id key giữ nguyên).
   - Tên thảo = `"<Tuổi> <herbName>"` thay vì herbName thuần.
   - Gỗ thường = "Thập Niên Linh Mộc"; gỗ phẩm = `"<Tuổi> Linh Mộc"`.
   - Khoáng = `"<Tuổi> Linh Khoáng"`.
2. `game/src/components/panels/bag-sections/MaterialBagSection.vue` —
   truyền `rarityRank` cho slot (family cell + single cell), tooltip thêm
   dòng Cảnh giới.
3. `game/src/components/panels/ProductionPanel.vue` — hàng quy đổi/hiển thị
   nguyên liệu dùng tên mới; render NameSegment màu theo realm nếu hạ tầng
   có sẵn ở đó.
4. `game/src/components/panels/EquipmentHallPanel.vue` — hàng chi phí
   Cường Hóa hiển thị tên mới (đã render qua `stack.material.name`).
5. Test assert tên hiển thị: `EconomySimulation.test.ts`,
   `MaterialBagFilter.test.ts`, các test khác assert chuỗi tên
   (grep "Cửu Phẩm", "Tụ Linh Thảo"...) — cập nhật theo tên mới.

## Lưu ý triển khai

- `useBagFilter` search theo tên: family badge/gộp họ thảo có thể dựa
  `herbName` — kiểm tra `MaterialBagFilter.test.ts` để giữ hành vi search.
- Nơi render `material.name` dạng text thuần (vendor, lore codex, resource
  strip) tự hưởng lợi từ tên mới, không cần sửa.
- Chồng lấn: local worktree chính đang có thay đổi chưa commit ở
  `ProductionPanel.vue`/`EquipmentHallPanel.vue` từ task khác (người chơi
  xác nhận không liên quan tên). Task này làm trên worktree riêng từ
  `b7f7b31`; conflict (nếu có) resolve khi tích hợp.

## Kiểm chứng

- `npm test` (ít nhất các file test liên quan), `npm.cmd run type-check`,
  `npm.cmd run build` trong worktree `E:/tutienidle-material-names`.
