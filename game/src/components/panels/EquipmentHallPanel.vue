<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { usePanelPagination } from '@/composables/usePanelPagination'
import {
  equipmentEssenceMaterialId,
} from '@/core/equipment/RefinementBalance'
import { EQUIPMENT_RARITY_AFFIX_SLOTS } from '@/core/equipment/EquipmentRarity'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
import type { RolledAffix } from '@/core/equipment/RolledAffix'
import { materialLabel, affixLabel, equipmentSlotLabel, equipmentQualityLabel } from '@/core/presentation/labels'
import { statLabel, formatStat } from '@/core/stats/StatLabels'
import type { Stats } from '@/core/stats/StatBlock'
import { useActionFeedbackStore } from '@/stores/actionFeedback'
import { getSpiritStoneMaterialIdForEnhanceLevel } from '@/core/material/SpiritStoneMaterial'
import SlotView from '@/components/common/SlotView.vue'
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { equipmentQualityRank, itemGradeRank } from '@/composables/slots/normalizeSlotRank'
import GameButton from '@/components/common/GameButton.vue'
import TabBar from '@/components/common/TabBar.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import {
  getMaxForgePoints,
  calculateEquipmentScale,
  getEffectiveAffixValue,
  type RefineValueEntry,
} from '@/core/equipment/EquipmentSystem'

// Khí Đường (2026-08-25, resource-professions-rework plan §7/§9.2) —
// bốn tab ĐÚNG contract: Cường Hóa (slot), Tẩy Luyện (identity substat
// theo phẩm Quáng), Tinh Luyện (±20% giá trị + khóa dòng N+L), Hóa
// Luyện (destructive → Tinh Hoa, batch all-or-nothing). Rework
// 2026-08-30: bỏ Nạp Điểm Rèn; cost Điểm Rèn Tẩy/Tinh theo quality.
//
// Redesign 2-cột "hiện tại / sau khi dùng chức năng" + preview-giữ-bỏ
// cho Tẩy/Tinh Luyện (2026-08-30, bug report — bố cục cũ trống trải,
// roll áp thẳng không cho xem trước rồi mới quyết định). Cường Hóa là
// phép tính XÁC ĐỊNH (không random) nên cột "sau" chỉ hiển thị kết quả
// tính trước, không cần cơ chế giữ/bỏ.
const TABS = [
  { id: 'enhance', label: 'Cường Hóa' },
  { id: 'wash', label: 'Tẩy Luyện' },
  { id: 'refine', label: 'Tinh Luyện' },
  { id: 'dissolve', label: 'Hóa Luyện' },
] as const

type TabId = (typeof TABS)[number]['id']

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

const { enhance, washPreview, washCommit, refinePreview, refineCommit, dissolve } = useEquipmentActions()

const feedback = useActionFeedbackStore()

const activeTab = ref<TabId>('enhance')

// Preview đang chờ "giữ/bỏ" của Tẩy/Tinh Luyện — reset khi đổi tab,
// đổi trang bị chọn, đổi Quáng, hoặc đổi dòng khóa (kết quả cũ không
// còn khớp điều kiện mới).
const pendingWashAffixes = ref<RolledAffix[] | null>(null)

const pendingRefineValues = ref<RefineValueEntry[] | null>(null)

function switchTab(tab: TabId) {
  activeTab.value = tab

  pendingWashAffixes.value = null

  pendingRefineValues.value = null
}

// =========================
// Dữ liệu chung — slot đang mặc + bag
// =========================

interface EquippedRow {
  instance: EquipmentInstance

  instanceId: string

  slot: EquipmentSlot

  name: string

  realmId: string

  quality: EquipmentInstance['quality']

  rarity: EquipmentInstance['rarity']

  affixCount: number

  icon?: string

  nameSegments: ReturnType<typeof composeEquipmentNameSegments>

  // Audit fix 2026-08-31 — registry miss (itemId lạ) → không có tooltip
  // (buildEquipmentTooltip đòi template thật); template consumers đã
  // fallback `?.tooltip ?? { title/description slot trống }`.
  tooltip?: ReturnType<typeof buildEquipmentTooltip>

  qualityRank: number

  rarityRank: number
}

const equippedRows = computed<EquippedRow[]>(() => {
  stateVersion.value

  return gameManager.equipmentBag.getEquipped().map((instance) => {
    // Audit fix 2026-08-31 — equipmentRegistry.get() THROW với itemId
    // lạ (data edit/save lệch) từng chết cả panel qua ErrorBoundary;
    // getEquipmentTemplate() tra an toàn trả undefined (GameManager.ts).
    const template = gameManager.getEquipmentTemplate(instance.itemId)

    return {
      instance,

      instanceId: instance.instanceId,

      slot: instance.slot,

      name: template?.name ?? instance.itemId,

      realmId: instance.realmId,

      quality: instance.quality,

      rarity: instance.rarity,

      affixCount: instance.affixes.length,

      icon: instance.icon ?? template?.icon,

      // Registry miss → hiển thị itemId thô (pattern
      // EquipmentBagSection.vue:82-84); composeEquipmentNameSegments
      // KHÔNG nhận template nullable nên gọi có điều kiện.
      nameSegments: template
        ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
        : [{ text: instance.itemId }],

      // buildEquipmentTooltip đòi template thật — registry miss thì
      // KHÔNG có tooltip (SlotView tooltip optional), không chết panel.
      tooltip: template
        ? buildEquipmentTooltip(
            instance,
            template,
            gameManager.affixRegistry,
            gameManager.getSlotState(instance.slot),
            gameManager.zoneRegistry,
          )
        : undefined,

      qualityRank: equipmentQualityRank(instance.quality),

      rarityRank: itemGradeRank(instance.rarity),
    }
  })
})

const selectedInstanceId = ref<string | null>(null)

const selectedRow = computed(
  () => equippedRows.value.find((row) => row.instanceId === selectedInstanceId.value) ?? null,
)

// =========================
// Điểm Rèn PER-ITEM (rework 2026-08-26) = "Tình trạng rèn" trong
// tooltip — forgePoints / getMaxForgePoints(quality, forgePotential).
// Tẩy/Tinh Luyện tiêu thụ ngân sách này của CHÍNH món đồ.
// =========================

const itemRenState = computed<{ points: number; max: number } | null>(() => {
  stateVersion.value

  if (!selectedInstanceId.value) {
    return null
  }

  const instance = gameManager.equipmentBag.get(selectedInstanceId.value)

  if (!instance) {
    return null
  }

  return {
    points: gameManager.itemRefinementPoints(instance),

    max: getMaxForgePoints(instance.quality, instance.forgePotential),
  }
})

function selectEquipped(instanceId: string) {
  selectedInstanceId.value = instanceId

  lockedIndices.value = []

  selectedOreId.value = null

  pendingWashAffixes.value = null

  pendingRefineValues.value = null
}

function clearSelection() {
  selectedInstanceId.value = null

  lockedIndices.value = []

  selectedOreId.value = null

  pendingWashAffixes.value = null

  pendingRefineValues.value = null
}

