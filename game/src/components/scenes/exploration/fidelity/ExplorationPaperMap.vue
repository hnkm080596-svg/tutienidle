<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import SlotView from '@/components/common/SlotView.vue'
import { MAP_DESIGN_W, MAP_DESIGN_H } from './stagePositions'
import type { ExplorationChapter } from './explorationUi'
const props = defineProps<{ chapter: ExplorationChapter | null; terrain: string; selected: string; caption?: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()

// Thanh Van map (Minh 2026-10-11): one vista, all ai as 'stage' variant
// SlotViews (circle ring + cover landscape inside), routes drawn as
// SVG lines in the SAME design space as the HTML node layer - one
// coordinate system, so routes and nodes can never drift apart.

// Random-but-stable inner painting per ai: realm landscape art picked
// by stage-id hash (4 authored vistas).
const LANDSCAPES = [
  'realm/landscape-1-v1.png',
  'realm/landscape-2-v1.png',
  'realm/landscape-3-v1.png',
  'realm/meditation-v1.png',
].map(path => resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/${path}`))
function landscapeFor(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return LANDSCAPES[hash % LANDSCAPES.length]!
}

// Runtime drag overrides: authored positions in stagePositions.ts stay
// the base; dragging writes here AND persists to localStorage so tuned
// layouts survive reload (Minh 2026-10-12: 'luu vi tri dynamic lai').
// Each drop also logs the full effective map for baking into the data file.
// localStorage key for drag offsets - no 'exploration.' namespace prefix
// (i18n-parity scanner would treat it as a missing message key).
const DRAG_KEY = 'thanhvan-drag-v1'
function loadDragOffsets(): Record<string, { x: number; y: number }> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(DRAG_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, { x: number; y: number }>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch { return {} }
}
const dragOffsets = ref<Record<string, { x: number; y: number }>>(loadDragOffsets())
function persistDragOffsets() {
  try { localStorage.setItem(DRAG_KEY, JSON.stringify(dragOffsets.value)) } catch { /* private mode */ }
}
function nodePos(id: string, x: number, y: number) {
  return dragOffsets.value[id] ?? { x, y }
}

const lines = computed(() => {
  const chapter = props.chapter
  if (!chapter) return []
  return chapter.edges.flatMap(edge => {
    const from = chapter.nodes.find(node => node.id === edge.from)
    const to = chapter.nodes.find(node => node.id === edge.to)
    if (!from || !to) return []
    const a = nodePos(from.id, from.x, from.y)
    const b = nodePos(to.id, to.x, to.y)
    // Lit once the destination ai is reachable - kinh-mach glow logic,
    // one-shot (no loop): the lit <line> mounts and plays its dash
    // reveal a single time.
    return [{ id: `${from.id}-${to.id}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, lit: to.state !== 'locked' }]
  })
})

// Design-space scaling: measure the wrapper, scale the fixed 1000x800
// space to fit, center horizontally. jsdom lacks ResizeObserver - the
// typeof guard keeps tests mounting this component.
const wrapRef = ref<HTMLElement | null>(null)
const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
let observer: ResizeObserver | null = null
let activeDragCleanup: (() => void) | null = null
onMounted(() => {
  const wrap = wrapRef.value
  if (!wrap) return
  const measure = () => {
    // Minh 2026-10-12: fit by HEIGHT so the space (and the decorative art
    // inside it) matches the detail card's height; width centers and the
    // overflow crops symmetrically inside the frame.
    const s = wrap.clientHeight / MAP_DESIGN_H
    // A zero-size container (hidden mount, collapsed parent, jsdom) would
    // otherwise collapse the whole vista via scale(0) - fall back to 1.
    scale.value = s > 0 ? s : 1
    // Centering lives INSIDE the transform: translate runs in
    // unscaled px of the wrapper, so the offset is arithmetic -
    // immune to transform-origin / translate-% quirks.
    offsetX.value = (wrap.clientWidth - MAP_DESIGN_W * s) / 2
    offsetY.value = Math.max(0, (wrap.clientHeight - MAP_DESIGN_H * s) / 2)
  }
  measure()
  if (typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(measure)
    observer.observe(wrap)
  }
})
onBeforeUnmount(() => {
  observer?.disconnect()
  activeDragCleanup?.()
})

