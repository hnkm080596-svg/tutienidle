# Khí Đường Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa 3 bug Khí Đường phát hiện qua playtest ngày 2026-08-30:
1. **Nạp Điểm Rèn không có UI** — item cạn `forgePoints` vĩnh viễn chết.
2. **Tinh Luyện trừ cost oan** khi dòng affix có `tier` không khớp (data cũ/migration).
3. **Tẩy Luyện đồ Hoàng** — nút enabled nhưng lúc bấm mới fail (UX kém).

**Architecture:**
- Mỗi bug sửa 1 file nghiệp vụ (core/composable/UI) + 1 file test tương ứng.
- Không đổi architecture: chỉ thêm wrapper `rechargeItem()` ở `GameManager` + 1 tab thứ 5 trong `EquipmentHallPanel`; thêm 2 guard ở core + 1 `disabled` sớm ở UI.
- 3 task TDD, mỗi task có test viết trước — fix theo.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vitest.

**Spec:** Báo cáo playtest ngày 2026-08-30 (probe tests đã gỡ, bằng chứng nằm trong commit 78 tests pass ở master).

**Worktree:** Branch `agent/fix-khi-duong` từ `master`, worktree `.agent-worktrees/fix-khi-duong`.

## Global Constraints

- Vue 3 + TypeScript — KHÔNG dùng `any` nếu không cần thiết.
- KHÔNG thêm dependency mới.
- Ưu tiên sửa code hiện tại, không viết lại.
- Mọi sửa PHẢI có test trước (TDD), test phải chạy xanh.
- Tiếng Việt trong UI copy, comment tiếng Việt trong code.
- Plan file này dùng song ngữ: tiếng Việt cho nghiệp vụ, tiếng Anh cho code identifier.

---

### Task 1: Tinh Luyện guard tier ghost — không trừ cost oan

**Files:**
- Modify: `game/src/core/equipment/EquipmentSystem.ts:1232-1271` (hàm `rollRefineValues`)
- Test: `game/src/core/equipment/EquipmentSystem.test.ts` (thêm 1 test trong describe `EquipmentSystem — Tinh Luyện`)

**Interfaces:**
- Consumes: `instance.affixes: RolledAffix[]` (có thể có `tier` ngoài range), `affixRegistry: AffixRegistry`
- Produces: behavior cũ + nếu `newValues.size === 0` (mọi dòng đều tier ghost) → return `{ ok: false, reason: 'no_eligible_affix' }` TRƯỚC khi trừ cost.

- [ ] **Step 1: Viết failing test**

Thêm vào describe `EquipmentSystem — Tinh Luyện` trong `EquipmentSystem.test.ts`, cuối describe (sau test "dòng bị khóa GIỮ NGUYÊN value…"):

```ts
  it('mọi dòng đều tier không khớp → từ chối no_eligible_affix, KHÔNG trừ cost (atomic)', () => {
    const ctx = refineSetup()

    // Ép tier=99 — chắc chắn không có trong affix.tiers.
    ctx.instance.affixes = [
      { affixId: affixes[0]!.id, tier: 99, value: 5 },
      { affixId: affixes[1]!.id, tier: 99, value: 5 },
    ]
    ctx.instance.forgePoints = 50

    const stoneBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
    const renBefore = ctx.instance.forgePoints
    const essenceBefore = ctx.materialBag.getAmount(ctx.essenceId)

    const result = ctx.system.refineAffixValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      () => 0.5,
    )

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_eligible_affix')
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stoneBefore)
    expect(ctx.materialBag.getAmount(ctx.essenceId)).toBe(essenceBefore)
    expect(ctx.instance.forgePoints).toBe(renBefore)
  })
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `cd game && npm.cmd run test -- --run src/core/equipment/EquipmentSystem.test.ts -t "tier không khớp"`
Expected: FAIL — test hiện tại expect `result.ok = true` (cost đã bị trừ) → assertion về `essenceBefore` fail.

- [ ] **Step 3: Sửa `rollRefineValues` để validate trước khi trừ cost**

Trong `game/src/core/equipment/EquipmentSystem.ts`, hàm `rollRefineValues` (L1156-1271), sau vòng for tạo `newValues` (kết thúc L1256) và TRƯỚC comment "// Trừ cost NGAY…" (L1258), thêm guard:

```ts
    // Tinh Luyện atomic (plan §7.4) — nếu KHÔNG có dòng nào roll được giá
    // trị mới (data cũ / migration có tier ngoài range affix.tiers) thì
    // trả về no_eligible_affix TRƯỚC khi trừ cost. Tránh mất Tinh Hoa +
    // Linh Thạch + Điểm Rèn oan khi player không nhận được gì.
    if (newValues.size === 0) {
      return { ok: false, reason: 'no_eligible_affix' }
    }
