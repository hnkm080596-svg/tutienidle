<script setup lang="ts">
// Pháp Tu Redesign (magicpath) — Node Tree UI: liệt kê MỌI
// ProgressionNode đã đăng ký (gameManager.nodeRegistry), nhóm theo
// branchTag (thuần hiển thị, xem ProgressionNode.ts).
//
// SkillPathPanel.vue redesign (2026-08-20, PhapTuPanel plan mục 6/10)
// — trước đây click node MUA THẲNG, hiện MỌI branch cùng lúc. Giờ:
// (1) prop `branchTag` optional lọc còn ĐÚNG 1 branch (SkillPathPanel
// truyền vào theo Hành đang chọn ở ElementPathList.vue — không truyền
// gì = hiện tất cả, giữ nguyên hành vi cũ cho caller khác nếu có);
// (2) click CHỈ emit 'select' (kể cả node đã mua/còn khoá — plan mục
// 29 "Node locked → hiện điều kiện" nghĩa là vẫn xem được), mua thật
// dời xuống nút "Lĩnh Ngộ" ở NodeInspector.vue (bottom panel) — tách
// XEM khỏi MUA đúng UX plan mục 10.
//
// Phân tầng THẬT + SVG connections (2026-08-21, Plans/SkillNode) —
// trước đây chỉ 2 tầng cứng (roots/children, xem git history) không
// đủ cho cây sâu hơn 2 cấp (root -> Luyện Khí/Trúc Cơ Major -> Trúc Cơ
// Minor, xem data/progression/PhapTuNodes.ts). Giờ tính depth THẬT
// bằng cách đi ngược prerequisite kind:'node' trong CÙNG branch tới
// gốc (0 prereq node = depth 0), nhóm theo depth thành N tầng thay vì
// 2 bucket cứng — mỗi node vẫn CHỈ CÓ ĐÚNG 1 parent trong toàn bộ data
// hiện có (không có node nào yêu cầu 2 node khác cùng lúc), nên model
// single-parent này khớp 100% dữ liệu thật.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type ComponentPublicInstance } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { canPurchaseNode } from '@/core/progression/NodeSystem'
import { ELEMENT_LABELS, ELEMENT_COLOR_VARS } from '@/core/element/ElementLabels'
import SkillConnections from './SkillConnections.vue'
import type { SkillConnectionEntry, SkillConnectionRect } from './SkillConnections.vue'
import type { ElementType } from '@/core/element/ElementType'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'

const props = defineProps<{
  branchTag?: string
  selectedNodeId?: string | null
  // Skill Node unlock animation — node vừa purchaseNode() THÀNH CÔNG
  // (xem NodeInspector.vue/SkillPathPanel.vue). `seq` tăng dần để
  // watch() luôn bắt được lần mua MỚI, kể cả trường hợp lý thuyết mua
  // liên tiếp cùng nodeId.
  unlockTrigger?: { nodeId: string; seq: number } | null
}>()

const emit = defineEmits<{
  select: [node: ProgressionNode, purchased: boolean, purchasable: boolean]
}>()

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

function branchLabel(branchTag: string | undefined): string {
  if (!branchTag) {
    return 'Khác'
  }

  return ELEMENT_LABELS[branchTag as ElementType] ?? branchTag
}

function branchColor(branchTag: string | undefined): string {
  return ELEMENT_COLOR_VARS[branchTag as ElementType] ?? 'var(--text-primary)'
}

interface TreeEntry {
  node: ProgressionNode
  purchased: boolean
  purchasable: boolean
  parentId: string | null
  depth: number
}

const branches = computed(() => {
  stateVersion.value

  const allNodes = gameManager.nodeRegistry.getAll()

  const nodes = props.branchTag ? allNodes.filter(node => node.branchTag === props.branchTag) : allNodes

  const groups = new Map<string, typeof nodes>()

  for (const node of nodes) {
    const key = node.branchTag ?? '__other__'
    const list = groups.get(key) ?? []

    list.push(node)
    groups.set(key, list)
  }

  return Array.from(groups.entries()).map(([branchTag, branchNodes]) => {
    const branchNodeIds = new Set(branchNodes.map(node => node.id))

    const parentOf = (node: ProgressionNode): string | null => {
      for (const prereq of node.prerequisites ?? []) {
        if (prereq.kind === 'node' && branchNodeIds.has(prereq.nodeId)) {
          return prereq.nodeId
        }
      }

      return null
    }

    const entryById = new Map<string, TreeEntry>()

    for (const node of branchNodes) {
      entryById.set(node.id, {
        node,
        purchased: player.purchasedNodeIds.includes(node.id),
        purchasable: canPurchaseNode(player.$state, node),
        parentId: parentOf(node),
        depth: 0,
      })
    }

    // Không kỳ vọng chu trình (data hand-authored, luôn là cây thật),
    // nhưng vẫn chặn bằng `guard` cho chắc — 1 node lặp lại trong
    // guard thì coi như depth 0 tại đó thay vì đệ quy vô hạn.
    const depthOf = (id: string, guard: Set<string>): number => {
      const entry = entryById.get(id)

      if (!entry || !entry.parentId || guard.has(id)) {
        return 0
      }

      return 1 + depthOf(entry.parentId, new Set(guard).add(id))
    }

    for (const entry of entryById.values()) {
      entry.depth = depthOf(entry.node.id, new Set())
    }

    const tierMap = new Map<number, TreeEntry[]>()

    for (const entry of entryById.values()) {
      const list = tierMap.get(entry.depth) ?? []

      list.push(entry)
      tierMap.set(entry.depth, list)
    }

    const tiers = Array.from(tierMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([depth, entries]) => ({ depth, entries }))

    return {
      branchTag: branchTag === '__other__' ? undefined : branchTag,

      label: branchLabel(branchTag === '__other__' ? undefined : branchTag),

      color: branchColor(branchTag === '__other__' ? undefined : branchTag),

      tiers,

      entries: Array.from(entryById.values()),
    }
  })
})

