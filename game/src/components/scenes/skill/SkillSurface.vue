<script setup lang="ts">
// Ky Nang production adapter: mounts the approved skill-v2 fidelity
// surface (paper constellation + node detail rail) fed entirely by the
// canonical read-models - progressionOps.betaSkillTreeFor resolves every
// node predicate (scope-hidden/reveal gates/purchasable/canUpgrade/
// costs), the layout reuses the same pure radial projection the retired
// NodeTreePanel consumed, and mutations stay on useProgressionActions
// (purchaseNode / upgradeNode / respecNodeTree). Nothing here recomputes
// gates, costs, or pathway admission.
//
// Pathway lock (user ruling S07): the surface renders ONLY the committed
// pathway - element pills appear solely for the elements the tree model
// actually renders (a committed spell path shows its own element only);
// ways without an element axis render their node-tree tags flat. No
// library / role-strip / native-core columns - skills auto-mount.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePaperNavigation } from '@/components/scenes/usePaperNavigation'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { useProgressionActions } from '@/composables/useProgressionActions'
import { ELEMENT_ORDER, ELEMENT_LABELS } from '@/core/element/ElementLabels'
import { viewBranchTags } from '@/core/progression/NodeBranchViews'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { layoutRadialGraph } from '@/components/panels/skill-path/skillGraphLayout'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import type { BetaSkillTreeNode } from '@/core/betaScopeSkillDomain'
import type { ElementType } from '@/core/element/ElementType'
import type { NodePrerequisite, ProgressionNode } from '@/core/progression/ProgressionNode'
import SkillFidelityScene from './fidelity/SkillFidelityScene.vue'
import type { SkillUiEdge, SkillUiElement, SkillUiNode } from './fidelity/skillUi'

const PAPER_NAV_IDS = ['realm', 'character', 'inventory', 'skill', 'technique', 'body', 'alchemy', 'equipment', 'exploration'] as const
const CANVAS_W = 710
const CANVAS_H = 445
const FALLBACK_ICON = resolveAssetUrl('/assets/ui/huyen-kim/symbols/skill.svg')

const { t } = useI18n()
const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { items: navItems, navigate } = usePaperNavigation(PAPER_NAV_IDS)
const { isBattleInProgress: inBattle } = useTurnBattleInfo()
const { purchaseNode, upgradeNode, respecNodeTree } = useProgressionActions()

const notice = ref('')
let noticeTimer: number | undefined
function flashNotice(text: string) {
  notice.value = text
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { noticeTimer = undefined; notice.value = '' }, 3200)
}
onBeforeUnmount(() => { if (noticeTimer !== undefined) clearTimeout(noticeTimer) })

const skillTree = computed(() => {
  stateVersion.value
  return gameManager.progressionOps.betaSkillTreeFor(
    player.$state,
    gameManager.nodeRegistry.getAll(),
  )
})

const wayNodeTreeTag = computed(() => skillTree.value.wayNodeTreeTag)
const committedElement = computed(() => skillTree.value.element ?? undefined)
const elementCasting = computed(() => skillTree.value.elementCasting)

const wayIdentity = computed(() => {
  const base = skillTree.value.wayName ?? t('panels.skillPath.mortalName')
  return committedElement.value ? `${base} · ${ELEMENT_LABELS[committedElement.value]}` : base
})

const allNodes = computed(() => gameManager.nodeRegistry.getAll())
const rowsById = computed(() => new Map(skillTree.value.nodes.map((row) => [row.nodeId, row])))

const revealHidden = (row: BetaSkillTreeNode): boolean =>
  row.prerequisites.some((gate) => gate.gate === 'reveal' && !gate.met)

const nodeViewTag = (node: ProgressionNode): string | undefined => node.elementTag ?? node.branchTag

// Pathway-scoped render set: spell paths take their element tags, other
// ways their declared tree tags; mortals render nothing.
const pathwayRows = computed(() => {
  const spell = elementCasting.value && wayNodeTreeTag.value === undefined
  const tags = spell
    ? new Set<ElementType>(ELEMENT_ORDER)
    : wayNodeTreeTag.value !== undefined
      ? new Set<string>(viewBranchTags(wayNodeTreeTag.value))
      : null
  if (tags === null) return { spell, rows: new Map<string, BetaSkillTreeNode>(), nodes: [] as ProgressionNode[] }

  const nodes = allNodes.value.filter((node) => {
    const tag = nodeViewTag(node)
    const row = rowsById.value.get(node.id)
    return tag !== undefined && tags.has(tag as ElementType & string) && row !== undefined && row.state !== 'scope-hidden' && !revealHidden(row)
  })
  return { spell, rows: rowsById.value, nodes }
})

