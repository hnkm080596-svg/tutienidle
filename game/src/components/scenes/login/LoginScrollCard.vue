<script setup lang="ts">
// Scene 01 auth-scroll region (spec: auth-scroll 1016/120/560/700, z10,
// padding 32, shell-scroll family). Paints the delivered scroll chrome
// (surface-xl-scroll + frame-xl-ceremony) plus corner ornaments and the
// two hanging props the ref shows on the frame edge.
//
// TEMP ART - surfaces marked .art-needed carry a data-art-id into
// game/docs/design/art-requests/01-login.md and render a CSS stand-in in
// the Huyen Kim palette (ink #101718 / jade #315f55 / gold #b99a55 /
// ivory paper) until Minh's final prop art lands.
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const cornerOrnamentUrl = hkChromeUrl('corner-ornament')
</script>

<template>
  <div class="login-scroll">
    <section class="auth-card" data-hk-region="auth-card">
      <InkNineSlice chrome-id="surface-xl-scroll" layer="surface" />
      <InkNineSlice chrome-id="frame-xl-ceremony" layer="frame" />

      <img
        v-if="cornerOrnamentUrl"
        v-for="corner in ['tl', 'tr', 'bl', 'br']"
        :key="corner"
        class="auth-card__corner"
        :class="`auth-card__corner--${corner}`"
        :src="cornerOrnamentUrl"
        alt=""
        aria-hidden="true"
      />

      <!-- Ref interior art: faint ink-mountain wash inside the parchment's
           lower area, under the content. -->
      <span class="auth-card__inkwash art-needed" data-art-id="login-card-inkwash" aria-hidden="true" />

      <div class="auth-card__content">
        <slot />
      </div>
    </section>

    <!-- Ref-only frame props: lantern pendant top-left, jade tassel top-right
         edge. Siblings of the scrollable card so they can overhang the frame
         without being clipped by its overflow-y:auto. -->
    <span class="login-scroll__prop login-scroll__prop--lantern art-needed" data-art-id="login-scroll-lantern" aria-hidden="true" />
    <span class="login-scroll__prop login-scroll__prop--tassel art-needed" data-art-id="login-scroll-tassel" aria-hidden="true" />
  </div>
</template>

<style scoped>
/* Scene 01 spec: vista dominant; auth scroll card right-of-center.
   Design 1672x941: card x=1016 w=560 h=700 -> 5.7% right margin,
   ~33.5% width, ~74% height centered. Recenters at <=900px. */
.login-scroll {
  position: relative;
  z-index: 1;
  margin-right: clamp(20px, 5.7vw, 96px);
}
@media (max-width: 900px) {
  .login-scroll {
    margin-right: 0;
  }
}
.auth-card {
  position: relative;
  isolation: isolate;
  width: clamp(430px, 33.5vw, 560px);
  max-height: 88vh;
  box-sizing: border-box;
  text-align: center;
  overflow-y: auto;
  scrollbar-width: none;
}
.auth-card::-webkit-scrollbar {
  display: none;
}
@media (max-width: 900px) {
  .auth-card {
    width: min(560px, calc(100vw - 40px));
  }
}
/* surface-xl-scroll's frame occupies ~12% of each side and ~15% top/
   bottom at this size; content padding keeps everything inside the
   paper's inner safe area (spec content width 496). */
.auth-card__content {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1.5vh, 16px);
  padding: clamp(46px, 7vh, 72px) clamp(56px, 5.6vw, 80px) clamp(40px, 5.5vh, 60px);
}

.auth-card__corner {
  position: absolute;
  z-index: 2;
  width: 64px;
  height: 64px;
  pointer-events: none;
}
.auth-card__corner--tl { top: 4px; left: 4px; }
.auth-card__corner--tr { top: 4px; right: 4px; transform: scaleX(-1); }
.auth-card__corner--bl { bottom: 4px; left: 4px; transform: scaleY(-1); }
.auth-card__corner--br { bottom: 4px; right: 4px; transform: scale(-1); }

/* Faint ink-mountain wash inside the parchment (temp art). Sits under
   the content wrapper (z3) and above the paper surface (z1). */
.auth-card__inkwash {
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: 5%;
  height: 30%;
  z-index: 2;
  pointer-events: none;
  opacity: 0.16;
  background: linear-gradient(180deg, transparent 30%, #101718 92%);
  clip-path: polygon(
    0 100%, 0 66%, 8% 42%, 16% 62%, 24% 34%, 33% 56%, 42% 26%,
    50% 52%, 58% 30%, 67% 54%, 76% 36%, 84% 58%, 92% 44%, 100% 62%,
    100% 100%
  );
}

/* TEMP ART (art-needed) ------------------------------------------------ */
.art-needed {
  outline: 1px dashed color-mix(in srgb, #b99a55 65%, transparent);
  outline-offset: -1px;
}

/* Hanging lantern at the frame's top-left edge (ref: glowing gold
   lantern on a chain outside the scroll's left roller). Positioned on
   the non-clipping wrapper so it overhangs the frame edge. */
.login-scroll__prop {
  position: absolute;
  z-index: 2;
  pointer-events: none;
}
.login-scroll__prop--lantern {
  left: -14px;
  top: 22px;
  width: 26px;
  height: 52px;
}
.login-scroll__prop--lantern::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  width: 2px;
  height: 10px;
  background: #b99a55;
  transform: translateX(-50%);
}
.login-scroll__prop--lantern::after {
  content: '';
  position: absolute;
  inset: 10px 0 0;
  border-radius: 10px;
  background:
    radial-gradient(60% 45% at 50% 42%, rgba(255, 214, 130, 0.95), rgba(232, 195, 90, 0.55) 55%, transparent 78%),
    linear-gradient(180deg, #b99a55, #315f55 85%);
  border: 1px solid #b99a55;
  box-shadow: 0 0 14px rgba(232, 195, 90, 0.55);
}
.login-scroll__prop--tassel {
  right: -10px;
  top: 26%;
  width: 18px;
  height: 86px;
}
.login-scroll__prop--tassel::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #315f55;
  border: 1px solid #b99a55;
  transform: translateX(-50%);
  box-shadow: 0 0 8px rgba(63, 166, 139, 0.5);
}
.login-scroll__prop--tassel::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 14px;
  bottom: 0;
  width: 7px;
  transform: translateX(-50%);
  background: linear-gradient(180deg, #315f55, #101718);
  border: 1px solid color-mix(in srgb, #b99a55 70%, #315f55);
  border-radius: 0 0 4px 4px;
}
</style>
