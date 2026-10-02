<script setup lang="ts">
// Scene 09 scaffold - running auto-farm state row + stop control
// (B5 armed state; player.autoFarmStage is the read-model).
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'

const props = defineProps<{
  stageName: string
}>()

const emit = defineEmits<{
  (e: 'stop'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="stage-select__autofarm">
    <span>{{ t('autoFarm.running', { stage: props.stageName }) }}</span>
    <GameButton variant="danger" size="sm" data-testid="autofarm-stop" @click="emit('stop')">
      {{ t('autoFarm.stop') }}
    </GameButton>
  </div>
</template>

<style scoped>
.stage-select__autofarm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
}
</style>
