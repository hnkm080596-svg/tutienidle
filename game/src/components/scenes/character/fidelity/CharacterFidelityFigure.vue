<script setup lang="ts">
// G3 figure (Minh ruling R11): the portrait plays the idle clip of the
// player's current dao path - the same animated set the combat scene
// resolves via CHARACTER_RESKIN_MAP. Mortal picks armed/unarmed by the
// basic-skill flag; the_tu keeps the zuofeng placeholder until its art
// lands. Presentation only - reads the store, owns no state.
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import {
  animatedArtFormFor,
  resolvePlayerEntityKey,
} from '@/presentation/art/CombatPresentationCatalogue'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import EntitySpriteCanvas from '@/components/common/EntitySpriteCanvas.vue'

const player = usePlayerStore()

const profile = computed(
  () => PLAYER_VISUAL_PROFILES[player.visualProfileId] ?? PLAYER_VISUAL_PROFILES.mortal,
)

// The same entity key combat resolves for this profile (armed pick included)
// - reskin-mapped profiles animate their own sheet, unmapped profiles fall
// back to their static key's dormant placeholder clips.
const idle = computed(
  () =>
    animatedArtFormFor(
      resolvePlayerEntityKey(profile.value.id, profile.value.combatTextureKey, {
        armed: player.visualArmed,
      }),
    )?.idle,
)

// Combat sizes every art so its opaque figure lands on personHeight (box =
// personHeight/extent.h); here the canvas box is fixed to the zone height so
// the figure would only fill extent.h of it. Scale by 1/extent.h (mortal
// extent.h = 1, no change) to match the combat proportion.
const figureScale = computed(() => {
  const extent = idle.value?.extent
  return extent && extent.h > 0 ? 0.9 / extent.h : 1
})
</script>
<template>
  <div class="cf-figure">
    <EntitySpriteCanvas
      v-if="idle"
      :key="idle.atlasUrl"
      class="cf-figure__sprite"
      :sheet-url="resolveAssetUrl(`/${idle.sheetUrl}`)"
      :atlas-url="resolveAssetUrl(`/${idle.atlasUrl}`)"
      :frame-prefix="idle.framePrefix"
      :frame-suffix="idle.frameSuffix"
      :zero-pad="idle.zeroPad"
      :first-frame="idle.firstFrame"
      :last-frame="idle.lastFrame"
      :fps="idle.frameRate ?? 8"
      height="100%"
      :style="{ '--cf-figure-scale': figureScale }"
    />
  </div>
</template>
<style scoped>
/* Figure zone (Minh ruling): bottom edge rests on the power card's top
   border (~18% of the column), top starts just below the realm/path
   line so the head never covers the dao text. Sprite is bottom-aligned
   and scales to fit. */
.cf-figure { position: absolute; left: 0; right: 0; top: 14%; bottom: 18%; display: flex; align-items: flex-end; justify-content: center; pointer-events: none; }
/* No max-width clamp: height-driven sizing keeps the canvas aspect, and
   scale(1/extent.h) makes every profile's figure fill the zone height like
   mortal's full-height art. A width clamp would letterbox wide canvases
   (phap_tu's square cells) and shrink the figure below the zone. */
.cf-figure__sprite { height: 100%; width: auto; transform: translateX(-14px) scale(var(--cf-figure-scale, 1)); transform-origin: 50% 100%; filter: drop-shadow(0 8px 9px #4a3c3040); }
</style>
