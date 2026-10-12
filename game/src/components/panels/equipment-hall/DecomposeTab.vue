<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { materialLabel } from '@/core/presentation/labels'
import { formatNumber } from '@/core/format/NumberFormatter'
import { classifyDecomposableMaterial } from '@/core/production/DecomposeSystem'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import MaterialBagSection from '@/components/panels/bag-sections/MaterialBagSection.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import {
  bagGridPoint,
  collectBagCellPoints,
  playDecomposeFx,
  type DecomposeFxStream,
  type DecomposeFxPoint,
} from '@/components/fx/decomposeFx'

const { t } = useI18n()

const gameManager = useGameManager()
const system = gameManager.decomposeSystem
const { stateVersion, bumpState } = useStateVersion()
const availableOres = ref(system.getAvailableOres())
const selectedOreId = ref(availableOres.value[0]?.materialId ?? '')
const amount = ref(1)
const resultMessage = ref('')

const selectedOre = computed(() =>
  availableOres.value.find((ore) => ore.materialId === selectedOreId.value),
)
const preview = computed(() =>
  selectedOreId.value ? system.previewDecomposeOre(selectedOreId.value, amount.value) : null,
)

watch(stateVersion, () => {
  availableOres.value = system.getAvailableOres()
  if (!availableOres.value.some((ore) => ore.materialId === selectedOreId.value)) {
    selectedOreId.value = availableOres.value[0]?.materialId ?? ''
  }
  if (selectedOre.value) amount.value = Math.min(Math.max(1, amount.value), selectedOre.value.amount)
})

function onOreChange(event: Event) {
  selectedOreId.value = (event.target as HTMLSelectElement).value
  amount.value = 1
  resultMessage.value = ''
}

function onAmountChange(event: Event) {
  amount.value = Number((event.target as HTMLInputElement).value)
  resultMessage.value = ''
}

function refineOre() {
  const result = system.decomposeOre(selectedOreId.value, amount.value)
  if (result.ok) {
    resultMessage.value = t('panels.decompose.success', { amount: formatNumber(result.produced) })
    bumpState()
    availableOres.value = system.getAvailableOres()
    if (!availableOres.value.some((ore) => ore.materialId === selectedOreId.value)) {
      selectedOreId.value = availableOres.value[0]?.materialId ?? ''
    }
    return
  }
  resultMessage.value = t(`panels.decompose.hint.${result.reason}`)
}

function oreLabel(materialId: string): string {
  return materialLabel(materialId, gameManager.materialRegistry)
}
</script>

<template>
  <div class="decompose-tab equipment-forge-workspace">
    <h2>{{ t('panels.equipmentHall.tabs.decompose') }}</h2>
    <p v-if="availableOres.length === 0" class="decompose-tab__hint">
      {{ t('panels.decompose.empty') }}
    </p>
    <template v-else>
      <section class="decompose-tab__form">
        <label class="decompose-tab__filter">
          <span>{{ t('panels.decompose.labels.ore') }}</span>
          <select :value="selectedOreId" @change="onOreChange">
            <option v-for="ore in availableOres" :key="ore.materialId" :value="ore.materialId">
              {{ oreLabel(ore.materialId) }} ×{{ formatNumber(ore.amount) }}
            </option>
          </select>
        </label>
        <label class="decompose-tab__filter">
          <span>{{ t('panels.decompose.labels.amount') }}</span>
          <input type="number" min="1" step="1" :max="selectedOre?.amount ?? 1" :value="amount" @input="onAmountChange" />
        </label>
      </section>
      <p v-if="preview?.ok" class="decompose-tab__estimate">
        {{ t('panels.decompose.preview', { amount: formatNumber(preview.produced) }) }}
      </p>
      <p v-else-if="preview && !preview.ok" class="decompose-tab__hint">
        {{ t(`panels.decompose.hint.${preview.reason}`) }}
      </p>
      <button type="button" class="decompose-tab__action" @click="refineOre">
        {{ t('panels.decompose.action') }}
      </button>
    </template>
    <p v-if="resultMessage" class="decompose-tab__hint" role="status">{{ resultMessage }}</p>
  </div>
</template>

<style scoped>
.decompose-tab {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
/* Bulk buttons = chip art cua dropdown tui (equipment-filter-*,
   native 1225x324; disabled fades - khong co art disabled). */
.decompose-filters__bulk {
  flex: 0 0 auto;
  height: 40px;
  aspect-ratio: 1225 / 324;
  border: 0;
  background: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-normal-v2.png') center / contain no-repeat;
  color: #f2e3c2;
  font: 700 12px var(--pc-font-body, var(--font-display, Georgia, serif));
  padding: 0 12px;
  cursor: pointer;
  white-space: nowrap;
}
.decompose-tab__form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
.decompose-tab__filter {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: #c1b18d;
}
.decompose-tab__filter select,
.decompose-tab__filter input {
  min-height: 32px;
  border: 1px solid #8e7440;
  background: #23251e;
  color: #eedfbf;
  font: 13px var(--font-body, Georgia, serif);
  padding: 0 8px;
}
.decompose-tab__estimate,
.decompose-tab__hint {
  margin: 0;
  color: #c1b18d;
  font-size: 13px;
}
.decompose-tab__hint {
  padding: 10px 12px;
  border: 1px dashed #8e744066;
  border-radius: var(--radius-md, 6px);
}
.decompose-tab__action {
  align-self: flex-start;
  min-height: 36px;
  padding: 0 16px;
  border: 1px solid #8e7440;
  color: #eedfbf;
  background: #23251e;
  cursor: pointer;
}
</style>