/**
 * 6 Ô TRANG BỊ LUÔN TỒN TẠI (2026-08-30 spec) — tham chiếu trực tiếp
 * equipped-or-trống theo SLOT, dùng CHUNG cho cả 3 tab Tẩy/Tinh Luyện
 * (Cường Hóa đã có enhanceRows cùng shape/mục đích, giữ nguyên). Bấm ô
 * trống → clearSelection() (không có instance để Tẩy/Tinh Luyện).
 */
interface HallSlotRow {
  slot: EquipmentSlot

  equippedRow?: EquippedRow
}

const hallSlotRows = computed<HallSlotRow[]>(() => {
  const equippedRowBySlot = new Map(equippedRows.value.map((row) => [row.slot, row]))

  return EQUIPMENT_SLOTS.map((slot) => ({ slot, equippedRow: equippedRowBySlot.get(slot) }))
})

function selectHallSlotForAction(row: HallSlotRow) {
  if (row.equippedRow) {
    selectEquipped(row.equippedRow.instanceId)
  } else {
    clearSelection()
  }
}

/** Chọn ore cùng realm cho Tẩy Luyện — chỉ hiện stack người chơi có. */
const oreChoices = computed(() => {
  stateVersion.value

  if (!selectedRow.value) {
    return []
  }

  const prefix = `${selectedRow.value.realmId}_ore_`

  return gameManager.materialBag
    .getAll()
    .filter((stack) => stack.material.id.startsWith(prefix))
    .map((stack) => ({
      materialId: stack.material.id,

      name: stack.material.name,

      owned: stack.amount,
    }))
})

const selectedOreId = ref<string | null>(null)

watch(selectedOreId, () => {
  pendingWashAffixes.value = null
})

// =========================
// Tab Cường Hóa
// =========================

interface EnhanceSlotRow {
  slot: EquipmentSlot

  itemName: string

  enhanceLevel: number

  maxLevel: number

  costs: Array<{ materialId: string; label: string; amount: number; owned: number }>

  spiritStone: number
  spiritStoneMaterialId: string
  spiritStoneOwned: number

  equippedRow?: EquippedRow
}

const enhanceRows = computed<EnhanceSlotRow[]>(() => {
  stateVersion.value

  // Slot-level rework (yêu cầu 2026-08-26): Cường Hóa gắn SLOT —
  // slot TRỐNG vẫn hiện trần/cost và nâng được; realmId lấy theo người
  // chơi hiện hành để resolve catalog nghề.
  const realmId = player.$state.realmId

  const equippedRowBySlot = new Map(equippedRows.value.map((row) => [row.slot, row]))

  return gameManager.getAllSlotStates().map((slotState) => {
    const equipped = gameManager.equipmentBag.getEquippedInSlot(slotState.slot)

    const costs = gameManager.getEnhanceCost(slotState.slot, realmId).map((entry) => ({
      materialId: entry.materialId,

      label: materialLabel(entry.materialId, gameManager.materialRegistry),

      amount: entry.amount,

      owned: gameManager.materialBag.getAmount(entry.materialId),
    }))

    const spiritStone = gameManager.getEnhanceSpiritStoneCost(slotState.slot, realmId)
    const spiritStoneMaterialId = getSpiritStoneMaterialIdForEnhanceLevel(slotState.enhanceLevel)

    const maxLevel = gameManager.getSlotMaxEnhanceLevel(slotState.slot, realmId)

    return {
      slot: slotState.slot,

      itemName: equipped
        ? gameManager.getEquipmentTemplate(equipped.itemId)?.name ?? equipped.itemId
        : '— trống (vẫn cường hóa được) —',

      enhanceLevel: slotState.enhanceLevel,

      maxLevel,

      costs,

      spiritStone,
      spiritStoneMaterialId,
      spiritStoneOwned: gameManager.materialBag.getAmount(spiritStoneMaterialId),

      equippedRow: equippedRowBySlot.get(slotState.slot),
    }
  })
})

const selectedEnhanceSlot = ref<EquipmentSlot>(EQUIPMENT_SLOTS[0]!)

const selectedEnhanceRow = computed(() =>
  enhanceRows.value.find((row) => row.slot === selectedEnhanceSlot.value) ?? null,
)

function selectEnhanceSlot(slot: EquipmentSlot) {
  selectedEnhanceSlot.value = slot
}

function canEnhance(row: EnhanceSlotRow): boolean {
  return (
    row.enhanceLevel < row.maxLevel &&
    row.costs.every((cost) => cost.owned >= cost.amount) &&
    row.spiritStoneOwned >= row.spiritStone
  )
}

function doEnhance(row: EnhanceSlotRow) {
  enhance(row.slot)
}

interface EnhancePreviewRow {
  key: string

  label: string

  // Stat key để formatStat chọn độ chính xác theo loại stat — số thập
  // phân nhỏ (attackSpeed 0.01–0.02) không bị toFixed(1) thành "0.0"
  // (bug report 2026-08-30).
  stat: keyof Stats | undefined

  currentValue: number

  nextValue: number

  percent: number
}

/**
 * Xem trước "sau Cường Hóa" — xác định (không random), luôn tính được ngay
 * khi có mainStat, không cần preview/giữ/bỏ như Tẩy/Tinh Luyện. Danh sách
 * dòng khớp CHÍNH XÁC những gì EquipmentSystem.applyModifiers() thật sự
 * scale theo enhanceLevel (2026-08-30 bug report: cột "Sau Cường Hóa" cũ
 * chỉ tính mainStat, bỏ sót toàn bộ affix phụ nên 2 cột không khớp dòng) —
 * dòng đầu LUÔN là mainStat, sau đó từng affix theo ĐÚNG thứ tự
 * instance.affixes để 2 cột "Hiện tại"/"Sau" render cùng danh sách, khớp
 * 1-1 theo index thay vì 2 mảng khác nguồn.
 */
const enhancePreviewRows = computed<EnhancePreviewRow[] | null>(() => {
  stateVersion.value

  const row = selectedEnhanceRow.value

  const instance = row?.equippedRow?.instance

  if (!row || !instance) {
    return null
  }

  const currentScale = calculateEquipmentScale(row.enhanceLevel, instance.forgePoints)

  const nextScale = calculateEquipmentScale(row.enhanceLevel + 1, instance.forgePoints)

  function toRow(key: string, label: string, stat: keyof Stats | undefined, baseFlat: number): EnhancePreviewRow {
    const currentValue = baseFlat * currentScale

    const nextValue = baseFlat * nextScale

    return {
      key,

      label,

      stat,

      currentValue,

      nextValue,

      percent: currentValue > 0 ? ((nextValue - currentValue) / currentValue) * 100 : 0,
    }
  }

  const rows: EnhancePreviewRow[] = [
    toRow('main', statLabel(instance.mainStat.stat), instance.mainStat.stat, instance.mainStat.flat ?? 0),
  ]

  instance.affixes.forEach((rolled, index) => {
    const affix = gameManager.affixRegistry.has(rolled.affixId)
      ? gameManager.affixRegistry.get(rolled.affixId)
      : undefined

    if (!affix) {
      return
    }

    rows.push(toRow(`affix-${index}`, statLabel(affix.stat), affix.stat, getEffectiveAffixValue(rolled, affix)))
  })

  return rows
})

