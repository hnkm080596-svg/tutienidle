<script setup lang="ts">
// Task 14-UI (rework P4, 2026-09-01, spec §5.6) — Tab Phân Giải:
// settings phân giải Linh Khoáng → Luyện Khí Tinh Hoa.
// - gradeFilter / ageFilter / worker slider → DecomposeSystem
// - Output estimate: base(grade all→Cửu 1.0) × tuổi × workers (ước lượng
//   hiển thị — system tính chính xác theo tồn kho lúc tick)
// gp123 6E (task C2): filter "chất" cũ (hoang..tien) đổi thành filter
// TUỔI (decade..thuong_co) theo trục tuổi thống nhất.
// Flexible rule (AGENTS.md): grid auto-fit, không hardcode px.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import type { DecomposeSettings } from '@/core/production/DecomposeSystem'
import {
  isProfessionGrade,
  PROFESSION_GRADE_ORDER,
  PROFESSION_GRADE_NAMES,
} from '@/core/profession/ProfessionGrade'
import { professionGradeRank } from '@/core/profession/slotRank'
import { HERB_AGES } from '@/core/production/ProductionTypes'
import type { HerbAge } from '@/core/production/ProductionTypes'
import { MATERIAL_AGE_LABELS } from '@/data/materials/materials'
import { materialLabel } from '@/core/presentation/labels'
import { formatNumber } from '@/core/format/NumberFormatter'

const { t } = useI18n()
const gameManager = useGameManager()

// DecomposeSystem nằm trên GameManager (Task 14 wiring). System thuần TS
// KHÔNG reactive — local mirror ref đồng bộ sau mỗi setSetting để Vue
// re-render (không chờ stateVersion bump từ tick loop).
const system = gameManager.decomposeSystem

const settingsMirror = ref<DecomposeSettings>(system.getSettings())

// R7 (AR-08): slider max derives from the LIVE workforce capacity -
// no hardcoded ceiling. The capacity snapshot re-syncs on every
// state-version bump (CHQ build/upgrade mid-session) so the max stays
// truthful; the system itself is plain TS, not reactive.
const { stateVersion } = useStateVersion()

const capacityMirror = ref(system.getCapacity())

// ui-audit economy M5: which bag ores the CURRENT filters match —
// the tab used to render three controls and nothing else, so an
// unstaffed/failed-match state read as a dead, unexplained widget.
// listMatchingOres() is the domain query (reuses oreMatchesFilter —
// the UI never re-derives the predicate).
const matchingOres = ref(system.listMatchingOres())

watch(
  stateVersion,
  () => {
    settingsMirror.value = system.getSettings()
    capacityMirror.value = system.getCapacity()
    matchingOres.value = system.listMatchingOres()
  },
  { immediate: true },
)

function applySetting(patch: Partial<DecomposeSettings>) {
  system.setSetting(patch)

  settingsMirror.value = system.getSettings()
  matchingOres.value = system.listMatchingOres()
}

function oreLabel(materialId: string): string {
  return materialLabel(materialId, gameManager.materialRegistry)
}

// Empty-state priority: no capacity (Chiêu Hiền Quán not built yet) →
// no workers assigned → no ore in the bag matching the filters. Only
// one guidance line renders at a time.
const emptyHintKey = computed(() => {
  if (capacityMirror.value <= 0) return 'panels.decompose.hint.noCapacity'
  if (settingsMirror.value.workers <= 0) return 'panels.decompose.hint.noWorkers'
  if (matchingOres.value.length === 0) return 'panels.decompose.hint.noMatchingOres'

  return null
})

// Ước lượng output/lượt cho PREVIEW (grade 'all' → Cửu 1.0 làm đại diện).
const PREVIEW_BASE_BY_ALL = 1

const estimate = computed(() => {
  const { ageFilter, workers } = settingsMirror.value

  const ageIndex =
    ageFilter === 'all' ? 0 : HERB_AGES.indexOf(ageFilter)

  const ageFactor = 2 ** Math.max(0, ageIndex)

  return PREVIEW_BASE_BY_ALL * ageFactor * workers
})

function onGradeChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value

  if (value !== 'all' && !isProfessionGrade(value)) return

  applySetting({ gradeFilter: value })
}

function onAgeChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value

  if (value !== 'all' && !(HERB_AGES as readonly string[]).includes(value)) return

  applySetting({ ageFilter: value as HerbAge | 'all' })
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

          <option
            v-for="grade in PROFESSION_GRADE_ORDER"
            :key="grade"
            :value="grade"
            :style="{ color: `var(--rank-color-${professionGradeRank(grade)})` }"
          >
            {{ PROFESSION_GRADE_NAMES[grade] }}
          </option>
        </select>
      </label>

      <label class="decompose-tab__filter">
        <span>{{ t('panels.decompose.labels.ageFilter') }}</span>

        <select :value="settingsMirror.ageFilter" @change="onAgeChange">
          <option value="all">{{ t('panels.decompose.select.allAges') }}</option>

          <option v-for="age in HERB_AGES" :key="age" :value="age">
            {{ MATERIAL_AGE_LABELS[age] }}
          </option>
        </select>
      </label>

      <label class="decompose-tab__filter">
        <span>{{ t('panels.decompose.labels.workers') }}: {{ settingsMirror.workers }}</span>

        <input
          type="range"
          min="0"
          :max="capacityMirror"
          step="1"
          :value="settingsMirror.workers"
          @input="onWorkersInput"
        />
      </label>
    </section>

    <p class="decompose-tab__estimate">
      {{ t('panels.decompose.estimate', { amount: estimate }) }}
    </p>

    <!-- audit M5: guidance + a live list of which ores will be fed, so
         an idle tab stops reading as a dead widget. -->
    <p v-if="emptyHintKey" class="decompose-tab__hint" data-testid="decompose-hint">
      {{ t(emptyHintKey) }}
    </p>

    <div v-else class="decompose-tab__matching">
      <p class="decompose-tab__matching-title">
        {{ t('panels.decompose.matching', { count: matchingOres.reduce((sum, ore) => sum + ore.amount, 0) }) }}
      </p>

      <ul class="decompose-tab__matching-list">
        <li v-for="ore in matchingOres" :key="ore.materialId">
          {{ oreLabel(ore.materialId) }} ×{{ formatNumber(ore.amount) }}
        </li>
      </ul>
    </div>
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

.decompose-tab__hint {
  margin: 0;
  padding: 10px 12px;
  border: 1px dashed color-mix(in srgb, var(--jade) 40%, var(--paper-line));
  border-radius: var(--radius-md);
  color: var(--paper-text-soft);
  font-size: var(--text-sm);
}

.decompose-tab__matching {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.decompose-tab__matching-title {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.decompose-tab__matching-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.decompose-tab__matching-list li {
  padding: 3px 10px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--mineral-gold) 8%, var(--paper-50));
  color: var(--paper-text);
  font-size: var(--text-xs);
}
</style>
