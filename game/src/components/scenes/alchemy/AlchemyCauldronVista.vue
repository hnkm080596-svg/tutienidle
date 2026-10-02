<script setup lang="ts">
// Scene 11 focal-cauldron region (spec: 684/176/420/360, ornament
// family; Ruling 02 - `alchemy-cauldron-prop` is a UI scene prop,
// decorative only). Ref dresses the cauldron with two hanging calligraphy
// banners and an ingredient socket row below ("Dat Nguyen Lieu Vao
// Dan Lo") - all decorative temp art.
import { useI18n } from 'vue-i18n'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const { t } = useI18n()
const CAULDRON_SRC = hkChromeUrl('alchemy-cauldron-prop')
</script>

<template>
  <div class="alchemy-view__cauldron" data-hk-region="focal-cauldron">
    <div class="alchemy-cauldron-stage">
      <i class="alchemy-banner alchemy-banner--left art-needed" data-art-id="alchemy-banner-left" aria-hidden="true">{{ t('alchemy.bannerLeft') }}</i>
      <img v-if="CAULDRON_SRC" class="alchemy-view__cauldron-img" :src="CAULDRON_SRC" alt="" aria-hidden="true" />
      <i class="alchemy-banner alchemy-banner--right art-needed" data-art-id="alchemy-banner-right" aria-hidden="true">{{ t('alchemy.bannerRight') }}</i>
    </div>

    <!-- Ref: ring of empty ingredient sockets under the cauldron.
         Decorative per Ruling 02 - real herb selection lives in the
         detail rail. -->
    <div class="alchemy-sockets" aria-hidden="true">
      <i v-for="n in 5" :key="n" class="alchemy-sockets__socket art-needed" :data-art-id="`alchemy-ingredient-socket-${n}`" />
      <i class="alchemy-sockets__plus art-needed" data-art-id="alchemy-socket-plus">+</i>
    </div>
    <p class="alchemy-sockets__caption">{{ t('alchemy.placeIngredients') }}</p>
  </div>
</template>

<style scoped>
.alchemy-view__cauldron {
  grid-area: cauldron;
  /* Spec 11: focal-cauldron is exactly 360 design px (42.857cqh of the
     840px envelope) - top-anchored, not a share of the row height. */
  align-self: start;
  height: 42.857cqh;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.alchemy-cauldron-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.alchemy-view__cauldron-img {
  height: 100%;
  max-height: 100%;
  width: 100%;
  object-fit: contain;
  filter: drop-shadow(0 10px 26px color-mix(in srgb, var(--scene-fire-accent, #b54432) 24%, transparent));
  pointer-events: none;
}

/* Hanging calligraphy banners flanking the cauldron (temp art -
   vertical gold-on-ink scrolls). */
.alchemy-banner {
  position: absolute;
  top: 4%;
  height: 78%;
  width: 30px;
  padding: 10px 0;
  writing-mode: vertical-rl;
  text-orientation: upright;
  font-style: normal;
  font-family: var(--font-display);
  font-size: var(--text-sm);
  letter-spacing: .12em;
  color: var(--hk-gold-muted, #b99a55);
  background: linear-gradient(180deg, #1a2324, #101718);
  border: 1px solid color-mix(in srgb, var(--hk-gold-muted, #b99a55) 55%, transparent);
  border-radius: 3px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, .35);
  pointer-events: none;
}
.alchemy-banner--left { left: 4%; }
.alchemy-banner--right { right: 4%; }

/* Ingredient socket ring under the cauldron (temp art - dark metal
   sockets on a gold-rail band). */
.alchemy-sockets {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  padding: 6px 0 2px;
}
.alchemy-sockets__socket {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, #253335, #101718 70%);
  border: 2px solid color-mix(in srgb, var(--hk-gold-muted, #b99a55) 65%, #101718);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, .6), 0 0 6px color-mix(in srgb, var(--hk-gold-muted, #b99a55) 25%, transparent);
}
.alchemy-sockets__plus {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-style: normal;
  font-size: 18px;
  color: var(--hk-gold-muted, #b99a55);
  border: 1px dashed color-mix(in srgb, var(--hk-gold-muted, #b99a55) 55%, transparent);
}
.alchemy-sockets__caption {
  flex: 0 0 auto;
  margin: 0 0 6px;
  text-align: center;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}
</style>
