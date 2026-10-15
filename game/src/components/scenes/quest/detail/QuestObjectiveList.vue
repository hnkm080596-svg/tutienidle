<script setup lang="ts">
// Objectives section (Codex landscape port): plaque header + one
// QuestObjectiveArt row for the counted objective, plus a turn-in row
// for collect quests (required vs owned material). Same model fields
// as before - only the row shape changed.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager } from '@/composables/useGameState'
import QuestSectionPlaque from './QuestSectionPlaque.vue'
import QuestObjectiveArt from '@/components/common/art/QuestObjectiveArt.vue'
import { QUEST_FLAG_ALCHEMY_CRAFTED } from '@/core/quest/Quest'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

const props = defineProps<{ row: BetaQuestSurfaceModel }>()

const { t } = useI18n()
const gameManager = useGameManager()

// kind:'flag' targets have no material/enemy label - the flag id maps
// to a short i18n label (fallback: the raw id, which never ships for
// authored quests).
const FLAG_LABEL_KEYS: Record<string, string> = {
  [QUEST_FLAG_ALCHEMY_CRAFTED]: 'panels.quest.flags.alchemyCrafted',
}

function resolveLabel(targetLabel: string | null, flagId?: string): string {
  if (flagId) {
    const key = FLAG_LABEL_KEYS[flagId]
    return key ? t(key) : flagId
  }
  return targetLabel ?? t('panels.quest.anyEnemy')
}

function resolveTurnInLabel(materialId: string): string {
  const name = gameManager.materialRegistry.has(materialId)
    ? gameManager.materialRegistry.get(materialId).name
    : materialId
  return t('panels.quest.scene.turnIn', { name })
}

const objectiveEntries = computed(() => {
  if (props.row.objectives && props.row.objectives.length > 0) {
    return props.row.objectives.map((leaf) => ({
      id: leaf.id,
      done: leaf.progress >= leaf.target,
      label: resolveLabel(leaf.targetLabel, leaf.flagId),
      amount: `${Math.min(leaf.progress, leaf.target)} / ${leaf.target}`,
      turnIn: leaf.turnIn
        ? {
            done: leaf.turnIn.owned >= leaf.turnIn.required,
            label: resolveTurnInLabel(leaf.turnIn.materialId),
            amount: `${Math.min(leaf.turnIn.owned, leaf.turnIn.required)} / ${leaf.turnIn.required}`,
          }
        : undefined,
    }))
  }

  return [
    {
      id: 'primary',
      done: props.row.progress >= props.row.target,
      label: resolveLabel(props.row.targetLabel, props.row.flagId),
      amount: `${Math.min(props.row.progress, props.row.target)} / ${props.row.target}`,
      turnIn: props.row.turnIn
        ? {
            done: props.row.turnIn.owned >= props.row.turnIn.required,
            label: resolveTurnInLabel(props.row.turnIn.materialId),
            amount: `${Math.min(props.row.turnIn.owned, props.row.turnIn.required)} / ${props.row.turnIn.required}`,
          }
        : undefined,
    },
  ]
})
</script>

<template>
  <section class="quest-objectives">
    <QuestSectionPlaque :text="t('panels.quest.scene.objectives')" />
    <template v-for="entry in objectiveEntries" :key="entry.id">
      <QuestObjectiveArt
        :done="entry.done"
        :label="entry.label"
        :amount="entry.amount"
      />
      <QuestObjectiveArt
        v-if="entry.turnIn"
        :done="entry.turnIn.done"
        :label="entry.turnIn.label"
        :amount="entry.turnIn.amount"
      />
    </template>
  </section>
</template>

<style scoped>
.quest-objectives {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
