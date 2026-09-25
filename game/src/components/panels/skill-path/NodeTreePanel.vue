<script setup lang="ts">
// Phap Tu Redesign (magicpath) -- Node Tree UI: liet ke MOI
// ProgressionNode da dang ky (gameManager.nodeRegistry), nhom theo
// branchTag (thuan hien thi, xem ProgressionNode.ts).
//
// SkillPathPanel.vue redesign (2026-08-20, PhapTuPanel plan muc 6/10)
// -- truoc day click node MUA THANG, hien MOI branch cung luc. Gio:
// (1) prop `branchTag` optional loc con DUNG 1 branch (SkillPathPanel
// truyen vao theo skill/branch dang chon -- khong truyen
// gi = hien tat ca, giu nguyen hanh vi cu cho caller khac neu co);
// (2) click CHI emit 'select' (ke ca node da mua/con khoa -- plan muc
// 29 "Node locked -> hien dieu kien" nghia la van xem duoc), mua that
// doi xuong nut "Linh Ngo" o NodeInspector.vue (bottom panel) -- tach
// XEM khoi MUA dung UX plan muc 10.
//
// Phan tang THAT + SVG connections (2026-08-21, Plans/SkillNode) --
// truoc day chi 2 tang cung (roots/children, xem git history) khong
// du cho cay sau hon 2 cap (root -> Luyen Khi/Truc Co Major -> Truc Co
// Minor, xem data/progression/PhapTuNodes.ts). Gio tinh depth THAT
// bang cach di nguoc prerequisite kind:'node' trong CUNG branch toi
// goc (0 prereq node = depth 0), nhom theo depth thanh N tang thay vi
// 2 bucket cung -- moi node van CHI CO DUNG 1 parent trong toan bo data
// hien co (khong co node nao yeu cau 2 node khac cung luc), nen model
// single-parent nay khop 100% du lieu that.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useProgressionActions } from '@/composables/useProgressionActions'
import { canPurchaseNode, canUpgradeNode, getNodeLevel, getNodeMaxLevel, getEffectiveNodeMaxLevel, getNextLevelCost, previewRouteSwitch, hasPrerequisite, nodeWayApplies } from '@/core/progression/NodeSystem'
import { getActiveRoute } from '@/core/player/CultivationPathSystem'
import { ELEMENT_LABELS, ELEMENT_COLOR_VARS } from '@/core/element/ElementLabels'
import { HIDDEN_BRANCH_TAGS, viewBranchTags } from '@/core/progression/NodeBranchViews'
import { isBattleInProgress } from '@/core/battle/BattleTypes'
import SkillConnections from './SkillConnections.vue'
import type { SkillConnectionEntry, SkillConnectionRect } from './SkillConnections.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import SysTag from '@/components/common/system/SysTag.vue'
import type { ElementType } from '@/core/element/ElementType'
import type { SpellPathRoute } from '@/core/phap-tu/PhapTuState'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'

const props = defineProps<{
  branchTag?: string
  selectedNodeId?: string | null
  // Skill Node unlock animation -- node vua purchaseNode() THANH CONG
  // (xem NodeInspector.vue/SkillPathPanel.vue). `seq` tang dan de
  // watch() luon bat duoc lan mua MOI, ke ca truong hop ly thuyet mua
  // lien tiep cung nodeId.
  unlockTrigger?: { nodeId: string; seq: number } | null
}>()

const emit = defineEmits<{
  select: [node: ProgressionNode, purchased: boolean, purchasable: boolean]
}>()

const { t } = useI18n()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { switchSpellPathRoute, respecNodeTree } = useProgressionActions()

function branchLabel(branchTag: string | undefined): string {
  if (!branchTag) {
    return t('panels.nodeTree.labels.otherBranch')
  }

  // The Tu Reimagined (T22) -- path-id tree tags get i18n labels instead
  // of the raw branchTag fallback ('the_tu'/'the_tu_an' are not elements).
  if (branchTag === 'the_tu') {
    return t('panels.nodeTree.branchLabels.theTu')
  }

  if (branchTag === 'the_tu_an') {
    return t('panels.nodeTree.branchLabels.theTuAn')
  }

  return ELEMENT_LABELS[branchTag as ElementType] ?? branchTag
}

