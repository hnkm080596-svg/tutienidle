# Task 9.2 + 9.3 + 9.7 + T4.1 i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đóng 4 cụm nợ: (A) focus trap cho 2 modal primitives, (B) idempotency guard cho `restoreFromSave`, (C) isFinite guard cho `calculateOfflineProgress`, (D) i18n leftovers (extraction scope mới, formatStat+labels, 9 test files locale-coupled, `mpLabel` cleanup, vue-i18n v11).

**Architecture:** A gắn composable `useDialogFocus` vào 2 primitives (13 consumers kế thừa). B thêm payload-identity guard trong chính action (pattern `lastExternalModifiers`). C là 1 dòng guard giữ contract. D tách theo file: mapping reason→key (ActionAvailability), labels/descriptions data-layer vào locale (SkillResourceStatLabels — pattern đầu tiên cho 2.7), component strings qua `t()`, test assertions qua `t()` resolution, v11 bump cuối cùng cô lập.

**Tech Stack:** TypeScript, Vitest (+jsdom), Vue 3 SFC, vue-i18n v9→v11; không dependency mới ngoài version bump vue-i18n.

**Spec:** `game/docs/superpowers/specs/2026-09-02-task-9-followups-i18n-design.md` — plan lập luận từ spec; executors đọc CẢ HAI file.

## Global Constraints

- Không `any`; không dependency mới (RIÊNG vue-i18n v11 là version bump được spec duyệt); không đổi architecture ngoài phạm vi.
- Không migration save (dev phase) — `mpLabel` xóa khỏi save shape được phép, không cần migration.
- UI Layout Rule: không hardcode px; focus trap phải giữ nguyên layout hiện có của 2 primitives.
- Mọi chuỗi UI mới trích đều cần keys Ở CẢ `vi.json` và `en.json` (parity test `i18n/index.test.ts` tự kiểm).
- Test locale-coupled: assert qua `t('key')` resolution (import `{ i18n }` singleton), KHÔNG assert raw vi.
- Core không gọi `i18n.global.t` trực tiếp — core export mapping key/const, component render qua `t()`.
- Verify chuẩn: `npm.cmd run type-check` + vitest liên quan + `npm.cmd run build` khi đụng production code.
- Encoding: các file hiện có mojibake hiển thị trong PowerShell console — KHÔNG sửa content không liên quan; ghi file mới/edits bằng UTF-8 đúng.

---

### Task 1: isFinite guard trong calculateOfflineProgress (Phần C — Task 9.7)

**Files:**
- Modify: `game/src/core/idle/OfflineProgressSystem.ts:15-28`
- Test: `game/src/core/idle/OfflineProgressSystem.test.ts`

**Interfaces:**
- Consumes: không
- Produces: `calculateOfflineProgress(offlineSeconds, cultivationPerSecond)` — cultivation = 0 khi `cultivationPerSecond` non-finite; các case hiện tại giữ nguyên

- [ ] **Step 1: Viết failing test**

Thêm vào `describe('calculateOfflineProgress')` trong `OfflineProgressSystem.test.ts`:

```typescript
  it('NaN cultivationPerSecond → cultivation 0, không poison kết quả', () => {
    const result = calculateOfflineProgress(3600, Number.NaN)

    expect(result.cultivation).toBe(0)
  })

  it('+Infinity / -Infinity cultivationPerSecond → cultivation 0', () => {
    expect(calculateOfflineProgress(3600, Number.POSITIVE_INFINITY).cultivation).toBe(0)
    expect(calculateOfflineProgress(3600, Number.NEGATIVE_INFINITY).cultivation).toBe(0)
  })
```

- [ ] **Step 2: Chạy test verify FAIL**

Run: `npm.cmd run test -- src/core/idle/OfflineProgressSystem.test.ts`
Expected: FAIL 2 case mới (NaN truyền qua nhân, kết quả NaN).

- [ ] **Step 3: Implement guard**

Trong `OfflineProgressSystem.ts`, thay dòng return cultivation:

```typescript
    // QA-007 belt-and-suspenders — save validator (v55) đã chặn NaN/±Infinity
    // cultivationPerSecond ở boot; guard này bảo vệ consumer hiện tại + future
    // caller khỏi giá trị non-finite từ path khác. NaN * n = NaN, và clamp
    // Math.min(NaN, x) = NaN ở player.ts không chứa được — chặn ở nguồn.
    cultivation: Number.isFinite(cultivationPerSecond)
      ? cultivationPerSecond * elapsedSeconds
      : 0,
```

