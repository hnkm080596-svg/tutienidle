# Phẩm nghề (Profession Grade)

**Trạng thái:** Live.

Owner: `core/profession/ProfessionGrade.ts`. Meta: `core/profession/ProfessionMaterial.ts` (`material.profession`).

## Thang — tách biệt ItemGrade

`ProfessionGrade` = 10 bậc: `cuu_pham → bat_pham → that_pham → luc_pham → ngu_pham → tu_pham → tam_pham → nhi_pham → nhat_pham → tien_pham` (Cửu Phẩm → Tiên Phẩm), `PROFESSION_GRADE_ORDER` là thứ tự tăng dần.

**KHÔNG** trùng `ItemGrade` (5 bậc độ hiếm: hoang/huyen/dia/thien/tien — trang bị/đan/phù) — "phẩm nghề theo cảnh giới" và "độ hiếm item" là 2 trục khác nhau.

## Nguồn sự thật — `PROFESSION_GRADE_BY_REALM`

```ts
mortal: cuu_pham          qi_refining: bat_pham      foundation_establishment: that_pham
golden_core: luc_pham     nascent_soul: ngu_pham     soul_transformation: tu_pham
void_refinement: tam_pham body_integration: nhi_pham mahayana: nhat_pham
tribulation: tien_pham
```

`getProfessionGradeForRealm(realmId)` accessor. Không suy phẩm từ index rải rác tại call site.

## `material.profession`

`Material.profession?: ProfessionMaterialMeta` (vd `{ realmId, age }`) — consumer bắt buộc meta đầy đủ:

- **Vendor** — suy grade material → gate "thấp hơn phẩm người chơi" ([vendor.md](./vendor.md)).
- **Decompose** — `parseOre` lấy grade của ore cho output ([decompose.md](./decompose.md)).
- **Alchemy** — `age` của variant quyết định gỗ nhiên liệu + base success ([alchemy.md](./alchemy.md)).
- **Recipe validator** — realm/grade của đan phương.

Legacy material không có `profession` vẫn load bình thường (field optional) nhưng bị gate loại ở các consumer cần chứng minh phẩm.

## Liên quan

- [inventory.md](./inventory.md) — convention id `<realm>_<kind>_<age>`.
- [production.md](./production.md) — nguồn material có meta.