// =========================
// Tab Tẩy Luyện — preview/giữ/bỏ (2026-08-30)
// =========================

const washCost = computed(() => {
  stateVersion.value

  return gameManager.getWashCost(selectedRow.value?.realmId, selectedRow.value?.quality)
})

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

function doWashPreview() {
  if (!selectedRow.value) {
    feedback.warning('Không thể Tẩy Luyện: cần chọn một trang bị.')

    return
  }

  if (!selectedOreId.value) {
    feedback.warning('Không thể Tẩy Luyện: cần chọn Quáng cùng cảnh giới.')

    return
  }

  const affixes = washPreview(selectedRow.value.instanceId, selectedOreId.value)

  if (affixes) {
    pendingWashAffixes.value = affixes
  }
}

function doWashKeep() {
  if (!selectedRow.value || !pendingWashAffixes.value) {
    return
  }

  if (washCommit(selectedRow.value.instanceId, pendingWashAffixes.value)) {
    pendingWashAffixes.value = null
  }
}

/**
 * Tier hiển thị bằng MÀU chứ không phải text "(tier N)" (2026-08-30 bug
 * report: "thông tin chỉ số item cần theo quy tắc của tooltip, tier 1 đã
 * đổi thành màu sắc thay vì text") — tái dùng ĐÚNG token --affix-tier-N
 * mà Tooltip.vue's `.tooltip__section-row--tier-N` đã dùng, giữ nhất
 * quán 1 quy tắc màu tier DUY NHẤT trong toàn project.
 */
function tierClass(tier: number): string {
  return `qi-hall__tier-${tier}`
}

function affixDisplayLabel(rolled: RolledAffix): string {
  const affix = gameManager.affixRegistry.has(rolled.affixId)
    ? gameManager.affixRegistry.get(rolled.affixId)
    : undefined

  return affix
    ? `${affixLabel(rolled.affixId, gameManager.affixRegistry)} (${statLabel(affix.stat)})`
    : affixLabel(rolled.affixId, gameManager.affixRegistry)
}

const pendingWashAffixDisplay = computed(() =>
  (pendingWashAffixes.value ?? []).map((rolled, index) => ({
    index,

    label: affixDisplayLabel(rolled),

    tier: rolled.tier,
  })),
)

// =========================
// Tab Tinh Luyện — khóa dòng + preview/giữ/bỏ (§7.4, 2026-08-30)
// =========================

const selectedAffixes = computed(() => {
  stateVersion.value

  if (!selectedInstanceId.value) {
    return []
  }

  const instance = gameManager.equipmentBag.get(selectedInstanceId.value)

  if (!instance) {
    return []
  }

  return instance.affixes.map((rolled, index) => {
    const affix = gameManager.affixRegistry.has(rolled.affixId)
      ? gameManager.affixRegistry.get(rolled.affixId)
      : undefined

    return {
      index,

      label: affixDisplayLabel(rolled),

      tier: rolled.tier,

      // Stat key để formatStat chọn độ chính xác đúng loại stat (bug
      // 2026-08-30: toFixed(1) ép attackSpeed 0.015 thành "0.0").
      stat: affix?.stat,
    }
  })
})

/** Giá trị hiệu lực hiện tại của 1 dòng affix (cột "Hiện tại" Tinh Luyện). */
function currentAffixValue(index: number): number | null {
  if (!selectedInstanceId.value) {
    return null
  }

  const instance = gameManager.equipmentBag.get(selectedInstanceId.value)

  const rolled = instance?.affixes[index]

  if (!instance || !rolled) {
    return null
  }

  const affix = gameManager.affixRegistry.has(rolled.affixId)
    ? gameManager.affixRegistry.get(rolled.affixId)
    : undefined

  return affix ? getEffectiveAffixValue(rolled, affix) : rolled.value
}

/**
 * Format giá trị stat theo đúng độ chính xác loại stat (formatStat) —
 * stat lạ/registry thiếu fallback 2 chữ số thập phân, KHÔNG bao giờ
 * ép số thập phân nhỏ về "0.0" (bug report 2026-08-30).
 */
function formatAffixValue(stat: keyof Stats | undefined, value: number): string {
  if (stat === undefined) {
    return (Math.round(value * 100) / 100).toString()
  }

  return formatStat(stat, value)
}

const lockedIndices = ref<number[]>([])

function toggleLock(index: number) {
  const position = lockedIndices.value.indexOf(index)

  if (position >= 0) {
    lockedIndices.value.splice(position, 1)
  } else if (lockedIndices.value.length < 3) {
    // Không cho khóa toàn bộ: tối đa N-1 (và ≤3).
    if (lockedIndices.value.length + 1 < selectedAffixes.value.length) {
      lockedIndices.value.push(index)
    }
  }

  pendingRefineValues.value = null
}

const refineCost = computed(() => {
  stateVersion.value

  return gameManager.getRefineCost(
    selectedAffixes.value.length,
    lockedIndices.value.length,
    selectedRow.value?.realmId,
    selectedRow.value?.quality,
  )
})

// Plan Workstream F — số dư Linh Thạch đọc từ MaterialBag. T2 (review
// 2026-08-28): phẩm Linh Thạch cần cho Tẩy/Tinh Luyện resolve theo realm
// trang bị đang chọn — số dư hiển thị đúng phẩm đó.
const spiritStoneCostMaterialId = computed(() => {
  stateVersion.value

  return washCost.value.spiritStoneMaterialId
})

const spiritStoneCostName = computed(() => {
  const id = spiritStoneCostMaterialId.value

  return gameManager.materialRegistry.has(id) ? gameManager.materialRegistry.get(id).name : 'Linh Thạch'
})

const spiritStoneOwned = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(spiritStoneCostMaterialId.value)
})

const refineEssenceOwned = computed(() => {
  stateVersion.value

  if (!selectedRow.value) {
    return 0
  }

  const essenceId = equipmentEssenceMaterialId(selectedRow.value.realmId)

  return essenceId ? gameManager.materialBag.getAmount(essenceId) : 0
})

function canRefine(): boolean {
  const ren = itemRenState.value

  return (
    selectedAffixes.value.length > 0 &&
    lockedIndices.value.length < selectedAffixes.value.length &&
    refineEssenceOwned.value >= refineCost.value.essenceUnits &&
    spiritStoneOwned.value >= refineCost.value.spiritStone &&
    ren !== null &&
    ren.points >= refineCost.value.refinementPoints
  )
}

function doRefinePreview() {
  if (!selectedRow.value) {
    feedback.warning('Không thể Tinh Luyện: cần chọn một trang bị có ít nhất một dòng phụ.')

    return
  }

  const values = refinePreview(selectedRow.value.instanceId, [...lockedIndices.value])

  if (values) {
    pendingRefineValues.value = values
  }
}

function doRefineKeep() {
  if (!selectedRow.value || !pendingRefineValues.value) {
    return
  }

  if (refineCommit(selectedRow.value.instanceId, pendingRefineValues.value)) {
    pendingRefineValues.value = null
  }
}