const visibleElements = computed<ElementType[]>(() => {
  if (!pathwayRows.value.spell) return []
  const present = new Set<ElementType>()
  for (const node of pathwayRows.value.nodes) {
    if (node.elementTag !== undefined) present.add(node.elementTag)
  }
  return ELEMENT_ORDER.filter((element) => present.has(element))
})

const selectedElement = ref<ElementType | null>(committedElement.value ?? null)
watch(
  () => [committedElement.value, visibleElements.value.join(',')] as const,
  () => {
    if (selectedElement.value && visibleElements.value.includes(selectedElement.value)) return
    selectedElement.value = committedElement.value ?? visibleElements.value[0] ?? null
  },
  { immediate: true },
)

const elements = computed<SkillUiElement[]>(() =>
  visibleElements.value.map((id) => ({
    id,
    label: ELEMENT_LABELS[id],
    icon: resolveAssetUrl(`/assets/ui/elements/el-${id}.png`),
  })),
)

// Rendered graph: spell paths view the selected element branch; other
// pathways render every tag in one constellation.
interface GraphEntry { node: ProgressionNode; row: BetaSkillTreeNode; parentId: string | null; depth: number }
const graph = computed<{ entries: GraphEntry[] }>(() => {
  const { spell, nodes } = pathwayRows.value
  const scoped = spell && selectedElement.value !== null
    ? nodes.filter((node) => node.elementTag === selectedElement.value)
    : nodes
  const ids = new Set(scoped.map((node) => node.id))
  const entryById = new Map<string, GraphEntry>()

  for (const node of scoped) {
    let parentId: string | null = null
    for (const prereq of node.prerequisites ?? []) {
      if (prereq.kind === 'node' && ids.has(prereq.nodeId)) { parentId = prereq.nodeId; break }
    }
    entryById.set(node.id, { node, row: rowsById.value.get(node.id)!, parentId, depth: 0 })
  }

  const depthOf = (id: string, guard: Set<string>): number => {
    const entry = entryById.get(id)
    if (!entry || !entry.parentId || guard.has(id)) return 0
    return 1 + depthOf(entry.parentId, new Set(guard).add(id))
  }
  const entries = [...entryById.values()]
  for (const entry of entries) entry.depth = depthOf(entry.node.id, new Set())
  return { entries }
})

const layout = computed(() =>
  layoutRadialGraph(graph.value.entries.map((entry) => ({ id: entry.node.id, parentId: entry.parentId, depth: entry.depth }))),
)

// Zoom-to-fit: coordinates stay in the layout's natural square space;
// the tree scales the whole graph (cards included) into the viewport.
const graphSize = computed(() => (layout.value.size > 0 ? layout.value.size : CANVAS_W))
const graphFit = computed(() => (layout.value.size > 0 ? Math.min(1, CANVAS_H / layout.value.size) : 1))

function nodeName(id: string): string {
  return allNodes.value.find((node) => node.id === id)?.name ?? id
}
function realmName(id: string): string {
  try { return getCurrentRealm(id as never).name } catch { return id }
}
function skillName(id: string): string {
  return gameManager.skillManager.get(id)?.name ?? id
}

