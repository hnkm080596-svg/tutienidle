<script setup lang="ts">
// Scene 05 breakthrough-cta region (spec: 1116/730/416/56, button
// family, button-ceremonial). Hidden at the release ceiling - the
// parent only mounts it when the beta next-realm surface exists.
import GameButton from '@/components/common/GameButton.vue'

defineProps<{
  label: string
  disabled: boolean
}>()

const emit = defineEmits<{ activate: [] }>()
</script>

<template>
  <GameButton
    class="realm-breakthrough"
    variant="primary"
    size="lg"
    :disabled="disabled"
    data-hk-region="breakthrough-cta"
    @click="emit('activate')"
  >
    {{ label }}
  </GameButton>
</template>

<style scoped>
.realm-breakthrough { width: 100%; }
</style>
