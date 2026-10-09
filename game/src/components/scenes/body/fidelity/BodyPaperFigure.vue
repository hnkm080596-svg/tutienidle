<script setup lang="ts">
import { computed } from 'vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { BodyPaperModel, BodyPaperUnit } from './bodyUi'

const props = defineProps<{ model: BodyPaperModel; selected: string }>()
const emit = defineEmits<{ select: [id: string] }>()

const bodyArt = (name: string) =>
  resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/body/${name}-v1.png`)

const unitState = computed<Record<string, BodyPaperUnit['state']>>(() => {
  const map: Record<string, BodyPaperUnit['state']> = {}
  for (const unit of props.model.units) map[unit.id] = unit.state
  return map
})
const unitLit = (id: string) => unitState.value[id] === 'done'

// Luyen The: unit id suffix (luyen_bi -> bi) maps to the process art + the
// anatomy overlay that unit owns on the silhouette.
const REFINEMENT_LAYER: Record<string, 'skin' | 'muscle' | 'vertebra' | 'blood' | 'heart' | 'forehead'> = {
  luyen_bi: 'skin',
  luyen_nhuc: 'muscle',
  luyen_cot: 'vertebra',
  luyen_huyet: 'blood',
  luyen_tang: 'heart',
  luyen_mach: 'forehead',
}
const litLayer = (layer: string) =>
  Object.entries(REFINEMENT_LAYER).some(([id, own]) => own === layer && unitLit(id))

// Khai Mach: fixed 8-point meridian graph (subset of the preview's 10-point
// anatomy map) - production owns exactly 8 authored meridians.
const MERIDIAN_POINTS = [
  [50, 19],
  [50, 32],
  [35, 38],
  [65, 38],
  [50, 45],
  [15, 73],
  [85, 73],
  [50, 60],
] as const
const MERIDIAN_EDGES: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 5],
  [3, 6],
  [4, 7],
]
const meridianNodes = computed(() =>
  props.model.units.map((unit, index) => {
    const point = MERIDIAN_POINTS[index] ?? [50, 50]
    return { unit, index, x: point[0], y: point[1], lit: unitLit(unit.id) || unit.state === 'current' }
  }),
)
// Out-of-reach meridians are hidden, not drawn as locked orbs - only the
// opened and the next sequential node render (pinned behaviour).
const visibleMeridianNodes = computed(() =>
  meridianNodes.value.filter((node) => node.unit.state !== 'locked'),
)
const visibleMeridianEdges = computed(() => {
  const visible = new Set(visibleMeridianNodes.value.map((node) => node.index))
  return MERIDIAN_EDGES.filter(([a, b]) => visible.has(a) && visible.has(b))
})
function meridianLineStyle(a: number, b: number) {
  const p = MERIDIAN_POINTS[a]!
  const q = MERIDIAN_POINTS[b]!
  const dx = (q[0] - p[0]) * 5
  const dy = (q[1] - p[1]) * 5.329
  return {
    left: `${p[0]}%`,
    top: `${p[1]}%`,
    width: `${Math.hypot(dx, dy) / 5}%`,
    transform: `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`,
  }
}

// Chu Thien: galaxy pieces lit by the chapter progress fraction; lit pieces
// orbit. Progress arrives as the completed/total percentage on the model.
const GALAXY = [
  { id: 'core', x: 50, y: 49, w: 8, angle: 0, duration: 0, reverse: false },
  { id: 'orbit-circle', x: 50, y: 49, w: 18, angle: 0, duration: 19, reverse: false },
  { id: 'orbit-ellipse', x: 50, y: 49, w: 21, angle: -24, duration: 27, reverse: true },
  { id: 'orbit-ellipse', x: 50, y: 49, w: 30, angle: 38, duration: 33, reverse: false },
  { id: 'orbit-circle', x: 50, y: 49, w: 39, angle: 65, duration: 43, reverse: true },
  { id: 'orbit-ellipse', x: 50, y: 49, w: 48, angle: -52, duration: 51, reverse: false },
] as const
const galaxyLit = computed(() => Math.round((props.model.progress / 100) * GALAXY.length))
const starsLit = computed(() => props.model.progress > 70)
const galaxyPieces = computed(() =>
  GALAXY.map((piece, index) => ({ ...piece, lit: index < galaxyLit.value })),
)
</script>
<template>
  <div class="body-center body-paper-figure">
    <div class="body-stage" :aria-label="model.chapterLabel">
      <img class="body-silhouette body-figure-art" :src="bodyArt('silhouette-seated')" alt="">
      <template v-if="model.chapter === 'refinement'">
        <div class="body-layer body-skin-layer" :class="{ lit: litLayer('skin') }">
          <img :src="bodyArt('silhouette-seated')" alt="">
        </div>
        <div class="body-layer body-muscle-layer">
          <img v-for="side in ['left', 'right']" :key="side" :class="side"
            :src="bodyArt(`biceps-${side}-${litLayer('muscle') ? 'lit' : 'unlit'}`)" alt="">
        </div>
        <img class="body-blood" :src="bodyArt(`anatomy-blood-${litLayer('blood') ? 'lit' : 'unlit'}`)" alt="">
        <div class="body-spine">
          <span class="spine-core" :class="{ lit: litLayer('vertebra') }"></span>
          <img v-for="n in 10" :key="n" :src="bodyArt(`anatomy-vertebra-${litLayer('vertebra') ? 'lit' : 'unlit'}`)" alt="">
        </div>
        <img class="body-heart" :src="bodyArt(`anatomy-heart-${litLayer('heart') ? 'lit' : 'unlit'}`)" alt="">
        <div class="body-forehead">
          <img class="forehead-ring" :src="bodyArt(`forehead-ring-${litLayer('forehead') ? 'lit' : 'unlit'}`)" alt="">
          <img v-for="(point, i) in [{ x: 50, y: 4 }, { x: 10, y: 73 }, { x: 90, y: 73 }]" :key="i"
            class="forehead-node" :style="{ left: point.x + '%', top: point.y + '%' }"
            :src="bodyArt(`forehead-node-${litLayer('forehead') ? 'lit' : 'unlit'}`)" alt="">
        </div>
      </template>
      <template v-else-if="model.chapter === 'meridian'">
        <div v-for="([a, b], i) in visibleMeridianEdges" :key="`line-${i}`"
          class="body-meridian-line" :class="{ energized: meridianNodes[b]?.lit }" :style="meridianLineStyle(a, b)">
          <img :src="bodyArt(`meridian-tube-${meridianNodes[b]?.lit ? 'lit' : 'unlit'}`)" alt="">
          <span v-if="meridianNodes[b]?.lit" class="meridian-flow"></span>
        </div>
        <button v-for="node in visibleMeridianNodes" :key="node.unit.id"
          class="body-meridian-node body-orb" :class="[node.unit.state, { selected: selected === node.unit.id }]"
          :style="{ left: `${node.x}%`, top: `${node.y}%` }"
          :aria-pressed="selected === node.unit.id" :aria-label="node.unit.title"
          @click="emit('select', node.unit.id)">
          <img :src="bodyArt(`meridian-node-${node.lit ? 'lit' : 'unlit'}`)" alt="">
        </button>
      </template>
      <template v-else>
        <img v-for="(piece, i) in galaxyPieces" :key="i"
          class="body-galaxy-piece" :class="{ orbiting: piece.lit }"
          :style="{
            left: `${piece.x}%`, top: `${piece.y}%`, width: `${piece.w}%`,
            '--orbit-angle': `${piece.angle}deg`,
            animationDuration: `${piece.duration}s`,
            animationDirection: piece.reverse ? 'reverse' : 'normal',
            animationDelay: `${-i * 7}s`,
          }"
          :src="bodyArt(`galaxy-${piece.id}-${piece.lit ? 'lit' : 'unlit'}`)" alt="">
        <img class="body-galaxy-stars" :src="bodyArt(`galaxy-stars-${starsLit ? 'lit' : 'unlit'}`)" alt="">
      </template>
    </div>
  </div>
</template>
<style scoped>
.body-center { display:flex; flex-direction:column; align-items:center; min-height:0; padding:0 4px; }
.body-stage { position:relative; aspect-ratio:1215/1295; height:calc(100% - 8px); max-width:100%; flex:none; isolation:isolate; }
.body-silhouette { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none; }
.body-layer { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
.body-skin-layer { mask-image:linear-gradient(transparent 29%, #000 34%, #000 67%, transparent 74%); }
.body-skin-layer img { width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 0 1px #aaaaaa); }
.body-skin-layer.lit img { filter:drop-shadow(0 0 2px #ffe5a0) drop-shadow(0 0 5px #eaba4d); }
.body-muscle-layer img { position:absolute; top:39%; width:11%; height:22%; object-fit:contain; pointer-events:none; }
.body-muscle-layer .left { left:27%; transform:rotate(26deg); }
.body-muscle-layer .right { right:27%; transform:rotate(-26deg); }
.body-blood { position:absolute; left:18%; top:33%; width:64%; height:35%; object-fit:contain; pointer-events:none; opacity:.7; }
.body-spine { position:absolute; left:48.5%; top:31%; width:3%; height:34%; display:flex; flex-direction:column; align-items:center; justify-content:space-between; pointer-events:none; }
.body-spine img { width:100%; height:8%; object-fit:contain; z-index:1; }
.spine-core { position:absolute; top:3%; bottom:3%; width:1px; background:#8f9397; }
.spine-core.lit { background:#efca6b; box-shadow:0 0 3px #eec46c; }
.body-heart { position:absolute; left:54%; top:38%; width:8%; height:12%; object-fit:contain; pointer-events:none; }
.body-forehead { position:absolute; left:47.7%; top:19%; width:4.6%; aspect-ratio:1; pointer-events:none; }
.forehead-ring { width:100%; height:100%; object-fit:contain; }
.forehead-node { position:absolute; width:17%; height:17%; object-fit:contain; transform:translate(-50%,-50%); }
.body-meridian-node { position:absolute; width:12%; height:10%; transform:translate(-50%,-50%); z-index:3; padding:0; border:0; background:transparent; cursor:pointer; }
.body-meridian-node img { width:100%; height:100%; object-fit:contain; pointer-events:none; }
.body-meridian-node.locked { opacity:.55; }
.body-meridian-node.selected img { filter:drop-shadow(0 0 5px #ffd785); }
.body-meridian-node:focus-visible { outline:2px solid #315d48; outline-offset:2px; }
.body-meridian-line { position:absolute; height:12px; transform-origin:left center; z-index:2; pointer-events:none; }
.body-meridian-line img { width:100%; height:100%; object-fit:fill; }
.meridian-flow { position:absolute; top:43%; left:8%; width:84%; height:14%; background:linear-gradient(90deg, transparent 20%, #fff3b2 45%, transparent 65%); background-size:200% 100%; animation:meridian-flow 2.4s linear infinite; }
.body-galaxy-piece { position:absolute; height:auto; transform:translate(-50%,-50%) rotate(var(--orbit-angle)); pointer-events:none; }
.body-galaxy-piece.orbiting { animation:orbit-drift 28s linear infinite; }
.body-galaxy-stars { position:absolute; left:40%; top:42%; width:20%; height:14%; object-fit:contain; pointer-events:none; }
@keyframes meridian-flow { to { background-position:-200% 0; } }
@keyframes orbit-drift { to { transform:translate(-50%,-50%) rotate(calc(var(--orbit-angle) + 360deg)); } }
@media (prefers-reduced-motion: reduce) {
  .meridian-flow, .body-galaxy-piece.orbiting { animation:none; }
}
</style>
