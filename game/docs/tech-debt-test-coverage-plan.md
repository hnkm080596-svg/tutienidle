# Kế hoạch Nợ Kỹ thuật & Phủ Test

> Thuộc Phase 4 của [roadmap.md](./roadmap.md) — chạy nền song song, không chặn phase khác. Mỗi task trong plan này phải nhỏ để có thể xen giữa các plan tính năng.

## 1. Mục tiêu

- `GameManager.ts` (2.703 dòng / ~96KB / ~124 method) giảm dần thành facade, không còn god object.
- Mọi hệ thống core có ít nhất test hành vi chính; ưu tiên hệ kinh tế đang 0 test.
- Luồng sống còn (boot → tạo nhân vật → combat → autosave → reload) có E2E.
- Có lint trong quy trình dev.
- Rủi ro dependency (Vue `rc` + 13 overrides) được ghi nhận và có chính sách.

## 2. Hiện trạng

- **GameManager**: đã tách được `StageWaveSystem`, `BattleLootSystem`, `TribulationSystem` nhưng vẫn giữ ~124 method; 24 file test đang bám trực tiếp vào nó.
- **Test**: 154 file `*.test.ts` (vitest, co-located). Phân bố lệch:
  - 0 test: `core/buff`, `core/formation`, `core/inventory`, `core/item`, `core/player`, `core/alchemy`, `core/talisman`, `core/talent`, `core/math`, `core/notification`, `core/presentation`, `core/events`.
  - Thiếu cân đối: `equipment` 18 src/3 test, `stats` 8/1, `enemy` 6/1, `building` 7/1.
- **E2E**: 1 spec duy nhất (`tests/e2e/combat-particle.spec.ts`); `playwright.config.ts` và script `test:e2e` đã có sẵn.
- **Lint**: không có script lint trong `package.json`; chỉ có Prettier.
- **Dependency**: `vue: "rc"` + 13 override `rc` (Vue Vapor era), `typescript ~6.0.0`, `phaser ^4.2.1` — toàn bản mới/cạnh biên.
- Vết kỹ thuật `SkillSystem.canUseInSlot` mutate state và legacy `use()`/`Skill.castTime` đã được nhận trong [combat-balance-pass-plan.md](./combat-balance-pass-plan.md) §3.7 — không lặp ở đây.

## 3. Thiết kế

### 3.1 Tách GameManager — chiến lược "facade trước, ruột sau"

Nguyên tắc:
- Không đổi hành vi, không đổi API công khai trong lúc tách; GameManager giữ method signature cũ, delegate sang module mới. Caller (App.vue, stores, composables) không phải sửa ở bước tách.
- Mỗi lần tách đúng một cụm, test xanh rồi mới tách cụm kế. Không refactor kèm tính năng.

Thứ tự tách theo ranh giới đã rõ (cụm nào ít dính với method khác trước):

| Đợt | Cụm | Module đề xuất | Ghi chú |
|---|---|---|---|
| 1 | Job sản xuất/luyện đan: settle, offline settle, tick | `src/core/game/JobOrchestrator.ts` | Đã có `ProductionSystem`/`AlchemySystem` riêng — GameManager chỉ còn orchestrate, gom về một mối |
| 2 | Mua/bán thao tác: `purchaseNode`, craft token, cường hóa delegate | `src/core/game/PurchaseOperations.ts` | Validation nằm tại system chuyên, module này chỉ điều phối |
| 3 | Vòng đời trận: bắt đầu/kết thúc trận, chuyển scene, loot grant | `src/core/game/BattleFlow.ts` | Phối hợp `StageWaveSystem`/`BattleLootSystem` hiện có |
| 4 | Đột phá/quán khí/chọn path | `src/core/game/BreakthroughFlow.ts` | Đã có `TribulationSystem`, `useBreakthrough` — gom phần còn lại |

Mục tiêu định lượng: sau 4 đợt, `GameManager.ts` < ~1.000 dòng, chỉ còn wiring + state ownership. Nếu đợt nào làm test vỡ diện rộng, dừng và tách nhỏ hơn — không cố.

### 3.2 Phủ test — ưu tiên theo rủi ro kinh tế

Mỗi hệ thống 0 test thêm file test hành vi chính (không chạy theo coverage % hình thức):

| Hệ thống | Test tối thiểu |
|---|---|
| `inventory` (MaterialBag/túi) | add/remove/overflow/sort, guard amount ≤ 0 |
| `alchemy` | reserve atomic job, hoàn thành/trả nguyên liệu khi hủy, tỷ lệ thành đan |
| `buff` | apply/expire/stack rule, buff xung đột |
| `player` | stat assembly từ các source, attribute point |
| `item` | quality/rarity roll range, forgePotential |
| `talent` | (đã có trong talent-effects plan — không lặp) |
| `formation`/`talisman` | chỉ test phần còn sống sau khi Phù/Trận khai tử; nếu hoàn toàn chết, xóa code thay vì viết test |
| `math`/`events`/`notification`/`presentation` | test nhanh các hàm thuần |

