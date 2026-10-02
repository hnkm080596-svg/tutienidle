<script setup lang="ts">
// Scene 09 scaffold - "Khieu Chien" CTA plaque + build shortcut row
// (ref: big gold challenge button, build edit beside it).
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'

const props = defineProps<{
  canStart: boolean
}>()

const emit = defineEmits<{
  (e: 'open-build'): void
  (e: 'start'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="stage-select__start-row">
    <GameButton class="stage-select__build" variant="secondary" size="sm" @click="emit('open-build')">{{ t('panels.stageSelect.actions.editBuild') }}</GameButton>

    <GameButton
      class="stage-select__start stage-start-button art-needed"
      data-art-id="exploration-start-cta"
      size="sm"
      :disabled="!props.canStart"
      data-testid="stage-start-button"
      @click="emit('start')"
    >
      {{ t('panels.stageSelect.actions.start') }}
    </GameButton>
  </div>
</template>

<style scoped>
.stage-select__start-row {
  margin-top: auto;
  display: flex;
  gap: 8px;
}

.stage-select__build {
  padding: 8px 10px;
}

.stage-select__start {
  flex: 1;
  padding: 8px;
}

.stage-select__start:disabled {
  background: var(--paper-200);
  color: var(--paper-text-muted);
}
</style>
