<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { BODY_POUR_VISUAL, type BodyPaperModel, type BodyPaperUnit } from './bodyUi'

const props = defineProps<{ model: BodyPaperModel; selected: string }>()
const emit = defineEmits<{ select: [id: string] }>()

const bodyArt = (name: string) =>
  resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/body/${name}-v1.png`)

// Per-chapter silhouette instances (owner rulings 2026-10-09): Khai Mach
// shows the martial-stance figure for the eight extraordinary meridians;
// Ren The and Dan Linh keep the seated figure with their own treatments.
const SILHOUETTE_ART: Record<string, string> = {
  refinement: 'silhouette-seated',
  meridian: 'silhouette-stance',
  cycle: 'silhouette-seated',
}
const silhouetteArt = computed(() => SILHOUETTE_ART[props.model.chapter] ?? 'silhouette-seated')

// Luyen Nhuc overlay (Codex handoff 2026-10-10): aligned gold overlay
// on the SAME 1312x1199 canvas as silhouette-seated - identical contain
// box means identical scale, no pixel math. -v2 name kept verbatim.
const nhucOverlayArt = resolveAssetUrl(
  '/assets/ui/tien-hiep-2026-10/body/nhuc-gold-overlay-aligned-v2.png',
)

// Pour visual channel (owner ruling 2026-10-10): while the details
// card's pour replays, units show the fill's position instead of the
// already-committed domain state - crossed tiers and intra-tier pieces
// light one-by-one riding the bar's leading edge.
const pourVisual = inject(BODY_POUR_VISUAL, null)
const visualUnits = computed<readonly BodyPaperUnit[]>(() => {
  const spec = pourVisual?.spec
  const units = props.model.units
  if (!spec || spec.chapter !== props.model.chapter) return units
  let p = pourVisual.progressAbs
  let wrapIdx = 0
  while (wrapIdx < spec.caps.length - 1 && p >= (spec.caps[wrapIdx] ?? Number.POSITIVE_INFINITY)) {
    p -= spec.caps[wrapIdx] ?? 0
    wrapIdx++
  }
  const edgeIdx = spec.tierStartIndex + wrapIdx
  return units.map((unit, index) => {
    if (index >= spec.tierStartIndex && index < edgeIdx) {
      return { ...unit, state: 'done' as const, progressPct: 100 }
    }
    if (index === edgeIdx) {
      const cap = spec.caps[wrapIdx] ?? 1
      const pct = Math.min(100, (p / cap) * 100)
      return { ...unit, state: pct >= 100 ? 'done' as const : 'current' as const, progressPct: pct }
    }
    return unit
  })
})

const unitState = computed<Record<string, BodyPaperUnit['state']>>(() => {
  const map: Record<string, BodyPaperUnit['state']> = {}
  for (const unit of visualUnits.value) map[unit.id] = unit.state
  return map
})
const unitLit = (id: string) => unitState.value[id] === 'done'

// Ren The: each completed step reveals its anatomy art on the
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
const vertebraUnit = computed(() => visualUnits.value.find((u) => u.id === 'luyen_cot'))
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
const bloodUnit = computed(() => visualUnits.value.find((u) => u.id === 'luyen_huyet'))
const vesselVisible = computed(() => (bloodUnit.value?.state ?? 'locked') !== 'locked')
// Owner ruling 2026-10-10: strands grow FROM THE ROOT - each vessel
// draws in from its heart end via dasharray instead of popping in
// whole. strandProgress sweeps 0..24 across the tier; strand i draws
// while the sweep crosses it, so trunks finish before fingertips start.
const vesselProgress = computed(() => {
  const unit = bloodUnit.value
  if (!unit) return 0
  return unit.state === 'done' ? 1 : (unit.progressPct ?? 0) / 100
})
// Only while the tier is being filled - once done the attribute MUST
// drop off or it overrides .bv-flow's CSS dasharray and kills the
// pulse (regression flagged 2026-10-10).
const vesselGrowing = computed(() => bloodUnit.value?.state === 'current')
const vesselFrac = (index: number) =>
  vesselGrowing.value
    ? `${Math.min(1, Math.max(0, vesselProgress.value * VESSEL_PATHS.length - index))} 1`
    : undefined

// Luyen Mach (owner ruling 2026-10-09): the ring shows as soon as the tier
// unlocks; the lit nodes orbit it and each 30% of tier progress lights one
// more node (0/1/2/3). At 100% the ring itself spins (owner ruling).
const foreheadUnit = computed(() => visualUnits.value.find((u) => u.id === 'luyen_mach'))
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
  [17.64, 28.25],
  [44.07, 46.42],
  [29.83, 61.97],
  [14.46, 83.33],
  [90.57, 85.31],
  [59.26, 59.51],
  [93.0, 27.72],
  [51.76, 17.28],
] as const
function nodePosition(index: number): readonly [number, number] {
  return MERIDIAN_POINTS[index] ?? [50, 50]
}
const meridianNodes = computed(() =>
  visualUnits.value.map((unit, index) => {
    const point = nodePosition(index)
    const progress = unit.progressPct ?? (unit.state === 'done' ? 100 : 0)
    return { unit, index, x: point[0], y: point[1], lit: progress >= 100, progress }
  }),
)
// All eight meridian dots render in loop order - locked ones show dimmed.
const visibleMeridianNodes = computed(() => meridianNodes.value)
// Node glyphs (owner ruling 2026-10-10): each main node shows the Han
// character of its meridian instead of the orb art; the four paired
// yin/yang meridians stack two chars so and stay distinct.
// Canonical MERIDIANS index order (QA fixpoint 2026-10-10): nham=Ren,
// doi=Dai, am_kieu=YinQiao, am_duy=YinWei, duong_duy=YangWei,
// duong_kieu=YangQiao, xung=Chong, doc=Du.
const NODE_GLYPH = ['任', '带', '阴跷', '阴维', '阳维', '阳跷', '冲', '督'] as const
const nodeGlyph = (index: number) => NODE_GLYPH[index] ?? ''

// Meridian channels: irregular zigzag paths around the 8-node body loop
// starting at left arm (0) -> chest (1) -> left thigh (2) -> left foot (3)
// -> right foot (4) -> right hip (5) -> right arm (6) -> crown (7) -> (0).
const MERIDIAN_LINKS = [
  { from: 0, to: 1, seed: 88, ctrl: [33, 36] as [number, number] },
  { from: 1, to: 2, seed: 88, ctrl: [38, 55] as [number, number] },
  { from: 2, to: 3, seed: 88, ctrl: [20, 74] as [number, number] },
  { from: 3, to: 4, seed: 88, ctrl: [52, 82] as [number, number] },
  { from: 4, to: 5, seed: 88, ctrl: [78, 73] as [number, number] },
  { from: 5, to: 6, seed: 88, ctrl: [79, 45] as [number, number] },
  { from: 6, to: 7, seed: 88, ctrl: [72, 23] as [number, number] },
  { from: 7, to: 0, seed: 88, ctrl: [33, 28] as [number, number] },
] as const
// Deterministic pseudo-random so the zigzag is stable across renders.
const seededJitter = (seed: number, i: number) => {
  const v = Math.sin(seed * 97.31 + i * 53.77) * 43758.5453
  return (v - Math.floor(v)) * 2 - 1
}
// Baked channel waypoints oriented along the 0->1->2->3->4->5->6->7->0 loop.
const BEND_DEFAULTS: Record<string, readonly [number, number]> = {
  '0-1:d1': [29.64, 31.77], '0-1:d2': [36.76, 32.65], '0-1:d3': [39.2, 37.95], '0-1:d4': [46.14, 36.51],
  '1-2:d1': [47.26, 54.99], '1-2:d2': [38.45, 53.63], '1-2:d3': [41.08, 59.07],
  '2-3:d1': [20.83, 61.49], '2-3:d2': [20.08, 68.89], '2-3:d3': [14.64, 70.25], '2-3:d4': [16.92, 78.91],
  '3-4:d1': [23.45, 69.78], '3-4:d2': [39.76, 65.35], '3-4:d3': [53.82, 63.23], '3-4:d4': [78.76, 73.5],
  '4-5:d1': [86.44, 75.45], '4-5:d2': [82.13, 68.74], '4-5:d3': [72.76, 65.84], '4-5:d4': [73.13, 60.86],
  '5-6:d1': [50.45, 45.3], '5-6:d2': [57.38, 37.64], '5-6:d3': [78.19, 38.89], '5-6:d4': [92.25, 33.78],
  '6-7:d1': [90.0, 33.46], '6-7:d2': [79.88, 35.99], '6-7:d3': [60.2, 35.44], '6-7:d4': [49.89, 32.06],
  '7-0:d1': [49.32, 24.51], '7-0:d2': [45.39, 29.93], '7-0:d3': [45.95, 33.55], '7-0:d4': [34.51, 28.49],
}
// Interior dot i sits at t = i/5; the baked waypoint wins when authored,
// else a quadratic-bezier-through-ctrl + jitter keeps the path irregular.
const channelDot = (link: { from: number; to: number; seed: number; ctrl?: readonly [number, number] }, i: number, a: readonly [number, number], b: readonly [number, number]): [number, number] => {
  const key = `${link.from}-${link.to}:d${i}`
  const baked = BEND_DEFAULTS[key]
  if (baked) return [baked[0], baked[1]]
  const t = i / 5 // 4 interior dots (owner ruling 2026-10-10)
  // Quadratic bezier through ctrl keeps the default path inside the body;
  // jitter on top keeps it irregular (owner rulings 2026-10-09).
  const c: readonly [number, number] = link.ctrl ?? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const u = 1 - t
  const px = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0]
  const py = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const side = i % 2 === 0 ? 1 : -1
  const amp = 1 + Math.abs(seededJitter(link.seed, i)) * 2.5
  return [
    px + (-dy / len) * side * amp + seededJitter(link.seed + 5, i) * 1.5,
    py + (dx / len) * side * amp + seededJitter(link.seed + 7, i) * 1.5,
  ]
}
const meridianPaths = computed(() =>
  MERIDIAN_LINKS.map((link) => {
    const a = nodePosition(link.from)
    const b = nodePosition(link.to)
    const dots: [number, number][] = [[a[0], a[1]]]
    for (let i = 1; i <= 4; i++) dots.push(channelDot(link, i, a, b))
    dots.push([b[0], b[1]])
    // Each 20% of the source meridian's progress lights one interior dot
    // along its outgoing channel (4 dots = 20/40/60/80; 100% = node).
    const source = visualUnits.value[link.from]
    const sourcePct = source?.progressPct ?? (source?.state === 'done' ? 100 : 0)
    const lit = Math.min(4, Math.floor(sourcePct / 20))
    return { key: `${link.from}-${link.to}`, dots, lit, link }
  }),
)
const dotTwinkle = (link: { from: number; to: number; seed: number }, di: number) => {
  let h = (link.from * 31 + link.to * 17 + di * 13 + link.seed) >>> 0
  h = ((h * 2654435761) >>> 0) ^ (h >>> 13)
  const dur = 3.4 + (h % 340) / 100 // 3.4s - 6.8s slow drift per dot
  const delay = -((h >>> 8) % 680) / 100 // negative = mid-cycle start
  return { animationDuration: dur + 's', animationDelay: delay + 's' }
}
const dotsAttr = (dots: readonly (readonly number[])[]) => dots.map((d) => `${d[0]},${d[1]}`).join(' ')

// Light circuit: one bright streak runs the whole meridian loop 0..7->0,
// reusing each channel's current dots.
const MERIDIAN_ORDER = [0, 1, 2, 3, 4, 5, 6, 7] as const
const circuit = computed(() => {
  const pts: [number, number][] = []
  const dists: number[] = [0]
  const arrival: Record<number, number> = {}
  for (let i = 0; i < MERIDIAN_ORDER.length; i++) {
    const a = MERIDIAN_ORDER[i]!
    const b = MERIDIAN_ORDER[(i + 1) % MERIDIAN_ORDER.length]!
    const path = meridianPaths.value.find((p) =>
      (p.link.from === a && p.link.to === b) || (p.link.from === b && p.link.to === a))
    if (!path) continue
    const seg = path.link.from === a ? path.dots : [...path.dots].reverse()
    for (const d of seg) {
      const prev = pts[pts.length - 1]
      if (prev) dists.push(dists[dists.length - 1]! + Math.hypot(d[0] - prev[0], d[1] - prev[1]))
      pts.push(d)
    }
    // The spark reaches node b at this cumulative distance. QA fixpoint
    // 2026-10-10: the closing leg returns to the loop start - recording
    // it stamped the START node with the full-loop delay, so any lit
    // progress made litFrac=1 and the light ran the whole circuit
    // (including unopened nodes). Keep arrivals for real arrivals only.
    if (i + 1 < MERIDIAN_ORDER.length) arrival[b] = dists[dists.length - 1]!
  }
  // The loop start is covered from t=0 the moment it has any progress.
  arrival[MERIDIAN_ORDER[0]!] = 0
  const total = dists[dists.length - 1] || 1
  // Spark covers the loop in 8.5s (85% of the 10s cycle).
  const ringDelay = Object.fromEntries(
    Object.entries(arrival).map(([k, v]) => [k, (v / total) * 8.5]),
  ) as Record<number, number>
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
  return { d, ringDelay }
})
const circuitD = computed(() => circuit.value.d)

// Owner ruling 2026-10-10: the traveling light runs only from the circuit
// start to the deepest opened node along the loop - covered nodes keep the
// same arrival delays, uncovered nodes get no ping/glyph flash.
const litSeconds = computed(() => {
  let best = 0
  for (const n of visibleMeridianNodes.value) {
    const p = n.progress ?? 0
    if (p > 0) {
      const startDelay = circuit.value.ringDelay[n.index] ?? 0
      const endDelay = n.index + 1 < MERIDIAN_ORDER.length
        ? (circuit.value.ringDelay[n.index + 1] ?? 8.5)
        : 8.5
      best = Math.max(best, startDelay + (Math.min(100, p) / 100) * (endDelay - startDelay))
    }
  }
  return best
})
const litFrac = computed(() => {
  const nodes = visibleMeridianNodes.value
  if (nodes.length > 0 && nodes.every((n) => (n.progress ?? 0) >= 100)) return 1
  return litSeconds.value / 8.5
})

// One shared clock (owner ruling 2026-10-10): spark/fill/rings are driven
// by Web Animations on the same startTime, so a ring can never ping before
// the light actually reaches its node.
const stageEl = ref<HTMLElement>()
let meridianAnims: Animation[] = []
// Shared cycle epoch: keeps the 20s loop's phase steady across resyncs.
// Without it every invest (progress change) re-anchored the streak to 0,
// so the light never visibly travelled far and the finale never landed
// (owner flag 2026-10-10). Reset when the circuit goes dark.
let meridianEpoch: number | null = null
function syncMeridianAnims() {
  const root = stageEl.value
  if (!root || props.model.chapter !== 'meridian') return
  const spark = root.querySelector('.sweep-core')
  const fill = root.querySelector<HTMLElement>('.circuit-fill')
  const rings = root.querySelectorAll<HTMLElement>('.body-meridian-ring')
  // Intermittent-streak fix (owner 2026-10-10): do NOT cancel the live
  // anims until every element needed for the rebuild exists - a resync
  // firing mid-render (chapter swap / progress change while nodes are
  // unmounted) used to cancel everything then bail, leaving the circuit
  // dead until some later watch happened to resync into a ready DOM.
  if (!spark || !fill || !rings.length) return
  const hasProgress = visibleMeridianNodes.value.some((n) => (n.progress ?? 0) > 0)
  meridianAnims.forEach((a) => a.cancel())
  meridianAnims = []
  // No opened node yet -> the light has nowhere to run (owner ruling:
  // it must never touch an unopened node). Gate on "any progress", not
  // litSeconds: the loop-start node sits at arrival 0, so a first-only
  // meridian state has litSeconds 0 yet its ring/glyph must still pulse.
  if (!hasProgress) { meridianEpoch = null; return }
  const t = Number(document.timeline.currentTime ?? 0)
  if (meridianEpoch == null) meridianEpoch = t
  const travelF = Math.max(litFrac.value, 0.001)
  const litLen = travelF * 100
  const travelEnd = Math.min(travelF * 0.85, 0.999)
  const holdEnd = Math.min(travelEnd + 0.05, 1)
  const fadeEnd = Math.min(travelEnd + 0.12, 1)
  fill.style.strokeDasharray = `${litLen} 100`
  // The DOM lib on this toolchain omits KeyframeAnimationOptions.startTime;
  // assigning it on the returned Animation keeps the shared-clock semantics.
  const timedAnimate = (el: Element, frames: Keyframe[], options: KeyframeAnimationOptions) => {
    const anim = el.animate(frames, options)
    anim.startTime = meridianEpoch!
    return anim
  }
  meridianAnims.push(timedAnimate(fill,
    [
      { strokeDashoffset: `${litLen}`, opacity: 1, offset: 0 },
      { strokeDashoffset: '0', opacity: 1, offset: travelEnd },
      { strokeDashoffset: '0', opacity: 1, offset: holdEnd },
      { strokeDashoffset: '0', opacity: 0, offset: fadeEnd },
      { strokeDashoffset: '0', opacity: 0, offset: 1 },
    ],
    { duration: 20000, iterations: Infinity },
  ))
  meridianAnims.push(timedAnimate(spark,
    [
      { strokeDashoffset: '0', opacity: 1, offset: 0 },
      { strokeDashoffset: `${-litLen}`, opacity: 1, offset: travelEnd },
      { strokeDashoffset: `${-litLen}`, opacity: 0, offset: Math.min(travelEnd + 0.01, 1) },
      { strokeDashoffset: '0', opacity: 0, offset: 1 },
    ],
    { duration: 20000, iterations: Infinity },
  ))
  const litS = litFrac.value * 8.5 + 0.05
  // Ping delay = the light's ARRIVAL at that node (owner 2026-10-10):
  // node 0 is the circuit start - the streak leaves it at t=0 but only
  // ARRIVES when the loop closes, so its ping is the full-loop delay
  // (8.5s, last), not 0. Other nodes keep their first-arrival delays.
  const nodePingDelay = (index: number) =>
    index === MERIDIAN_ORDER[0] ? 8.5 : (circuit.value.ringDelay[index] ?? 99)
  rings.forEach((ring, i) => {
    const node = visibleMeridianNodes.value[i]
    if (!node) return
    // Ping/glyph/comets are done-node effects only (owner 2026-10-10):
    // a node must be fully opened before the passing light pings it.
    if (node.unit.state !== 'done') return
    const pingDelays: number[] = []
    if (nodePingDelay(node.index) <= litS) {
      pingDelays.push(nodePingDelay(node.index) * 2000)
    }
    // Loop-close finale (owner 2026-10-10): the instant the streak
    // arrives back at node 0, EVERY node pings at once - not only the
    // start node. Non-start nodes keep their own arrival ping AND join
    // the finale burst; the start node's only ping IS the finale.
    if (litFrac.value >= 1 && node.index !== MERIDIAN_ORDER[0]) {
      pingDelays.push(8.5 * 2000)
    }
    for (const delay of pingDelays) {
      meridianAnims.push(timedAnimate(ring,
        [
          { transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0, offset: 0 },
          { opacity: 0.95, offset: 0.005 },
          { transform: 'translate(-50%,-50%) scale(2.6)', opacity: 0, offset: 0.035 },
          { transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0, offset: 1 },
        ],
        { duration: 20000, iterations: Infinity, delay },
      ))
    }
  })
  root.querySelectorAll<HTMLElement>('.glyph-lit').forEach((lit, i) => {
    const node = visibleMeridianNodes.value[i]
    if (!node) return
    // Done nodes only (owner 2026-10-10): the glyph flashes as the light
    // passes AND joins the all-at-once ping when the loop closes on
    // node 0 - the start node's only flash is that finale.
    if (node.unit.state !== 'done') return
    const pingDelays: number[] = []
    if (nodePingDelay(node.index) <= litS) {
      pingDelays.push(nodePingDelay(node.index) * 2000)
    }
    if (litFrac.value >= 1 && node.index !== MERIDIAN_ORDER[0]) {
      pingDelays.push(8.5 * 2000)
    }
    for (const delay of pingDelays) {
      meridianAnims.push(timedAnimate(lit,
        [
          { clipPath: 'circle(0% at 50% 50%)', opacity: 1, offset: 0 },
          { clipPath: 'circle(140% at 50% 50%)', opacity: 1, offset: 0.033 },
          { clipPath: 'circle(140% at 50% 50%)', opacity: 1, offset: 0.08 },
          { clipPath: 'circle(0% at 50% 50%)', opacity: 0, offset: 0.11 },
          { clipPath: 'circle(0% at 50% 50%)', opacity: 0, offset: 1 },
        ],
        { duration: 20000, iterations: Infinity, delay },
      ))
    }
  })
}
watch(() => props.model.chapter, () => nextTick(syncMeridianAnims), { flush: 'post' })
// QA fixpoint 2026-10-10: ring/glyph/spark spans are baked from the lit
// state at sync time - an invest mid-chapter left them stale until a
// chapter swap or remount. Resync on any unit progress/state change.
watch(
  () => visibleMeridianNodes.value.map((n) => `${n.index}:${n.progress}:${n.unit.state}`).join('|'),
  () => nextTick(syncMeridianAnims),
  { flush: 'post' },
)
onMounted(syncMeridianAnims)
onBeforeUnmount(() => meridianAnims.forEach((a) => a.cancel()))


// Chu Thien: galaxy pieces lit by the chapter progress fraction; lit pieces
// orbit. Progress arrives as the completed/total percentage on the model.
const GALAXY = [
  { id: 'core', x: 50, y: 49, w: 14, angle: 0, duration: 0, reverse: false },
  { id: 'orbit-circle', x: 50, y: 49, w: 18, angle: 0, duration: 19, reverse: false },
  { id: 'orbit-ellipse', x: 50, y: 49, w: 21, angle: -24, duration: 27, reverse: true },
  { id: 'orbit-ellipse', x: 50, y: 49, w: 30, angle: 38, duration: 33, reverse: false },
  { id: 'orbit-circle', x: 50, y: 49, w: 39, angle: 65, duration: 43, reverse: true },
  { id: 'orbit-ellipse', x: 50, y: 49, w: 48, angle: -52, duration: 51, reverse: false },
] as const

// Deterministic inward-streaming particles for the galactic core (Tu Hoa
// style continuous gather into the nucleus). Golden-angle spacing avoids
// symmetric clumping while staggered negative delays keep the inflow steady.
const CORE_SPIRAL_ANGLES = [0, 90, 180, 270] as const
const CORE_INNER_ARMS = [0, 120, 240] as const
const CORE_INWARD_PARTICLES = Array.from({ length: 24 }, (_, i) => {
  const angle = Number(((i * 137.508) % 360).toFixed(1))
  const band = i % 3
  const r0 = 44 + (i % 5) * 6.5
  const swirl = ((i % 2 === 0 ? 1 : -1) * (4 + (i % 4) * 2.2))
  const size = Number((1.35 + (i % 4) * 0.35).toFixed(2))
  const streak = Number((4.2 + (i % 4) * 1.4).toFixed(2))
  const duration = Number((1.3 + (i % 6) * 0.18).toFixed(2))
  const delay = Number((-(i * 0.19) % duration).toFixed(2))
  const color = band === 0
    ? 'rgba(255, 220, 125, 0.85)'
    : band === 1
      ? 'rgba(195, 155, 255, 0.82)'
      : 'rgba(255, 245, 200, 0.9)'
  const headColor = band === 1 ? '#f3e8ff' : '#fffdf2'
  return { id: i, angle, r0, swirl, size, streak, duration, delay, color, headColor }
})

const cycleProgressPct = computed(() => {
  const spec = pourVisual?.spec
  if (spec && spec.chapter === 'cycle') {
    return Math.min(100, (pourVisual.progressAbs / 36) * 100)
  }
  return props.model.progress
})

// 36 steps / 6 pieces: every 6 completed steps ignites one art piece
// (owner ruling 2026-10-10) - core first, then the 5 orbit rings
// inner-out. floor() so a partial 6-step block lights nothing yet.
const galaxyLit = computed(() =>
  Math.min(GALAXY.length, Math.floor(((cycleProgressPct.value / 100) * 36 + 1e-9) / 6)),
)
// Codex preview parity: the star field ignites past step 4/8 (62.5%).
const starsLit = computed(() => cycleProgressPct.value > 62)
const galaxyPieces = computed(() =>
  GALAXY.map((piece, index) => ({ ...piece, lit: index < galaxyLit.value })),
)
</script>
<template>
  <div class="body-center body-paper-figure">
    <div class="body-stage" :aria-label="model.chapterLabel" ref="stageEl">
      <Transition name="chapter-swap">
      <div :key="model.chapter" class="chapter-layer">
      <img class="body-silhouette body-figure-art" :class="`silhouette-${model.chapter}`" :src="bodyArt(silhouetteArt)" alt="">
      <template v-if="model.chapter === 'refinement'">
        <img v-if="litLayer('skin')" class="body-glow" :src="bodyArt('silhouette-seated')" alt="" aria-hidden="true">
        <div v-if="litLayer('skin')" class="body-layer body-skin-layer lit">
          <img :src="bodyArt('silhouette-seated')" alt="">
        </div>
        <div v-if="litLayer('muscle')" class="body-layer body-muscle-layer">
          <img class="body-muscle-overlay" :src="nhucOverlayArt" alt="">
        </div>
        <svg v-if="vesselVisible" class="body-blood" viewBox="0 0 1215 1295" aria-hidden="true"
          :style="{ maskImage: `url(${bodyArt('silhouette-seated')})`, WebkitMaskImage: `url(${bodyArt('silhouette-seated')})`, maskSize: '94% 94%', WebkitMaskSize: '94% 94%', maskPosition: 'center', WebkitMaskPosition: 'center', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }">
          <defs>
            <g id="bvessels">
              <path v-for="(vessel, i) in VESSEL_PATHS" :key="i"
                :stroke-width="vessel.w" :d="vessel.d"
                :pathLength="vesselGrowing ? 1 : undefined"
                :stroke-dasharray="vesselFrac(i)"/>
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
            stroke="#ffce6b" stroke-width="0.3" vector-effect="non-scaling-stroke" opacity="0.95"
            style="filter:drop-shadow(0 0 1.5px rgba(255,190,80,.9))" />
          <circle v-for="(dot, di) in path.dots.slice(1, -1)" :key="di"
            :cx="dot[0]" :cy="dot[1]" r="0.35"
            :class="di < path.lit ? 'dot-lit' : 'dot-dim'"
            :style="dotTwinkle(path.link, di)" />
        </svg>
        <!-- One light streak runs the meridian loop 1-2-3-7-5-8-4-6-1
             (owner ruling 2026-10-10). -->
        <svg class="body-meridian-flow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path :d="circuitD" class="circuit-fill" pathLength="100" fill="none"/>
          <path :d="circuitD" class="sweep-core" pathLength="100" fill="none"/>
        </svg>
        <button v-for="node in visibleMeridianNodes" :key="node.unit.id"
          class="body-meridian-node body-orb" :class="[node.unit.state, { selected: selected === node.unit.id }]"
          :style="{ left: `${node.x}%`, top: `${node.y}%` }"
          :aria-pressed="selected === node.unit.id" :aria-label="node.unit.title"
          @click="emit('select', node.unit.id)">
          <span class="node-core" aria-hidden="true"></span>
          <span v-if="node.unit.state === 'done'" class="comet-orbit" aria-hidden="true"><i></i><i></i></span>
          <span class="meridian-glyph" :class="{ two: nodeGlyph(node.index).length > 1 }"><span v-for="(ch, ci) in nodeGlyph(node.index)" :key="ci">{{ ch }}</span></span>
          <span class="meridian-glyph glyph-lit" :class="{ two: nodeGlyph(node.index).length > 1 }" aria-hidden="true"><span v-for="(ch, ci) in nodeGlyph(node.index)" :key="ci">{{ ch }}</span></span>
          <!-- Layout-review index badge (owner request 2026-10-09): 1-8 in data order. -->
          <span class="body-meridian-num" :class="{ 'num-left': node.index === 4 || node.index === 6 }">{{ node.index + 1 }}</span>
        </button>
        <!-- Loop-complete ripple: a thin ring pings out of each node once
             the circuit is fully lit (owner ruling 2026-10-10). -->
        <span v-for="node in visibleMeridianNodes" :key="`ring-${node.unit.id}`"
          class="body-meridian-ring" :style="{ left: `${node.x}%`, top: `${node.y}%` }"/>
      </template>
      <template v-else-if="model.chapter === 'cycle'">
        <template v-for="(piece, i) in galaxyPieces" :key="i">
          <template v-if="piece.lit">
            <!-- Galactic core SVG (owner ruling 2026-10-17): only rendered
                 once activated, featuring a cosmic nebula, swirling spiral
                 arms, and continuous inward-flying particles (Tu Hoa style). -->
            <svg v-if="piece.id === 'core'"
              class="body-galaxy-piece galaxy-core lit"
              :style="{ left: `${piece.x}%`, top: `${piece.y}%`, width: `${piece.w}%`, '--orbit-angle': '0deg' }"
              viewBox="-80 -80 160 160" aria-hidden="true">
              <defs>
                <radialGradient id="ztCoreHalo" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="rgba(255,242,190,.92)"/>
                  <stop offset="28%" stop-color="rgba(255,198,95,.62)"/>
                  <stop offset="58%" stop-color="rgba(178,120,255,.34)"/>
                  <stop offset="82%" stop-color="rgba(115,72,220,.12)"/>
                  <stop offset="100%" stop-color="rgba(90,50,190,0)"/>
                </radialGradient>
                <radialGradient id="ztCoreBall" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#ffffff"/>
                  <stop offset="28%" stop-color="#fff6cf"/>
                  <stop offset="58%" stop-color="#ffbe55"/>
                  <stop offset="84%" stop-color="#c96b1e"/>
                  <stop offset="100%" stop-color="rgba(135,55,190,0)"/>
                </radialGradient>
                <linearGradient id="ztSpiralGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="rgba(255,250,220,.95)"/>
                  <stop offset="48%" stop-color="rgba(255,198,92,.62)"/>
                  <stop offset="100%" stop-color="rgba(175,120,255,0)"/>
                </linearGradient>
                <linearGradient id="ztSpiralViolet" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="rgba(240,225,255,.88)"/>
                  <stop offset="52%" stop-color="rgba(170,125,255,.48)"/>
                  <stop offset="100%" stop-color="rgba(115,70,215,0)"/>
                </linearGradient>
              </defs>
              <circle class="halo" cx="0" cy="0" r="68" fill="url(#ztCoreHalo)"/>
              <!-- Outer swirling galactic spiral arms -->
              <g class="surface galaxy-spiral-outer">
                <g v-for="(deg, si) in CORE_SPIRAL_ANGLES" :key="`arm-${deg}`" :transform="`rotate(${deg})`">
                  <path
                    d="M 0,0 C 10,-3 22,-13 28,-28 C 33,-40 26,-52 12,-58"
                    fill="none"
                    :stroke="si % 2 === 0 ? 'url(#ztSpiralGold)' : 'url(#ztSpiralViolet)'"
                    :stroke-width="si % 2 === 0 ? 3.2 : 2.4"
                    stroke-linecap="round"
                  />
                </g>
              </g>
              <!-- Inner high-speed accretion vortex -->
              <g class="galaxy-spiral-inner">
                <circle cx="0" cy="0" r="22" fill="none" stroke="rgba(255,228,158,.45)" stroke-width="1.3" stroke-dasharray="7 9" stroke-linecap="round"/>
                <g v-for="deg in CORE_INNER_ARMS" :key="`in-${deg}`" :transform="`rotate(${deg})`">
                  <path
                    d="M 0,0 C 7,2 14,10 16,21"
                    fill="none"
                    stroke="url(#ztSpiralGold)"
                    stroke-width="2.1"
                    stroke-linecap="round"
                  />
                </g>
              </g>
              <!-- Continuous inward-flying particles (Tu Hoa style gather) -->
              <g class="zt-inward-particles">
                <g v-for="p in CORE_INWARD_PARTICLES" :key="p.id" :transform="`rotate(${p.angle})`">
                  <g
                    class="zt-inward-mote"
                    :style="{
                      '--r0': `${p.r0}px`,
                      '--swirl': `${p.swirl}px`,
                      '--dur': `${p.duration}s`,
                      '--delay': `${p.delay}s`,
                    }"
                  >
                    <ellipse class="mote-tail" :cx="p.streak * 0.45" cy="0" :rx="p.streak" :ry="p.size * 0.46" :fill="p.color"/>
                    <circle class="mote-head" cx="0" cy="0" :r="p.size" :fill="p.headColor"/>
                  </g>
                </g>
              </g>
              <!-- Galactic nucleus + pulsing shock ring + starflare -->
              <circle class="core-shock-ring" cx="0" cy="0" r="15"/>
              <circle class="ball" cx="0" cy="0" r="19" fill="url(#ztCoreBall)"/>
              <path class="shine core-starflare" d="M -24,0 Q -3.5,0 0,-24 Q 3.5,0 24,0 Q 3.5,0 0,24 Q -3.5,0 -24,0 Z" fill="rgba(255,252,235,.88)"/>
              <path class="core-starflare-diag" d="M -12,-12 Q -1.5,0 12,-12 Q 0,1.5 12,12 Q 1.5,0 -12,12 Q 0,-1.5 -12,-12 Z" fill="rgba(255,238,185,.65)"/>
              <circle class="core-pinpoint" cx="0" cy="0" r="5.2" fill="#ffffff"/>
            </svg>
            <img v-else
              class="body-galaxy-piece orbiting"
              :style="{
                left: `${piece.x}%`, top: `${piece.y}%`, width: `${piece.w}%`,
                '--orbit-angle': `${piece.angle}deg`,
                animationDuration: `${piece.duration}s`,
                animationDirection: piece.reverse ? 'reverse' : 'normal',
                animationDelay: `${-i * 7}s`,
              }"
              :src="bodyArt(`galaxy-${piece.id}-lit`)" alt="">
          </template>
        </template>
        <img v-if="starsLit" class="body-galaxy-stars" :src="bodyArt('galaxy-stars-lit')" alt="">
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
/* Chapter transition (owner ruling 2026-10-09): swapping Ren The / Khai
   Mach / Dan Linh dissolves the chapter layer - the outgoing content blurs
   and sinks while the incoming fades up, the silhouette itself stays. */
.chapter-layer { position:absolute; inset:0; }
.chapter-swap-enter-active { transition:opacity .5s ease-out .08s, filter .5s ease-out .08s, transform .5s ease-out .08s; }
.chapter-swap-leave-active { transition:opacity .3s ease-in, filter .3s ease-in, transform .3s ease-in; }
.chapter-swap-enter-from { opacity:0; filter:blur(9px); transform:scale(1.06); }
.chapter-swap-leave-to { opacity:0; filter:blur(9px); transform:scale(.94); }
@media (prefers-reduced-motion: reduce) { .chapter-swap-enter-active, .chapter-swap-leave-active { transition:none; } }
/* Per-chapter treatments (owner ruling 2026-10-09): Khai Mach sits under a
   jade edge, Dan Linh floats under a violet spirit aura. */
.silhouette-meridian { filter:drop-shadow(0 0 14px rgba(120,190,150,.35)); }
.silhouette-cycle, .silhouette-zhou_tian { filter:drop-shadow(0 0 18px rgba(150,120,255,.4)) drop-shadow(0 0 42px rgba(120,90,220,.22)); }
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
/* Luyen Nhuc overlay sits in the exact silhouette box (same canvas
   size + object-fit:contain = Codex's "same scale as base" rule).
   Must out-specific the retired biceps img rule below (top/width). */
.body-muscle-layer img.body-muscle-overlay { position:absolute; inset:0; width:100%; height:100%; object-fit:contain;
  animation:body-art-glow 4.6s ease-in-out infinite; }
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
.body-meridian-node { position:absolute; width:9%; height:9%; transform:translate(-50%,-50%); z-index:5; padding:0; border:0; background:transparent; cursor:pointer; }
.body-meridian-node img { width:100%; height:100%; object-fit:contain; pointer-events:none; transform:scale(1.25); }
/* Owner ruling 2026-10-10: main node = same small dot as the channel dots.
   Unopened shows the bare dim dot only; opened lights the dot, orbits twin
   comets and keeps its Han glyph lit. The glyph only flashes into view as
   the light ping passes an unopened node. */
.node-core { position:absolute; left:50%; top:50%; width:5px; height:5px; transform:translate(-50%,-50%); border-radius:50%; background:#6b5a38; opacity:.75; pointer-events:none; }
.body-meridian-node.done .node-core { background:#ffd76a; opacity:1; box-shadow:0 0 4px rgba(255,205,95,.9); }
.comet-orbit { position:absolute; left:50%; top:50%; width:0; height:0; pointer-events:none; animation:comet-spin 3.8s linear infinite; }
.comet-orbit i { position:absolute; width:4px; height:4px; margin:-2px; border-radius:50%; background:#fff3c0; box-shadow:0 0 5px rgba(255,205,95,.95), 0 0 9px rgba(255,205,95,.55); }
.comet-orbit i:first-child { transform:translateY(-13px); }
.comet-orbit i:last-child { transform:translateY(13px); }
@keyframes comet-spin { to { rotate:360deg; } }
@media (prefers-reduced-motion: reduce) { .comet-orbit { animation:none; } }
/* Han glyph nodes (owner ruling 2026-10-10): one character per meridian,
   gold-glowing; paired yin/yang meridians stack two chars vertically. */
.meridian-glyph { display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; pointer-events:none; font-family:'Ma Shan Zheng','ZCOOL XiaoWei','Noto Serif SC',serif; font-size:clamp(22px,5.5vmin,38px); line-height:1; color:#9a9082; text-shadow:0 0 3px rgba(0,0,0,.55), 0 1px 2px #000; opacity:0; }
/* Glyph ping requires the node opened AND the light passing (owner ruling)
   - nothing stays lit. */
.glyph-lit { position:absolute; inset:0; color:#ffe9a0; text-shadow:0 0 6px rgba(255,205,95,.95), 0 0 2px rgba(120,70,0,.9), 0 1px 2px #000; clip-path:circle(0% at 50% 50%); opacity:0; }
/* Two-char glyphs: one char per flex row (owner 2026-10-10) - per-char
   spans stack vertically inside the base flex-column. writing-mode was
   dropped: vertical-rl re-maps flex column to horizontal on this
   toolchain, rendering the pair side-by-side in reverse order. */
.meridian-glyph.two { font-size:clamp(13px,3.2vmin,22px); line-height:1.15; }
/* Sonar-style ring ping as the spark passes each node (owner ruling
   2026-10-10) - WAAPI on the shared meridian clock lands it at arrival. */
.body-meridian-ring { position:absolute; width:34px; height:34px; border-radius:50%; border:1.5px solid rgba(255,235,170,.95); box-shadow:0 0 8px rgba(255,205,95,.8), inset 0 0 6px rgba(255,205,95,.5); transform:translate(-50%,-50%) scale(.3); opacity:0; pointer-events:none; z-index:3; }
/* .locked dimming off while nodes are forced lit for layout review (owner request, temporary). */
.body-meridian-num { display:none; position:absolute; left:100%; top:50%; transform:translate(-15%,-50%); pointer-events:none; font-family:'Times New Roman',serif; font-size:clamp(15px,2.6vmin,22px); font-weight:700; color:#7fffd4; text-shadow:0 0 3px #000,0 0 7px #000,0 0 12px rgba(0,200,160,.8); }
.body-meridian-num.num-left { left:auto; right:100%; transform:translate(15%,-50%); }
.body-meridian-path { position:absolute; inset:0; width:100%; height:100%; z-index:2; pointer-events:none; }
.body-meridian-flow { position:absolute; inset:0; width:100%; height:100%; z-index:2; pointer-events:none; }
/* Light-fill cycle (owner 2026-10-10): the spark fills the loop behind it;
   on a full loop all 8 nodes flash, then the cycle restarts. */
.circuit-fill { stroke:#ffd76a; stroke-width:0.2; stroke-linecap:round; stroke-dasharray:100 100; stroke-dashoffset:100; filter:drop-shadow(0 0 1.4px rgba(255,205,95,.85)); }
/* opacity:0 default: without it the 1.2-unit dash draws a static bright
   comet head at the path start whenever the sweep early-exits at 0
   progress (owner flag 2026-10-10). WAAPI keyframes set opacity:1. */
.sweep-core { stroke:#fff6d8; stroke-width:0.175; stroke-linecap:round; stroke-dasharray:1.2 98.8; opacity:0; filter:drop-shadow(0 0 1.2px #fff0b0) drop-shadow(0 0 3px rgba(255,205,95,.9)); }
@keyframes circuit-run { to { stroke-dashoffset:-100; } }
.body-meridian-path .dot-lit { fill:#ffd76a; animation:meridianTwinkle 5s ease-in-out infinite; }
.body-meridian-path .dot-dim.twinkle { animation:meridianTwinkle 2.6s ease-in-out infinite; }
@keyframes meridianTwinkle {
  0%, 100% { opacity:.5; filter:drop-shadow(0 0 .3px rgba(255,215,120,.4)); }
  50% { opacity:.95; filter:drop-shadow(0 0 .8px rgba(255,235,170,.9)) drop-shadow(0 0 1.6px rgba(255,205,95,.6)); }
}
.body-meridian-path .dot-dim { fill:#6b5a38; opacity:.6; }
.body-meridian-node.selected img { filter:drop-shadow(0 0 5px #ffd785); }
.body-meridian-node:focus-visible { outline:2px solid #315d48; outline-offset:2px; }
.body-meridian-line { position:absolute; height:12px; transform-origin:left center; z-index:2; pointer-events:none; }
.body-meridian-line img { width:100%; height:100%; object-fit:fill; }
.meridian-flow { position:absolute; top:43%; left:8%; width:84%; height:14%; background:linear-gradient(90deg, transparent 20%, #fff3b2 45%, transparent 65%); background-size:200% 100%; animation:meridian-flow 2.4s linear infinite; }
.body-galaxy-piece { position:absolute; height:auto; transform:translate(-50%,-50%) rotate(var(--orbit-angle)); pointer-events:none; }
.body-galaxy-piece.orbiting { animation:orbit-drift 28s linear infinite; }
.body-galaxy-stars { position:absolute; left:34%; top:46%; width:32%; height:20%; object-fit:contain; pointer-events:none; animation:body-art-glow 4.6s ease-in-out infinite; }
/* Galactic core SVG (owner ruling 2026-10-17): multi-layered nebula,
   swirling spiral arms, and continuous inward-flying particles (Tu Hoa). */
.galaxy-core { aspect-ratio:1; overflow:visible; z-index:4; }
.galaxy-core.lit { animation:ztCorePulse 3.6s ease-in-out infinite; }
.galaxy-core.lit .galaxy-spiral-outer { transform-origin:0 0; animation:ztCoreSpin 9.5s linear infinite; }
.galaxy-core.lit .galaxy-spiral-inner { transform-origin:0 0; animation:ztCoreSpin 4.4s linear infinite; }
.galaxy-core.lit .zt-inward-particles { transform-origin:0 0; animation:ztCoreSpin 18s linear infinite; }
.galaxy-core.lit .zt-inward-mote {
  animation:ztInwardGather var(--dur, 1.6s) cubic-bezier(.32, 0, .86, .72) var(--delay, 0s) infinite;
  filter:drop-shadow(0 0 2.5px rgba(255,225,135,.95));
}
.galaxy-core.lit .core-shock-ring {
  fill:none;
  stroke:rgba(255,236,175,.65);
  stroke-width:1.4;
  transform-origin:0 0;
  animation:ztCoreShock 2.1s ease-in-out infinite;
}
.galaxy-core.lit .core-starflare {
  transform-origin:0 0;
  animation:ztStarflarePulse 2.8s ease-in-out infinite;
}
.galaxy-core.lit .core-starflare-diag {
  transform-origin:0 0;
  animation:ztStarflarePulse 2.8s ease-in-out -1.4s infinite;
}
@keyframes ztCoreSpin { to { transform:rotate(360deg); } }
@keyframes ztCorePulse {
  0%, 100% { filter:drop-shadow(0 0 7px rgba(255,210,105,.6)) drop-shadow(0 0 16px rgba(165,115,255,.35)); }
  50% { filter:drop-shadow(0 0 14px rgba(255,230,145,.95)) drop-shadow(0 0 26px rgba(185,135,255,.6)); }
}
@keyframes ztInwardGather {
  0% {
    transform:translate(var(--r0, 52px), var(--swirl, 5px)) scale(.35);
    opacity:0;
  }
  18% {
    opacity:.95;
  }
  66% {
    transform:translate(calc(var(--r0, 52px) * .34), calc(var(--swirl, 5px) * .18)) scale(1.12);
    opacity:1;
  }
  92% {
    opacity:.9;
  }
  100% {
    transform:translate(0px, 0px) scale(.12);
    opacity:0;
  }
}
@keyframes ztCoreShock {
  0%, 100% { transform:scale(.82); opacity:.78; }
  50% { transform:scale(1.22); opacity:.22; }
}
@keyframes ztStarflarePulse {
  0%, 100% { transform:scale(.88) rotate(0deg); opacity:.75; }
  50% { transform:scale(1.14) rotate(12deg); opacity:1; }
}
@keyframes meridian-flow { to { background-position:-200% 0; } }
@keyframes orbit-drift { to { transform:translate(-50%,-50%) rotate(calc(var(--orbit-angle) + 360deg)); } }
@media (prefers-reduced-motion: reduce) {
  .meridian-flow,
  .body-galaxy-piece.orbiting,
  .body-galaxy-stars,
  .galaxy-core.lit,
  .galaxy-core.lit .galaxy-spiral-outer,
  .galaxy-core.lit .galaxy-spiral-inner,
  .galaxy-core.lit .zt-inward-particles,
  .galaxy-core.lit .zt-inward-mote,
  .galaxy-core.lit .core-shock-ring,
  .galaxy-core.lit .core-starflare,
  .galaxy-core.lit .core-starflare-diag {
    animation:none;
  }
}
</style>

