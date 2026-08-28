<script setup lang="ts">
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

  /** Chiều cao hiển thị (px). Mặc định theo chỗ dùng. */
  height?: number

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
</script>

<template>
  <div
    class="player-portrait"
    :class="[
      `player-portrait--${variant}`,
      { 'is-animated': animated && variant === 'cultivate' },
    ]"
    :style="{ '--portrait-h': `${height}px` }"
  >
    <span v-if="animated && variant === 'cultivate'" class="player-portrait__aura" aria-hidden="true" />
    <span v-if="animated && variant === 'cultivate'" class="player-portrait__qi-ring" aria-hidden="true" />

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
  background: radial-gradient(circle, rgba(255, 213, 79, 0.22), transparent 68%);
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
  border: 1px solid rgba(255, 213, 79, 0.42);
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
}
</style>
