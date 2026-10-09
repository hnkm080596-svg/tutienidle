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

// Rèn Thể: each completed step reveals its anatomy art on the
// silhouette (owner ruling 2026-10-09) - done units only, nothing is
// drawn for steps not yet reached.
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

// Luyen Bi emit effect (owner ruling 2026-10-09): small rays emitted
// perpendicular to the skin at random spots - the pool was extracted from
// silhouette-seated-v1's alpha edge (x%, y%, outward-normal angle).
const SKIN_RAY_POOL: readonly (readonly [number, number, number])[] = [
  [49.1,1.0,-27],[53.4,5.0,90],[44.8,5.7,-90],[56.4,10.3,72],[42.4,11.3,-72],[57.6,16.3,117],[39.6,16.7,-45],[43.3,21.3,-90],
  [56.4,22.3,63],[40.5,26.7,-45],[60.4,26.7,180],[38.1,32.3,-27],[61.6,32.7,18],[32.6,34.3,-27],[67.1,34.7,45],[29.3,39.3,-90],
  [70.1,40.0,90],[29.3,45.7,-90],[69.8,46.3,72],[36.0,49.3,180],[63.1,49.3,180],[27.7,51.7,-90],[71.6,52.3,90],[33.8,55.0,117],
  [60.7,55.0,90],[66.2,56.0,-108],[39.3,57.3,-108],[25.6,57.7,-45],[74.1,58.0,45],[31.4,60.7,90],[60.1,61.0,72],[68.3,61.7,-117],
  [22.0,62.3,-72],[77.7,63.0,63],[38.4,63.3,-45],[63.7,65.7,108],[28.7,66.0,135],[71.6,67.0,-135],[13.1,68.0,0],[19.2,68.0,-45],
  [86.3,68.0,-27],[34.8,68.3,-63],[80.5,68.3,45],[67.1,70.7,18],[8.8,72.0,-63],[26.5,72.0,-27],[90.5,72.0,90],[72.0,73.7,45],
  [19.8,74.0,135],[79.9,74.3,-135],[12.2,77.3,-153],[86.6,77.3,162],[89.0,83.0,90],[10.7,83.3,-90],[86.6,88.7,135],[13.1,89.0,-135],
  [81.4,91.3,162],[18.3,91.7,-162],[23.8,92.3,180],[51.2,92.7,162],[73.8,93.7,162],[41.8,94.0,162],[59.1,94.0,180],[29.0,94.7,-153],
  [36.3,95.0,162],[68.3,95.0,162],
]
const skinRays = SKIN_RAY_POOL.map((p, i) => ({ p, i, key: Math.random() }))
  .sort((a, b) => a.key - b.key)
  .slice(0, 18)
  .map((o) => ({
    i: o.i,
    x: o.p[0],
    y: o.p[1],
    a: o.p[2],
    d: (3 + Math.random() * 2.5).toFixed(2),
    dl: (-Math.random() * 5).toFixed(2),
  }))

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
        <div v-if="litLayer('skin')" class="body-rays" aria-hidden="true">
          <i
            v-for="r in skinRays"
            :key="r.i"
            class="body-ray"
            :style="{ left: `${r.x}%`, top: `${r.y}%`, '--a': `${r.a}deg`, '--d': `${r.d}s`, '--dl': `${r.dl}s` }"
          ></i>
        </div>
        <div v-if="litLayer('skin')" class="body-layer body-skin-layer lit">
          <img :src="bodyArt('silhouette-seated')" alt="">
        </div>
        <div v-if="litLayer('muscle')" class="body-layer body-muscle-layer">
          <img v-for="side in ['left', 'right']" :key="side" :class="side"
            :src="bodyArt(`biceps-${side}-lit`)" alt="">
        </div>
        <img v-if="litLayer('blood')" class="body-blood" :src="bodyArt('anatomy-blood-lit')" alt="">
        <div v-if="litLayer('vertebra')" class="body-spine">
          <span class="spine-core lit"></span>
          <img v-for="n in 10" :key="n" :src="bodyArt('anatomy-vertebra-lit')" alt="">
        </div>
        <img v-if="litLayer('heart')" class="body-heart" :src="bodyArt('anatomy-heart-lit')" alt="">
        <div v-if="litLayer('forehead')" class="body-forehead">
          <img class="forehead-ring" :src="bodyArt('forehead-ring-lit')" alt="">
          <img v-for="(point, i) in [{ x: 50, y: 4 }, { x: 10, y: 73 }, { x: 90, y: 73 }]" :key="i"
            class="forehead-node" :style="{ left: point.x + '%', top: point.y + '%' }"
            :src="bodyArt('forehead-node-lit')" alt="">
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
      <template v-else-if="model.chapter === 'zhou_tian'">
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
.body-stage { position:relative; aspect-ratio:1215/1295; height:calc(100% - 8px); max-width:100%; flex:none; isolation:isolate; transform:scale(1.12); overflow:hidden; }
.body-silhouette { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none; }
.body-layer { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
.body-skin-layer { mask-image:linear-gradient(transparent 29%, #000 34%, #000 67%, transparent 74%); }
.body-skin-layer img { width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 0 1px #aaaaaa); }
.body-skin-layer.lit img { filter:drop-shadow(0 0 2px #ffe5a0) drop-shadow(0 0 5px #eaba4d); }
/* Luyen Bi emit effect (owner ruling 2026-10-09): short rays emitted
   perpendicular to the skin at random contour points - each ray is a
   small tapered beam anchored at the skin edge, twinkling on its own
   phase. Layered behind the silhouette so rays emerge from under it. */
.body-rays { position:absolute; inset:0; pointer-events:none; z-index:-1; }
.body-ray { position:absolute; width:4px; height:34px; transform:translateY(-100%) rotate(var(--a)); transform-origin:50% 100%;
  background:linear-gradient(to top, rgba(15,10,5,0) 0%, rgba(15,10,5,.95) 100%);
  clip-path:polygon(42% 0, 58% 0, 100% 100%, 0 100%);
  animation:body-ray-fade var(--d) ease-in-out var(--dl) infinite; }
@keyframes body-ray-fade { 0%,100% { opacity:.45; } 50% { opacity:1; } }
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
  .meridian-flow, .body-galaxy-piece.orbiting, .body-rays { animation:none; }
}
</style>