const pendingRefineByIndex = computed(() => {
  const map = new Map<number, number>()

  for (const entry of pendingRefineValues.value ?? []) {
    map.set(entry.index, entry.value)
  }

  return map
})

// =========================
// Bảng so sánh Trước ⇒ Sau dùng chung Cường Hóa/Tẩy/Tinh Luyện (rework
// 2026-08-30 — bọc gọn vào 1 card, mỗi dòng phụ MỘT hàng thật trong
// <table>, khớp đúng pattern Cường Hóa đã duyệt thay vì 2 cột flex tách
// rời + bảng meta text rời rạc như trước).
// =========================

interface AffixCompareRow {
  index: number

  beforeLabel: string

  beforeTier: number

  afterLabel?: string

  afterTier?: number
}

/** Tẩy Luyện reroll TOÀN BỘ affix (đổi cả identity) — mỗi dòng so sánh
 * theo ĐÚNG vị trí index giữa affix hiện tại và affix preview đang chờ. */
const washAffixCompareRows = computed<AffixCompareRow[]>(() => {
  const pending = pendingWashAffixDisplay.value

  return selectedAffixes.value.map((affix, position) => ({
    index: affix.index,

    beforeLabel: affix.label,

    beforeTier: affix.tier,

    afterLabel: pending[position]?.label,

    afterTier: pending[position]?.tier,
  }))
})

const washRenAfter = computed(() =>
  itemRenState.value ? Math.max(0, itemRenState.value.points - washCost.value.refinementPoints) : 0,
)

const refineRenAfter = computed(() =>
  itemRenState.value ? Math.max(0, itemRenState.value.points - refineCost.value.refinementPoints) : 0,
)

// =========================
// Tab Hóa Luyện (§7.5) — filter + multi-select + preview + confirm
// =========================

interface DissolveCandidate {
  instanceId: string

  name: string

  slotLabel: string

  quality: string

  realmId: string

  icon?: string

  nameSegments: ReturnType<typeof composeEquipmentNameSegments>

  // Audit fix 2026-08-31 — registry miss → không tooltip (pattern
  // EquippedRow.tooltip phía trên).
  tooltip?: ReturnType<typeof buildEquipmentTooltip>

  qualityRank: number

  rarityRank: number
}

// Fit-refactor đợt 4 — sắp xếp khai báo theo thứ tự phụ thuộc (refs ->
// hàm -> computed -> pagination) để không rơi vào TDZ khi computed evaluate
// ngay lúc mount (test bắt được lỗi này).
const dissolveFilterRealm = ref<string>('any')

const dissolveFilterQuality = ref<string>('any')

function passesDissolveFilter(instance: EquipmentInstance): boolean {
  if (dissolveFilterRealm.value !== 'any' && instance.realmId !== dissolveFilterRealm.value) {
    return false
  }

  if (
    dissolveFilterQuality.value !== 'any' &&
    instance.rarity !== dissolveFilterQuality.value
  ) {
    return false
  }

  return true
}

// Tick nhẹ để preview cập nhật khi selection đổi (computed phụ thuộc
// stateVersion là chính).
const nowTick = ref(0)

const dissolveCandidates = computed<DissolveCandidate[]>(() => {
  stateVersion.value

  void nowTick.value

  return gameManager.equipmentBag
    .getAll()
    .filter((instance) => !instance.equipped && !instance.locked && !instance.favorite)
    .filter((instance) => passesDissolveFilter(instance))
    .map((instance) => {
      const template = gameManager.getEquipmentTemplate(instance.itemId)

      return {
        instanceId: instance.instanceId,

        name: template?.name ?? instance.itemId,

        slotLabel: equipmentSlotLabel(instance.slot),

        quality: equipmentQualityLabel(instance.quality),

        realmId: instance.realmId,

        icon: instance.icon ?? template?.icon,

        nameSegments: template
          ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
          : [{ text: instance.itemId }],

        // Audit fix 2026-08-31 — dùng lại template đã tra an toàn ở trên;
        // registry miss → không tooltip (SlotView tooltip optional),
        // không chết tab Hóa Luyện qua ErrorBoundary.
        tooltip: template
          ? buildEquipmentTooltip(
              instance,
              template,
              gameManager.affixRegistry,
              gameManager.getSlotState(instance.slot),
              gameManager.zoneRegistry,
            )
          : undefined,

        qualityRank: equipmentQualityRank(instance.quality),

        rarityRank: itemGradeRank(instance.rarity),
      }
    })
})

// Hóa Luyện phân trang theo ngân sách chiều cao thật của lưới (ước
// lượng 1 "hàng" ~80px — lưới nhiều cột nên số item hiển thị thực tế
// mỗi trang thường NHIỀU hơn số hàng tính được, an toàn vì chỉ làm hụt
// chỗ trống chứ không bao giờ tràn).
const {
  containerEl: dissolveListEl,
  currentPage: dissolvePage,
  totalPages: dissolveTotalPages,
  goToPage: dissolveGoTo,
  pageItemsRange: dissolvePageRange,
} = usePanelPagination(
  computed(() => dissolveCandidates.value.length),
  80,
)

const dissolveSelected = ref<Set<string>>(new Set())

function toggleDissolve(instanceId: string) {
  const next = new Set(dissolveSelected.value)

  if (next.has(instanceId)) {
    next.delete(instanceId)
  } else {
    next.add(instanceId)
  }

  dissolveSelected.value = next
}

/**
 * Chọn TẤT CẢ candidate đang qua filter hiện hành (yêu cầu "hóa luyện
 * toàn bộ/theo filter") — an toàn vì candidates đã loại equipped/locked/
 * favorite ở computed nguồn.
 */
function selectAllDissolveByFilter() {
  dissolveSelected.value = new Set(dissolveCandidates.value.map((candidate) => candidate.instanceId))
}

function clearDissolveSelection() {
  dissolveSelected.value = new Set()
}

const dissolvePreview = computed(() => {
  stateVersion.value

  return gameManager.previewDissolveRewards(Array.from(dissolveSelected.value))
})

const dissolveConfirming = ref(false)

function doDissolve() {
  if (dissolveSelected.value.size === 0) {
    return
  }

  if (!dissolveConfirming.value) {
    dissolveConfirming.value = true

    return
  }

  if (dissolve(Array.from(dissolveSelected.value))) {
    dissolveSelected.value = new Set()

    nowTick.value += 1
  }

  dissolveConfirming.value = false
}
</script>

