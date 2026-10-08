<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SkillUiNode, SkillUiEdge } from './skillUi'
import SkillPaperNode from './SkillPaperNode.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import {
  setSkillDesignMode,
  skillDesignMode,
  useMasterAccess,
} from '@/services/master/masterAccess'
const props = withDefaults(defineProps<{
  nodes: readonly SkillUiNode[]
  edges: readonly SkillUiEdge[]
  selected: string
  /** Natural square size (px) of the layout space x/y are expressed in. */
  size?: number
  /** Zoom-to-fit factor applied to the whole graph (cards included). */
  fit?: number
  /** Element accent (e.g. var(--el-fire)) tinting the selected-node comet.
   *  Empty keeps the default gold. */
  accent?: string
}>(), { size: 710, fit: 1, accent: '' })
const emit = defineEmits<{ select: [id: string]; activate: [id: string]; extent: [size: number] }>()
const { t } = useI18n()
const backdrop = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png')
// Minh ruling (2026-10-07): no pipe art on links - a plain line joins
// each pair of nodes; all link art stays under the discs.
// Design mode (Minh 2026-10): toggleable node-drag arrangement.
// Overrides live in localStorage, applied over the authored layout
// positions; the Export button dumps them as JSON for baking.
const DESIGN_KEY = 'skill-tree-design-pos-v1'
// SSR/test mounts have no window.localStorage - fall back to a no-op
// store so setup never crashes outside the browser.
const ls: Pick<Storage, 'getItem' | 'setItem'> =
  typeof localStorage === 'undefined'
    ? { getItem: () => null, setItem: () => {} }
    : localStorage
// 2026-10-07: the mode flag moved into masterAccess (shared with the dev
// panel toggle and the constellation panel); the whole design surface is
// master-account only now.
const { isMaster } = useMasterAccess()
const designMode = computed(() => isMaster.value && skillDesignMode.value)
function toggleDesign() {
  setSkillDesignMode(!skillDesignMode.value)
}
const designOffsets = ref<Record<string, { x: number; y: number }>>(
  JSON.parse(ls.getItem(DESIGN_KEY) ?? '{}'),
)
const exported = ref(false)
const posOf = (node: SkillUiNode) => designOffsets.value[node.id] ?? { x: node.x, y: node.y }
function saveDesign() {
  ls.setItem(DESIGN_KEY, JSON.stringify(designOffsets.value))
}
function exportDesign() {
  const round = Object.fromEntries(
    Object.entries(designOffsets.value).map(([id, p]) => [id, { x: Math.round(p.x), y: Math.round(p.y) }]),
  )
  const json = JSON.stringify({
    positions: round,
    spawns: designSpawns.value.map(s => ({ id: s.id, type: s.type, pos: round[s.id] ?? null })),
  })
  void navigator.clipboard?.writeText(json)
  console.log('[skill-tree-design]', json)
  exported.value = true
  setTimeout(() => { exported.value = false }, 1500)
}
function resetDesign() {
  designOffsets.value = {}
  saveDesign()
}