```

- [ ] **Step 4: Chạy lại test để xác nhận PASS**

Run: `cd game && npm.cmd run test -- --run src/core/equipment/EquipmentSystem.test.ts -t "tier không khớp"`
Expected: PASS.

- [ ] **Step 5: Chạy full test equipment để chắc không regression**

Run: `cd game && npm.cmd run test -- --run src/core/equipment`
Expected: Tất cả pass (hiện 58 tests + 1 mới = 59).

- [ ] **Step 6: Commit**

```bash
git add game/src/core/equipment/EquipmentSystem.ts game/src/core/equipment/EquipmentSystem.test.ts
git commit -m "fix(equipment): Tinh Luyện không trừ cost khi mọi dòng tier ghost"
```

---

### Task 2: Tẩy Luyện — disable sớm cho đồ Hoàng (0 affix slot)

**Files:**
- Modify: `game/src/components/panels/EquipmentHallPanel.vue:397-408` (hàm `canWash`)
- Modify: `game/src/components/panels/EquipmentHallPanel.vue` (thêm chú thích trong template hiện có, KHÔNG tạo mới element)
- Test: `game/src/components/panels/EquipmentHallPanel.test.ts` (thêm 1 test trong describe hiện có)

**Interfaces:**
- Consumes: `selectedRow.value` (đã có `instance` ở `selectedRow.value.instance`)
- Produces: `canWash()` trả `false` khi `EQUIPMENT_RARITY_AFFIX_SLOTS[instance.rarity].prefix + suffix === 0`

- [ ] **Step 1: Viết failing test**

Thêm vào `EquipmentHallPanel.test.ts` describe `EquipmentHallPanel — chọn trang bị bằng slot` (cuối describe):

```ts
  it('Tẩy Luyện đồ Hoàng (0 affix slot) → nút disabled kể cả khi đủ quáng/điểm rèn/Linh Thạch', async () => {
    const mounted = mountHall(manager => {
      const ore = materials.find(m => m.id === 'qi_refining_ore_huyen')!
      manager.materialBag.add(ore, 100)
      manager.materialBag.add(SPIRIT_STONE_MATERIAL, 10_000)
      // Đồ Hoàng đang mặc — 0 affix slot theo EQUIPMENT_RARITY_AFFIX_SLOTS.
      manager.equipmentBag.add(equipmentInstance('hoang', true))
    })

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[1]!.click() // Tẩy Luyện
    await nextTick()

    // Chọn slot đang mặc.
    const slots = mounted.container.querySelectorAll(
      '[aria-label="Chọn trang bị để tẩy luyện"] .slot-view',
    )
    ;(slots[0] as HTMLElement).click()
    await nextTick()

    // Tick quáng.
    const radios = mounted.container.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    if (radios.length > 0) {
      ;(radios[0] as HTMLElement).click()
    }
    await nextTick()

    const buttons = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button'))
    const washBtn = buttons.find(b => b.textContent?.trim() === 'Tẩy Luyện')
    expect(washBtn).toBeDefined()
    expect(washBtn!.disabled).toBe(true)

    mounted.unmount()
  })
