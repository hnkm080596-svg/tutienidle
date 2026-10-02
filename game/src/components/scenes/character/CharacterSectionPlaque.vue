<script setup lang="ts">
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'

// Section header for scene 04 regions: the ornamental "Thuec Tinh
// Chinh"-style title bar from the reference (centered display text
// between hairline flourishes, optional meta slot on the right).
defineProps<{ title: string }>()
</script>

<template>
  <div class="section-plaque">
    <InkNineSlice chrome-id="section-plaque" layer="surface" class="section-plaque__bg" />
    <span class="section-plaque__orn section-plaque__orn--l" aria-hidden="true" />
    <h4 class="section-plaque__title">{{ title }}</h4>
    <span class="section-plaque__orn section-plaque__orn--r" aria-hidden="true" />
    <span v-if="$slots.default" class="section-plaque__meta"><slot /></span>
  </div>
</template>

<style scoped>
.section-plaque {
  position: relative;
  align-self: center;
  width: fit-content;
  min-width: 200px;
  max-width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--hk-space-3, 8px);
  padding: 3px var(--hk-space-4, 12px);
  min-height: 26px;
  margin-inline: auto;
}

.section-plaque__bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* InkNineSlice 'surface' renders at z-index 1 - contents need 2. */
.section-plaque__title {
  position: relative;
  z-index: 2;
  margin: 0;
  font: 700 var(--text-md) var(--font-display);
  letter-spacing: 0.08em;
  color: var(--hk-gold-radiant, #f4d98b);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  white-space: nowrap;
}

/* Flanking hairline flourishes with a center diamond (runtime css). */
.section-plaque__orn {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  width: 44px;
  height: 1px;
  background: linear-gradient(
    to var(--orn-dir, left),
    transparent,
    var(--hk-gold-muted, #b99a55) 70%
  );
}
.section-plaque__orn--l { --orn-dir: left; }
.section-plaque__orn--r { --orn-dir: right; }
.section-plaque__orn::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 5px;
  height: 5px;
  transform: translateY(-50%) rotate(45deg);
  background: var(--hk-gold, #b99a55);
}
.section-plaque__orn--l::after { right: -2px; }
.section-plaque__orn--r::after { left: -2px; }

.section-plaque__meta {
  position: absolute;
  z-index: 2;
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  font: 600 var(--text-xs) var(--font-body);
  color: var(--hk-gold, #b99a55);
  white-space: nowrap;
}
</style>
