<script setup lang="ts">
// Scene 02 header - scroll-title-plaque chrome (empty plaque, app-rendered
// title) + kicker overline + the ref's letterspaced subtitle + cinnabar
// seal stamp at the plaque's right shoulder.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { hkChromeUrl } from '@/ui/huyenKimChrome'
import CreationSealStamp from './CreationSealStamp.vue'

const { t } = useI18n()
const plaqueUrl = computed(() => hkChromeUrl('scroll-title-plaque'))
</script>

<template>
  <header class="creation-title-block" data-hk-region="creation-title">
    <p class="creation-title-block__kicker">{{ t('onboarding.creation.headerKicker') }}</p>
    <div class="creation-title-block__plaque">
      <img v-if="plaqueUrl" :src="plaqueUrl" alt="" aria-hidden="true" />
      <h1>{{ t('onboarding.creation.headerTitle') }}</h1>
      <CreationSealStamp class="creation-title-block__seal" />
    </div>
    <p class="creation-title-block__subtitle">{{ t('onboarding.creation.headerSubtitle') }}</p>
  </header>
</template>

<style scoped>
.creation-title-block {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: clamp(4px, 1.2vh, 12px);
}

.creation-title-block__kicker {
  margin: 0;
  color: #6b6151;
  font-size: var(--text-xs);
  letter-spacing: 0.32em;
}

.creation-title-block__plaque {
  position: relative;
  isolation: isolate;
  display: grid;
  place-items: center;
  width: min(84%, 380px);
  min-height: clamp(46px, 7.4vh, 66px);
  margin-top: 2px;
}

.creation-title-block__plaque img {
  position: absolute;
  inset: 0;
  z-index: -1;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
}

.creation-title-block__plaque h1 {
  margin: 0;
  color: var(--hk-gold-bright, #e8c35a);
  font: 700 clamp(19px, 2.6vh, 27px) var(--hk-font-display, var(--font-display));
  letter-spacing: 0.06em;
  text-shadow: 0 2px 8px rgba(5, 8, 9, 0.6);
}

.creation-title-block__seal {
  position: absolute;
  right: 4%;
  top: 12%;
}

.creation-title-block__subtitle {
  margin: 4px 0 0;
  color: #6b6151;
  font-size: var(--text-xs);
  letter-spacing: 0.3em;
  text-align: center;
}
</style>