function branchColor(branchTag: string | undefined): string {
  // The Tu Reimagined (T22) -- The Tu Hien kit declares element 'metal';
  // the hidden path falls back to the paper-text neutral.
  if (branchTag === 'the_tu') {
    return ELEMENT_COLOR_VARS.metal
  }

  return ELEMENT_COLOR_VARS[branchTag as ElementType] ?? 'var(--paper-text)'
}

// Phap Tu Reimagined (Task 16) -- route respec toggle (P3). A route is a
// stance, not a node: the toggle lives in the tree header and only
// shows for normal Phap Tu once the atomic element+route commit exists.
const SPELL_PATH_ROUTE_IDS: readonly SpellPathRoute[] = ['dot', 'no']

// M-UI-SYSTEM - route tags become SysTag chips; glyph shape + label text
// carry the route (hue only reinforces, spec 7.3).
const NODE_ROUTE_TONE: Record<SpellPathRoute, 'warn' | 'violet'> = {
  dot: 'warn',
  no: 'violet',
}

const spellPathRoute = computed<SpellPathRoute | null>(() => {
  stateVersion.value

  // P1 - the canonical route read carries the way gate: the axis is
  // declared on spell_pathway and gated by 'spell.elemental_casting', so a
  // collapsed ('spell','hidden_spell_pathway') player resolves nothing.
  return getActiveRoute(player) ?? null
})

const inBattle = computed(() => {
  stateVersion.value

  const battle = gameManager.getTurnBattle()

  return battle !== null && isBattleInProgress(battle.state)
})

const pendingRoute = ref<SpellPathRoute | null>(null)

const routePreview = computed(() => {
  stateVersion.value

  if (pendingRoute.value === null) {
    return null
  }

  return previewRouteSwitch(player.$state, gameManager.nodeRegistry)
})

function onRouteClick(route: SpellPathRoute) {
  if (route === spellPathRoute.value || inBattle.value) {
    return
  }

  pendingRoute.value = route
}

function confirmRouteSwitch() {
  const route = pendingRoute.value

  pendingRoute.value = null

  if (route !== null) {
    switchSpellPathRoute(route)
  }
}

function cancelRouteSwitch() {
  pendingRoute.value = null
}
interface TreeEntry {
  node: ProgressionNode
  purchased: boolean
  purchasable: boolean

  // Node level (plan 6.1) -- badge `level/max` cho node nhieu cap.
  level: number

  maxLevel: number

  upgradable: boolean

  nextCost: number | null

  parentId: string | null

  depth: number
}

