# Combat Overlay Layering Repair — Design Spec

**Ngày:** 2026-09-02
**Phát hiện:** User report "bảng chọn mục tiêu bị lỗi hình ảnh" + UI/UX review đợt thay đổi 6A.
**Phạm vi:** Khôi phục positioning/z-index bị mất của `CombatSceneOverlay.vue` + rà toàn bộ lớp chồng đẻ trong combat scene (canvas HUD vs DOM overlay vs modals).
**Ràng buộc:** Không đổi architecture; không thêm dependency; AGENTS.md UI Layout Rule áp dụng.

---

## 1. Root cause (đã chứng minh bằng git)

Commit `991ba75` (6A T8 — "remove 3 DOM bars, overlay top-only") viết lại `CombatSceneOverlay.vue` bằng `write` toàn file **và bỏ luôn `<style scoped>` block** (xem `git show 71357a1^:...CombatSceneOverlay.vue` L133-178). 4 style rules bị mất:

| Selector cũ (71357a1^) | Vai trò | Hậu quả khi mất |
|---|---|---|
| `.combat-scene-overlay` | `position: absolute; inset: 0; z-index: 15; flex column; pointer-events: none` | Overlay không còn phủ canvas — render trong document flow, có thể chiếm chiều cao thật, đẩy layout lệch |
| `.combat-scene-overlay__battlefield` | `flex: 1 1 auto; position: relative; pointer-events: none` | Vùng chứa 2 panel con không giãn → panel con không có containing block để absolute neo |
| `.combat-scene-overlay__ai-panel` | `position: absolute; left: var(--space-3); top: var(--space-3); z-index: 12` | **AI Mục Tiêu panel (bảng chọn mục tiêu) rơi vào flow** → tràn giữa battlefield, đè artwork, "lỗi hình ảnh" user thấy |
| `.combat-scene-overlay__build-hud` | `position: absolute; left/right: 0; bottom: var(--space-4); display: flex; justify-content: center; z-index: 12` | Build HUD (skill slot + slider tụ lực + ult) mất neo bottom-center |

Giữ lại từ cũ (không cần khôi phục): `--combat-status-h/-event-h/-control-h` (đã xóa chủ ý, Task 8 đúng), `.combat-scene-overlay__top-bar` height var (cần khôi phục).

## 2. Kiểm kê toàn bộ lớp (z-axis map) — hiện trạng mong muốn

```
z  0        Phaser canvas (PhaserCanvas.vue, static)
z  15       .combat-scene-overlay (root, pointer-events: none)
z  15.1       .combat-scene-overlay__top-bar (flow đầu, height var(--combat-topbar-h))
z  12*         .combat-scene-overlay__ai-panel (absolute trái-trên, trong battlefield)
z  12*         .combat-scene-overlay__build-hud (absolute giữa-dưới, trong battlefield)
z  DEPTH+2   PlayerHudLayer (canvas góc TRÁI-DƯỚI — Phaser depth 802, không phải DOM)
z  50        .combat-exit-confirm__overlay (CombatExitConfirmModal, fixed)
z  30        CombatResultModal
z  12        CombatCountdownOverlay
```
*(`z-index: 12` trong context battlefield stacking; ai-panel/build-hud cũ dùng 12 — khôi phục nguyên giá trị.)*

## 3. Các cặp đè cần rà (sau khi khôi phục)

| # | Cặp | Phân tích | Hành động |
|---|---|---|---|
| O1 | **PlayerHudLayer (canvas, trái-dưới) vs CombatBuildHud (DOM, giữa-dưới)** | HUD HP neo `HUD_MARGIN=16` từ cạnh trái + width 180px → chiếm x≈16-196. Build HUD `left:0; right:0; bottom: var(--space-4)` flex-center → tâm màn hình. Ở viewport hẹp (≤900px) khoảng cách tâm-to-HUD có thể < 200px → **chồng lề** | Layout guard: min-gap giữa HUD-phải-cạnh (x≈196) và Build HUD mép trái; nếu overlap → Build HUD dịch phải `left: max(0, 220px - viewportWidth*0)` hoặc HUD thu nhỏ. Ước: chỉ thêm `padding-left: 200px` an toàn cho build-hud khi viewport < 1100px (media query) — KHÔNG hardcode cột |
| O2 | **CombatAiPanel (trái-trên) vs CombatTopBar (flow đầu)** | AiPanel absolute top `var(--space-3)` **trong battlefield** (đã trừ topbar qua flex layout) → không đè. An toàn | None — chỉ verify |
| O3 | **CombatAiPanel vs PlayerHudLayer** | AiPanel trên-trái, HUD dưới-trái. Chiều cao ai-panel ~5 options × tap-min (~44px) + title ≈ 260px. Battlefield height = viewport - topbar (~64). Ở viewport thấp (<700px): 64+260+HUD(~80) > 700 → **có thể đè** | Media query (height): ai-panel thu gap/max-height scroll; hoặc HUD scale |
| O4 | **ExitConfirmModal (z-50 fixed) vs tất cả** | Đúng thiết kế — modal trên cùng | None |
| O5 | **Floating text (Phaser depth 807) vs HUD (depth 802)** | HUD vẽ dưới floating text — chấp nhận được (text bay qua HUD hiếm, chấp nhận) — hoặc raise HUD depth +10 | Verify visual, chỉ nâng depth nếutext che số HP thường xuyên |
| O6 | **CombatCountdownOverlay (z-12) vs AiPanel (z-12 trong overlay)** | Countdown full-viewport pointer-events? Kiểm sync — countdown che wheel thì phải để click穿透 | Verify: countdown phải `pointer-events: none` trừ nút của nó |

## 4. Yêu cầu khôi phục (spec bắt buộc)

1. **Khôi phục `<style scoped>` block** trong `CombatSceneOverlay.vue` với 4 selectors ở bảng §1 — **nguyên giá trị cũ** cho ai-panel/build-hud/battlefield/root; xóa các rule status/event/control (đã retire).
2. **O1 layout guard**: build-hud thêm responsive offset tránh HUD canvas (xem §3 O1) — theo AGENTS.md: đo thật, không hardcode cột; media query hợp lệ.
3. **O3 vertical guard**: ai-panel max-height + overflow-y: auto dưới viewport ngắn (tall-portrait mobile).
4. **E2e visual smoke**: screenshot combat tại 3 viewports có gameRoot + battle active, assert ai-panel bounding box góc trái-top trong battlefield, không giao HUD box (O1/O3) — mở rộng ink-wash-ui hoặc spec mới `combat-overlay-layout.spec.ts`.
5. **Unit test guard (Vitest, jsdom)**: mount overlay → assert root style absolute+inset0, ai-panel computed position absolute — chống regression tái diễn (test đọc computed style sau mount thật).

## 5. Ngoài phạm vi

- Enhance tab pity/rate display (đã có trong review C3, Task 20 plan rework)
- Focus trap modals (H5 review — task riêng)
- Tooltip + terminology sweep (Task 19-21 plan rework)
