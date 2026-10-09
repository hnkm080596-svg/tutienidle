<script setup lang="ts">
import { computed, ref } from 'vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { BodyPaperModel, BodyPaperUnit } from './bodyUi'

const props = defineProps<{ model: BodyPaperModel; selected: string }>()
const emit = defineEmits<{ select: [id: string] }>()

const bodyArt = (name: string) =>
  resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/body/${name}-v1.png`)

// Per-chapter silhouette instances (owner rulings 2026-10-09): Khai Mạch
// shows the martial-stance figure for the eight extraordinary meridians;
// Rèn Thể and Dẫn Linh keep the seated figure with their own treatments.
const SILHOUETTE_ART: Record<string, string> = {
  refinement: 'silhouette-seated',
  meridian: 'silhouette-stance',
  zhou_tian: 'silhouette-seated',
}
const silhouetteArt = computed(() => SILHOUETTE_ART[props.model.chapter] ?? 'silhouette-seated')

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

// Luyen Huyet (owner ruling 2026-10-09): blood vessels grow progressively -
// every 10% of the current tier reveals ~10% of the strands, main trunks
// from the heart first and fingertip ends last.
const VESSEL_PATHS: readonly { w: number; d: string }[] = [
  { w: 4.5, d: 'M712,568 C690,605 640,650 620,690 C600,728 610,770 600,815 C596,838 602,858 598,872' },
  { w: 4, d: 'M712,568 C645,555 575,530 500,505 C445,487 385,465 340,487 C305,505 285,545 275,590 C262,645 235,695 205,735 C185,762 168,795 160,822' },
  { w: 4, d: 'M712,568 C745,552 790,520 830,490 C865,465 895,485 905,530 C918,585 940,645 955,690 C972,735 1005,765 1022,790 C1038,812 1050,828 1058,845' },
  { w: 3, d: 'M712,568 C670,590 610,610 570,635 C540,655 535,690 545,720 C552,745 540,768 545,790' },
  { w: 3, d: 'M712,568 C745,595 780,620 800,650 C818,678 812,710 822,735 C830,758 825,782 832,800' },
  { w: 3, d: 'M712,575 C690,640 650,690 660,735 C668,775 640,800 648,830' },
  { w: 2.5, d: 'M712,565 C655,555 585,545 530,540 C490,536 450,548 430,575 C410,602 405,640 415,672' },
  { w: 2.5, d: 'M712,565 C760,552 820,540 860,550 C895,560 915,590 910,625 C905,655 915,685 908,715' },
  { w: 3, d: 'M712,570 C655,585 585,615 540,645 C505,670 495,705 505,738 C513,765 500,790 508,815' },
  { w: 3, d: 'M712,570 C760,590 815,620 845,655 C872,685 868,720 878,750 C886,775 880,800 888,822' },
  { w: 2.5, d: 'M712,568 C660,560 590,548 535,552 C490,556 455,575 440,605 C425,635 430,668 445,695' },
  { w: 2.5, d: 'M712,568 C768,558 835,552 875,565 C910,577 928,608 922,645 C917,678 925,708 918,738' },
  { w: 3, d: 'M712,565 C640,540 540,512 465,495 C405,480 350,485 320,515 C295,540 282,578 278,618' },
  { w: 3, d: 'M712,565 C780,542 855,515 900,500 C940,487 968,505 978,545 C988,585 990,630 985,672' },
  { w: 2.5, d: 'M712,575 C685,630 640,675 615,720 C595,755 600,795 592,828' },
  { w: 2.5, d: 'M712,575 C738,632 782,678 805,722 C825,758 818,798 828,832' },
  { w: 2, d: 'M340,487 C325,512 310,542 300,572' },
  { w: 2, d: 'M905,530 C918,555 925,575 930,600' },
  { w: 2, d: 'M275,590 C255,628 232,668 215,700' },
  { w: 2, d: 'M955,690 C972,722 995,752 1012,772' },
  { w: 2, d: 'M160,822 C152,842 146,860 142,876' },
  { w: 2, d: 'M1058,845 C1066,862 1072,876 1075,890' },
]
const bloodUnit = computed(() => props.model.units.find((u) => u.id === 'luyen_huyet'))
const vesselVisible = computed(() => (bloodUnit.value?.state ?? 'locked') !== 'locked')
const vesselLitCount = computed(() => {
  const unit = bloodUnit.value
  if (!unit) return 0
  return unit.state === 'done'
    ? VESSEL_PATHS.length
    : Math.floor(((unit.progressPct ?? 0) / 100) * VESSEL_PATHS.length)
})

// Luyen Mach (owner ruling 2026-10-09): the ring shows as soon as the tier
// unlocks; the lit nodes orbit it and each 30% of tier progress lights one
// more node (0/1/2/3). At 100% the ring itself spins (owner ruling).
const foreheadUnit = computed(() => props.model.units.find((u) => u.id === 'luyen_mach'))
const foreheadVisible = computed(() => (foreheadUnit.value?.state ?? 'locked') !== 'locked')
const foreheadDone = computed(() => foreheadUnit.value?.state === 'done')
const foreheadLitCount = computed(() => {
  const unit = foreheadUnit.value
  if (!unit) return 0
  if (unit.state === 'done') return 3
  return Math.min(3, Math.floor((unit.progressPct ?? 0) / 30))
})


// Khai Mach: fixed 8-point meridian graph (subset of the preview's 10-point
// anatomy map) - production owns exactly 8 authored meridians.
// Meridian dots as a vertical column on the left of the figure, top to
// bottom in MERIDIANS order (owner ruling 2026-10-09).
const MERIDIAN_POINTS = [
  [13, 14],
  [13, 24],
  [13, 34],
  [13, 44],
  [13, 54],
  [13, 64],
  [13, 74],
  [13, 84],
] as const
// Node drag design mode (owner request 2026-10-09): each meridian dot is
// draggable; on drop the coordinates persist to localStorage and log to the
// console so they can be baked into MERIDIAN_POINTS.
const dragPositions = ref<Record<number, [number, number]>>(
  JSON.parse(localStorage.getItem('meridian-drag-points') ?? '{}'),
)
let dragIndex = -1
let dragMoved = false
function nodePosition(index: number): readonly [number, number] {
  return dragPositions.value[index] ?? MERIDIAN_POINTS[index] ?? [50, 50]
}
function onNodePointerDown(e: PointerEvent, index: number) {
  dragIndex = index
  dragMoved = false
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onNodePointerMove(e: PointerEvent) {
  if (dragIndex < 0) return
  const stage = (e.currentTarget as HTMLElement).closest('.body-stage')
  if (!stage) return
  const r = stage.getBoundingClientRect()
  const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))
  const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))
  dragMoved = true
  dragPositions.value = { ...dragPositions.value, [dragIndex]: [x, y] }
}
function onNodePointerUp() {
  if (dragIndex >= 0 && dragMoved) {
    localStorage.setItem('meridian-drag-points', JSON.stringify(dragPositions.value))
    const arr = props.model.units.map((_, i) => nodePosition(i))
    console.log('MERIDIAN_POINTS =', JSON.stringify(arr))
  }
  dragIndex = -1
}
const meridianNodes = computed(() =>
  props.model.units.map((unit, index) => {
    const point = nodePosition(index)
    // All dots lit for layout review (owner request 2026-10-09, temporary).
    return { unit, index, x: point[0], y: point[1], lit: true }
  }),
)
// All eight meridian dots render as a column (owner ruling 2026-10-09) -
// locked ones show dimmed.
const visibleMeridianNodes = computed(() => meridianNodes.value)

// Meridian channels (owner request 2026-10-09): irregular zigzag paths
// between node centers, with small dots every 10% joined by straight
// segments. Small-dot lit count follows the destination unit's progress.
const MERIDIAN_LINKS = [
  { from: 0, to: 2, bend: 3, seed: 7 },
] as const
// Deterministic pseudo-random so the zigzag is stable across renders.
const seededJitter = (seed: number, i: number) => {
  const v = Math.sin(seed * 97.31 + i * 53.77) * 43758.5453
  return (v - Math.floor(v)) * 2 - 1
}
// Bend-point drag mode (owner request 2026-10-09): each zigzag waypoint is
// a draggable handle; positions persist to localStorage for baking.
const bendPositions = ref<Record<string, [number, number]>>(
  JSON.parse(localStorage.getItem('meridian-bend-points') ?? '{}'),
)
let bendKey: string | null = null
function onBendPointerDown(e: PointerEvent, key: string) {
  bendKey = key
  dragMoved = false
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onBendPointerMove(e: PointerEvent) {
  if (!bendKey) return
  const stage = (e.currentTarget as HTMLElement).closest('.body-stage')
  if (!stage) return
  const r = stage.getBoundingClientRect()
  const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))
  const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))
  dragMoved = true
  bendPositions.value = { ...bendPositions.value, [bendKey]: [x, y] }
}
function onBendPointerUp() {
  if (bendKey && dragMoved) {
    localStorage.setItem('meridian-bend-points', JSON.stringify(bendPositions.value))
    console.log('MERIDIAN_BENDS =', JSON.stringify(bendPositions.value))
  }
  bendKey = null
}
const bendPoint = (link: { from: number; to: number; bend: number; seed: number }, i: number, a: readonly number[], b: readonly number[]): [number, number] => {
  const key = `${link.from}-${link.to}:${i}`
  const stored = bendPositions.value[key]
  if (stored) return stored
  const t = i / (link.bend + 1)
  return [
    a[0] + (b[0] - a[0]) * t + seededJitter(link.seed, i) * 10,
    a[1] + (b[1] - a[1]) * t + seededJitter(link.seed + 3, i) * 7,
  ]
}
const meridianPaths = computed(() =>
  MERIDIAN_LINKS.map((link) => {
    const a = nodePosition(link.from)
    const b = nodePosition(link.to)
    // Irregular waypoints between the two centers (not collinear).
    const zig: [number, number][] = [a]
    for (let i = 1; i <= link.bend; i++) zig.push(bendPoint(link, i, a, b))
    zig.push(b)
    // Resample the zigzag into points spaced evenly by arc length -
    // one small dot every 10%, straight segment between dots.
    const segLen: number[] = []
    let total = 0
    for (let i = 1; i < zig.length; i++) {
      const d = Math.hypot(zig[i][0] - zig[i - 1][0], zig[i][1] - zig[i - 1][1])
      segLen.push(d)
      total += d
    }
    const dots: [number, number][] = [zig[0]]
    const step = total / 10
    let acc = 0 // distance travelled since the last placed dot
    for (let i = 1; i < zig.length; i++) {
      let l = segLen[i - 1]
      while (l > 0 && acc + l >= step && dots.length < 10) {
        const need = step - acc
        const f = need / l
        dots.push([zig[i - 1][0] + (zig[i][0] - zig[i - 1][0]) * f, zig[i - 1][1] + (zig[i][1] - zig[i - 1][1]) * f])
        zig[i - 1] = dots[dots.length - 1]
        l -= need
        acc = 0
      }
      acc += l
    }
    dots.push(b)
    // All dots lit while meridian nodes are forced lit for layout review
    // (owner request 2026-10-09, temporary) - real wiring: done = 9,
    // else floor(progressPct / 10) on the destination unit.
    return { key: `${link.from}-${link.to}`, dots, lit: 9, bends: zig.slice(1, -1), link }
  }),
)
const dotsAttr = (dots: readonly (readonly number[])[]) => dots.map((d) => `${d[0]},${d[1]}`).join(' ')


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
      <Transition name="chapter-swap">
      <div :key="model.chapter" class="chapter-layer">
      <img class="body-silhouette body-figure-art" :class="`silhouette-${model.chapter}`" :src="bodyArt(silhouetteArt)" alt="">
      <template v-if="model.chapter === 'refinement'">
        <img v-if="litLayer('skin')" class="body-glow" :src="bodyArt('silhouette-seated')" alt="" aria-hidden="true">
        <div v-if="litLayer('skin')" class="body-layer body-skin-layer lit">
          <img :src="bodyArt('silhouette-seated')" alt="">
        </div>
        <div v-if="litLayer('muscle')" class="body-layer body-muscle-layer">
          <img v-for="side in ['left', 'right']" :key="side" :class="side"
            :src="bodyArt(`biceps-${side}-lit`)" alt="">
        </div>
        <svg v-if="vesselVisible" class="body-blood" viewBox="0 0 1215 1295" aria-hidden="true"
          :style="{ maskImage: `url(${bodyArt('silhouette-seated')})`, WebkitMaskImage: `url(${bodyArt('silhouette-seated')})`, maskSize: '94% 94%', WebkitMaskSize: '94% 94%', maskPosition: 'center', WebkitMaskPosition: 'center', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }">
          <defs>
            <g id="bvessels">
              <path v-for="(vessel, i) in VESSEL_PATHS" v-show="i < vesselLitCount" :key="i"
                :stroke-width="vessel.w" :d="vessel.d"/>
            </g>
          </defs>
          <use href="#bvessels" class="bv-base"/>
          <use v-if="litLayer('heart')" href="#bvessels" class="bv-flow"/>
        </svg>
        <div v-if="vertebraVisible" class="body-spine">
          <span class="spine-core" :class="{ lit: vertebraLitCount > 0 }"></span>
          <img v-for="n in 10" :key="n" :class="{ lit: n > 10 - vertebraLitCount }" :src="bodyArt('anatomy-vertebra-lit')" alt="">
        </div>
        <img v-if="litLayer('heart')" class="body-heart" :src="bodyArt('anatomy-heart-lit')" alt="">
        <div v-if="foreheadVisible" class="body-forehead" :class="{ done: foreheadDone }">
          <img class="forehead-ring" :src="bodyArt('forehead-ring-lit')" alt="">
          <div class="forehead-orbit">
            <img v-for="(point, i) in [{ x: 50, y: 4 }, { x: 10, y: 73 }, { x: 90, y: 73 }]" :key="i"
              v-show="i < foreheadLitCount"
              class="forehead-node" :style="{ left: point.x + '%', top: point.y + '%' }"
              :src="bodyArt('forehead-node-lit')" alt="">
          </div>
        </div>
      </template>
      <template v-else-if="model.chapter === 'meridian'">
        <!-- Channel paths: irregular zigzag between node centers, small
             dot every 10%, straight segment dot-to-dot. -->
        <svg v-for="path in meridianPaths" :key="path.key"
          class="body-meridian-path" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline :points="dotsAttr(path.dots)" fill="none"
            stroke="#8a6f3f" stroke-width="0.7" vector-effect="non-scaling-stroke" opacity="0.8" />
          <circle v-for="(dot, di) in path.dots.slice(1, -1)" :key="di"
            :cx="dot[0]" :cy="dot[1]" r="0.9"
            :class="di < path.lit ? 'dot-lit' : 'dot-dim'" />
        </svg>
        <!-- Draggable bend handles shape each channel's irregularity
             (owner request 2026-10-09). -->
        <template v-for="path in meridianPaths" :key="`${path.key}-bends`">
          <button v-for="(bend, bi) in path.bends" :key="`${path.key}-${bi}`"
            class="body-meridian-bend" :style="{ left: `${bend[0]}%`, top: `${bend[1]}%` }"
            :aria-label="`Điểm gấp ${bi + 1}`"
            @pointerdown="onBendPointerDown($event, `${path.key}:${bi + 1}`)"
            @pointermove="onBendPointerMove"
            @pointerup="onBendPointerUp" />
        </template>
        <button v-for="node in visibleMeridianNodes" :key="node.unit.id"
          class="body-meridian-node body-orb" :class="[node.unit.state, { selected: selected === node.unit.id }]"
          :style="{ left: `${node.x}%`, top: `${node.y}%` }"
          :aria-pressed="selected === node.unit.id" :aria-label="node.unit.title"
          @pointerdown="onNodePointerDown($event, node.index)"
          @pointermove="onNodePointerMove"
          @pointerup="onNodePointerUp"
          @click="dragMoved ? (dragMoved = false) : emit('select', node.unit.id)">
          <img :src="bodyArt(`meridian-node-${node.lit ? 'lit' : 'unlit'}`)" alt="">
          <!-- Layout-review index badge (owner request 2026-10-09): 1-8 in data order. -->
          <span class="body-meridian-num" :class="{ 'num-left': node.index === 5 || node.index === 7 }">{{ node.index + 1 }}</span>
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
      </Transition>
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
/* Chapter transition (owner ruling 2026-10-09): swapping Rèn Thể / Khai
   Mạch / Dẫn Linh dissolves the chapter layer - the outgoing content blurs
   and sinks while the incoming fades up, the silhouette itself stays. */
.chapter-layer { position:absolute; inset:0; }
.chapter-swap-enter-active { transition:opacity .5s ease-out .08s, filter .5s ease-out .08s, transform .5s ease-out .08s; }
.chapter-swap-leave-active { transition:opacity .3s ease-in, filter .3s ease-in, transform .3s ease-in; }
.chapter-swap-enter-from { opacity:0; filter:blur(9px); transform:scale(1.06); }
.chapter-swap-leave-to { opacity:0; filter:blur(9px); transform:scale(.94); }
@media (prefers-reduced-motion: reduce) { .chapter-swap-enter-active, .chapter-swap-leave-active { transition:none; } }
/* Per-chapter treatments (owner ruling 2026-10-09): Khai Mạch sits under a
   jade edge, Dẫn Linh floats under a violet spirit aura. */
.silhouette-meridian { filter:drop-shadow(0 0 14px rgba(120,190,150,.35)); }
.silhouette-zhou_tian { filter:drop-shadow(0 0 18px rgba(150,120,255,.4)) drop-shadow(0 0 42px rgba(120,90,220,.22)); }
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
.body-muscle-layer img, .body-blood, .body-spine img.lit, .body-heart { animation:body-art-glow 4.6s ease-in-out infinite; }
@keyframes body-art-glow { 0%,100% { filter:drop-shadow(0 0 2px rgba(238,196,108,.35)); } 50% { filter:drop-shadow(0 0 6px rgba(238,196,108,.8)) drop-shadow(0 0 10px rgba(238,196,108,.45)); } }
@media (prefers-reduced-motion: reduce) { .body-muscle-layer img, .body-blood, .body-spine img.lit, .body-heart { animation:none; } }
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
/* Light pulse only travels on each heartbeat (owner ruling 2026-10-09):
   one bright dash segment is pushed along the vessels per beat, dark in
   between. Period matches the 1.1s heartbeat. */
.bv-flow { fill:none; stroke:#ffe9b0; stroke-linecap:round; stroke-dasharray:26 124; opacity:.9; animation:blood-flow 1.1s linear infinite; }
@keyframes blood-flow { from { stroke-dashoffset:0; } to { stroke-dashoffset:-150; } }
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
/* Forehead ring doubled per owner ruling 2026-10-09 (left/top recomputed
   to keep the ring centered on the same forehead point). */
.body-forehead { position:absolute; left:45.4%; top:16.8%; width:9.2%; aspect-ratio:1; pointer-events:none; }
.forehead-ring { width:100%; height:100%; object-fit:contain; animation:body-art-glow 4.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .forehead-ring { animation:none; } }
/* The lit nodes revolve around the main ring - one orbiting carrier keeps
   their 120-degree spacing while each 30% milestone reveals another dot. */
.forehead-orbit { position:absolute; inset:0; animation:forehead-orbit-spin 12s linear infinite; }
@keyframes forehead-orbit-spin { to { rotate:360deg; } }
@media (prefers-reduced-motion: reduce) { .forehead-orbit { animation:none; } }
.forehead-node { position:absolute; width:17%; height:17%; object-fit:contain; transform:translate(-50%,-50%);
  animation:body-art-glow 4.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .forehead-node { animation:none; } }
/* Luyen Mach complete (owner ruling 2026-10-09): at 100% the main ring
   itself rotates slowly - the `rotate` property composes with the shared
   glow filter animation. */
.done .forehead-ring { animation:body-art-glow 4.6s ease-in-out infinite, forehead-spin 14s linear infinite; }
@keyframes forehead-spin { to { rotate:360deg; } }
@media (prefers-reduced-motion: reduce) { .done .forehead-ring { animation:body-art-glow 4.6s ease-in-out infinite; } }
.body-meridian-node { position:absolute; width:18%; height:14%; transform:translate(-50%,-50%); z-index:3; padding:0; border:0; background:transparent; cursor:grab; touch-action:none; }
.body-meridian-node:active { cursor:grabbing; }
.body-meridian-node img { width:100%; height:100%; object-fit:contain; pointer-events:none; transform:scale(1.25); }
/* .locked dimming off while nodes are forced lit for layout review (owner request, temporary). */
.body-meridian-num { position:absolute; left:100%; top:50%; transform:translate(-15%,-50%); pointer-events:none; font-family:'Times New Roman',serif; font-size:clamp(15px,2.6vmin,22px); font-weight:700; color:#7fffd4; text-shadow:0 0 3px #000,0 0 7px #000,0 0 12px rgba(0,200,160,.8); }
.body-meridian-num.num-left { left:auto; right:100%; transform:translate(15%,-50%); }
.body-meridian-path { position:absolute; inset:0; width:100%; height:100%; z-index:2; pointer-events:none; }
.body-meridian-path .dot-lit { fill:#ffd76a; }
.body-meridian-path .dot-dim { fill:#6b5a38; opacity:.6; }
.body-meridian-bend { position:absolute; width:22px; height:22px; transform:translate(-50%,-50%); z-index:4; padding:0; border:0; border-radius:50%; background:radial-gradient(circle,#7fffd4 0 28%,transparent 32%); cursor:grab; touch-action:none; }
.body-meridian-bend:active { cursor:grabbing; }
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

