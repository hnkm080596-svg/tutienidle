<script setup lang="ts">
// Scene 02 back affordance — top-left ghost button (region back-btn
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
  /* keeps the ghost legible over the bright vista band at the top edge */
  text-shadow: 0 1px 4px rgba(5, 8, 9, 0.65);
}
</style>
