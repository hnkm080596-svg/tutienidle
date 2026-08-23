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

const tierExpPercent = computed(() => {
  const { lowerBound, nextThreshold } = tierProgress.value

  if (nextThreshold === undefined) {
    return 100
  }

  return Math.min(100, ((techniqueInsight.value - lowerBound) / (nextThreshold - lowerBound)) * 100)
})

const tierExpLabel = computed(() => {
  const { nextThreshold } = tierProgress.value

  return nextThreshold === undefined
    ? 'Viên Mãn'
    : `${formatNumber(techniqueInsight.value)} / ${formatNumber(nextThreshold)}`
})

function close() {
  ui.standalonePanel = null
}
</script>

<template>
  <div v-if="ui.standalonePanel === 'technique'" class="technique-panel" @click.self="close">
    <div class="technique-panel__card">
      <div class="technique-panel__header">
        <h3 class="technique-panel__title">Tâm Pháp</h3>

        <button type="button" class="technique-panel__close" @click="close">✕</button>
      </div>

      <div class="technique-panel__hero">
        <TechniqueSlotCard label="Tâm Pháp" size="hero" />
      </div>

      <div v-if="equippedTechnique" class="technique-panel__detail">
        <div class="technique-panel__tier-bar">
          <div class="technique-panel__tier-fill" :style="{ width: `${tierExpPercent}%` }" />
        </div>

        <span class="technique-panel__tier-label">{{ tierExpLabel }}</span>

        <div v-for="section in techniqueSections" :key="section.label" class="technique-panel__group">
          <h5 class="technique-panel__group-title">{{ section.label }}</h5>

          <ul class="technique-panel__rows">
            <li v-for="row in section.rows" :key="row.label">
              <span>{{ row.label }}</span>
              <span>{{ row.value }}</span>
            </li>
          </ul>
        </div>

        <p v-if="techniqueSections.length === 0" class="technique-panel__empty">Không có thông tin bổ sung</p>
      </div>

      <p v-else class="technique-panel__empty">Chưa có công pháp — hoàn thành Lễ Nhập Môn để tự động nhận</p>
    </div>
  </div>
</template>

<style scoped>
.technique-panel {
  position: absolute;
  inset: 0;
  z-index: 1800;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 13, 0.72);
}

.technique-panel__card {
  width: min(560px, 90%);
  max-height: 85%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 24px;
  background: var(--ink-900);
  border: 1px solid var(--gold-500);
  box-shadow: var(--shadow-panel);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  color: var(--text-primary);
}

.technique-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.technique-panel__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  color: var(--gold-500);
}

.technique-panel__close {
  width: 24px;
  height: 24px;
  padding: 0;
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

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
  height: 5px;
  margin: 4px 0 0;
  border-radius: 3px;
  background: var(--ink-700);
  overflow: hidden;
}

.technique-panel__tier-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--jade), var(--gold-500));
}

.technique-panel__tier-label {
  display: block;
  margin: 0 0 8px;
  font-size: 0.68rem;
  color: var(--text-muted);
}

.technique-panel__group {
  margin-bottom: 6px;
}

.technique-panel__group-title {
  margin: 0 0 4px;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--gold-500);
}

.technique-panel__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.76rem;
}

.technique-panel__rows li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 4px;
  border-bottom: 1px solid var(--ink-line-soft);
  color: var(--text-secondary);
}

.technique-panel__empty {
  color: var(--text-muted);
  font-size: 0.8rem;
  text-align: center;
  padding: 12px 4px;
}
</style>
