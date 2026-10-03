<script setup lang="ts">
// "Muc Tieu Nhiem Vu" checklist per the ref: one row for the counted
// objective (target label + n/m + check), plus a turn-in row for
// collect quests (required vs owned material).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager } from '@/composables/useGameState'
import QuestSectionPlaque from './QuestSectionPlaque.vue'
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
const targetLabel = computed(() => {
  if (props.row.flagId) {
    const key = FLAG_LABEL_KEYS[props.row.flagId]
    return key ? t(key) : props.row.flagId
  }
  return props.row.targetLabel ?? t('panels.quest.anyEnemy')
})

// Turn-in material name resolves through the material registry the same
// way other panels do (has() + get() - display only).
const turnInName = computed(() => {
  const turnIn = props.row.turnIn
  if (!turnIn) return ''
  return gameManager.materialRegistry.has(turnIn.materialId)
    ? gameManager.materialRegistry.get(turnIn.materialId).name
    : turnIn.materialId
})
const turnInDone = computed(
  () => (props.row.turnIn?.owned ?? 0) >= (props.row.turnIn?.required ?? 1),
)
</script>

<template>
  <section class="quest-objectives">
    <QuestSectionPlaque :text="t('panels.quest.scene.objectives')" />
    <ul class="quest-objectives__rows">
      <li class="quest-objectives__row" :class="{ 'is-done': objectiveDone }">
        <span class="quest-objectives__check" aria-hidden="true">{{ objectiveDone ? '✓' : '' }}</span>
        <span class="quest-objectives__label">{{ targetLabel }}</span>
        <span class="quest-objectives__count">{{ Math.min(row.progress, row.target) }}/{{ row.target }}</span>
      </li>

      <li v-if="row.turnIn" class="quest-objectives__row" :class="{ 'is-done': turnInDone }">
        <span class="quest-objectives__check" aria-hidden="true">{{ turnInDone ? '✓' : '' }}</span>
        <span class="quest-objectives__label">{{ t('panels.quest.scene.turnIn', { name: turnInName }) }}</span>
        <span class="quest-objectives__count">{{ Math.min(row.turnIn.owned, row.turnIn.required) }}/{{ row.turnIn.required }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.quest-objectives {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quest-objectives__rows {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quest-objectives__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border: 1px solid var(--hk-border-muted, var(--paper-line));
  border-radius: var(--hk-radius-sm, 5px);
  background: color-mix(in srgb, var(--hk-ink, #101718) 24%, transparent);
}

.quest-objectives__row.is-done {
  border-color: color-mix(in srgb, var(--hk-jade, #315f55) 80%, transparent);
}

.quest-objectives__check {
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border: 1px solid var(--hk-border-muted, var(--paper-line));
  border-radius: 50%;
  color: var(--hk-jade-soft, #8fb8a8);
  font-size: var(--text-xs);
  font-weight: 700;
}
.quest-objectives__row.is-done .quest-objectives__check {
  border-color: var(--hk-jade, #315f55);
  background: color-mix(in srgb, var(--hk-jade, #315f55) 35%, transparent);
}

.quest-objectives__label {
  font-size: var(--text-sm);
  color: var(--hk-text-secondary, var(--paper-text-soft));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quest-objectives__count {
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--hk-text-muted, #b8ad97);
}
.quest-objectives__row.is-done .quest-objectives__count { color: var(--hk-jade-soft, #8fb8a8); }
</style>
