<script setup lang="ts">
// Utility seals (scene 03 spec region `utility-seals`, right end of the
// top bar): auto-farm indicator plus three icon-only round seals -
// feedback (dialog teleported to body), bag, settings. S03 spec: the
// seals announce via aria-label and collapse their label text so the
// cluster never overflows the viewport edge.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import AutoFarmIndicator from '@/components/game/AutoFarmIndicator.vue'
import GameButton from '@/components/common/GameButton.vue'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import FeedbackDialog from '@/components/common/FeedbackDialog.vue'

const { t } = useI18n()
const ui = useUiStore()

const feedbackOpen = ref(false)
</script>

<template>
  <div class="global-top-bar__utilities" data-hk-region="utility-seals">
    <AutoFarmIndicator art-needed data-art-id="auto-farm-chip" />
    <GameButton
      shape="circle"
      size="sm"
      variant="ghost"
      class="global-top-bar__seal"
      art-needed
      data-art-id="icon-button-utility"
      :aria-label="t('home.topBar.feedbackAria')"
      @click="feedbackOpen = true"
    >
      <HuyenKimSymbol name="feedback" />
      {{ t('home.topBar.feedback') }}
    </GameButton>
    <GameButton
      shape="circle"
      size="sm"
      variant="ghost"
      class="global-top-bar__seal"
      art-needed
      data-art-id="icon-button-utility"
      :aria-label="t('home.topBar.bagAria')"
      @click="ui.openLeftPanel('inventory')"
    >
      <HuyenKimSymbol name="inventory" />
      {{ t('home.topBar.bag') }}
    </GameButton>
    <GameButton
      shape="circle"
      size="sm"
      variant="ghost"
      class="global-top-bar__seal"
      art-needed
      data-art-id="icon-button-utility"
      :aria-label="t('home.topBar.settingsAria')"
      @click="ui.openLeftPanel('settings')"
    >
      <HuyenKimSymbol name="settings" />
      {{ t('home.topBar.settings') }}
    </GameButton>
  </div>

  <!-- Mail/feedback utility - dialog teleports to body so the overlay
       scrim covers the viewport, not just this bar. -->
  <Teleport to="body">
    <FeedbackDialog :open="feedbackOpen" @close="feedbackOpen = false" />
  </Teleport>
</template>

<style scoped>
.global-top-bar__utilities {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: var(--hk-space-3, 8px);
}

.global-top-bar__utilities :deep(.auto-farm-indicator) {
  position: static;
}

/* S03 spec: utility seals are icon-only round seals (aria-label still
   announces them) - collapses the label text so the right cluster never
   overflows the viewport edge. */
.global-top-bar__seal {
  font-family: var(--hk-font-display, serif);
}

.global-top-bar__seal :deep(.game-button__label) {
  font-size: 0;
  gap: 0;
}

.global-top-bar__seal :deep(.hk-symbol) {
  width: 16px;
  height: 16px;
}
</style>
