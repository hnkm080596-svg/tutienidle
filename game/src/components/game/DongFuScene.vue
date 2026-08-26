<script setup lang="ts">
// UI redesign — Động Phủ home world background (bản thiết kế mục 2,8):
// nhân vật ngồi xếp bằng tại Linh Nhãn, vòng trận pháp nhẹ dưới chân,
// linh khí bay chậm quanh — thay nền phẳng #0b0b10 cũ của MainScene.vue.
//
// Trigger command wheel (2026-08-26, dong-fu-command-wheel plan
// Workstream A/B) — .home-player giờ là NÚT BẮM render PlayerPortrait
// (PNG tĩnh player-mortal-cultivate-v1 + chuyển động CSS), là trigger
// DUY NHẤT mở command wheel nhiều tầng. Không còn atlas idle/cultivate
// qua AtlasSprite ở đây nữa.
//
// Art base thật (2026-08-26 — thay thế HOÀN TOÀN nền CSS cũ):
// thanh-van-dong-fu-base.png cover-fit làm lớp nền chính của Động Phủ.
// Ảnh nằm TRÊN các div sky/mountains/ground CSS (fallback khi ảnh đang
// load) và DƯỚI linh nhãn/particle/nhân vật/vignette. Trước đây ảnh này
// được mount ở Phaser MainScene.ts nhưng bị chính overlay DOM opaque
// của component này che KÍN (.home-scene position:absolute đè lên canvas
// static) — giờ DOM là chủ sở hữu duy nhất của background để không duy
// trì hai pipeline render song song.
import { useStageActive } from '@/composables/useStageActive'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import PlayerPortrait from '../common/PlayerPortrait.vue'

const BASE_IMAGE_URL = '/assets/backgrounds/dong-fu/thanh-van-dong-fu-master-buildings-v1.png'

const stageActive = useStageActive()

const player = usePlayerStore()

const ui = useUiStore()
</script>

<template>
  <div v-if="!stageActive" class="home-scene">
    <!-- Fallback gradient cũ — chỉ nhìn thấy trong lúc ảnh base đang load. -->
    <div class="home-scene__sky" />
    <div class="home-scene__mountains home-scene__mountains--far" />
    <div class="home-scene__mountains" />
    <div class="home-scene__ground" />

    <img
      class="home-scene__base"
      :src="BASE_IMAGE_URL"
      alt=""
      draggable="false"
      decoding="async"
    />

    <div class="home-linhnhan">
      <div class="home-linhnhan__glow" />
      <div class="home-linhnhan__ring home-linhnhan__ring--outer" />
      <div class="home-linhnhan__ring home-linhnhan__ring--mid" />
      <div class="home-linhnhan__ring home-linhnhan__ring--inner" />
    </div>

    <div class="home-motes">
      <span style="left: 44%; top: 54%; --mx: 14px; --my: -18px; animation-delay: 0s;" />
      <span style="left: 58%; top: 58%; --mx: -12px; --my: -16px; animation-delay: 1.4s;" />
      <span style="left: 50%; top: 66%; --mx: 10px; --my: -22px; animation-delay: 2.8s;" />
      <span style="left: 52%; top: 50%; --mx: -16px; --my: -14px; animation-delay: 4.1s;" />
    </div>

    <div class="home-player">
      <!-- Command wheel trigger (plan Workstream A/B) — ảnh tu luyện
           PNG tĩnh mới + chuyển động CSS, là trigger DUY NHẤT mở wheel.
           Nút thật (aria-label/focus-visible) cho bàn phím/touch. -->
      <button
        type="button"
        class="home-player__trigger"
        :class="{ 'is-wheel-open': ui.isCommandWheelOpen }"
        aria-label="Mở bảng lệnh Động Phủ"
        :aria-expanded="ui.isCommandWheelOpen"
        @click.stop="ui.toggleCommandWheel()"
      >
        <PlayerPortrait variant="cultivate" :animated="true" :height="239" />
      </button>
    </div>

    <div class="home-scene__vignette" />
  </div>
</template>

<style scoped>
.home-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: var(--ink-950);
}

.home-scene__sky {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #0c0d14 0%, #14141d 38%, #1a1a24 62%, #201d1a 100%);
}

