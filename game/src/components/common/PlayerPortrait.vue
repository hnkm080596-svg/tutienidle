<script setup lang="ts">
import { computed } from 'vue'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import {
  animatedArtFormFor,
  resolvePlayerEntityKey,
} from '@/presentation/art/CombatPresentationCatalogue'
import {
  getCultivateTexture,
  PLAYER_VISUAL_PROFILES,
} from '@/presentation/art/PlayerVisualProfiles'
import { usePlayerStore } from '@/stores/player'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import EntitySpriteCanvas from './EntitySpriteCanvas.vue'

// Trinh bay nhan vat dung CHUNG (plan Workstream A) - mode-aware figure:
// static mode draws a PNG; animated mode draws EntitySpriteCanvas (atlas
// clip). Variants pick WHICH art, not the mode:
// - variant 'cultivate' -> cultivate PNG / cultivate bridge multiatlas,
//   giua Dong Phu (trigger command wheel), CO chuyen dong CSS khi animated.
// - variant 'portrait'  -> portrait PNG / mortal idle clip, tab Nhan Vat.
//
// Chuyen dong chi-Presentation (cultivate + animated):
// - Float doc nhe 3-5px, chu ky cham; nhip tho scale 1 -> 1.015.
// - Aura pulse DOC LAP (khong scale toan bo hit target).
// - Vong linh khi duoi chan mo rong/nhat dan theo chu ky.
// - KHONG sway ngang/rotate/tilt.
// - prefers-reduced-motion: reduce -> tat float/scale/rings, rut ngan transition.
export interface PlayerPortraitProps {
  variant: 'cultivate' | 'portrait'

  /** Chieu cao hien thi - so (px) hoac chuoi CSS length (vd clamp(...)). */
  height?: number | string

  /** Chi variant 'cultivate' honor co nay. */
  animated?: boolean
}

const props = withDefaults(defineProps<PlayerPortraitProps>(), {
  height: 239,

  animated: false,
})

// Profile-derived art (art-seam wave, user ruling Q4 2026-09-29): the
// same statics the visual profile publishes, not a hard-coded mortal URL
// (the old table also pinned cultivate to the dead v1 while the profile
// carried v2).
const player = usePlayerStore()

const profile = computed(
  () => PLAYER_VISUAL_PROFILES[player.visualProfileId] ?? PLAYER_VISUAL_PROFILES.mortal,
)

const imageUrl = computed(() =>
  props.variant === 'cultivate'
    // getCultivateTexture is the single authority - hidden-way override
    // wins, then the profile's own cultivate PNG, then mortal's.
    ? getCultivateTexture(profile.value, player.cultivationWay ?? undefined).url
    : profile.value.combatTextureUrl,
)

// Animated mode - the figure plays the same clips combat would. `portrait`
// draws the mortal idle loop from the catalogue's dormant animated form;
// `cultivate` draws the shared 17-frame bridge multiatlas until player
// atlases carry a cultivate clip (uniformity plan, 2026-09-19).
const useCanvas = ENTITY_ART_MODE === 'animated'

// The same entity key combat resolves for this profile - reskin-mapped
// profiles animate their own sheet (armed/unarmed pick included), unmapped
// profiles fall back to their static key's dormant placeholder clips.
const idleClip = computed(
  () =>
    animatedArtFormFor(
      resolvePlayerEntityKey(profile.value.id, profile.value.combatTextureKey, {
        armed: player.visualArmed,
      }),
    )?.idle,
)

const CULTIVATE_BRIDGE = {
  sheetUrl: resolveAssetUrl('/assets/cultivate.png'),
  atlasUrl: resolveAssetUrl('/assets/cultivate.json'),
  framePrefix: 'frame_',
  frameSuffix: '.png',
  zeroPad: 3,
  firstFrame: 0,
  lastFrame: 16,
  fps: 8,
} as const

const canvasProps = computed(() => {
  if (props.variant === 'cultivate') {
    return CULTIVATE_BRIDGE
  }

  return idleClip.value
    ? {
        sheetUrl: idleClip.value.sheetUrl,
        atlasUrl: idleClip.value.atlasUrl,
        framePrefix: idleClip.value.framePrefix,
        frameSuffix: idleClip.value.frameSuffix,
        zeroPad: idleClip.value.zeroPad,
        firstFrame: idleClip.value.firstFrame,
        lastFrame: idleClip.value.lastFrame,
        fps: idleClip.value.frameRate,
      }
    : undefined
})

const portraitHeight = computed(() =>
  typeof props.height === 'number' ? `${props.height}px` : props.height,
)

// Same normalization the doll/fidelity figure surfaces apply: the canvas box
// is fixed to the zone height, so art whose opaque figure fills only
// extent.h of the cell must scale up by 1/extent.h to match combat
// proportions (mortal extent.h = 1 -> no change).
const figureScale = computed(() => {
  const extent = props.variant === 'portrait' ? idleClip.value?.extent : undefined
  return extent && extent.h > 0 ? 0.9 / extent.h : 1
})
</script>

