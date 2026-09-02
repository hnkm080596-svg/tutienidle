# Task 9.1 — Breakthrough Confirm Panel — Design Spec

**Ngày:** 2026-09-02 (v5 — panel double-check CHO MỌI lần Độ Kiếp, auto-unequip idempotent)
**Phạm vi:** Roadmap Giai đoạn 9, Task 9.1 (QA-2026-09-02-001). Khi bấm Đột Phá/Quán Khí → pop panel xác nhận; "Đã hiểu" → auto-unequip (idempotent) → vào Độ Kiếp; "Chờ đã" → hủy.
**Roadmap:** `game/docs/roadmap.md` mục 8.2.
**UI/UX:** ui-ux-pro-max đã chạy (focus trap, focus ring, keyboard nav).

## 0. Quyết định thiết kế đã chốt (user 2026-09-02)

- **Pop panel CHO MỌI lần Độ Kiếp/Quán Khí**, bất kể người chơi có trang bị hay không — double-check trước khi vào kiếp.
- Flow: bấm "Độ Kiếp"/"Quán Khí" → panel → "Đã hiểu" → auto-unequip tất cả → vào kiếp.
- Auto-unequip luôn chạy khi bấm "Đã hiểu" (idempotent — không có đồ thì không tháo gì, nhưng vẫn an toàn).
- **Áp cho MỌI cảnh giới** (Quán Khí mortal→qi_refining, Trúc Cơ, Kim Đan+ khi có content).
- Mọi string qua i18n.
- **`chooseCultivationPath` KHÔNG liên quan** — chọn path SAU khi đã vào Luyện Khí.
- Giữ `resolveVictory` auto-unequip (defense-in-depth, idempotent).

## 1. Kiến trúc

### 1.1. Gộp 3 hàm trigger thành 1

**Hiện tại:** `useTribulation.ts` có 3 function.
**Mới:** 1 function duy nhất, trả về `boolean` (giống kiểu cũ):

```typescript
export function triggerBreakthroughAction(
  player: PlayerStore,
  gameManager: GameManager,
): boolean
```

Hành vi:
1. Kiểm tra `canTriggerBreakthrough(player.$state)` — unified gate thay 2 hàm cũ.
2. Kiểm tra battle in progress.
3. Resolve targetRealmId từ player.realmId.
4. **Luôn gọi `unequipAllEquipment()`** + `player.setEquipmentModifiers(gameManager.getEquipmentModifiers())` trước khi vào kiếp — idempotent, không hại nếu không có đồ.
5. `startTribulation()`.
6. Nếu thành công → `useUiStore().enterTribulationScene()`.

### 1.2. Control flow (caller + panel)

**Caller (BreakthroughRequirementPanel, RealmPanel):**

```typescript
const showConfirmPanel = ref(false)
const pendingTargetRealmId = ref<string | null>(null)

function onStartBreakthrough() {
  if (!gameManager.canTriggerBreakthrough(player.$state)) return
  const targetId = resolveNextBreakthroughRealm(player.realmId)
  if (!targetId) return
  pendingTargetRealmId.value = targetId
  showConfirmPanel.value = true
}

function onConfirmBreakthrough() {
  showConfirmPanel.value = false
  const started = triggerBreakthroughAction(player, gameManager)
  if (started) {
    // đóng panel caller (store.close() / ui.closeHomeOverlays())
  }
}

function onCancelBreakthrough() {
  showConfirmPanel.value = false
}
```

Panel UI:
- `OverlayPanel` primitive (giống BreakthroughRequirementPanel).
- Title: `t('tribulation.stillEquipped.title')`.
- Dòng phụ (màu đỏ): `t('tribulation.stillEquipped.subtitle')`.
- Nút: `t('tribulation.stillEquipped.confirm')` = "Đã hiểu" → auto-unequip + vào kiếp.
- Nút: `t('tribulation.stillEquipped.cancel')` = "Chờ đã" → tắt panel.

### 1.3. `canTriggerBreakthrough` unified ở `GameManager`

Thay 2 hàm cũ bằng 1:

```typescript
canTriggerBreakthrough(player: PlayerData): boolean {
  if (player.realmId === 'mortal' || player.realmId === 'qi_refining') {
    return player.realmLevel >= CORE_REALM_LEVEL
  }
  return false
}
```

### 1.4. Caller thay đổi

| File | Thay đổi |
|---|---|
| `useTribulation.ts` | Xoá 3 hàm cũ. `triggerBreakthroughAction` mới: check gate + auto-unequip + startTribulation. |
| `GameManager.ts` | Xoá `canTriggerFoundationBreakthrough` + `canTriggerRealmBreakthrough`; thêm `canTriggerBreakthrough`. |
| `BreakthroughRequirementPanel.vue` | `confirmBreakthrough()` → `showConfirmPanel = true`. "Đã hiểu" → `triggerBreakthroughAction`. |
| `RealmPanel.vue` | `majorBreakthrough()` → `showConfirmPanel = true`. "Đã hiểu" → `triggerBreakthroughAction`. |
| `QuanKhiPanel.vue` | Không đổi (chọn path ĐÃ ở trong Luyện Khí). |

## 2. i18n keys

`vi.json` + `en.json`:

```json
"tribulation": {
  "stillEquipped": {
    "title": "Độ kiếp cũng là độ thân, không gì có thể giúp được ngươi",
    "subtitle": "Không thể mặc trang bị khi độ kiếp",
    "confirm": "Đã hiểu",
    "cancel": "Chờ đã"
  }
}
```

## 3. Hệ thống liên quan

- `game/src/composables/useTribulation.ts` — trigger + resolver
- `game/src/core/game/GameManager.ts` — `canTriggerBreakthrough`
- `game/src/components/common/BreakthroughRequirementPanel.vue` — pop confirm
- `game/src/components/panels/RealmPanel.vue` — pop confirm
- `game/src/components/common/OverlayPanel.vue` — primitive
- `game/src/locales/vi.json` + `en.json` — 4 key
- `game/src/composables/useTribulation.dotPha.test.ts` — cập nhật
- `game/src/core/game/GameManager.dotPha.test.ts` — cập nhật
- `game/src/core/game/GameManager.realmAdvanceUnequip.test.ts` — sửa kỳ vọng

## 4. Test

- Sửa `useTribulation.dotPha.test.ts`: test mới cho auto-unequip IN `triggerBreakthroughAction`, không chỉ ở `resolveVictory`.
- Sửa `GameManager.realmAdvanceUnequip.test.ts`: `chooseCultivationPath` không auto-unequip → kỳ vọng weapon vẫn equipped.
- Cập nhật test gọi `canTriggerFoundationBreakthrough`/`canTriggerRealmBreakthrough` → `canTriggerBreakthrough`.

## 5. Rủi ro

- Auto-unequip luôn chạy trước Độ Kiếp, kể cả không có đồ — idempotent, an toàn.
- `chooseCultivationPath` không tháo đồ — người chơi vào Luyện Khí với đồ Phàm Nhân. Đã chốt "không liên quan" (là bước chọn path sau khi đã độ kiếp xong).