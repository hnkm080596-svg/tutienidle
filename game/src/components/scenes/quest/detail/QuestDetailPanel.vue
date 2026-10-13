<script setup lang="ts">
// Detail column (Codex landscape port): inside the right
// EquipmentArtCard - vista banner, description, objective rows,
// progress meter, rewards grid and the gold claim button at the
// bottom. The ref's "Loi Dan" flavor quote has no model field (not
// rendered); its "Tiep Tuc" deep-link stays RESERVED (audit) - claim
// is the only CTA.
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import QuestDetailVista from './QuestDetailVista.vue'
import QuestObjectiveList from './QuestObjectiveList.vue'
import QuestProgressMeter from './QuestProgressMeter.vue'
import QuestRewardRow from './QuestRewardRow.vue'
import QuestClaimCta from './QuestClaimCta.vue'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

defineProps<{
  row: BetaQuestSurfaceModel | null
  onlyLocked?: boolean
  onClaim: (questId: string) => void
}>()

const { t } = useI18n()
</script>

<template>
  <section class="quest-detail" data-hk-region="detail-panel">
    <template v-if="row">
      <div class="quest-detail__scroll">
        <QuestDetailVista :row="row" />
        <p class="quest-detail__desc">{{ row.description }}</p>
        <QuestObjectiveList :row="row" />
        <QuestProgressMeter :row="row" />
        <QuestRewardRow :row="row" />
      </div>

      <QuestClaimCta :row="row" :on-claim="onClaim" />
    </template>

    <EmptyState v-else class="quest-detail__empty" size="lg" framed data-hk-region="empty-state">
      {{ t(onlyLocked ? 'panels.quest.lockedDetail' : 'panels.quest.empty') }}
    </EmptyState>
  </section>
</template>

<style scoped>
.quest-detail {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #efdfb9;
}

.quest-detail__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.quest-detail__scroll::-webkit-scrollbar { display: none; }

.quest-detail__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
}

.quest-detail__empty {
  margin: auto;
}
</style>
