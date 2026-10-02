<script setup lang="ts">
// Scene 05 ascent-map rung (spec: nodes = betaRealmLadderNodes() only;
// rune-node family). Ref: numbered medallion riding the glowing trail,
// vertical realm banner plaque hanging beside it. States per matrix
// 2.7: completed jade / current jade+pulse / reachable gold / locked
// ink / release-hidden (parent never renders those).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RealmPassiveNode } from '@/data/realm/RealmPassiveNodes'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const props = defineProps<{
  node: RealmPassiveNode
  index: number
  currentTier: number
  nextTier: number | null
  /** First glyph of the player name, painted on the current rung. */
  sealChar?: string
}>()

const { t } = useI18n()

const runeUrl = hkChromeUrl('rune-node', '1x')

const stateClass = computed(() => ({
  'is-current': props.currentTier === props.node.unlockTier,
  'is-complete': props.currentTier >= props.node.unlockTier,
  'is-locked': props.node.comingSoon,
  'is-next': props.node.unlockTier === props.nextTier,
  'is-future':
    !props.node.comingSoon
    && props.node.unlockTier > props.currentTier
    && props.node.unlockTier !== props.nextTier,
}))

const statusText = computed(() => {
  if (props.node.comingSoon) return t('panels.realm.nodes.comingSoon')
  if (props.currentTier === props.node.unlockTier) return t('panels.realm.nodes.current')
  if (props.currentTier > props.node.unlockTier) return t('panels.realm.nodes.unlocked')
  if (props.node.unlockTier === props.nextTier) return t('panels.realm.nodes.next')
  return t('panels.realm.nodes.locked')
})

const runeMask = computed(() =>
  runeUrl ? { maskImage: `url("${runeUrl}")`, WebkitMaskImage: `url("${runeUrl}")` } : undefined,
)
</script>

<template>
  <div class="realm-node" :class="stateClass">
    <!-- Numbered medallion on the trail: delivered rune-node glyph as the
         ring art + the rung ordinal. -->
    <span class="realm-node__medallion art-needed" data-art-id="realm-node-medallion" aria-hidden="true">
      <i class="realm-node__rune" :style="runeMask" />
      <b>{{ index + 1 }}</b>
    </span>
    <!-- Vertical realm banner plaque hanging beside the trail (ref's
         Truc Khi / Truc Co plaques). -->
    <span class="realm-node__banner art-needed" data-art-id="realm-banner-plaque">
      <span v-if="currentTier === node.unlockTier" class="realm-node__seal" aria-hidden="true">{{ sealChar }}</span>
      <strong>{{ node.label }}</strong>
    </span>
    <!-- Status rides the trail under the medallion, not inside the
         vertical name column (inline strong+small used to interleave
         glyphs into one garbled stream). -->
    <small class="realm-node__status">{{ statusText }}</small>
  </div>
</template>

<style scoped>
/* Rungs sit ON the trail: medallion centered on the spine, banner
   plaque alternating sides. Odd rows lean left, even rows right - the
   zigzag reads as the ref's winding path. */
.realm-node {
  position: relative;
  min-height: 76px;
  display: flex;
  align-items: center;
}

