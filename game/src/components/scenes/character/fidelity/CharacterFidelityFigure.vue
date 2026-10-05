<script setup lang="ts">
import PlayerPortrait from '@/components/common/PlayerPortrait.vue'
</script>
<template>
  <div class="cf-figure">
    <div class="cf-aura" aria-hidden="true"><i /><i /></div>
    <PlayerPortrait class="cf-person" variant="portrait" animation-mode="idle" height="100%" />
  </div>
</template>
<style scoped>
.cf-figure { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.cf-person { position: absolute; left: 310px; top: 215px; width: 580px; height: 535px; object-fit: contain; filter: drop-shadow(0 8px 9px #4a3c3040); }
.cf-aura { position: absolute; left: 438px; top: 185px; width: 420px; height: 375px; border: 1px solid #b8893d; border-radius: 50%; box-shadow: 0 0 22px #ffd98f88, inset 0 0 25px #ffe5a277; background: radial-gradient(ellipse,#e6c26d33,transparent 68%); }
.cf-aura i { position: absolute; inset: 25px; border: 1px solid #d6a95a; border-radius: 50%; transform: rotate(-25deg) scaleY(.65); box-shadow: 0 0 7px #ffe8a7; }
.cf-aura i + i { inset: 44px; transform: rotate(32deg) scaleY(.8); border-style: dashed; }
</style>
