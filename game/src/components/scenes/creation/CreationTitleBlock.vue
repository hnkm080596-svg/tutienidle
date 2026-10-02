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
  /* Fold into the scroll's crown zone (scroll-rel 0-60 design px):
     the plaque hangs on the top rod art as an overlay instead of
     consuming ~120px of flow height - name-section then lands at the
     spec band (scroll-rel ~60). */
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 0;
}

/* The kicker/subtitle are decorative eyebrows - hidden so the block
   stays inside the crown zone without overlapping the name field. */
.creation-title-block__kicker,
.creation-title-block__subtitle {
  display: none;
}

.creation-title-block__plaque {
  position: relative;
  isolation: isolate;
  display: grid;
  place-items: center;
  width: min(64%, 300px);
  min-height: clamp(38px, 5.6vh, 54px);
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


</style>