// Spawn palette (Minh 2026-10): generic node types can be stamped any
// number of times so the authored layout can hold e.g. three '+skill
// damage' seats. Stamps persist like position overrides; right-click a
// stamped node in design mode to remove it.
const DESIGN_SPAWNS_KEY = 'skill-tree-design-spawns-v1'
const DESIGN_NODE_TYPES = [
  { type: 'dmg', label: 'ST Kỹ Năng', frame: 'sub' },
  { type: 'acc', label: 'Chính Xác', frame: 'sub' },
  { type: 'pen', label: 'Xuyên Kháng', frame: 'sub' },
  { type: 'crit', label: 'Chí Mạng', frame: 'sub' },
  { type: 'critdmg', label: 'ST Chí Mạng', frame: 'sub' },
  { type: 'cd', label: 'Hồi Chiêu', frame: 'sub' },
  { type: 'ail_rate', label: 'Tỉ Lệ Tật', frame: 'sub' },
  { type: 'ail_power', label: 'Uy Lực Tật', frame: 'sub' },
  { type: 'ail_dur', label: 'TG Tật', frame: 'sub' },
  { type: 'cast', label: 'Tụ Khí', frame: 'sub' },
  { type: 'shield', label: 'Hộ Thể', frame: 'sub' },
  { type: 'keystone', label: 'Chốt Nhánh', frame: 'keystone' },
  { type: 'gate', label: 'Cổng CG', frame: 'parent' },
] as const
interface DesignSpawn { id: string; type: string }
const designSpawns = ref<DesignSpawn[]>(JSON.parse(ls.getItem(DESIGN_SPAWNS_KEY) ?? '[]'))
const spawnIcon = resolveAssetUrl('/assets/ui/huyen-kim/symbols/skill.svg')
function saveSpawns() {
  ls.setItem(DESIGN_SPAWNS_KEY, JSON.stringify(designSpawns.value))
}
function spawnNode(type: string) {
  if (!DESIGN_NODE_TYPES.some(d => d.type === type)) return
  let n = 1
  while (designSpawns.value.some(s => s.id === `design_${type}_${n}`)) n += 1
  const id = `design_${type}_${n}`
  designSpawns.value = [...designSpawns.value, { id, type }]
  designOffsets.value = {
    ...designOffsets.value,
    [id]: { x: props.size / 2 + (n % 5) * 34 - 68, y: props.size / 2 },
  }
  saveSpawns()
  saveDesign()
}
function onContextMenu(event: MouseEvent) {
  if (!designMode.value) return
  const host = (event.target as HTMLElement).closest('.skill-positioned-node') as HTMLElement | null
  const id = host?.dataset.nodeId
  if (id === undefined || !designSpawns.value.some(s => s.id === id)) return
  event.preventDefault()
  designSpawns.value = designSpawns.value.filter(s => s.id !== id)
  const rest = { ...designOffsets.value }
  delete rest[id]
  designOffsets.value = rest
  saveSpawns()
  saveDesign()
}
const spawnNodes = computed<SkillUiNode[]>(() => designSpawns.value.map((s) => {
  const def = DESIGN_NODE_TYPES.find(d => d.type === s.type)
  const p = designOffsets.value[s.id] ?? { x: props.size / 2, y: props.size / 2 }
  return {
    id: s.id,
    name: def?.label ?? s.type,
    icon: spawnIcon,
    x: p.x,
    y: p.y,
    level: '0 / 1',
    levelMax: 1,
    state: 'locked',
    description: '',
    experience: '',
    stats: [],
    conditions: [],
    costLabel: '',
    actionLabel: '',
    actionDisabled: true,
    actionHint: '',
    frameKind: def?.frame ?? 'sub',
  }
}))

const connections = computed(() => props.edges.flatMap(edge => {
  const from = props.nodes.find(node => node.id === edge.from)
  const to = props.nodes.find(node => node.id === edge.to)
  if (!from || !to) return []
  const fromPos = posOf(from)
  const toPos = posOf(to)
  return [{
    ...edge,
    fromNode: { ...from, x: fromPos.x, y: fromPos.y },
    toNode: { ...to, x: toPos.x, y: toPos.y },
    muted: to.state === 'locked',
    // A learned child lets the light run the wire: the comet rides the
    // link from parent to child (Minh 2026-10-07).
    lit: to.state === 'learned',
  }]
}))

// Paint lowest nodes first: a node's name/level label hangs below its disc
// into the next ring, so any disc that can cover it sits at a larger y.
// Descending-y order keeps every label above every disc that could occlude it.
const paintNodes = computed(() =>
  [...props.nodes.map(node => ({ ...node, ...posOf(node) })), ...spawnNodes.value]
    .sort((a, b) => b.y - a.y),
)

// Rendered extent: the surface's fit must cover where nodes actually
// sit (design-mode offsets can place them beyond the authored layout),
// else they spill past the paper backdrop. Reported up as a square size.
const renderExtent = computed(() => {
  let max = 0
  for (const n of paintNodes.value) max = Math.max(max, n.x, n.y)
  return max + 90
})
// Minh ruling (drag area A): while a node drag is in flight the reported
// extent freezes at its pre-drag value, so the surface fit stays constant
// and the dragged node tracks the cursor instead of sliding away as the
// extent re-emits. The live extent re-reports on release (one refit).
const extentFreeze = ref<number | null>(null)
const reportedExtent = computed(() => extentFreeze.value ?? renderExtent.value)
watch(reportedExtent, (v) => emit('extent', v), { immediate: true })