- [ ] **Step 4: Chạy test verify PASS**

Run: `npm.cmd run test -- src/core/idle/OfflineProgressSystem.test.ts`
Expected: PASS toàn bộ (cả case cũ).

- [ ] **Step 5: Commit**

```bash
git add game/src/core/idle/OfflineProgressSystem.ts game/src/core/idle/OfflineProgressSystem.test.ts
git commit -m "fix(idle): isFinite guard on cultivationPerSecond in calculateOfflineProgress (Task 9.7, QA-007)"
```

---

### Task 2: restoreFromSave idempotency guard (Phần B — Task 9.2)

**Files:**
- Modify: `game/src/stores/player.ts` (restoreFromSave ~298-346)
- Test: Create `game/src/stores/player.restoreFromSave.test.ts`

**Interfaces:**
- Consumes: `GameSave` type; `calculateOfflineTime`, `calculateOfflineProgress` (existing)
- Produces: `restoreFromSave(save)` — same payload twice = no-op returning same offline result; different payload = full apply

- [ ] **Step 1: Viết failing test**

Tạo `game/src/stores/player.restoreFromSave.test.ts` (pattern theo player.*.test.ts: `setActivePinia(createPinia())`, build minimal save — copy fixture từ `SaveSystem.bootRestore.test.ts` nếu có sẵn helper, else build object save tối thiểu với đủ fields `player.lastSavedAt`, `player.cultivation`, `player.cultivationPerSecond`...):

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
// buildMinimalSave: import từ SaveSystem.test helper nếu export, else tự dựng tối thiểu

describe('player.restoreFromSave — idempotency (QA-002, Task 9.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('gọi 2 lần CÙNG save → offline cultivation chỉ cộng 1 lần', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({ lastSavedAt: Date.now() - 3_600_000, cultivationPerSecond: 10 })

    const first = player.restoreFromSave(save)
    const cultivationAfterFirst = player.cultivation
    const second = player.restoreFromSave(save)

    expect(second.cultivation).toBe(first.cultivation)
    expect(player.cultivation).toBe(cultivationAfterFirst)
  })

  it('gọi lại với save KHÁC (lastSavedAt mới hơn) → áp đầy đủ', () => {
    const player = usePlayerStore()
    const save1 = buildMinimalSave({ lastSavedAt: Date.now() - 3_600_000, cultivationPerSecond: 10 })
    player.restoreFromSave(save1)

    const save2 = buildMinimalSave({ lastSavedAt: Date.now() - 60_000, cultivationPerSecond: 20 })
    const result = player.restoreFromSave(save2)

    expect(result.cultivation).toBeGreaterThan(0)
  })

  it('guard không phá normalization: nodeLevels fallback + attackRange vẫn chạy', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({})
    save.player.nodeLevels = undefined as never // simulate save cũ thiếu field

    player.restoreFromSave(save)

    expect(player.nodeLevels).toEqual({})
    expect(player.baseStats.attackRange).toBeGreaterThan(0)
  })
})
```

Chú ý: đọc `buildMinimalSave` thật trong repo trước khi viết — nếu `SaveSystem.test.ts` không export helper, tự dựng helper nội bộ file test với đủ shape để `restoreFromSave` không crash (đối chiếu `Object.assign(this, save.player)` cần gì). KHÔNG gọi qua `loadGame` (đi thẳng action).

- [ ] **Step 2: Chạy test verify FAIL**

Run: `npm.cmd run test -- src/stores/player.restoreFromSave.test.ts`
Expected: FAIL case 1 (cultivation bị cộng 2 lần).

- [ ] **Step 3: Implement guard**

Trong `stores/player.ts`, đầu `restoreFromSave`:

```typescript
    // QA-002 idempotency — payload-identity guard (pattern lastExternalModifiers):
    // cùng save gọi lại = no-op (chống double-credit offline cultivation + double
    // Object.assign). Save KHÁC (boot retry/recovery) vẫn áp đầy đủ. Non-reactive,
    // không persist (dev phase — không migration).
    const payloadIdentity = `${save.player.lastSavedAt}|${save.player.cultivation}`
    if (this.lastRestoredPayloadIdentity === payloadIdentity) {
      return calculateOfflineProgress(0, 0) // elapsed 0 — no-op đúng nghĩa
    }
    this.lastRestoredPayloadIdentity = payloadIdentity