<template>
  <div class="qi-hall">
    <InkNineSlice asset-id="surface-xl-paper-scroll" layer="surface" />
    <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" />

    <!-- Header "Điểm Rèn món đang chọn" cũ đã BỎ (2026-08-30, bug report:
         thông tin không cần thiết) — số Điểm Rèn chỉ liên quan Tẩy/Tinh
         Luyện, tự hiện đúng ngay trong card của 2 tab đó, không cần lặp
         lại ở đầu panel cho cả Cường Hóa/Hóa Luyện không dùng tới nó. -->

    <!-- Nav chức năng lên NGAY đầu card, không nền riêng (2026-08-30,
         bug report) — bỏ hẳn header "Chọn một trang bị..." cũ. -->
    <TabBar
      class="qi-hall__tabs"
      :tabs="TABS.map((tab) => ({ id: tab.id, label: tab.label }))"
      :model-value="activeTab"
      @update:model-value="switchTab($event as TabId)"
    />

    <!-- ===== CƯỜNG HÓA (slot-level, §7.1) ===== -->
    <section v-if="activeTab === 'enhance'" class="qi-hall__body qi-hall__split">
      <div class="qi-hall__split-left">
        <div class="qi-hall__slot-grid" aria-label="Chọn slot cường hóa">
          <SlotView
            v-for="row in enhanceRows"
            :key="row.slot"
            class="qi-hall__slot"
            :item="row.equippedRow?.instance ?? null"
            :label="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
            :name-segments="row.equippedRow?.nameSegments"
            :icon="row.equippedRow?.icon"
            :equipment-quality-rank="row.equippedRow?.qualityRank"
            :rarity-rank="row.equippedRow?.rarityRank"
            :tooltip="row.equippedRow?.tooltip ?? { title: equipmentSlotLabel(row.slot), description: 'Slot trống vẫn có thể Cường Hóa.' }"
            :badges="[{ kind: 'enhance', text: `+${row.enhanceLevel}` }]"
            :state="{ interaction: row.slot === selectedEnhanceSlot ? 'selected' : 'idle' }"
            @click="selectEnhanceSlot(row.slot)"
          />
        </div>
      </div>

      <div v-if="selectedEnhanceRow" class="qi-hall__split-right">
        <!-- Dùng THẲNG <table> giống Tẩy/Tinh Luyện thay vì 2 cột flex độc
             lập (2026-08-30 bug report: "không ngang hàng với nhau" — 2
             cột flex co giãn riêng nên dòng chính/dòng phụ lệch nhau khi
             số dòng hoặc độ dài nội dung khác nhau; <tr> đảm bảo khớp
             hàng-với-hàng thật sự). Bỏ hẳn dòng tiêu đề "Slot · Tên món"
             cũ (2026-08-30, bug report thứ 2: dòng đó tạo lệch — thông
             tin này đã có sẵn qua ô đang chọn ở lưới bên trái, không cần
             lặp lại). Header bảng dùng "Trước/Sau" y hệt Tẩy/Tinh Luyện
             thay vì hiện số cấp thô màu eyebrow khó đọc — cấp đổi dời
             xuống 1 dòng chú thích màu chữ thường, dễ đọc. -->
        <div class="qi-hall__preview-card">
          <p v-if="enhancePreviewRows && selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel" class="qi-hall__col-title">
            Cấp +{{ selectedEnhanceRow.enhanceLevel }}/{{ selectedEnhanceRow.maxLevel }}
            ⇒ +{{ selectedEnhanceRow.enhanceLevel + 1 }}/{{ selectedEnhanceRow.maxLevel }}
          </p>

          <table
            v-if="enhancePreviewRows && selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel"
            class="qi-hall__compare-table"
            aria-label="So sánh trước và sau Cường Hóa"
          >
            <thead>
              <tr>
                <th scope="col">Chỉ số</th>
                <th scope="col">Trước</th>
                <th scope="col" aria-hidden="true"></th>
                <th scope="col">Sau</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="statRow in enhancePreviewRows" :key="statRow.key">
                <th scope="row">{{ statRow.label }}</th>
                <td>{{ formatAffixValue(statRow.stat, statRow.currentValue) }}</td>
                <td class="qi-hall__compare-arrow" aria-hidden="true">⇒</td>
                <td>
                  {{ formatAffixValue(statRow.stat, statRow.nextValue) }}
                  <span class="qi-hall__up-arrow">▲ +{{ statRow.percent.toFixed(1) }}%</span>
                </td>
              </tr>
            </tbody>
          </table>

          <p v-else class="qi-hall__empty">
            {{ enhancePreviewRows ? 'Đã đạt cấp tối đa.' : 'Slot trống — không có chỉ số chính để xem trước.' }}
          </p>
        </div>

        <ul v-if="selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel" class="qi-hall__info-row enhance-row__costs">
          <li
            v-for="cost in selectedEnhanceRow.costs"
            :key="cost.materialId"
            :class="{ 'is-missing': cost.owned < cost.amount }"
          >
            {{ cost.label }}: {{ cost.owned }}/{{ cost.amount }}
          </li>
          <li :class="{ 'is-missing': selectedEnhanceRow.spiritStoneOwned < selectedEnhanceRow.spiritStone }">
            {{ materialLabel(selectedEnhanceRow.spiritStoneMaterialId, gameManager.materialRegistry) }}:
            {{ selectedEnhanceRow.spiritStoneOwned }}/{{ selectedEnhanceRow.spiritStone }}
          </li>
        </ul>

        <div class="qi-hall__button-row">
          <GameButton
            v-if="selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel"
            size="lg"
            :disabled="!canEnhance(selectedEnhanceRow)"
            @click="doEnhance(selectedEnhanceRow)"
          >
            Cường Hóa
          </GameButton>
        </div>
      </div>
    </section>

    <!-- ===== TẨY LUYỆN (§7.3) — preview/giữ/bỏ ===== -->
    <section v-else-if="activeTab === 'wash'" class="qi-hall__body qi-hall__split">
      <div class="qi-hall__split-left">
        <div class="qi-hall__slot-grid" aria-label="Chọn trang bị để tẩy luyện">
          <SlotView
            v-for="row in hallSlotRows"
            :key="row.slot"
            class="qi-hall__slot"
            :item="row.equippedRow?.instance ?? null"
            :label="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
            :name-segments="row.equippedRow?.nameSegments"
            :icon="row.equippedRow?.icon"
            :equipment-quality-rank="row.equippedRow?.qualityRank"
            :rarity-rank="row.equippedRow?.rarityRank"
            :tooltip="row.equippedRow?.tooltip ?? { title: equipmentSlotLabel(row.slot), description: 'Slot trống — không có gì để Tẩy Luyện.' }"
            :state="{ interaction: row.equippedRow?.instanceId === selectedInstanceId ? 'selected' : 'idle', marker: row.equippedRow ? 'equipped' : undefined }"
            @click="selectHallSlotForAction(row)"
          />
        </div>
      </div>

      <div v-if="selectedRow" class="qi-hall__split-right">
        <!-- Card duy nhất (2026-08-30 spec, khớp đúng Cường Hóa đã duyệt)
             — Điểm Rèn làm dòng chú thích, mỗi dòng phụ 1 hàng thật
             trong bảng, không còn 2 cột flex + bảng meta tách rời. -->
        <div class="qi-hall__preview-card">
          <p v-if="itemRenState" class="qi-hall__col-title">
            Điểm Rèn {{ itemRenState.points }}/{{ itemRenState.max }} ⇒ {{ washRenAfter }}/{{ itemRenState.max }}
          </p>

          <table v-if="washAffixCompareRows.length" class="qi-hall__compare-table" aria-label="So sánh trước và sau Tẩy Luyện">
            <thead>
              <tr>
                <th scope="col">Chỉ số</th>
                <th scope="col">Trước</th>
                <th scope="col" aria-hidden="true"></th>
                <th scope="col">Sau</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, position) in washAffixCompareRows" :key="row.index">
                <th scope="row">Dòng {{ position + 1 }}</th>
                <td><span :class="tierClass(row.beforeTier)">{{ row.beforeLabel }}</span></td>
                <td class="qi-hall__compare-arrow" aria-hidden="true">⇒</td>
                <td>
                  <span v-if="row.afterLabel" :class="tierClass(row.afterTier!)">{{ row.afterLabel }}</span>
                  <span v-else class="qi-hall__owned">chưa roll</span>
                </td>
              </tr>
            </tbody>
          </table>

          <p v-else class="qi-hall__empty">Chưa có dòng phụ.</p>
        </div>

        <div class="qi-hall__info-row">
          <div class="qi-hall__info-options">
            <span class="qi-hall__info-label">Chọn Quáng (×{{ washCost.oreAmount }})</span>

            <label v-for="ore in oreChoices" :key="ore.materialId" class="qi-hall__option">
              <input type="radio" :value="ore.materialId" v-model="selectedOreId" />

              <span>{{ ore.name }} ×{{ ore.owned }}</span>
            </label>
          </div>

          <!-- Điểm Rèn tốn mỗi lượt đã hiện ở dòng chú thích đầu card
               (2026-08-30, bug report: trùng lặp) — costline chỉ còn chi
               phí KHÁC (Linh Thạch) chưa hiện ở đâu. -->
          <p class="qi-hall__costline">
            Chi phí mỗi lượt: {{ washCost.spiritStone }} {{ spiritStoneCostName }}
          </p>
        </div>

        <div class="qi-hall__button-row">
          <GameButton size="lg" :disabled="!canWash()" @click="doWashPreview">
            Tẩy Luyện — roll lại toàn bộ dòng phụ
          </GameButton>

          <GameButton v-if="pendingWashAffixes" size="lg" variant="secondary" @click="doWashKeep">
            Giữ
          </GameButton>
        </div>
      </div>

      <p v-else class="qi-hall__split-right qi-hall__empty qi-hall__empty--centered">Chọn một trang bị bên trái để xem chi tiết.</p>
    </section>

    <!-- ===== TINH LUYỆN (§7.4) — preview/giữ/bỏ ===== -->
    <section v-else-if="activeTab === 'refine'" class="qi-hall__body qi-hall__split">
      <div class="qi-hall__split-left">
        <div class="qi-hall__slot-grid" aria-label="Chọn trang bị để tinh luyện">
          <SlotView
            v-for="row in hallSlotRows"
            :key="row.slot"
            class="qi-hall__slot"
            :item="row.equippedRow?.instance ?? null"
            :label="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
            :name-segments="row.equippedRow?.nameSegments"
            :icon="row.equippedRow?.icon"
            :equipment-quality-rank="row.equippedRow?.qualityRank"
            :rarity-rank="row.equippedRow?.rarityRank"
            :tooltip="row.equippedRow?.tooltip ?? { title: equipmentSlotLabel(row.slot), description: 'Slot trống — không có gì để Tinh Luyện.' }"
            :state="{ interaction: row.equippedRow?.instanceId === selectedInstanceId ? 'selected' : 'idle', marker: row.equippedRow ? 'equipped' : undefined }"
            @click="selectHallSlotForAction(row)"
          />
        </div>
      </div>

      <div v-if="selectedRow" class="qi-hall__split-right">
        <!-- Card duy nhất (2026-08-30 spec, khớp đúng Cường Hóa đã duyệt)
             — cột "Khóa" gộp thẳng vào bảng thay vì tách 2 cột flex
             riêng, Điểm Rèn làm dòng chú thích. -->
        <div class="qi-hall__preview-card">
          <p v-if="itemRenState" class="qi-hall__col-title">
            Điểm Rèn {{ itemRenState.points }}/{{ itemRenState.max }} ⇒ {{ refineRenAfter }}/{{ itemRenState.max }}
            · khóa tối đa {{ Math.min(3, Math.max(0, selectedAffixes.length - 1)) }} dòng
          </p>

          <table v-if="selectedAffixes.length" class="qi-hall__compare-table" aria-label="So sánh trước và sau Tinh Luyện">
            <thead>
              <tr>
                <th scope="col">Chỉ số</th>
                <th scope="col">Trước</th>
                <th scope="col" aria-hidden="true"></th>
                <th scope="col">Sau</th>
                <th scope="col">Khóa</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="affix in selectedAffixes" :key="affix.index">
                <th scope="row"><span :class="tierClass(affix.tier)">{{ affix.label }}</span></th>
                <td>{{ currentAffixValue(affix.index) !== null ? formatAffixValue(affix.stat, currentAffixValue(affix.index)!) : '—' }}</td>
                <td class="qi-hall__compare-arrow" aria-hidden="true">⇒</td>
                <td>
                  <span v-if="lockedIndices.includes(affix.index)" class="qi-hall__owned">giữ nguyên</span>
                  <strong v-else-if="pendingRefineByIndex.has(affix.index)">{{ formatAffixValue(affix.stat, pendingRefineByIndex.get(affix.index)!) }}</strong>
                  <span v-else class="qi-hall__owned">chưa roll</span>
                </td>
                <td>
                  <input
                    type="checkbox"
                    :checked="lockedIndices.includes(affix.index)"
                    @change="toggleLock(affix.index)"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <p v-else class="qi-hall__empty">Không có dòng phụ để Tinh Luyện.</p>
        </div>

        <!-- Bỏ jargon nội bộ "Cost hệ số N+L" + Điểm Rèn trùng dòng chú
             thích đầu card (2026-08-30, bug report) — chỉ còn quy tắc
             ±20% (không hiển thị ở đâu khác) và chi phí Tinh Hoa/Linh
             Thạch thật sự chưa có chỗ nào hiện. -->
        <p class="qi-hall__info-row qi-hall__costline">
          Mỗi dòng không khóa roll lại trong ±20%. Chi phí: {{ refineCost.essenceUnits }} Tinh Hoa
          (đang có {{ refineEssenceOwned }}) · {{ refineCost.spiritStone }} {{ spiritStoneCostName }}
        </p>

        <div class="qi-hall__button-row">
          <GameButton size="lg" :disabled="!canRefine()" @click="doRefinePreview">
            Tinh Luyện
          </GameButton>

          <GameButton v-if="pendingRefineValues" size="lg" variant="secondary" @click="doRefineKeep">
            Giữ
          </GameButton>
        </div>
      </div>

      <p v-else class="qi-hall__split-right qi-hall__empty qi-hall__empty--centered">Chọn một trang bị bên trái để xem chi tiết.</p>
    </section>

    <!-- ===== HÓA LUYỆN (§7.5) — lưới slot + tick chọn ===== -->
    <section v-else class="qi-hall__body qi-hall__dissolve">
      <div class="dissolve-filters">
        <select v-model="dissolveFilterRealm">
          <option value="any">Mọi cảnh giới</option>

          <option value="mortal">Phàm Nhân</option>

          <option value="qi_refining">Luyện Khí</option>

          <option value="foundation_establishment">Trúc Cơ</option>
        </select>

        <select v-model="dissolveFilterQuality">
          <option value="any">Mọi phẩm</option>

          <option value="hoang">Hoàng</option>

          <option value="huyen">Huyền</option>

          <option value="dia">Địa</option>

          <option value="thien">Thiên</option>

          <option value="tien">Tiên</option>
        </select>

        <button
          type="button"
          class="dissolve-filters__bulk"
          :disabled="dissolveCandidates.length === 0"
          @click="selectAllDissolveByFilter"
        >
          Chọn tất cả ({{ dissolveCandidates.length }})
        </button>

        <button
          type="button"
          class="dissolve-filters__bulk"
          :disabled="dissolveSelected.size === 0"
          @click="clearDissolveSelection"
        >
          Bỏ chọn hết
        </button>
      </div>

      <div ref="dissolveListEl" class="dissolve-grid">
        <div
          v-for="candidate in dissolveCandidates.slice(dissolvePageRange.start, dissolvePageRange.end)"
          :key="candidate.instanceId"
          class="dissolve-slot-wrap"
          @click="toggleDissolve(candidate.instanceId)"
        >
          <SlotView
            class="qi-hall__slot"
            :item="{ id: candidate.instanceId }"
            :label="candidate.name"
            :name-segments="candidate.nameSegments"
            :icon="candidate.icon"
            :equipment-quality-rank="candidate.qualityRank"
            :rarity-rank="candidate.rarityRank"
            :tooltip="candidate.tooltip"
            :state="{ interaction: dissolveSelected.has(candidate.instanceId) ? 'selected' : 'idle' }"
          />

          <span v-if="dissolveSelected.has(candidate.instanceId)" class="dissolve-slot-tick" aria-hidden="true">✓</span>
        </div>

        <p v-if="dissolveCandidates.length === 0" class="qi-hall__empty">Không có món nào đủ điều kiện Hóa Luyện qua filter hiện tại.</p>
      </div>

      <div v-if="dissolveTotalPages > 1" class="dissolve-pagination">
        <GameButton variant="ghost" size="sm" :disabled="dissolvePage === 0" @click="dissolveGoTo(dissolvePage - 1)">‹</GameButton>
        <span class="dissolve-pagination__label">{{ dissolvePage + 1 }} / {{ dissolveTotalPages }}</span>
        <GameButton variant="ghost" size="sm" :disabled="dissolvePage >= dissolveTotalPages - 1" @click="dissolveGoTo(dissolvePage + 1)">›</GameButton>
      </div>

      <div v-if="dissolvePreview.length > 0" class="dissolve-preview">
        <h4>Nhận được ({{ dissolveSelected.size }} món):</h4>

        <p v-for="entry in dissolvePreview" :key="entry.materialId">
          {{ materialLabel(entry.materialId, gameManager.materialRegistry) }}: {{ entry.minAmount }}–{{ entry.maxAmount }}
        </p>

        <p class="qi-hall__warning">Thao tác KHÔNG thể hoàn tác.</p>
      </div>

      <GameButton
        size="lg"
        variant="danger"
        class="qi-hall__primary-action"
        :disabled="dissolveSelected.size === 0"
        @click="doDissolve"
      >
        {{ dissolveConfirming ? 'XÁC NHẬN HÓA LUYỆN' : `Hóa Luyện (${dissolveSelected.size})` }}
      </GameButton>
    </section>
  </div>
