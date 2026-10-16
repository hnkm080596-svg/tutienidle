<script setup lang="ts">
// Group tabs (spec region group-tabs, above the list): uses GameTabButton
// for Tat Ca + one tab button per cadence actually emitted.
import { useI18n } from 'vue-i18n'
import GameTabButton from '@/components/common/GameTabButton.vue'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

defineProps<{
  cadences: readonly BetaQuestSurfaceModel['cadence'][]
  active: string
  onSelect: (id: string) => void
}>()

const { t } = useI18n()
</script>

<template>
  <nav class="quest-group-tabs" data-hk-region="group-tabs" :aria-label="t('panels.quest.scene.tabsAria')">
    <GameTabButton
      class="quest-group-tabs__pill"
      :class="{ 'is-active': active === 'all' }"
      :selected="active === 'all'"
      @click="onSelect('all')"
    >
      <span class="quest-group-tabs__label">{{ t('panels.quest.tabs.all') }}</span>
    </GameTabButton>

    <GameTabButton
      v-for="cadence in cadences"
      :key="cadence"
      class="quest-group-tabs__pill"
      :class="{ 'is-active': active === cadence }"
      :selected="active === cadence"
      @click="onSelect(cadence)"
    >
      <span class="quest-group-tabs__label">{{ t(`panels.quest.cadence.${cadence}`) }}</span>
    </GameTabButton>
  </nav>
</template>

<style scoped>
.quest-group-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 34px;
}
</style>
