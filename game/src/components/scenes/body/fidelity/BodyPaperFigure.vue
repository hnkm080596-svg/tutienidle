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

// Luyen Cot (owner ruling 2026-10-09): the spine fills progressively -
// every 10% of the current tier lights one vertebra, bottom to top.
const vertebraUnit = computed(() => props.model.units.find((u) => u.id === 'luyen_cot'))
const vertebraLitCount = computed(() => {
  const unit = vertebraUnit.value
  if (!unit) return 0
  return unit.state === 'done' ? 10 : Math.floor((unit.progressPct ?? 0) / 10)
})
const vertebraVisible = computed(() => (vertebraUnit.value?.state ?? 'locked') !== 'locked')


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
        <img v-if="litLayer('skin')" class="body-glow" :src="bodyArt('silhouette-seated')" alt="" aria-hidden="true">
        <div v-if="litLayer('skin')" class="body-layer body-skin-layer lit">
          <img :src="bodyArt('silhouette-seated')" alt="">
        </div>
        <div v-if="litLayer('muscle')" class="body-layer body-muscle-layer">
          <img v-for="side in ['left', 'right']" :key="side" :class="side"
            :src="bodyArt(`biceps-${side}-lit`)" alt="">
        </div>
        <svg v-if="litLayer('blood')" class="body-blood" viewBox="0 0 1215 1295" aria-hidden="true"
          :style="{ maskImage: `url(${bodyArt('silhouette-seated')})`, WebkitMaskImage: `url(${bodyArt('silhouette-seated')})`, maskSize: '94% 94%', WebkitMaskSize: '94% 94%', maskPosition: 'center', WebkitMaskPosition: 'center', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }">
          <defs>
            <g id="bvessels">
              <path stroke-width="4.5" d="M712,568 C690,605 640,650 620,690 C600,728 610,770 600,815 C596,838 602,858 598,872"/>
              <path stroke-width="4" d="M712,568 C645,555 575,530 500,505 C445,487 385,465 340,487 C305,505 285,545 275,590 C262,645 235,695 205,735 C185,762 168,795 160,822"/>
              <path stroke-width="4" d="M712,568 C745,552 790,520 830,490 C865,465 895,485 905,530 C918,585 940,645 955,690 C972,735 1005,765 1022,790 C1038,812 1050,828 1058,845"/>
              <path stroke-width="3" d="M712,568 C670,590 610,610 570,635 C540,655 535,690 545,720 C552,745 540,768 545,790"/>
              <path stroke-width="3" d="M712,568 C745,595 780,620 800,650 C818,678 812,710 822,735 C830,758 825,782 832,800"/>
              <path stroke-width="3" d="M712,575 C690,640 650,690 660,735 C668,775 640,800 648,830"/>
              <path stroke-width="2.5" d="M712,565 C655,555 585,545 530,540 C490,536 450,548 430,575 C410,602 405,640 415,672"/>
              <path stroke-width="2.5" d="M712,565 C760,552 820,540 860,550 C895,560 915,590 910,625 C905,655 915,685 908,715"/>
              <path stroke-width="3" d="M712,570 C655,585 585,615 540,645 C505,670 495,705 505,738 C513,765 500,790 508,815"/>
              <path stroke-width="3" d="M712,570 C760,590 815,620 845,655 C872,685 868,720 878,750 C886,775 880,800 888,822"/>
              <path stroke-width="2.5" d="M712,568 C660,560 590,548 535,552 C490,556 455,575 440,605 C425,635 430,668 445,695"/>
              <path stroke-width="2.5" d="M712,568 C768,558 835,552 875,565 C910,577 928,608 922,645 C917,678 925,708 918,738"/>
              <path stroke-width="3" d="M712,565 C640,540 540,512 465,495 C405,480 350,485 320,515 C295,540 282,578 278,618"/>
              <path stroke-width="3" d="M712,565 C780,542 855,515 900,500 C940,487 968,505 978,545 C988,585 990,630 985,672"/>
              <path stroke-width="2.5" d="M712,575 C685,630 640,675 615,720 C595,755 600,795 592,828"/>
              <path stroke-width="2.5" d="M712,575 C738,632 782,678 805,722 C825,758 818,798 828,832"/>
              <path stroke-width="2" d="M340,487 C325,512 310,542 300,572"/>
              <path stroke-width="2" d="M905,530 C918,555 925,575 930,600"/>
              <path stroke-width="2" d="M275,590 C255,628 232,668 215,700"/>
              <path stroke-width="2" d="M955,690 C972,722 995,752 1012,772"/>
              <path stroke-width="2" d="M160,822 C152,842 146,860 142,876"/>
              <path stroke-width="2" d="M1058,845 C1066,862 1072,876 1075,890"/>
            </g>
          </defs>
          <use href="#bvessels" class="bv-base"/>
          <use href="#bvessels" class="bv-flow"/>
        </svg>
        <div v-if="vertebraVisible" class="body-spine">
          <span class="spine-core" :class="{ lit: vertebraLitCount > 0 }"></span>
          <img v-for="n in 10" :key="n" :class="{ lit: n > 10 - vertebraLitCount }" :src="bodyArt('anatomy-vertebra-lit')" alt="">
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
.body-stage { position:relative; aspect-ratio:1215/1295; height:calc(100% - 8px); max-width:100%; flex:none; isolation:isolate; transform:scale(1.12); overflow:hidden; translate:0 0; animation:body-float 8s ease-in-out infinite; }
/* Whole-figure gentle drift (owner ruling 2026-10-09): the silhouette and
   all its layers float together like drifting in air. Uses the `translate`
   property so it composes with the scale(1.12) zoom. */
