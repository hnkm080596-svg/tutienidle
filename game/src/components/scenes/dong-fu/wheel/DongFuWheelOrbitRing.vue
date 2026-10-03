<script setup lang="ts">
// Dao Luan orbit ring (scene 03 wheel region): one visible circular
// track the slots ride on. Ring 0 is the inner orbit (cultivation core),
// ring 1 the outer orbit; diameter arrives via --orbit-diameter
// fallthrough style from the wheel layer. Temporary CSS art pending the
// painted orbit treatment (art inventory 03-dong-fu).
import { computed } from 'vue'

const props = defineProps<{
  orbitIndex: number
}>()

const region = computed(() =>
  props.orbitIndex === 0 ? 'wheel-inner-orbit' : 'wheel-outer-orbit',
)
</script>

<template>
  <span
    class="command-wheel__orbit"
    :data-hk-region="region"
    art-needed
    data-art-id="dao-luan-orbit"
    aria-hidden="true"
  />
</template>

<style scoped>
.command-wheel__orbit {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--orbit-diameter);
  height: var(--orbit-diameter);
  border: 1px solid color-mix(in srgb, var(--hk-gold-muted, var(--mineral-gold)) 55%, transparent);
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.92);
  transition:
    opacity 0.24s ease-out,
    transform 0.32s cubic-bezier(0.2, 0.75, 0.3, 1);
}
</style>