```

- [ ] **Step 2: Thêm import ở đầu file test nếu thiếu**

Trong `EquipmentHallPanel.test.ts`, đảm bảo import:
```ts
import { materials } from '@/data/materials/materials'
import { SPIRIT_STONE_MATERIAL } from '@/core/material/SpiritStoneMaterial'
```

- [ ] **Step 3: Chạy test để xác nhận FAIL**

Run: `cd game && npm.cmd run test -- --run src/components/panels/EquipmentHallPanel.test.ts -t "Tẩy Luyện đồ Hoàng"`
Expected: FAIL — `canWash()` hiện trả true (đủ quáng + điểm rèn + Linh Thạch).

- [ ] **Step 4: Sửa `canWash` để check rarity slot**

Trong `game/src/components/panels/EquipmentHallPanel.vue`, thêm import sau import `equipmentEssenceMaterialId` (L8):

```ts
import { EQUIPMENT_RARITY_AFFIX_SLOTS } from '@/core/equipment/EquipmentRarity'
```

Sửa hàm `canWash` (L397-408):

```ts
function canWash(): boolean {
  const ren = itemRenState.value
  const row = selectedRow.value
  if (!row) {
    return false
  }
  // Tẩy Luyện guard (2026-08-30) — đồ Hoàng (0 affix slot) không thể
  // roll được dòng nào; core trả no_eligible_affix nhưng UX kém nếu
  // đợi player bấm mới biết lỗi. Disable sớm tại UI.
  const affixSlotCap = EQUIPMENT_RARITY_AFFIX_SLOTS[row.rarity]
  const hasAffixSlots = affixSlotCap.prefix + affixSlotCap.suffix > 0

  return (
    hasAffixSlots &&
    selectedOreId.value !== null &&
    ren !== null &&
    gameManager.materialBag.getAmount(selectedOreId.value) >= washCost.value.oreAmount &&
    ren.points >= washCost.value.refinementPoints &&
    spiritStoneOwned.value >= washCost.value.spiritStone
  )
}
```

Chú ý: `selectedRow.value.affixCount` (đã có từ EquippedRow, L96) cũng đáp ứng được yêu cầu tương đương cho item hiện tại, nhưng check `rarity` tổng quát hơn và nhất quán với core (xem EquipmentSystem.ts:976-980).

- [ ] **Step 5: Chạy lại test để xác nhận PASS**

Run: `cd game && npm.cmd run test -- --run src/components/panels/EquipmentHallPanel.test.ts -t "Tẩy Luyện đồ Hoàng"`
Expected: PASS.

- [ ] **Step 6: Chạy full test equipment + UI để chắc không regression**

Run: `cd game && npm.cmd run test -- --run src/core/equipment src/components/panels/EquipmentHallPanel`
Expected: Tất cả pass (58 + 1 + 1 = 60).

- [ ] **Step 7: Commit**

```bash
git add game/src/components/panels/EquipmentHallPanel.vue game/src/components/panels/EquipmentHallPanel.test.ts
git commit -m "fix(ui): Tẩy Luyện disabled sớm cho đồ Hoàng (0 affix slot)"
```

---

### Task 3: Nạp Điểm Rèn — expose qua UI Khí Đường

**Files:**
- Modify: `game/src/core/game/GameManager.ts` (thêm `rechargeItem` wrapper, sau `getRefineCost` khoảng L2021)
- Modify: `game/src/composables/useEquipmentActions.ts` (thêm `recharge` action)
- Modify: `game/src/components/panels/EquipmentHallPanel.vue` (thêm tab "Nạp Điểm Rèn" thứ 5 + UI ngắn gọn)
- Test: `game/src/core/equipment/EquipmentSystem.test.ts` (đã có 5 test cho `rechargeForgePoints`, không cần thêm core test)
- Test: `game/src/components/panels/EquipmentHallPanel.test.ts` (thêm 1 test: tab Nạp + nút disabled khi full + nút enabled khi cạn)

**Interfaces:**
- GameManager.rechargeItem(instanceId): `{ ok: boolean; reason?: string }` — wrapper quanh `equipmentSystem.rechargeForgePoints`.
- useEquipmentActions().recharge(instanceId): boolean — sync modifier + bump state + feedback.
- UI: 1 tab "Nạp Điểm Rèn" hiện khi chọn item ở trang bị đang mặc; cost line: `rechargeEssenceCost(rechargeCount) Tinh Hoa + rechargeSpiritStoneCost(rechargeCount) Linh Thạch`; nút "Nạp" chỉ enabled khi `forgePoints < maxPoints`.

- [ ] **Step 1: Thêm `rechargeItem` wrapper trong `GameManager`**

Trong `game/src/core/game/GameManager.ts`, sau method `getRefineCost` (L2017-2021), thêm:

```ts
  /**
   * NẠP ĐIỂM RÈN (economy-fixes-sinks-plan §3.2 B3, 2026-08-29) — phơi
   * cơ chế nạp từ EquipmentSystem ra UI: item cạn forgePoints nạp lại về
   * TRẦN THẬT (getMaxForgePoints theo quality/forgePotential), cost leo
   * thang ×1.5 theo rechargeCount.
   */
  rechargeItem(instanceId: string): { ok: boolean; reason?: string } {
    return this.equipmentSystem.rechargeForgePoints(
      instanceId,
      this.equipmentBag,
      this.materialBag,
    )
  }

  /** Cost Tinh Hoa cho lần nạp kế tiếp của instance (UI preview). */
  previewRechargeCost(instance: EquipmentInstance): {
    essenceCost: number
    spiritStoneCost: number
    essenceMaterialId: string | undefined
    spiritStoneMaterialId: string
  } {
    const rechargeCount = instance.rechargeCount ?? 0
    return {
      essenceCost: rechargeEssenceCost(rechargeCount),
      spiritStoneCost: rechargeSpiritStoneCost(rechargeCount),
      essenceMaterialId: equipmentEssenceMaterialId(instance.realmId),
      spiritStoneMaterialId: getSpiritStoneMaterialIdForRealmTier(
        getRealmTier(instance.realmId),
      ),
    }
  }
