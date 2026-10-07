<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SkillUiNode, SkillUiEdge } from './skillUi'
import { EDGE_PIPE_CELL, EDGE_PIPE_GAP, EDGE_PIPE_H, EDGE_PIPE_INSET_TO } from './skillUi'
import SkillPaperNode from './SkillPaperNode.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
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
const pipe = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/skill-connection-pipe-v2.png')
const backdrop = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png')
// G3 edge skin (HomeSkillArtPanel): no running light on links.
// A link tiles whole pipe arts - one per level of the TARGET node,
// each rendered at the art's own aspect (EDGE_PIPE_CELL is derived from
// it, never stretched), fixed gap between pipes, the chain centered on
// the link (SkillSurface spaces nodes to fit exactly this chain). A
// gained level fills its pipe red; all link art stays under the discs.
const EDGE_FLOW_W = 34
// Design mode (Minh 2026-10): toggleable node-drag arrangement.
// Overrides live in localStorage, applied over the authored layout
// positions; the Export button dumps them as JSON for baking.
const DESIGN_KEY = 'skill-tree-design-pos-v1'
const DESIGN_MODE_KEY = 'skill-tree-design-mode-v1'
// SSR/test mounts have no window.localStorage - fall back to a no-op
// store so setup never crashes outside the browser.
const ls: Pick<Storage, 'getItem' | 'setItem'> =
  typeof localStorage === 'undefined'
    ? { getItem: () => null, setItem: () => {} }
    : localStorage
