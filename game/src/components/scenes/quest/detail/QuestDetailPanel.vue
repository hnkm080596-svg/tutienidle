<script setup lang="ts">
// Detail panel (spec region detail-panel, 608 x 610): surface-m-panel
// holding the ref's right column - cadence-ribbon vista, quest name,
// description, the Muc Tieu Nhiem Vu checklist, the Thuong Nhiem Vu
// reward row, and the claim CTA. The ref's "Loi Dan" flavor quote has
// no model field (not rendered); its "Tiep Tuc" deep-link stays
// RESERVED (audit) - claim is the only CTA.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import { chromeSlice } from '@/ui/huyenKimChrome'
import QuestDetailVista from './QuestDetailVista.vue'
import QuestObjectiveList from './QuestObjectiveList.vue'
import QuestRewardRow from './QuestRewardRow.vue'
import QuestClaimCta from './QuestClaimCta.vue'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

defineProps<{
  row: BetaQuestSurfaceModel | null
  onClaim: (questId: string) => void
}>()

const { t } = useI18n()
const panelSlice = computed(() => chromeSlice('surface-m-panel'))
const headSlice = computed(() => chromeSlice('entity-bar'))
</script>

<template>
  <section class="quest-detail" data-hk-region="detail-panel">
    <InkNineSlice
      chrome-id="surface-m-panel"
      layer="surface"
      class="quest-detail__surface"
      :art-needed="!panelSlice || undefined"
      data-art-id="surface-m-panel"
    />

    <template v-if="row">
      <div class="quest-detail__scroll">
        <QuestDetailVista :row="row" />

        <div class="quest-detail__head">
          <InkNineSlice
            chrome-id="entity-bar"
            layer="surface"
            class="quest-detail__head-surface"
            :art-needed="!headSlice || undefined"
            data-art-id="entity-bar"
          />
          <h2 class="quest-detail__name">{{ row.name }}</h2>
        </div>

        <p class="quest-detail__desc">{{ row.description }}</p>

        <QuestObjectiveList :row="row" />
        <QuestRewardRow :row="row" />
      </div>

      <QuestClaimCta :row="row" :on-claim="onClaim" />
    </template>

    <EmptyState v-else class="quest-detail__empty" size="lg" framed data-hk-region="empty-state">
      {{ t('panels.quest.empty') }}
    </EmptyState>
  </section>
</template>

<style scoped>
.quest-detail {
  position: relative;
  isolation: isolate;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px 16px 16px;
  border-radius: var(--hk-radius-lg, 10px);
}
.quest-detail > :not(.ink-nine-slice) { position: relative; z-index: 1; }

.quest-detail__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
  mask-image: linear-gradient(180deg, #000 0, #000 calc(100% - 16px), transparent 100%);
}
.quest-detail__scroll::-webkit-scrollbar { display: none; }

.quest-detail__head {
  position: relative;
  isolation: isolate;
  padding: 4px 10px;
  border-radius: var(--hk-radius-sm, 5px);
}

.quest-detail__name {
  position: relative;
  z-index: 1;
  margin: 0;
  font: 700 var(--text-lg) var(--hk-font-display, var(--font-display));
  letter-spacing: 0.04em;
  color: var(--hk-text-primary, var(--paper-text));
}

.quest-detail__desc {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--hk-text-secondary, var(--paper-text-soft));
}

.quest-detail__empty {
  margin: auto;
}
</style>
