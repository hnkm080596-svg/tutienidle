<script setup lang="ts">
// Scene 14 scroll furniture: the jade/gold end-roller caps on both
// sides of the ceremonial scroll, with the hanging tassel ornament.
// Uses the ready `imperial-scroll-roller` chrome (mirrored for the
// right side); the tassel is temp CSS until authored.
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const props = defineProps<{ side: 'left' | 'right' }>()

const rollerUrl = hkChromeUrl('imperial-scroll-roller')
</script>

<template>
  <div
    class="victory-roller"
    :class="`victory-roller--${props.side}`"
    :data-art-id="`victory-roller-${props.side}`"
    aria-hidden="true"
  >
    <img v-if="rollerUrl" class="victory-roller__art" :src="rollerUrl" alt="" />
    <span class="victory-roller__cap victory-roller__cap--top" />
    <span class="victory-roller__cap victory-roller__cap--bottom" />
    <span class="victory-roller__tassel art-needed" :data-art-id="`victory-tassel-${props.side}`">
      <span class="victory-roller__cord" />
      <span class="victory-roller__tassel-head" />
      <span class="victory-roller__tassel-body" />
    </span>
  </div>
</template>

<style scoped>
.victory-roller {
  position: absolute;
  top: 8%;
  bottom: 4%;
  width: 54px;
  pointer-events: none;
  z-index: 4;
}
.victory-roller--left { left: -30px; }
.victory-roller--right { right: -30px; }
.victory-roller--right .victory-roller__art { transform: scaleX(-1); }

.victory-roller__art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

/* Temp CSS caps while the authored roller art is pending. */
.victory-roller__cap {
  position: absolute;
  left: 50%;
  width: 30px;
  height: 14px;
  transform: translateX(-50%);
  border-radius: 50%;
  border: 1px solid var(--hk-border-ceremony, #b99a55);
  background: radial-gradient(ellipse at 40% 30%, #3d6a5c 0%, var(--hk-jade, #315f55) 60%, #1c332c 100%);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}
.victory-roller__cap--top { top: -4px; }
.victory-roller__cap--bottom { bottom: -4px; }

.victory-roller__tassel {
  position: absolute;
  top: 30%;
  width: 22px;
  height: 90px;
}
.victory-roller--left .victory-roller__tassel { left: -14px; }
.victory-roller--right .victory-roller__tassel { right: -14px; }
.victory-roller__cord {
  position: absolute;
  left: 50%;
  top: 0;
  width: 2px;
  height: 34px;
  transform: translateX(-50%);
  background: linear-gradient(180deg, var(--hk-gold, #b99a55), #7a5a2e);
}
.victory-roller__tassel-head {
  position: absolute;
  left: 50%;
  top: 32px;
  width: 10px;
  height: 10px;
  transform: translateX(-50%) rotate(45deg);
  border: 1px solid var(--hk-border-ceremony, #b99a55);
  background: var(--hk-jade, #315f55);
}
.victory-roller__tassel-body {
  position: absolute;
  left: 50%;
  top: 44px;
  width: 16px;
  height: 42px;
  transform: translateX(-50%);
  border-radius: 8px 8px 10px 10px;
  background: linear-gradient(180deg, var(--hk-cinnabar, #b54432) 0%, #6e2418 100%);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
}
</style>
