<script setup lang="ts">
// Scene 08 detail-panel footer: the ceremonial invest button. The
// chapter stays the sole authority - the button is a presentation
// mirror of the viewed unit's invest preconditions.
import GameButton from '@/components/common/GameButton.vue'

defineProps<{
  label: string
  canInvest: boolean
}>()

const emit = defineEmits<{ invest: [] }>()
</script>

<template>
  <div class="body-invest">
    <GameButton
      class="body-invest__button"
      size="lg"
      :disabled="!canInvest"
      @click="emit('invest')"
    >
      {{ label }}
    </GameButton>
  </div>
</template>

<style scoped>
.body-invest { display: flex; justify-content: center; padding-top: 4px; }
.body-invest__button { min-width: 62%; }
</style>
