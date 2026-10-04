<script setup lang="ts">
// Group tabs (spec region group-tabs, 620 x 44 above the list): the
// ref's pill strip (Tat Ca | Chinh Tuyen | Phu Tuyen | Ngay | Tuan).
// The model only carries cadence - beta admits 'once' alone, so the
// strip renders Tat Ca + one pill per cadence actually emitted; the
// ref's category pills (main/side/achievement) have no model source and
// stay RESERVED (audit - not rendered). seal-chip chrome (flat pill
// edges) - tab-seal's beveled seal silhouette rendered as clipped/vat
// corners when squashed to pill height (QA flag: mep pill bi cut).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { chromeSlice } from '@/ui/huyenKimChrome'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

defineProps<{
  cadences: readonly BetaQuestSurfaceModel['cadence'][]
  active: string
  onSelect: (id: string) => void
}>()

const { t } = useI18n()
const tabSlice = computed(() => chromeSlice('seal-chip'))
</script>

<template>
  <nav class="quest-group-tabs" data-hk-region="group-tabs" :aria-label="t('panels.quest.scene.tabsAria')">
    <button
      type="button"
      class="quest-group-tabs__pill"
      :class="{ 'is-active': active === 'all' }"
      :aria-pressed="active === 'all'"
      @click="onSelect('all')"
    >
      <InkNineSlice
        chrome-id="seal-chip"
        layer="surface"
        class="quest-group-tabs__chrome"
        :art-needed="!tabSlice || undefined"
        data-art-id="seal-chip"
      />
      <span class="quest-group-tabs__label">{{ t('panels.quest.tabs.all') }}</span>
    </button>

    <button
      v-for="cadence in cadences"
      :key="cadence"
      type="button"
      class="quest-group-tabs__pill"
      :class="{ 'is-active': active === cadence }"
      :aria-pressed="active === cadence"
      @click="onSelect(cadence)"
    >
      <InkNineSlice
        chrome-id="seal-chip"
        layer="surface"
        class="quest-group-tabs__chrome"
        :art-needed="!tabSlice || undefined"
        data-art-id="seal-chip"
      />
      <span class="quest-group-tabs__label">{{ t(`panels.quest.cadence.${cadence}`) }}</span>
    </button>
  </nav>
</template>

<style scoped>
.quest-group-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
}

.quest-group-tabs__pill {
  position: relative;
  isolation: isolate;
  padding: 5px 18px;
  border: 0;
  border-radius: var(--hk-radius-pill, 999px);
  background: transparent;
  color: var(--hk-text-muted, #b8ad97);
  font: 600 var(--text-sm) var(--hk-font-display, var(--font-display));
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: color 0.15s ease;
}
.quest-group-tabs__pill > :not(.ink-nine-slice) { position: relative; z-index: 1; }

.quest-group-tabs__pill:hover { color: var(--hk-text-primary, #f2ead8); }
.quest-group-tabs__pill.is-active { color: var(--hk-gold, #e3bd67); }

.quest-group-tabs__pill:focus-visible {
  outline: 2px solid var(--hk-gold, #d8b45a);
  outline-offset: 2px;
}
</style>
