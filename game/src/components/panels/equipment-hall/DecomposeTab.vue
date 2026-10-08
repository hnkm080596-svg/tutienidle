<script setup lang="ts">
// Task 14-UI (rework P4, 2026-09-01, spec S5.6) -- Tab Phan Giai:
// settings phan giai Linh Khoang -> Luyen Khi Tinh Hoa.
// - gradeFilter / ageFilter / worker slider -> DecomposeSystem
// - Output estimate: base(grade all->Cuu 1.0) x tuoi x workers (uoc luong
//   hien thi -- system tinh chinh xac theo ton kho luc tick)
// gp123 6E (task C2): filter "chat" cu (hoang..tien) doi thanh filter
// TUOI (decade..thuong_co) theo truc tuoi thong nhat.
// Flexible rule (AGENTS.md): grid auto-fit, khong hardcode px.
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

// DecomposeSystem nam tren GameManager (Task 14 wiring). System thuan TS
// KHONG reactive -- local mirror ref dong bo sau moi setSetting de Vue
// re-render (khong cho stateVersion bump tu tick loop).
const system = gameManager.decomposeSystem

const settingsMirror = ref<DecomposeSettings>(system.getSettings())

// R7 (AR-08): slider max derives from the LIVE workforce capacity -
// no hardcoded ceiling. The capacity snapshot re-syncs on every
// state-version bump (CHQ build/upgrade mid-session) so the max stays
// truthful; the system itself is plain TS, not reactive.
const { stateVersion } = useStateVersion()

const capacityMirror = ref(system.getCapacity())

// ui-audit economy M5: which bag ores the CURRENT filters match --
// the tab used to render three controls and nothing else, so an
// unstaffed/failed-match state read as a dead, unexplained widget.
// listMatchingOres() is the domain query (reuses oreMatchesFilter --
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

// Empty-state priority: no capacity (Chieu Hien Quan not built yet) ->
// no workers assigned -> no ore in the bag matching the filters. Only
// one guidance line renders at a time.
const emptyHintKey = computed(() => {
  if (capacityMirror.value <= 0) return 'panels.decompose.hint.noCapacity'
  if (settingsMirror.value.workers <= 0) return 'panels.decompose.hint.noWorkers'
  if (matchingOres.value.length === 0) return 'panels.decompose.hint.noMatchingOres'

  return null
})

// Uoc luong output/luot cho PREVIEW (grade 'all' -> Cuu 1.0 lam dai dien).
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
  <div class="decompose-tab equipment-forge-workspace">
    <h2>{{ t('panels.equipmentHall.tabs.decompose') }}</h2>

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
/* Chrome khop card toi trong sheet moi (decompose khong co design
   rieng trong preview - dung kieu select/footer tui). */
.decompose-tab {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.equipment-forge-workspace h2 {
  font-size: 26px;
  margin: 0;
  border-bottom: 1px solid #9b7d4066;
  padding-bottom: 7px;
  line-height: 1.15;
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
  font-size: 13px;
  color: #c1b18d;
}

.decompose-tab__filter select {
  height: 29px;
  border: 1px solid #8e7440;
  background: #23251e;
  color: #eedfbf;
  font: 13px var(--font-body, Georgia, serif);
  padding: 0 8px;
}

.decompose-tab__filter input[type='range'] {
  accent-color: #d6ad5d;
}

.decompose-tab__estimate {
  margin: 0;
  color: #f3e4c4;
  font-size: 14px;
}

.decompose-tab__hint {
  margin: 0;
  padding: 10px 12px;
  border: 1px dashed #8e744066;
  border-radius: var(--radius-md, 6px);
  color: #c1b18d;
  font-size: 13px;
}

.decompose-tab__matching {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.decompose-tab__matching-title {
  margin: 0;
  color: #c1b18d;
  font-size: 12px;
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
  border: 1px solid #8e7440;
  border-radius: var(--radius-sm, 4px);
  background: #23251e;
  color: #eedfbf;
  font-size: 12px;
}
</style>
