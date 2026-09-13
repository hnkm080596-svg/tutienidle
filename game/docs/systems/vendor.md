# Ký Bảo Các — Vendor / Hóa Bán

**Trạng thái:** Live — hiện chỉ có **bán** (buyback); shop mua hàng/VIP là future.

Core: `core/economy/VendorSystem.ts`, `VendorBalance.ts`. Gate: building `vendor` (Ký Bảo Các, maxLevel 1). UI: `VendorPanel.vue` (`leftPanelMode = 'vendor'`) — Hóa Bán + quy đổi phẩm Linh Thạch/nguyên liệu.

## Bán material → Linh Thạch

`sellMaterial(bag, materialId, amount, realmId)` — atomic: trừ material trước, cộng Linh Thạch tràn stack → **hoàn lại material và từ chối** (`MaterialBag.canAcceptAmount` preflight — R9.2).

### Gate

1. `amount` integer > 0, material tồn tại trong `MaterialRegistry`.
2. `getUnitSellPrice(material, playerRealmId)` — material phải có giá.
3. **Grade gate (6G)**: phẩm nghề của material (suy từ `material.profession.realmId` → `PROFESSION_GRADE_BY_REALM`) phải **nghiêm ngặt thấp hơn** phẩm nghề của realm người chơi. Đồng phẩm hoặc cao hơn → `grade_not_below`. Material không suy được phẩm (essence/byproduct thiếu meta) → `not_sellable`. Linh Thạch (`spirit_stone`) đặt sau price check nên vẫn bán/quy đổi được.
4. Category phải thuộc `VENDOR_SELLABLE_CATEGORIES`: `herb | wood | ore | essence | byproduct`.
5. **Sole-ingredient guard**: material là biến thể thảo DUY NHẤT của 1 đan phương (alchemy recipe `herbVariants.length === 1`) → không được bán hết stack (giữ ít nhất 1), tránh mất nguyên liệu duy nhất.

### Giá (`VendorBalance.ts`)

Mọi giá là **đơn vị hạ tương đương**, quy đổi ra phẩm Linh Thạch theo realm:

- Thảo theo tuổi: decade 2 / century 4 / millennium 8 / myriad_year 16 / thuong_co 32.
- Gỗ theo tuổi: decade 2 / century 5 / millennium 12 / myriad_year 30 / thuong_co 75.
- Khoáng/essence/byproduct theo bảng riêng; `VENDOR_REALM_GROWTH` scale theo `realmIndex` của `material.profession.realmId`.

`getUnitSellPrice(materialId, realmId)` trả `undefined` khi không bán được → caller dùng nó lọc row hiển thị (gate tự áp cho mọi đường liệt kê).

## Quy đổi

`VendorPanel.vue` — quy đổi phẩm Linh Thạch (hạ ↔ trung ↔ thượng) và quy đổi cảnh giới nguyên liệu; giao dịch cũng atomic.

## Liên quan

- [profession-grades.md](./profession-grades.md) — thang phẩm gate.
- [inventory.md](./inventory.md) — Linh Thạch tier.
- [alchemy.md](./alchemy.md) — recipe sole-ingredient.
- [buildings.md](./buildings.md) — building `vendor`.
