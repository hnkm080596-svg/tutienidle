<script setup lang="ts">
// BETA FE-CONTRACT (work-order sec.4B): renders the canonical
// BetaQuestSurfaceModel rows via questOps - reward admission, target
// labels, the collect shortfall and claimability all resolve inside
// the domain model. The panel maps verdict -> i18n label / CSS class
// and never rebuilds release gating or reward admission itself.
//
// Huyen Kim scene 18: quest list rail (left) + selected quest detail
// (right) inside the imperial scroll shell. Cadence grouping stays
// model-driven - beta admits once-quests only, and hidden cadences
// never render a placeholder.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import ImperialScrollScene from '@/components/common/ImperialScrollScene.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'
import { formatNumber } from '@/core/format/NumberFormatter'

const ui = useUiStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const { t } = useI18n()

// ui-audit economy M6 (2026-09-28) - reward chips preview WHAT a quest
// pays. The model emits admitted lines only; this maps each entry to
// its i18n chip - it does NOT decide admission.
function rewardChips(model: BetaQuestSurfaceModel): string[] {
  return model.rewards.map((entry) => {
    if (entry.kind === 'material' || entry.kind === 'pill') {
      return `${entry.name ?? entry.itemId ?? ''} ×${formatNumber(entry.amount)}`
    }

    return t(`panels.quest.rewards.${entry.kind}`, { amount: formatNumber(entry.amount) })
  })
}

// Collect quests have a SECOND gate: progress counting keeps running
// even after the items left the bag, so "5/5" can still refuse to
// claim. The model resolves the shortfall; the panel renders it.
function bagShortfall(model: BetaQuestSurfaceModel): { have: number; need: number } | null {
  if (model.claim.disabledReason !== 'missing-turnin-items' || !model.turnIn) {
    return null
  }

  return { have: model.turnIn.owned, need: model.turnIn.required }
}

function targetLabel(model: BetaQuestSurfaceModel): string {
  return model.targetLabel ?? t('panels.quest.anyEnemy')
}

const rows = computed(() => {
  stateVersion.value

  return gameManager.questOps.getBetaQuestSurfaceModels()
})

// Beta admits once-quests only (the model's cadence is 'once') - a
// single group; the template groups stay for post-beta reopening.
const groups = computed(() => [
  { title: t('panels.quest.groups.once'), rows: rows.value },
])

// Scene 18: left rail selects the quest, right panel owns the detail.
const selectedQuestId = ref<string | null>(null)
const selectedRow = computed(
  () => rows.value.find(row => row.id === selectedQuestId.value) ?? null,
)

watch(rows, list => {
  if (!list.some(row => row.id === selectedQuestId.value)) {
    selectedQuestId.value = list[0]?.id ?? null
  }
}, { immediate: true })

function onClaim(questId: string) {
  if (gameManager.questOps.claimQuest(questId)) {
    bumpState()
  }
}

function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <ImperialScrollScene
    scene="quest" :open="ui.standalonePanel === 'quest'" :title="t('panels.quest.title')" @close="close">
    <div class="quest-scene">
      <!-- Left rail: cadence group + quest entries -->
      <div v-show="rows.length" class="quest-scene__rail">
        <section v-for="group in groups" v-show="group.rows.length" :key="group.title" class="quest-scene__section">
          <h4 class="quest-scene__section-title">{{ group.title }}</h4>
          <ul class="quest-scene__list">
            <li v-for="row in group.rows" :key="row.id">
              <button
                type="button"
                class="quest-scene__entry"
                :class="{ 'is-selected': row.id === selectedQuestId, 'is-claimable': row.claim.available && !row.claim.claimed }"
                @click="selectedQuestId = row.id"
              >
                <InkNineSlice chrome-id="list-row" layer="surface" />
                <span class="quest-scene__entry-name">{{ row.name }}</span>
                <span class="quest-scene__entry-progress">{{ Math.min(row.progress, row.target) }}/{{ row.target }}</span>
              </button>
            </li>
          </ul>
        </section>

      </div>

      <!-- Empty state spans the whole content grid (both rail and detail
           are pointless surfaces when the model emits no rows). -->
      <EmptyState v-if="!rows.length" class="quest-scene__empty">{{ t('panels.quest.empty') }}</EmptyState>

      <!-- Right: selected quest detail (description/objective/progress/
           reward/claim - all canonical model fields). -->
      <div v-if="selectedRow" class="quest-scene__detail">
        <h3 class="quest-scene__name">{{ selectedRow.name }}</h3>
        <p class="quest-scene__desc">{{ selectedRow.description }}</p>
        <Bar
          class="quest-scene__progress-bar"
          :value="selectedRow.progress"
          :max="selectedRow.target"
          :height="8"
        />
        <div class="quest-scene__progress-label">
          {{ targetLabel(selectedRow) }} · {{ Math.min(selectedRow.progress, selectedRow.target) }}/{{ selectedRow.target }}
        </div>
        <div v-if="rewardChips(selectedRow).length" class="quest-scene__rewards">
          <span v-for="(chip, chipIndex) in rewardChips(selectedRow)" :key="chipIndex" class="quest-scene__reward">
            {{ chip }}
          </span>
        </div>
        <div v-if="bagShortfall(selectedRow)" class="quest-scene__shortfall">
          {{ t('panels.quest.bagShortfall', { have: bagShortfall(selectedRow)!.have, need: bagShortfall(selectedRow)!.need }) }}
        </div>
        <GameButton
          class="quest-scene__claim"
          :disabled="selectedRow.claim.claimed || !selectedRow.claim.available"
          @click="onClaim(selectedRow.id)"
        >
          {{ selectedRow.claim.claimed ? t('panels.quest.actions.claimed') : t('panels.quest.actions.claim') }}
        </GameButton>
      </div>
    </div>
  </ImperialScrollScene>
