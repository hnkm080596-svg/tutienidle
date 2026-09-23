<script setup lang="ts">
import { useId } from 'vue'
import { useSystemRimAuthority } from '@/composables/useSystemRimAuthority'

// SYSTEM surface container (spec 5). variant='primary' marks the panel
// rim-ELIGIBLE; the rim claim is driven solely by rimActive - the parent feeds
// its visible-primary signal (open, characterOverlayOpen). The panel claims /
// promotes while rimActive is true and releases when it flips false or the
// panel unmounts - mounted-but-hidden overlays hold no claim (spec 4.1.1).
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'interactive' | 'flat'
  corners?: boolean
  scanlines?: boolean
  rimActive?: boolean
}>(), {
  variant: 'flat',
  corners: true,
  scanlines: false,
  rimActive: false,
})

// Claimant id captured once per instance; authored string ids ('hud-left')
// are reserved for non-SysPanel surfaces driving the authority directly.
const panelId = useId()
const { isTop } = useSystemRimAuthority(
  panelId,
  () => props.variant === 'primary' && props.rimActive,
)
</script>

<template>
  <section
    class="sys-panel sys-surface"
    :class="{
      'sys-corners': corners,
      'sys-rim': variant === 'primary',
      'sys-rim--live': isTop,
      'sys-bloom': variant === 'interactive',
      'sys-scanlines': scanlines,
      'sys-panel--flat': variant === 'flat',
      'sys-panel--primary': variant === 'primary',
    }"
  >
    <slot />
  </section>
</template>

<style scoped>
/* Safe-degrade fallback (spec 2.3): without system-theme.css the panel still
   reads as a legible bordered box; every visual token read stays --sys-*. */
.sys-panel {
  position: relative;
  border: 1px solid var(--sys-line, transparent);
  color: var(--sys-text, inherit);
}
</style>
