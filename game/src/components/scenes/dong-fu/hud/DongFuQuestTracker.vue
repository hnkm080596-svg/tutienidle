<script setup lang="ts">
// Quest tracker chip (scene 03 spec region `quest-tracker`): a
// bottom-right chip reading the CANONICAL quest surface model
// (questOps.getBetaQuestSurfaceModels - beta-admitted once-quests only,
// rewards/claimability already derived). No new navigation path: the
// CTA opens the existing QuestPanel via ui.openStandalonePanel('quest').
// Renders nothing when the surface is empty (spec: "always when quests
// exist"). Temporary CSS art (art inventory 03-dong-fu).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'

const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const ui = useUiStore()

// Claimable quests outrank in-progress ones; otherwise the first surface
// row (registry order) leads the chip.
const tracked = computed(() => {
  stateVersion.value
  const models = gameManager.questOps.getBetaQuestSurfaceModels()
  return models.find((model) => model.claim.available) ?? models[0]
})
</script>

<template>
  <button
    v-if="tracked"
    type="button"
    class="quest-tracker"
    :class="{ 'is-claimable': tracked.claim.available }"
    data-hk-region="quest-tracker"
    art-needed
    data-art-id="quest-tracker-chip"
    :aria-label="t('home.questTracker.aria', { name: tracked.name })"
    @click="ui.openStandalonePanel('quest')"
  >
    <HuyenKimSymbol name="quest" class="quest-tracker__icon" />
    <span class="quest-tracker__name">{{ tracked.name }}</span>
    <span class="quest-tracker__progress">
      {{ Math.min(tracked.progress, tracked.target) }}/{{ tracked.target }}
    </span>
  </button>
</template>

<style scoped>
/* Spec quest-tracker 1232/872/424/48: right 16, bottom 21, w <= 424
   design px on the 1672x941 canvas. */
.quest-tracker {
  position: absolute;
  right: 0.96vw;
  bottom: 2.23vh;
  z-index: 9;
  display: inline-flex;
  align-items: center;
  gap: var(--hk-space-2, 6px);
  max-width: min(25.36vw, 424px);
  padding: var(--hk-space-2, 6px) var(--hk-space-4, 12px);
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: 999px;
  background: color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 78%, transparent);
  box-shadow: 0 8px 24px var(--hk-shadow-low, rgba(0, 0, 0, 0.4));
  color: var(--hk-text-primary, #ede6d6);
  font-family: var(--hk-font-ui, sans-serif);
  font-size: var(--text-xs, 11px);
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.quest-tracker:hover,
.quest-tracker:focus-visible {
  border-color: var(--hk-border-active, #7a6234);
}

.quest-tracker:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--hk-glow-gold, rgba(232, 195, 90, 0.35));
}

.quest-tracker.is-claimable {
  border-color: var(--hk-gold, #c99a4a);
  box-shadow: 0 0 14px var(--hk-glow-gold, rgba(232, 195, 90, 0.35));
}

.quest-tracker__icon {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  color: var(--hk-gold, #c99a4a);
}

.quest-tracker__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quest-tracker__progress {
  flex: 0 0 auto;
  color: var(--hk-text-secondary, #b8ae97);
  font-variant-numeric: tabular-nums;
}

.quest-tracker.is-claimable .quest-tracker__progress {
  color: var(--hk-gold-bright, #e8c35a);
  font-weight: 700;
}
</style>