.home-scene__mountains {
  position: absolute;
  left: 0;
  right: 0;
  top: 28%;
  height: 32%;
  background-color: #16161e;
  opacity: 0.9;
  clip-path: polygon(0% 100%, 0% 62%, 9% 40%, 18% 58%, 27% 30%, 38% 52%, 48% 22%, 60% 50%, 71% 34%, 82% 56%, 91% 38%, 100% 60%, 100% 100%);
}

.home-scene__mountains--far {
  top: 32%;
  height: 30%;
  background-color: #101017;
  opacity: 0.75;
  clip-path: polygon(0% 100%, 0% 74%, 12% 56%, 24% 70%, 36% 48%, 50% 66%, 63% 46%, 76% 68%, 88% 52%, 100% 72%, 100% 100%);
}

.home-scene__ground {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 64%;
  background: linear-gradient(180deg, #17161a 0%, #100f11 55%, #0a0909 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

/* ================= Art base Động Phủ (cover-fit, thay nền CSS) ====== */
/* 1672×941 nguồn — object-fit:cover giữ tỉ lệ, crop phần thừa; nằm
   TRÊN fallback gradient và DƯỚI mọi lớp nội dung (linh nhãn, motes,
   player, vignette) theo thứ tự DOM. */
.home-scene__base {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}

.home-scene__vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 70% 60% at 50% 46%, transparent 55%, rgba(0, 0, 0, 0.5) 100%);
}

/* ================= Linh Nhãn — vòng trận pháp dưới chân nhân vật ================= */
.home-linhnhan {
  position: absolute;
  left: 50%;
  top: 78%;
  width: 22%;
  aspect-ratio: 3 / 1;
  transform: translate(-50%, -50%);
}

.home-linhnhan__glow {
  position: absolute;
  inset: -30%;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(255, 213, 79, 0.14), rgba(66, 165, 245, 0.07) 55%, transparent 75%);
  filter: blur(6px);
}

.home-linhnhan__ring {
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 50%;
  border: 1px solid rgba(255, 213, 79, 0.3);
  transform: translate(-50%, -50%) perspective(320px) rotateX(64deg);
}

.home-linhnhan__ring--outer {
  width: 100%;
  height: 300%;
  border-color: rgba(91, 155, 213, 0.25);
  animation: home-pulse 4.5s ease-in-out infinite;
}

.home-linhnhan__ring--mid {
  width: 74%;
  height: 220%;
  border-color: rgba(255, 213, 79, 0.32);
}

.home-linhnhan__ring--inner {
  width: 46%;
  height: 140%;
  border-color: rgba(255, 213, 79, 0.48);
  animation: home-pulse 3.2s ease-in-out infinite reverse;
}

@keyframes home-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

/* ================= Linh khí particle quanh nhân vật ================= */
.home-motes {
  position: absolute;
  inset: 0;
}

.home-motes span {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--gold-300);
  box-shadow: 0 0 6px 2px var(--gold-300);
  animation: home-mote 7s ease-in-out infinite;
}

@keyframes home-mote {
  0%, 100% { transform: translate(0, 0); opacity: 0.15; }
  50% { transform: translate(var(--mx, 14px), var(--my, -18px)); opacity: 0.85; }
}

/* ================= Nhân vật — trigger command wheel ================= */
/* PNG tu luyện mới (player-mortal-cultivate-v1) qua PlayerPortrait —
   chuyển động float/breathe/aura sống trong component đó; khối này chỉ
   định vị tâm màn hình và hit target. */
.home-player {
  position: absolute;
  left: 50%;
  top: 66%;
  transform: translate(-50%, -50%);
}

/* .home-scene pointer-events:none toàn khối — trigger phải tự bật lại
   để nhận click/touch mở command wheel. */
.home-player__trigger {
  display: block;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  /* .home-scene cố ý bỏ hit-test cho toàn bộ art overlay; trigger là
     ngoại lệ tương tác duy nhất nên phải bật lại rõ ràng, giống hotspot. */
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
}

.home-player__trigger:focus-visible {
  outline: 2px solid var(--gold-500);
  outline-offset: 4px;
  border-radius: var(--radius-md);
}

/* Khi wheel mở — aura tăng nhẹ (presentation-only). */
.home-player__trigger.is-wheel-open :deep(.player-portrait__aura) {
  opacity: 1;
  scale: 1.08;
}
</style>
