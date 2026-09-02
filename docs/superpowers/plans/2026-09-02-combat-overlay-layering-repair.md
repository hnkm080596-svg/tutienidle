# Combat Overlay Layering Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline — user yêu cầu inline, KHÔNG subagent). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khôi phục styles bị mất của `CombatSceneOverlay.vue` (root cause: commit 991ba75 xóa `<style scoped>`) + guard chống chồng đẻ giữa canvas HUD (PlayerHudLayer) và DOM panels (AiPanel/BuildHud) + regression tests.

**Architecture:** Khôi phục 4 CSS selectors nguyên bản + thêm 2 responsive guards (media query theo container thật — AGENTS.md flexible rule) + 1 vitest jsdom style-contract + 1 e2e layout smoke.

**Tech Stack:** Vue 3 scoped CSS, Vitest jsdom, Playwright. Không dependency mới.

**Spec:** `docs/superpowers/specs/2026-09-02-combat-overlay-layering-repair-design.md`

## Global Constraints

- Chỉ khôi phục nguyên giá trị cũ từ `git show 71357a1^:game/src/components/game/combat/CombatSceneOverlay.vue` — KHÔNG "cải thiện" theo ý riêng.
- KHÔNG đụng file ngoài scope: PlayerHudLayer.ts, CombatAiPanel.vue, CombatBuildHud.vue (chỉ overlay + test + e2e).
- AGENTS.md UI Layout Rule: guards phải đo từ container thật (media query / resize-based), KHÔNG hardcode px theo màn hình dev.
- Verify: type-check + focused vitest + build + e2e ink-wash + spec mới.
- Worktree riêng (branch từ master), commit theo task, KHÔNG merge nếu không có lệnh.

---

### Task 1: Khôi phục style scoped + style-contract test (RED→GREEN)

**Files:**
- Modify: `game/src/core/../components/game/combat/CombatSceneOverlay.vue` (thêm lại `<style scoped>` sau `</template>`)
- Create: `game/src/components/game/combat/CombatSceneOverlay.style.test.ts`

**Interfaces (khôi phục nguyên bản từ 71357a1^):**

```css
.combat-scene-overlay {
  position: absolute;
  inset: 0;
  z-index: 15;
  display: flex;
  flex-direction: column;
  pointer-events: none;
  font-family: var(--font-body);
}

.combat-scene-overlay__top-bar {
  flex: 0 0 auto;
  height: var(--combat-topbar-h);
}

.combat-scene-overlay__battlefield {
  position: relative;
  flex: 1 1 auto;
  pointer-events: none;
}

/* Combat AI panel (plan §11.1) — góc trái battlefield. */
.combat-scene-overlay__ai-panel {
  position: absolute;
  left: var(--space-3);
  top: var(--space-3);
  z-index: 12;
}

.combat-scene-overlay__build-hud {
  position: absolute;
  left: 0;
  right: 0;
  bottom: var(--space-4);
  display: flex;
  justify-content: center;
  z-index: 12;
}
```

- [ ] **Step 1 — RED:** Viết `CombatSceneOverlay.style.test.ts` (jsdom, createApp+h mount theo pattern project): mount overlay → query `.combat-scene-overlay` computed style — assert `position: absolute`; query `.combat-scene-overlay__ai-panel` — assert `position: absolute`; query `.combat-scene-overlay__build-hud` — assert `position: absolute` + `bottom`. Chạy → FAIL (style còn thiếu — hiện file không có style block).
- [ ] **Step 2:** Thêm lại `<style scoped>` block đúng bảng trên (copy từ `git show 71357a1^`). 
- [ ] **Step 3 — GREEN:** Vitest focused PASS. `npm.cmd run type-check` PASS.
- [ ] **Step 4:** Commit `fix(combat-ui): restore CombatSceneOverlay scoped styles lost in T8 rewrite (991ba75)` — body nêu root cause + 4 selectors khôi phục + ảnh hưởng (ai-panel/build-hud neo lại, root phủ canvas).

### Task 2: Overlap guards (O1 horizontal + O3 vertical)

**Files:**
- Modify: `CombatSceneOverlay.vue` (chỉ `<style scoped>`)

**Thiết kế (spec §3):**