const designMode = ref(ls.getItem(DESIGN_MODE_KEY) === '1')
function toggleDesign() {
  designMode.value = !designMode.value
  ls.setItem(DESIGN_MODE_KEY, designMode.value ? '1' : '0')
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
  const length = Math.hypot(toPos.x - fromPos.x, toPos.y - fromPos.y)
  const max = to.levelMax ?? 0
  const level = Math.min(to.levelCurrent ?? 0, max)
  const count = Math.max(1, max)
  const span = count * EDGE_PIPE_CELL + (count - 1) * EDGE_PIPE_GAP
  // Chain anchors to the TARGET side: last pipe head stops INSET_TO
  // from the target center; the parent side takes the leftover room.
  const start = length - EDGE_PIPE_INSET_TO - span
  const segments = Array.from({ length: count }, (_, i) => ({
    filled: i < level,
    x: start + i * (EDGE_PIPE_CELL + EDGE_PIPE_GAP),
    w: EDGE_PIPE_CELL,
  }))
  // Light flow: a bright blob runs along the filled pipes then back,
  // looping (Minh ruling; span = every filled pipe end to end).
  const filledSpan = level * EDGE_PIPE_CELL + Math.max(0, level - 1) * EDGE_PIPE_GAP
  const flow = level > 0 ? {
    x0: start,
    x1: start + filledSpan - EDGE_FLOW_W,
    dur: `${(1.1 + filledSpan / 160).toFixed(2)}s`,
  } : null
  return [{
    ...edge,
    fromNode: { ...from, x: fromPos.x, y: fromPos.y },
    toNode: { ...to, x: toPos.x, y: toPos.y },
    length,
    angle: Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x) * 180 / Math.PI,
    segments,
    flow,
    muted: to.state === 'locked',
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
let dragMoved = false
let dragStart: { px: number; py: number; x: number; y: number } | null = null
let nodeDrag: { id: string; px: number; py: number; x: number; y: number } | null = null

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

function onPointerDown(event: PointerEvent) {
  dragging.value = true
  dragMoved = false
  dragStart = { px: event.clientX, py: event.clientY, x: pan.value.x, y: pan.value.y }
  nodeDrag = null
  if (designMode.value) {
    const host = (event.target as HTMLElement).closest('.skill-positioned-node') as HTMLElement | null
    const node = host && paintNodes.value.find(n => host.dataset.nodeId === n.id)
    if (node) {
      const p = posOf(node)
      nodeDrag = { id: node.id, px: event.clientX, py: event.clientY, x: p.x, y: p.y }
      extentFreeze.value = renderExtent.value
    }
  }
}
function onPointerMove(event: PointerEvent) {
  if (!dragging.value || dragStart === null) return
  const dx = event.clientX - dragStart.px
  const dy = event.clientY - dragStart.py
  if (!dragMoved && Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true
  if (!dragMoved) return
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  if (nodeDrag) {
    // Screen px -> graph px: the graph scales by fit*zoom.
    const scale = props.fit * zoom.value
    designOffsets.value = {
      ...designOffsets.value,
      [nodeDrag.id]: {
        x: nodeDrag.x + (event.clientX - nodeDrag.px) / scale,
        y: nodeDrag.y + (event.clientY - nodeDrag.py) / scale,
      },
    }
    saveDesign()
    return
  }
  const host = event.currentTarget as HTMLElement
  pan.value = clampPan(
    { x: dragStart.x + dx, y: dragStart.y + dy },
    host.offsetWidth,
    host.offsetHeight,
  )
}
function onPointerUp(event: PointerEvent) {
  dragging.value = false
  dragStart = null
  nodeDrag = null
  extentFreeze.value = null
  const host = event.currentTarget as HTMLElement
  if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId)
}
// Wheel zoom, anchored on the cursor: the graph point under the pointer
// stays fixed while scale multiplies the authored fit.
function onWheel(event: WheelEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const cx = event.clientX - (rect.left + rect.width / 2)
  const cy = event.clientY - (rect.top + rect.height / 2)
  const next = Math.min(4, Math.max(0.3, zoom.value * Math.exp(-event.deltaY * 0.0012)))
  if (next === zoom.value) return
  const ratio = (props.fit * next) / (props.fit * zoom.value)
  const host = event.currentTarget as HTMLElement
  pan.value = clampPan(
    { x: cx - (cx - pan.value.x) * ratio, y: cy - (cy - pan.value.y) * ratio },
    host.offsetWidth,
    host.offsetHeight,
  )
  zoom.value = next
}
function onSelect(id: string) {
  if (!dragMoved) emit('select', id)
}
function onActivate(id: string) {
  emit('activate', id)
}
function onResetView() {
  pan.value = { x: 0, y: 0 }
  zoom.value = 1
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
  >
    <div class="skill-paper-backdrop" :style="{ borderImageSource: `url('${backdrop}')` }" aria-hidden="true" />
    <div class="skill-graph" :style="graphStyle">
      <svg class="skill-tree-lines" :viewBox="viewBox" aria-hidden="true">
        <g v-for="edge in connections" :key="`${edge.from}-${edge.to}`" :class="['skill-edge', { muted: edge.muted }]">
          <g :transform="`rotate(${edge.angle} ${edge.fromNode.x} ${edge.fromNode.y})`">
            <image
              v-for="(seg, i) in edge.segments" :key="i"
              :href="pipe" :x="edge.fromNode.x + seg.x" :y="edge.fromNode.y - EDGE_PIPE_H / 2"
              :width="seg.w" :height="EDGE_PIPE_H" preserveAspectRatio="none"
            />
            <line
              v-for="(seg, i) in edge.segments" :key="`fill-${i}`"
              v-show="seg.filled"
              class="edge-segment-filled"
              :x1="edge.fromNode.x + seg.x + seg.w * 0.06" :x2="edge.fromNode.x + seg.x + seg.w * 0.94"
              :y1="edge.fromNode.y + EDGE_PIPE_H * 0.068" :y2="edge.fromNode.y + EDGE_PIPE_H * 0.068"
              vector-effect="non-scaling-stroke"
            />
            <line
              v-if="edge.flow"
              class="edge-flow"
              :y1="edge.fromNode.y + EDGE_PIPE_H * 0.068" :y2="edge.fromNode.y + EDGE_PIPE_H * 0.068"
              :x1="edge.fromNode.x + edge.flow.x0" :x2="edge.fromNode.x + edge.flow.x0 + EDGE_FLOW_W"
              vector-effect="non-scaling-stroke"
            >
              <animate attributeName="x1" :values="`${edge.fromNode.x + edge.flow.x0};${edge.fromNode.x + edge.flow.x1};${edge.fromNode.x + edge.flow.x0}`" :dur="edge.flow.dur" repeatCount="indefinite" />
              <animate attributeName="x2" :values="`${edge.fromNode.x + edge.flow.x0 + EDGE_FLOW_W};${edge.fromNode.x + edge.flow.x1 + EDGE_FLOW_W};${edge.fromNode.x + edge.flow.x0 + EDGE_FLOW_W}`" :dur="edge.flow.dur" repeatCount="indefinite" />
            </line>
          </g>
        </g>
      </svg>
      <SkillPaperNode v-for="node in paintNodes" :key="node.id" class="skill-positioned-node" :data-node-id="node.id" :node="node" :selected="selected === node.id" :style="{ left: `${node.x}px`, top: `${node.y}px` }" @select="onSelect" @activate="onActivate" />
    </div>
    <div class="design-tools" aria-hidden="false" @pointerdown.stop @pointermove.stop @pointerup.stop @wheel.stop @click.stop>
      <button type="button" class="design-toggle" :class="{ active: designMode }" @click="toggleDesign">Thiết Kế</button>
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
/* Level streaks keep a constant on-screen thickness regardless of
   graph scale (non-scaling-stroke) so the light line stays visible. */
.edge-segment-filled { stroke:var(--streak,#e53935); stroke-width:3.4px; stroke-linecap:round; opacity:.85; filter:drop-shadow(0 0 2px var(--streak,#e53935)) drop-shadow(0 0 5px var(--streak,#e53935)); }
.edge-flow { stroke:var(--streak-head,#ff8a5c); stroke-width:4.2px; stroke-linecap:round; opacity:.95; filter:drop-shadow(0 0 3px var(--streak-head,#ff8a5c)) drop-shadow(0 0 8px var(--streak,#e53935)); }
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
