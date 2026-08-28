# Kế hoạch Đồng bộ Tài liệu với Code

> ✅ **HOÀN THÀNH 2026-08-28** — đã thực hiện Task 1–5: viết lại mục Chiến đấu + Công trình (`game-guide.md`) và phần trang bị (`item-design-reference.md`), dọn comment MissileSystem ở 5 file liệt kê, phân loại + migrate ý tưởng `Plans .md` vào `truc-co-kim-dan-content-plan.md` §9 và `ui-discoverability-refactor-plan.md` §7 rồi xóa file, quy ước chống lệch đã có sẵn. Các điểm hoãn lại ghi ở mục **7. Phát sinh**.

> Thuộc Phase 0 của [roadmap.md](./roadmap.md). Plan này chỉ sửa tài liệu và comment lỗi thời — không đổi hành vi runtime.

## 1. Mục tiêu

- `docs/game-guide.md` và `docs/item-design-reference.md` phản ánh đúng code hiện tại.
- Comment trong source không còn trỏ vào hệ thống đã xóa.
- Thiết lập quy ước: thay đổi hành vi phải cập nhật tài liệu sống trong cùng thay đổi.

## 2. Hiện trạng — các điểm lệch đã xác định

### 2.1 `docs/game-guide.md`

| Dòng (ước lượng) | Nội dung lệch | Sự thật trong code |
|---|---|---|
| ~38 (mục Chiến đấu) | "Model missile data-driven trong `src/core/combat/missile/` hỗ trợ xuyên, nảy, bám đích, AOE…" | Thư mục `core/combat/missile/` **không còn tồn tại**. Impact/missile hiện là `ActionImpactSystem` tại `src/core/battle/ActionImpactSystem.ts`. |
| ~40-43 | Mô tả grid 10×16 cạnh hướng rework 19×19 "đã chốt" | Hai mô tả song song dễ gây hiểu nhầm trạng thái runtime. Cần tách rõ: đoạn nào là hiện trạng, đoạn nào là hướng tương lai chưa implement. |
| ~53-59 (mục Công trình) | Nhắc **Linh Thảo Viên**, **Lò Luyện**, **Thiên Công Phường**, `src/data/exploration/`, `src/data/recipe/` | `data/exploration` và `data/recipe` **không còn tồn tại** (xóa 2026-08-25). Building hiện tại: Linh Tuyền, Khí Đường, Đan Phòng, Truyền Tống Trận, Điều Phối Nhân Công (`src/data/building/buildings.ts`). Khai thác thuộc `src/core/production/` (Thanh Vân Lâm/Huyền Thiết Quảng/Động Thiên). |

### 2.2 `docs/item-design-reference.md`

Theo rà soát, tài liệu còn mô tả các hệ thống đã xóa khỏi code (grep 0 hit runtime):

- **Bụi Cốt** (`bui_cot`) — không còn.
- **Luyện Khí** (nâng trang bị bằng Bụi Cốt) — không còn.
- **Yêu Đan** — không còn.
- **CraftingSystem** / **Nâng Phẩm** / **Nâng Cảnh Giới** / **Rèn** (theo nghĩa cũ) — không còn; thao tác trang bị hiện tại là Cường Hóa/Tẩy Luyện/Tinh Luyện/Hóa Luyện trong `src/core/equipment/EquipmentSystem.ts`.

Cần viết lại phần vòng đời trang bị theo đúng 4 thao tác hiện hành + Quality/Rarity/forgePotential (`EquipmentQuality.ts`, `EquipmentRarity.ts`, `RefinementBalance.ts`).

### 2.3 Comment lỗi thời trong source

Các comment còn nhắc MissileSystem cũ (cần sửa hoặc xóa):

- `src/core/combat/CombatSystem.ts:42`
- `src/core/combat/CombatEntity.ts:146`
- `src/core/stat/StatTypes.ts:77` (hoặc đường dẫn hiện hành của StatTypes)
- `src/services/save/SaveSystem.ts:77`
- `src/core/skill/SkillEffectSystem.ts:58`

### 2.4 `docs/Plans .md`

- File tên sai convention (`Plans .md` — có dấu cách) chứa revamp lớn (building theo cảnh giới, đan 9 phẩm, ultimate Trúc Cơ, Linh Lực Hộ Thể…) chưa đồng bộ với code.
- Xử lý: tách nội dung — phần nào đã có trong code thì cập nhật vào `game-guide.md`; phần nào là định hướng tương lai thì chuyển vào [truc-co-kim-dan-content-plan.md](./truc-co-kim-dan-content-plan.md) hoặc [progression-depth-plan.md](./progression-depth-plan.md) làm tham chiếu; sau đó **xóa file** (game-guide.md đã quy ước không giữ plan rời trùng lặp).

## 3. Quy tắc thực hiện

1. **Code là nguồn sự thật.** Khi tài liệu và code khác nhau, sửa tài liệu theo code — không sửa code theo tài liệu (ngoại lệ duy nhất: nếu phát hiện code sai so với *quy tắc đã chốt* trong plan gốc, ghi nhận vào mục "Phát sinh" và hỏi trước khi sửa).
2. Mỗi mục sửa phải kiểm chứng bằng grep/đọc code trước khi viết lại — không viết theo trí nhớ.
3. Không thêm nội dung thiết kế mới vào tài liệu sống; chỉ mô tả những gì code đang làm.
4. Giữ cấu trúc hiện có của `game-guide.md` (các mục lớn giữ nguyên, chỉ thay nội dung lệch).

## 4. Nhiệm vụ triển khai

### Task 1: Sửa `game-guide.md`

**Files:** Modify `docs/game-guide.md`