<template>
  <div
    class="player-portrait"
    :class="[
      `player-portrait--${variant}`,
      { 'is-animated': animated && variant === 'cultivate' },
    ]"
    :style="{ '--portrait-h': portraitHeight }"
  >
    <span v-if="animated && variant === 'cultivate'" class="player-portrait__aura" aria-hidden="true" />
    <span v-if="animated && variant === 'cultivate'" class="player-portrait__qi-ring" aria-hidden="true" />
    <span v-if="variant === 'portrait'" class="player-portrait__taiji" aria-hidden="true" />

    <EntitySpriteCanvas
      v-if="useCanvas && canvasProps"
      :key="`${variant}:${canvasProps.atlasUrl}`"
      v-bind="canvasProps"
      :height="height"
      class="player-portrait__image"
      :style="{ '--portrait-figure-scale': figureScale }"
    />
    <img
      v-else
      class="player-portrait__image"
      :src="imageUrl"
      alt=""
      draggable="false"
      decoding="async"
    />
  </div>
</template>

<style scoped>
.player-portrait {
  position: relative;
  height: var(--portrait-h);
  aspect-ratio: auto;
  display: inline-block;
}

.player-portrait__image {
  position: relative;
  z-index: 2;
  height: 100%;
  width: auto;
  display: block;
  user-select: none;
}

/* ================= Portrait - circular disc + taiji ring ============
   User art pass: avatar sits on a circular disc; a black/white dual
   arc (yin-yang sweep) orbits the rim. The ring band is cut out of a
   conic-gradient with a mask so the two arcs stay translucent and the
   disc rim keeps contrast under both. */
.player-portrait--portrait {
  aspect-ratio: 1;
}

.player-portrait--portrait::before {
  content: '';
  position: absolute;
  inset: 4%;
  z-index: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 34%, var(--surface-600), var(--surface-800) 62%, var(--surface-950) 92%);
  box-shadow:
    inset 0 0 0 1px var(--surface-line),
    0 0 14px rgba(0, 0, 0, 0.4);
}

.player-portrait--portrait .player-portrait__image {
  height: 92%;
  margin: 4% auto 0;
}

/* Canvas path only (animated mode): grow the fixed-height box so the
   opaque figure fills the disc like mortal's art; the overhang is the
   cell's transparent margin, so nothing visible leaves the disc. */
canvas.player-portrait__image {
  transform: scale(var(--portrait-figure-scale, 1));
  transform-origin: 50% 100%;
}

.player-portrait__taiji {
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(255, 255, 255, 0.9) 60deg,
    transparent 120deg,
    transparent 180deg,
    rgba(8, 8, 12, 0.95) 240deg,
    transparent 300deg,
    transparent 360deg
  );
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
  animation: player-portrait-taiji-spin 10s linear infinite;
  pointer-events: none;
  /* Ambient white halo keeps the dark arc readable against the dark
     drawer behind the disc rim. */
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.3));
}

@keyframes player-portrait-taiji-spin {
  to { transform: rotate(360deg); }
}

/* ================= Chuyen dong tu luyen (chi cultivate) ============= */
.is-animated .player-portrait__image {
  animation:
    player-portrait-float 6s ease-in-out infinite,
    player-portrait-breathe 5s ease-in-out infinite;
  will-change: transform;
}

/* Aura pulse DOC LAP - khong scale hit target. */
.player-portrait__aura {
  position: absolute;
  inset: -18% -30%;
  z-index: 1;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--chrome-500) 22%, transparent), transparent 68%);
  filter: blur(10px);
  animation: player-portrait-aura 5s ease-in-out infinite;
  pointer-events: none;
}

/* Vong linh khi duoi chan - mo rong + nhat dan theo chu ky. */
.player-portrait__qi-ring {
  position: absolute;
  left: 50%;
  bottom: -4%;
  z-index: 0;
  width: 58%;
  aspect-ratio: 3 / 1;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--chrome-500) 42%, transparent);
  transform: translateX(-50%);
  animation: player-portrait-ring 6s ease-out infinite;
  pointer-events: none;
}

@keyframes player-portrait-float {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -4px; }
}

@keyframes player-portrait-breathe {
  0%, 100% { scale: 1; }
  50% { scale: 1.015; }
}

@keyframes player-portrait-aura {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

@keyframes player-portrait-ring {
  0% { opacity: 0.7; scale: 1; }
  70% { opacity: 0.25; }
  100% { opacity: 0; scale: 1.35; }
}

/* Reduced motion - tat float/scale/ring pulse; rut ngan transition. */
@media (prefers-reduced-motion: reduce) {
  .is-animated .player-portrait__image {
    animation: none;
    transition-duration: 0.01ms;
  }

  .player-portrait__aura,
  .player-portrait__qi-ring {
    animation: none;
    opacity: 0.5;
  }

  .player-portrait__taiji {
    animation: none;
  }
}
</style>
