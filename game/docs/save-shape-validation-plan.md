# Kế hoạch Validate Shape Save

> ✅ **HOÀN THÀNH 2026-08-28** — `saveShapeValidation.ts` + `saveVersion.ts` đã implement, `SaveRoundTrip.test.ts` + `saveShapeValidation.test.ts` xanh. Đợt review 2026-08-28 bổ sung validate shape `equipment` (slot/equipped/mainStat/affixes/forgePoints) và `equipmentSlots` (slot/enhanceLevel) để chặn crash boot/NaN tại `refreshModifiers`. Giữ file làm tham chiếu quy ước thêm field bắt buộc.

> Thuộc Phase 0 của [roadmap.md](./roadmap.md). Plan này không thay đổi chính sách "không migration" của development phase — chỉ thêm lớp phát hiện save hỏng/thiếu field để không bao giờ crash boot âm thầm.

## 1. Mục tiêu

- Mọi save load vào đều được kiểm tra shape tối thiểu trước khi bất kỳ hệ thống nào chạm vào dữ liệu.
- Save thiếu/hỏng field trả về `LoadOutcome` rõ ràng (`corrupted` kèm lý do), không gây crash runtime ở `App.vue`/`GameManager`.
- Có test round-trip `buildGameSave()` → JSON → `loadGame()` để phát hiện sớm lỗi kiểu v47 (thiếu `nodeLevels` gây crash boot).

## 2. Hiện trạng và vấn đề

- `loadGame()` (`src/services/save/SaveSystem.ts:509`) chỉ kiểm tra: parse JSON được, `version` là number, version khớp `CURRENT_SAVE_VERSION`. Không kiểm tra shape của `player` hay bất kỳ field nào khác.
- Tiền lệ: comment v47 (`SaveSystem.ts:203-208`) ghi nhận save thiếu `nodeLevels` từng gây crash boot. Rủi ro này còn nguyên với mọi field bắt buộc mới thêm vào `PlayerData`/`GameSave`.
- `importSaveRaw()` (`SaveSystem.ts:611`) chỉ kiểm "parse được + có field `version`/`player`" rồi ghi thẳng — cùng lỗ hổng.
- `SaveSystem.test.ts` mới phủ version mismatch và thiếu field cấp cao nhất (version/player), chưa phủ shape sâu.

## 3. Thiết kế

### 3.1 Nguyên tắc

- Validator là pure function, không dependency runtime, đặt tại `src/services/save/saveShapeValidation.ts`.
- Chỉ validate **sự hiện diện và kiểu** của field bắt buộc — không validate giá trị gameplay (balance không thuộc lớp này).
- Lỗi trả về dạng danh sách đường dẫn field (vd `player.nodeLevels`, `materials[3].amount`) để log và hiển thị khi cần.
- Không dùng `any`; dùng type guard thu hẹp dần từ `unknown`.
- Không thêm dependency ngoài (không zod/yup) — validator viết tay theo đúng shape `GameSave`.

### 3.2 API đề xuất

```ts
export interface ShapeIssue {
  path: string
  message: string
}

export interface ShapeValidationResult {
  ok: boolean
  issues: ShapeIssue[]
}

export function validateGameSaveShape(parsed: unknown): ShapeValidationResult
```

### 3.3 Danh mục kiểm tra tối thiểu

Field bắt buộc của `GameSave` (theo interface `GameSave`, `SaveSystem.ts:357-390`):

| Field | Kiểm tra |
|---|---|
| `version` | number, bằng `CURRENT_SAVE_VERSION` |
| `player` | object, khác null |
| `techniques`, `skills`, `materials`, `equipment`, `pills`, `talismans`, `formations`, `buildings`, `equipmentSlots` | array |
| `productionSites`, `alchemyJobs`, `quests` | array/object hoặc `undefined` (field optional) |

Field bắt buộc của `PlayerData` (chọn các field từng gây lỗi hoặc là nền của hệ thống — danh sách chốt khi triển khai, đối chiếu `src/core/player/Player.ts`):

- `name`: string
- `realmId`: string; `realmLevel`: number hữu hạn ≥ 1
- `cultivation`, `cultivationRequired`: number hữu hạn ≥ 0
- `stats`: object
- `nodeLevels`: object (field từng gây crash v47)
- `talentIds`: array
- `skillLoadout` (hoặc tên field hiện hành trong `Player.ts`): array
- `lastSavedAt`: number hoặc vắng mặt (save rất cũ)

