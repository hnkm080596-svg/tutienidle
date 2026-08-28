<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import Bar from '@/components/common/primitives/Bar.vue'
import type { Quest } from '@/core/quest/Quest'
import type { QuestProgress } from '@/core/quest/QuestProgress'

const ui = useUiStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()

interface QuestRow {
  quest: Quest
  progress: QuestProgress
  targetLabel: string
  canClaim: boolean
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
  const enemyName = enemyId ? gameManager.getEnemyTemplate(enemyId)?.name ?? enemyId : 'Bất kỳ quái'

  return enemyName
}

const rows = computed<QuestRow[]>(() => {
  stateVersion.value

  return gameManager.getActiveQuests().map(({ quest, progress }) => ({
    quest,
    progress,
    targetLabel: targetLabel(quest),
    canClaim: gameManager.canClaimQuest(quest.id),
  }))
})

const groups = computed(() => [
  { title: 'Nhiệm Vụ Hàng Ngày', rows: rows.value.filter((row) => row.quest.cadence === 'daily') },
  { title: 'Nhiệm Vụ', rows: rows.value.filter((row) => row.quest.cadence === 'once') },
])

function onClaim(questId: string) {
  if (gameManager.claimQuest(questId)) {
    bumpState()
  }
}

function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <OverlayPanel :open="ui.standalonePanel === 'quest'" title="Nhiệm Vụ" width="min(760px, 94vw)" height="min(640px, 88vh)" @close="close">
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
            </div>
            <button
              type="button"
              class="quest-panel__claim"
              :disabled="row.progress.claimed || !row.canClaim"
              @click="onClaim(row.quest.id)"
            >
              {{ row.progress.claimed ? 'Đã Nhận' : 'Nhận Thưởng' }}
            </button>
          </li>
        </ul>
      </section>

      <p v-if="!rows.length" class="quest-panel__empty">Chưa có nhiệm vụ nào khả dụng.</p>
    </div>
  </OverlayPanel>
</template>

<style scoped>
.quest-panel { display: flex; flex-direction: column; gap: 20px; padding: 16px 18px; }
.quest-panel__section-title { margin: 0 0 10px; color: var(--chrome-100); font: 700 var(--text-md) var(--font-display); letter-spacing: .04em; }
.quest-panel__list { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.quest-panel__card { display: flex; align-items: center; gap: 14px; padding: 12px 14px; background: var(--ink-800); border: 1px solid var(--ink-line-soft); border-radius: var(--radius-sm); }
.quest-panel__info { flex: 1 1 auto; min-width: 0; }
.quest-panel__name { color: var(--text-primary); font-weight: 600; }
.quest-panel__desc { margin-top: 2px; color: var(--text-secondary); font-size: var(--text-body); }
.quest-panel__progress-bar { margin-top: 8px; border-radius: 3px; --bar-track: var(--ink-950); --bar-from: var(--chrome-300); --bar-to: var(--chrome-300); }
.quest-panel__progress-label { margin-top: 4px; color: var(--text-secondary); font-size: var(--text-sm); }
.quest-panel__claim { flex: 0 0 auto; padding: 8px 16px; min-height: var(--tap-min); color: var(--ink-950); font-weight: 700; background: linear-gradient(180deg, var(--chrome-100), var(--chrome-500)); border: none; border-radius: var(--radius-sm); cursor: pointer; }
.quest-panel__claim:disabled { color: var(--text-secondary); background: var(--ink-700, var(--ink-800)); cursor: default; }
.quest-panel__empty { color: var(--text-secondary); text-align: center; padding: 24px 0; }
</style>