const viewBox = computed(() => `0 0 ${props.size} ${props.size}`)

// Drag-pan viewport: the paper region clips overflow, pointer drag shifts
// the whole graph (nodes + edges together). A sub-threshold press stays a
// click so node select keeps working; double-click re-centers.
const pan = ref({ x: 0, y: 0 })
const zoom = ref(1)
const dragging = ref(false)
// Opening view (Minh 2026-10-07): a fixed vantage with the main node at
// the paper's center - the tree always opens the same way, and the root
// comes pre-selected so the detail panel reads it. Once the user pans or
// zooms, the view is theirs (viewTouched stops any auto recentering).
const mainNode = computed(() => {
  const targets = new Set(props.edges.map(e => e.to))
  return props.nodes.find(n => !targets.has(n.id)) ?? props.nodes[0] ?? null
})
const viewTouched = ref(false)
// The opening vantage also pins its scale: the surface's extent-driven
// fit may keep shrinking after mount, which would slide the tree even
// while the root stays centered. zoom = frozenScale/fit cancels refits.
// Default ratio picked by Minh on screen (2026-10-07): 0.91 effective.
const OPEN_VIEW_SCALE = 0.91
const frozenScale = ref<number | null>(null)
const rootEl = useTemplateRef<HTMLElement>('rootEl')
let dragMoved = false
let dragStart: { px: number; py: number; x: number; y: number } | null = null
let nodeDrag: { id: string; px: number; py: number; x: number; y: number; scale: number } | null = null
// One gesture at a time: a second pointer (multi-touch) is ignored while
// the primary is tracked, so it cannot clear the drag/freeze mid-gesture.
let activePointer: number | null = null

// Screen px -> local px: the tree renders inside SceneDesignCanvas
// (scale = min(vw/1440, vh/810)) plus any document zoom, so clientX/Y
// deltas are visual px, bigger than layout px by this factor.
function viewScale(): number {
  const el = rootEl.value
  if (el === null || el.offsetWidth === 0) return 1
  return el.getBoundingClientRect().width / el.offsetWidth
}

// Pan clamp: keep at least PAN_MARGIN px of the scaled graph inside the
// viewport on each axis - a background drag can never push the tree fully
// off-screen.
const PAN_MARGIN = 48
function clampPan(p: { x: number; y: number }, vw: number, vh: number) {
  const half = (props.size * props.fit * zoom.value) / 2
  const bx = Math.max(0, vw / 2 + half - PAN_MARGIN)
  const by = Math.max(0, vh / 2 + half - PAN_MARGIN)
  return { x: Math.min(bx, Math.max(-bx, p.x)), y: Math.min(by, Math.max(-by, p.y)) }
}
// A scale change outside a gesture (extent refit, element switch onto a
// smaller tree) can shrink the bound under a stored pan - re-clamp it.
// While the user has not taken the view yet, a refit re-centers the root
// instead so the fixed opening vantage survives an extent re-report.
watch([() => props.size, () => props.fit], () => {
  if (rootEl.value === null) return
  if (!viewTouched.value) {
    resetViewToRoot()
    return
  }
  pan.value = clampPan(pan.value, rootEl.value.offsetWidth, rootEl.value.offsetHeight)
})

