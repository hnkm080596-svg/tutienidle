<script setup lang="ts">
// Scene 02 back affordance - top-left ghost button (region back-btn
// 24/24/96/40 in design px) returning to the auth entry.
import { useI18n } from 'vue-i18n'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ back: [] }>()
const { t } = useI18n()
</script>

<template>
  <button
    class="creation-back-button"
    type="button"
    :disabled="disabled"
    @click="emit('back')"
  >
    {{ t('onboarding.creation.back') }}
  </button>
</template>

<style scoped>
.creation-back-button {
  border: 0;
  padding: 0;
  background: transparent;
  color: #786441;
  font: 12px var(--hk-font-display, Georgia, serif);
  cursor: pointer;
}
.creation-back-button:focus-visible { outline: 2px solid #315f55; outline-offset: 3px; }
</style>