</template>

<style scoped>
.qi-hall {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--text-primary);
  font-family: var(--font-body);
}

.qi-hall > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}


/* Nav lên đầu, KHÔNG nền riêng (2026-08-30, bug report) — hoà vào card
   giống Chip.vue paper-toned thay vì dải tối tách biệt. */
.qi-hall__tabs {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(var(--tab-columns, 4), 1fr);
  gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--paper-line, rgba(42, 41, 36, 0.42));
  background: transparent;
}

/* Bảng so sánh Trước ⇒ Sau dùng chung Cường Hóa/Tẩy/Tinh Luyện (rework
   2026-08-30) — từng chỉ số nằm CÙNG MỘT HÀNG. Đợt tăng cỡ chữ + đánh
   bóng (2026-08-30, bug report "tăng kích thước text, làm đẹp lên") —
   đọc như 1 trang sổ rèn: nhãn đậm bên trái, Trước/Sau canh giữa bằng
   số liệu lớn (tabular-nums để cột số thẳng hàng), zebra row nhạt để
   mắt dò hàng dễ hơn khi bảng nhiều dòng phụ. */
.qi-hall__compare-table {
  width: 100%;
  margin: 0;
  border-collapse: collapse;
  font-size: var(--text-md);
}

.qi-hall__compare-table th,
.qi-hall__compare-table td {
  padding: 9px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--paper-line, rgba(42, 41, 36, 0.42)) 60%, transparent);
  text-align: left;
  color: var(--paper-text, #211f1a);
  font-variant-numeric: tabular-nums;
}