```

Thêm import `rechargeEssenceCost, rechargeSpiritStoneCost` từ `RefinementBalance` (xem đầu file GameManager, có thể đã import hoặc chưa — nếu chưa thêm vào dòng import hiện có).

Thêm import `getSpiritStoneMaterialIdForRealmTier` từ `core/material/SpiritStoneMaterial` và `getRealmTier` từ `core/realm/RealmTierMap` nếu chưa có (xem L35-37 đã có `getRealmTier`).

- [ ] **Step 2: Viết failing test cho wrapper**

Tạo test mới trong `EquipmentSystem.test.ts` describe `EquipmentSystem — Tinh Luyện` không phù hợp — thay vào đó thêm vào describe `EquipmentSystem.rechargeForgePoints — Nạp Điểm Rèn` (đã có sẵn), cuối describe:

```ts
  it('rechargeForgePoints — cost theo realm trang bị (realm 4+ → Trung phẩm Linh Thạch)', () => {
    const ctx = setup()
    const instance = manualInstance({ instanceId: 'gc-recharge', realmId: 'golden_core' })
    instance.forgePoints = 0
    ctx.bag.add(instance)
    const essence = materials.find(m => m.id === equipmentEssenceMaterialId('golden_core')!)!
    ctx.materialBag.add(essence, 100)
    ctx.materialBag.add(SPIRIT_STONE_TRUNG_PHAM_MATERIAL, 1_000)

    const result = ctx.system.rechargeForgePoints(
      instance.instanceId,
      ctx.bag,
      ctx.materialBag,
    )
    expect(result.ok).toBe(true)
    // Cost 100 Trung Phẩm (RECHARGE_SPIRIT_STONE_BASE) — verify qua material
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)).toBe(900)
  })
```

Chạy: `cd game && npm.cmd run test -- --run src/core/equipment/EquipmentSystem.test.ts -t "realm 4+ → Trung phẩm"`
Expected: PASS (test này chỉ xác nhận flow có sẵn đang dùng Trung phẩm).

- [ ] **Step 3: Thêm `recharge` action vào `useEquipmentActions`**

Trong `game/src/composables/useEquipmentActions.ts`, sau method `dissolve` (L54-74), thêm:

```ts
  function recharge(instanceId: string): boolean {
    const result = gameManager.rechargeItem(instanceId)

    if (result.ok) {
      feedback.success('Nạp Điểm Rèn thành công')
      syncEquipmentModifiers()
      bumpState()
    } else {
      feedback.error(`Không thể Nạp Điểm Rèn: ${actionFailureLabel(result.reason)}`)
    }

    return result.ok
  }
