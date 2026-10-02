<script setup lang="ts">
// Scene 02 scroll dressing — carved corners (delivered corner-ornament
// chrome) plus the pieces Minh still owes: the lantern hooked on the
// scroll's top-right ear and the cinnabar tassel on its right edge.
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const cornerUrl = hkChromeUrl('corner-ornament')
const corners = ['tl', 'tr', 'bl', 'br'] as const
</script>

<template>
  <div class="creation-scroll-ornaments" aria-hidden="true">
    <template v-if="cornerUrl">
      <img
        v-for="corner in corners"
        :key="corner"
        :src="cornerUrl"
        class="creation-scroll-ornaments__corner"
        :class="`creation-scroll-ornaments__corner--${corner}`"
        alt=""
      />
    </template>
    <div
      class="creation-scroll-ornaments__lantern art-needed"
      data-art-id="creation-scroll-lantern"
    />
    <div
      class="creation-scroll-ornaments__tassel art-needed"
      data-art-id="creation-scroll-tassel"
    />
    <div
      class="creation-scroll-ornaments__tassel creation-scroll-ornaments__tassel--left art-needed"
      data-art-id="creation-scroll-tassel"
    />
  </div>
</template>

<style scoped>
.creation-scroll-ornaments {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.creation-scroll-ornaments__corner {
  position: absolute;
  width: clamp(28px, 4.4vw, 52px);
  height: auto;
  opacity: 0.9;
}

.creation-scroll-ornaments__corner--tl { left: 0; top: 0; }
.creation-scroll-ornaments__corner--tr { right: 0; top: 0; transform: scaleX(-1); }
.creation-scroll-ornaments__corner--bl { left: 0; bottom: 0; transform: scaleY(-1); }
.creation-scroll-ornaments__corner--br { right: 0; bottom: 0; transform: scale(-1); }

/* Hanging lantern off the scroll's top-right ear (ref: lit paper lantern
   with cap + ember panes + thread tassel). */
.creation-scroll-ornaments__lantern {
  position: absolute;
  top: -5.5%;
  right: -4.5%;
  width: clamp(46px, 6vw, 74px);
  height: clamp(88px, 11vw, 132px);
  background:
    linear-gradient(180deg, #101718 0 8%, transparent 8%),
    radial-gradient(70% 58% at 50% 40%, rgba(232, 195, 90, 0.95) 18%, rgba(201, 154, 74, 0.85) 55%, rgba(122, 98, 52, 0.6) 100%);
  border-radius: 46% 46% 44% 44% / 38% 38% 52% 52%;
  box-shadow: 0 0 34px rgba(232, 195, 90, 0.4), inset 0 -10px 16px rgba(126, 46, 33, 0.45), inset 0 8px 10px rgba(16, 23, 24, 0.5);
}

.creation-scroll-ornaments__lantern::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -22%;
  width: 3px;
  height: 24%;
  transform: translateX(-50%);
  background: linear-gradient(180deg, #7e2e21, #b54432);
}

/* Cinnabar tassel hanging mid-right edge (ref: red silk tassel on the
   scroll's right rim). */
.creation-scroll-ornaments__tassel {
  position: absolute;
  top: 34%;
  right: -2.8%;
  width: clamp(9px, 1vw, 13px);
  height: clamp(72px, 10vw, 118px);
  border-radius: 40% 40% 46% 46% / 8% 8% 92% 92%;
  background:
    radial-gradient(120% 16% at 50% 0%, #7e2e21 60%, transparent 62%),
    linear-gradient(180deg, #b54432 0%, #7e2e21 84%, #5d231a 100%);
  box-shadow: 2px 4px 10px rgba(5, 8, 9, 0.5);
}

/* Matching tassel on the scroll's left rim (ref: a pair). */
.creation-scroll-ornaments__tassel--left {
  right: auto;
  left: -2.8%;
  top: 30%;
}
</style>