// Direct drag (Minh 2026-10-12): hold+move >=4px drags the node -
// the layout-tuner gate is gone so dragging always works; a plain
// click still selects the ai. Drop logs {id,x,y} for baking into
// stagePositions.ts. Pointer delta is divided by the live scale so
// the node lands in design coords under any zoom.
const justDragged = new Set<string>()
function onNodePointerDown(event: PointerEvent, id: string, x: number, y: number) {
  const s = scale.value || 1
  const startX = event.clientX
  const startY = event.clientY
  const base = nodePos(id, x, y)
  let dragging = false
  const move = (e: PointerEvent) => {
    if (!dragging) {
      if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) < 4) return
      dragging = true
      event.preventDefault()
    }
    // Clamp inside the design rect INSET by the node radius: pos is
    // the node's center (translate(-50%,-50%) on a 56px node), so a
    // center at the very edge leaves half the node clipped by
    // overflow:hidden.
    const R = 28
    dragOffsets.value = {
      ...dragOffsets.value,
      [id]: {
        x: Math.min(MAP_DESIGN_W - R, Math.max(R, Math.round(base.x + (e.clientX - startX) / s))),
        y: Math.min(MAP_DESIGN_H - R, Math.max(R, Math.round(base.y + (e.clientY - startY) / s))),
      },
    }
  }
  const end = (logFinal: boolean) => {
    window.removeEventListener('pointermove', move, true)
    window.removeEventListener('pointerup', up, true)
    window.removeEventListener('pointercancel', cancel, true)
    window.removeEventListener('blur', up, true)
    activeDragCleanup = null
    if (dragging) justDragged.add(id)
    if (!logFinal || !dragging) return
    const final = dragOffsets.value[id]
    if (final) {
      persistDragOffsets()
      const text = JSON.stringify({ stageTuner: { id, x: final.x, y: final.y } })
      console.log('[stage-tuner]', text)
      // Full effective map (authored + every drag) - paste-ready when
      // baking the tuned layout into stagePositions.ts.
      const full = Object.fromEntries((props.chapter?.nodes ?? []).map(n => [n.id, nodePos(n.id, n.x, n.y)]))
      console.log('[stage-positions]', JSON.stringify(full))
      if (navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(full)).catch(() => {})
    }
  }
  const up = () => end(true)
  // pointercancel (touch scroll-steal, OS gesture) must end the drag
  // too - leaving listeners armed would keep tracking later motion.
  const cancel = () => end(false)
  window.addEventListener('pointermove', move, true)
  window.addEventListener('pointerup', up, true)
  window.addEventListener('pointercancel', cancel, true)
  window.addEventListener('blur', up, true)
  activeDragCleanup = up
}
// Click handler guard: a real drag ends with a click on the node -
// swallow that one so releasing the drag does not also select it.
function onNodeClick(id: string, locked: boolean) {
  if (justDragged.delete(id)) return
  if (!locked) emit('select', id)
}
</script>
<template>
  <div ref="wrapRef" class="exploration-map">
    <div class="map-space" :style="{ width: `${MAP_DESIGN_W}px`, height: `${MAP_DESIGN_H}px`, transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})` }">
      <img class="terrain" :src="terrain" alt="">
      <svg v-if="chapter" class="routes" :viewBox="`0 0 ${MAP_DESIGN_W} ${MAP_DESIGN_H}`" preserveAspectRatio="none" aria-hidden="true"><line v-for="line in lines" :key="line.id" :class="{ lit: line.lit }" :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2" /></svg>
      <button v-for="node in chapter?.nodes ?? []" :key="node.id" type="button" :class="['stage-node', node.state, { selected: selected === node.id, boss: node.boss, perfect: node.perfect }]" :style="{ left: `${nodePos(node.id, node.x, node.y).x}px`, top: `${nodePos(node.id, node.x, node.y).y}px` }" :aria-label="t('exploration.stageLabel', { stage: node.label, state: t(`exploration.state.${node.state}`) })" :aria-pressed="selected === node.id" :aria-disabled="node.state === 'locked' ? 'true' : undefined" :title="node.state === 'locked' ? (node.lockedHint ?? t('exploration.state.locked')) : undefined" :data-stage-id="node.id" @click="onNodeClick(node.id, node.state === 'locked')" @pointerdown="onNodePointerDown($event, node.id, node.x, node.y)">
        <SlotView class="node-slot" variant="stage" :item="null" :icon="landscapeFor(node.id)" static />
        <span class="node-stars" :class="{ lit: node.perfect }" aria-hidden="true"><i>★</i><i class="mid">★</i><i>★</i></span>
      </button>
    </div>
  </div>
