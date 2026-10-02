<script setup lang="ts">
// Dao Luan hub (scene 03 spec region `dao-luan-hub`, anchor 50%/66%,
// canonical layer L4): the seated cultivator on the dais. The figure is
// the SOLE trigger that opens the multi-tier command wheel - a real
// button (aria-label/focus-visible) rendering the cultivate
// PlayerPortrait with CSS motion, plus the persistent nav caption.
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import PlayerPortrait from '@/components/common/PlayerPortrait.vue'

const ui = useUiStore()
const { t } = useI18n()
</script>

<template>
  <div class="home-player" data-canonical-layer="L4" data-hk-region="dao-luan-hub">
    <button
      type="button"
      class="home-player__trigger"
      :class="{ 'is-wheel-open': ui.isCommandWheelOpen }"
      :aria-label="t('home.commandWheel.openAria')"
      :aria-expanded="ui.isCommandWheelOpen"
      @click.stop="ui.toggleCommandWheel()"
    >
      <PlayerPortrait variant="cultivate" :animated="true" height="clamp(160px, 26vh, 239px)" />
      <!-- Persistent nav affordance (ui-audit creation-meta): the only
           wheel entries were this unlabeled portrait and the hidden Tab
           key - caption names the action + shortcut. -->
      <span class="home-player__hint">{{ t('home.commandWheel.hint') }}</span>
    </button>
  </div>
</template>

<style scoped>
/* PNG tu luyện (player-mortal-cultivate-v1) qua PlayerPortrait —
   chuyển động float/breathe/aura sống trong component đó; khối này chỉ
   định vị tâm màn hình và hit target. */
.home-player {
  position: absolute;
  z-index: 6;
  left: 50%;
  top: 66%;
  transform: translate(-50%, -50%);
}

/* .home-scene pointer-events:none toàn khối — trigger phải tự bật lại
   để nhận click/touch mở command wheel. */
.home-player__trigger {
  display: block;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
}

.home-player__trigger:focus-visible {
  outline: 2px solid var(--chrome-300);
  outline-offset: 4px;
  border-radius: var(--radius-md);
}

/* Caption pill under the character - persistent nav affordance. Hidden
   while the wheel is open so it doesn't overlap the orbiting slots. */
.home-player__hint {
  display: block;
  margin: 10px auto 0;
  padding: 4px 14px;
  width: fit-content;
  border: 1px solid color-mix(in srgb, var(--chrome-300) 45%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink-950) 72%, transparent);
  color: var(--chrome-300);
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  transition: opacity 0.24s ease;
}

.home-player__trigger:hover .home-player__hint,
.home-player__trigger:focus-visible .home-player__hint {
  color: var(--mineral-gold);
  border-color: var(--mineral-gold);
}

.home-player__trigger.is-wheel-open .home-player__hint {
  opacity: 0;
}

/* Khi wheel mở — aura tăng nhẹ (presentation-only). */
.home-player__trigger.is-wheel-open :deep(.player-portrait__aura) {
  opacity: 1;
  scale: 1.08;
}
</style>
