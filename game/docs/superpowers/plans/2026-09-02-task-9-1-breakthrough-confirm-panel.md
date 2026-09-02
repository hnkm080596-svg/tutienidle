# Task 9.1 — Breakthrough Confirm Panel + Auto-Unequip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế flow đột phá phân mảnh (3 trigger hàm + BreakthroughRequirementPanel sai cost) bằng 1 hàm `triggerBreakthroughAction()` duy nhất + 1 panel xác nhận "Độ kiếp cũng là độ thân..." với auto-unequip idempotent.

**Architecture:** Gộp 3 trigger hàm trong `useTribulation.ts` thành 1, resolve target realm từ `player.realmId`. Gộp 2 gate hàm trong `GameManager.ts` thành `canTriggerBreakthrough()`. Thay `BreakthroughRequirementPanel.vue` bằng panel xác nhận đơn giản (không Linh Thạch cost). Auto-unequip chạy trong `triggerBreakthroughAction()` (trước `startTribulation`) + giữ nguyên trong `resolveVictory()` (defense-in-depth). `chooseCultivationPath` không đổi — nó là feature unlock SAU đột phá, không phải đột phá.

**Tech Stack:** TypeScript, Vitest, Vue 3 SFC, Pinia, vue-i18n; không dependency mới.

**Spec:** `game/docs/superpowers/specs/2026-09-02-task-9-1-breakthrough-equip-panel-design.md` (v6) — plan lập luận từ spec; executors đọc CẢ HAI file.

## Global Constraints

- Không `any`; không dependency mới; không đổi architecture ngoài phạm vi spec.
- **Không migration save** (dev phase).
- Terminology: Đột phá = 1 chức năng duy nhất. Quán Khí/Trúc Cơ = tên riêng ở từng cảnh giới. Chọn path/Pháp Bảo/Luyện Thể/Kinh Mạch = feature unlocks SAU đột phá.
- Mọi string hiển thị qua i18n (`t()` + `vi.json`/`en.json`).
- Pattern "facade trước, ruột sau": composable/component chỉ gọi `GameManager` facade, không đụng `equipmentBag` trực tiếp.
- UI Layout Rule: panel dùng `OverlayPanel` primitive (đã có scrim, aria, transition, flex layout).
- Verify chuẩn: `npm.cmd run type-check` + vitest liên quan + `npm.cmd run build` khi đụng production code.

---

### Task 1: `canTriggerBreakthrough` unified ở GameManager

**Files:**
- Modify: `game/src/core/game/GameManager.ts:1588-1606`
- Test: `game/src/core/game/GameManager.progressionScope.test.ts`

**Interfaces:**
- Consumes: `PlayerData` (existing), `CORE_REALM_LEVEL` (existing, `realmSystem.ts:45`)
- Produces: `GameManager.canTriggerBreakthrough(player: PlayerData): boolean` — thay `canTriggerFoundationBreakthrough` + `canTriggerRealmBreakthrough`

- [ ] **Step 1: Viết failing test cho `canTriggerBreakthrough`**

Sửa `GameManager.progressionScope.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'

describe('GameManager current realm progression scope', () => {
  it('mortal tầng 12 → canTriggerBreakthrough true', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12

    expect(gameManager.canTriggerBreakthrough(player)).toBe(true)
  })

  it('mortal tầng 11 → canTriggerBreakthrough false', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 11

    expect(gameManager.canTriggerBreakthrough(player)).toBe(false)
  })

  it('qi_refining tầng 12 → canTriggerBreakthrough true', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 12

    expect(gameManager.canTriggerBreakthrough(player)).toBe(true)
  })

  it('không mở đột phá sau Trúc Cơ tầng 18', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 18

    expect(gameManager.canTriggerBreakthrough(player)).toBe(false)
  })

  it('không mở API tổng quát cho các realm placeholder', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'golden_core'
    player.realmLevel = 9

    expect(gameManager.canTriggerBreakthrough(player)).toBe(false)
  })
})
```

- [ ] **Step 2: Chạy test — verify FAIL**

