<script setup lang="ts">
// Scene 14 section header: the small ornamental plaque splitting the
// scroll ("Phan Thuong Nhan Duoc" / "Tang Truong") - section-plaque art
// with divider tails on both sides.
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const plaqueUrl = hkChromeUrl('section-plaque')
const dividerUrl = hkChromeUrl('divider-ornament')
</script>

<template>
  <div class="victory-plaque art-needed" :data-art-id="`victory-section-plaque`">
    <img v-if="dividerUrl" class="victory-plaque__tail" :src="dividerUrl" alt="" aria-hidden="true" />
    <span class="victory-plaque__chip">
      <img v-if="plaqueUrl" class="victory-plaque__art" :src="plaqueUrl" alt="" aria-hidden="true" />
      <span class="victory-plaque__label"><slot /></span>
    </span>
    <img v-if="dividerUrl" class="victory-plaque__tail victory-plaque__tail--flip" :src="dividerUrl" alt="" aria-hidden="true" />
  </div>
</template>

<style scoped>
.victory-plaque {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0;
}
.victory-plaque__tail {
  flex: 1;
  min-width: 0;
  height: 14px;
  object-fit: fill;
  opacity: 0.85;
}
.victory-plaque__tail--flip { transform: scaleX(-1); }

.victory-plaque__chip {
  position: relative;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  min-width: 150px;
  padding: 5px 26px;
}
.victory-plaque__art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}
.victory-plaque__label {
  position: relative;
  font-family: var(--font-display, serif);
  font-weight: 700;
  font-size: var(--text-sm);
  letter-spacing: 0.1em;
  color: var(--hk-gold-radiant, #f4d98b);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
</style>
