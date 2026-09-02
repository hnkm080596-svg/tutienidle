# Task 9.2 + 9.3 + 9.7 + T4.1 i18n — QA Follow-ups & i18n Leftovers — Design Spec

**Ngày:** 2026-09-02
**Phạm vi:** Roadmap mục 8.1 (Task 9.2, 9.3, 9.7) + mục 7.2 (i18n 2.1, 2.2, 2.3, 2.5; 2.4/2.6 đã obsolete/done). KHÔNG gồm 2.7 (data content strings — P4 lớn, tách sau).
**Roadmap:** `game/docs/roadmap.md` mục 7.2, 8.1.
**UI/UX:** ui-ux-pro-max đã chạy cho focus trap (focus management, keyboard nav, focus ring guidance).

## 0. Nghiên cứu hiện trạng (verify trên code master `79bab1c`)

| Item | Trạng thái hôm nay |
|---|---|
| 2.1 vue-i18n v9→v11 | ✅ Còn — `9.14.5` trong package.json; composition API dùng nhất quán nên migration là version bump + audit |
| 2.2 String extraction | 🟡 Stale — BreakthroughRequirementPanel + EquipmentHallPanel ĐÃ xong (Task 9.1); còn: ActionAvailability.ts (đã chuyển sang `core/presentation/`), NodeInspector.vue, SkillDetailView.vue, HomeResourceStrip.vue, AlchemyView.vue, 6 combat overlay components. Ước ~35-55 chuỗi component-level |
| 2.3 formatStat extension | ✅ Còn — `SkillResourceStatLabels.ts:53` vẫn raw `(value * 100).toFixed(1)`; `formatStat()` chỉ nhận `keyof Stats` |
| 2.4 CombatStatusBar mpLabel | ❌ OBSOLETE — file đã xóa trong 6A; chỉ còn data field `mpLabel` chết (không consumer) |
| 2.5 Locale-coupled tests | ✅ Còn — 9 test files, ~20 assertions raw vi |
| 2.6 Parity test | ✅ ĐÃ DONE — `game/src/i18n/index.test.ts:67-92` so leaf-key vi↔en 2 chiều |
| QA-003 focus trap | ✅ Còn — OverlayPanel + ConfirmModal đều không có focus management; 13 consumers |
| QA-002 restore idempotency | ✅ Còn (latent) — `player.ts:298-346` không guard; 2 callers hiện chỉ gọi 1 lần |
| QA-007 isFinite | 🟡 Partial — validator đã chặn ở save-load (v55); `calculateOfflineProgress` vẫn nhân không guard |

## 1. Phần A — Focus trap cho OverlayPanel + ConfirmModal (Task 9.3, QA-003)

### 1.1. Kiến trúc

Tạo 1 composable dùng chung: `game/src/composables/useDialogFocus.ts`

```typescript
export function useDialogFocus(
  cardRef: Ref<HTMLElement | null>,
  open: Ref<boolean> | (() => boolean),
  options: { onEscape: () => void },
): void
```

Hành vi (gắn trong 2 primitives, 13 consumers kế thừa — không sửa consumer):

1. **On open** (watch open → nextTick): lưu `document.activeElement` (trigger), focus phần tử focusable đầu tiên trong card (hoặc chính card qua `tabindex="-1"` nếu không có).
2. **Tab/Shift+Tab** (keydown capture trên card): cycle trong danh sách focusable của card, wrap 2 chiều.
3. **Escape**: OverlayPanel → `emit('close')`; ConfirmModal → `emit('cancel')` (khớp semantics hành động đang pending — KHÔNG map thành confirm).
4. **On close/unmount**: restore focus vào trigger đã lưu (nếu vẫn còn trong document).
5. Không inert background (game 1 overlay; giữ scope tối thiểu). Không cần SSR guard (app không SSR).

### 1.2. Consumers (không sửa code, chỉ kế thừa)