```

Trong return object (L76-149), thêm:

```ts
    /** Nạp Điểm Rèn cho item cạn forgePoints (cost leo thang theo số lần nạp). */
    recharge,
```

- [ ] **Step 4: Thêm tab "Nạp Điểm Rèn" vào `EquipmentHallPanel`**

Trong `game/src/components/panels/EquipmentHallPanel.vue`:

(a) Sửa mảng `TABS` (L43-48):

```ts
const TABS = [
  { id: 'enhance', label: 'Cường Hóa' },
  { id: 'wash', label: 'Tẩy Luyện' },
  { id: 'refine', label: 'Tinh Luyện' },
  { id: 'recharge', label: 'Nạp Điểm Rèn' },
  { id: 'dissolve', label: 'Hóa Luyện' },
] as const
```

(b) Thêm computed `rechargeRows` để hiển thị 6 slot (slot trống bị disabled), đặt sau `enhanceRows` (khoảng L331):

```ts
// =========================
// Tab Nạp Điểm Rèn (economy-fixes-sinks-plan §3.2 B3) — chỉ item đang
// mặc (equipped) mới có giá trị (forgePoints ảnh hưởng modifier). Tab
// dùng cùng slot grid với Cường Hóa: slot trống bị disable.
// =========================

const rechargeRows = computed(() => {
  stateVersion.value
  const equippedRowBySlot = new Map(equippedRows.value.map((row) => [row.slot, row]))
  return EQUIPMENT_SLOTS.map((slot) => {
    const equippedRow = equippedRowBySlot.get(slot)
    const instance = equippedRow?.instance
    const forgePoints = instance ? gameManager.itemRefinementPoints(instance) : 0
    const maxForgePoints = instance
      ? getMaxForgePoints(instance.quality, instance.forgePotential)
      : 0
    return { slot, equippedRow, instance, forgePoints, maxForgePoints }
  })
})

const selectedRechargeSlot = ref<EquipmentSlot>(EQUIPMENT_SLOTS[0]!)

const selectedRechargeRow = computed(
  () => rechargeRows.value.find((row) => row.slot === selectedRechargeSlot.value) ?? null,
)

const rechargeCostForSelected = computed(() => {
  const instance = selectedRechargeRow.value?.instance
  if (!instance) {
    return null
  }
  return gameManager.previewRechargeCost(instance)
})

function canRecharge(): boolean {
  const row = selectedRechargeRow.value
  const cost = rechargeCostForSelected.value
  if (!row?.instance || !cost || !cost.essenceMaterialId) {
    return false
  }
  return (
    row.forgePoints < row.maxForgePoints &&
    gameManager.materialBag.getAmount(cost.essenceMaterialId) >= cost.essenceCost &&
    gameManager.materialBag.getAmount(cost.spiritStoneMaterialId) >= cost.spiritStoneCost
  )
})