// ONE authored prereq -> localized reason (same contract the retired
// NodeInspector owned). The model's gate rows lose `level` on
// skillCastCount, so labels pair authored prerequisites with row met
// flags by index - authored order is preserved on both sides.
function prereqReason(prereq: NodePrerequisite): string {
  switch (prereq.kind) {
    case 'node': return t('panels.skillPath.nodeInspector.lockedReasons.prerequisiteNode', { name: nodeName(prereq.nodeId) })
    case 'realm': return t('panels.skillPath.nodeInspector.lockedReasons.realm', { realm: realmName(prereq.realmId) })
    case 'nodeCount': return t('panels.skillPath.nodeInspector.lockedReasons.nodeCount', { required: prereq.countRequired, total: prereq.nodeIds.length })
    case 'excludesNode': return t('panels.skillPath.nodeInspector.lockedReasons.excludesNode', { name: nodeName(prereq.nodeId) })
    case 'skillCastCount': {
      const parts = [
        prereq.level !== undefined ? t('panels.skillPath.nodeInspector.lockedReasons.skillLevel', { level: prereq.level }) : undefined,
        prereq.count !== undefined ? t('panels.skillPath.nodeInspector.lockedReasons.skillCastCount', { count: prereq.count }) : undefined,
      ].filter(Boolean).join(t('panels.skillPath.nodeInspector.lockedReasons.skillJoin'))
      return t('panels.skillPath.nodeInspector.lockedReasons.skill', { skill: skillName(prereq.skillId), requirement: parts })
    }
    case 'techniqueRank': return t('panels.skillPath.nodeInspector.lockedReasons.techniqueRank', { rank: prereq.rank })
    case 'techniqueGrade': return t('panels.skillPath.nodeInspector.lockedReasons.techniqueGrade', { grade: prereq.grade })
    default: return t('panels.skillPath.nodeInspector.lockedReasons.skillUpgrade')
  }
}

function unmetReasons(entry: GraphEntry, owned: boolean): string[] {
  if (owned) {
    return (entry.node.levelGates ?? [])
      .filter((gate, index) => entry.row.levelGates[index]?.met === false)
      .map((gate) => prereqReason(gate.prerequisite))
  }
  const authored: NodePrerequisite[] = [
    ...(entry.node.prerequisites ?? []),
    ...(entry.node.revealWhen ? [entry.node.revealWhen] : []),
  ]
  return authored
    .filter((_, index) => entry.row.prerequisites[index]?.met === false)
    .map(prereqReason)
}

function nodeIcon(node: ProgressionNode): string {
  return node.elementTag !== undefined
    ? resolveAssetUrl(`/assets/ui/elements/el-${node.elementTag}.png`)
    : FALLBACK_ICON
}

function toUiNode(entry: GraphEntry): SkillUiNode {
  const { node, row } = entry
  const owned = row.level >= 1
  const state: SkillUiNode['state'] = owned ? 'learned' : row.state === 'purchasable' ? 'available' : 'locked'
  const purchaseCost = row.nextLevelCost ?? node.insightCost ?? 0

  const conditions = unmetReasons(entry, owned)

  let costLabel = ''
  let actionLabel = ''
  let actionDisabled = true
  let actionHint = ''

  if (!owned) {
    actionLabel = t('panels.skillPath.nodeInspector.actions.unlock')
    costLabel = t('panels.skillPath.nodeInspector.cost.initial', { cost: purchaseCost })
    actionDisabled = row.state !== 'purchasable' || inBattle.value
    if (row.state === 'available') {
      actionHint = t('panels.skillPath.nodeInspector.lockedReasons.cost', { cost: purchaseCost, current: player.skillInsight })
    } else if (row.state !== 'purchasable' && conditions.length > 0) {
      actionHint = conditions[0]!
    }
  } else {
    const maxed = row.nextLevelCost === null && !row.canUpgrade
    actionLabel = maxed
      ? t('panels.skillPath.nodeInspector.status.maxed')
      : t('panels.skillPath.nodeInspector.actions.upgrade')
    if (!maxed) {
      costLabel = t('panels.skillPath.nodeInspector.cost.upgrade', { cost: row.nextLevelCost ?? 0 })
      actionDisabled = !row.canUpgrade || inBattle.value
      if (!row.canUpgrade && conditions.length > 0) actionHint = conditions[0]!
    } else {
      actionDisabled = true
    }
  }

  const position = layout.value.positions.get(node.id) ?? { x: 0, y: 0 }

  return {
    id: node.id,
    name: row.name,
    icon: nodeIcon(node),
    x: position.x,
    y: position.y,
    prominent: entry.depth === 0,
    level: `${row.level} / ${row.maxLevel}`,
    state,
    description: row.description ?? '',
    rows: [
      { id: 'level', label: t('skill.levelLabel'), value: `${row.level} / ${row.maxLevel}` },
      ...row.grantsSkillIds.map((skillId, i) => ({ id: `grant-${i}`, label: t('skill.grants'), value: skillName(skillId) })),
    ],
    conditions,
    costLabel,
    actionLabel,
    actionDisabled,
    actionHint,
  }
}