```css
/* O1 — viewport hẹp: HUD canvas trái-dưới (x≈16-196px) vs Build HUD
   flex-center. Dưới 1100px, dịch nội dung build-hud ra khỏi vùng HUD
   thay vì để skill slot/slider đè số HP. KHÔNG hardcode cột — media
   query theo viewport thật của overlay. */
@media (max-width: 1100px) {
  .combat-scene-overlay__build-hud {
    padding-left: 210px; /* = HUD width 180 + margin 16 + gap 14 */
  }
}

/* O3 — viewport thấp: AiPanel không đủ chỗ dọc (topbar ~64 + 5 options
   ×44 + title) → cho scroll trong panel thay vì đè HUD dưới-trái. */
@media (max-height: 700px) {
  .combat-scene-overlay__ai-panel {
    max-height: calc(100% - 180px); /* chừa vùng HUD-dưới (~80px) + buffer */
    overflow-y: auto;
  }
}
```

- [ ] **Step 1:** Thêm 2 guards trên (giá trị 210px/180px là derived từ constants thật của PlayerHudLayer: `HUD_MARGIN=16 + HUD_HP_WIDTH=180 + gap≈14` — comment dẫn nguồn, đổi khi HUD đổi).
- [ ] **Step 2:** Style-contract test Task 1 thêm 2 case: viewport mock hẹp → build-hud paddingLeft ≠ 0; viewport thấp → ai-panel maxHeight set (jsdom không match media query thật — test qua logic hằng số: assert guards tồn tại trong file content scan `readFileSync` contains `max-width: 1100px` + comment; hoặc skip — decide khi làm, ưu tiên e2e thật ở Task 3).
- [ ] **Step 3:** type-check + focused PASS.
- [ ] **Step 4:** Commit `fix(combat-ui): overlap guards — build-hud clears canvas HUD (O1), ai-panel vertical scroll (O3)`.

### Task 3: E2e layout smoke (chống regression tái diễn)

**Files:**
- Create: `game/tests/e2e/combat-overlay-layout.spec.ts`

**Test flow (theo helpers hiện có — create-to-combat làm tới battle active):**
- [ ] **Step 1:** Spec: bootToGuestHome → createCharacterThroughUi → enterHome → (giống create-to-combat L26-40) Tab → teleport_array → stage-start → đợi `.command-wheel` ẩn + battlefield hiện. Rồi:
  - assert `.combat-scene-overlay` bounding = viewport (full)
  - assert `.combat-scene-overlay__ai-panel` box: x ≥ 0, y ≥ topbar height, nằm trong viewport
  - assert `__build-hud` box.bottom ≤ viewport.height, center ngang
  - chụp screenshots 3 viewports (desktop/compact/tall — copy VIEWPORTS từ ink-wash-ui)
- [ ] **Step 2:** Chạy — nếu fail vì build chưa khởi tạo teleport (như probe đã gặp: tân binh chưa xây building) → dùng flow build building TRƯỚC (hotspot click → popover Xây dựng → click Xây) rồi mới teleport — tham chiếu probe script `tests/e2e/ui-probe-v2.mjs` (đang untracked, đọc rồi không commit).
- [ ] **Step 3:** PASS ở 3 viewports. `npx playwright test` full 6/6+ mới PASS.
- [ ] **Step 4:** Commit `test(e2e): combat overlay layout smoke — ai-panel/build-hud anchored, no HUD overlap`.

### Task 4: Dọn probe files + final verify

- [ ] **Step 1:** Xóa 5 file probe untracked `game/tests/e2e/ui-probe*.mjs` (tác giả là tôi — cần user xác nhận xóa trước khi thực hiện; đây là tác phẩm throwaway của session này).
- [ ] **Step 2:** Final: type-check + full vitest + build + `npx playwright test` full PASS.
- [ ] **Step 3:** Commit final nếu có fix: `chore: overlay layering repair final verify`.
- [ ] **Step 4:** Update ROADMAP (mục tương ứng) + ledger.

## Self-Review

- Spec coverage: root cause (§1) → Task 1; O1/O3 (§3) → Task 2; regression (§4.4-4.5) → Task 1 test + Task 3 e2e. O2/O4 pass-through verify trong e2e asserts. O5/O6 ghi "verify visual" — thuộc scope e2e screenshot review tay, không code.
- Placeholder: KHÔNG có TBD; 2 hằng số guard (210/180) có nguồn dẫn rõ.
- Type consistency: class names copy đúng từ file cũ (verify bằng git show).
