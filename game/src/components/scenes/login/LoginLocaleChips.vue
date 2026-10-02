<script setup lang="ts">
// Scene 01 locale-chips region (spec: 1336/138/224/36, card-top-right,
// z11, badge family, gap 8). Audit: chips, not a dropdown. Reachable
// before auth; persists via composables/locale.
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { LOCALE_OPTIONS, saveLocale } from '@/composables/locale'

const { t, locale } = useI18n()
</script>

<template>
  <div class="login-locale" data-hk-region="locale-chips" :aria-label="t('onboarding.auth.language')">
    <span class="login-locale__globe art-needed" data-art-id="login-icon-globe" aria-hidden="true" />
    <button
      v-for="option in LOCALE_OPTIONS"
      :key="option"
      type="button"
      class="login-locale__option"
      :class="{ active: locale === option }"
      :data-testid="`auth-locale-${option}`"
      @click="saveLocale(option)"
    >
      <InkNineSlice chrome-id="seal-chip" layer="surface" :tint-var="locale === option ? '--hk-jade' : undefined" />
      <span class="login-locale__label">{{ t(`panels.settings.language.names.${option}`) }}</span>
    </button>
  </div>
</template>

<style scoped>
/* Spec slot: card-relative top-right (design 1336/138 -> rel (320,18)
   inside the 560px card), hanging near the frame's top edge. */
.login-locale {
  position: absolute;
  top: 18px;
  right: 16px;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 6px;
}
.login-locale__option {
  position: relative;
  isolation: isolate;
  min-height: 32px;
  padding: 4px 12px;
  border: 0;
  border-radius: var(--radius-sm, 2px);
  background: transparent;
  color: var(--paper-text-muted, #6b6860);
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
  cursor: pointer;
}
.login-locale__option.active {
  color: var(--hk-ivory, #ede6d6);
}
.login-locale__option:hover {
  color: var(--paper-text, #211f1a);
}
.login-locale__option.active:hover {
  color: var(--hk-ivory, #ede6d6);
}
.login-locale__label {
  position: relative;
  z-index: 3;
}
/* Globe glyph placeholder - icon-set gap (no stable symbol yet). */
.login-locale__globe {
  width: 14px;
  height: 14px;
  border: 1.5px solid #b99a55;
  border-radius: 50%;
  background:
    linear-gradient(90deg, transparent 45%, #b99a55 45%, #b99a55 55%, transparent 55%),
    linear-gradient(0deg, transparent 45%, #b99a55 45%, #b99a55 55%, transparent 55%);
  opacity: 0.85;
}
</style>
