<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import type { Quest } from '@/core/quest/Quest'
import type { QuestProgress } from '@/core/quest/QuestProgress'
import { usePlayerStore } from '@/stores/player'
import { formatNumber } from '@/core/format/NumberFormatter'
import {
  isBreakthroughAcquisitionEnabled,
  isCompanionPullTokenSourceSuppressed,
  isDomainScopedAcquisitionEnabled,
} from '@/core/realm/ReleasePolicy'

const ui = useUiStore()
const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()
const { t } = useI18n()

interface QuestRow {
  quest: Quest
  progress: QuestProgress
  targetLabel: string
  canClaim: boolean
  rewardChips: string[]
  bagShortfall: { have: number; need: number } | null
}

// ui-audit economy M6 (2026-09-28) - reward chips preview WHAT a quest
// pays. The item-drop lines are filtered by the same ReleasePolicy
// gates claimQuest applies, so a dormant drop (closed pull pool,
// gated breakthrough/domain material) never shows as a promised
// reward (A9: same predicates, never a second copy).
function rewardChips(quest: Quest): string[] {
  const chips: string[] = []
  const reward = quest.reward.reward

  if (reward?.spiritStone) {
    chips.push(t('panels.quest.rewards.spiritStone', { amount: formatNumber(reward.spiritStone) }))
  }

  if (reward?.cultivation) {
    chips.push(t('panels.quest.rewards.cultivation', { amount: formatNumber(reward.cultivation) }))
  }

  if (reward?.skillInsight) {
    chips.push(t('panels.quest.rewards.skillInsight', { amount: formatNumber(reward.skillInsight) }))
  }

  for (const drop of quest.reward.itemDrops ?? []) {
    const amount = drop.amount ?? 1

    if (drop.kind === 'material' && gameManager.materialRegistry.has(drop.itemId)) {
      const material = gameManager.materialRegistry.get(drop.itemId)

      if (!isBreakthroughAcquisitionEnabled(material.breakthroughRealmId)) continue
      if (isCompanionPullTokenSourceSuppressed(drop.itemId)) continue
      if (!isDomainScopedAcquisitionEnabled(material.domainUnlockRealmId, player.realmId)) continue

      chips.push(`${material.name} ×${formatNumber(amount)}`)
    }

    if (drop.kind === 'pill' && gameManager.pillRegistry.has(drop.itemId)) {
      const pill = gameManager.pillRegistry.get(drop.itemId)

      if (!isBreakthroughAcquisitionEnabled(pill.breakthroughRealmId)) continue

      chips.push(`${pill.name} ×${formatNumber(amount)}`)
    }
  }

  return chips
}

// Collect quests have a SECOND hidden gate: progress counting keeps
// running even after the items left the bag, so "5/5" can still refuse
// to claim because materialBag.has(id, amount) is false. Surface the
// actual bag count so the gate is legible instead of a dead button.
function collectShortfall(quest: Quest, progress: QuestProgress): { have: number; need: number } | null {
  if (quest.condition.kind !== 'collect') return null
  if (progress.claimed || progress.progress < quest.condition.amount) return null

  const have = gameManager.materialBag.getAmount(quest.condition.materialId)

  return have < quest.condition.amount ? { have, need: quest.condition.amount } : null
}

function targetLabel(quest: Quest): string {
  if (quest.condition.kind === 'collect') {
    const materialId = quest.condition.materialId
    const name = gameManager.materialRegistry.has(materialId)
      ? gameManager.materialRegistry.get(materialId).name
      : materialId

    return name
  }

  const enemyId = quest.condition.enemyId
  const enemyName = enemyId ? gameManager.catalogOps.getEnemyTemplate(enemyId)?.name ?? enemyId : t('panels.quest.anyEnemy')

  return enemyName
}

const rows = computed<QuestRow[]>(() => {
  stateVersion.value

  return gameManager.questOps.getActiveQuests().map(({ quest, progress }) => ({
    quest,
    progress,
    targetLabel: targetLabel(quest),
    canClaim: gameManager.questOps.canClaimQuest(quest.id),
    rewardChips: rewardChips(quest),
    bagShortfall: collectShortfall(quest, progress),
  }))
})

const groups = computed(() => [
  { title: t('panels.quest.groups.daily'), rows: rows.value.filter((row) => row.quest.cadence === 'daily') },
  { title: t('panels.quest.groups.once'), rows: rows.value.filter((row) => row.quest.cadence === 'once') },
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
          <li v-for="row in group.rows" :key="row.quest.id" class="quest-panel__card">
            <div class="quest-panel__info">
              <div class="quest-panel__name">{{ row.quest.name }}</div>
              <div class="quest-panel__desc">{{ row.quest.description }}</div>
              <Bar
                class="quest-panel__progress-bar"
                :value="row.progress.progress"
                :max="row.quest.condition.amount"
                :height="6"
              />
              <div class="quest-panel__progress-label">
                {{ row.targetLabel }} · {{ Math.min(row.progress.progress, row.quest.condition.amount) }}/{{ row.quest.condition.amount }}
              </div>
              <div v-if="row.rewardChips.length" class="quest-panel__rewards">
                <span v-for="(chip, chipIndex) in row.rewardChips" :key="chipIndex" class="quest-panel__reward">
                  {{ chip }}
                </span>
              </div>
              <div v-if="row.bagShortfall" class="quest-panel__shortfall">
                {{ t('panels.quest.bagShortfall', { have: row.bagShortfall.have, need: row.bagShortfall.need }) }}
              </div>
            </div>
            <GameButton
              class="quest-panel__claim"
              :disabled="row.progress.claimed || !row.canClaim"
              @click="onClaim(row.quest.id)"
            >
              {{ row.progress.claimed ? t('panels.quest.actions.claimed') : t('panels.quest.actions.claim') }}
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
