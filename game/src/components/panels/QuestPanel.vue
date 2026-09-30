<script setup lang="ts">
// BETA FE-CONTRACT (work-order sec.4B): renders the canonical
// BetaQuestSurfaceModel rows via questOps - reward admission, target
// labels, the collect shortfall and claimability all resolve inside
// the domain model. The panel maps verdict -> i18n label / CSS class
// and never rebuilds release gating or reward admission itself.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
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
  <OverlayPanel :open="ui.standalonePanel === 'quest'" :title="t('panels.quest.title')" width="min(760px, 94vw)" height="min(640px, 88vh)" @close="close">
    <template #header-actions>
      <GameButton variant="ghost" size="sm" @click="close">
        {{ t('panels.common.close') }}
      </GameButton>
    </template>

    <div class="quest-panel">
      <section v-for="group in groups" v-show="group.rows.length" :key="group.title" class="quest-panel__section">
        <h4 class="quest-panel__section-title">{{ group.title }}</h4>
        <ul class="quest-panel__list">
          <li v-for="row in group.rows" :key="row.id" class="quest-panel__card">
            <div class="quest-panel__info">
              <div class="quest-panel__name">{{ row.name }}</div>
              <div class="quest-panel__desc">{{ row.description }}</div>
              <Bar
                class="quest-panel__progress-bar"
                :value="row.progress"
                :max="row.target"
                :height="6"
              />
              <div class="quest-panel__progress-label">
                {{ targetLabel(row) }} · {{ Math.min(row.progress, row.target) }}/{{ row.target }}
              </div>
              <div v-if="rewardChips(row).length" class="quest-panel__rewards">
                <span v-for="(chip, chipIndex) in rewardChips(row)" :key="chipIndex" class="quest-panel__reward">
                  {{ chip }}
                </span>
              </div>
              <div v-if="bagShortfall(row)" class="quest-panel__shortfall">
                {{ t('panels.quest.bagShortfall', { have: bagShortfall(row)!.have, need: bagShortfall(row)!.need }) }}
              </div>
            </div>
            <GameButton
              class="quest-panel__claim"
              :disabled="row.claim.claimed || !row.claim.available"
              @click="onClaim(row.id)"
            >
              {{ row.claim.claimed ? t('panels.quest.actions.claimed') : t('panels.quest.actions.claim') }}
            </GameButton>
          </li>
        </ul>
      </section>

      <EmptyState v-if="!rows.length">{{ t('panels.quest.empty') }}</EmptyState>
    </div>
  </OverlayPanel>
</template>

<style scoped>
.quest-panel { display: flex; flex-direction: column; gap: 20px; height: 100%; min-height: 0; padding: 16px 18px; overflow-y: auto; }
.quest-panel__section-title { margin: 0 0 10px; color: var(--paper-eyebrow); font: 700 var(--text-md) var(--font-display); letter-spacing: .04em; }
.quest-panel__list { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.quest-panel__card { display: flex; align-items: center; gap: 14px; padding: 12px 14px; background: var(--ink-800); border: 1px solid var(--ink-line-soft); border-radius: var(--radius-sm); }
.quest-panel__info { flex: 1 1 auto; min-width: 0; }
.quest-panel__name { color: var(--text-primary); font-weight: 600; }
.quest-panel__desc { margin-top: 2px; color: var(--text-secondary); font-size: var(--text-body); }
.quest-panel__progress-bar { margin-top: 8px; border-radius: 3px; --bar-track: var(--ink-950); --bar-from: var(--chrome-300); --bar-to: var(--chrome-300); }
.quest-panel__progress-label { margin-top: 4px; color: var(--text-secondary); font-size: var(--text-sm); }
.quest-panel__rewards { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.quest-panel__reward { padding: 2px 8px; border: 1px solid var(--ink-line-soft); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--mineral-gold) 12%, var(--ink-900)); color: var(--mineral-gold); font-size: var(--text-xs); }
.quest-panel__shortfall { margin-top: 6px; color: var(--cinnabar); font-size: var(--text-xs); }
.quest-panel__claim { flex: 0 0 auto; }
.quest-panel__claim:disabled { color: var(--text-secondary); background: var(--ink-700, var(--ink-800)); }
</style>