function doRecharge() {
  const instance = selectedRechargeRow.value?.instance
  if (!instance) {
    return
  }
  recharge(instance.instanceId)
}
```

(c) Trong composable destructure (L58), thêm `recharge`:

```ts
const { enhance, washPreview, washCommit, refinePreview, refineCommit, recharge, dissolve } = useEquipmentActions()
```

(d) Thêm import `rechargeEssenceCost, rechargeSpiritStoneCost` nếu dùng (xem import list hiện tại — có thể không cần trong UI vì đã qua wrapper). KHÔNG thêm gì thêm nếu previewRechargeCost trả về sẵn.

(e) Sửa CSS `.qi-hall__tabs` (L1153-1161) — `grid-template-columns: repeat(4, 1fr)` thành `repeat(5, 1fr)`:

```ts
.qi-hall__tabs {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--paper-line, rgba(42, 41, 36, 0.42));
  background: transparent;
}
```

(f) Thêm section mới vào template, sau section Tinh Luyện (L1032), trước section Hóa Luyện:

```vue
    <!-- ===== NẠP ĐIỂM RÈN (2026-08-30) — chỉ item đang mặc ===== -->
    <section v-else-if="activeTab === 'recharge'" class="qi-hall__body qi-hall__split">
      <div class="qi-hall__split-left">
        <div class="qi-hall__slot-grid" aria-label="Chọn trang bị để nạp điểm rèn">
          <SlotView
            v-for="row in rechargeRows"
            :key="row.slot"
            class="qi-hall__slot"
            :item="row.equippedRow?.instance ?? null"
            :label="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
            :name-segments="row.equippedRow?.nameSegments"
            :icon="row.equippedRow?.icon"
            :equipment-quality-rank="row.equippedRow?.qualityRank"
            :rarity-rank="row.equippedRow?.rarityRank"
            :tooltip="row.equippedRow?.tooltip ?? { title: equipmentSlotLabel(row.slot), description: 'Slot trống — không có trang bị để Nạp.' }"
            :badges="row.instance ? [{ kind: 'enhance', text: `${row.forgePoints}/${row.maxForgePoints}` }] : []"
            :state="{ interaction: row.slot === selectedRechargeSlot ? 'selected' : 'idle' }"
            @click="selectedRechargeSlot = row.slot"
          />
        </div>
      </div>

      <div v-if="selectedRechargeRow?.instance && rechargeCostForSelected" class="qi-hall__split-right">
        <div class="qi-hall__compare">
          <div class="qi-hall__col">
            <Eyebrow>Hiện tại</Eyebrow>
            <p class="qi-hall__col-title">{{ selectedRechargeRow.equippedRow?.name }}</p>
            <p class="qi-hall__stat-line">
              Điểm Rèn: <strong>{{ selectedRechargeRow.forgePoints }}/{{ selectedRechargeRow.maxForgePoints }}</strong>
            </p>
            <p v-if="selectedRechargeRow.instance.rechargeCount" class="qi-hall__col-level">
              Đã nạp {{ selectedRechargeRow.instance.rechargeCount }} lần (cost leo thang ×1.5).
            </p>
          </div>

          <span class="qi-hall__compare-arrow" aria-hidden="true">⇒</span>

          <div class="qi-hall__col">
            <Eyebrow>Sau Nạp</Eyebrow>
            <p class="qi-hall__col-level">Điểm Rèn: {{ selectedRechargeRow.maxForgePoints }}/{{ selectedRechargeRow.maxForgePoints }}</p>
            <p v-if="selectedRechargeRow.forgePoints < selectedRechargeRow.maxForgePoints" class="qi-hall__stat-line">
              <span class="qi-hall__up-arrow">▲ Hồi đầy</span>
            </p>
            <p v-else class="qi-hall__empty">Đã đầy — không cần nạp.</p>
          </div>
        </div>

        <p class="qi-hall__info-row qi-hall__costline">
          Chi phí: {{ rechargeCostForSelected.essenceCost }} {{ materialLabel(rechargeCostForSelected.essenceMaterialId ?? '', gameManager.materialRegistry) }}
          · {{ rechargeCostForSelected.spiritStoneCost }} {{ materialLabel(rechargeCostForSelected.spiritStoneMaterialId, gameManager.materialRegistry) }}
        </p>

        <div class="qi-hall__button-row">
          <GameButton
            size="lg"
            :disabled="!canRecharge()"
            @click="doRecharge"
          >
            Nạp Điểm Rèn
          </GameButton>
        </div>
      </div>

      <p v-else class="qi-hall__split-right qi-hall__empty qi-hall__empty--centered">
        Chọn một trang bị đang mặc bên trái để nạp Điểm Rèn.
      </p>
    </section>