const branches = computed(() => {
  stateVersion.value

  const allNodes = gameManager.nodeRegistry.getAll()

  // Phap Tu Reimagined (Task 16) -- a node belongs to a view when either
  // its elementTag (reworked Phap Tu tree) or branchTag (Kiem Tu
  // routes) is in the view's tag set; unfiltered views hide
  // HIDDEN_BRANCH_TAGS (the future An tree surface -- Task 7's path owns
  // no normal tree). Tag mapping owned by NodeBranchViews (single
  // source for the coverage guard tests/architecture/
  // nodeBranchCoverage.test.ts).
  const nodeViewTag = (node: ProgressionNode): string | undefined => node.elementTag ?? node.branchTag

  const visibleTags = props.branchTag ? new Set<string>(viewBranchTags(props.branchTag)) : null
  // M-QI-05 - Core Nodes (levelsSkillId) are progression state, never
  // tree content: excluded in every view regardless of tag filtering.
  const coreFiltered = allNodes.filter(node => node.levelsSkillId === undefined)
  const tagFiltered = visibleTags
    ? coreFiltered.filter(node => nodeViewTag(node) !== undefined && visibleTags.has(nodeViewTag(node)!))
    : coreFiltered.filter(node => !(nodeViewTag(node) !== undefined && (HIDDEN_BRANCH_TAGS as readonly string[]).includes(nodeViewTag(node)!)))

  // Kiem Tu Reimagined -- revealWhen hides the node until the prereq
  // holds against the live player (the hidden-path root never renders
  // early; canPurchaseNode re-checks the same gate). Mode-tagged nodes
  // only render in their own mode's view: sword_pathway sees the orb branches +
  // the (unrevealed) hidden root, hidden_sword_pathway sees the hidden branch -- the
  // abandoned mode's nodes vanish entirely.
  // M3 -- way-tagged nodes follow the same display rule as mode-tagged
  // ones: a node authored for another way does not render at all.
  const nodes = tagFiltered.filter(
    node =>
      // Three-path design (2026-09-25) -- realm-reward grants are not tree
      // content: never rendered, only granted (effect still aggregates).
      !node.rewardOnly &&
      (!node.revealWhen || hasPrerequisite(player.$state, node.revealWhen)) &&
      nodeWayApplies(player.$state, node),
  )

  const groups = new Map<string, typeof nodes>()

  for (const node of nodes) {
    const key = nodeViewTag(node) ?? '__other__'
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
      const level = getNodeLevel(player.$state, node.id)

      const maxLevel = getNodeMaxLevel(node)

      const upgradable = canUpgradeNode(player.$state, node)

      entryById.set(node.id, {
        node,
        purchased: level >= 1,
        purchasable: canPurchaseNode(player.$state, node),
        level,
        maxLevel,
        upgradable,
        // M-QI-06 - effective cap read: a gate-blocked level previews
        // no cost (the x/max badge stays authored maxLevel above).
        nextCost: level >= getEffectiveNodeMaxLevel(player.$state, node) ? null : getNextLevelCost(node, level),
        parentId: parentOf(node),
        depth: 0,
      })
    }

    // Khong ky vong chu trinh (data hand-authored, luon la cay that),
    // nhung van chan bang `guard` cho chac -- 1 node lap lai trong
    // guard thi coi nhu depth 0 tai do thay vi de quy vo han.
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

// M-F-RESPEC (ruling S14) - FREE Beta respec: whole-tree node reset at
// 100% actually-paid Insight, out of combat only (the op rejects during
// battle; the button mirrors the route options' disabled state). The
// preview goes through the ops layer so commit-marker exemptions
// (Phap Tu element roots) match the real transaction exactly.
const pendingRespec = ref(false)

const respecPreview = computed(() => {
  stateVersion.value

  if (!pendingRespec.value) {
    return null
  }

  return gameManager.progressionOps.previewNodeRespec(player.$state)
})

// Clawback legs the plain {regain}/{count} line does not cover: skills and
// specialization picks revoked by grant clawback, plus kiem-tu residual
// losses. Rendered only when the preview reports at least one leg.
const respecClawbackText = computed(() => {
  const clawback = respecPreview.value?.clawback

  if (clawback === undefined) {
    return ''
  }

  const parts: string[] = []

  if (clawback.unlearnedSkillIds.length > 0) {
    parts.push(
      t('panels.nodeTree.respec.clawbackSkills', {
        n: clawback.unlearnedSkillIds.length,
      }),
    )
  }

  if (clawback.clearedSpecializations.length > 0) {
    parts.push(
      t('panels.nodeTree.respec.clawbackSpecs', {
        n: clawback.clearedSpecializations.length,
      }),
    )
  }

  if (clawback.kiemY > 0 || clawback.kiemDao > 0) {
    parts.push(
      t('panels.nodeTree.respec.clawbackSwords', {
        y: clawback.kiemY,
        d: clawback.kiemDao,
      }),
    )
  }

  if (clawback.refund > 0) {
    parts.push(
      t('panels.nodeTree.respec.clawbackRefund', { n: clawback.refund }),
    )
  }

  return parts.length === 0
    ? ''
    : t('panels.nodeTree.respec.clawback', { detail: parts.join(', ') })
})

// Any purchased node in the rendered view makes respec meaningful; the
// branch computation already resolved ownership per entry.
const hasOwnedNodes = computed(() => {
  stateVersion.value

  return branches.value.some(branch =>
    branch.entries.some(entry => entry.purchased),
  )
})

function onRespecClick() {
  if (inBattle.value || !hasOwnedNodes.value) {
    return
  }

  pendingRespec.value = true
}

function confirmRespec() {
  pendingRespec.value = false

  respecNodeTree()
}

function cancelRespec() {
  pendingRespec.value = false
}

function onClick(node: ProgressionNode, purchased: boolean, purchasable: boolean) {
  emit('select', node, purchased, purchasable)
}

/** Nhan cost theo level (plan 6.2/6.7): Linh Ngo / Nang cap / Toi da. */
function costLabel(entry: TreeEntry): string {
  if (entry.level === 0) {
    return t('panels.nodeTree.labels.unpurchasedCost', { cost: entry.nextCost ?? entry.node.insightCost })
  }

  if (entry.level >= entry.maxLevel) {
    return t('panels.nodeTree.labels.maxLevel')
  }

  // M-QI-06 - a gate-blocked level (nextCost null below authored max)
  // renders no upgrade-cost text; the inspector's gate reasons carry
  // the explanation.
  if (entry.nextCost === null) {
    return ''
  }

  return t('panels.nodeTree.labels.upgradeCost', { cost: entry.nextCost })
}

// ---- Skill Node unlock animation (2026-08-21, Plans/SkillNode) ----
// State may: locked/available (suy thang tu purchased/purchasable co
// san, KHONG can state rieng) -> unlocking (connection sang chay ->
// node pulse/glow, tuan tu BAT BUOC theo muc 2 cua plan) -> unlocked
// (chinh la `purchased` reactive, da dung NGAY khi purchaseNode()
// return true -- animation chi la lop trang tri chay THEM, khong giu
// hay tri hoan trang thai that).
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

// ---- Do vi tri node THAT cho SkillConnections.vue (SVG layer) ----
// Moi branch co 1 container rieng (position:relative) + 1 SVG overlay
// -- do getBoundingClientRect() cua tung node button TUONG DOI voi
// container do, du cho ca 2 truong hop: props.branchTag set (1
// container) hoac khong set (nhieu container, moi branch 1 cai).
const containerRefs = new Map<string, HTMLElement>()
const nodeRefs = new Map<string, HTMLElement>()

// Template ref callback (Vue 3) truyen Element | ComponentPublicInstance
// | null -- 2 ham nay CHI gan cho <div>/<button> thuan (khong phai
// component), luon la Element that, nen narrow bang instanceof.
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

    // Container moi dung (doi branch) chua duoc observe -- resizeObserver
    // da ton tai tu onMounted() thi gan them cho container moi.
    if (resizeObserver) {
      for (const el of containerRefs.values()) {
        resizeObserver.observe(el)
      }
    }

    recomputeFit()
  })
})