OverlayPanel (9): FunctionOverlayPanel, BreakthroughRequirementPanel, ArtifactPanel, LuyenThePanel, SkillPathPanel, RealmPanel, QuestPanel, QuanKhiPanel, TechniquePanel.
ConfirmModal (4): SettingsPanel, QuanKhiPanel, SaveIncompatibleScreen, CombatExitConfirmModal.

### 1.3. Test

- Test mới trong jsdom (`// @vitest-environment jsdom`): focus-on-open, Tab cycle (không thoát ra ngoài), Escape đóng, focus restore sau close.
- Regression: `InkWashLargeSurfaces.test.ts` (assert click-outside close OverlayPanel) phải xanh nguyên trạng.
- Test jsdom mount pattern: `createApp + h + document.body.appendChild` (template `InkWashLargeSurfaces.test.ts:12-19`).

## 2. Phần B — restoreFromSave idempotency (Task 9.2, QA-002)

### 2.1. Thiết kế

Guard INSIDE `restoreFromSave` (single choke point phủ cả 2 callers). Dùng payload-identity check theo pattern sẵn có trong file (`lastExternalModifiers` Map ở player.ts:219, 240):

- Lưu identity của payload đã áp: `{ lastSavedAt: save.player.lastSavedAt, savedCultivation: save.player.cultivation }` (non-reactive, không persist — dev phase).
- Gọi lại với CÙNG payload → skip toàn bộ body (không Object.assign, không cộng offline).
- Gọi với payload KHÁC → áp đầy đủ (boot retry với save khác vẫn hoạt động).

Lý do chọn identity-check thay vì flag boolean: cho phép boot lại với save khác (flow recovery), không chặn nhầm.

### 2.2. Không được phá

- `SaveSystem.bootRestore.test.ts` spy `restoreFromSave` assert single-call — guard trong body không ảnh hưởng.
- Boot flow `restoreGameSession` (SaveSystem.ts:461) gọi 1 lần — hành vi giữ nguyên.
- Dev phase: flag không persist vào save.

### 2.3. Test mới

`game/src/stores/player.restoreFromSave.test.ts` (pattern theo player.*.test.ts hiện có):
1. Gọi 2 lần cùng save → offline cultivation chỉ cộng 1 lần.
2. Gọi lần 2 với save KHÁC (lastSavedAt khác) → áp đầy đủ.
3. Guard không phá normalization (artifact, combatAiStrategy, attackRange).

## 3. Phần C — isFinite guard trong calculateOfflineProgress (Task 9.7, QA-007)

### 3.1. Thiết kế

`OfflineProgressSystem.ts` — thêm guard giữ nguyên contract hiện có:

```typescript
cultivation: Number.isFinite(cultivationPerSecond)
  ? cultivationPerSecond * elapsedSeconds
  : 0,
```

- Validator save (root guard) giữ nguyên — đã merged, đủ cho boot path.
- Đây là defensive hardening cho consumer duy nhất (player.ts:305) + future callers.
- Không đụng clamp ở player.ts:338 (giữ nguyên — `Math.min(NaN, x) = NaN` là lý do guard phải ở source).

### 3.2. Test

Thêm vào `OfflineProgressSystem.test.ts`: NaN → 0, +Infinity → 0, -Infinity → 0 (bên cạnh negative-seconds case hiện có).

## 4. Phần D — i18n leftovers (T4.1: 2.1, 2.2, 2.3, 2.5)

### 4.1. 2.2 String extraction — phạm vi MỚI (bỏ 2 file đã xong)

Trích chuỗi + thêm keys vào vi.json/en.json cho:

| File | Chuỗi chính |
|---|---|
| `core/presentation/ActionAvailability.ts:26-59` | Bảng `ACTION_FAILURE_LABELS` 23 chuỗi + 2 fallback |
| `components/panels/skill-path/NodeInspector.vue` | ~7 chuỗi ('Đã đạt cấp tối đa.', label resource...) |
| `components/panels/skill-path/SkillDetailView.vue` | 'Chọn một kỹ năng…', 'Nâng Cấp (X Cảm Ngộ)', 'Tối đa', 'Hồi Chiêu', 'Tiêu Hao' |
| `components/game/HomeResourceStrip.vue` | 'Linh Thạch' (81), aria 'Hiện tài nguyên' (73), 'Ẩn dải tài nguyên' (96) |
| `components/panels/AlchemyView.vue` | REASON_LABELS (16-24), 'Linh Thạch' (287), 'Bắt đầu luyện' (295) |
| 6 combat overlay components | CombatAiPanel, CombatCountdownOverlay, CombatExitConfirmModal, CombatResultModal, CombatSceneOverlay, CombatTopBar — 1-3 chuỗi mỗi file |

Lưu ý:
- ActionAvailability.ts + AlchemyView REASON_LABELS là **module-level constants** — cần đổi thành keyed lookup (`t('actionFailure.' + reason)`) hoặc hàm nhận `t` — KHÔNG dùng i18n global `i18n.global.t` rải rác trong core (pattern: giữ mapping reason→key, component render qua `t`).
- Test mount KHÔNG có i18n hiện tại (HomeResourceStrip.test.ts, HomeBuildingIcons.test.ts) phải thêm `app.use(i18n)` sau khi component bắt đầu dùng `t`.

### 4.2. 2.3 formatStat extension + SkillResourceStatLabels labels/descriptions (user chốt: làm luôn, không defer 2.7 cho phần này)

Mở rộng `formatStat` (StatLabels.ts) hoặc thêm overload để `SkillResourceStatLabels.ts:53` route qua formatter dùng chung:
- PERCENT_KEYS (9 keys) → percent format như hiện tại.
- Type gap: `SkillResourceStatKey` ≠ `keyof Stats` — thêm union overload hoặc helper `formatSkillResourceStat` nội bộ gọi `formatNumber` + suffix % — quyết định tại plan, ưu tiên改动 nhỏ nhất không phá consumers (`NodeInspector.vue` là consumer duy nhất).
- **Labels + descriptions trong `SkillResourceStatLabels.ts:17-35`** (hardcoded vi ở data layer) — trích sang locale JSON. Consumer: `NodeInspector.vue` (render qua `t()`). Keys gợi ý: `skillResource.<statKey>.label` / `.description`. Đây là lần đầu data-layer stat labels vào locale — pattern dùng cho 2.7 sau này.

### 4.3. 2.5 Locale-coupled test assertions — user chốt: sửa HẾT 9 files

9 test files, ~20 assertions — chuyển sang assert qua `t('key')` resolution hoặc locale-independent assertion:

| Test file | Assertions |
|---|---|
| `HomeResourceStrip.test.ts:53,58,64` | 3 (cần thêm `app.use(i18n)` vào mount) |
| `MaterialBagFilter.test.ts:245,279,281` | 3 |
| `HomeBuildingIcons.test.ts:165,182,369` | 3 (mount hiện không i18n) |
| `InventorySort.test.ts:121,131` | 2 |
| `StageSelectPanel.test.ts:55,56` | 2 |
| `LeftPanel.building.test.ts:95,110` | 2 |
| `BreakthroughRequirementPanel.test.ts:52,62` | 2 |
| `RewardList.test.ts:71,104` | 2 |
| `InkWashMediumSurfaces.test.ts:65` | 1 |

Hướng sửa: assert qua `t('key')` (import i18n global singleton như các test đã dùng) thay vì raw vi — brittle-khi-đổi-locale được loại bỏ mà không cần mock locale. Test title tiếng Việt (nếu có) giữ nguyên — không phải assertion.

### 4.4. Cleanup `mpLabel` dead data field (user chốt: làm luôn)

