<script setup lang="ts">
defineProps<{ fill: number; color: string }>()
</script>
<template>
  <span class="equipment-energy-tube" aria-hidden="true"
    ><i :style="{ width: `${Math.max(0, Math.min(100, fill))}%`, '--energy-color': color }"
  /></span>
</template>
<style scoped>
.equipment-energy-tube {
  display: block;
  width: 100%;
  height: 10px;
  border: 1px solid #b09155;
  border-radius: 8px;
  background: #151715;
  box-shadow: inset 0 0 2px #000;
  overflow: hidden;
}
.equipment-energy-tube i {
  position: relative;
  display: block;
  height: 100%;
  border-radius: 8px;
  background: var(--energy-color);
  box-shadow: inset 0 1px 2px #fff7;
  overflow: hidden;
}
.equipment-energy-tube i::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 20%, #fff8 48%, transparent 75%);
  width: 50%;
  animation: equipment-energy-flow 3.4s linear infinite;
}
@keyframes equipment-energy-flow {
  from {
    transform: translateX(-110%);
  }
  to {
    transform: translateX(310%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .equipment-energy-tube i::after {
    animation: none;
    opacity: 0.25;
    transform: translateX(70%);
  }
}
</style>