</template>

<style scoped>
/* Spec 18: list rail | detail panel inside the scroll content grid. */
.quest-scene {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(0, 1.6fr);
  gap: 18px;
  padding: 6px 2px;
}
.quest-scene__rail {
  min-height: 0;
  overflow-y: auto;
  mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%);
  padding: 4px 6px;
}
.quest-scene__section-title { margin: 0 0 10px; color: var(--hk-text-muted, var(--paper-eyebrow)); font: 700 var(--text-md) var(--font-display); letter-spacing: .04em; }
.quest-scene__list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
/* list-row chrome: the PNG row surface carries the base fill; state
   borders still paint over it so selected/claimable read unchanged. */
.quest-scene__entry {
  position: relative;
  isolation: isolate;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: var(--hk-surface-raised, var(--ink-800));
  border: 1px solid var(--hk-border-muted, var(--ink-line-soft));
  border-radius: var(--hk-radius-md, var(--radius-sm));
  color: var(--hk-text-secondary, var(--text-secondary));
  font-family: var(--font-body);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--hk-motion-micro, 150ms) var(--hk-ease-standard, ease);
}
.quest-scene__entry .ink-nine-slice { z-index: 0; }
.quest-scene__entry > :not(.ink-nine-slice) { position: relative; z-index: 1; }
.quest-scene__entry:hover { border-color: var(--hk-border-active, var(--ink-line)); }
.quest-scene__entry.is-selected { border-color: var(--hk-jade, var(--jade)); color: var(--hk-text-primary, var(--text-primary)); }
.quest-scene__entry.is-claimable .quest-scene__entry-progress { color: var(--hk-gold, var(--mineral-gold)); }
.quest-scene__entry-name { font-weight: 600; }
.quest-scene__entry-progress { font-size: var(--text-xs); font-variant-numeric: tabular-nums; color: var(--hk-text-muted, var(--text-muted)); }

.quest-scene__detail {
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  background: var(--hk-surface-raised, var(--ink-800));
  border: 1px solid var(--hk-border-muted, var(--ink-line-soft));
  border-radius: var(--hk-radius-md, var(--radius-sm));
}
.quest-scene__name { margin: 0; color: var(--hk-text-primary, var(--text-primary)); font: 700 var(--text-title) var(--font-display); }
.quest-scene__desc { margin: 6px 0 0; color: var(--hk-text-secondary, var(--text-secondary)); font-size: var(--text-body); }
.quest-scene__progress-bar { width: 100%; margin-top: 14px; border-radius: 3px; --bar-track: var(--hk-surface-base, var(--ink-950)); --bar-from: var(--chrome-300); --bar-to: var(--chrome-300); }
.quest-scene__progress-label { margin-top: 6px; color: var(--hk-text-secondary, var(--text-secondary)); font-size: var(--text-sm); }
.quest-scene__rewards { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
.quest-scene__reward { padding: 2px 8px; border: 1px solid var(--hk-border-muted, var(--ink-line-soft)); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--hk-gold, var(--mineral-gold)) 12%, var(--hk-surface-base, var(--ink-900))); color: var(--hk-gold, var(--mineral-gold)); font-size: var(--text-xs); }
.quest-scene__shortfall { margin-top: 8px; color: var(--cinnabar); font-size: var(--text-xs); }
.quest-scene__claim { margin-top: auto; }
.quest-scene__claim:disabled { color: var(--text-secondary); background: var(--ink-700, var(--ink-800)); }
.quest-scene__empty { grid-column: 1 / -1; align-self: center; justify-self: center; }

@container (max-width: 860px) {
  .quest-scene { grid-template-columns: 1fr; grid-template-rows: auto 1fr; overflow-y: auto; }
}
</style>