// Fixed opening vantage: zoom 1 and the main node centered. With
// transform-origin:center a graph point p lands at scale * (p - size/2)
// + pan under translate(-50%,-50%) translate(pan) scale(s) - so pan must
// equal scale * (size/2 - node), not size/2 - scale * node.
function resetViewToRoot() {
  const s = frozenScale.value ?? props.fit
  // Counteract later extent refits: effective scale stays the frozen one.
  zoom.value = props.fit === 0 ? 1 : s / props.fit
  const m = mainNode.value
  if (m === null) {
    pan.value = { x: 0, y: 0 }
    return
  }
  const p = posOf(m)
  pan.value = {
    x: s * (props.size / 2 - p.x),
    y: s * (props.size / 2 - p.y),
  }
}
// Focus-induced scroll: browsers scroll an overflow:hidden box to reveal
// a focused node (the mount select does this), quietly shifting the whole
// tree ~scrollTop px off the computed vantage. The paper never scrolls by
// design - pan is the only offset - so any scroll snaps back to 0.
function onScrollReset(event: Event) {
  const el = event.currentTarget as HTMLElement
  el.scrollTop = 0
  el.scrollLeft = 0
}
// Mount opens the panel: fixed view + the main node pre-selected so the
// detail panel reads it before the user touches anything.
onMounted(() => {
  frozenScale.value = OPEN_VIEW_SCALE
  resetViewToRoot()
  const m = mainNode.value
  if (m !== null) emit('select', m.id)
})

// Press target node: pointer capture retargets the click to the root,
// so the node button's own click never fires. Minh ruling (2026-10-07):
// select fires on PRESS, not release - the detail panel must show the
// node the moment the pointer lands, while the hold-to-learn gesture
// still resolves on its own timer.
function onPointerDown(event: PointerEvent) {
  if (activePointer !== null) return
  activePointer = event.pointerId
  dragging.value = true
  dragMoved = false
  dragStart = { px: event.clientX, py: event.clientY, x: pan.value.x, y: pan.value.y }
  nodeDrag = null
  const pressHost = (event.target as HTMLElement).closest('.skill-positioned-node') as HTMLElement | null
  const pressNodeId = pressHost?.dataset.nodeId ?? null
  if (pressNodeId !== null) emit('select', pressNodeId)
  // Clear any leaked freeze first: a press whose release never reaches
  // this root (e.g. over the .stop'd design-tools) leaves one behind,
  // and a stale freeze silences every later extent emit.
  extentFreeze.value = null
  // Capture at press, not at the 4px move threshold: while captured the
  // pointerup is always delivered here, so a short press released over
  // the .stop'd tools row (or off the element) cannot leak drag state.
  // jsdom/test mounts lack the pointer-capture API - skip silently there.
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  if (designMode.value) {
    const host = (event.target as HTMLElement).closest('.skill-positioned-node') as HTMLElement | null
    const node = host && paintNodes.value.find(n => host.dataset.nodeId === n.id)
    if (node) {
      const p = posOf(node)
      nodeDrag = {
        id: node.id,
        px: event.clientX,
        py: event.clientY,
        x: p.x,
        y: p.y,
        // Drag-start scale (fit x zoom x ancestor scale): the
        // cursor->graph mapping stays fixed even if a wheel zoom
        // lands mid-gesture.
        scale: props.fit * zoom.value * viewScale(),
      }
      extentFreeze.value = renderExtent.value
    }
  }
}
function onPointerMove(event: PointerEvent) {
  if (event.pointerId !== activePointer || !dragging.value || dragStart === null) return
  const dx = event.clientX - dragStart.px
  const dy = event.clientY - dragStart.py
  if (!dragMoved && Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true
  if (!dragMoved) return
  if (nodeDrag) {
    // Screen px -> graph px, at the drag-start scale. Drops are clamped
    // to the envelope the extent formula can actually cover: a negative
    // coordinate escapes the size square entirely (invisible, ungrabbable),
    // a runaway coordinate shrinks the fit to unreadable.
    const nx = (event.clientX - nodeDrag.px) / nodeDrag.scale
    const ny = (event.clientY - nodeDrag.py) / nodeDrag.scale
    const bound = props.size + 300
    designOffsets.value = {
      ...designOffsets.value,
      [nodeDrag.id]: {
        x: Math.min(bound, Math.max(0, nodeDrag.x + nx)),
        y: Math.min(bound, Math.max(0, nodeDrag.y + ny)),
      },
    }
    saveDesign()
    return
  }
  const host = event.currentTarget as HTMLElement
  const vs = viewScale()
  viewTouched.value = true
  pan.value = clampPan(
    { x: dragStart.x + dx / vs, y: dragStart.y + dy / vs },
    host.offsetWidth,
    host.offsetHeight,
  )
}
function onPointerUp(event: PointerEvent) {
  if (event.pointerId !== activePointer) return
  activePointer = null
  dragging.value = false
  dragStart = null
  nodeDrag = null
  extentFreeze.value = null

  const host = event.currentTarget as HTMLElement
  if (host.hasPointerCapture?.(event.pointerId)) host.releasePointerCapture?.(event.pointerId)
}
// Wheel zoom, anchored on the cursor: the graph point under the pointer
// stays fixed while scale multiplies the authored fit.
function onWheel(event: WheelEvent) {
  // Wheel mid-gesture would rescale the graph under the tracked
  // pointer - ignore it until the gesture ends.
  if (dragging.value) return
  const vs = viewScale()
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const cx = (event.clientX - (rect.left + rect.width / 2)) / vs
  const cy = (event.clientY - (rect.top + rect.height / 2)) / vs
  const next = Math.min(4, Math.max(0.3, zoom.value * Math.exp(-event.deltaY * 0.0012)))
  if (next === zoom.value) return
  const ratio = (props.fit * next) / (props.fit * zoom.value)
  // Commit the zoom before clamping: the bound reads the NEW scale.
  viewTouched.value = true
  zoom.value = next
  const host = event.currentTarget as HTMLElement
  pan.value = clampPan(
    { x: cx - (cx - pan.value.x) * ratio, y: cy - (cy - pan.value.y) * ratio },
    host.offsetWidth,
    host.offsetHeight,
  )
}
function onSelect(id: string) {
  if (!dragMoved) emit('select', id)
}
function onActivate(id: string) {
  emit('activate', id)
}
function onResetView() {
  // Double-click returns to the same fixed vantage the panel opens on.
  viewTouched.value = false
  resetViewToRoot()
}

const graphStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  transform: `translate(-50%, -50%) translate(${pan.value.x}px, ${pan.value.y}px) scale(${props.fit * zoom.value})`,
}))

