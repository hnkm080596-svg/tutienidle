<script setup lang="ts">
// Scene 02 vista prop — the vertical calligraphy strip hanging at the
// vista's far-left edge in the ref (ivory paper, ink glyphs, red tassel).
// TEMP ART until Minh's strip lands.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const glyphs = computed(() => t('onboarding.creation.vistaBanner').replace(/\s/g, '').split(''))
</script>

<template>
  <div
    class="creation-vista-banner art-needed"
    data-art-id="creation-vista-banner"
    aria-hidden="true"
  >
    <span v-for="(glyph, i) in glyphs" :key="i" class="creation-vista-banner__glyph">{{ glyph }}</span>
  </div>
</template>

<style scoped>
/* ~60×280 design px at the far-left edge; slight paper sag toward the
   bottom like the ref's hanging strip. */
.creation-vista-banner {
  position: absolute;
  left: 1.4%;
  top: 8%;
  width: clamp(26px, 3.6vw, 46px);
  height: 30%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-evenly;
  padding: 8px 2px 14px;
  background:
    linear-gradient(90deg, rgba(122, 98, 52, 0.35), transparent 12% 88%, rgba(122, 98, 52, 0.35)),
    linear-gradient(180deg, #e8dfc8 0%, #ddd2b4 60%, #c9bb97 100%);
  box-shadow:
    0 -6px 0 -2px #7a6234,
    2px 6px 14px rgba(5, 8, 9, 0.5);
  transform: rotate(-1.5deg);
  pointer-events: none;
}

/* Red tassel cord hanging off the strip's bottom tip. */
.creation-vista-banner::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -26px;
  width: 5px;
  height: 26px;
  transform: translateX(-50%);
  background: linear-gradient(180deg, #b54432, #7e2e21);
  border-radius: 2px;
}

.creation-vista-banner__glyph {
  color: #2e2a22;
  font: 600 clamp(15px, 2.1vh, 21px) var(--hk-font-display, var(--font-display));
  line-height: 1;
}
</style>