Quy tắc: danh sách field bắt buộc phải được **liệt kê tường minh trong validator**; khi thêm field bắt buộc mới vào `PlayerData`, task thêm field phải cập nhật validator + test trong cùng thay đổi (ghi vào checklist của plan này và quy ước trong `SaveSystem.ts`).

### 3.4 Tích hợp vào load flow

- `loadGame()`: sau khi version khớp, chạy `validateGameSaveShape(parsed)`. Nếu `!ok` → trả `{ status: 'corrupted', raw }` và `console.warn` danh sách issue (không ném exception).
- `importSaveRaw()`: chạy cùng validator trước khi ghi; nếu `!ok` → từ chối import, trả lỗi cho UI thay vì ghi save hỏng.
- Không đổi shape của `LoadOutcome` — `corrupted` đã tồn tại và `SaveIncompatibleScreen.vue` đã xử lý.

## 4. Nhiệm vụ triển khai

### Task 1: Validator thuần + test

**Files:**
- Create: `src/services/save/saveShapeValidation.ts`
- Test: `src/services/save/saveShapeValidation.test.ts`

**Steps:**
1. Viết test trước: save hợp lệ (lấy từ fixture `VALID_RAW` pattern trong `SaveSystem.test.ts`, mở rộng đủ field) → `ok: true`; lần lượt xóa/hỏng từng field bắt buộc → `ok: false` với `path` đúng.
2. Chạy test, xác nhận fail.
3. Implement `validateGameSaveShape` với type guard.
4. Chạy test tới xanh.

### Task 2: Tích hợp vào `loadGame()` và `importSaveRaw()`

**Files:**
- Modify: `src/services/save/SaveSystem.ts` (hàm `loadGame` ~line 509, `importSaveRaw` ~line 611)
- Test: `src/services/save/SaveSystem.test.ts`

**Steps:**
1. Viết test: raw JSON đúng version nhưng thiếu `player.nodeLevels` → `loadGame()` trả `corrupted`; import raw hỏng → bị từ chối, localStorage không đổi.
2. Chạy test, xác nhận fail.
3. Sửa `loadGame()`/`importSaveRaw()` theo §3.4.
4. Chạy lại toàn bộ `SaveSystem.test.ts` + `SaveMigration.test.ts` để chắc chắn không vỡ hành vi version mismatch/incompatible hiện có.

### Task 3: Test round-trip

**Files:**
- Test: `src/services/save/SaveRoundTrip.test.ts`

**Steps:**
1. Dựng `GameManager` + `PlayerData` đầy đủ qua đúng factory/helper mà các test GameManager đang dùng (tham khảo các file test trong `src/core/game/`).
2. `buildGameSave()` → `JSON.stringify` → `JSON.parse` → `validateGameSaveShape()` → kỳ vọng `ok: true`.
3. Thêm case: save sau khi chạy qua các thao tác đại diện (mua node, nhận loot, luyện đan) vẫn `ok: true`.
4. Test này là lưới an toàn chính: bất kỳ field bắt buộc mới nào thiếu trong save sẽ làm test đỏ.

### Task 4: Cập nhật tài liệu

- Thêm mục version comment trong `SaveSystem.ts` mô tả thay đổi (không bump version vì không đổi schema).
- Cập nhật `docs/game-guide.md` nếu mục save/persistence được nhắc (hiện không có mục riêng — thêm 1 dòng vào phần liên quan gần nhất hoặc bỏ qua nếu không có chỗ tự nhiên).

## 5. Kiểm chứng

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

- Test mới: validator phủ từng field bắt buộc; round-trip xanh.
- Test cũ: `SaveSystem.test.ts`, `SaveMigration.test.ts` không đổi kết quả.
- Thủ công: devtools sửa raw save trong localStorage (xóa 1 field) → reload → thấy `SaveIncompatibleScreen`, không crash console.

## 6. Rủi ro và lưu ý

- **False positive**: validator quá chặt với field optional sẽ chặn save hợp lệ. Mitigation: chỉ field trong danh sách §3.3 là bắt buộc; field optional chỉ kiểm kiểu khi hiện diện.
- **Trùng lặp định nghĩa shape**: validator dễ lệch khỏi `GameSave`/`PlayerData` khi schema đổi. Mitigation: round-trip test (Task 3) bắt buộc chạy qua `buildGameSave()` thật, nên lệch shape sẽ đỏ test.
- Không validate giá trị gameplay (vd `realmLevel` hợp lệ trong danh sách realm) — việc đó thuộc hệ thống load từng phần; plan này chỉ chặn crash shape.