// Streak tint vars cascade to every node disc: --streak carries the path
// accent, --streak-head is the same accent lightened for the comet head.
const rootStyle = computed(() =>
  props.accent !== ''
    ? {
        '--streak': props.accent,
        '--streak-head': `color-mix(in srgb, ${props.accent} 55%, #ffffff)`,
      }
    : {},
)
</script>
<template>
  <div
    ref="rootEl"
    class="skill-paper-tree"
    :class="{ dragging, design: designMode }"
    :style="rootStyle"
    :aria-label="t('skill.tree')"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel.prevent="onWheel"
    @dblclick="onResetView"
    @contextmenu="onContextMenu"
    @scroll="onScrollReset"
  >
    <div class="skill-paper-backdrop" :style="{ borderImageSource: `url('${backdrop}')` }" aria-hidden="true" />
    <div class="skill-graph" :style="graphStyle">
      <svg class="skill-tree-lines" :viewBox="viewBox" aria-hidden="true">
        <g v-for="edge in connections" :key="`${edge.from}-${edge.to}`" :class="['skill-edge', { muted: edge.muted, lit: edge.lit }]">
          <line
            class="edge-line"
            :x1="edge.fromNode.x" :y1="edge.fromNode.y"
            :x2="edge.toNode.x" :y2="edge.toNode.y"
            vector-effect="non-scaling-stroke"
          />
          <line
            v-if="edge.lit"
            class="edge-flow"
            :x1="edge.fromNode.x" :y1="edge.fromNode.y"
            :x2="edge.toNode.x" :y2="edge.toNode.y"
            pathLength="100"
            vector-effect="non-scaling-stroke"
          />
        </g>
      </svg>
      <SkillPaperNode v-for="node in paintNodes" :key="node.id" class="skill-positioned-node" :data-node-id="node.id" :node="node" :selected="selected === node.id" :style="{ left: `${node.x}px`, top: `${node.y}px` }" @select="onSelect" @activate="onActivate" />
    </div>
    <div class="design-tools" aria-hidden="false" @pointerdown.stop @pointermove.stop @pointerup.stop @wheel.stop @click.stop>
      <button v-if="isMaster" type="button" class="design-toggle" :class="{ active: designMode }" @click="toggleDesign">Thiết Kế</button>
      <template v-if="designMode">
        <select class="design-spawn" @change="spawnNode(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
          <option value="">+ Node…</option>
          <option v-for="nt in DESIGN_NODE_TYPES" :key="nt.type" :value="nt.type">{{ nt.label }}</option>
        </select>
        <button type="button" @click="exportDesign">{{ exported ? 'Đã Chép' : 'Xuất Bố Cục' }}</button>
        <button type="button" @click="resetDesign">Về Mặc Định</button>
      </template>
    </div>
  </div>
