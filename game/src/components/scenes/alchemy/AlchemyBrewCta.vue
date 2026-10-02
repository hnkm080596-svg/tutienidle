<script setup lang="ts">
// Scene 11 detail-panel brew CTA ("Bat Dau Luyen Dan") + the audit M4
// block-reason line naming the exact missing input. No quantity
// stepper - INVALID for beta.
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'

defineProps<{
  canBrew: boolean
  blockReasonLabel: string | null
}>()
const emit = defineEmits<{ brew: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="alchemy-brew-cta">
    <GameButton class="alchemy-detail__action" size="sm" accent-var="--scene-fire-text" :disabled="!canBrew" @click="emit('brew')">
      {{ t('alchemy.startBrewing') }}
    </GameButton>
    <p v-if="blockReasonLabel" class="alchemy-detail__block-reason" data-testid="brew-block-reason">
      {{ blockReasonLabel }}
    </p>
  </div>
</template>

<style scoped>
.alchemy-brew-cta { display: flex; flex-direction: column; }
.alchemy-detail__block-reason {
  margin: 6px 0 0;
  font-size: var(--text-xs);
  color: var(--cinnabar);
}
</style>
