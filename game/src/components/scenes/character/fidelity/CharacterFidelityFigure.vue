<script setup lang="ts">
import EntitySpriteCanvas from '@/components/common/EntitySpriteCanvas.vue'
import { CHARACTER_ART } from './characterUi'
</script>
<template>
  <div class="cf-figure">
    <div class="cf-aura" aria-hidden="true"><i /><i /></div>
    <img class="cf-person" :src="CHARACTER_ART.figure" alt="" draggable="false">
    <!-- Effect slot: the kept position on the character's hand (the old
         he-kim spot). Fire 9's 27-frame fireball loop sits here as the
         held flame. -->
    <EntitySpriteCanvas
      class="cf-effect-fire"
      sheet-url="/assets/vfx/spritesheets/火 (9).png"
      atlas-url="/assets/vfx/hoa-cau-thuat/fire-9.atlas.json"
      frame-prefix="frame_"
      frame-suffix=""
      :zero-pad="0"
      :first-frame="0"
      :last-frame="26"
      :fps="24"
      :height="96"
      aria-hidden="true"
    />
  </div>
</template>
<style scoped>
.cf-figure { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.cf-person { position: absolute; left: 310px; top: 215px; width: 580px; height: 535px; object-fit: contain; filter: drop-shadow(0 8px 9px #4a3c3040); }
.cf-aura { position: absolute; left: 438px; top: 185px; width: 420px; height: 375px; border: 1px solid #b8893d; border-radius: 50%; box-shadow: 0 0 22px #ffd98f88, inset 0 0 25px #ffe5a277; background: radial-gradient(ellipse,#e6c26d33,transparent 68%); }
.cf-aura i { position: absolute; inset: 25px; border: 1px solid #d6a95a; border-radius: 50%; transform: rotate(-25deg) scaleY(.65); box-shadow: 0 0 7px #ffe8a7; }
.cf-aura i + i { inset: 44px; transform: rotate(32deg) scaleY(.8); border-style: dashed; }
/* Held flame on the hand - centered on the old he-kim socket point.
   The Fire 9 cells are 4:3, so ~96px tall reads as a palm-sized orb. */
.cf-effect-fire {
  position: absolute; left: 803px; top: 411px;
  transform: translate(-50%,-50%);
  filter: drop-shadow(0 0 10px #ffb13d88) drop-shadow(0 0 22px #ff7a1f44);
}
</style>