</template>
<style scoped>
/* Minh 2026-10-12: no frame at all - the art sits on the panel's
   parchment backdrop as a decorative image; overflow stays hidden so
   the height-fit space crops cleanly at the edges. */
.exploration-map { position:relative; min-height:0; overflow:hidden; }
/* Centering computed in JS (offsetX/offsetY) and baked into the
   transform itself - no CSS translate/percent/origin interplay, so
   the space can never sit half-clipped under any outer rule. */
.map-space { position:absolute; left:0; top:0; transform-origin:top left; }
.terrain { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; transform:scale(1.1); transform-origin:center; pointer-events:none; }
.routes { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
.routes line { stroke:#81662e80; stroke-width:3; stroke-dasharray:5 5; }
/* Kinh-mach light reveal: the light switches on once (fade), then the
   lit edge keeps marching dashes toward the opened ai - the energy
   flow runs continuously like the meridian streams (ruling: the
   reveal happens once; the flow does not stop). */
.routes line.lit { stroke:#e9c46a; stroke-width:4; stroke-dasharray:9 7; filter:drop-shadow(0 0 5px #e9c46a99); animation:route-lit-in 0.9s ease-out 1, route-flow 1.4s linear infinite; }
@keyframes route-lit-in { from { opacity:0; } to { opacity:1; } }
@keyframes route-flow { to { stroke-dashoffset:-32px; } }
.stage-node { position:absolute; width:56px; height:56px; transform:translate(-50%,-50%); border:0; background:transparent; cursor:pointer; padding:0; }
.node-slot { width:56px; height:56px; display:block; pointer-events:none; }
/* Locked = grey + non-interactive (ruling 2026-10-11): no lock glyph,
   the whole medallion desaturates and the cursor is gone. */
/* Locked = grayscale + non-interactive click, but pointer events stay on:
   the unlock reason lives on :title and the layout tuner must still be able
   to drag locked nodes. */
.stage-node.locked { filter:grayscale(1) brightness(.8); cursor:default; }
.stage-node.locked .node-stars { color:#8f8673; }
.stage-node.current .node-slot { filter:drop-shadow(0 0 8px #efd08a99); }
.stage-node.selected .node-slot { filter:drop-shadow(0 0 12px #ffd887) brightness(1.15); }
.stage-node:hover:not(.locked) .node-slot { filter:drop-shadow(0 0 10px #f7d383); }
/* 3 stars hugging the circle bottom - the middle star dips lower so
   the trio arcs around the rim; lit gold once the ai was
   perfect-cleared (perfectClearStageIds / turn limit), dim otherwise. */
.node-stars { position:absolute; left:50%; bottom:-6px; transform:translateX(-50%); z-index:2; font-style:normal; font-size:13px; white-space:nowrap; color:#4a4235; text-shadow:0 1px 2px #0008; pointer-events:none; }
.node-stars i { font-style:normal; }
.node-stars i.mid { vertical-align:-4px; }
.node-stars.lit { color:#f4c94e; text-shadow:0 0 4px #f4c94e88, 0 1px 2px #0008; }
@media (prefers-reduced-motion:reduce) { .routes line.lit { animation:none; } }
</style>