- `core/technique/Technique.ts:110` — optional prop `mpLabel` không còn consumer nào (grep zero).
- Xóa field khỏi type + 3 data entries ở `data/technique/Techniques.ts:36,76,114` ('Linh Lực'/'Niệm Lực').
- Kiểm tra save shape: `mpLabel` có trong Technique snapshot save không — nếu có, xóa khỏi validator + `structureClone` snapshot path (dev phase, không migration).

### 4.5. 2.1 vue-i18n v9 → v11 migration

- `npm install vue-i18n@11` + audit API surface (createI18n schema generic, legacy:false, useScope:'local' — đều ổn định v9→v11).
- Chạy full test + build sau bump. Nếu v11 breaking-change đụng gì, xử lý tại chỗ.
- ĐỘC LẬP cuối cùng trong task (sau khi extraction ổn) — rollback dễ nếu v11 có vấn đề.

### 4.6. Items loại khỏi scope

- **2.4** — OBSOLETE (file xóa trong 6A); dead data field `mpLabel` đã chuyển thành 4.4.
- **2.6** — ĐÃ DONE (`i18n/index.test.ts:67-92`). Không làm lại.
- **2.7** — phần data content strings CÒN LẠI (materials names/lore, buffs, skills, buildings...) vẫn tách plan riêng sau — task này chỉ lấy SkillResourceStatLabels (4.2).

## 5. Hệ thống liên quan

| Hệ thống | File | Ghi chú |
|---|---|---|
| Vue primitives | OverlayPanel.vue, ConfirmModal.vue + useDialogFocus.ts (mới) | 13 consumers kế thừa |
| Player store | stores/player.ts (restoreFromSave) | Guard idempotency |
| Idle core | core/idle/OfflineProgressSystem.ts | isFinite guard |
| i18n locales | vi.json, en.json | Keys mới (actionFailure, skillPath, resourceStrip, alchemy, combat overlay) |
| Presentation | core/presentation/ActionAvailability.ts | Mapping reason→key |
| i18n runtime | i18n/index.ts + package.json | v9→v11 bump |
| Tests | ~12 files | Focus trap, restore, offline, locale assertions |

## 6. Phụ thuộc và rủi ro

- **Perf worktree đã merge (10/10)** — không còn song song đụng App.vue/player.ts. `phase7-gamemanager-split` (locked, 0 commits) có thể đụng GameManager.ts — spec này KHÔNG sửa GameManager.ts → không conflict.
- **Focus trap với CombatSceneOverlay** — CombatExitConfirmModal (ConfirmModal consumer) nằm trong combat overlay; Escape-to-cancel phải không phá flow thoát trận hiện có (CombatSceneOverlay.vue:101).
- **i18n v11 bump** là rủi ro lớn nhất — cô lập cuối task, full verify trước/sau.
- **save v55 validator đã chặn NaN** — guard offline là belt-and-suspenders, không phải fix chức năng người dùng thấy.

## 7. Thứ tự đề xuất

1. **Phần C** (isFinite — nhỏ nhất, độc lập).
2. **Phần B** (restoreFromSave idempotency).
3. **Phần A** (focus trap 2 primitives + tests).
4. **Phần D** (i18n: 4.2 formatStat+labels → 4.4 mpLabel cleanup → 4.1 extraction → 4.3 test assertions → 4.4→4.5 migration cuối).
5. Full verify matrix: test + type-check + build + e2e.

## 8. Notes

- **NodeInspector.vue hiển thị labels/descriptions từ SkillResourceStatLabels.ts** — user chốt làm luôn trong 4.2 (labels/descriptions vào locale). Data content strings còn lại (materials/buffs/skills/buildings) vẫn thuộc 2.7, tách plan riêng.
- **Số test assert raw vi trong test TITLE** (không phải assertion) giữ nguyên — không phải mục tiêu của 2.5.
- **save v55 validator đã chặn NaN cultivationPerSecond** — guard offline (Phần C) là belt-and-suspenders, không phải fix người dùng thấy.