function onClick(node: ProgressionNode, purchased: boolean, purchasable: boolean) {
  emit('select', node, purchased, purchasable)
}

// ---- Skill Node unlock animation (2026-08-21, Plans/SkillNode) ----
// State máy: locked/available (suy thẳng từ purchased/purchasable có
// sẵn, KHÔNG cần state riêng) -> unlocking (connection sáng chạy ->
// node pulse/glow, tuần tự BẮT BUỘC theo mục 2 của plan) -> unlocked
// (chính là `purchased` reactive, đã đúng NGAY khi purchaseNode()
// return true — animation chỉ là lớp trang trí chạy THÊM, không giữ
// hay trì hoãn trạng thái thật).
const CONNECTION_ANIM_MS = 750
const NODE_ANIM_MS = 500

const unlockingConnectionChildId = ref<string | null>(null)
const unlockingNodeId = ref<string | null>(null)

let connectionTimer: ReturnType<typeof setTimeout> | undefined
let nodeTimer: ReturnType<typeof setTimeout> | undefined

watch(() => props.unlockTrigger, trigger => {
  if (!trigger) {
    return
  }

  clearTimeout(connectionTimer)
  clearTimeout(nodeTimer)

  unlockingNodeId.value = null
  unlockingConnectionChildId.value = trigger.nodeId

  connectionTimer = setTimeout(() => {
    unlockingConnectionChildId.value = null
    unlockingNodeId.value = trigger.nodeId

    nodeTimer = setTimeout(() => {
      unlockingNodeId.value = null
    }, NODE_ANIM_MS)
  }, CONNECTION_ANIM_MS)
})

onBeforeUnmount(() => {
  clearTimeout(connectionTimer)
  clearTimeout(nodeTimer)
})

// ---- Đo vị trí node THẬT cho SkillConnections.vue (SVG layer) ----
// Mỗi branch có 1 container riêng (position:relative) + 1 SVG overlay
// — đo getBoundingClientRect() của từng node button TƯƠNG ĐỐI với
// container đó, đủ cho cả 2 trường hợp: props.branchTag set (1
// container) hoặc không set (nhiều container, mỗi branch 1 cái).
const containerRefs = new Map<string, HTMLElement>()
const nodeRefs = new Map<string, HTMLElement>()

// Template ref callback (Vue 3) truyền Element | ComponentPublicInstance
// | null — 2 hàm này CHỈ gắn cho <div>/<button> thuần (không phải
// component), luôn là Element thật, nên narrow bằng instanceof.
function setContainerRef(branchKey: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) {
    containerRefs.set(branchKey, el)
  } else {
    containerRefs.delete(branchKey)
  }
}

function setNodeRef(nodeId: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) {
    nodeRefs.set(nodeId, el)
  } else {
    nodeRefs.delete(nodeId)
  }
}

const rectsByBranch = reactive<Record<string, Record<string, SkillConnectionRect>>>({})

function measure() {
  for (const branch of branches.value) {
    const key = branch.branchTag ?? '__other__'
    const container = containerRefs.get(key)

    if (!container) {
      continue
    }

    const containerRect = container.getBoundingClientRect()
    const rects: Record<string, SkillConnectionRect> = {}

    for (const entry of branch.entries) {
      const el = nodeRefs.get(entry.node.id)

      if (!el) {
        continue
      }

      const rect = el.getBoundingClientRect()

      rects[entry.node.id] = {
        x: rect.left - containerRect.left + rect.width / 2,
        topY: rect.top - containerRect.top,
        bottomY: rect.top - containerRect.top + rect.height,
      }
    }

    rectsByBranch[key] = rects
  }
}

function connectionsFor(branch: (typeof branches.value)[number]): SkillConnectionEntry[] {
  return branch.entries
    .filter(entry => entry.parentId)
    .map(entry => ({
      parentId: entry.parentId!,
      childId: entry.node.id,
      state: (unlockingConnectionChildId.value === entry.node.id
        ? 'unlocking'
        : entry.purchased
          ? 'active'
          : 'locked') as SkillConnectionEntry['state'],
    }))
}

