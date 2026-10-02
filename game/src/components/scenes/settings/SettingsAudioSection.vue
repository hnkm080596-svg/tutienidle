<script setup lang="ts">
// Scene 16/17 audio section (ref's Am Thanh - CORRECTED to the real
// store: on/off + master + per-channel volumes + reduced shake; ref's
// spatial-audio/combat-ducking toggles are INVALID).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Chip from '@/components/common/primitives/Chip.vue'
import { useAudioStore } from '@/stores/audio'
import { hkChromeUrl } from '@/ui/huyenKimChrome'
import SettingsSectionFrame from './SettingsSectionFrame.vue'

// W3: one slider per audio channel (field = store state, channel = bus id).
const AUDIO_CHANNELS = [
  { field: 'musicVolume', channel: 'music', labelKey: 'musicVolume' },
  { field: 'sfxVolume', channel: 'sfx', labelKey: 'sfxVolume' },
  { field: 'uiVolume', channel: 'ui', labelKey: 'uiVolume' },
] as const

const audio = useAudioStore()
const { t } = useI18n()

// Scene 17 grammar: audio sliders wear the slider-track + slider-thumb
// chrome when the PNGs are ready; the native range stays the fallback.
// The vars + flag live on THIS section root - the panel-level marker
// cannot be scoped-selected from inside a scoped child, and the
// :global() wrapper miscompiles the vendor pseudo-element selectors
// (their declarations leaked onto the whole .settings-panel).
const sliderTrackUrl = hkChromeUrl('slider-track')
const sliderThumbUrl = hkChromeUrl('slider-thumb')
const sliderChromeStyle = computed<Record<string, string> | undefined>(() =>
  sliderTrackUrl && sliderThumbUrl
    ? {
        '--hk-slider-track': `url("${sliderTrackUrl}")`,
        '--hk-slider-thumb': `url("${sliderThumbUrl}")`,
      }
    : undefined,
)
</script>

<template>
  <SettingsSectionFrame
    class="settings-panel__audio"
    :class="{ 'has-hk-slider': Boolean(sliderChromeStyle) }"
    :style="sliderChromeStyle"
    :title="t('panels.settings.sections.audio')"
    :label="t('panels.settings.sections.audioAria')"
    data-hk-region="audio"
  >
    <div class="settings-panel__audio-row">
      <Chip
        class="settings-panel__audio-toggle"
        :active="audio.enabled"
        :aria-pressed="audio.enabled"
        data-testid="settings-audio-toggle"
        @click="audio.setEnabled(!audio.enabled)"
      >
        {{ audio.enabled ? t('panels.settings.audio.on') : t('panels.settings.audio.off') }}
      </Chip>

      <label class="settings-panel__audio-volume">
        {{ t('panels.settings.audio.volume') }}
        <input
          type="range"
          min="0"
          max="100"
          :value="Math.round(audio.masterVolume * 100)"
          :disabled="!audio.enabled"
          data-testid="settings-audio-volume"
          @input="audio.setMasterVolume(Number(($event.target as HTMLInputElement).value) / 100)"
        />
        <span class="settings-panel__audio-volume-value">{{ Math.round(audio.masterVolume * 100) }}%</span>
      </label>
    </div>

    <div class="settings-panel__audio-row">
      <label
        v-for="channel in AUDIO_CHANNELS"
        :key="channel.field"
        class="settings-panel__audio-volume"
      >
        {{ t(`panels.settings.audio.${channel.labelKey}`) }}
        <input
          type="range"
          min="0"
          max="100"
          :value="Math.round(audio[channel.field] * 100)"
          :disabled="!audio.enabled"
          :data-testid="`settings-audio-${channel.field}`"
          @input="audio.setChannelVolume(channel.channel, Number(($event.target as HTMLInputElement).value) / 100)"
        />
        <span class="settings-panel__audio-volume-value">{{ Math.round(audio[channel.field] * 100) }}%</span>
      </label>
    </div>

    <div class="settings-panel__audio-row">
      <Chip
        class="settings-panel__audio-toggle"
        :active="audio.reducedShake"
        :aria-pressed="audio.reducedShake"
        data-testid="settings-reduced-shake"
        @click="audio.setReducedShake(!audio.reducedShake)"
      >
        {{ t('panels.settings.audio.reducedShake') }}
      </Chip>
    </div>
  </SettingsSectionFrame>
</template>

<style scoped>
.settings-panel__audio h4 {
  margin: 0 0 8px;
  color: var(--paper-text);
}
.settings-panel__audio-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.settings-panel__audio-toggle {
  padding: 0 var(--space-4);
  border-color: var(--paper-line);
  color: var(--paper-text);
  font-size: var(--text-sm);
  --chip-active-bg: color-mix(in srgb, var(--chrome-300) 12%, transparent);
}
.settings-panel__audio-volume {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--paper-text);
}
.settings-panel__audio-volume input[type='range'] {
  width: 140px;
  accent-color: var(--gold);
}
/* slider-track + slider-thumb chrome (scene 17 grammar); enabled only
   when the registry resolves both URLs (has-hk-slider on THIS section
   root - plain scoped selectors keep the vendor pseudos on the input,
   not the panel). */
.has-hk-slider .settings-panel__audio-volume input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  height: 24px;
  background: transparent;
  cursor: pointer;
}
.has-hk-slider .settings-panel__audio-volume input[type='range']::-webkit-slider-runnable-track {
  height: 10px;
  border-radius: 5px;
  background: var(--hk-slider-track) center / 100% 100% no-repeat;
}
.has-hk-slider .settings-panel__audio-volume input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  margin-top: -5px;
  border: none;
  background: var(--hk-slider-thumb) center / contain no-repeat;
  cursor: grab;
}
.has-hk-slider .settings-panel__audio-volume input[type='range']::-moz-range-track {
  height: 10px;
  border-radius: 5px;
  background: var(--hk-slider-track) center / 100% 100% no-repeat;
}
.has-hk-slider .settings-panel__audio-volume input[type='range']::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border: none;
  background: var(--hk-slider-thumb) center / contain no-repeat;
  cursor: grab;
}
.has-hk-slider .settings-panel__audio-volume input[type='range']:focus-visible {
  outline: 2px solid var(--chrome-300);
  outline-offset: 3px;
}
.has-hk-slider .settings-panel__audio-volume input[type='range']:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.settings-panel__audio-volume-value {
  min-width: 3ch;
  text-align: right;
  color: var(--paper-text-soft);
}
</style>
