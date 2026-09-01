# Audit Fixes — Xử lý các vấn đề phát hiện từ full-project audit (2026-08-31)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 12 vấn đề thực tế (2 CRITICAL + 6 HIGH + 4 MEDIUM) từ audit toàn project, giữ nguyên kiến trúc và gameplay balance.

**Architecture:** Mỗi fix là một task độc lập có test riêng. Không đổi architecture. Save-migration không cần maintains (development phase). Ba phạm vi gợi ý từ user đã defer sang plan riêng: Supabase SQL sync (C2), reactivity 10Hz optimization (M6), và a11y toàn diện (M8 một phần).

**Tech Stack:** Vue 3 (RC), TypeScript, Pinia, Phaser 4.2.1, Vitest, Vite.

**Spec:** Audit report trong conversation 2026-08-31 (systematic-debugging Phase 1 evidence). Worktree: `.agent-worktrees/audit-fixes` (branch `agent/audit-fixes`). Baseline: type-check ✅, 1489/1489 tests ✅, build ✅.

## Global Constraints

- Không dùng `any` (AGENTS.md + CLAUDE.md).
- Không thêm dependency mới (AGENTS.md).
- Không đổi architecture (AGENTS.md).
- Không commit/push — user quyết định commit cuối (AGENTS.md). Các bước "Commit" trong plan chỉ thực hiện KHI user yêu cầu; mặc định để thay đổi uncommitted trong worktree.
- Sau mỗi task: `npm.cmd run type-check` (bắt buộc với TS/Vue change) + focused test.
- Test framework: Vitest, colocated (`*.test.ts` cạnh file source).
- Tiếng Việt cho comment code (theo convention hiện tại của codebase).

## Worktree

Tất cả path dưới đâyRelativeTo worktree root: `E:\tutienidle\.agent-worktrees\audit-fixes`. Path trong task viết theo dạng `game/src/...` (từ repo root).

---

### Task 1: Save write quota handling + thông báo người chơi (C1a)

**Vấn đề:** `writeGameSave` không try/catch — QuotaExceededError từ autosave bị nuốt ở `console.warn`, người chơi không biết progress ngừng persist. Manual save hiện toast "Đã lưu tiến trình" GIẢ cả khi write throw.

**Files:**
- Modify: `game/src/services/save/SaveSystem.ts:527-529`
- Test: `game/src/services/save/SaveSystem.quota.test.ts` (create)

**Interfaces:**
- Produces: `writeGameSave` vẫn `void` nhưng không throw nữa — trả về kết quả qua return type mới:

```ts
export type SaveWriteResult = { status: 'ok' } | { status: 'failed'; reason: 'quota' | 'unknown' }
export function writeGameSave(save: GameSave): SaveWriteResult
```

- Downstream (Task 2): `LocalCloudSaveService.save` đọc result này để trả `unavailable` thay vì throw.

- [ ] **Step 1: Write failing test**

```ts
// game/src/services/save/SaveSystem.quota.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeGameSave, type GameSave } from './SaveSystem'
import { createDefaultPlayer } from '@/core/player/Player'

// buildGameSave cần GameManager — dùng object tối giản thỏa GameSave shape
function buildMinimalSave(): GameSave {
  const player = createDefaultPlayer()
  return {
    version: (window as unknown as { __TEST_SAVE_VERSION?: number }).__TEST_SAVE_VERSION ?? 54,
    player,
    // các field bắt buộc khác của GameSave: xem SaveSystem.ts GameSave
    // interface — copy pattern từ SaveSystem.test.ts buildMinimalSave
  } as unknown as GameSave
}

describe('writeGameSave — quota handling', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('trả { status: "ok" } khi ghi thành công', () => {
    const result = writeGameSave(buildMinimalSave())
    expect(result.status).toBe('ok')
    expect(localStorage.getItem('tien-hiep-idle-save')).not.toBeNull()
  })

  it('trả { status: "failed", reason: "quota" } khi setItem throw QuotaExceededError — KHÔNG throw', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    const result = writeGameSave(buildMinimalSave())

    expect(result).toEqual({ status: 'failed', reason: 'quota' })
    spy.mockRestore()
  })

  it('trả { status: "failed", reason: "unknown" } cho lỗi khác (SecurityError...)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('security')
    })

    const result = writeGameSave(buildMinimalSave())

    expect(result).toEqual({ status: 'failed', reason: 'unknown' })
    spy.mockRestore()
  })
})
```

Lưu ý implementer: xem `SaveSystem.test.ts` để copy đúng cách build minimal save + SAVE_KEY constant (import `SAVE_KEY` từ SaveSystem thay vì hardcode).

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm.cmd test -- src/services/save/SaveSystem.quota.test.ts
```

Expected: FAIL — `writeGameSave` hiện trả `void`, `.status` undefined.

- [ ] **Step 3: Implement**

```ts
// game/src/services/save/SaveSystem.ts — thay dòng 527-529
export type SaveWriteResult = { status: 'ok' } | { status: 'failed'; reason: 'quota' | 'unknown' }

export function writeGameSave(save: GameSave): SaveWriteResult {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
    return { status: 'ok' }
  } catch (error: unknown) {
    // QuotaExceededError (DOMException name) — save vượt ~5MB localStorage.
    // Không throw: caller (CloudSaveCoordinator → autosave) quyết định cách
    // báo cho người chơi thay vì chết im lặng giữa tick.
    const name = error instanceof DOMException ? error.name : String(error)
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return { status: 'failed', reason: 'quota' }
    }
    return { status: 'failed', reason: 'unknown' }
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm.cmd test -- src/services/save/SaveSystem.quota.test.ts
```

- [ ] **Step 5: Type-check + full save tests**

```bash
npm.cmd run type-check
npm.cmd test -- src/services/save
```

Lưu ý: type-check có thể fail ở callers cũ của `writeGameSave` (`saveGame`, `LocalCloudSaveService`) vì return type đổi từ void. Sửa tại chỗ: `saveGame` bỏ return, `LocalCloudSaveService` defer sang Task 2. Nếu `saveGame` không ai dùng (grep 확인), xóa hàm `saveGame` luôn.

---

### Task 2: Autosave + manual save báo lỗi qua notification store (C1b)

**Vấn đề:** Autosave fail chỉ `console.warn`; SettingsPanel hiện toast thành công giả. Cần đường lỗi nhìn thấy được.

**Files:**
- Modify: `game/src/services/cloudSave/LocalCloudSaveService.ts:17-24`
- Modify: `game/src/App.vue:170-188` (persistProgress)
- Modify: `game/src/components/panels/SettingsPanel.vue:44-50` (handleSave)
- Test: modify `game/src/components/panels/SettingsPanel.test.ts` nếu tồn tại, else test qua `LocalCloudSaveService` unit test mới: `game/src/services/cloudSave/LocalCloudSaveService.quota.test.ts` (create)

**Interfaces:**
- Consumes: `writeGameSave` trả `SaveWriteResult` (Task 1).
- Produces: `CloudSaveService.save` trả `{ status: 'unavailable'; message: string; retryable: boolean }` khi write fail (đã có sẵn trong union `CloudSaveWriteResult` — `CloudSaveService.ts:12`).

- [ ] **Step 1: Write failing test**

```ts
// game/src/services/cloudSave/LocalCloudSaveService.quota.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalCloudSaveService } from './LocalCloudSaveService'
import type { GameSave } from '../save/SaveSystem'