// ---- Zoom-to-fit thay cho cuon (2026-08-30, bug report) ----
// Cay ky nang nhieu tang de cao hon khung panel -- truoc day cuon doc de
// xem het, gio TU CO co gian (CSS `zoom`, khong phai transform:scale --
// `zoom` doi layout box that nen getBoundingClientRect() dung boi
// measure() o tren van dung, ResizeObserver container van tu ban lai
// khi zoom doi, khong can patch rieng cho SkillConnections.vue) de vua
// khung theo mac dinh. Nguoi choi co the zoom tay de xem chi tiet hon --
// khi do (va chi khi do) viewport moi cho cuon/pan.
const ZOOM_MIN = 0.4
const ZOOM_MAX = 1.5
const ZOOM_STEP = 0.15

const viewportEl = ref<HTMLElement | null>(null)
const contentEl = ref<HTMLElement | null>(null)

const fitZoom = ref(1)
const zoom = ref(1)
const zoomOverridden = ref(false)

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100))
}

function recomputeFit() {
  const viewport = viewportEl.value
  const content = contentEl.value

  if (!viewport || !content) {
    return
  }

  // CSS `zoom` (khac transform:scale) doi LUON layout box cua chinh no
  // -- scrollHeight do duoc da PHAN ANH zoom hien tai, nen phai quy doi
  // nguoc ve "chieu cao tu nhien" (zoom=1) truoc khi tinh fit moi,
  // khong thi fit se troi dan moi lan recompute.
  const currentZoom = zoom.value || 1
  const naturalHeight = content.scrollHeight / currentZoom

  if (naturalHeight <= 0 || viewport.clientHeight <= 0) {
    return
  }

  fitZoom.value = clampZoom(viewport.clientHeight / naturalHeight)

  if (!zoomOverridden.value) {
    zoom.value = fitZoom.value
  }
}

function zoomIn() {
  zoomOverridden.value = true
  zoom.value = clampZoom(zoom.value + ZOOM_STEP)
}

function zoomOut() {
  zoomOverridden.value = true
  zoom.value = clampZoom(zoom.value - ZOOM_STEP)
}