</template>
<style scoped>
/* Node discs always paint above every link/light line (edge svg is
   z-index 1; positioned nodes z-index 2) so art never sits under light. */
.skill-positioned-node { position:absolute; transform:translate(-50%,-50%); z-index:2; }
.skill-paper-tree { position:absolute; left:365px; top:198px; width:600px; height:487px; overflow:hidden; cursor:grab; touch-action:none; user-select:none; }
.skill-paper-backdrop { position:absolute; inset:0; pointer-events:none; border:15px solid transparent; border-image-slice:90 fill; border-image-width:15px; border-image-repeat:stretch; }
.skill-paper-tree.dragging { cursor:grabbing; }
.skill-paper-tree :deep(img) { -webkit-user-drag:none; }
.skill-graph { position:absolute; left:50%; top:50%; transform-origin:center; }
.skill-tree-lines { position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; z-index:1; }
/* Plain link lines keep a constant on-screen thickness regardless of
   graph scale (non-scaling-stroke). */
.skill-edge .edge-line { stroke:#c9a640; stroke-width:1.8px; opacity:.85; }
.skill-edge.muted .edge-line { stroke:#7a6844; opacity:.5; }
/* Activation flow: once a node is learned a warm light pulses along its
   link from the parent - a short bright dash riding the normalized
   pathLength, tapering via linecap so the pulse reads as a streak. */
/* A lit link glows end to end (Minh: the wire must light up, not just
   carry the pulse) - brighter gold stroke plus a warm drop-shadow,
   the traveling comet rides on top. */
.skill-edge.lit .edge-line { stroke:#ffd88a; stroke-width:2.6px; opacity:1; filter:drop-shadow(0 0 4px #ffbf5e) drop-shadow(0 0 8px #d4983d90); }
.skill-edge .edge-flow { stroke:#fff3cf; stroke-width:3.4px; stroke-linecap:round; stroke-dasharray:10 100; animation:edge-flow-run 2.2s linear infinite; filter:drop-shadow(0 0 4px #ffbf5e) drop-shadow(0 0 8px #d4983d); }
@keyframes edge-flow-run { from { stroke-dashoffset:0 } to { stroke-dashoffset:-110 } }
.design-tools { position:absolute; left:14px; bottom:12px; display:flex; gap:6px; z-index:3; }
.design-tools button { padding:4px 10px; border:1px solid #6b5a38; border-radius:4px; background:#1c1a14e0; color:#d9c9a0; font:12px var(--font-display,Georgia,serif); cursor:pointer; }
.design-tools button:hover { border-color:#d4983d; color:#ffd17a; }
.design-tools .design-toggle.active { border-color:#e53935; color:#ff8a5c; box-shadow:0 0 6px #e5393566; }
.design-tools .design-spawn { padding:4px 8px; border:1px solid #6b5a38; border-radius:4px; background:#1c1a14e0; color:#d9c9a0; font:12px var(--font-display,Georgia,serif); cursor:pointer; }
/* Design-mode drag affordance: a slow-spinning dashed ring around every
   node plus a move cursor signals the whole node is grabbable. */
.skill-paper-tree.design .skill-positioned-node { cursor:move; }
.skill-paper-tree.design .skill-positioned-node::after {
  content:''; position:absolute; inset:-11px; border:1.5px dashed #d4983daa;
  border-radius:50%; pointer-events:none; z-index:5;
  animation: designRing 16s linear infinite;
}
@keyframes designRing { to { transform:rotate(360deg) } }
</style>
