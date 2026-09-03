# Deferred Cleanup Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Đóng 5 deferred nhỏ (2.2 leftovers cuối, CombatExitConfirmModal focus trap, 2 useDialogFocus edges, StageSelect numeric assertion, en 'Form' consistency) + sync roadmap 8.5.

**Architecture:** Mỗi item độc lập; item 1+4+5 thuần i18n/test; item 2+3 đụng dialog focus — item 3 sửa composable trước item 2 dùng nó. 2.7 vẫn ngoài scope.

**Tech Stack:** TypeScript, Vitest (+jsdom), Vue 3 SFC, vue-i18n v11.

**Spec:** `game/docs/superpowers/specs/2026-09-03-deferred-cleanup-followups-design.md`

## Global Constraints

- Không `any`; không dependency mới; không production behavior change ngoài spec (focus trap cho CombatExitConfirmModal là behavior fix có chủ đích).
- vi byte-identical với strings gốc; en 'Form' nhất quán; parity test pass.
- Core/composable không import i18n — key mapping pattern.
- Verify: `npm.cmd run type-check` + vitest liên quan + `npm.cmd run build`.

---

### Task 1: useDialogFocus 2 edges (làm trước — item 2 phụ thuộc)

**Files:**
- Modify: `game/src/composables/useDialogFocus.ts` (~24, ~37)
- Test: `game/src/components/common/dialogFocusAdversarial.test.ts` (thêm 2 case)

- [ ] **Step 1: Failing tests** — (a) dialog KHÔNG focusable nào: Tab dispatch → focus vẫn trong card (không thoát); (b) re-open cùng tick: mở→đóng→mở trong 1 tick, trigger gốc vẫn được restore sau close cuối.
- [ ] **Step 2: FAIL → Fix:**
  - Edge 1: trong keydown handler, `event.preventDefault()` chạy TRƯỚC early-return khi `list.length === 0` (Tab giữ ở card).
  - Edge 2: capture trigger chỉ khi `lastTrigger === null` hoặc activeElement không nằm trong card.
- [ ] **Step 3: PASS + regression** (`dialogFocus.test.ts`, `dialogFocusEscape.test.ts`, `InkWashLargeSurfaces.test.ts`).
- [ ] **Step 4: Commit** `fix(a11y): useDialogFocus — zero-focusable Tab containment + same-tick re-open trigger guard`

### Task 2: CombatExitConfirmModal focus trap

**Files:**
- Modify: `game/src/components/game/combat/CombatExitConfirmModal.vue`
- Test: jsdom test mới hoặc mở rộng file test combat hiện có

- [ ] **Step 1: Đọc file** — xác định cấu trúc (custom overlay vs ConfirmModal). Chọn: gắn `useDialogFocus(cardRef, computed(() => props.open), { onEscape: () => emit('cancel') })` với semantics: Escape/hủy = Ở LẠI trận (emit cancel), KHÔNG exit.
- [ ] **Step 2: Failing test** — jsdom: open → focus vào dialog; Escape → cancel emitted, exit KHÔNG emitted; Tab cycle trong modal.
- [ ] **Step 3: FAIL → Implement → PASS.**
- [ ] **Step 4: Commit** `feat(a11y): focus trap for CombatExitConfirmModal — Escape cancels exit (deferred follow-up)`

### Task 3: i18n 2.2 leftovers (FunctionOverlayPanel + useBagFilter + HomeBuildingIcons aria)

**Files:**
- Modify: `game/src/components/layout/FunctionOverlayPanel.vue`
- Modify: `game/src/composables/useBagFilter.ts` + consumers (grep `GROUP_LABELS|AGE_LABELS|groupLabel|ageLabel`)
- Modify: `game/src/components/game/HomeBuildingIcons.vue` (chỉ wrapper text nếu có)
- Modify: `game/src/locales/vi.json`, `en.json` — keys `layout.functionOverlay.*`, `bag.filter.group.*`, `bag.filter.age.*`
- Test: consumers' tests — đổi assertion raw vi → t() key (nếu string giờ từ locale)

- [ ] **Step 1: Trace consumers** của GROUP_LABELS/AGE_LABELS (grep). useBagFilter export `groupLabelKey()`/`ageLabelKey()` (key mapping), consumers `t(key)`. Nếu consumer là store/notify trả string — key-thread như pattern actionFeedback.
- [ ] **Step 2: vi byte-identical** (copy gốc), en dịch ('Cấp X/Y' → 'Level X/Y', 'Nâng công trình' → 'Upgrade building', nhóm/age labels...).
- [ ] **Step 3: Verify** — tests touched + parity + type-check.
- [ ] **Step 4: Commit** `feat(i18n): extract FunctionOverlayPanel + useBagFilter labels (2.2 leftovers)`

### Task 4: StageSelect numeric + en 'Form' consistency

**Files:**
- Modify: `game/src/components/panels/StageSelectPanel.test.ts:61`
- Modify: `game/src/locales/en.json` (4+ keys skillResource 'Body'→'Form' + descriptions nếu nhắc)

- [ ] **Step 1:** assertion → `` toContain(`10 ${t('panels.stageSelect.labels.enemiesSuffix')}`) ``.
- [ ] **Step 2:** en.json: `Ember Body` → `Ember Form` (2 keys), `Mountain Body` → `Mountain Form` (1 key), + quét descriptions trong skillResource có 'Body' → 'Form' (nhất quán). vi KHÔNG đổi.
- [ ] **Step 3:** Verify: StageSelectPanel.test + SkillResourceStatLabels.test + parity.
- [ ] **Step 4: Commit** `test+fix(i18n): restore numeric stage assertion + unify en Form terminology`

### Task 5: Roadmap 8.5 sync + final verify + QA quick

**Files:**
- Modify: `game/docs/roadmap.md` (8.5: perf row → ✅ merged 10/10 `8b59045` + flake fix `79bab1c`; thêm row followups-i18n ✅ `2910247`; thêm row deferred-cleanup khi xong)

- [ ] **Step 1: Full matrix** từ `game/`: test, type-check, build, e2e.
- [ ] **Step 2: Roadmap edit + QA quick report** `game/docs/qa/2026-09-03-deferred-cleanup-quick.md` (verdict theo rules; collect deferred còn lại: chỉ 2.7 + QA-013/014).
- [ ] **Step 3: Commit** `docs: roadmap 8.5 sync + deferred cleanup QA report`