```

`lastRestoredPayloadIdentity` khai báo như non-state module-level var hoặc gán ngoài `state` (xem `lastExternalModifiers` pattern hiện có trong file — chọn cùng chỗ). Reset guard khi `reset()`/new-game action nếu action đó tồn tại (grep `reset(` trong store) — new game phải cho phép restore save mới.

- [ ] **Step 4: Chạy test verify PASS + không phá bootRestore**

Run: `npm.cmd run test -- src/stores/player.restoreFromSave.test.ts src/services/save/SaveSystem.bootRestore.test.ts`
Expected: PASS cả 2 (spy single-call vẫn đúng).

- [ ] **Step 5: Commit**

```bash
git add game/src/stores/player.ts game/src/stores/player.restoreFromSave.test.ts
git commit -m "fix(store): payload-identity guard on restoreFromSave — prevent double offline credit (Task 9.2, QA-002)"
```

---

### Task 3: useDialogFocus composable + gắn vào OverlayPanel + ConfirmModal (Phần A — Task 9.3)

**Files:**
- Create: `game/src/composables/useDialogFocus.ts`
- Modify: `game/src/components/common/OverlayPanel.vue`
- Modify: `game/src/components/common/ConfirmModal.vue`
- Test: Create `game/src/composables/useDialogFocus.test.ts` (hoặc test trực tiếp qua primitives trong file jsdom mới `game/src/components/common/dialogFocus.test.ts`)

**Interfaces:**
- Consumes: `Ref<HTMLElement | null>`, boolean open (ref hoặc getter)
- Produces: `useDialogFocus(cardRef, open, { onEscape }): void` — focus-on-open, Tab cycle, Escape callback, focus restore on close/unmount

- [ ] **Step 1: Viết failing test**

Tạo `game/src/components/common/dialogFocus.test.ts` (`// @vitest-environment jsdom`, mount pattern theo InkWashLargeSurfaces.test.ts:12-19):

```typescript
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import OverlayPanel from './OverlayPanel.vue'
import ConfirmModal from './ConfirmModal.vue'

// mount helper: appendChild + createApp + push to mounted[] (copy InkWashLargeSurfaces pattern)

describe('dialog focus management (Task 9.3, QA-003)', () => {
  afterEach(() => { /* unmount + remove, clear body */ })

  it('OverlayPanel: open → focus vào focusable đầu tiên trong dialog', async () => {
    const open = ref(true)
    const { container } = mountOverlayPanel(open)
    await nextTick()

    const focused = document.activeElement
    const dialog = container.querySelector('[role="dialog"]')!
    expect(dialog.contains(focused)).toBe(true)
  })

  it('OverlayPanel: Escape → emit close', async () => {
    const onClose = vi.fn()
    const open = ref(true)
    const { container } = mountOverlayPanel(open, onClose)
    await nextTick()

    container.querySelector('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('OverlayPanel: Tab cycle không thoát khỏi dialog', async () => {
    const open = ref(true)
    const { container } = mountOverlayPanel(open)
    await nextTick()
    // Panel test cần ≥2 focusable: thêm 2 button vào default slot qua mount helper

    const dialog = container.querySelector('[role="dialog"]')!
    const focusables = dialog.querySelectorAll('button')
    focusables[0]!.focus()
    focusables[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    await nextTick()

    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(focusables[0])
  })

  it('OverlayPanel: close → restore focus về trigger', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const open = ref(true)
    const { container } = mountOverlayPanel(open)
    await nextTick()
    open.value = false
    await nextTick()
    // unmount panel qua helper

    expect(document.activeElement).toBe(trigger)
  })

  it('ConfirmModal: Escape → emit cancel (KHÔNG phải confirm)', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const { container } = mountConfirmModal(onCancel, onConfirm)
    await nextTick()

    container.querySelector('[role="alertdialog"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Chạy test verify FAIL**

Run: `npm.cmd run test -- src/components/common/dialogFocus.test.ts`
Expected: FAIL — primitives chưa có focus management.

- [ ] **Step 3: Implement useDialogFocus.ts**

```typescript
import { watch, nextTick, onBeforeUnmount, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * Focus management dùng chung cho dialog primitives (QA-003, Task 9.3):
 * focus-on-open → Tab cycle trong card → Escape callback → restore trigger.
 * Gắn 1 lần ở OverlayPanel/ConfirmModal — mọi consumer kế thừa.
 */
export function useDialogFocus(
  cardRef: Ref<HTMLElement | null>,
  open: Ref<boolean>,
  options: { onEscape: () => void },
): void {
  let lastTrigger: HTMLElement | null = null
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null

  function focusables(): HTMLElement[] {
    return cardRef.value ? Array.from(cardRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : []
  }

  const stopWatch = watch(open, async (isOpen) => {
    if (isOpen) {
      lastTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      const items = focusables()
      ;(items[0] ?? cardRef.value)?.focus()
      keydownHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          options.onEscape()
          return
        }
        if (event.key !== 'Tab') return
        const list = focusables()
        if (list.length === 0) return
        const first = list[0]!
        const last = list[list.length - 1]!
        const active = document.activeElement
        if (event.shiftKey && (active === first || !cardRef.value?.contains(active))) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && (active === last || !cardRef.value?.contains(active))) {
          event.preventDefault()
          first.focus()
        }
      }
      cardRef.value?.addEventListener('keydown', keydownHandler)
    } else {
      if (keydownHandler) cardRef.value?.removeEventListener('keydown', keydownHandler)
      keydownHandler = null
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus()
      lastTrigger = null
    }
  })

  onBeforeUnmount(() => {
    stopWatch()
    if (keydownHandler) cardRef.value?.removeEventListener('keydown', keydownHandler)
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus()
  })
}
```

- [ ] **Step 4: Gắn vào 2 primitives**

OverlayPanel.vue: thêm `const cardRef = ref<HTMLElement | null>(null)` + `ref` cho card `<section :ref="cardRef">`, gọi `useDialogFocus(cardRef, computed(() => open), { onEscape: () => emit('close') })`. Giữ nguyên mọi style/template khác.

ConfirmModal.vue: tương tự nhưng `onEscape: () => emit('cancel')`.

- [ ] **Step 5: Chạy test verify PASS + regression**

Run: `npm.cmd run test -- src/components/common/dialogFocus.test.ts src/components/common/InkWashLargeSurfaces.test.ts src/components/common/BreakthroughRequirementPanel.test.ts src/components/panels/RealmPanel.test.ts`
Expected: PASS tất cả (click-outside + render tests không vỡ).

- [ ] **Step 6: Commit**

```bash
git add game/src/composables/useDialogFocus.ts game/src/components/common/OverlayPanel.vue game/src/components/common/ConfirmModal.vue game/src/components/common/dialogFocus.test.ts
git commit -m "feat(a11y): dialog focus trap (focus-on-open, Tab cycle, Escape, restore) in OverlayPanel+ConfirmModal (Task 9.3, QA-003)"
```

---

### Task 4: formatSkillResourceStat qua formatter + labels/descriptions vào locale (Phần D — 2.3)

**Files:**
- Modify: `game/src/core/skill/SkillResourceStatLabels.ts`
- Modify: `game/src/components/panels/skill-path/NodeInspector.vue` (labels/descriptions render qua t())
- Modify: `game/src/locales/vi.json`, `game/src/locales/en.json`
- Test: `game/src/core/skill/SkillResourceStatLabels.test.ts` (tạo nếu chưa có)

**Interfaces:**
- Consumes: `formatNumber` (core/format/NumberFormatter)
- Produces: `formatSkillResourceStat(key, value)` hành vi giữ nguyên (percent 1-decimal / round); `SKILL_RESOURCE_STAT_LABELS` giữ entry shape nhưng label/description thành i18n keys — consumer render qua `t()`

- [ ] **Step 1: Viết failing test (format + key mapping)**

`game/src/core/skill/SkillResourceStatLabels.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { SKILL_RESOURCE_STAT_LABELS, formatSkillResourceStat } from './SkillResourceStatLabels'
import { i18n } from '@/i18n'