const nodes = computed<SkillUiNode[]>(() => graph.value.entries.map(toUiNode))
const edges = computed<SkillUiEdge[]>(() =>
  graph.value.entries.filter((entry) => entry.parentId !== null).map((entry) => ({ from: entry.parentId!, to: entry.node.id })),
)

const selectedId = ref<string | null>(null)
watch(nodes, (list) => {
  if (selectedId.value && list.some((node) => node.id === selectedId.value)) return
  selectedId.value = list.find((node) => node.prominent)?.id ?? list[0]?.id ?? null
}, { immediate: true })
const selected = computed(() => nodes.value.find((node) => node.id === selectedId.value) ?? null)

const insightLabel = computed(() => `${t('panels.nodeTree.labels.insight')}: ${formatNumber(player.skillInsight)}`)

function onSelectElement(id: string) {
  selectedElement.value = id as ElementType
}
function onSelect(id: string) {
  selectedId.value = id
}
function onUpgrade(id: string) {
  const row = rowsById.value.get(id)
  if (!row || inBattle.value) return
  const ok = row.level >= 1 ? (row.canUpgrade && upgradeNode(id)) : (row.state === 'purchasable' && purchaseNode(id))
  flashNotice(ok ? t('skill.actionDone', { name: row.name }) : t('skill.actionFailed'))
}

// ---- Respec (M-F-RESPEC, same authority as the retired NodeTreePanel) ----
const pendingRespec = ref(false)
const respecPreview = computed(() => {
  stateVersion.value
  return pendingRespec.value ? gameManager.progressionOps.previewNodeRespec(player.$state) : null
})
type GrantClawback = NonNullable<import('@/core/progression/NodeSystem').NodeRespecPreview['clawback']>
function clawbackDetailText(clawback: GrantClawback | undefined): string {
  if (clawback === undefined) return ''
  const parts: string[] = []
  if (clawback.unlearnedSkillIds.length > 0) parts.push(t('panels.nodeTree.clawback.skills', { n: clawback.unlearnedSkillIds.length }))
  if (clawback.clearedSpecializations.length > 0) parts.push(t('panels.nodeTree.clawback.specs', { n: clawback.clearedSpecializations.length }))
  if (clawback.refund > 0) parts.push(t('panels.nodeTree.clawback.refund', { n: clawback.refund }))
  return parts.length === 0 ? '' : t('panels.nodeTree.clawback.summary', { detail: parts.join(', ') })
}
const respecClawbackText = computed(() => clawbackDetailText(respecPreview.value?.clawback))
const hasOwnedNodes = computed(() => {
  stateVersion.value
  return graph.value.entries.some((entry) => entry.row.level >= 1)
})
const respecDisabled = computed(() => inBattle.value || !hasOwnedNodes.value)
watch(inBattle, (engaged) => { if (engaged) pendingRespec.value = false })
function onRespec() { if (!respecDisabled.value) pendingRespec.value = true }
function confirmRespec() {
  pendingRespec.value = false
  if (!inBattle.value) respecNodeTree()
}
</script>

<template>
  <SceneDesignCanvas overlay>
    <SkillFidelityScene
      :nodes="nodes"
      :edges="edges"
      :elements="elements"
      :element="selectedElement ?? ''"
      :selected="selected"
      :navigation="navItems"
      :notice="notice"
      :identity="wayIdentity"
      :insight-label="insightLabel"
      :respec-disabled="respecDisabled"
      :graph-size="graphSize"
      :graph-fit="graphFit"
      @select="onSelect"
      @element="onSelectElement"
      @navigate="navigate"
      @upgrade="onUpgrade"
      @respec="onRespec"
      @back="ui.closeHomeOverlays()"
    />
    <ConfirmModal
      v-if="pendingRespec && respecPreview !== null"
      :open="true"
      :title="t('panels.nodeTree.respec.title')"
      :message="t('panels.nodeTree.respec.body', { regain: respecPreview.refund, count: respecPreview.resetCount, clawback: respecClawbackText })"
      :confirm-label="t('panels.nodeTree.respec.confirm')"
      @confirm="confirmRespec"
      @cancel="pendingRespec = false"
    />
  </SceneDesignCanvas>
</template>
