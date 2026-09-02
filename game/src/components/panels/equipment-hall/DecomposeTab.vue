<script setup lang="ts">
// Task 14-UI (rework P4, 2026-09-01, spec §5.6) — Tab Phân Giải:
// settings phân giải Linh Khoáng → Luyện Khí Tinh Hoa.
// - gradeFilter / qualityFilter / worker slider → DecomposeSystem
// - Output estimate: base(grade all→Cửu 1.0) × chất × workers (ước lượng
//   hiển thị — system tính chính xác theo tồn kho lúc tick)
// Flexible rule (AGENTS.md): grid auto-fit, không hardcode px.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager } from '@/composables/useGameState'
import type { DecomposeSettings } from '@/core/production/DecomposeSystem'
import {
  PROFESSION_GRADE_ORDER,
  PROFESSION_GRADE_NAMES,
} from '@/core/profession/ProfessionGrade'
import { ITEM_QUALITY_ORDER, ITEM_QUALITY_LABELS } from '@/core/item/ItemQuality'

const { t } = useI18n()
const gameManager = useGameManager()

// DecomposeSystem nằm trên GameManager (Task 14 wiring). System thuần TS
// KHÔNG reactive — local mirror ref đồng bộ sau mỗi setSetting để Vue
// re-render (không chờ stateVersion bump từ tick loop).
const system = gameManager.decomposeSystem

const settingsMirror = ref<DecomposeSettings>(system.getSettings())

function applySetting(patch: Partial<DecomposeSettings>) {
  system.setSetting(patch)

  settingsMirror.value = system.getSettings()
}

// Ước lượng output/lượt cho PREVIEW (grade 'all' → Cửu 1.0 làm đại diện).
const PREVIEW_BASE_BY_ALL = 1

const estimate = computed(() => {
  const { qualityFilter, workers } = settingsMirror.value

  const qualityIndex =
    qualityFilter === 'all' ? 0 : ITEM_QUALITY_ORDER.indexOf(qualityFilter)

  const qualityFactor = 2 ** Math.max(0, qualityIndex)

  return PREVIEW_BASE_BY_ALL * qualityFactor * workers
})

function onGradeChange(event: Event) {
  applySetting({ gradeFilter: (event.target as HTMLSelectElement).value as never })
}

function onQualityChange(event: Event) {
  applySetting({ qualityFilter: (event.target as HTMLSelectElement).value as never })
}

function onWorkersInput(event: Event) {
  applySetting({ workers: Number((event.target as HTMLInputElement).value) })
}
</script>

<template>
  <div class="decompose-tab">
    <section class="decompose-tab__filters">
      <label class="decompose-tab__filter">
        <span>{{ t('panels.decompose.labels.gradeFilter') }}</span>

        <select :value="settingsMirror.gradeFilter" @change="onGradeChange">
          <option value="all">{{ t('panels.decompose.select.allGrades') }}</option>

          <option v-for="grade in PROFESSION_GRADE_ORDER" :key="grade" :value="grade">
            {{ PROFESSION_GRADE_NAMES[grade] }}
          </option>
        </select>
      </label>

      <label class="decompose-tab__filter">
        <span>{{ t('panels.decompose.labels.qualityFilter') }}</span>

        <select :value="settingsMirror.qualityFilter" @change="onQualityChange">
          <option value="all">{{ t('panels.decompose.select.allQualities') }}</option>

          <option v-for="quality in ITEM_QUALITY_ORDER" :key="quality" :value="quality">
            {{ ITEM_QUALITY_LABELS[quality] }}
          </option>
        </select>
      </label>

      <label class="decompose-tab__filter">
        <span>{{ t('panels.decompose.labels.workers') }}: {{ settingsMirror.workers }}</span>

        <input
          type="range"
          min="0"
          :max="6"
          step="1"
          :value="settingsMirror.workers"
          @input="onWorkersInput"
        />
      </label>
    </section>

    <p class="decompose-tab__estimate">
      {{ t('panels.decompose.estimate', { amount: estimate }) }}
    </p>
  </div>
</template>

<style scoped>
.decompose-tab {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.decompose-tab__filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.decompose-tab__filter {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--text-body);
  color: var(--text-primary);
}

.decompose-tab__estimate {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-body);
}
</style>