describe('SKILL_RESOURCE_STAT_LABELS — i18n key mapping (Task 4)', () => {
  it('mọi entry có labelKey/descriptionKey tồn tại trong locale vi + en', () => {
    for (const entry of SKILL_RESOURCE_STAT_LABELS) {
      expect(i18n.global.t(entry.labelKey)).not.toContain('skillResource.')
      expect(i18n.global.t(entry.descriptionKey)).not.toContain('skillResource.')
    }
  })

  it('formatSkillResourceStat giữ nguyên hành vi percent/flat', () => {
    expect(formatSkillResourceStat('thuyThePercent', 0.155)).toBe('15.5%')
    expect(formatSkillResourceStat('earthAoeRadius', 2.4)).toBe('2')
  })
})
```

- [ ] **Step 2: Chạy verify FAIL**

Run: `npm.cmd run test -- src/core/skill/SkillResourceStatLabels.test.ts`
Expected: FAIL — `labelKey` chưa tồn tại.

- [ ] **Step 3: Implement**

a) `SkillResourceStatLabels.ts`: thêm `labelKey`/`descriptionKey` vào entry (`skillResource.${key}.label` / `.description`), GIỮ `label`/`description` làm fallback display hoặc bỏ hẳn nếu không còn consumer trực tiếp (grep trước khi bỏ). `formatSkillResourceStat` thay `(value * 100).toFixed(1)` bằng `formatNumber(Math.round(value * 1000) / 10)` HOẶC giữ toFixed nếu formatNumber không khớp 1-decimal — ĐỐI CHIẾU `formatNumber` output trước khi chọn (mục tiêu: route qua formatter chung chỉ khi output đồng nhất; nếu khác → giữ local, ghi report).

b) vi.json/en.json thêm `skillResource.<key>.label/.description` cho đủ 19 entries (dịch en từ nghĩa vi hiện có).

c) NodeInspector.vue: render `t(entry.labelKey)` / `t(entry.descriptionKey)` thay vì `entry.label`.

- [ ] **Step 4: Chạy verify PASS**

Run: `npm.cmd run test -- src/core/skill/SkillResourceStatLabels.test.ts` + parity test tự chạy trong `i18n/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/skill/SkillResourceStatLabels.ts game/src/core/skill/SkillResourceStatLabels.test.ts game/src/components/panels/skill-path/NodeInspector.vue game/src/locales/vi.json game/src/locales/en.json
git commit -m "feat(i18n): skill resource stat labels/descriptions to locale + shared formatter (2.3)"
```

---

### Task 5: mpLabel dead data cleanup (Phần D — 4.4)

**Files:**
- Modify: `game/src/core/technique/Technique.ts:110` (xóa optional field)
- Modify: `game/src/data/technique/Techniques.ts:36,76,114` (xóa 3 data entries)
- Modify: `game/src/services/save/saveShapeValidation.ts` (nếu validator chạm technique fields chi tiết — grep `mpLabel` trước; validator hiện chỉ `validateIdEntries` nên khả năng không cần sửa)
- Test: grep test nào assert mpLabel → sửa/xóa assertion đó

**Interfaces:**
- Produces: `Technique` type không còn `mpLabel`; save shape không đổi (field không được validate/persist riêng)

- [ ] **Step 1: Grep toàn bộ mpLabel**

Run: `grep -rn "mpLabel" game/src`
Expected: Technique.ts (type) + Techniques.ts (3 data) + possibly tests. Liệt kê từng hit.

- [ ] **Step 2: Xóa field + data entries + test assertion**

Xóa `mpLabel?: string` khỏi Technique.ts, 3 entries khỏi Techniques.ts, mọi assertion tham chiếu.

- [ ] **Step 3: Verify**

Run: `npm.cmd run test -- src/data/technique src/core/technique` + `npm.cmd run type-check`
Expected: PASS + clean. (Nếu có test save round-trip chứa mpLabel — cập nhật fixture.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(technique): remove dead mpLabel display field (zero consumers since 6A)"
```

