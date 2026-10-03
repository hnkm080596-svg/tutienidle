<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { symbolUrl, type DongFuUiAction } from './dongFuUi'
const props = defineProps<{ actions: readonly DongFuUiAction[]; selected: string | null; open: boolean }>()
const emit = defineEmits<{ action: [id: string] }>()
const { t } = useI18n()
// 420px wheel box, center at (210,210): nodes land ON the two painted
// orbit rings (inner inset 67 -> r143, outer inset 23 -> r187). Catalog
// ring 1 (cultivation core) rides the inner orbit like the spec wheel.
const INNER_RADIUS = 143
const OUTER_RADIUS = 187
const nodes = computed(() => {
  const inner = props.actions.filter((action) => action.ring === 1)
  const outer = props.actions.filter((action) => action.ring !== 1)
  const place = (list: readonly DongFuUiAction[], radius: number) =>
    list.map((action, index) => {
      const angle = (-90 + index * 360 / list.length) * Math.PI / 180
      return { ...action, x: 210 + Math.cos(angle) * radius, y: 210 + Math.sin(angle) * radius }
    })
  return [...place(inner, INNER_RADIUS), ...place(outer, OUTER_RADIUS)]
})
function activate(node: DongFuUiAction) {
  if (node.disabledReason) return
  emit('action', node.id)
}
</script>
<template>
  <nav v-show="open" class="df-wheel" :aria-label="t('dongFu.aria')">
    <div class="df-wheel__orbit df-wheel__orbit--outer" aria-hidden="true" /><div class="df-wheel__orbit df-wheel__orbit--inner" aria-hidden="true" />
    <button
      v-for="node in nodes"
      :key="node.id"
      class="df-node"
      :class="{ 'is-selected': selected === node.id, 'is-active': node.active, 'is-disabled': node.disabledReason }"
      :style="{ left: `${node.x}px`, top: `${node.y}px` }"
      :aria-pressed="selected === node.id"
      :aria-disabled="node.disabledReason ? true : undefined"
      :title="node.disabledReason ?? undefined"
      :data-wheel-slot="node.id"
      @click="activate(node)"
    >
      <span class="df-node__orb"><img :src="symbolUrl(node.symbol)" alt=""><i v-if="node.badge" class="df-node__badge" :class="`df-node__badge--${node.badge}`" aria-hidden="true" /></span><span class="df-node__label">{{ t(node.labelKey) }}</span>
    </button>
  </nav>
</template>
<style scoped>
.df-wheel { position: absolute; left: 490px; top: 275px; width: 420px; height: 420px; z-index: 3; pointer-events: none; }
.df-wheel__orbit { position: absolute; border-radius: 50%; border: 1px solid #ffe6a1b0; box-shadow: 0 0 8px #eabc624d, inset 0 0 8px #ffefb929; }
.df-wheel__orbit--outer { inset: 23px; }
.df-wheel__orbit--inner { inset: 67px; border-color: #ecd18b8c; }
.df-wheel__orbit--inner::after { content: ''; position: absolute; inset: -9px; border-radius: 50%; border: 1px dashed #e6c77970; }
.df-node { position: absolute; width: 104px; height: 98px; transform: translate(-50%,-50%); display: grid; justify-items: center; align-content: start; background: transparent; padding: 0; border: 0; color: #f6e9c9; cursor: pointer; pointer-events: auto; }
.df-node.is-disabled { cursor: default; filter: saturate(0.35) brightness(0.8); }
.df-node__orb { position: relative; width: 73px; height: 73px; border-radius: 50%; border: 2px solid #e1c477; background: radial-gradient(circle,#574015 0%,#171c15 46%,#060c0c 69%,#9b7433 72%,#14190f 78%); box-shadow: 0 0 0 3px #1f1f15, 0 0 0 4px #bc9859, 0 0 13px #efca6a99, inset 0 0 9px #ecca7055; display: grid; place-items: center; transition: box-shadow 160ms, filter 160ms; }
.df-node__orb img { width: 40px; height: 40px; filter: invert(87%) sepia(41%) saturate(480%) hue-rotate(350deg) drop-shadow(0 0 4px #ffc65b); }
.df-node__badge { position: absolute; top: -2px; right: -2px; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #fff0bd; }
.df-node__badge--dot { background: #ffd766; box-shadow: 0 0 7px #ffc94d; }
.df-node__badge--alert { background: radial-gradient(circle,#ff9a4d,#c43c17); box-shadow: 0 0 10px #ff7a3c; animation: df-badge-pulse 1.6s ease-in-out infinite; }
@keyframes df-badge-pulse { 50% { transform: scale(1.25); } }
.df-node__label { margin-top: -4px; padding: 1px 8px 2px; position: relative; background: linear-gradient(90deg,transparent,#080f0df5 16%,#080f0df5 84%,transparent); border-bottom: 1px solid #ba965765; white-space: nowrap; font-size: 16px; line-height: 21px; text-shadow: 0 2px 2px #000; }
.df-node:hover .df-node__orb, .df-node.is-selected .df-node__orb, .df-node.is-active .df-node__orb, .df-node:focus-visible .df-node__orb { box-shadow: 0 0 0 3px #746030, 0 0 0 4px #fff2bc, 0 0 25px #ffda84, inset 0 0 18px #dcae6599; filter: brightness(1.15); }
.df-node.is-disabled:hover .df-node__orb { box-shadow: 0 0 0 3px #1f1f15, 0 0 0 4px #bc9859, 0 0 13px #efca6a99, inset 0 0 9px #ecca7055; filter: none; }
@media (prefers-reduced-motion: reduce) { .df-node__orb, .df-node__badge { transition: none; animation: none; } }
</style>
