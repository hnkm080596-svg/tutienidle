# Survey — Combat In-Battle Controls & HUD (khảo sát nút bấm trong trận)

> Ngày: 2026-09-03 · Mục đích: nền tảng thiết kế nút ult chung mọi class + panel AI ult (plan thuan-he Task 14, đang DEFER) + đánh giá hướng turn-based.
> Phạm vi: mọi control người chơi bấm được trong lúc battle. Khảo sát trên code thực (không suy đoán từ comment).

## 1. Kiến trúc mount combat UI

```
GameRoot.vue:101 (v-if="isCombatSceneActive" — useCombatSceneActive)
  └─ CombatSceneOverlay.vue (overlay gốc; root pointer-events:none, con tự opt-in)
       ├─ CombatTopBar.vue (L89)            — hiển thị, KHÔNG nút
       ├─ CombatAiPanel.vue (L93)           — "AI Mục Tiêu" top-left
       ├─ CombatBuildHud.vue (L97)          — bottom-center = CHỖ SWITCH THEO CLASS
       │    switch (player.cultivationPath) — CombatBuildHud.vue:17-30:
       │      'phap_tu' → PhapTuCombatHud
       │      'kiem_tu' → KiemTuCombatHud
       │      default   → MortalCombatHud (path undefined = Phàm Nhân)
       ├─ CombatExitConfirmModal.vue (L101) — "Ở Lại"/"Thoát Trận"
       ├─ CombatResultModal → CombatVictoryPanel / CombatDefeatPanel
       └─ CombatCountdownOverlay.vue        — đếm 3-2-1, không nút
```

- Phaser `CombatScene.ts` chỉ vẽ canvas HUD display-only: `PlayerHudLayer.ts` (HP/MP/Kiếm bar) + buff icon tooltips (`combat-vfx-spawner.ts:206-216`). KHÔNG chọn Vue HUD — `CombatBuildHud` tự quyết.
- `CombatControlBar.vue` **đã bị xóa** (legacy 6A-T7/T8) — chỉ còn trong comment.

## 2. Nút bấm theo từng HUD class

| HUD | Nút/control | Điều kiện hiện | Handler |
|---|---|---|---|
| **MortalCombatHud** | KHÔNG có nút nào — 1 `CombatSkillSlot` (ô "Trảm") | luôn (Phàm Nhân) | — |
| **KiemTuCombatHud** | ⚔ Nút Ult (variant danger): "Tru Tiên Kiếm Trận"/"Kiếm Khai Thiên Môn"; disabled khi `!canFireUlt` | `v-if="ultInfo"` (path kiem_tu + ult đã học) | `gameManager.battleSystem.tryPlayerUltimate()` (L121-123) |
| | Toggle "Tự động" (checkbox) | như trên | `battleSystem.ultAutoEnabled` (writable computed, L77-82) |
| | Slider "Nhịp Tụ Lực" 3-9s | route `bat_kiem` | `setChannelTickSeconds('bat_kiem_thuat', s)` |
| **PhapTuCombatHud** | KHÔNG có nút — 5 `CombatSkillSlot` + `ArtifactCombatSlot` (display-only) | luôn (phap_tu) | — |
| **CombatExitConfirmModal** | "Ở Lại" / "Thoát Trận" | event `combat_exit_request` + `combatOrigin === 'stage'` | `abandonBattle()` → `exitCombatScene()` |
| **CombatVictoryPanel** | "Đánh Lại" (+ auto 3s progress mode) / "Tiếp Tục" (manual) | victory | `useAutoRetryCountdown` + `exitCombatScene()` |
| **CombatDefeatPanel** | "Tái Chiến" (auto 3s repeat mode) / "Về Động Phủ" | defeat | như trên |

## 3. Thống nhất chung

- **Không có pause, speed control, nút rút lui giữa trận.** CombatTopBar comment L8-9 xác nhận cố ý.
- ⚠️ **Exit zone canvas có vẻ chưa nối**: `CombatScene.requestCombatExit()` (CombatScene.ts:1445) không có caller production nào (chỉ test `CombatScene.hudWiring.test.ts:138`). Modal confirm đã đầy đủ.
- i18n: các panel ngoài HUD dùng `vue-i18n` (`combat.overlay.*`, `combat.victory.*`…). **Các HUD class hardcode tiếng Việt** (KiemTu "Nhịp Tụ Lực"/"Tự động"/tên ult; PhapTu "Chưa Mở"/"Trống"; CombatSkillSlot "Trống"/"Chưa Ra Mắt"; ArtifactCombatSlot "Ngũ Hành Châu").
- `GameButton.vue` props: variant primary/secondary/danger/ghost, size sm/md/lg, shape rect/circle, accentVar, disabled, loading.
- `CombatSkillSlot.vue` display-only (không click) — props remaining/total, cast bar, resource cost, tooltip.

## 4. Engine seams liên quan ult (đã có sẵn, không cần sửa engine)

| Seam | Vị trí | Ghi chú |
|---|---|---|
| `battleSystem.tryPlayerUltimate(): 'ttkt'\|'kktm'\|'ult'\|null` | BattleSystem.ts:2638 | **Điểm vào chung đã route đúng class** (Kiếm Tu/Pháp Tu) — nút chung khả thi không đụng engine |
| `battleSystem.ultAutoEnabled: boolean` (public) | BattleSystem.ts:275 | Toggle auto dùng chung; auto-tick 1s tại update() L1031-1051 |
| `canUseUltimate(battle, route, swordCount)` | UltimateSystem.ts:41 | Gate enable nút Kiếm Tu |
| `canUsePhapTuUltimate(battle)` | UltimateSystem.ts:249 | Gate enable nút Pháp Tu (Thế ≥ trần có bonus) |
| `autoPhapTuUltimateDecision(battle, element)` | UltimateSystem.ts:255 | Auto chỉ bắn khi có boss — hệ quả: farm không boss → Thế không tiêu (QA-2026-09-03-002) |
| `getPhapTuThuanElement()` | GameManager.ts (Task 12) | undefined = không phải Pháp Tu Thuần → ẩn nút |

## 5. Hàm ý thiết kế (Task 14 — nút ult chung + panel AI ult)

1. **Nút ult chung** đặt ở `CombatBuildHud` (ngoài HUD riêng từng class) hoặc sibling của Build HUD trong `CombatSceneOverlay`:
   - Kiếm Tu: label tên ult route + ⚔, disabled theo `canUseUltimate`
   - Pháp Tu: label tên ult theo hành Thuần + ⚔ (hoặc "Đạo Sắc"), disabled theo `canUsePhapTuUltimate`, tooltip thể hiện Thế hiện tại/trần
   - Phàm Nhân: ẩn hoàn toàn (không có ult)
2. **Panel AI ult** cạnh `CombatAiPanel` (top-left): toggle "Tự động" (chung `ultAutoEnabled`) + hiển thị điều kiện auto từng class (Kiếm Tu: đủ cost; Pháp Tu: boss + Thế đầy) + trạng thái Thế (Pháp Tu) / Kiếm Ý (Kiếm Tu).
3. i18n: nên dùng `combat.overlay.*` mới cho nút/panel chung (họ i18n đã có sẵn), tránh lặp pattern hardcode cũ.
4. Cần verify exit-zone canvas khi đụng UX thoát trận.
