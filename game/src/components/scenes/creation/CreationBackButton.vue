<script setup lang="ts">
// Scene 02 back affordance - top-left icon seal (region back-btn
// 24/24/96/40 in design px) returning to the auth entry. wave B chrome:
// drawn icon-button-utility seal + 'back' glyph replaces the bare text link.
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ back: [] }>()
const { t } = useI18n()
</script>

<template>
  <GameButton
    class="creation-back-button"
    variant="secondary"
    shape="circle"
    size="sm"
    :disabled="disabled"
    :aria-label="t('onboarding.creation.back')"
    :title="t('onboarding.creation.back')"
    @click="emit('back')"
  >
    <HuyenKimSymbol name="back" />
  </GameButton>
</template>

<style scoped>
.creation-back-button {
  width: 34px;
  height: 34px;
  min-width: 0;
  min-height: 0;
  padding: 0;
}
</style>