Run: `npm.cmd run test -- src/core/game/GameManager.progressionScope.test.ts`
Expected: FAIL — `canTriggerBreakthrough` chưa tồn tại.

- [ ] **Step 3: Implement `canTriggerBreakthrough`**

Trong `GameManager.ts`, thay 2 hàm cũ (lines 1588-1606) bằng:

```typescript
/**
 * Gate đột phá unified — 1 hàm cho MỌI cảnh giới. Trả về true nếu
 * người chơi đủ điều kiện bấm nút Đột Phá (Quán Khí / Trúc Cơ / ...).
 *
 * PRODUCT SCOPE: game hiện chỉ thiết kế tới Trúc Cơ tầng 18. Các realm
 * placeholder (Kim Đan+) trả false cho tới khi có content pass tương ứng.
 */
canTriggerBreakthrough(player: PlayerData): boolean {
  if (player.realmId === 'mortal' || player.realmId === 'qi_refining') {
    return player.realmLevel >= CORE_REALM_LEVEL
  }
  return false
}
```

Xoá `canTriggerFoundationBreakthrough` và `canTriggerRealmBreakthrough`.

- [ ] **Step 4: Chạy test — verify PASS**

Run: `npm.cmd run test -- src/core/game/GameManager.progressionScope.test.ts`
Expected: PASS 5/5.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/game/GameManager.ts game/src/core/game/GameManager.progressionScope.test.ts
git commit -m "feat(GameManager): unify canTriggerBreakthrough — replace 2 realm-specific gates (Task 9.1)"
```

---

### Task 2: Gộp 3 trigger hàm → `triggerBreakthroughAction`

**Files:**
- Modify: `game/src/composables/useTribulation.ts`
- Test: `game/src/composables/cultivationRitualFlow.integration.test.ts`

**Interfaces:**
- Consumes: `GameManager.canTriggerBreakthrough()` (Task 1), `GameManager.startTribulation()` (existing), `GameManager.unequipAllEquipment()` (existing), `GameManager.getEquipmentModifiers()` (existing), `getNextRealm()` (existing, `realmSystem.ts:13`)
- Produces: `triggerBreakthroughAction(player: PlayerStore, gameManager: GameManager): boolean` — thay 3 hàm cũ

- [ ] **Step 1: Viết failing test cho `triggerBreakthroughAction`**

Sửa `cultivationRitualFlow.integration.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { PHAP_TU_NODES } from '../data/progression/PhapTuNodes'
import { SKILLS } from '../data/skill/Skills'
import { TECHNIQUES } from '../data/technique/Techniques'
import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { GameManager } from '../core/game/GameManager'
import { getTribulationChapters } from '../data/tribulation/TribulationChapters'
import {
  checkTribulationOutcomeAction,
  triggerBreakthroughAction,
} from './useTribulation'

function tribulationTotalSeconds(targetRealmId: string): number {
  return getTribulationChapters(targetRealmId)!.reduce((total, chapter) => {
    if (chapter.mind) {
      return total + chapter.mind.questionCount * (chapter.mind.firstQuestionSeconds + chapter.mind.restSecondsBetweenQuestions) + 2
    }
    return total + chapter.tank!.durationSeconds + 2
  }, 0)
}

describe('chuỗi nghi lễ tu luyện Pháp Tu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Phàm Nhân → Quán Khí → chọn Pháp Tu → Trúc Cơ giữ đúng state và reward', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerTechniqueTemplates(TECHNIQUES)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    player.realmLevel = 12
    player.baseStats.defense = 10_000
    player.baseStats.maxHp = 500_000

    expect(triggerBreakthroughAction(player, gameManager)).toBe(true)
    gameManager.update(tribulationTotalSeconds('qi_refining'))
    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)
    expect(player.realmId).toBe('mortal')
    expect(useUiStore().standalonePanel).toBe('quan_khi')

    expect(gameManager.chooseCultivationPath('phap_tu', player.$state)).toBe(true)
    expect(player.realmId).toBe('qi_refining')
    expect(player.realmLevel).toBe(1)

    player.realmLevel = 12

    expect(triggerBreakthroughAction(player, gameManager)).toBe(true)
    gameManager.update(tribulationTotalSeconds('foundation_establishment'))
    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)

    expect(player.realmId).toBe('foundation_establishment')
    expect(player.realmLevel).toBe(1)
    expect(player.artifact?.artifactId).toBe('ngu_hanh_chau')
    expect(gameManager.techniqueManager.getEquipped()?.id).toBe('dai_ngu_hanh_quyet_truc_co')
    expect(gameManager.getAggregatedModifiers(player.$state).filter(
      modifier => modifier.sourceId === 'phap_tu',
    )).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Chạy test — verify FAIL**