Quy tắc: test mới đặt co-located (`*.test.ts` cạnh source) theo convention hiện có; dùng factory/helper hiện có, không dựng fixture song song.

### 3.3 E2E luồng sống còn

Thêm spec trong `tests/e2e/` (Playwright hiện có):

1. `boot-fresh.spec.ts`: boot không save → thấy màn tạo nhân vật.
2. `create-to-combat.spec.ts`: tạo nhân vật (chọn 3 thiên phú) → vào Động Phủ → bắt đầu trận → thắng/thua hiển thị kết quả.
3. `save-reload.spec.ts`: chơi 1 đoạn → reload trang → nhân vật và tài nguyên giữ nguyên (autosave hoạt động).

Selector bám `data-testid` — thêm attribute còn thiếu vào component khi viết spec (không sửa logic component).

### 3.4 Lint

- Thêm ESLint flat config với `typescript-eslint` + `eslint-plugin-vue`; script `"lint": "eslint ."` và `"lint:fix"`.
- Giai đoạn 1: bật rule ở mức `warn` toàn repo để không chặn dev; bật `error` cho thư mục `src/core/` trước (ít nợ nhất), mở rộng dần.
- Rule tối thiểu có giá trị: no-unused-vars, no-explicit-any (theo AGENTS.md "không dùng any"), prefer-const. Không thêm plugin ngoài 2 gói trên trừ khi cần thật.
- Đây là dependency mới — được phép vì là yêu cầu trực tiếp của plan (ngoại lệ quy tắc "không thêm dependency").

### 3.5 Chính sách dependency

- Không nâng Vue khỏi `rc` trong plan này (rủi ro Vapor/compat đang có chủ đích — 13 override cho thấy đã được cân nhắc). Thay vào đó:
  - Ghi vào `package.json` (comment không được hỗ trợ → dùng file `docs/dependency-policy.md` ngắn): lý do pin `rc`, điều kiện để lên bản stable (Vue stable tương thích vue-tsc/vite plugin đang dùng), người kiểm tra định kỳ.
  - Mỗi lần `npm install` thất bại hoặc CI vỡ do rc: ưu tiên pin xuống bản cụ thể gần nhất thay vì đuổi theo rc mới.

## 4. Nhiệm vụ triển khai

1. **Task 1**: Tách GameManager đợt 1 (JobOrchestrator).
2. **Task 2**: Tách đợt 2 (PurchaseOperations).
3. **Task 3**: Tách đợt 3 (BattleFlow).
4. **Task 4**: Tách đợt 4 (BreakthroughFlow).
5. **Task 5–10**: Test cho inventory, alchemy, buff, player, item, math/events/notification/presentation (mỗi task một hệ thống).
6. **Task 11**: Rà soát formation/talisman — xóa phần chết hoặc viết test tối thiểu.
7. **Task 12**: 3 spec E2E (§3.3).
8. **Task 13**: ESLint setup + script + bật error cho `src/core/`.
9. **Task 14**: `docs/dependency-policy.md`.

Mỗi task độc lập, kết thúc bằng test xanh + type-check; Task 13 kết thúc bằng `npm.cmd run lint` chạy được.

## 5. Kiểm chứng

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run lint
```

- Sau mỗi đợt tách GameManager: toàn bộ 24 file test GameManager hiện có xanh không sửa (ngoại lệ phải có lý do ghi trong commit).
- Đếm dòng `GameManager.ts` giảm theo từng đợt, cuối cùng < ~1.000 dòng.
- E2E chạy xanh trên Chromium; save-reload không flaky (chờ autosave deterministic hoặc trigger save trực tiếp trong test).

## 6. Rủi ro và lưu ý

- **Tách GameManager gây regression ẩn**: chỉ tách khi cụm có test phủ; cụm chưa có test thì thêm test trước khi tách (đặc biệt đợt 3 — battle flow).
- **E2E flaky do Phaser canvas**: ưu tiên assert qua DOM/UI state; chỉ tương tác canvas khi bắt buộc, dùng tọa độ ổn định từ `DesignFrame`/insets.
- **Lint tạo núi cảnh báo**: giữ giai đoạn warn đủ lâu để dọn dần; không bật error toàn repo một lần.
- Plan này không sửa logic gameplay — nếu khi tách phát hiện bug, ghi nhận và tách task riêng, không trộn vào commit refactor.