function zoomToFit() {
  zoomOverridden.value = false
  zoom.value = fitZoom.value
}

const isPannable = computed(() => zoom.value > fitZoom.value + 0.01)

// Zoom doi vi tri render that cua tung node -- ve lai duong noi SVG theo
// toa do moi. Khong chi dua vao ResizeObserver (du tin cay voi `zoom`
// vi no doi layout box that, nhung canh chac de khong lech duong noi).
watch(zoom, () => {
  nextTick(measure)
})

let viewportResizeObserver: ResizeObserver | undefined

onMounted(() => {
  nextTick(recomputeFit)

  viewportResizeObserver = new ResizeObserver(() => recomputeFit())

  if (viewportEl.value) {
    viewportResizeObserver.observe(viewportEl.value)
  }
})

onBeforeUnmount(() => {
  viewportResizeObserver?.disconnect()
})
</script>

<template>
  <div class="node-tree sys-surface sys-corners">
    <div class="node-tree__header">
      <span class="node-tree__title sys-eyebrow">{{ t('panels.nodeTree.title') }}</span>

      <!-- Route respec toggle (P3) — Phap Tu only, once element+route
           committed; switching refunds 75% of old-route investment. -->
      <div v-if="spellPathRoute" class="node-tree__route" role="group" :aria-label="t('panels.nodeTree.routes.aria')">
        <button
          v-for="route in SPELL_PATH_ROUTE_IDS"
          :key="route"
          type="button"
          class="node-tree__route-option"
          :class="{ 'is-active': route === spellPathRoute }"
          :disabled="inBattle"
          @click="onRouteClick(route)"
        >
          {{ t(`panels.nodeTree.routes.${route}`) }}
        </button>
      </div>

      <!-- M-F-RESPEC (S14) - whole-tree respec entry: FREE Beta reset,
           confirm dialog shows the exact refund + reset count first. -->
      <button
        type="button"
        class="node-tree__respec"
        :disabled="inBattle || !hasOwnedNodes"
        @click="onRespecClick"
      >
        {{ t('panels.nodeTree.respec.button') }}
      </button>

      <div class="node-tree__zoom" role="group" :aria-label="t('panels.nodeTree.aria.zoomGroup')">
        <button type="button" :disabled="zoom <= ZOOM_MIN" @click="zoomOut">−</button>
        <button type="button" class="node-tree__zoom-value" :title="t('panels.nodeTree.tooltips.zoomToFit')" @click="zoomToFit">{{ Math.round(zoom * 100) }}%</button>
        <button type="button" :disabled="zoom >= ZOOM_MAX" @click="zoomIn">+</button>
      </div>

      <span class="node-tree__points">{{ player.skillInsight }} {{ t('panels.nodeTree.labels.insight') }}</span>
    </div>

    <!-- Zoom-to-fit thay cuộn (2026-08-30) — mặc định co vừa khung,
         zoom tay vượt fit mới cho cuộn/pan (is-pannable). -->
    <div ref="viewportEl" class="node-tree__viewport" :class="{ 'is-pannable': isPannable }">
      <div ref="contentEl" class="node-tree__scale-content" :style="{ zoom: `${zoom}` }">
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
                v-for="entry in tier.entries"
                :key="entry.node.id"
                :ref="el => setNodeRef(entry.node.id, el)"
                type="button"
                class="node-tree__node"
                :class="{
                  'is-major': tier.depth === 0,
                  'node-tree__node--child': tier.depth > 0,
                  'is-purchased': entry.purchased,
                  'is-maxed': entry.purchased && !entry.upgradable && entry.level >= entry.maxLevel && entry.maxLevel > 1,
                  'is-locked': !entry.purchased && !entry.purchasable,
                  'is-selected': entry.node.id === selectedNodeId,
                  'is-unlocking': entry.node.id === unlockingNodeId,
                }"
                @click="onClick(entry.node, entry.purchased, entry.purchasable)"
              >
                <span class="node-tree__node-name">
                  {{ entry.node.name }}

                  <!-- Badge cấp cho node nhiều cấp (plan §6.2): `3/10`. -->
                  <span v-if="entry.maxLevel > 1" class="node-tree__node-level">{{ entry.level }}/{{ entry.maxLevel }}</span>

                  <!-- Badge hướng Dot/No — node routeTag chỉ mua/hiệu
                       lực khi route đang chọn khớp (query-time gate). -->
                  <SysTag v-if="entry.node.routeTag" :tone="NODE_ROUTE_TONE[entry.node.routeTag]" class="node-tree__node-route">{{ t(`panels.nodeTree.routes.${entry.node.routeTag}`) }}</SysTag>
                </span>
                <span v-if="entry.node.description" class="node-tree__node-desc">{{ entry.node.description }}</span>
                <span class="node-tree__node-cost">
                  {{ costLabel(entry) }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Route respec confirm — preview shows actual-paid refund math
         ("regain X, lose Y", spec §11). -->
    <ConfirmModal
      v-if="pendingRoute !== null && routePreview !== null"
      :open="true"
      :title="t('panels.nodeTree.routeSwitch.title')"
      :message="t('panels.nodeTree.routeSwitch.body', {
        route: t(`panels.nodeTree.routes.${pendingRoute}`),
        regain: routePreview.refund,
        lose: routePreview.forfeited,
      })"
      :confirm-label="t('panels.nodeTree.routeSwitch.confirm')"
      danger
      @confirm="confirmRouteSwitch"
      @cancel="cancelRouteSwitch"
    />

    <!-- M-F-RESPEC confirm - the ops preview reports the exact Insight
         refund and how many nodes (targets + cascade) reset to 0. -->
    <ConfirmModal
      v-if="pendingRespec && respecPreview !== null"
      :open="true"
      :title="t('panels.nodeTree.respec.title')"
      :message="t('panels.nodeTree.respec.body', {
        regain: respecPreview.refund,
        count: respecPreview.resetCount,
        clawback: respecClawbackText,
      })"
      :confirm-label="t('panels.nodeTree.respec.confirm')"
      danger
      @confirm="confirmRespec"
      @cancel="cancelRespec"
    />
  </div>