.qi-hall__compare-table thead th {
  padding-top: 4px;
  padding-bottom: 8px;
  font: 700 var(--text-sm) var(--font-body);
  color: var(--paper-eyebrow);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 2px solid color-mix(in srgb, var(--paper-eyebrow) 35%, var(--paper-line));
}

.qi-hall__compare-table thead th:not(:first-child) {
  text-align: center;
}

.qi-hall__compare-table tbody th {
  font: 600 var(--text-md) var(--font-display);
  letter-spacing: 0.01em;
}

.qi-hall__compare-table tbody tr:nth-child(even) {
  background: color-mix(in srgb, var(--mineral-gold) 5%, transparent);
}

.qi-hall__compare-table tbody td:not(.qi-hall__compare-arrow) {
  text-align: center;
  font-size: var(--text-lg);
}

.qi-hall__compare-table td.qi-hall__compare-arrow {
  width: 28px;
  padding: 9px 2px;
  text-align: center;
  color: color-mix(in srgb, var(--paper-eyebrow) 55%, var(--paper-text-soft));
  font-size: var(--text-lg);
  border-bottom-color: transparent;
}

/* Fit-refactor đợt 4 — body là ngân sách flex; section nào dài (Hóa Luyện)
   tự paginate, section ngắn (Cường Hóa...) flex-fit; overflow hidden là rào
   cuối, KHÔNG dùng để scroll. */