Run: `npm.cmd run test -- src/composables/cultivationRitualFlow.integration.test.ts`
Expected: FAIL — `triggerBreakthroughAction` chưa export.

- [ ] **Step 3: Implement `triggerBreakthroughAction`**

Trong `useTribulation.ts`:

a) Thêm helper resolve realm (private, không export):

```typescript
function resolveNextBreakthroughRealm(currentRealmId: string): string | null {
  if (currentRealmId === 'mortal') return 'qi_refining'
  if (currentRealmId === 'qi_refining') return 'foundation_establishment'
  return null
}
```

b) Thêm hàm mới (export):

```typescript
/**
 * Bấm nút đột phá (Quán Khí / Trúc Cơ / Độ Kiếp sau Trúc Cơ). Tự
 * resolve target realm từ player.realmId hiện tại.
 *
 * Luôn auto-unequip TRƯỚC khi vào kiếp (idempotent — không có đồ thì
 * không tháo gì). Caller hiện panel xác nhận "Độ kiếp cũng là độ thân"
 * trước khi gọi hàm này.
 */
export function triggerBreakthroughAction(
  player: PlayerStore,
  gameManager: GameManager,
): boolean {
  if (!gameManager.canTriggerBreakthrough(player.$state)) {
    return false
  }

  const battle = gameManager.getBattle()
  if (battle && isBattleInProgress(battle.state)) {
    return false
  }

  const targetRealmId = resolveNextBreakthroughRealm(player.realmId)
  if (!targetRealmId) {
    return false
  }

  gameManager.unequipAllEquipment()
  player.setEquipmentModifiers(gameManager.getEquipmentModifiers())

  const started = gameManager.startTribulation(player.$state, player.finalStats, targetRealmId)

  if (started) {
    useUiStore().enterTribulationScene()
  }

  return started
}
```

c) Xoá 3 hàm cũ: `triggerFoundationBreakthroughAction`, `triggerRealmBreakthroughAction`, `triggerQuanKhiAction`.

d) Cập nhật `useTribulation()` composable:

```typescript
export function useTribulation() {
  const player = usePlayerStore()
  const gameManager = useGameManager()

  return {
    triggerBreakthrough: () => triggerBreakthroughAction(player, gameManager),
    checkTribulationOutcome: () => checkTribulationOutcomeAction(player, gameManager),
  }
}
```

- [ ] **Step 4: Chạy test — verify PASS**

Run: `npm.cmd run test -- src/composables/cultivationRitualFlow.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/composables/useTribulation.ts game/src/composables/cultivationRitualFlow.integration.test.ts
git commit -m "feat(useTribulation): unify 3 trigger functions into triggerBreakthroughAction + auto-unequip (Task 9.1)"
```

---

### Task 3: Panel xác nhận + RealmPanel caller

**Files:**
- Modify: `game/src/components/panels/RealmPanel.vue`
- Modify: `game/src/components/common/BreakthroughRequirementPanel.vue` (thay nội dung)
- Modify: `game/src/stores/breakthroughRequirement.ts` (đổi tên state hoặc giữ nguyên)
- Test: `game/src/components/panels/RealmPanel.test.ts`
- Test: `game/src/components/common/BreakthroughRequirementPanel.test.ts`

