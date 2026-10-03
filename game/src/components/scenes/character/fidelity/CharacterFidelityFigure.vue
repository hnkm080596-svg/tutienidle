<script setup lang="ts">
import { CHARACTER_ART } from './characterUi'
</script>
<template>
  <div class="cf-figure">
    <div class="cf-aura" aria-hidden="true"><i /><i /></div>
    <img class="cf-person" :src="CHARACTER_ART.figure" alt="" draggable="false">
    <!-- Effect slot: the single kept position on the character's hand
         (the old he-kim spot). Stays as a visible empty socket - a
         pathway-specific effect visual lands here later. -->
    <span class="cf-effect-slot" aria-hidden="true" />
  </div>
</template>
<style scoped>
.cf-figure { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.cf-person { position: absolute; left: 310px; top: 215px; width: 580px; height: 535px; object-fit: contain; filter: drop-shadow(0 8px 9px #4a3c3040); }
.cf-aura { position: absolute; left: 438px; top: 185px; width: 420px; height: 375px; border: 1px solid #b8893d; border-radius: 50%; box-shadow: 0 0 22px #ffd98f88, inset 0 0 25px #ffe5a277; background: radial-gradient(ellipse,#e6c26d33,transparent 68%); }
.cf-aura i { position: absolute; inset: 25px; border: 1px solid #d6a95a; border-radius: 50%; transform: rotate(-25deg) scaleY(.65); box-shadow: 0 0 7px #ffe8a7; }
.cf-aura i + i { inset: 44px; transform: rotate(32deg) scaleY(.8); border-style: dashed; }
/* Empty socket on the hand - etched dashed ring, same gold/parchment
   palette as the scene chrome. Non-interactive until a real effect
   visual replaces it. */
.cf-effect-slot {
  position: absolute; left: 803px; top: 411px; width: 66px; height: 66px;
  transform: translate(-50%,-50%);
  border: 2px dashed #b8893dcc; border-radius: 50%;
  background: radial-gradient(circle, #1d151022, #1d15104d 75%);
  box-shadow: inset 0 0 12px #b8893d40, 0 0 9px #ffd98f33;
}
</style>