describe('LocalCloudSaveService.save — write fail trả unavailable (không throw)', () => {
  beforeEach(() => localStorage.clear())

  it('setItem throw → { status: "unavailable", retryable: true }, revision KHÔNG tăng', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    const service = new LocalCloudSaveService()
    const result = await service.save({} as GameSave, 0)

    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.retryable).toBe(true)
    }
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (hiện tại `writeGameSave` throw sẽ propagate)

```bash
npm.cmd test -- src/services/cloudSave/LocalCloudSaveService.quota.test.ts
```

- [ ] **Step 3: Implement LocalCloudSaveService**

```ts
// LocalCloudSaveService.ts — thay body save()
async save(save: GameSave, expectedRevision: number): Promise<CloudSaveWriteResult> {
  const currentRevision = readRevision()
  if (currentRevision !== expectedRevision) return { status: 'conflict', currentRevision }
  const revision = currentRevision + 1
  const write = writeGameSave(save)
  if (write.status !== 'ok') {
    // Write fail (quota...) — revision chưa ghi, CAS state nguyên vẹn;
    // autosave kế tiếp (15s) retry tự nhiên nên retryable: true.
    return {
      status: 'unavailable',
      message: write.reason === 'quota' ? 'localStorage đầy (quota)' : 'ghi save thất bại',
      retryable: true,
    }
  }
  localStorage.setItem(SAVE_REVISION_KEY, String(revision))
  return { status: 'ok', revision }
}
```

- [ ] **Step 4: Wire notifications**

`App.vue` persistProgress (dòng 170-188) — thêm cảnh báo 1 lần cho mỗi chuỗi fail (không spam mỗi 15s):

```ts
let saveFailureNotified = false

async function persistProgress() {
  if (suppressPersistence || entryStage.value !== 'game' || saveInFlight) {
    return
  }

  saveInFlight = true

  try {
    const result = await player.save(gameManager)

    if (result.status !== 'ok' && !saveFailureNotified) {
      saveFailureNotified = true
      notification.push('error', 'Không lưu được tiến trình — bộ nhớ trình duyệt đầy. Hãy hóa luyện bớt trang bị.')
      console.warn('[autosave] progress was not saved', result)
    } else if (result.status === 'ok') {
      saveFailureNotified = false
    }
  } catch (error: unknown) {
    console.error('[autosave] unexpected save failure', error)
  } finally {
    saveInFlight = false
  }
}
```

(Cần `const notification = useNotificationStore()` trong setup nếu chưa có — kiểm tra trước.)

`SettingsPanel.vue` handleSave (dòng 44-50):

```ts
async function handleSave() {
  const result = await player.save(gameManager)

  if (result.status === 'ok') {
    lastSavedLabel.value = new Date().toLocaleTimeString('vi-VN')
    notification.push('save', 'Đã lưu tiến trình')
  } else {
    lastSavedLabel.value = 'Lưu thất bại'
    notification.push('error', 'Không lưu được — bộ nhớ đầy hoặc bị chặn.')
  }
}
```

Template của SettingsPanel nếu đang gọi `handleSave()` như event handler sync thì vẫn giữ nguyên — Vue handler chấp nhận async function.

- [ ] **Step 5: Run focused tests + type-check**

```bash
npm.cmd test -- src/services/cloudSave src/services/save
npm.cmd run type-check
```

---

### Task 3: Export save dùng dữ liệu VỪA save (H2)

**Vấn đề:** `handleExport` gọi `player.save()` (async, ghi localStorage sau microtask) rồi đọc `getRawSave()` sync ngay → file tải về là save 15s trước.

**Files:**
- Modify: `game/src/components/panels/SettingsPanel.vue:65-75`

**Interfaces:**
- Consumes: `player.save(gameManager)` trả `Promise<CloudSaveWriteResult>`; `getRawSave()` trả `string | null`.

- [ ] **Step 1: Implement (không cần test mới — logic thuần orchestration; test component hiện có vẫn pass)**

```ts
// SettingsPanel.vue — thay handleExport
async function handleExport() {
  // PHẢI await — writeGameSave chạy trong microtask (cloudSaveCoordinator
  // → LocalCloudSaveService.save đều async); đọc localStorage ngay sau lời
  // gọi sync sẽ lấy save 15s cũ (bug audit 2026-08-31).
  const result = await player.save(gameManager)

  if (result.status !== 'ok') {
    notification.push('error', 'Không thể xuất save — ghi dữ liệu thất bại.')
    return
  }

  const raw = getRawSave()

  if (raw) {
    exportSaveToFile(raw)
  }
}
```

- [ ] **Step 2: Type-check + existing SettingsPanel tests**

```bash
npm.cmd run type-check
npm.cmd test -- src/components/panels/EquipmentHallPanel
```

(SettingsPanel không có test file riêng theo audit; chạy test lân cận để chắc không vỡ.)

---

### Task 4: EquipmentBag soft cap + auto-dissolve (C1c)

**Vấn đề:** Túi không giới hạn — mỗi drop `bag.add()`, không gì tự remove → save phình → quota. User chọn: **cap mềm + tự động hóa luyện phẩm chất thấp nhất khi vượt ngưỡng**.

**Files:**
- Modify: `game/src/core/equipment/EquipmentBag.ts`
- Modify: `game/src/core/game/BattleLootSystem.ts:440-450, 530-545` (2 call site `equipmentBag.add(instance)`)
- Modify: `game/src/core/game/GameManager.ts:1833, 2992` (2 call site `equipmentBag.add(instance)` — đọc context từng site trước khi sửa)
- Test: `game/src/core/equipment/EquipmentBag.autoDissolve.test.ts` (create)

**Thiết kế (không đổi balance):**
- `EQUIPMENT_BAG_SOFT_CAP = 500` (const trong EquipmentBag.ts, kèm comment giải thích tại sao 500: đủ thoải mái chơi tay, giữ save ~<2MB).
- Auto-dissolve chạy NGAY SAU khi add làm vượt cap: lấy danh sách item **không trang bị, không lock, không favorite**, sort ascending theo (quality rank, rồi rarity rank, rồi forgePoints), remove đủ số vượt cap, mỗi item trả essence reward theo đúng bảng `DISSOLVE_ESSENCE_RANGE_BY_QUALITY` (dùng cùng hàm với EquipmentSystem.dissolveInstances để không tạo bảng 2).
- Essence cộng qua callback `onAutoDissolve?: (rewards: Array<{ materialId: string; amount: number }>) => void` — BattleLootSystem/GameManager inject khi tạo bag? **KHÔNG** — bag được tạo trong GameManager, không có sẵn materialBag reference. Cách sạch nhất theo kiến trúc hiện tại: `EquipmentBag.add()` trả về rewards auto-dissolve (`Array<{ materialId; amount }>`, empty array nếu không dissolve), CALLER tự quyết cộng vào materialBag. GameManager đã có pattern cộng material (`materialBag.add`) — audit line 446 context cho thấy BattleLootSystem có `this.deps` chứa materialBag? Kiểm tra: BattleLootSystem deps có `equipmentBag` + reward flow qua `give`. Implementer: đọc `BattleLootSystemDeps` interface (BattleLootSystem.ts:70-90) để tìm material access; nếu không có, cộng reward qua cùng kênh `give` của reward flow hiện tại cho consistency.

**Interfaces:**
- Produces:

```ts
export interface AutoDissolveReward { materialId: string; amount: number }
// EquipmentBag.add đổi signature:
add(instance: EquipmentInstance): AutoDissolveReward[]
```

- Các caller hiện bỏ return value — non-breaking.

- [ ] **Step 1: Write failing test**

```ts
// game/src/core/equipment/EquipmentBag.autoDissolve.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { EquipmentBag, EQUIPMENT_BAG_SOFT_CAP } from './EquipmentBag'
import type { EquipmentInstance } from './EquipmentInstance'

function makeInstance(id: string, opts: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    instanceId: id,
    itemId: 'test_item',
    slot: 'weapon',
    realmId: 'refining_qi',
    rarity: 'hoang',
    quality: 0,
    equipped: false,
    ...opts,
  } as EquipmentInstance
}

describe('EquipmentBag — soft cap + auto-dissolve', () => {
  let bag: EquipmentBag

  beforeEach(() => {
    bag = new EquipmentBag()
  })

  it('dưới cap: add trả [] và giữ nguyên item', () => {
    const rewards = bag.add(makeInstance('a'))
    expect(rewards).toEqual([])
    expect(bag.getAll()).toHaveLength(1)
  })

  it('vượt cap: item chất lượng THẤP NHẤT (không equipped/locked/favorite) bị tự dissolve, trả rewards', () => {
    // Lấp đầy bag tới cap với quality 0
    for (let i = 0; i < EQUIPMENT_BAG_SOFT_CAP; i++) {
      bag.add(makeInstance(`fill_${i}`, { quality: 0 }))
    }
    expect(bag.getAll()).toHaveLength(EQUIPMENT_BAG_SOFT_CAP)

    // Add 1 item quality cao → tổng = cap+1 → 1 item quality 0 thấp nhất bị dissolve
    const rewards = bag.add(makeInstance('new_high', { quality: 3 }))

    expect(bag.getAll()).toHaveLength(EQUIPMENT_BAG_SOFT_CAP)
    expect(bag.getAll().some((i) => i.instanceId === 'new_high')).toBe(true)
    expect(bag.getAll().some((i) => i.instanceId === 'fill_0')).toBe(false)
    expect(rewards.length).toBeGreaterThan(0)
  })

  it('KHÔNG tự dissolve item equipped/locked/favorite dù quality thấp', () => {
    for (let i = 0; i < EQUIPMENT_BAG_SOFT_CAP; i++) {
      bag.add(makeInstance(`fill_${i}`, { quality: 0 }))
    }
    bag.add(makeInstance('protected', { quality: 0, equipped: true }))

    // force bag vượt cap bằng item thường — mọi ứng viên dissolve đều protected
    // → chỉ dissolve đủ số, item protected vẫn ở lại
    const before = bag.getAll().length
    bag.add(makeInstance('extra', { quality: 5 }))
    const after = bag.getAll()

    expect(after.length).toBeLessThanOrEqual(EQUIPMENT_BAG_SOFT_CAP)
    expect(after.some((i) => i.instanceId === 'protected')).toBe(true)
  })
})
```

Lưu ý implementer: `EquipmentInstance` type có thể đòi thêm field bắt buộc (xem `EquipmentInstance.ts` — đọc trước, điều chỉnh `makeInstance` cho pass type; không dùng `as EquipmentInstance` trừ khi thật cần — ưu tiên đủ field thật).

- [ ] **Step 2: Run — expect FAIL**

```bash
npm.cmd test -- src/core/equipment/EquipmentBag.autoDissolve.test.ts
```

- [ ] **Step 3: Implement EquipmentBag**

```ts
// game/src/core/equipment/EquipmentBag.ts — thay toàn bộ phần thêm sau imports
import { equipmentEssenceMaterialId } from './EquipmentSystem' // hoặc file chứa hàm — kiểm tra export path
import { DISSOLVE_ESSENCE_RANGE_BY_QUALITY } from './...' // cùng bảng với EquipmentSystem.dissolveInstances

export const EQUIPMENT_BAG_SOFT_CAP = 500

export interface AutoDissolveReward { materialId: string; amount: number }

export class EquipmentBag {
  private instances: EquipmentInstance[] = []

  add(instance: EquipmentInstance): AutoDissolveReward[] {
    if (this.has(instance.instanceId)) {
      return []
    }

    this.instances.push(instance)

    if (this.instances.length <= EQUIPMENT_BAG_SOFT_CAP) {
      return []
    }

    // Cap mềm (audit 2026-08-31): vượt ngưỡng → tự động hóa luyện item
    // "rác" nhất: không trang bị/lock/favorite, quality thấp → rarity →
    // forgePoints. Rewards trả về cho CALLER cộng (bag không biết material
    // system — tránh circular dependency với GameManager).
    return this.autoDissolveOverflow()
  }

  private autoDissolveOverflow(): AutoDissolveReward[] {
    const overflowCount = this.instances.length - EQUIPMENT_BAG_SOFT_CAP
    const candidates = this.instances
      .filter((i) => !i.equipped && !i.locked && !i.favorite)
      .sort((a, b) => a.quality - b.quality || itemGradeRank(a.rarity) - itemGradeRank(b.rarity) || a.forgePoints - b.forgePoints)

    const dissolving = candidates.slice(0, overflowCount)
    const rewards: AutoDissolveReward[] = []

    for (const instance of dissolving) {
      const essenceId = equipmentEssenceMaterialId(instance.realmId)
      const range = essenceId ? DISSOLVE_ESSENCE_RANGE_BY_QUALITY[instance.rarity] : undefined

      if (!essenceId || !range) {
        continue // không có rule chuyển đổi → giữ item, không dissolve mù
      }

      this.instances = this.instances.filter((i) => i.instanceId !== instance.instanceId)
      rewards.push({ materialId: essenceId, amount: range.min })
    }

    return rewards
  }

  // ... giữ nguyên các method cũ khác
}
```

Import paths: đọc `EquipmentSystem.ts` đầu file để tìm đúng export của `equipmentEssenceMaterialId` + `DISSOLVE_ESSENCE_RANGE_BY_QUALITY` + `itemGradeRank` (nếu trong file khác, grep `export function itemGradeRank`). Dùng amount cố định `range.min` (không roll random — auto-dissolve phải deterministic để test; người chơi muốn roll tốt hơn phải dissolve tay).

- [ ] **Step 4: Wire callers**

Với MỖI call site `equipmentBag.add(instance)` (BattleLootSystem.ts:446, 538; GameManager.ts:1833, 2992):

```ts
const autoDissolved = this.equipmentBag.add(instance)
if (autoDissolved.length > 0) {
  // cộng essence vào material flow hiện có của call site (this.give/deps)
  // + push toast 1 LẦN mỗi batch: "Túi đầy — tự hóa luyện N trang bị chất lượng thấp"
}
```

Kiểm tra từng call site: các site nằm trong flow có `give`/`materialBag` sẵn thì dùng đó. Toast qua notification channel mà call site đang dùng (BattleLootSystem dùng event/reward flow — đọc file để tìm). Nếu call site không có kênh toast nào, chỉ cộng material, thôi không thêm kênh mới (tránh architecture change) — để MỘT call site chính (BattleLootSystem drop) có toast nếu có sẵn kênh.

- [ ] **Step 5: Run + type-check**

```bash
npm.cmd test -- src/core/equipment src/core/game
npm.cmd run type-check
```

Chạy full test suite nếu BattleLootSystem tests phàn nàn về `add` mock (vi.fn() trả undefined — `autoDissolved.length` sẽ throw): sửa mock trong test files liên quan (`vi.fn().mockReturnValue([])`).

---

### Task 5: usePanelPagination attach observer reactive (H4)

**Vấn đề:** ResizeObserver chỉ attach trong `onMounted` khi container tồn tại — container trong `v-else` (tab dissolve, lore grid rỗng) chưa render lúc mount → pageSize kẹt 1 vĩnh viễn.

**Files:**
- Modify: `game/src/composables/usePanelPagination.ts`
- Test: `game/src/composables/usePanelPagination.test.ts` (create)

**Interfaces:**
- Signature giữ nguyên — consumer không đổi.

- [ ] **Step 1: Write failing test**

```ts
// game/src/composables/usePanelPagination.test.ts
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { usePanelPagination } from './usePanelPagination'

// jsdom ResizeObserver không có — mock tối thiểu
class MockResizeObserver {
  callback: ResizeObserverCallback
  static instances: MockResizeObserver[] = []
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb
    MockResizeObserver.instances.push(this)
  }
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}

describe('usePanelPagination — container mount sau setup (v-else tab)', () => {
  it('pageSize > 1 khi container xuất hiện SAU mount qua v-if toggle', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    const show = ref(false)

    const Host = defineComponent({
      setup() {
        const { containerEl, pageSize } = usePanelPagination(computed(() => 100), 80)
        return () => h('div', [
          h('button', { onClick: () => (show.value = !show.value) }, 'toggle'),
          show.value
            ? h('div', { ref: containerEl, style: 'height: 400px' })
            : null,
        ])
      },
    })

    const wrapper = mount(Host)

    // Chưa có container — pageSize phải về fallback 1 (không crash)
    expect(wrapper.vm ? true : true).toBe(true) // placeholder — đọc pageSize qua expose không có; kiểm tra gián tiếp qua kết quả dưới

    show.value = true
    await nextTick()
    await nextTick()

    // Container giờ tồn tại — observer PHẢI đã được attach (observe được gọi)
    const instance = MockResizeObserver.instances.at(-1)
    expect(instance?.observe).toHaveBeenCalled()

    // Giả lập resize event như ResizeObserver thật
    instance?.callback(
      [{ contentRect: { height: 400 } } as unknown as ResizeObserverEntry],
      instance as unknown as ResizeObserver,
    )

    // pageSize phải phản ánh 400px / 80px = 5 rows — đọc qua totalPages của list 100 items
    // (cần expose pageSize; nếu không expose được, test qua wrapper.vm)
    vi.unstubAllGlobals()
  })
})
```

Lưu ý implementer: để test đọc được `pageSize`, component Host phải return/expose nó — điều chỉnh Host setup để expose `{ containerEl, pageSize }` qua `defineExpose` hoặc render text `h('div', String(pageSize.value))` rồi assert text content = '5'. **Chọn cách render text** — đơn giản nhất và không đổi API.

- [ ] **Step 2: Run — expect FAIL** (observer không attach vì mount lúc container chưa có)

- [ ] **Step 3: Implement — watch containerEl thay vì chỉ onMounted**

```ts
// usePanelPagination.ts — thay block observer (dòng 22-38)
let observer: ResizeObserver | undefined

// Audit fix 2026-08-31: container có thể nằm trong v-else/v-if — chưa tồn
// tại lúc onMounted (tab Hóa Luyện của EquipmentHallPanel, lore grid rỗng).
// Watch containerEl để attach KHI ref được gán (bất kể lúc nào trong đời
// component), thay vì chỉ thử đúng 1 lần ở mount.
const stopWatch = watch(containerEl, (el) => {
  observer?.disconnect()
  observer = undefined

  if (el) {
    observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        availableHeight.value = entry.contentRect.height
      }
    })

    observer.observe(el)
  }
}, { immediate: true })

onBeforeUnmount(() => {
  stopWatch()
  observer?.disconnect()
})
```

(Xóa `onMounted` block cũ; `onMounted` import có thể bỏ nếu không còn dùng.)

- [ ] **Step 4: Run — expect PASS + regression các consumer**

```bash
npm.cmd test -- src/composables/usePanelPagination
npm.cmd test -- src/components/panels/EquipmentHallPanel
npm.cmd run type-check
```

Kiểm tra manual (user verify sau): mở Khí Đường → tab Hóa Luyện với >1 item → mỗi trang hiện nhiều item (không còn 1/trang).

---

### Task 6: Thanh timer thiên kiếp hiển thị đúng tỉ lệ (H5)

**Vấn đề:** `:value` và `:max` cùng là `questionSecondsRemaining` → bar luôn ~100%.

**Files:**
- Modify: `game/src/core/tribulation/TribulationDirector.ts:27-43` (ActiveTribulationState + 2 site gán)
- Modify: `game/src/components/game/tribulation/TribulationSceneOverlay.vue:60`

**Interfaces:**
- Produces: `ActiveTribulationState` thêm field `questionSecondsLimit: number` — set cùng mọi chỗ set `questionSecondsRemaining` = limit (dòng 264: `active.questionSecondsRemaining = limit` → thêm `active.questionSecondsLimit = limit`; dòng 436: `= profile.firstQuestionSeconds` → thêm limit tương ứng; dòng 222 giữ remaining-only nhưng khi rest về 0 không cần limit mới; dòng 145 init 0; dòng 450 reset 0).

- [ ] **Step 1: Implement core field**

Trong `TribulationDirector.ts`:
1. Thêm field vào `ActiveTribulationState` (sau dòng 37):

```ts
  /** Tổng giây của câu hỏi hiện tại (đứng đầu) — mẫu số cho timer bar. */
  questionSecondsLimit: number
```

2. Mọi chỗ gán `questionSecondsRemaining` bằng 1 limit, gán thêm `questionSecondsLimit` cùng giá trị (dòng 145, 264, 436, 450 — đọc từng chỗ, dòng 222 là tick-down KHÔNG đổi limit).

- [ ] **Step 2: Sửa Bar binding**

```html
<!-- TribulationSceneOverlay.vue dòng 60 — max là limit, không phải remaining -->
<Bar
  class="tribulation-ui__time-track"
  :value="active.questionSecondsRemaining"
  :max="Math.max(1, active.questionSecondsLimit)"
  :height="6"
  anchor="right"
/>
```

- [ ] **Step 3: Test**

Existing `TribulationDirector.test.ts` — thêm 1 case:

```ts
it('questionSecondsLimit phản ánh limit của câu hỏi hiện tại', () => {
  // khởi tạo tribulation theo pattern test hiện có trong file (đọc fixture
  // setup sẵn), rồi:
  const active = director.getActiveTribulation()! // hoặc pattern get hiện có
  expect(active.questionSecondsRemaining).toBeGreaterThan(0)
  expect(active.questionSecondsLimit).toBeGreaterThanOrEqual(active.questionSecondsRemaining)
})
```

Đọc file test hiện có để khớp cách setup director (14 dòng đầu file cho thấy fixture pattern).

```bash
npm.cmd test -- src/core/tribulation
npm.cmd run type-check
```

---

### Task 7: MainScene listener lifecycle (H3)

**Vấn đề:** `scale.on('resize')` anonymous + `events.on('shutdown')` anonymous — tích lũy mỗi lần restart scene. CombatScene đã có pattern đúng; MainScene chưa.

**Files:**
- Modify: `game/src/game/scenes/MainScene.ts:160-168, 255-281`
- Test: `game/src/game/scenes/MainScene.lifecycle.test.ts` (create — model theo `CombatScene.lifecycle.test.ts:157-166`)

- [ ] **Step 1: Write failing test (model theo CombatScene.lifecycle.test.ts)**

```ts
// game/src/game/scenes/MainScene.lifecycle.test.ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Source-contract test (cùng cách CombatScene.lifecycle.test.ts) — anonymous
// listener trên ScaleManager game-level TÍCH TỤY qua các lần create().
const source = readFileSync(resolve(__dirname, 'MainScene.ts'), 'utf-8')

describe('MainScene lifecycle — listener không tích lũy qua restart', () => {
  it('scale.on resize phải qua handler field có tên, KHÔNG anonymous inline', () => {
    expect(source).not.toMatch(/scale\.on\('resize', \(/)
  })

  it('scale.off phải được gọi trong shutdown', () => {
    expect(source).toMatch(/scale\.off\('resize'/)
  })

  it('events.shutdown phải dùng once + named handler (không anonymous)', () => {
    expect(source).not.toMatch(/events\.on\('shutdown', \(\) =>/)
    expect(source).toMatch(/events\.once\('shutdown'/)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm.cmd test -- src/game/scenes/MainScene.lifecycle
```

- [ ] **Step 3: Implement (copy pattern CombatScene.ts:572-575, 599)**

```ts
// MainScene.ts — thêm class fields:
private resizeHandler = (gameSize: ResizeSize) => {
  this.applyBackgroundLayout(gameSize.width, gameSize.height)
}

private shutdownHandler = () => {
  this.unsubscribeCombatEvents()
  this.scale.off('resize', this.resizeHandler)
}

// create() — thay dòng 162-168:
this.scale.on('resize', this.resizeHandler)
this.subscribeCombatEvents()
this.events.once('shutdown', this.shutdownHandler)
```

- [ ] **Step 4: Run — expect PASS + toàn bộ scene tests**

```bash
npm.cmd test -- src/game/scenes
npm.cmd run type-check
```

---

### Task 8: CombatScene clear status icons khi battle_start (M3)

**Vấn đề:** `onBattleStart()` không dọn `this.statuses` — icon DoT cũ đóng băng trên màn qua auto-refight.

**Files:**
- Modify: `game/src/game/scenes/CombatScene.ts:1862-1918` (onBattleStart)
- Test: source-contract bổ sung vào `game/src/game/scenes/CombatScene.lifecycle.test.ts`

- [ ] **Step 1: Thêm source-contract test**

Đọc `CombatScene.lifecycle.test.ts` hiện có, thêm vào describe phù hợp:

```ts
it('onBattleStart phải dọn statuses (icon DoT không sót qua auto-refight)', () => {
  // onBattleStart phải gọi clear statuses — dùng regex vì body dài
  const onBattleStartBody = source.match(/onBattleStart\(\) \{[\s\S]*?\n  \}/)?.[0] ?? ''
  expect(onBattleStartBody).toMatch(/statuses/)
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement — thêm vào onBattleStart (sau block dotAccumulators.clear() dòng ~1872)**

```ts
// Audit fix 2026-08-31 — status VFX icons của trận trước (DoT còn tick khi
// battle end, không có status_vfx_removed event) không được dọn ở đây từng
// khiến icon cũ đóng băng trên màn qua auto-refight trong cùng scene.
for (const status of this.statuses.values()) {
  status.icon.destroy()
  status.label.destroy()
}

this.statuses.clear()
```

- [ ] **Step 4: Run**

```bash
npm.cmd test -- src/game/scenes
npm.cmd run type-check
```

---

### Task 9: MainScene null refs trong shutdown (M3b — phòng resize firing sau stop)

**Vấn đề:** Resize callback có thể fire khi scene đã shutdown nhưng listener chưa kịp remove (task 7 xử lý phần lớn; belt-and-suspenders: `applyBackgroundLayout` đã có null guard dòng 172 — nhưng `this.player`, `skyRect`, `groundRect` không bị null trong shutdown nên giữ tham chiếu chặn GC).

**Files:**
- Modify: `game/src/game/scenes/MainScene.ts` (shutdownHandler từ Task 7)

- [ ] **Step 1: Mở rộng shutdownHandler**

```ts
private shutdownHandler = () => {
  this.unsubscribeCombatEvents()
  this.scale.off('resize', this.resizeHandler)

  // Null refs scene-scoped để (a) resize callback lỡ trúng giữa shutdown
  // không mutate dead GameObjects, (b) closure không giữ scene state khỏi GC.
  this.skyRect = undefined
  this.groundRect = undefined
  this.player = undefined
  this.eventBus = undefined
}
```

Kiểm tra type các field trước (`skyRect?: Phaser.GameObjects.Rectangle` — nếu đang là non-optional thì cần sửa khai báo thành optional). `applyBackgroundLayout` guard dòng 172 đã handle undefined.

- [ ] **Step 2: Verify**

```bash
npm.cmd test -- src/game/scenes
npm.cmd run type-check
```

---

### Task 10: EnemyManager clear khi trận kết thúc/bỏ (M1)

**Vấn đề:** Trận thua/bỏ — living enemies + pending spawns orphan trong EnemyManager vĩnh viễn (leak mỗi trận).

**Files:**
- Modify: `game/src/core/game/GameManager.ts` (abandonBattle ~dòng 2870, và nơi xử lý battle end defeat — tìm `state = 'defeat'` / victory cleanup flow)
- Test: `game/src/core/game/GameManager.enemyClear.test.ts` (create)

**Nguyên tắc:** KHÔNG clear khi victory (processDefeatedEnemies đã despawn dần + despawn đã chạy) — chỉ clear khi battle bị abandon (người chơi thoát giữa chừng) để không xóa enemy mà flow khác còn đọc. Cẩn thận: StageWaveSystem auto-repeat spawn enemy MỚI qua `enemySystem.spawn` ngay sau victory — nếu clear chỗ sai sẽ xóa enemy của trận mới. **Chỉ thêm clear trong `abandonBattle()`** — nơi duy nhất battle bị hủy không qua victory flow.

- [ ] **Step 1: Write failing test**

```ts
// game/src/core/game/GameManager.enemyClear.test.ts
// Đọc GameManager.bossSummon.test.ts / repeatStage.test.ts để copy
// pattern setup GameManager thật (không mock toàn bộ).
import { describe, expect, it } from 'vitest'
// ... setup pattern như GameManager.repeatStage.test.ts

describe('abandonBattle — EnemyManager cleanup', () => {
  it('abandon giữa trận KHÔNG để enemy sót trong EnemyManager', () => {
    const gameManager = createGameManager() // theo pattern test hiện có
    const player = createPlayer() // pattern hiện có
    const enemy = defineEnemy(enemyDefinition()) // pattern hiện có

    gameManager.startBattle(player, enemy)

    const before = gameManager.enemySystem.getAliveEnemies().length
    expect(before).toBeGreaterThan(0)

    expect(gameManager.abandonBattle()).toBe(true)

    expect(gameManager.enemySystem.getAliveEnemies()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// GameManager.ts abandonBattle() — sau battle.state = 'defeat':
// Audit fix 2026-08-31 — enemy sống + pending spawn của trận bị bỏ không
// qua victory flow (processDefeatedEnemies despawn) → orphan vĩnh viễn
// trong EnemyManager. Clear ở ĐÚNG điểm hủy trận, không đụng flow victory
// (StageWave auto-repeat spawn trận mới ngay sau victory).
this.enemyManager.clear()
```

Kiểm tra `enemyManager` là field của GameManager (dòng 401: `readonly enemySystem = new EnemySystem(this.enemyManager)` — vậy `this.enemyManager` tồn tại).

- [ ] **Step 4: Run**

```bash
npm.cmd test -- src/core/game
npm.cmd run type-check
```

Chạy full suite nếu nghi vấn: `npm.cmd test` — 1489 tests phải pass.

---

### Task 11: Toast queue cap + insight while guard + KiemY tier ceiling (M2 + M5-hardening)

**Vấn đề 1:** `queuedToasts` không giới hạn — farm nhanh tích nghìn toast stale.
**Vấn đề 2:** `while (accumulator >= threshold)` — threshold 0/negative (data edit) → infinite loop trong tick 100ms.
**Vấn đề 3:** `getKiemYTier` while không ceiling — save hand-edit `bossKillCount: 1e300` → treo UI.

**Files:**
- Modify: `game/src/stores/notification.ts:40-49`
- Modify: `game/src/stores/player.ts:110-120`
- Modify: `game/src/core/player/KiemYSystem.ts:20-31`
- Test: modify `game/src/stores/notification.test.ts` + tạo `game/src/core/player/KiemYSystem.test.ts`

- [ ] **Step 1: Notification — cap queue**

Trong `push()`:

```ts
// notification.ts push() — thêm sau dòng 41:
const MAX_QUEUED_TOASTS = 100

// trong push, thay this.queuedToasts.push(toast):
if (this.toasts.length >= this.maxVisible) {
  // Audit fix — cap hàng đợi: farm AoE late-game push >10 toast/s trong
  // khi drain chỉ ~1.4/s; không cap thì queue phình + replay stale toast
  // hàng phút sau. Vượt cap thì BỎ toast mới (toast cũ đã chờ lâu hơn,
  // bỏ cũ sẽ làm thứ tự loot lệch).
  if (this.queuedToasts.length >= MAX_QUEUED_TOASTS) {
    return
  }

  this.queuedToasts.push(toast)
  return
}
```

Test trong `notification.test.ts` (đọc file hiện có, thêm):

```ts
it('queuedToasts có cap — push vượt 100 bị bỏ, không tích vô hạn', () => {
  const store = useNotificationStore()
  for (let i = 0; i < 150; i++) {
    store.push('save', `msg ${i}`)
  }
  expect(store.queuedToasts.length).toBeLessThanOrEqual(100)
})
```

- [ ] **Step 2: player.ts — insight guard**

```ts
// player.ts dòng 110-120 — thay điều kiện:
if (insightThreshold !== undefined && gained > 0 && insightThreshold > 0) {
  // guard `> 0`: talent data edit đặt cultivationPerInsight: 0 từng tạo
  // infinite loop (accumulator -= 0 không giảm) — freeze tick 100ms vĩnh viễn.
  ...
}
```

- [ ] **Step 3: KiemYSystem — ceiling**

```ts
// KiemYSystem.ts — thêm const + guard:
export const MAX_KIEM_Y_TIER = 100

export function getKiemYTier(bossKillCount: number): number {
  let tier = 0
  // Audit fix — ceiling: bossKillCount không được validate trong save
  // (chỉFinite check), hand-edit 1e300 từng treo UI thread O(√n) vòng.
  // Tier > 100 không có ý nghĩa balance (0.5%×100 = +50% đã rất lớn).
  while (
    tier < MAX_KIEM_Y_TIER &&
    bossKillCount >=
      TIER_1_BOSS_KILLS * (tier + 1) +
        (TIER_STEP_BOSS_KILLS * (tier + 1) * tier) / 2
  ) {
    tier++
  }
  return tier
}
```

Test mới `KiemYSystem.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getKiemYTier, MAX_KIEM_Y_TIER } from './KiemYSystem'

describe('getKiemYTier — ceiling guard', () => {
  it('bossKillCount khổng lồ không treo — trả ceiling', () => {
    expect(getKiemYTier(1e300)).toBe(MAX_KIEM_Y_TIER)
  })

  it('giá trị thường vẫn đúng', () => {
    expect(getKiemYTier(9)).toBe(0)
    expect(getKiemYTier(10)).toBe(1)
    expect(getKiemYTier(25)).toBe(2)
  })
})
```

- [ ] **Step 4: Run**

```bash
npm.cmd test -- src/stores src/core/player
npm.cmd run type-check
```

---

### Task 12: Electron quit-flush await save (M5)

**Vấn đề:** `notifyFlushComplete()` gọi ngay sau `player.save()` không await — main process đóng app tin flush thành công dù write fail.

**Files:**
- Modify: `game/src/composables/useElectronBridge.ts:50-53`

**Interfaces:**
- Consumes: `player.save(gameManager)` → `Promise<CloudSaveWriteResult>`.

- [ ] **Step 1: Implement**

```ts
// useElectronBridge.ts — thay onBeforeQuitFlush callback:
electronAPI.onBeforeQuitFlush(() => {
  // Audit fix 2026-08-31 — PHẢI await: writeGameSave chạy async qua
  // cloudSaveCoordinator; flush-complete trước đó khiến main process
  // đóng app tin rằng đã lưu (silent data loss khi quota fail).
  void (async () => {
    try {
      await player.save(gameManager)
    } catch (error: unknown) {
      console.error('[electron] quit flush save failed', error)
    } finally {
      electronAPI.notifyFlushComplete()
    }
  })()
})
```

Lưu ý: callback của `onBeforeQuitFlush` phải là sync (không được trả promise — preload ipcRenderer.on không handle async), nên dùng IIFE async + `void`. FLUSH_TIMEOUT_MS 2s của main process (electron/main.ts) vẫn là backstop nếu save chậm hơn.

- [ ] **Step 2: Verify**

```bash
npm.cmd run type-check
npm.cmd test -- src/composables
```

---

### Task 13: Dọn 8 breakthrough_token chết + Misc LOW nhanh (M7 + L-items)

**Vấn đề:** 8 material `breakthrough_token_*` là data chết sau v54; kèm các LOW: `template.name` unguarded trong EquipmentBagSection, `realmId` rác crash boot, `loadUiScale` thiếu try/catch.

**Files:**
- Modify: `game/src/data/materials/materials.ts:107-180` (xóa block)
- Modify: `game/src/components/panels/bag-sections/EquipmentBagSection.vue:64-92`
- Modify: `game/src/services/save/saveShapeValidation.ts:116-117` (validate realmId tồn tại trong REALMS)
- Modify: `game/src/composables/uiScale.ts:19-27`
- Test: chạy data tests hiện có + save shape validation tests

- [ ] **Step 1: Xóa dead materials**

Xóa toàn bộ 8 entry `breakthrough_token_*` (dòng 118-180) + comment block mô tả cơ chế (dòng 107-117) trong `materials.ts`. Giữ lại phần comment đầu file cho 4 item Trúc Cơ ẩn (great_dao_seed...).

Grep xác nhận không còn reference: `rg breakthrough_token src/` — chỉ được phép thấy trong git history, không phải src.

- [ ] **Step 2: EquipmentBagSection guard**

```ts
// EquipmentBagSection.vue — dòng 64-92, thêm guard:
const template = gameManager.equipmentRegistry.get(instance.itemId)

if (!template) {
  // Registry miss (data edit/save lệch) — từng crash cả panel qua
  // ErrorBoundary; hiển thị id thay vì chết.
  return {
    instance,
    name: instance.itemId,
    cell: {
      key: instance.instanceId,
      label: instance.itemId,
      nameSegments: [{ text: instance.itemId }],
      description: '',
      equipmentQualityRank: equipmentQualityRank(instance.quality),
      rarityRank: itemGradeRank(instance.rarity),
      state: {} as SlotPresentationState,
      icon: instance.icon,
      onClick: () => handleClick(instance.instanceId),
    },
  }
}
```

(Đọc `composeEquipmentNameSegments` — nếu nó tự handle undefined template (EquipmentHallPanel dòng 126 cho thấy pattern `template?.name` tồn tại), có thể đơn giản hơn: `name: template?.name ?? instance.itemId`.)

- [ ] **Step 3: saveShapeValidation — realmId phải tồn tại**

```ts
// saveShapeValidation.ts — sau requireString(player, 'realmId'...) dòng 117:
// Audit fix — realmId rác từng pass shape check (chỉ check string) rồi
// crash boot ở getCurrentRealm() throw.
import { REALMS } from '../../data/realms/realm'
// ...
if (
  typeof player.realmId === 'string' &&
  !REALMS.some((realm) => realm.id === player.realmId)
) {
  issues.push({ path: 'player.realmId', message: `không tồn tại trong REALMS: ${player.realmId}` })
}
```

- [ ] **Step 4: loadUiScale try/catch**

```ts
// uiScale.ts loadUiScale:
export function loadUiScale(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    // ... unchanged parse logic
  } catch {
    return 1 // storage bị chặn (SSR/privacy mode) — dùng default
  }
}
```

- [ ] **Step 5: Run affected suites**

```bash
npm.cmd test -- src/data src/services/save src/composables
npm.cmd run type-check
```

Kiểm tra không test nào referencing breakthrough_token — grep trong `src/**/tests` trước.

---

### Task 14: Locale nhất quán — VendorPanel/SpiritSpringPanel dùng formatNumber (M9)

**Vấn đề:** Cùng tiền tệ hiển thị `en-US` (12,345) từ formatNumber nhưng `vi-VN` (12.345) từ panels — gây nhầm thập phân.

**Quyết định thiết kế:** Game là tiếng Việt, nhưng `formatNumber` đã là chuẩn toàn app (K suffix) — panels phải route qua `formatNumber` thay vì toLocaleString riêng lẻ. Không đổi NumberFormatter (tránh đụng 1489 tests).

**Files:**
- Modify: `game/src/components/panels/VendorPanel.vue:186-263` (8 sites)
- Modify: `game/src/components/panels/SpiritSpringPanel.vue:90-92` (3 sites)
- Modify: `game/src/components/panels/SettingsPanel.vue:47` (toLocaleTimeString thêm 'vi-VN' — làm ở Task 3 file chung, nhưng làm ở đây để gom)

- [ ] **Step 1: Thay từng site**

Ví dụ VendorPanel dòng 186:

```html
<!-- trước -->
<span>{{ SPIRIT_STONE_MATERIAL.name }}: {{ haPhamOwned.toLocaleString('vi-VN') }}</span>
<!-- sau — cần import formatNumber trong script setup -->
<span>{{ SPIRIT_STONE_MATERIAL.name }}: {{ formatNumber(haPhamOwned) }}</span>
```

Thêm import: `import { formatNumber } from '@/core/format/NumberFormatter'` (cả 2 file). Lặp cho mọi `toLocaleString('vi-VN')` trong 2 file (đọc từng site — site nào dùng `{ maximumFractionDigits: 1 }` thì giữ nguyên số thập phân qua `formatNumber(Math.round(x * 10) / 10)` hoặc chỉ formatNumber nếu chấp nhận làm tròn — ưu tiên formatNumber thuần cho nhất quán).

SettingsPanel dòng 47: `new Date().toLocaleTimeString('vi-VN')`.

- [ ] **Step 2: Run**

```bash
npm.cmd run type-check
npm.cmd test -- src/components/panels
```

---

### Task 15: Full verification sweep

**Files:** Không sửa — chỉ verify toàn bộ.

- [ ] **Step 1: Full test suite**

```bash
npm.cmd test
```

Expected: tất cả pass (baseline 1489 + các test mới).

- [ ] **Step 2: Type-check + build**

```bash
npm.cmd run type-check
npm.cmd run build
```

- [ ] **Step 3: Smoke test runtime (bằng Playwright e2e nếu có sẵn config)**

```bash
npm.cmd run test:e2e
```

Nếu e2e đòi playwright browsers chưa install: bỏ qua, note trong summary.

- [ ] **Step 4: Tổng kết diff cho user review**

```bash
git status
git diff --stat
```

Report: files changed, verification results, remaining limitations (các mục đã defer: Supabase C2, reactivity M6, a11y M8, physics M4, Tribulation persist L-item).

---

## Self-Review checklist (đã chạy khi viết plan)

1. **Spec coverage:** 12 vấn đề main được phủ: C1 (Task 1,2,4), C2 (defer theo user), H1 (defer — aliasing stats được ghi nhận là "núi lửa đang ngủ", có try/finally restore, không có live corruption; fix thật sự = restructure enemyToCombatEntity — rủi ro cao hơn giá trị hiện tại → ghi vào remaining limitations), H2 (Task 3), H3 (Task 7,9), H4 (Task 5), H5 (Task 6), H6 (Task 11), M1 (Task 10), M2 (Task 11), M3 (Task 8), M5 (Task 12), M7/M9 (Task 13,14). M4 (physics unused) + M6 (reactivity) + M8 (a11y) defer theo user choice.
2. **Placeholder scan:** Các step có code thật; những chỗ cần implementer đọc file trước (EquipmentInstance fields, BattleLootSystemDeps, test fixtures) được đánh dấu rõ Lưu ý — đây là "đọc rồi adapt", không phải TBD trống.
3. **Type consistency:** `SaveWriteResult` (Task 1) → consumed ở Task 2, 12. `AutoDissolveReward` (Task 4) internal. `questionSecondsLimit` (Task 6) consistent core→UI.

## Risk notes

- Task 4 chạm đường loot — chạy full suite sau.
- Task 10 chạm battle flow — cẩn thận KHÔNG clear trong victory path.
- H1 (stats aliasing) KHÔNG fix trong plan này — fix an toàn là việc lớn (restructure spawn + combat entity creation), current behavior đúng nhờ try/finally. Đã ghi rõ trong limitations.
