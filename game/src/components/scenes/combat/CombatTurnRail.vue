<script setup lang="ts">
// Scene 10 turn-strip region (spec: 436/64/800/96, combat family,
// turn-token asset - already delivered via TurnOrderStrip). Ref draws
// a dark rail band behind the ATB portrait chips; temp art below.
import TurnOrderStrip from '@/components/game/combat/TurnOrderStrip.vue'
</script>

<template>
  <div class="combat-turn-rail" data-hk-region="turn-strip">
    <i class="combat-turn-rail__band art-needed" data-art-id="combat-turn-rail-band" aria-hidden="true" />
    <TurnOrderStrip />
  </div>
</template>

<style scoped>
.combat-turn-rail { position: relative; display: flex; justify-content: center; }
/* Ref: dark rail behind the ATB chips (temp art - ornate capsule). */
.combat-turn-rail__band {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  /* Spec turn-band 436/64/800/96 -> ~612x73 at 1280x720; 620x~53 left it
     +10w/-20h off the spec box. */
  width: min(612px, 90%);
  height: 73px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(16, 23, 24, 0.55), rgba(16, 23, 24, 0.3));
  border: 1px solid color-mix(in srgb, var(--hk-border-muted, #2a352f) 70%, transparent);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}
</style>
