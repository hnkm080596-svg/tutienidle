<script setup lang="ts">
import { computed } from 'vue'

// Trình bày nhân vật dùng CHUNG (plan Workstream A) — PNG tĩnh mới,
// KHÔNG còn qua AtlasSprite nhiều frame:
// - variant 'cultivate' → player-mortal-cultivate-v1.png, giữa Động Phủ
//   (trigger command wheel), CÓ chuyển động CSS khi animated.
// - variant 'portrait'  → player-mortal-ink-sword-concept-v2.png, tab Nhân Vật,
//   LUÔN ảnh tĩnh (không bao giờ áp animation tu luyện).
//
// Chuyển động chỉ-Presentation (cultivate + animated):
// - Float dọc nhẹ 3-5px, chu kỳ chậm; nhịp thở scale 1 → 1.015.
// - Aura pulse ĐỘC LẬP (không scale toàn bộ hit target).
// - Vòng linh khí dưới chân mở rộng/nhạt dần theo chu kỳ.
// - KHÔNG sway ngang/rotate/tilt.
// - prefers-reduced-motion: reduce → tắt float/scale/rings, rút ngắn transition.
export interface PlayerPortraitProps {
  variant: 'cultivate' | 'portrait'

  /** Chiều cao hiển thị — số (px) hoặc chuỗi CSS length (vd clamp(...)). */
  height?: number | string

  /** Chỉ variant 'cultivate' honor cờ này. */
  animated?: boolean
}

const props = withDefaults(defineProps<PlayerPortraitProps>(), {
  height: 239,

  animated: false,
})

const IMAGE_URLS = {
  cultivate: '/assets/characters/player/mortal/player-mortal-cultivate-v1.png',

  portrait: '/assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png',
} as const

const imageUrl = IMAGE_URLS[props.variant]

const portraitHeight = computed(() =>
  typeof props.height === 'number' ? `${props.height}px` : props.height,
)
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

    <img
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

/* ================= Chuyển động tu luyện (chỉ cultivate) ============= */
.is-animated .player-portrait__image {
  animation:
    player-portrait-float 6s ease-in-out infinite,
    player-portrait-breathe 5s ease-in-out infinite;
  will-change: transform;
}

/* Aura pulse ĐỘC LẬP — không scale hit target. */
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

/* Vòng linh khí dưới chân — mở rộng + nhạt dần theo chu kỳ. */
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

/* Reduced motion — tắt float/scale/ring pulse; rút ngắn transition. */
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