---

### Task 6: String extraction — ActionAvailability + AlchemyView + HomeResourceStrip (Phần D — 2.2 lô 1)

**Files:**
- Modify: `game/src/core/presentation/ActionAvailability.ts:26-59` (mapping reason→key, KHÔNG giữ label vi)
- Modify: `game/src/composables/useEquipmentActions.ts:4,49,71,109,130` (consumer — đổi sang key + t() tại điểm hiển thị, hoặc giữ hàm nhận t)
- Modify: `game/src/components/panels/AlchemyView.vue:16-24,287,295`
- Modify: `game/src/components/game/HomeResourceStrip.vue:73,81,96`
- Modify: `game/src/locales/vi.json`, `game/src/locales/en.json`
- Test: `game/src/components/game/HomeResourceStrip.test.ts` (thêm `app.use(i18n)` vào mount), test liên quan ActionAvailability/useEquipmentActions (grep)

**Interfaces:**
- Produces: `actionFailureKey(reason): string | null` (mapping); locale keys `actionFailure.<reason>`; AlchemyView REASON_LABELS → `alchemy.reason.<x>`

- [ ] **Step 1: Viết failing test mapping keys**

Test ActionAvailability: mọi reason trong mapping có key `actionFailure.<reason>` resolve được (không trả raw key) + fallback keys tồn tại. Test HomeResourceStrip: mount có i18n, assert qua `t('...')` không còn raw vi.

