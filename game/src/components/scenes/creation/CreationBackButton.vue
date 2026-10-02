<script setup lang="ts">
// Scene 02 back affordance - top-left ghost button (region back-btn
// 24/24/96/40 in design px) returning to the auth entry.
import GameButton from '@/components/common/GameButton.vue'
import { useI18n } from 'vue-i18n'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ back: [] }>()
const { t } = useI18n()
</script>

<template>
  <GameButton
    class="creation-back-button"
    variant="ghost"
    size="sm"
    :disabled="disabled"
    @click="emit('back')"
  >
    {{ t('onboarding.creation.back') }}
  </GameButton>
</template>

<style scoped>
.creation-back-button {
  /* Keeps the ghost legible over the vista band's red seal marks at the
     top-left - a translucent ink plate behind the label. */
  text-shadow: 0 1px 4px rgba(5, 8, 9, 0.65);
  background: color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 62%, transparent);
  border-radius: var(--hk-radius-sm, 6px);
  backdrop-filter: blur(2px);
}
</style>
