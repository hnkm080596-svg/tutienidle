<script setup lang="ts">
// Scene 14 region `title` (design 576/140/520/96): giant "Thang"
// calligraphy over the ceremony ribbon, battle-name plaque and the
// italic flavor line. Calligraphy text is rendered by the app
// (EXCEPTED-text) - only the brush flourish is art.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const props = defineProps<{
  stageName: string | null
}>()

const { t } = useI18n()
const ribbonUrl = hkChromeUrl('ceremony-ribbon')

const subtitle = computed(() => props.stageName ?? t('combat.victory.subtitle'))
</script>

<template>
  <header class="victory-title" data-hk-region="title">
    <div class="victory-title__band">
      <img v-if="ribbonUrl" class="victory-title__ribbon" :src="ribbonUrl" alt="" aria-hidden="true" />
      <span class="victory-title__flourish art-needed" data-art-id="victory-title-flourish" aria-hidden="true" />
      <h2 class="victory-title__text">{{ t('combat.victory.title') }}</h2>
    </div>

    <p class="victory-title__subtitle">
      <span class="victory-title__subtitle-seal" aria-hidden="true" />
      {{ subtitle }}
      <span class="victory-title__subtitle-seal" aria-hidden="true" />
    </p>
    <p class="victory-title__flavor">{{ t('combat.victory.flavor') }}</p>
  </header>
</template>

<style scoped>
.victory-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.victory-title__band {
  position: relative;
  display: grid;
  place-items: center;
  width: min(520px, 100%);
  min-height: 96px;
}

.victory-title__ribbon {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
}

/* Brush-stroke flourish under the calligraphy - temp CSS glow. */
.victory-title__flourish {
  position: absolute;
  inset: 12% 8%;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, var(--hk-glow-gold, rgba(232, 195, 90, 0.45)) 0%, transparent 68%);
  pointer-events: none;
}

.victory-title__text {
  position: relative;
  margin: 0;
  font-family: var(--font-display);
  color: var(--hk-gold-radiant, #f4d98b);
  font-size: clamp(40px, 7vw, 78px);
  letter-spacing: 0.2em;
  text-shadow:
    0 0 14px color-mix(in srgb, var(--hk-glow-gold, rgba(232, 195, 90, 0.65)) 60%, transparent),
    0 2px 0 rgba(60, 40, 8, 0.55);
}

.victory-title__subtitle {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 4px 22px;
  border-radius: 999px;
  border: 1px solid var(--hk-border-ceremony, #b99a55);
  background: linear-gradient(180deg, #1b241f 0%, #101614 100%);
  color: var(--hk-text-primary, #ede6d6);
  font-family: var(--font-display, serif);
  font-size: var(--text-sm);
  letter-spacing: 0.06em;
}
.victory-title__subtitle-seal {
  width: 8px;
  height: 8px;
  transform: rotate(45deg);
  border: 1px solid var(--hk-gold, #b99a55);
  background: var(--hk-cinnabar, #b54432);
}

.victory-title__flavor {
  margin: 0;
  font-style: italic;
  font-size: var(--text-xs);
  color: var(--hk-text-muted, #7a7260);
}
</style>
