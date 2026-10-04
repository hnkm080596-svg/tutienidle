<script setup lang="ts">
// Scene 15/16 actions region (huyen-kim reskin): retry (danger-tinted
// button-standard, repeat-mode 3s countdown) + return home (gold
// button-ceremonial, 10s fallback countdown) below the paper edge.
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import { formatDuration } from '@/core/format/formatDuration'

defineProps<{
  isAutoRetrying: boolean
  retryCountdown: number
  returnCountdown: number
}>()
const emit = defineEmits<{ retry: []; returnHome: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="combat-defeat-panel__actions" data-hk-region="actions">
    <GameButton
      class="combat-defeat-panel__retry"
      variant="danger"
      :class="{ 'is-disabled': isAutoRetrying }"
      :disabled="isAutoRetrying"
      @click="emit('retry')"
    >
      {{ t('combat.defeat.retry') }}<template v-if="isAutoRetrying"> {{ t('combat.defeat.retryCountdown', { duration: formatDuration(retryCountdown, 'countdown') }) }}</template>
    </GameButton>

    <GameButton class="combat-defeat-panel__return" variant="primary" size="lg" @click="emit('returnHome')">
      {{ t('combat.defeat.returnHome') }} {{ t('combat.defeat.returnCountdown', { duration: formatDuration(returnCountdown, 'countdown') }) }}
    </GameButton>
  </div>
</template>

<style scoped>
.combat-defeat-panel__actions {
  display: flex;
  justify-content: center;
  gap: 26px;
}
.combat-defeat-panel__actions :deep(button) {
  width: 230px;
  min-height: 50px;
}
.combat-defeat-panel__retry.is-disabled { filter: grayscale(0.5) brightness(0.7); }
</style>