@keyframes body-float { 0%,100% { translate:0 0; } 50% { translate:0 -6px; } }
@media (prefers-reduced-motion: reduce) { .body-stage { animation:none; } }
.body-silhouette { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none; }
.body-layer { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
.body-skin-layer { mask-image:linear-gradient(transparent 29%, #000 34%, #000 67%, transparent 74%); }
.body-skin-layer img { width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 0 1px #aaaaaa); }
.body-skin-layer.lit img { filter:drop-shadow(0 0 2px #ffe5a0) drop-shadow(0 0 5px #eaba4d); }
/* Luyen Bi glow (owner ruling 2026-10-09): a soft black aura hugging the
   figure - a blurred black copy of the silhouette behind it, breathing
   on/off so it glows then fades out again. */
.body-glow { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none; z-index:-1;
  filter:brightness(0) blur(14px); opacity:.14; transform:scale(1.03);
  animation:body-glow-pulse 4.6s ease-in-out infinite; }
@keyframes body-glow-pulse { 0%,100% { opacity:.14; } 50% { opacity:.5; } }
@media (prefers-reduced-motion: reduce) { .body-glow { animation:none; opacity:.4; } }
/* Lit anatomy arts share the soft pulsing glow with the Luyen Bi aura
   (owner ruling 2026-10-09): a gentle golden halo that breathes on/off. */
.body-muscle-layer img, .body-blood, .body-spine img.lit, .body-heart, .forehead-ring { animation:body-art-glow 4.6s ease-in-out infinite; }
@keyframes body-art-glow { 0%,100% { filter:drop-shadow(0 0 2px rgba(238,196,108,.35)); } 50% { filter:drop-shadow(0 0 6px rgba(238,196,108,.8)) drop-shadow(0 0 10px rgba(238,196,108,.45)); } }
@media (prefers-reduced-motion: reduce) { .body-muscle-layer img, .body-blood, .body-spine img.lit, .body-heart, .forehead-ring { animation:none; } }
.body-muscle-layer img { position:absolute; top:39%; width:11%; height:22%; object-fit:contain; pointer-events:none;
  animation:body-art-glow 4.6s ease-in-out infinite, body-muscle-pump 4.6s ease-in-out infinite; }
/* Luyen Nhuc (owner ruling 2026-10-09): the biceps swell +10% at the glow
   peak and deflate back as the glow fades. */
@keyframes body-muscle-pump { 0%,100% { scale:1; } 50% { scale:1.1; } }
.body-muscle-layer .left { left:27%; transform:rotate(26deg); }
.body-muscle-layer .right { right:27%; transform:rotate(-26deg); }
/* Blood vessels drawn as SVG paths (owner ruling 2026-10-09): a solid
   golden base plus a dashed pulse travelling along the same paths so the
   blood reads as flowing. */
.body-blood { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; opacity:.85; }
.bv-base { fill:none; stroke:#eec46c; stroke-linecap:round; opacity:.45; }
.bv-flow { fill:none; stroke:#ffe9b0; stroke-linecap:round; stroke-dasharray:46 90; opacity:.85; animation:blood-flow 7s linear infinite; }
@keyframes blood-flow { to { stroke-dashoffset:-136; } }
@media (prefers-reduced-motion: reduce) { .bv-flow { animation:none; opacity:0; } }
.body-spine { position:absolute; left:48.5%; top:31%; width:3%; height:34%; display:flex; flex-direction:column; align-items:center; justify-content:space-between; pointer-events:none; }
.body-spine img { width:100%; height:8%; object-fit:contain; z-index:1; filter:grayscale(1) brightness(.7); opacity:.35; }
.body-spine img.lit { filter:none; opacity:1; }
.spine-core { position:absolute; top:3%; bottom:3%; width:1px; background:#8f9397; }
.spine-core.lit { background:#efca6b; box-shadow:0 0 3px #eec46c; }
/* Heartbeat (owner ruling 2026-10-09): the heart pulses with a real
   lub-dub double-thump - the `scale` property composes with the glow's
   filter animation. */
.body-heart { position:absolute; left:54%; top:38%; width:8%; height:12%; object-fit:contain; pointer-events:none;
  animation:body-art-glow 4.6s ease-in-out infinite, heartbeat 1.1s ease-in-out infinite; transform-origin:center; }
@keyframes heartbeat { 0%,100% { scale:1; } 12% { scale:1.14; } 22% { scale:1.02; } 34% { scale:1.08; } 50% { scale:1; } }
@media (prefers-reduced-motion: reduce) { .body-heart { animation:body-art-glow 4.6s ease-in-out infinite; } }
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