- [ ] **Step 2: Verify FAIL → Implement → PASS**

- ActionAvailability.ts: `ACTION_FAILURE_LABELS` → `ACTION_FAILURE_KEYS: Record<string, string>` (reason → `actionFailure.<reason>`), export `actionFailureKey(reason)`. `useEquipmentActions.ts` đổi sang key, component hiển thị `t(key)`. CẨN THẬN: consumer của `actionFailureLabel()` là useEquipmentActions trả toast/message — nếu toast nhận string từ composable, composable KHÔNG import i18n; đổi sang trả key + component `t(key)` (trace call path trước).
- AlchemyView: REASON_LABELS → `alchemy.reason.*` keys qua `t()`.
- HomeResourceStrip: 'Linh Thạch' + 2 aria → `resource.strip.*` keys; thêm `app.use(i18n)` vào test mount.
- en.json dịch đủ (Linh Thạch = Spirit Stones v.v. — đối chiếu en.json hiện có nếu key tương tự đã tồn tại).

- [ ] **Step 3: Verify PASS + parity**

Run: `npm.cmd run test -- src/core/presentation src/components/game/HomeResourceStrip.test.ts src/components/panels/AlchemyView.test.ts src/composables/useEquipmentActions` (theo file thật; grep test trước)
Expected: PASS + parity test xanh.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(i18n): extract ActionAvailability failure labels, AlchemyView reasons, HomeResourceStrip (2.2 batch 1)"
```

---

### Task 7: String extraction — NodeInspector + SkillDetailView + 6 combat overlays (Phần D — 2.2 lô 2)

**Files:**
- Modify: `game/src/components/panels/skill-path/NodeInspector.vue` (~7 chuỗi template: 'Tối Đa'/'Đã Linh Ngộ'/'Có Thể Linh Ngộ'/'Chưa Đủ'/'Đã đạt cấp tối đa.'...)
- Modify: `game/src/components/panels/skill-path/SkillDetailView.vue` ('Chọn một kỹ năng…', 'Nâng Cấp (X Cảm Ngộ)', 'Tối đa', 'Hồi Chiêu', 'Tiêu Hao')
- Modify: 6 files `game/src/components/game/combat/Combat{AiPanel,CountdownOverlay,ExitConfirmModal,ResultModal,SceneOverlay,TopBar}.vue`
- Modify: `game/src/locales/vi.json`, `game/src/locales/en.json`
- Test: các test mount các component này — thêm `app.use(i18n)` nếu chưa, đổi assert raw vi → `t()`

**Interfaces:**
- Produces: keys `skillPath.*`, `combat.overlay.*` (vi + en)

- [ ] **Step 1: Grep từng chuỗi vi trong 8 files, list keys mới**

Không có exact-count trước — đọc từng file, trích chuỗi vi trong template + const, đặt keys `skillPath.nodeInspector.*`, `skillPath.detail.*`, `combat.overlay.<file>.*`. Riêng CombatSceneOverlay có thể chứa text lỗi spec — nếu chuỗi là dev-error log (không user-visible) thì KHÔNG trích, ghi report.

- [ ] **Step 2: Implement extraction + test mount updates**

Component thêm `useI18n({ useScope: 'local' })`... LƯU Ý: các file này chưa có useI18n — dùng global scope `useI18n()` đơn giản (messages nằm ở global) — theo pattern BreakthroughRequirementPanel (local scope vẫn đọc global messages; chọn nhất quán: `useI18n()` không options).

- [ ] **Step 3: Verify**

Run: test các component liên quan + `i18n/index.test.ts` parity + `npm.cmd run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(i18n): extract NodeInspector, SkillDetailView, 6 combat overlay strings (2.2 batch 2)"
```

---

### Task 8: Locale-coupled test assertions — 9 files (Phần D — 2.5)

**Files (sửa assertions):**
- `HomeResourceStrip.test.ts:53,58,64` (mount cần i18n sau Task 6)
- `MaterialBagFilter.test.ts:245,279,281`
- `HomeBuildingIcons.test.ts:165,182,369`
- `InventorySort.test.ts:121,131`
- `StageSelectPanel.test.ts:55,56`
- `LeftPanel.building.test.ts:95,110`
- `BreakthroughRequirementPanel.test.ts:52,62`
- `RewardList.test.ts:71,104`
- `InkWashMediumSurfaces.test.ts:65`

**Interfaces:**
- Produces: assertions qua `i18n.global.t('key')` thay raw vi

- [ ] **Step 1: Đổi từng assertion**

Pattern: `import { i18n } from '@/i18n'` → `expect(text).toContain(i18n.global.t('stage.enemyCount', { n: 10 }))` — đối chiếu key thật đang render trong component (đọc component trước khi đặt key; key phải TỒN TẠI rồi, không tạo key mới ở task này).

- [ ] **Step 2: Verify**

Run: `npm.cmd run test -- <9 test files>` (chạy theo group)
Expected: PASS 9/9 files.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(i18n): replace locale-coupled assertions with t() key resolution (2.5, 9 files)"
```