**Interfaces:**
- Consumes: `useTribulation().triggerBreakthrough()` (Task 2), `GameManager.canTriggerBreakthrough()` (Task 1), `OverlayPanel.vue` (existing), `GameButton.vue` (existing)
- Produces: Panel xác nhận "Độ kiếp cũng là độ thân..." với 2 nút "Đã hiểu" / "Chờ đã"

- [ ] **Step 1: Viết failing test cho panel xác nhận**

Sửa `BreakthroughRequirementPanel.test.ts`:

```typescript
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import BreakthroughRequirementPanel from './BreakthroughRequirementPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { usePlayerStore } from '@/stores/player'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { GAME_MANAGER_KEY, BUMP_STATE_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'

function mountPanel() {
  const container = document.createElement('div')
  const pinia = createPinia()
  setActivePinia(pinia)

  const manager = new GameManager()
  const player = usePlayerStore()
  player.realmId = 'qi_refining'
  player.realmLevel = 12
  useBreakthroughRequirementStore().open()

  const version = ref(0)

  const app = createApp({ render: () => h(BreakthroughRequirementPanel) })
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, unmount: () => app.unmount() }
}

afterEach(() => { document.body.innerHTML = '' })

describe('BreakthroughRequirementPanel — confirm panel (Task 9.1)', () => {
  it('render title "Độ kiếp cũng là độ thân" + subtitle đỏ + 2 nút', () => {
    const { container, unmount } = mountPanel()

    expect(container.textContent).toContain('Độ kiếp cũng là độ thân')
    expect(container.textContent).toContain('Không thể mặc trang bị khi độ kiếp')
    expect(container.textContent).toContain('Đã hiểu')
    expect(container.textContent).toContain('Chờ đã')

    unmount()
  })

  it('KHÔNG còn hiển thị Linh Thạch cost', () => {
    const { container, unmount } = mountPanel()

    expect(container.textContent).not.toContain('Linh Thạch')

    unmount()
  })
})
```

- [ ] **Step 2: Chạy test — verify FAIL**

Run: `npm.cmd run test -- src/components/common/BreakthroughRequirementPanel.test.ts`
Expected: FAIL — panel cũ hiện Linh Thạch, không có text mới.

- [ ] **Step 3: Rewrite `BreakthroughRequirementPanel.vue`**

Thay toàn bộ nội dung panel bằng confirm panel đơn giản:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { useTribulation } from '@/composables/useTribulation'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import GameButton from '@/components/common/GameButton.vue'

const { t } = useI18n({ useScope: 'local' })
const store = useBreakthroughRequirementStore()
const { triggerBreakthrough } = useTribulation()

function onConfirm() {
  store.close()
  triggerBreakthrough()
}

function onCancel() {
  store.close()
}
</script>

<template>
  <OverlayPanel
    :open="store.isOpen"
    :title="t('tribulation.stillEquipped.title')"
    width="min(420px, 94vw)"
    @close="onCancel"
  >
    <div class="breakthrough-confirm">
      <p class="breakthrough-confirm__warning">{{ t('tribulation.stillEquipped.subtitle') }}</p>

      <div class="breakthrough-confirm__actions">
        <GameButton variant="ghost" size="sm" @click="onCancel">{{ t('tribulation.stillEquipped.cancel') }}</GameButton>
        <GameButton size="sm" @click="onConfirm">{{ t('tribulation.stillEquipped.confirm') }}</GameButton>
      </div>
    </div>
  </OverlayPanel>
</template>