.qi-hall__body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.qi-hall__body h4 {
  margin: 0 0 4px;
  color: var(--paper-text, #211f1a);
  font-size: var(--text-lg);
}

.qi-hall__option {
  color: var(--paper-text, #211f1a);
  font-size: var(--text-sm);
}

/* Nút hành động chính (Hóa Luyện, full width — layout riêng của tab đó). */
.qi-hall__primary-action {
  width: 100%;
  margin-top: 4px;
}

/* Cụm nút hành động/Giữ LUÔN Ở CUỐI, CĂN PHẢI (2026-08-30 spec) — dùng
   chung cho Cường Hóa/Tẩy/Tinh Luyện, thay vì mỗi tab một kiểu canh
   riêng (full-width/giữa/giữa-2-cột) như trước. */
.qi-hall__button-row {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.qi-hall__button-row .game-button {
  min-width: 120px;
}

.enhance-row__costs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.enhance-row__costs li.is-missing {
  color: var(--crimson);
}

/* Split trái/phải (2026-08-30) — chọn trang bị bên trái (1 CỘT DUY
   NHẤT, kích cỡ nhỏ vừa khớp chiều cao card chi tiết bên phải), chi
   tiết/hành động bên phải. */
.qi-hall__split {
  flex-direction: row;
  gap: 14px;
}

.qi-hall__split-left {
  flex: 0 0 84px;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-right: 10px;
  border-right: 1px solid color-mix(in srgb, var(--scene-fire-text-soft) 22%, transparent);
}

.qi-hall__split-right {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 4%;
}

/* Card bọc bảng so sánh — DÙNG CHUNG Cường Hóa/Tẩy/Tinh Luyện (2026-08-30
   spec: "bọc phần như tôi đã gửi vào trong một card cho gọn gàng").
   flex:1 để chiếm hết khoảng trống còn lại giữa header và info-row/
   button-row, justify-content:center để bảng không dính sát lên trên
   khi ít dòng (tránh trống dưới). */
.qi-hall__preview-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  overflow-y: auto;
  border: 1px solid var(--paper-line, rgba(42, 41, 36, 0.42));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--paper-50) 70%, transparent);
}

/* Cột trang bị: 6 Ô LUÔN TỒN TẠI, CÁCH ĐỀU, AUTOFIT CHIỀU CAO (2026-08-30
   spec) — 1 cột dọc duy nhất, mỗi ô chiếm đúng 1/6 chiều cao khả dụng
   (khớp với tổng chiều cao cột phải: so sánh + info + nút), không co cụm
   giữa để lại khoảng trống trên/dưới. */
.qi-hall__slot-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: repeat(6, 1fr);
  gap: 4px;
}

.qi-hall__slot {
  min-width: 0;
}

.qi-hall__empty {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--paper-line, rgba(42, 41, 36, 0.42));
  color: var(--paper-text-soft, #5e5a50);
  font-size: var(--text-sm);
  text-align: center;
}

.qi-hall__empty--centered {
  display: flex;
  align-items: center;
  justify-content: center;
}

.qi-hall__option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  min-height: var(--tap-min);
  font-size: var(--text-sm);
  cursor: pointer;
}

.qi-hall__owned {
  margin-left: auto;
  color: var(--paper-text-soft, #5e5a50);
}

.qi-hall__costline {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft, #5e5a50);
}

.qi-hall__compare-arrow {
  align-self: center;
  color: var(--paper-eyebrow);
  font-size: 22px;
  line-height: 1;
}

/* Dải "nguyên liệu cần thiết / options" NGAY DƯỚI vùng so sánh, phía
   trên cụm nút — dùng chung cho Tẩy/Tinh Luyện (Cường Hóa dùng biến thể
   enhance-row__costs sẵn có). */
.qi-hall__info-row {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  padding: 6px 0;
  border-top: 1px solid color-mix(in srgb, var(--scene-fire-text-soft) 22%, transparent);
}

.qi-hall__info-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}

.qi-hall__info-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--paper-eyebrow);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Chú thích đầu card (Cấp/Điểm Rèn trước ⇒ sau) — vạch cinnabar bên trái
   giống dấu triện mở đầu 1 trang sổ, cỡ chữ lớn hẳn so với phần còn lại
   của panel vì đây là con số người chơi quan tâm nhất trong tab. */
.qi-hall__col-title {
  margin: 0 0 8px;
  padding-left: 10px;
  border-left: 3px solid var(--paper-eyebrow);
  font: 700 var(--text-title) var(--font-display);
  color: var(--paper-text, #211f1a);
}

.qi-hall__up-arrow {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--jade) 16%, transparent);
  color: var(--jade);
  font-weight: 700;
  font-size: var(--text-sm);
}

/* Tier hiển thị bằng màu (2026-08-30 bug report) — cùng token
   --affix-tier-N với Tooltip.vue's .tooltip__section-row--tier-N. */
.qi-hall__tier-1 { color: var(--affix-tier-1); }
.qi-hall__tier-2 { color: var(--affix-tier-2); }
.qi-hall__tier-3 { color: var(--affix-tier-3); }
.qi-hall__tier-4 { color: var(--affix-tier-4); }
.qi-hall__tier-5 {
  color: transparent;
  background: var(--rank-gradient-9);
  background-clip: text;
  -webkit-background-clip: text;
  font-weight: 700;
}

/* Hóa Luyện — cột đơn full width, không split trái/phải. */
.qi-hall__dissolve {
  gap: 8px;
}

.dissolve-filters {
  display: flex;
  gap: 6px;
}

.dissolve-filters select {
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  padding: 4px;
  min-height: var(--tap-min);
  font-family: var(--font-body);
}

.dissolve-filters__bulk {
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  min-height: var(--tap-min);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  cursor: pointer;
}

.dissolve-filters__bulk:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Lưới slot Hóa Luyện — tham chiếu đúng kiểu ô inventory (2026-08-30
   spec), thay danh sách <li> text cũ. */
.dissolve-grid {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
  align-content: flex-start;
  overflow: hidden;
}

.dissolve-slot-wrap {
  position: relative;
  cursor: pointer;
}

/* Dấu tick món đã chọn (2026-08-30 spec: "hiệu ứng gì đó, ví dụ dấu
   tick") — SlotView tự viền sáng qua state.interaction='selected',
   badge tick này là tín hiệu PHỤ rõ ràng hơn ở góc. */
.dissolve-slot-tick {
  position: absolute;
  top: -4px;
  right: -4px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--jade);
  color: var(--paper-50);
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 0 0 2px var(--paper-50), 0 2px 4px rgba(0, 0, 0, 0.35);
}

.dissolve-pagination {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.dissolve-pagination__label {
  font-size: var(--text-sm);
  color: var(--paper-text-soft, #5e5a50);
  font-variant-numeric: tabular-nums;
}

.dissolve-preview {
  flex: 0 0 auto;
}

.dissolve-preview h4 {
  margin: 0 0 4px;
  font-size: var(--text-sm);
  color: var(--paper-text, #211f1a);
}

.dissolve-preview p {
  margin: 0 0 3px;
  font-size: var(--text-xs);
  color: var(--jade);
}

.qi-hall__warning {
  font-size: var(--text-xs);
  color: var(--crimson);
}

@container overlay-panel (max-width: 760px) {
  .qi-hall__split { flex-direction: column; }
  .qi-hall__split-left {
    flex: 0 0 auto;
    flex-direction: row;
    padding-right: 0;
    padding-bottom: 8px;
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--scene-fire-text-soft) 22%, transparent);
  }
  .qi-hall__slot-grid { grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); grid-template-rows: none; }
}

</style>