</template>

<style scoped>
.node-tree {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* M-UI-SYSTEM: root carries .sys-surface (holocham console inside the
     modal); padding keeps content off the recipe's 1px edge. */
  padding: 10px 12px;
}

.node-tree__header {
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  font-family: var(--font-body);
}

.node-tree__route {
  display: flex;
  align-items: center;
  gap: 4px;
}

.node-tree__route-option {
  min-height: 22px;
  padding: 1px 10px;
  background: var(--sys-bg-0, var(--ink-800));
  border: 1px solid var(--sys-line-soft, var(--ink-line-soft));
  border-radius: 999px;
  color: var(--sys-text-muted, var(--text-secondary));
  font-family: var(--sys-font-display, var(--font-body));
  font-size: var(--text-xs);
  line-height: 1;
  cursor: pointer;
}

.node-tree__route-option.is-active {
  border-color: var(--sys-cyan, var(--gold-700));
  color: var(--sys-cyan, var(--gold-700));
  font-weight: 600;
}

.node-tree__route-option:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.node-tree__respec {
  min-height: 22px;
  padding: 1px 10px;
  background: var(--sys-bg-0, var(--ink-800));
  border: 1px solid var(--sys-line-soft, var(--ink-line-soft));
  border-radius: 999px;
  color: var(--sys-text-muted, var(--text-secondary));
  font-family: var(--sys-font-display, var(--font-body));
  font-size: var(--text-xs);
  line-height: 1;
  cursor: pointer;
}

.node-tree__respec:hover:not(:disabled) {
  border-color: var(--sys-cyan, var(--gold-700));
  color: var(--sys-cyan, var(--gold-700));
}

.node-tree__respec:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.node-tree__zoom {
  display: flex;
  align-items: center;
  gap: 4px;
}

.node-tree__zoom button {
  min-width: 22px;
  min-height: 22px;
  padding: 0 4px;
  background: var(--sys-bg-0, var(--ink-800));
  border: 1px solid var(--sys-line-soft, var(--ink-line-soft));
  border-radius: var(--radius-sm);
  color: var(--sys-text, var(--text-primary));
  font-family: var(--font-body);
  font-size: var(--text-xs);
  line-height: 1;
  cursor: pointer;
}

.node-tree__zoom button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.node-tree__zoom-value {
  min-width: 42px;
  font-variant-numeric: tabular-nums;
}