<style scoped>
.breakthrough-confirm {
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.breakthrough-confirm__warning {
  margin: 0;
  padding: 8px 12px;
  font-size: var(--text-sm);
  text-align: center;
  color: var(--danger, #c0392b);
  border: 1px dashed currentColor;
  border-radius: var(--radius-sm);
}

.breakthrough-confirm__actions {
  display: flex;
  gap: 10px;
}

.breakthrough-confirm__actions > * {
  flex: 1;
}
</style>
```

- [ ] **Step 4: Cập nhật `RealmPanel.vue` caller**

Thay `triggerQuanKhi` + `requirement.open()` bằng logic mới:

```typescript
// RealmPanel.vue script — thay đổi:
const { triggerBreakthrough } = useTribulation()
const requirement = useBreakthroughRequirementStore()

const canBreakthrough = computed(() => gameManager.canTriggerBreakthrough(player.$state))

function majorBreakthrough() {
  if (!canBreakthrough.value) return
  requirement.open()
}
```

Xoá `canChoosePath`, `canFoundation`, `canRealm`, `triggerQuanKhi`. Gộp thành `canBreakthrough`.

Cập nhật template: đổi `:disabled="!canMajorBreakthrough"` → `:disabled="!canBreakthrough"`.

- [ ] **Step 5: Chạy test — verify PASS**

Run: `npm.cmd run test -- src/components/common/BreakthroughRequirementPanel.test.ts src/components/panels/RealmPanel.test.ts`
Expected: PASS cả 2.

- [ ] **Step 6: Commit**

```bash
git add game/src/components/common/BreakthroughRequirementPanel.vue game/src/components/common/BreakthroughRequirementPanel.test.ts game/src/components/panels/RealmPanel.vue game/src/components/panels/RealmPanel.test.ts
git commit -m "feat(UI): replace BreakthroughRequirementPanel with confirm panel + update RealmPanel caller (Task 9.1)"
```

---

### Task 4: i18n keys

**Files:**
- Modify: `game/src/locales/vi.json`
- Modify: `game/src/locales/en.json`

**Interfaces:**
- Consumes: không
- Produces: 4 key `tribulation.stillEquipped.{title,subtitle,confirm,cancel}`

- [ ] **Step 1: Thêm keys vào `vi.json`**

Thêm object `tribulation` (hoặc merge nếu đã có):

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

- [ ] **Step 2: Thêm keys vào `en.json`**

```json
"tribulation": {
  "stillEquipped": {
    "title": "Tribulation is also a trial of the self — nothing can aid you",
    "subtitle": "Cannot wear equipment during tribulation",
    "confirm": "I understand",
    "cancel": "Wait"
  }
}
```

- [ ] **Step 3: Chạy type-check**

Run: `npm.cmd run type-check`
Expected: PASS (i18n keys là JSON, không ảnh hưởng type).

- [ ] **Step 4: Commit**

```bash
git add game/src/locales/vi.json game/src/locales/en.json
git commit -m "feat(i18n): add tribulation.stillEquipped keys — confirm panel (Task 9.1)"
```

---

### Task 5: Sửa test cũ + dọn dẹp

**Files:**
- Modify: `game/src/core/game/GameManager.realmAdvanceUnequip.test.ts`
- Modify: `game/src/composables/useTribulation.dotPha.test.ts`
- Modify: `game/src/core/game/GameManager.dotPha.test.ts` (nếu có call cũ)
- Delete: `game/src/stores/breakthroughRequirement.ts` (nếu không còn dùng) — **KHÔNG XOÁ** nếu RealmPanel/BreakthroughRequirementPanel vẫn import.

**Interfaces:**
- Consumes: `triggerBreakthroughAction` (Task 2), `canTriggerBreakthrough` (Task 1)
- Produces: tất cả test pass

- [ ] **Step 1: Sửa `GameManager.realmAdvanceUnequip.test.ts`**

`chooseCultivationPath` KHÔNG auto-unequip (đã chốt — nó là feature unlock, không phải đột phá). Sửa kỳ vọng:

```typescript
it('chooseCultivationPath KHÔNG auto-unequip — weapon vẫn equipped sau realm đổi', () => {
  const manager = setup()
  const player = createDefaultPlayer()
  player.realmLevel = 12

  const weapon = makeInstance({
    instanceId: 'realm-advance-weapon',
    itemId: 'base_kiem',
    grade: 'cuu_pham',
    equipped: true,
  })
  manager.equipmentBag.add(weapon)

  expect(manager.chooseCultivationPath('phap_tu', player)).toBe(true)
  expect(player.realmId).toBe('qi_refining')
  expect(weapon.equipped).toBe(true)
})
```

Xoá test thứ 2 (kẹt re-equip) — không còn áp dụng vì `chooseCultivationPath` không gate.

- [ ] **Step 2: Sửa `useTribulation.dotPha.test.ts`**

Mục "Đột phá tháo toàn bộ trang bị" (line 196-265): test hiện tại gọi `startTribulation` trực tiếp rồi `checkTribulationOutcomeAction` → auto-unequip ở `resolveVictory`. **Giữ nguyên** — hành vi `resolveVictory` không đổi.

Thêm test mới cho `triggerBreakthroughAction` auto-unequip:

```typescript
it('triggerBreakthroughAction auto-unequip TRƯỚC khi vào kiếp', async () => {
  const { triggerBreakthroughAction } = await import('./useTribulation')
  const gameManager = new GameManager()
  gameManager.registerPills(pills)
  const player = usePlayerStore()

  player.realmId = 'qi_refining'
  player.realmLevel = 12
  player.baseStats.defense = 10_000
  player.baseStats.maxHp = 500_000

  const weapon = makeInstance({
    instanceId: 'trigger-unequip-weapon',
    slot: 'weapon',
    grade: PROFESSION_GRADE_BY_REALM.qi_refining,
    equipped: true,
  })
  gameManager.equipmentBag.add(weapon)
  gameManager.equipmentSystem.refreshModifiers(
    gameManager.equipmentBag,
    gameManager.equipmentSlotManager,
    gameManager.affixRegistry,
  )
  player.setEquipmentModifiers(gameManager.getEquipmentModifiers())

  expect(triggerBreakthroughAction(player, gameManager)).toBe(true)
  expect(weapon.equipped).toBe(false)
  expect(gameManager.getActiveTribulation()).not.toBeNull()
})
```

- [ ] **Step 3: Chạy full test suite**

Run: `npm.cmd run test`
Expected: PASS (trừ 1 pre-existing flaky `dongFuBuildingAssets`).

- [ ] **Step 4: Chạy type-check + build**

Run: `npm.cmd run type-check && npm.cmd run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/game/GameManager.realmAdvanceUnequip.test.ts game/src/composables/useTribulation.dotPha.test.ts
git commit -m "test(Task 9.1): update reproduction test + add triggerBreakthroughAction auto-unequip test"
```

---

### Task 6: Dọn dead code + verify cuối

**Files:**
- Modify: `game/src/core/game/GameManager.ts` (xoá `consumeTribulationSpiritStones` + `getTribulationSpiritStoneCost` nếu không còn caller)
- Modify: `game/src/composables/useTribulation.ts` (xoá import không dùng)
- Modify: `game/src/components/common/BreakthroughRequirementPanel.vue` (xoá import `formatNumber`, `SPIRIT_STONE_MATERIAL_ID`, `getNextRealm` nếu không dùng)

**Interfaces:**
- Consumes: không
- Produces: không còn dead code từ flow cũ

- [ ] **Step 1: Grep dead code**

Run: `grep -rn "consumeTribulationSpiritStones\|getTribulationSpiritStoneCost\|canTriggerFoundationBreakthrough\|canTriggerRealmBreakthrough\|triggerFoundationBreakthrough\|triggerRealmBreakthrough\|triggerQuanKhi" game/src/`

Expected: 0 kết quả (hoặc chỉ còn trong comment/doc).

- [ ] **Step 2: Xoá dead code**

Xoá `consumeTribulationSpiritStones` + `getTribulationSpiritStoneCost` khỏi `GameManager.ts` (không có caller sau Task 3).

Xoá import không dùng trong `useTribulation.ts` (`SPIRIT_STONE_MATERIAL_ID`, `getSpiritStoneMaterialIdForRealmTier`, `getRealmTier` nếu không còn dùng ở `resolveDefeat`).

- [ ] **Step 3: Chạy full verify**

Run: `npm.cmd run test && npm.cmd run type-check && npm.cmd run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(Task 9.1): remove dead spirit stone cost code + unused imports"
```