<script setup lang="ts">
withDefaults(defineProps<{
  leftMountain?: boolean
  rightMountain?: boolean
  bottomMist?: boolean
  bamboo?: boolean
  seal?: 'none' | 'small' | 'large'
}>(), {
  leftMountain: true,
  rightMountain: false,
  bottomMist: true,
  bamboo: false,
  seal: 'none',
})

const overlayRoot = '/assets/ui/ink-wash/overlays'
</script>

<template>
  <div class="ink-wash-backdrop" aria-hidden="true" style="pointer-events: none">
    <img
      v-if="leftMountain"
      class="ink-wash-backdrop__layer ink-wash-backdrop__mountain-left"
      :src="`${overlayRoot}/wash-corner-mountain-left.png`"
      alt=""
      aria-hidden="true"
      draggable="false"
    >
    <img
      v-if="rightMountain"
      class="ink-wash-backdrop__layer ink-wash-backdrop__mountain-right"
      :src="`${overlayRoot}/wash-corner-mountain-right.png`"
      alt=""
      aria-hidden="true"
      draggable="false"
    >
    <img
      v-if="bottomMist"
      class="ink-wash-backdrop__layer ink-wash-backdrop__mist"
      :src="`${overlayRoot}/wash-bottom-mist.png`"
      alt=""
      aria-hidden="true"
      draggable="false"
    >
    <img
      v-if="bamboo"
      class="ink-wash-backdrop__layer ink-wash-backdrop__bamboo"
      :src="`${overlayRoot}/wash-bamboo-right.png`"
      alt=""
      aria-hidden="true"
      draggable="false"
    >
    <img
      v-if="seal !== 'none'"
      class="ink-wash-backdrop__layer ink-wash-backdrop__seal"
      :class="`ink-wash-backdrop__seal--${seal}`"
      :src="`${overlayRoot}/seal-cinnabar-${seal}.png`"
      alt=""
      aria-hidden="true"
      draggable="false"
    >
  </div>
</template>

<style scoped>
.ink-wash-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  isolation: isolate;
}

.ink-wash-backdrop__layer {
  position: absolute;
  display: block;
  max-width: none;
  mix-blend-mode: multiply;
}

.ink-wash-backdrop__mountain-left {
  left: 0;
  bottom: 0;
  width: clamp(30rem, 64vw, 92rem);
  opacity: 0.52;
}

.ink-wash-backdrop__mountain-right {
  right: 0;
  bottom: 0;
  width: clamp(28rem, 58vw, 84rem);
  opacity: 0.34;
}

.ink-wash-backdrop__mist {
  right: -2%;
  bottom: -1%;
  width: clamp(48rem, 104%, 120rem);
  opacity: 0.42;
}

.ink-wash-backdrop__bamboo {
  top: 0;
  right: 0;
  height: clamp(28rem, 82%, 70rem);
  opacity: 0.44;
}

.ink-wash-backdrop__seal {
  right: clamp(1rem, 4vw, 4rem);
  bottom: clamp(1rem, 4vh, 3.5rem);
  opacity: 0.64;
  mix-blend-mode: multiply;
}

.ink-wash-backdrop__seal--small {
  width: clamp(2.75rem, 5vw, 4.5rem);
}

.ink-wash-backdrop__seal--large {
  width: clamp(5rem, 10vw, 9rem);
  opacity: 0.26;
}

@media (max-aspect-ratio: 1 / 1) {
  .ink-wash-backdrop__mountain-left,
  .ink-wash-backdrop__mountain-right {
    width: clamp(32rem, 92vw, 58rem);
  }

  .ink-wash-backdrop__bamboo {
    height: clamp(24rem, 58%, 42rem);
  }
}
</style>
