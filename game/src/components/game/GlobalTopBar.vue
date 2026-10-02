<script setup lang="ts">
// Spec SS11 top bar -- thin screen-space chrome (L8): identity left /
// global resources center / utilities right. World-first: the bar is a
// translucent edge gradient, never an opaque band, and it never moves
// with the world camera (it lives outside .home-scene).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import CurrencyHud from './CurrencyHud.vue'
import AutoFarmIndicator from './AutoFarmIndicator.vue'
import PlayerPortrait from '../common/PlayerPortrait.vue'
import GameButton from '../common/GameButton.vue'
import HuyenKimSymbol from '../common/HuyenKimSymbol.vue'
import FeedbackDialog from '../common/FeedbackDialog.vue'
import InkNineSlice from '../common/primitives/InkNineSlice.vue'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const { t } = useI18n()
const player = usePlayerStore()
const ui = useUiStore()

const realmName = computed(() => getCurrentRealm(player.realmId).name)
const cultivationPercent = computed(() => Math.min(100, Math.round(player.cultivationProgress * 100)))
const cultivationText = computed(
  () => `${formatNumber(player.cultivation)} / ${formatNumber(player.cultivationRequired)}`,
)

const feedbackOpen = ref(false)
const avatarFrameUrl = hkChromeUrl('avatar-frame')
</script>

<template>
  <header class="global-top-bar" role="banner" :aria-label="t('home.topBar.aria')" data-canonical-layer="L8" data-hk-region="top-bar">
    <button
      type="button"
      class="global-top-bar__identity"
      :aria-label="t('home.topBar.identityAria')"
      @click="ui.openLeftPanel('character')"
    >
      <InkNineSlice chrome-id="identity-plate" layer="surface" />
      <span class="global-top-bar__avatar">
        <PlayerPortrait variant="portrait" :height="38" />
        <img v-if="avatarFrameUrl" class="global-top-bar__avatar-frame" :src="avatarFrameUrl" alt="" aria-hidden="true" />
      </span>
      <span class="global-top-bar__identity-text">
        <span class="global-top-bar__name">{{ player.name }}</span>
        <span class="global-top-bar__realm">
          {{ t('home.topBar.realmLine', { realm: realmName, level: player.realmLevel }) }}
        </span>
        <span
          class="global-top-bar__progress"
          role="progressbar"
          :aria-label="t('home.topBar.cultivation')"
          :aria-valuenow="cultivationPercent"
          aria-valuemin="0"
          aria-valuemax="100"
          :title="cultivationText"
        >
          <span class="global-top-bar__progress-fill" :style="{ width: `${cultivationPercent}%` }" />
        </span>
      </span>
    </button>

    <div class="global-top-bar__resources">
      <CurrencyHud />
    </div>

    <div class="global-top-bar__utilities">
      <AutoFarmIndicator />
      <GameButton
        shape="circle"
        size="sm"
        variant="ghost"
        class="global-top-bar__seal"
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
        :aria-label="t('home.topBar.settingsAria')"
        @click="ui.openLeftPanel('settings')"
      >
        <HuyenKimSymbol name="settings" />
        {{ t('home.topBar.settings') }}
      </GameButton>
    </div>

    <!-- Mail/feedback utility -- dialog teleports to body so the overlay
         scrim covers the viewport, not just this bar. -->
    <Teleport to="body">
      <FeedbackDialog :open="feedbackOpen" @close="feedbackOpen = false" />
    </Teleport>
  </header>
</template>

<style scoped>
.global-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  gap: var(--hk-space-4, 12px);
  padding: var(--hk-space-3, 8px) var(--hk-space-4, 12px) var(--hk-space-5, 16px);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 88%, transparent) 0%,
    transparent 100%
  );
  pointer-events: none;
}

.global-top-bar > * {
  pointer-events: auto;
}

/* identity-plate chrome: the PNG plate owns the surface; the button's
   own pill styling stays as the pending/fallback path underneath. */
.global-top-bar__identity {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: var(--hk-space-3, 8px);
  justify-self: start;
  max-width: 40vw;
  padding: var(--hk-space-3, 8px) var(--hk-space-5, 16px) var(--hk-space-3, 8px) var(--hk-space-3, 8px);
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: var(--radius-sm, 2px);
  background: color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 72%, transparent);
  color: var(--hk-text-primary, #ede6d6);
  font-family: var(--hk-font-ui, sans-serif);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.global-top-bar__identity > :not(.ink-nine-slice) { position: relative; z-index: 2; }

.global-top-bar__identity:hover,
.global-top-bar__identity:focus-visible {
  border-color: var(--hk-border-active, #7a6234);
}

.global-top-bar__identity:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--hk-glow-gold, rgba(232, 195, 90, 0.35));
}

.global-top-bar__avatar {
  position: relative;
  display: block;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
}

.global-top-bar__avatar :deep(.player-portrait),
.global-top-bar__avatar > :first-child {
  width: 38px;
  height: 38px;
  overflow: hidden;
  border: 1px solid var(--hk-border-active, #7a6234);
  border-radius: 50%;
}

.global-top-bar__avatar-frame {
  position: absolute;
  inset: -4px;
  width: calc(100% + 8px);
  height: calc(100% + 8px);
  object-fit: fill;
  pointer-events: none;
}

.global-top-bar__identity-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  text-align: left;
}

.global-top-bar__name {
  color: var(--hk-text-primary, #ede6d6);
  font-size: var(--text-sm, 12px);
  font-weight: 600;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-top-bar__realm {
  color: var(--hk-text-secondary, #b8ae97);
  font-size: var(--text-xs, 11px);
  line-height: 1.2;
  white-space: nowrap;
}

.global-top-bar__progress {
  display: block;
  width: 96px;
  height: 3px;
  margin-top: 3px;
  border-radius: 999px;
  background: var(--hk-border-muted, #2a352f);
  overflow: hidden;
}

.global-top-bar__progress-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--hk-jade, #3fa68b);
  transition: width var(--hk-motion-panel, 280ms) var(--hk-ease-standard, ease);
}

.global-top-bar__resources {
  justify-self: center;
  display: flex;
  justify-content: center;
}

/* Docked chips -- the shared components keep their own styling; only the
   absolute self-positioning is neutralized so they flow inside the bar. */
.global-top-bar__resources :deep(.currency-hud) {
  position: static;
  max-width: none;
  pointer-events: auto;
}

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

@media (max-width: 720px) {
  .global-top-bar {
    grid-template-columns: auto 1fr auto;
  }

  .global-top-bar__resources {
    justify-self: center;
  }

  .global-top-bar__realm {
    display: none;
  }
}
</style>
