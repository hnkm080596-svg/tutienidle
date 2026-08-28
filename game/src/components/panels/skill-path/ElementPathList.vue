<script setup lang="ts">
// PhapTuPanel plan mục 4/5/19 — "chọn Hành đang xem/phát triển", KHÔNG
// phải chọn class nhân vật (player có thể lĩnh ngộ nhiều Hành song
// song). ElementLoadoutPicker.vue (từng "equip Hành vào combat") đã GỠ
// HẲN (2026-08-20, trùng chức năng SkillLoadoutStrip) — component này
// CHỈ còn đúng 1 việc: đổi branch nào NodeTreePanel.vue đang hiện,
// KHÔNG mua/trang bị gì.
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { getNodeLevel } from '@/core/progression/NodeSystem'
import { ELEMENT_LABELS, ELEMENT_COLOR_VARS } from '@/core/element/ElementLabels'
import type { ElementType } from '@/core/element/ElementType'

const props = defineProps<{
  selected: ElementType
}>()

const emit = defineEmits<{
  select: [element: ElementType]
}>()

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// Ngũ Hành CƠ BẢN (đã có Node Tree thật, xem data/progression/PhapTuNodes.ts)
// + Phong/Lôi (mở sau, plan mục 19 — chưa có node nào đăng ký cho 2
// Hành này, hiện khoá CỐ ĐỊNH, không cho chọn để xem).
const BASE_ELEMENTS: ElementType[] = ['fire', 'wood', 'water', 'metal', 'earth']
const EXTENDED_ELEMENTS: ElementType[] = ['wind', 'lightning']

function buildRow(element: ElementType, extended: boolean) {
  stateVersion.value

  const branchNodes = gameManager.nodeRegistry.getAll().filter(node => node.branchTag === element)

  // Tiến độ nhánh = tổng LEVEL đã đầu tư / tổng level tối đa của nhánh
  // (plan §6.1) — node nhiều cấp tính theo tỉ lệ level thay vì boolean.
  let purchasedCount = 0

  let totalCount = 0

  for (const node of branchNodes) {
    const maxLevel = Math.max(1, node.maxLevel ?? 1)

    purchasedCount += Math.min(maxLevel, getNodeLevel(player.$state, node.id))

    totalCount += maxLevel
  }

  return {
    element,
    label: ELEMENT_LABELS[element],
    color: ELEMENT_COLOR_VARS[element],
    // Phong/Lôi chưa có data node -> luôn khoá, không phụ thuộc
    // unlockedElements (không có cách nào unlock được lúc này).
    locked: extended || branchNodes.length === 0,
    total: totalCount,
    purchasedCount,
  }
}

const rows = computed(() => [
  ...BASE_ELEMENTS.map(element => buildRow(element, false)),
  ...EXTENDED_ELEMENTS.map(element => buildRow(element, true)),
])

function onClick(row: ReturnType<typeof buildRow>) {
  if (row.locked) {
    return
  }

  emit('select', row.element)
}
</script>

<template>
  <div class="element-path-list">
    <span class="element-path-list__title">Con Đường</span>

    <button
      v-for="row in rows"
      :key="row.element"
      type="button"
      class="element-path-list__card"
      :class="{ 'is-selected': !row.locked && row.element === selected, 'is-locked': row.locked }"
      :style="{ '--el-color': row.color }"
      :disabled="row.locked"
      @click="onClick(row)"
    >
      <span class="element-path-list__label">{{ row.label }}</span>

      <span v-if="row.locked" class="element-path-list__meta">🔒 Chưa mở</span>
      <span v-else class="element-path-list__meta">{{ row.purchasedCount }}/{{ row.total }} lĩnh ngộ</span>

      <div v-if="!row.locked" class="element-path-list__bar">
        <div class="element-path-list__bar-fill" :style="{ width: `${row.total > 0 ? (row.purchasedCount / row.total) * 100 : 0}%` }" />
      </div>
    </button>
  </div>
</template>

<style scoped>
.element-path-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.element-path-list__title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.element-path-list__card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  color: var(--el-color, var(--text-primary));
}

.element-path-list__card:not(:disabled):hover {
  border-color: var(--el-color, var(--chrome-500));
}

.element-path-list__card.is-selected {
  border-color: var(--el-color);
  background: color-mix(in srgb, var(--el-color) 20%, var(--ink-800));
  box-shadow: 0 0 10px -3px var(--el-color, transparent);
}

.element-path-list__card.is-locked {
  color: var(--text-muted);
  opacity: 0.55;
  cursor: not-allowed;
}

.element-path-list__label {
  font-size: var(--text-sm);
  font-weight: 700;
}

.element-path-list__meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.element-path-list__bar {
  height: 3px;
  border-radius: 2px;
  background: var(--ink-700);
  overflow: hidden;
}

.element-path-list__bar-fill {
  height: 100%;
  background: var(--el-color, var(--chrome-500));
}
</style>