**Steps:**
1. Viết lại mục **Chiến đấu**: thay mô tả missile bằng `ActionImpactSystem` (đọc `src/core/battle/ActionImpactSystem.ts` để mô tả đúng: impact windup, AOE, knockback, danh sách mục tiêu đã trúng…). Tách đoạn 19×19 thành ghi chú "Định hướng đã chốt, chưa implement" hoặc chuyển tham chiếu sang plan tương ứng nếu có.
2. Viết lại mục **Công trình, chế tác và khai thác** theo danh sách building thật trong `src/data/building/buildings.ts` và 3 nguồn khai thác trong `src/core/production/ProductionCatalog.ts`. Xóa mọi nhắc đến `data/exploration`, `data/recipe`, Linh Thảo Viên, Lò Luyện, Thiên Công Phường.
3. Đọc lại toàn file sau sửa, đối chiếu từng dẫn link module còn tồn tại.

### Task 2: Viết lại phần trang bị trong `item-design-reference.md`

**Files:** Modify `docs/item-design-reference.md`

**Steps:**
1. Grep xác nhận từng khái niệm trong §2.2 không còn trong code (đã xác nhận phần lớn; kiểm tra lại khi triển khai).
2. Viết lại vòng đời trang bị: rơi (`BattleLootSystem`/`StageDropRules`) → roll 3 trục (Quality/Rarity/forgePotential) → 4 thao tác Khí Đường (Cường Hóa/Tẩy Luyện/Tinh Luyện/Hóa Luyện) → Điểm Rèn per-item. Nguồn: đọc `EquipmentSystem.ts`, `EquipmentOperationCostCatalog.ts`, `RefinementBalance.ts`.
3. Giữ lại các phần phẩm chất/đặt tên/túi đồ còn đúng.

### Task 3: Dọn comment lỗi thời

**Files:** Modify 5 file liệt kê ở §2.3

**Steps:**
1. Đọc ngữ cảnh từng comment; sửa thành mô tả đúng hệ thống hiện tại (ActionImpactSystem) hoặc xóa nếu comment không còn giá trị.
2. Grep toàn `src/` các từ `missile`, `Missile` (case-insensitive) để bắt sót; chỉ giữ lại tên hợp lệ (vd variable nội bộ không liên quan).

### Task 4: Xử lý `docs/Plans .md`

**Steps:**
1. Đọc toàn bộ `Plans .md`, phân loại từng mục: (a) đã có trong code, (b) định hướng tương lai, (c) lỗi thời.
2. Mục (a): sáp nhập mô tả vào `game-guide.md` chỗ phù hợp.
3. Mục (b): thêm phần "Tham chiếu từ Plans .md cũ" vào plan roadmap tương ứng (Kim Đan/progression-depth) để không mất ý tưởng.
4. Mục (c): loại bỏ.
5. Xóa file `Plans .md`.

### Task 5: Quy ước chống lệch tái diễn

**Steps:**
1. Thêm 1 dòng vào cuối `game-guide.md` (mục Bảo trì tài liệu đã có sẵn): "Mọi thay đổi hành vi phải cập nhật mục tương ứng của file này trong cùng thay đổi code."
2. Thêm checklist vào `docs/roadmap.md` mục Quy trình thực hiện (đã có bước 4 — xác nhận không trùng).

## 5. Kiểm chứng

```powershell
npm.cmd run type-check
npm.cmd run build
```

- Không đổi code hành vi nên test không được thay đổi kết quả; chạy `npm.cmd run test` để xác nhận.
- Rà soát: mọi đường dẫn `src/...` xuất hiện trong `game-guide.md` và `item-design-reference.md` phải tồn tại (kiểm tra bằng glob/grep thủ công hoặc script một lần).
- Grep `missile` trong `src/` trả về 0 kết quả có ý nghĩa hệ thống cũ.

## 6. Rủi ro và lưu ý

- **Mô tả sai khi viết lại**: bắt buộc đọc file nguồn trước khi viết từng đoạn; không suy luận từ tài liệu cũ.
- **Xóa nhầm ý tưởng tương lai trong `Plans .md`**: bước phân loại phải hoàn tất và được ghi vào plan đích trước khi xóa file.
- Plan này không sửa `naming-conventions.md`, `wandering.md` và các plan khác — chỉ xử lý các điểm lệch đã liệt kê; nếu khi triển khai phát hiện thêm lệch mới, ghi vào mục "Phát sinh" của plan này thay vì mở rộng phạm vi vô hạn.

## 7. Phát sinh (khi thực hiện 2026-08-28)

- **Tham chiếu missile còn ở NGOÀI 5 file §2.3** (chỉ comment, không ảnh hưởng hành vi): `AilmentSystem.ts`, `AilmentRegistry.ts`, `Skill.ts`, `SkillEffect.ts`, `Skills.ts`, `CombatAction.ts`, `CombatTypes.ts`, `MainScene.ts`, `CombatSystem.ts` (dòng ~178/181), `CombatEntity.ts` (dòng ~186), `BattleSystem.ts` (dòng ~2175) và các battle test (`BattleSystem.countdown/hoaThe/earthPath/thachHoa/test.ts`). `BattleSystem.resolveMissiles()` KHÔNG còn tồn tại — các comment này stale. HOÃN sửa để tránh mở rộng phạm vi; khi dọn thì đổi sang `ActionImpactSystem`/impact.
- **`item-design-reference.md` §5** (`EquipmentSlotState`) vẫn mô tả `socketedFormation`/`bonusAffixSlots`/`appliedTalismanIds` — data ĐÚNG (field còn tồn tại); Phù/Trận đang giữ khóa, đã ghi chú ở §4 và §9.
- **`game-guide.md` mục Thiên Phú / Con đường tu luyện** đối chiếu code vẫn khớp, không phải sửa.
