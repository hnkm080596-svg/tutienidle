<script setup lang="ts">
// Tách khỏi LoadoutManager.vue (2026-08-20, yêu cầu "Kỹ năng và tâm
// pháp giờ cần tách ra thành 2 panel mới, không phụ thuộc vào left
// panel nữa") — nội dung tab 'technique' cũ dời sang NGUYÊN VẸN (đọc
// công pháp ĐANG trang bị qua techniqueManager + buildTechniqueSections(),
// KHÔNG có "Đã Học" để đổi — Tâm Pháp hoàn toàn theo nghề nghiệp, xem
// CultivationPathKit.ts), chỉ đổi khung ngoài từ "1 trong 2 tab của
// LoadoutManager" sang overlay toàn màn hình độc lập, cùng pattern
// BreakthroughRequirementPanel.vue (panel lớn không thuộc LeftPanel).
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import TechniqueSlotCard from './loadout-sections/TechniqueSlotCard.vue'
import { buildTechniqueSections } from '@/composables/useTechniqueSections'
import { getTechniqueInsightTotalRequired, getTechniqueTierProgress } from '@/core/technique/TechniqueTier'
import { formatNumber } from '@/core/format/NumberFormatter'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import Bar from '@/components/common/primitives/Bar.vue'
import StatRow from '@/components/common/primitives/StatRow.vue'
import Eyebrow from '@/components/common/primitives/Eyebrow.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'

const ui = useUiStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

const equippedTechnique = computed(() => {
  stateVersion.value

  return gameManager.techniqueManager.getEquipped()
})

const techniqueSections = computed(() => {
  const technique = equippedTechnique.value

  return technique ? buildTechniqueSections(technique, gameManager, technique.insight ?? 0) : []
})

const techniqueInsight = computed(() => equippedTechnique.value?.insight ?? 0)
const tierProgress = computed(() => {
  const technique = equippedTechnique.value
  return getTechniqueTierProgress(techniqueInsight.value, technique ? getTechniqueInsightTotalRequired(technique) : undefined)
})

const tierExpValue = computed(() => {
  const { lowerBound, nextThreshold } = tierProgress.value

  if (nextThreshold === undefined) {
    return 1
  }

  return techniqueInsight.value - lowerBound
})

const tierExpMax = computed(() => {
  const { lowerBound, nextThreshold } = tierProgress.value

  if (nextThreshold === undefined) {
    return 1
  }

  return nextThreshold - lowerBound
})

const tierExpLabel = computed(() => {
  const { nextThreshold } = tierProgress.value

  return nextThreshold === undefined
    ? 'Viên Mãn'
    : `${formatNumber(techniqueInsight.value)} / ${formatNumber(nextThreshold)}`
})

function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <OverlayPanel :open="ui.standalonePanel === 'technique'" title="Tâm Pháp" width="min(560px, 90vw)" @close="close">
      <div class="technique-panel__hero">
        <TechniqueSlotCard label="Tâm Pháp" size="hero" />
      </div>

      <div v-if="equippedTechnique" class="technique-panel__detail">
        <Bar class="technique-panel__tier-bar" :value="tierExpValue" :max="tierExpMax" :height="5" />

        <span class="technique-panel__tier-label">{{ tierExpLabel }}</span>

        <div v-for="section in techniqueSections" :key="section.label" class="technique-panel__group">
          <Eyebrow as="h5">{{ section.label }}</Eyebrow>

          <ul class="technique-panel__rows">
            <StatRow v-for="row in section.rows" :key="row.label" :label="row.label" bordered>
              {{ row.value }}
            </StatRow>
          </ul>
        </div>

        <EmptyState v-if="techniqueSections.length === 0" size="sm">Không có thông tin bổ sung</EmptyState>
      </div>

      <EmptyState v-else size="md">Chưa có công pháp — hoàn thành Lễ Nhập Môn để tự động nhận</EmptyState>
  </OverlayPanel>
</template>

<style scoped>
.technique-panel__hero {
  display: flex;
  flex-direction: column;
}

.technique-panel__detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.technique-panel__tier-bar {
  margin: 4px 0 0;
  border-radius: 3px;
}

.technique-panel__tier-label {
  display: block;
  margin: 0 0 8px;
  font-size: var(--text-sm);
  color: var(--paper-text-muted);
}

.technique-panel__group {
  margin-bottom: 6px;
}

.technique-panel__group .eyebrow {
  margin: 0 0 4px;
}

.technique-panel__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: var(--text-sm);
}
</style>