let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  nextTick(measure)

  resizeObserver = new ResizeObserver(() => measure())

  for (const el of containerRefs.values()) {
    resizeObserver.observe(el)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(branches, () => {
  nextTick(() => {
    measure()

    // Container mới dựng (đổi branch) chưa được observe — resizeObserver
    // đã tồn tại từ onMounted() thì gắn thêm cho container mới.
    if (resizeObserver) {
      for (const el of containerRefs.values()) {
        resizeObserver.observe(el)
      }
    }
  })
})
</script>

<template>
  <div class="node-tree">
    <div class="node-tree__header">
      <span class="node-tree__title">Node Tree</span>
      <span class="node-tree__points">{{ player.skillPoints }} Skill Point</span>
    </div>

    <div v-for="branch in branches" :key="branch.branchTag ?? 'other'" class="node-tree__branch">
      <h5 class="node-tree__branch-title" :style="{ color: branch.color }">{{ branch.label }}</h5>

      <div
        :ref="el => setContainerRef(branch.branchTag ?? '__other__', el)"
        class="node-tree__branch-tree"
        :style="{ '--branch-color': branch.color }"
      >
        <SkillConnections
          :connections="connectionsFor(branch)"
          :rects="rectsByBranch[branch.branchTag ?? '__other__'] ?? {}"
        />

        <div v-for="tier in branch.tiers" :key="tier.depth" class="node-tree__row">
          <button
            v-for="{ node, purchased, purchasable } in tier.entries"
            :key="node.id"
            :ref="el => setNodeRef(node.id, el)"
            type="button"
            class="node-tree__node"
            :class="{
              'is-major': tier.depth === 0,
              'node-tree__node--child': tier.depth > 0,
              'is-purchased': purchased,
              'is-locked': !purchased && !purchasable,
              'is-selected': node.id === selectedNodeId,
              'is-unlocking': node.id === unlockingNodeId,
            }"
            @click="onClick(node, purchased, purchasable)"
          >
            <span class="node-tree__node-name">{{ node.name }}</span>
            <span v-if="node.description" class="node-tree__node-desc">{{ node.description }}</span>
            <span class="node-tree__node-cost">
              {{ purchased ? 'Đã lĩnh ngộ' : `${node.cost} Skill Point` }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.node-tree {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.node-tree__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-family: var(--font-body);
}

.node-tree__title {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-primary);
}

.node-tree__points {
  font-size: 0.68rem;
  color: var(--gold-500);
}

.node-tree__branch-title {
  font-size: 0.68rem;
  font-weight: 600;
  margin: 0 0 4px;
}

/* Cây thật, N tầng (Skill Node phân tầng, 2026-08-21) — mỗi .node-tree__row
   là 1 tầng depth, đường nối THẬT vẽ bởi SkillConnections.vue (SVG,
   position:absolute bên trong container position:relative này) thay vì
   connector CSS giả trước đây. */
.node-tree__branch-tree {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  padding: 4px 0;
}

.node-tree__row {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.node-tree__node {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 140px;
  padding: 6px 8px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  color: var(--text-primary);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.node-tree__node.is-major {
  border-color: var(--branch-color, var(--ink-line));
}

.node-tree__node:hover {
  border-color: var(--branch-color, var(--ink-line));
}

.node-tree__node.is-purchased {
  background: color-mix(in srgb, var(--branch-color, var(--gold-500)) 18%, var(--ink-800));
}

/* Locked node vẫn CLICK ĐƯỢC (để xem điều kiện ở NodeInspector.vue,
   plan mục 29 "Node locked → hiện điều kiện") — chỉ mờ đi để phân biệt,
   không còn cursor:not-allowed/disabled như bản mua-thẳng cũ. */
.node-tree__node.is-locked {
  opacity: 0.5;
}

.node-tree__node.is-selected {
  outline: 2px solid var(--gold-500);
  outline-offset: -2px;
}

/* Skill Node unlock animation mục 2 — pulse 0.85->1.08->1.0 + glow mạnh
   ngắn hạn rồi trở về bình thường, ~500ms. Vòng sáng mở rộng qua
   ::after (radial-gradient scale 0->1.6 + fade), tách khỏi transform
   của chính node để không làm lệch layout xung quanh. */
.node-tree__node.is-unlocking {
  position: relative;
  animation: skill-node-pulse 500ms ease-out;
  border-color: var(--gold-500);
  box-shadow: 0 0 14px 2px color-mix(in srgb, var(--gold-500) 55%, transparent);
}

.node-tree__node.is-unlocking::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: inherit;
  border: 1px solid var(--gold-500);
  opacity: 0;
  animation: skill-node-ring 500ms ease-out;
  pointer-events: none;
}

@keyframes skill-node-pulse {
  0% {
    transform: scale(0.85);
  }

  55% {
    transform: scale(1.08);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes skill-node-ring {
  0% {
    opacity: 0.9;
    transform: scale(0.9);
  }

  100% {
    opacity: 0;
    transform: scale(1.35);
  }
}

.node-tree__node-name {
  font-size: 0.68rem;
  font-weight: 600;
}

.node-tree__node-desc {
  font-size: 0.58rem;
  color: var(--text-muted);
}

.node-tree__node-cost {
  font-size: 0.58rem;
  color: var(--gold-500);
}
</style>