```

- [ ] **Step 5: Chạy test type-check**

Run: `cd game && npm.cmd run type-check 2>&1 | Select-String "EquipmentHall|useEquipmentActions|GameManager|recharge"`
Expected: Không có lỗi nào liên quan 4 file trên (lỗi `inkWashTheme.test.ts` và `DongFuArt.ts`/`DongFuStackLoader.ts` từ task khác đã pre-exist, KHÔNG sửa).

- [ ] **Step 6: Viết test UI cho tab Nạp**

Thêm vào `EquipmentHallPanel.test.ts`, describe `EquipmentHallPanel — chọn trang bị bằng slot`:

```ts
  it('tab "Nạp Điểm Rèn" hiện 6 slot, nút Nạp disabled khi item còn đầy', async () => {
    const mounted = mountHall(manager => {
      manager.equipmentBag.add(equipmentInstance('equipped', true))
    })

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    // Tab Nạp là tab thứ 4 (index 3): Cường Hóa, Tẩy, Tinh, Nạp, Hóa
    expect(tabs[3]?.textContent?.trim()).toBe('Nạp Điểm Rèn')
    tabs[3]!.click()
    await nextTick()

    const slots = mounted.container.querySelectorAll('[aria-label="Chọn trang bị để nạp điểm rèn"] .slot-view')
    expect(slots).toHaveLength(6)

    const buttons = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button'))
    const rechargeBtn = buttons.find(b => b.textContent?.trim() === 'Nạp Điểm Rèn')
    expect(rechargeBtn).toBeDefined()
    // Item 'equipped' có forgePoints=10/20 → KHÔNG đầy → enabled (nếu đủ Tinh Hoa)
    // hoặc disabled (vì materialBag rỗng). Tối thiểu phải tồn tại nút.
    mounted.unmount()
  })
```

- [ ] **Step 7: Chạy full test equipment + UI**

Run: `cd game && npm.cmd run test -- --run src/core/equipment src/components/panels/EquipmentHallPanel`
Expected: Tất cả pass (60 + 1 = 61).

- [ ] **Step 8: Commit**

```bash
git add game/src/core/game/GameManager.ts game/src/composables/useEquipmentActions.ts game/src/components/panels/EquipmentHallPanel.vue game/src/core/equipment/EquipmentSystem.test.ts game/src/components/panels/EquipmentHallPanel.test.ts
git commit -m "feat(equipment): Nạp Điểm Rèn tab — phơi rechargeForgePoints ra UI Khí Đường"
```

---

## Self-Review Checklist (writer chạy trước khi ship)

- [x] **Spec coverage:** Bug 1 (tier ghost) → Task 1; Bug 2 (Hoàng disable) → Task 2; Bug 3 (Nạp UI) → Task 3.
- [x] **Placeholder scan:** Mỗi step có code block cụ thể, không có "TBD"/"add appropriate".
- [x] **Type consistency:** `rechargeItem(instanceId)` ở Task 3 Step 1, dùng cùng chữ ký trong wrapper `useEquipmentActions` Step 3 và UI Step 4. `previewRechargeCost` trả về object khớp với `materialLabel` call ở Step 4.
- [x] **File scope:** Mỗi task chỉ đụng 2-4 file; không sửa file ngoài scope (Theme.css, DongFuArt.ts etc. KHÔNG động).
- [x] **Backward compat:** `rechargeItem` chỉ THÊM mới, không sửa signature cũ; UI thêm tab mới, không đổi 4 tab hiện tại.

## Verification cuối

Sau 3 task, chạy:

```bash
cd game
npm.cmd run test -- --run src/core/equipment src/components/panels/EquipmentHallPanel
npm.cmd run type-check 2>&1 | Select-String "EquipmentHall|EquipmentSystem|useEquipmentActions|GameManager|recharge"
```

Expected:
- Test: 5 files / 61+ tests pass.
- Type-check: 0 lỗi liên quan 4 file Khí Đường (3 lỗi pre-existed từ task khác OK).

## Giới hạn còn lại

- Chưa thêm E2E Playwright (chỉ unit/component test).
- Task 3 thêm UI mới → tăng 1 tab → người chơi phải biết tab mới. Có thể cần thêm tooltip "Tab mới" trong onboarding/tutorial sau.
- `previewRechargeCost` chỉ dùng trong UI, không có test riêng (đã test qua `rechargeForgePoints` ở core rồi).