/* --- medallion (art-needed ring; rune glyph delivered) --- */
.realm-node__medallion {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2px solid var(--hk-ink, #5b6266);
  background: radial-gradient(circle at 40% 35%, #223028, #101718 72%);
  box-shadow: 0 0 0 3px var(--hk-surface-base, #0b0f0d), 0 0 10px rgba(0, 0, 0, 0.55);
}
.realm-node__rune {
  position: absolute;
  inset: 6px;
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  background: var(--hk-ink, #5b6266);
  opacity: 0.85;
}
.realm-node__medallion b {
  position: relative;
  z-index: 1;
  font: 700 var(--text-sm) var(--font-display, serif);
  color: var(--hk-text-secondary, #b8ae97);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

/* --- banner plaque (art-needed: vertical hanging realm tag) ---
   ONE upright column: the realm name only. The status used to flow
   inline after it, so both labels interleaved in a single garbled
   glyph stream - it now renders as its own horizontal caption. */
.realm-node__banner {
  position: relative;
  display: block;
  width: 34px;
  min-height: 96px;
  /* Top pad clears the absolute seal badge; bottom pad hangs the tag. */
  padding: 28px 3px 14px;
  writing-mode: vertical-rl;
  text-orientation: upright;
  font: 600 var(--text-xs) var(--font-display, serif);
  color: var(--hk-text-secondary, #b8ae97);
  background: linear-gradient(180deg, #1b2a24, #101718 85%);
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-bottom: 0;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 9px), 50% 100%, 0 calc(100% - 9px));
}
.realm-node__banner strong { font-weight: 700; letter-spacing: 0.08em; white-space: nowrap; }

/* Horizontal status caption under the spine medallion. */
.realm-node__status {
  position: absolute;
  left: 50%;
  top: calc(50% + 26px);
  transform: translateX(-50%);
  z-index: 2;
  padding: 0 6px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 78%, transparent);
  color: var(--hk-text-muted, #7a7260);
  font-size: 10px;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.realm-node:nth-child(odd) .realm-node__banner { margin-left: calc(50% + 34px); }
.realm-node:nth-child(even) .realm-node__banner { order: -1; margin-right: calc(50% + 34px); margin-left: 0; }
.realm-node:nth-child(even) { justify-content: flex-end; }

/* Player seal: absolute badge on the banner head (horizontal-tb
   inside the vertical-rl parent), not a flex column sibling. */
.realm-node__seal {
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  writing-mode: horizontal-tb;
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--hk-border-ceremony, #e8c35a);
  border-radius: 3px;
  background: color-mix(in srgb, var(--hk-jade, #3fa68b) 24%, var(--hk-surface-base, #0b0f0d));
  color: var(--hk-jade-soft, #67c4ab);
  font: 700 var(--text-xs) var(--font-display, serif);
}

/* --- matrix 2.7 state colors --- */
.is-complete .realm-node__medallion { border-color: var(--hk-jade-deep, #1f6b58); }
.is-complete .realm-node__rune { background: var(--hk-jade, #3fa68b); }
.is-complete .realm-node__medallion b,
.is-complete .realm-node__banner strong { color: var(--hk-jade, #3fa68b); }
.is-complete .realm-node__banner { border-color: var(--hk-jade-deep, #1f6b58); }

.is-current .realm-node__medallion {
  border-color: var(--hk-jade, #3fa68b);
  box-shadow: 0 0 0 3px var(--hk-surface-base, #0b0f0d), 0 0 16px var(--hk-glow-jade, rgba(63, 166, 139, 0.5));
}
.is-current .realm-node__rune { background: var(--hk-jade-soft, #67c4ab); }
.is-current .realm-node__medallion b,
.is-current .realm-node__banner strong { color: var(--hk-jade-soft, #67c4ab); }
.is-current .realm-node__banner { border-color: var(--hk-jade, #3fa68b); }
.is-current .realm-node__status { color: var(--hk-jade-soft, #67c4ab); }

.is-next .realm-node__medallion {
  border-color: var(--hk-gold, #c99a4a);
  box-shadow: 0 0 0 3px var(--hk-surface-base, #0b0f0d), 0 0 14px var(--hk-glow-gold, rgba(232, 195, 90, 0.4));
}
.is-next .realm-node__rune { background: var(--hk-gold-bright, #e8c35a); }
.is-next .realm-node__medallion b,
.is-next .realm-node__banner strong { color: var(--hk-gold, #c99a4a); }
.is-next .realm-node__banner { border-color: var(--hk-gold-muted, #7a6234); }
.is-next .realm-node__status { color: var(--hk-gold, #c99a4a); }

.is-future .realm-node__medallion,
.is-future .realm-node__banner { opacity: 0.6; }
.is-locked .realm-node__medallion,
.is-locked .realm-node__banner { filter: grayscale(0.7); opacity: 0.5; }

@container (max-width: 860px) {
  .realm-node { justify-content: flex-start; }
  .realm-node__medallion { left: 10px; transform: translate(0, -50%); }
  .realm-node:nth-child(odd) .realm-node__banner,
  .realm-node:nth-child(even) .realm-node__banner { margin: 0 0 0 40px; order: 0; }
}
</style>
