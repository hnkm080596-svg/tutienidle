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

const objectiveDone = computed(() => props.row.progress >= props.row.target)
const objectiveLabel = computed(() => {
  if (props.row.flagId) {
    const key = FLAG_LABEL_KEYS[props.row.flagId]
    return key ? t(key) : props.row.flagId
  }
  return props.row.targetLabel ?? t('panels.quest.anyEnemy')
})
const objectiveAmount = computed(
  () => `${Math.min(props.row.progress, props.row.target)} / ${props.row.target}`,
)

// Turn-in material name resolves through the material registry the same
// way other panels do (has() + get() - display only).
const turnInName = computed(() => {
  const turnIn = props.row.turnIn
  if (!turnIn) return ''
  return gameManager.materialRegistry.has(turnIn.materialId)
    ? gameManager.materialRegistry.get(turnIn.materialId).name
    : turnIn.materialId
})
const turnInLabel = computed(() => t('panels.quest.scene.turnIn', { name: turnInName.value }))
const turnInAmount = computed(() => {
  const turnIn = props.row.turnIn
  if (!turnIn) return ''
  return `${Math.min(turnIn.owned, turnIn.required)} / ${turnIn.required}`
})
const turnInDone = computed(
  () => (props.row.turnIn?.owned ?? 0) >= (props.row.turnIn?.required ?? 1),
)
</script>

<template>
  <section class="quest-objectives">
    <QuestSectionPlaque :text="t('panels.quest.scene.objectives')" />
    <QuestObjectiveArt
      :done="objectiveDone"
      :label="objectiveLabel"
      :amount="objectiveAmount"
    />
    <QuestObjectiveArt
      v-if="row.turnIn"
      :done="turnInDone"
      :label="turnInLabel"
      :amount="turnInAmount"
    />
  </section>
</template>

<style scoped>
.quest-objectives {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