---

### Task 9: vue-i18n v9 → v11 migration (Phần D — 2.1, CUỐI CÙNG, cô lập)

**Files:**
- Modify: `game/package.json` (vue-i18n ^9.14.5 → ^11.4.10), `game/package-lock.json`
- Modify: `game/src/i18n/index.ts` (nếu API generic đổi — audit trước)
- Possibly: gọi chỗ nào đụng deprecated v9 API (audit)

**Interfaces:**
- Produces: app chạy vue-i18n v11, toàn bộ test + build + e2e xanh

- [ ] **Step 1: Audit API surface hiện dùng**

Grep: `createI18n`, `legacy`, `useScope`, `i18n.global`, `t(` schema generic `createI18n<[typeof vi], 'vi' | 'en'>`. Đối chiếu v11 docs (webfetch vue-i18n migration guide nếu cần): schema generic vẫn hỗ trợ? `useI18n({ useScope: 'local' })` unchanged? `i18n.global.t` unchanged?

- [ ] **Step 2: Bump + sửa breaking changes**

`npm.cmd install vue-i18n@11` từ `game/`. Sửa mọi breaking change surfaced by type-check/test.

- [ ] **Step 3: Full verify**

Run: `npm.cmd run test` (full), `npm.cmd run type-check`, `npm.cmd run build`, `npm.cmd run test:e2e`
Expected: xanh toàn bộ (trừ flake đã root-caused).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json game/src/i18n (nếu sửa)
git commit -m "chore(i18n): migrate vue-i18n v9.14 → v11 (2.1)"
```

---

### Task 10: Final verify + docs

**Files:**
- Modify: `game/docs/roadmap.md` (mục 7.2: đánh dấu 2.1/2.2/2.3/2.5/4.4(mpLabel) ✅, 2.4 obsolete, 2.6 done note; mục 8.1: 9.2/9.3/9.7 ✅)

- [ ] **Step 1: Full verify matrix**

Run từ `game/`: `npm.cmd run test` (full), `npm.cmd run type-check`, `npm.cmd run build`, `npm.cmd run test:e2e`.
Expected: xanh (trừ flake đã fix — nếu vẫn flake thì record).

- [ ] **Step 2: Cập nhật roadmap + commit**

Đánh dấu trạng thái mới; commit docs.

- [ ] **Step 3: Adversarial QA quick pass** (theo AGENTS.md) trên toàn bộ diff branch → report vào `game/docs/qa/2026-09-XX-task-9-followups-i18n-quick.md`.