/* Zoom-to-fit thay cuon (2026-08-30) -- mac dinh overflow:hidden (noi
   dung da co vua khung qua CSS `zoom`), chi cho cuon/pan khi nguoi choi
   tu zoom tay vuot muc fit (is-pannable). */
.node-tree__viewport {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.node-tree__viewport.is-pannable {
  overflow: auto;
}


.node-tree__title {
  font-family: var(--sys-font-display, var(--font-body));
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--sys-text-muted, var(--paper-text));
}

.node-tree__points {
  /* M-UI-SYSTEM: insight counter reads as a system numeral readout. */
  font-family: var(--sys-font-display, var(--font-body));
  font-variant-numeric: tabular-nums;
  font-size: var(--text-sm);
  color: var(--sys-cyan, var(--gold-700));
}

.node-tree__branch-title {
  font-size: var(--text-sm);
  font-weight: 600;
  margin: 0 0 4px;
}

/* Cay that, N tang (Skill Node phan tang, 2026-08-21) -- moi .node-tree__row
   la 1 tang depth, duong noi THAT ve boi SkillConnections.vue (SVG,
   position:absolute ben trong container position:relative nay) thay vi
   connector CSS gia truoc day. */
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
  background: var(--sys-bg-0, var(--ink-800));
  border: 1px solid var(--sys-line-soft, var(--ink-line-soft));
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  color: var(--sys-text, var(--text-primary));
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.node-tree__node.is-major {
  border-color: var(--sys-line-hot, var(--branch-color, var(--ink-line)));
}

.node-tree__node:hover {
  border-color: var(--sys-line-hot, var(--branch-color, var(--ink-line)));
}

.node-tree__node.is-purchased {
  background: color-mix(in srgb, var(--sys-success, var(--branch-color, var(--chrome-300))) 14%, var(--sys-bg-0, var(--ink-800)));
  border-color: color-mix(in srgb, var(--sys-success, var(--branch-color, var(--chrome-300))) 55%, transparent);
}

/* Locked node van CLICK DUOC (de xem dieu kien o NodeInspector.vue,
   plan muc 29 "Node locked -> hien dieu kien") -- chi mo di de phan biet,
   khong con cursor:not-allowed/disabled nhu ban mua-thang cu. */
.node-tree__node.is-locked {
  opacity: 0.5;
}

.node-tree__node.is-selected {
  outline: 2px solid var(--sys-focus, var(--chrome-300));
  outline-offset: -2px;
}

/* Skill Node unlock animation muc 2 -- pulse 0.85->1.08->1.0 + glow manh
   ngan han roi tro ve binh thuong, ~500ms. Vong sang mo rong qua
   ::after (radial-gradient scale 0->1.6 + fade), tach khoi transform
   cua chinh node de khong lam lech layout xung quanh. */
.node-tree__node.is-unlocking {
  position: relative;
  animation: skill-node-pulse 500ms ease-out;
  border-color: var(--sys-violet, var(--chrome-300));
  box-shadow: 0 0 14px 2px color-mix(in srgb, var(--sys-violet, var(--chrome-300)) 55%, transparent);
}

.node-tree__node.is-unlocking::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: inherit;
  border: 1px solid var(--sys-violet, var(--chrome-300));
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
  font-size: var(--text-sm);
  font-weight: 600;
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

/* Badge cap `3/10` -- node nhieu cap (plan 6.2). */
.node-tree__node-level {
  padding: 0 4px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--branch-color, var(--chrome-300)) 55%, transparent);
  font-size: var(--text-xs);
  line-height: 1.4;
  color: var(--chrome-100);
}

/* Route badge - node routeTag (Phap Tu Reimagined Task 16). M-UI-SYSTEM:
   the chip is a SysTag; the .sys-tag anchor re-maps its border line so it
   stays quiet on the node card. */
.node-tree__node-route.sys-tag {
  --sys-tag-line: var(--sys-line-soft, color-mix(in srgb, var(--gold-700) 60%, transparent));
  font-size: var(--text-xs);
}

.node-tree__node-desc {
  font-size: var(--text-xs);
  color: var(--sys-text-dim, var(--text-muted));
}

.node-tree__node-cost {
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--sys-text-muted, var(--chrome-100));
}
</style>
