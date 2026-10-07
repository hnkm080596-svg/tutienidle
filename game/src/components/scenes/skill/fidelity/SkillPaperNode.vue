<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { SkillUiNode } from './skillUi'
const props = defineProps<{ node: SkillUiNode; selected: boolean }>()
const emit = defineEmits<{ select: [id: string]; activate: [id: string] }>()
const { t } = useI18n()
// G3 frame set (tien-hiep controls/skill-node-{kind}-v1.png): the layout
// hub (depth 0) gets the parent frame, every other node the sub frame.
// The three mortal precursor seats carry their own frameKind - the frame
// upgrades with the skill's core level, no other node changes frames.
const kind = computed(() => (props.node.prominent ? 'parent' : 'sub'))
const shownKind = ref(props.node.frameKind ?? (props.node.prominent ? 'parent' : 'sub'))
watch(
  () => props.node.frameKind,
  (next) => {
    if (!upgrading.value) shownKind.value = next ?? (props.node.prominent ? 'parent' : 'sub')
  },
)
const frame = computed(() =>
  resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/controls/skill-node-${shownKind.value ?? kind.value}-v1.png`),
)
const lock = resolveAssetUrl('/assets/ui/huyen-kim/symbols/lock.svg')

// The drawn frame set (Minh's 6-piece kit) centers its ring on the
// canvas, so plain centering works for everything; only the icon's
// diameter differs - it covers the ring's inner lip (inner opening +
// ~5% overlap), measured on the art per frame kind, in % of node size.
const ICON_FIT: Record<string, number> = {
  parent: 59,
  sub: 66,
  main: 57,
  keystone: 60,
  passive: 65,
}
const iconFit = computed(() => ({ '--i-size': `${ICON_FIT[shownKind.value ?? kind.value]}%` }))

// Groove radius of each drawn frame (center of the dark channel, measured
// on the art, in viewBox units) - the selected/fill/hold circles ride the
// real groove per frame kind, not one shared radius.
const GROOVE_R: Record<string, number> = {
  parent: 29.1,
  main: 28.3,
  keystone: 30.5,
  sub: 33.3,
  passive: 35.4,
}
const grooveR = computed(() => GROOVE_R[shownKind.value ?? kind.value] ?? 33.3)

// Upgrade fill: a level change plays the groove fill once; for precursor
// seats the new frame tier only swaps in when the animation finishes -
// the upgrade visually completes then.
const upgrading = ref(false)
// A hold-activated level change must not replay the fill - the hold ring
// the user just completed IS the confirmation; replaying it reads as two
// loops for one action.
let suppressNextFill = false
watch(
  () => props.node.level,
  (next, prev) => {
    if (prev !== undefined && next !== prev) {
      if (suppressNextFill) {
        suppressNextFill = false
        shownKind.value = props.node.frameKind ?? (props.node.prominent ? 'parent' : 'sub')
        return
      }
      upgrading.value = true
    }
  },
)
function onFillEnd() {
  upgrading.value = false
  shownKind.value = props.node.frameKind ?? (props.node.prominent ? 'parent' : 'sub')
}

// Hold-to-activate (Minh ruling: no upgrade button - press and hold the
// node itself for the same 0.85s the groove fill takes, then the action
// fires). Cancels on release or on any move past the 4px drag threshold,
// so panning the tree never spends Insight. Document-level listeners are
// required: once the tree captures the pointer for a pan, events retarget
// off this button entirely.
const holding = ref(false)
let holdOrigin: { x: number; y: number } | null = null

function cancelHold() {
  holding.value = false
  holdOrigin = null
  window.removeEventListener('pointermove', onHoldMove, true)
  window.removeEventListener('pointerup', cancelHold, true)
  window.removeEventListener('pointercancel', cancelHold, true)
}
function onHoldMove(event: PointerEvent) {
  if (holdOrigin === null) return
  if (Math.abs(event.clientX - holdOrigin.x) + Math.abs(event.clientY - holdOrigin.y) > 4) cancelHold()
}
function onNodePointerDown(event: PointerEvent) {
  if (event.button !== 0 || props.node.actionDisabled) return
  holding.value = true
  holdOrigin = { x: event.clientX, y: event.clientY }
  window.addEventListener('pointermove', onHoldMove, true)
  window.addEventListener('pointerup', cancelHold, true)
  window.addEventListener('pointercancel', cancelHold, true)
}
function onHoldComplete() {
  const id = props.node.id
  suppressNextFill = true
  cancelHold()
  emit('activate', id)
}
</script>
<template>
  <button :class="['skill-node', `skill-node--${kind}`, node.state, { selected, holding }]" :data-node-id="node.id" :aria-pressed="selected" :aria-label="`${node.name} · ${node.level} · ${t(`skill.state.${node.state}`)}`" @click="emit('select', node.id)" @pointerdown="onNodePointerDown">
    <span class="skill-node-disc" :style="iconFit"><img class="skill-node-icon" :src="node.icon" alt=""><img class="skill-node-frame" :src="frame" alt=""><svg v-if="selected" class="skill-node-streak" viewBox="0 0 100 100" aria-hidden="true"><circle class="tail-far" cx="50" cy="50" :r="grooveR" pathLength="100" /><circle class="tail-near" cx="50" cy="50" :r="grooveR" pathLength="100" /><circle class="head" cx="50" cy="50" :r="grooveR" pathLength="100" /></svg><svg v-if="upgrading" class="skill-node-fill" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" :r="grooveR" pathLength="100" @animationend="onFillEnd" /></svg><svg v-if="holding" class="skill-node-hold" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" :r="grooveR" pathLength="100" @animationend="onHoldComplete" /></svg><svg v-if="!node.actionDisabled" class="skill-node-can" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 L15 13 L8 10 L1 13 Z"/></svg><span v-if="node.state === 'locked'" class="skill-node-lock"><img :src="lock" alt=""></span></span>
  </button>
</template>
<style scoped>
.skill-node { --node-size:60px; width:var(--node-size); height:var(--node-size); display:grid; place-items:center; padding:0; border:0; background:none; color:#372719; font:14px var(--font-display,Georgia,serif); cursor:pointer; }
.skill-node--parent { --node-size:78px; }
.skill-node-disc { position:relative; display:grid; place-items:center; width:var(--node-size); height:var(--node-size); }
.skill-node-disc::before { content:''; position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:var(--i-size,68%); height:var(--i-size,68%); border-radius:50%; background:#1c231e; }
.skill-node-icon { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:var(--i-size,68%); height:var(--i-size,68%); object-fit:contain; border-radius:50%; transition:transform 150ms ease; }
.skill-node-frame { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none; transition:filter 150ms ease,transform 150ms ease; filter:drop-shadow(0 3px 3px #72552944); }
/* Selected: a comet orbits the frame's groove - bright round head leads
   the rotation, a two-step tail fades behind it (all three arcs ride the
   same spin, each laid back along the path by dashoffset). */
.skill-node-streak { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; animation:node-streak-spin 1.5s linear infinite; }
.skill-node-streak circle { fill:none; stroke-linecap:round; }
.skill-node-streak .tail-far { stroke:var(--streak,#d4983d); stroke-width:1.2; opacity:.4; stroke-dasharray:9 91; }
.skill-node-streak .tail-near { stroke:var(--streak,#ffd17a); stroke-width:1.8; opacity:.75; stroke-dasharray:12 88; stroke-dashoffset:-9; filter:drop-shadow(0 0 1px var(--streak,#ffb84d)); }
.skill-node-streak .head { stroke:var(--streak-head,#fff3c4); stroke-width:3; stroke-dasharray:4 96; stroke-dashoffset:-21; filter:drop-shadow(0 0 2px var(--streak,#ffe08a)) drop-shadow(0 0 4px var(--streak,#ffb84d)); }
@keyframes node-streak-spin { from { transform:rotate(-90deg) } to { transform:rotate(270deg) } }
/* Upgrade fill: the groove draws itself once around then fades; the circle's
   dashoffset animation signals completion (frame swaps on animationend). */
.skill-node-fill { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; transform:rotate(-90deg); animation:node-fill-fade 1.05s ease forwards; }
.skill-node-fill circle { fill:none; stroke:#ffd17a; stroke-width:7; stroke-linecap:round; stroke-dasharray:100; stroke-dashoffset:100; animation:node-fill-run .85s ease-out forwards; filter:drop-shadow(0 0 4px #ffb84d) drop-shadow(0 0 9px #d4983d); }
@keyframes node-fill-run { to { stroke-dashoffset:0 } }
@keyframes node-fill-fade { 0%,80% { opacity:1 } 100% { opacity:0 } }
/* Hold progress reuses the fill groove exactly (0.85s) - completing the
   loop IS the confirmation, so the timing can never drift apart. */
.skill-node-hold { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; transform:rotate(-90deg); }
.skill-node-hold circle { fill:none; stroke:#ffe9a3; stroke-width:7; stroke-linecap:round; stroke-dasharray:100; stroke-dashoffset:100; animation:node-fill-run .85s ease-out forwards; filter:drop-shadow(0 0 5px #ffb84d) drop-shadow(0 0 11px #d4983d); }
/* Upgradeable marker: a bouncing green up-arrow above the node - reads as
   "can learn/upgrade now" at a glance (activation is hold-driven). */
.skill-node-can { position:absolute; top:-7px; left:50%; width:14px; height:14px; pointer-events:none; fill:#7ee787; stroke:#1d5c33; stroke-width:1; filter:drop-shadow(0 0 4px #58d68dcc); animation:node-can-bounce 1.1s ease-in-out infinite; }
@keyframes node-can-bounce { 0%,100% { transform:translate(-50%,0); opacity:.8; } 50% { transform:translate(-50%,-4px); opacity:1; } }
.skill-node-lock { position:absolute; inset:0; display:grid; place-items:center; pointer-events:none; }
.skill-node-lock img { width:42%; height:42%; filter:drop-shadow(0 2px 4px rgba(0,0,0,.7)); }
.selected .skill-node-frame { filter:brightness(1.15) drop-shadow(0 0 4px #d8ab5588); }
.skill-node:not(.learned) .skill-node-icon { filter:grayscale(1) brightness(.6); opacity:.6; }
.skill-node:not(.learned) .skill-node-frame { filter:saturate(.35) brightness(.7); }
.skill-node.locked .skill-node-icon { filter:grayscale(1) brightness(.45); opacity:.45; }
.skill-node.locked .skill-node-frame { filter:saturate(.2) brightness(.55); }
/* Hover grows the icon art only - and pops it ABOVE the frame ring so
   the growth is visible (default order keeps the art under the rim). */
.skill-node:not(.locked):hover .skill-node-icon { transform:translate(-50%,-50%) scale(1.14); z-index:2; }
.skill-node:not(.locked):hover .skill-node-frame { filter:brightness(1.3) drop-shadow(0 0 5px #ffd17a) drop-shadow(0 0 8px #d4983d70); }
.skill-node:not(.learned):not(.locked):hover .skill-node-icon { filter:grayscale(.8) brightness(.8); opacity:.75; }
.skill-node:not(.locked):active .skill-node-icon { transform:translate(-50%,-50%) scale(.94); }
.skill-node:focus-visible { outline:2px solid #315c47; outline-offset:5px; border-radius:5px; }
@media (prefers-reduced-motion:reduce) { .skill-node-frame { transition:none; } }
</style>
