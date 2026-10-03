<script setup lang="ts">
import { DONG_FU_ART } from './dongFuUi'
</script>
<template>
  <div class="df-vista" aria-hidden="true">
    <img class="df-vista__rear" :src="DONG_FU_ART.rear" alt="" draggable="false">
    <div class="df-vista__shade" />
    <img class="df-vista__front" :src="DONG_FU_ART.foreground" alt="" draggable="false">
  </div>
</template>
<style scoped>
.df-vista { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.df-vista__rear, .df-vista__front { position: absolute; width: 1464px; height: 824px; left: -12px; top: -7px; object-fit: fill; transition: transform 400ms ease-out; }
.df-vista__rear { transform: translate(calc(var(--df-x, 0) * -3px), calc(var(--df-y, 0) * -2px)); }
.df-vista__front { transform: translate(calc(var(--df-x, 0) * -8px), calc(var(--df-y, 0) * -5px)); }
.df-vista__shade { position: absolute; inset: 0; background: linear-gradient(#030b1580, transparent 22%, transparent 76%, #04090e55), radial-gradient(ellipse at 49% 57%, #06132230, transparent 52%); }
@media (prefers-reduced-motion: reduce) { .df-vista__rear, .df-vista__front { transform: none; transition: none; } }
</style>
