<script setup lang="ts">
// Quest list (spec region quest-list, 620 x 540): scrollfade column of
// quest rows. The spec's empty-state region sits on the detail side
// (924/380) - QuestDetailPanel owns it.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import QuestRow from './QuestRow.vue'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

const props = defineProps<{
  rows: readonly BetaQuestSurfaceModel[]
  selectedId: string | null
  onSelect: (id: string) => void
}>()

const { t } = useI18n()

// Chinh Tuyen divider above the first chain row - mainline members
// emit in walk order at the head of the model list.
const firstChainRowId = computed(
  () => props.rows.find((row) => row.chainId === 'mainline')?.id ?? null,
)
</script>

<template>
  <section class="quest-list" data-hk-region="quest-list" :aria-label="t('panels.quest.scene.railAria')">
    <ul class="quest-list__rows">
      <template v-for="row in rows" :key="row.id">
        <li v-if="row.id === firstChainRowId" class="quest-list__group" aria-hidden="true">
          {{ t('panels.quest.groups.mainline') }}
        </li>
        <li>
          <QuestRow
            :row="row"
            :selected="row.id === selectedId"
            :on-select="() => onSelect(row.id)"
          />
        </li>
      </template>
    </ul>
  </section>
</template>

<style scoped>
.quest-list {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.quest-list__rows {
  margin: 0;
  padding: 2px 4px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(180deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
}
.quest-list__rows::-webkit-scrollbar { display: none; }

.quest-list__group {
  font: 700 var(--text-xs, 10px) var(--hk-font-display, var(--font-display));
  letter-spacing: 0.14em;
  color: var(--hk-gold-muted, #b99a55);
  padding: 2px 10px 0;
}

</style>
