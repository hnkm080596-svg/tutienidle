<script setup lang="ts">
// Identity plate (scene 03 spec region `identity-plate`, top-left of the
// top bar): avatar + frame, player name, realm line, and the cultivation
// progress hairline. Clicking opens the character left panel. The
// `identity-plate` chrome nine-slice owns the card surface; the CSS pill
// underneath is the pending/fallback path.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import PlayerPortrait from '@/components/common/PlayerPortrait.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { chromeSlice, hkChromeUrl } from '@/ui/huyenKimChrome'

const { t } = useI18n()
const player = usePlayerStore()
const ui = useUiStore()

const realmName = computed(() => getCurrentRealm(player.realmId).name)
const cultivationPercent = computed(() => Math.min(100, Math.round(player.cultivationProgress * 100)))
const cultivationText = computed(
  () => `${formatNumber(player.cultivation)} / ${formatNumber(player.cultivationRequired)}`,
)

const avatarFrameUrl = hkChromeUrl('avatar-frame')
const plateSlice = chromeSlice('identity-plate')
</script>

<template>
  <button
    type="button"
    class="global-top-bar__identity"
    data-hk-region="identity-plate"
    :art-needed="!plateSlice"
    data-art-id="identity-plate"
    :aria-label="t('home.topBar.identityAria')"
    @click="ui.openLeftPanel('character')"
  >
    <InkNineSlice chrome-id="identity-plate" layer="surface" />
    <span class="global-top-bar__avatar" data-art-id="avatar-frame">
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
</template>

<style scoped>
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

@media (max-width: 720px) {
  .global-top-bar__realm {
    display: none;
  }
}
</style>
