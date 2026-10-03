<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LOGIN_ART } from '../login/loginArt'
defineProps<{ ready: boolean; creating: boolean; summary: string; error: string }>()
defineEmits<{ finish: [] }>()
const { t } = useI18n()
</script>

<template>
  <footer class="creation-footer" data-hk-region="footer">
    <div class="creation-footer__notice" aria-live="polite" aria-atomic="true">
      <p v-if="error" class="creation-footer__error">{{ error }}</p>
      <p v-else-if="ready" data-testid="creation-summary">{{ summary }}</p>
    </div>
    <button class="creation-footer__cta" type="button" :aria-disabled="!ready || creating"
      data-testid="creation-finish" data-hk-region="primary-action" @click="$emit('finish')">
      <img :src="LOGIN_ART.button" alt="" aria-hidden="true" draggable="false" />
      <span>{{ creating ? t('onboarding.creation.creating') : t('onboarding.creation.finish') }}</span>
    </button>
    <p class="creation-footer__preview">{{ t('onboarding.creation.starterSlot.previewNote') }}</p>
  </footer>
</template>

<style scoped>
.creation-footer { margin-top: auto; text-align: center; }
.creation-footer__notice { height: 25px; display: grid; align-items: start; overflow: auto; color: #4f6046; font-size: 11px; line-height: 1.25; }
.creation-footer__notice p { margin: 0; }
.creation-footer__notice .creation-footer__error { color: #943c2b; }
.creation-footer__cta { position: relative; width: 104%; height: 53px; margin: 0 -2%; border: 0; background: none; color: #ffecaf; font: 500 22px var(--hk-font-display, Georgia, serif); text-shadow: 0 1px 3px #071d17; cursor: pointer; }
.creation-footer__cta img { position: absolute; width: 104%; height: auto; left: -2%; top: 50%; transform: translateY(-50%); pointer-events: none; }
.creation-footer__cta span { position: relative; display: block; line-height: 1.2; transform: translateY(-5px); }
.creation-footer__cta:hover { filter: brightness(1.12); }
.creation-footer__cta[aria-disabled="true"] { filter: saturate(.65); cursor: default; }
.creation-footer__cta:focus-visible { outline: 2px solid #557253; outline-offset: 1px; }
.creation-footer__preview { height: 16px; margin: 0; color: #7b7059; font-size: 10px; }
</style>
