<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { symbolUrl, type DongFuUiAction } from './dongFuUi'
const props = defineProps<{ actions: readonly DongFuUiAction[]; selected: string | null; open: boolean }>()
const emit = defineEmits<{ action: [id: string] }>()
const { t } = useI18n()
// Single-ring wheel: every action rides the SAME painted orbit (r187 in
// the 420px box, center 210,210). The old two-ring layout let outer orbs
// overlap inner ones and steal their clicks; one ring with even 360/N
// spacing makes orb overlap impossible (adjacent chord >= 83px > 73px
// orb for the max 14 renderable slots). All coords are design-canvas px
// (SceneDesignCanvas scales 1440x810 uniformly to the viewport).
const RING_RADIUS = 187
const RING_CENTER = 210
const ORB_HALF = 36.5
const nodes = computed(() => {
  const step = 360 / Math.max(props.actions.length, 1)
  return props.actions.map((action, index) => {
    const angle = ((-90 + index * step) * Math.PI) / 180
    return {
      ...action,
      x: RING_CENTER + Math.cos(angle) * RING_RADIUS,
      y: RING_CENTER + Math.sin(angle) * RING_RADIUS,
    }
  })
})
function activate(node: DongFuUiAction) {
  if (node.disabledReason) return
  emit('action', node.id)
}
</script>
<template>
  <nav v-show="open" class="df-wheel" :aria-label="t('dongFu.aria')">
    <div class="df-wheel__orbit" aria-hidden="true" />
    <span
      v-for="node in nodes"
      :key="node.id"
      class="df-node"
      :class="{ 'is-selected': selected === node.id, 'is-active': node.active, 'is-disabled': node.disabledReason }"
      :style="{ left: `${node.x - 52}px`, top: `${node.y - ORB_HALF}px` }"
    >
      <button
        class="df-node__orb"
        :aria-pressed="selected === node.id"
        :aria-disabled="node.disabledReason ? true : undefined"
        :title="node.disabledReason ?? undefined"
        :data-wheel-slot="node.id"
        @click="activate(node)"
      >
        <img :src="symbolUrl(node.symbol)" alt=""><i v-if="node.badge" class="df-node__badge" :class="`df-node__badge--${node.badge}`" aria-hidden="true" />
      </button>
      <span class="df-node__label">{{ t(node.labelKey) }}</span>
    </span>
  </nav>
</template>
<style scoped>
.df-wheel { position: absolute; left: 490px; top: 275px; width: 420px; height: 420px; z-index: 3; pointer-events: none; }
.df-wheel__orbit { position: absolute; inset: 23px; border-radius: 50%; border: 1px solid #ffe6a1b0; box-shadow: 0 0 8px #eabc624d, inset 0 0 8px #ffefb929; }
.df-wheel__orbit::after { content: ''; position: absolute; inset: -9px; border-radius: 50%; border: 1px dashed #e6c77970; }
/* Position anchor only: no transform (transforms create a stacking
   context that would trap the orb's z-index) and no pointer-events -
   the orb disc is the sole click target for its slot. */
.df-node { position: absolute; width: 104px; height: 98px; pointer-events: none; color: #f6e9c9; }
.df-node__orb { position: absolute; left: 15.5px; top: 0; z-index: 2; width: 73px; height: 73px; padding: 0; border-radius: 50%; border: 2px solid #e1c477; background: radial-gradient(circle,#574015 0%,#171c15 46%,#060c0c 69%,#9b7433 72%,#14190f 78%); box-shadow: 0 0 0 3px #1f1f15, 0 0 0 4px #bc9859, 0 0 13px #efca6a99, inset 0 0 9px #ecca7055; display: grid; place-items: center; cursor: pointer; pointer-events: auto; transition: box-shadow 160ms, filter 160ms; }
.df-node__orb img { width: 40px; height: 40px; filter: invert(87%) sepia(41%) saturate(480%) hue-rotate(350deg) drop-shadow(0 0 4px #ffc65b); }
.df-node__badge { position: absolute; top: -2px; right: -2px; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #fff0bd; }
.df-node__badge--dot { background: #ffd766; box-shadow: 0 0 7px #ffc94d; }
.df-node__badge--alert { background: radial-gradient(circle,#ff9a4d,#c43c17); box-shadow: 0 0 10px #ff7a3c; animation: df-badge-pulse 1.6s ease-in-out infinite; }
@keyframes df-badge-pulse { 50% { transform: scale(1.25); } }
/* Labels sit under every orb globally (z-index 1 < orb z-index 2) and
   take no input, so they can never steal a neighboring slot's click. */
.df-node__label { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); z-index: 1; padding: 1px 8px 2px; background: linear-gradient(90deg,transparent,#080f0df5 16%,#080f0df5 84%,transparent); border-bottom: 1px solid #ba965765; white-space: nowrap; font-size: 16px; line-height: 21px; text-shadow: 0 2px 2px #000; pointer-events: none; }
.df-node__orb:hover, .df-node.is-selected .df-node__orb, .df-node.is-active .df-node__orb, .df-node__orb:focus-visible { box-shadow: 0 0 0 3px #746030, 0 0 0 4px #fff2bc, 0 0 25px #ffda84, inset 0 0 18px #dcae6599; filter: brightness(1.15); }
.df-node.is-disabled .df-node__orb { cursor: default; filter: saturate(0.35) brightness(0.8); }
.df-node.is-disabled .df-node__label { opacity: 0.6; }
.df-node.is-disabled .df-node__orb:hover { box-shadow: 0 0 0 3px #1f1f15, 0 0 0 4px #bc9859, 0 0 13px #efca6a99, inset 0 0 9px #ecca7055; filter: saturate(0.35) brightness(0.8); }
@media (prefers-reduced-motion: reduce) { .df-node__orb, .df-node__badge { transition: none; animation: none; } }
</style>
