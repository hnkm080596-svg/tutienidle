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
</script>
<template>
  <div class="cf-figure">
    <EntitySpriteCanvas
      v-if="idle"
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
    />
  </div>
</template>
<style scoped>
/* Mock proportions: the figure occupies 73% of the portrait column and
   the sprite scales to fit (object-fit: contain equivalent). The power
   card docks over the bottom edge. */
.cf-figure { position: absolute; left: 0; right: 0; top: 15%; height: 73%; display: flex; align-items: flex-end; justify-content: center; pointer-events: none; }
.cf-figure__sprite { height: 100%; max-width: 100%; object-fit: contain; filter: drop-shadow(0 8px 9px #4a3c3040); }
</style>
