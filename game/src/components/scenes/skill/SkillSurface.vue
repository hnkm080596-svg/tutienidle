<script setup lang="ts">
// Ky Nang production adapter: mounts the approved skill-v2 fidelity
// surface (paper constellation + node detail rail) fed entirely by the
// canonical read-models - progressionOps.betaSkillTreeFor resolves every
// node predicate (scope-hidden/reveal gates/purchasable/canUpgrade/
// costs), and mutations stay on useProgressionActions
// (purchaseNode / upgradeNode / respecNodeTree). Nothing here recomputes
// gates, costs, or pathway admission.
//
// Layout: branches with an authored Han-glyph constellation
// (SkillConstellationLayouts - beta: fire only) render their authored
// points; every other branch keeps the radial projection the retired
// NodeTreePanel consumed, per the plan's fallback rule.
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
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { useProgressionActions } from '@/composables/useProgressionActions'
import { ELEMENT_ORDER, ELEMENT_LABELS } from '@/core/element/ElementLabels'
import { viewBranchTags } from '@/core/progression/NodeBranchViews'
import { CAST_LEVELING_THRESHOLDS } from '@/core/skill/CastLeveling'
import { MORTAL_PRECURSOR_SKILL_IDS } from '@/core/skill/MortalPrecursors'
import { NODE_ICON_MANIFEST, SKILL_ICON_MANIFEST } from '@/data/skill/SkillIconManifest'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import { SPELL_KIT_IDS } from '@/data/skill/Skills'
import { betaMortalTreeViewTags } from '@/core/betaScopeSkillDomain'
import { getNextLevelCost } from '@/core/progression/NodeSystem'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import { formatStat, statLabel } from '@/core/stats/StatLabels'
import type { StatType } from '@/core/stats/StatTypes'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { layoutRadialGraph } from '@/components/panels/skill-path/skillGraphLayout'
import type { RadialGraphPosition } from '@/components/panels/skill-path/skillGraphLayout'
import { BUFF_REGISTRY } from '@/data/buff/BuffRegistry'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import type { BetaSkillTreeNode } from '@/core/betaScopeSkillDomain'
import type { ElementType } from '@/core/element/ElementType'
import type { NodePrerequisite, ProgressionNode } from '@/core/progression/ProgressionNode'
import type { Skill } from '@/core/skill/Skill'
import SkillFidelityScene from './fidelity/SkillFidelityScene.vue'
import { edgeLinkLength } from './fidelity/skillUi'
import type { SkillUiEdge, SkillUiElement, SkillUiNode } from './fidelity/skillUi'

const CANVAS_W = 710
const CANVAS_H = 445
const FALLBACK_ICON = resolveAssetUrl('/assets/ui/huyen-kim/symbols/skill.svg')
// Design-mode anchor geometry (element trees): parked authored nodes
// form a left column; the root sits center-top with the 3 skill
// children one pipe-link below it (basic bottom-left, the sealed
// top seat bottom-center, special bottom-right).
const PARKED_X = 90
const PARKED_TOP = 90
const PARKED_STEP = 74
const MAIN_CX = 420
const MAIN_ROOT_Y = 150
// Children sit exactly one pipe-link from the root: side children fan
// out at ~35 degrees from vertical, the middle child drops straight
// down (edgeLinkLength(1) ~= 321 for the uniform-scaled pipe art).
const CHILD_D = edgeLinkLength(1)
const CHILD_DX = Math.sin(Math.PI * 35 / 180) * CHILD_D
const CHILD_DY = Math.cos(Math.PI * 35 / 180) * CHILD_D

// Skill-seat ids for Minh's design tree (declared up top - the fire
// design tables below reference them).
const DESIGN_BASIC_ID = 'design_basic_skill'
const ULTIMATE_NODE_ID = 'design_ultimate_placeholder'

// Fire branch wiring (Minh ruling 2026-10-07): the 3 skill seats are
// the main-branch anchors. The basic seat grows the Ly Hoa hit chain
// that ends in the two mutex capstones; the Tam Muoi special seat
// (a real node) fans its three trade children; the sealed ultimate
// stays a stub. The two unattached side branches sit off the root:
// mana (Ho The) left, Hoa The + mastery leaves right. tinh_thong_hoa
// is a realm grant and carries no edge.
const FIRE_DESIGN_POS: Readonly<Record<string, RadialGraphPosition>> = {
  hoa_linh_ngo: { x: 360, y: 270 },
  // Mana branch - left of the root.
  ho_the_mon: { x: 235, y: 270 },
  nguyen_kinh: { x: 150, y: 235 },
  linh_chuong: { x: 150, y: 310 },
  the_diem_kinh: { x: 75, y: 235 },
  // Standalone leaves - right of the root; tinh_thong sits apart (no edge).
  hoa_the: { x: 485, y: 255 },
  fire_ailment_mastery: { x: 515, y: 320 },
  tinh_thong_hoa: { x: 555, y: 170 },
  // Ly Hoa main chain - domain-gated off the element root (Diem Uy's
  // prereq is hoa_linh_ngo, not the basic seat), so the chain drops
  // straight under the root and curves left to the capstone legs.
  hoa_diem_uy: { x: 365, y: 372 },
  hoa_hoa_nhan: { x: 340, y: 445 },
  hoa_pha_giap_diem: { x: 300, y: 510 },
  hoa_bao_diem: { x: 255, y: 565 },
  hoa_phe_diem: { x: 215, y: 620 },
  // Tu Diem leg (left) and Tan Diem leg (right) off the chain end.
  hoa_an_sau: { x: 160, y: 665 },
  hoa_nhiet_keo: { x: 110, y: 705 },
  fire_basic_hoa_tu_diem: { x: 60, y: 745 },
  hoa_diem_chuan: { x: 270, y: 665 },
  hoa_diem_tham: { x: 320, y: 705 },
  fire_basic_hoa_tan_diem: { x: 375, y: 745 },
  // Tam Muoi lane - fan below the special seat (445, 370).
  linh_ngo_tam_muoi_chan_hoa: { x: 445, y: 370 },
  ngu_hoa: { x: 413, y: 445 },
  ngu_viem_tam: { x: 465, y: 458 },
  ngu_viem_y: { x: 515, y: 445 },
}
const FIRE_DESIGN_EDGES: ReadonlyArray<readonly [string, string]> = [
  ['hoa_linh_ngo', DESIGN_BASIC_ID],
  ['hoa_linh_ngo', ULTIMATE_NODE_ID],
  ['hoa_linh_ngo', 'linh_ngo_tam_muoi_chan_hoa'],
  ['hoa_linh_ngo', 'ho_the_mon'],
  ['hoa_linh_ngo', 'hoa_the'],
  ['hoa_linh_ngo', 'fire_ailment_mastery'],
  // The Ly Hoa chain is domain-gated off the root, not the seat (seats
  // are skill grants, not progression nodes) - drawing seat->Diem Uy
  // would claim a dependency the game never enforces.
  ['hoa_linh_ngo', 'hoa_diem_uy'],
  ['hoa_diem_uy', 'hoa_hoa_nhan'],
  ['hoa_hoa_nhan', 'hoa_pha_giap_diem'],
  ['hoa_pha_giap_diem', 'hoa_bao_diem'],
  ['hoa_bao_diem', 'hoa_phe_diem'],
  ['hoa_phe_diem', 'hoa_an_sau'],
  ['hoa_an_sau', 'hoa_nhiet_keo'],
  ['hoa_nhiet_keo', 'fire_basic_hoa_tu_diem'],
  ['hoa_phe_diem', 'hoa_diem_chuan'],
  ['hoa_diem_chuan', 'hoa_diem_tham'],
  ['hoa_diem_tham', 'fire_basic_hoa_tan_diem'],
  ['linh_ngo_tam_muoi_chan_hoa', 'ngu_hoa'],
  ['linh_ngo_tam_muoi_chan_hoa', 'ngu_viem_tam'],
  ['linh_ngo_tam_muoi_chan_hoa', 'ngu_viem_y'],
  ['ho_the_mon', 'nguyen_kinh'],
  ['ho_the_mon', 'linh_chuong'],
  ['nguyen_kinh', 'the_diem_kinh'],
]

// Element kit specials (kit[1] - Ngu Diem / Van Moc Sinh Co / ...) are the
// branch's passive leaf: their node seats get the passive frame.
const ELEMENT_SPECIAL_SKILL_IDS = new Set(Object.values(SPELL_KIT_IDS).map((pair) => pair[1]))

const { t } = useI18n()
const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
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
// ways their declared tree tags; a pre-initiation mortal admits only the
// branches carrying a renderable info anchor (betaMortalTreeViewTags -
// the 'tien_than' precursor trio) - every node there still renders its
// 'initiation-pending' lock.
const pathwayRows = computed(() => {
  const mortalTags = skillTree.value.mortal
    ? betaMortalTreeViewTags(allNodes.value)
    : null
  const mortalView = mortalTags !== null && mortalTags.size > 0
  const spell = mortalView || (elementCasting.value && wayNodeTreeTag.value === undefined)
  let tags: ReadonlySet<string> | null = null
  if (mortalView) {
    tags = mortalTags
  } else if (spell) {
    tags = new Set<ElementType>(ELEMENT_ORDER)
  } else if (wayNodeTreeTag.value !== undefined) {
    tags = new Set<string>(viewBranchTags(wayNodeTreeTag.value))
  }
  if (tags === null) return { spell, rows: new Map<string, BetaSkillTreeNode>(), nodes: [] as ProgressionNode[] }

  const nodes = allNodes.value.filter((node) => {
    const tag = nodeViewTag(node)
    const row = rowsById.value.get(node.id)
    // Minh ruling: a mortal sees only the precursor seat of the dao lo
    // picked at creation (mortalBasicSkillId) - sibling precursors stay
    // hidden entirely, not just locked. A missing pick (corrupt/dev
    // save) falls back to showing every seat rather than none.
    if (mortalView && node.infoSkillId !== undefined && player.$state.mortalBasicSkillId !== undefined) {
      if (node.infoSkillId !== player.$state.mortalBasicSkillId) return false
    }
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

// Minh ruling: the Cong Phap panel owns one tree design - every dao
// lo branch renders the same paper tree, only the node set swaps.

// Brief "node id mid-unlock" flag - lets the constellation run the
// parent->child energy travel + arrival pulse once per purchase.
const unlockingId = ref('')
let unlockTimer: number | undefined
function flagUnlock(id: string) {
  unlockingId.value = id
  if (unlockTimer !== undefined) clearTimeout(unlockTimer)
  unlockTimer = window.setTimeout(() => {
    unlockTimer = undefined
    unlockingId.value = ''
  }, 1500)
}
onBeforeUnmount(() => { if (unlockTimer !== undefined) clearTimeout(unlockTimer) })

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

const layout = computed(() => {
  const base = layoutRadialGraph(graph.value.entries.map((entry) => ({ id: entry.node.id, parentId: entry.parentId, depth: entry.depth })))
  if (skillTree.value.mortal || graph.value.entries.length <= 1) return base

  // Minh's design-mode ruling (2026-10): the element tree parks every
  // authored node in a side column awaiting re-attachment, and anchors
  // the design on 3 hero skill nodes (basic / special / sealed) in
  // the center. Fire is further wired (FIRE_DESIGN_POS/EDGES): the 3
  // skill seats are the main-branch anchors - the Ly Hoa hit chain
  // grows off the basic seat and ends in the two mutex capstones,
  // the special carries its three Tam Muoi children, and the two
  // unattached side branches sit left/right of the root.
  const positions = new Map<string, RadialGraphPosition>()
  const specialId = graph.value.entries.find((entry) =>
    entry.row.grantsSkillIds.some((id) => ELEMENT_SPECIAL_SKILL_IDS.has(id)),
  )?.node.id

  const rootId = graph.value.entries.find((entry) => entry.depth === 0)?.node.id
  if (committedElement.value === 'fire') {
    let parkIndex = 0
    for (const entry of graph.value.entries) {
      const authored = FIRE_DESIGN_POS[entry.node.id]
      positions.set(entry.node.id, authored ?? { x: PARKED_X, y: PARKED_TOP + parkIndex++ * PARKED_STEP })
    }
    positions.set(DESIGN_BASIC_ID, { x: 290, y: 370 })
    positions.set(ULTIMATE_NODE_ID, { x: 360, y: 175 })
  } else {
    const parked = graph.value.entries.filter((entry) => entry.depth !== 0 && entry.node.id !== specialId)
    parked.forEach((entry, i) => positions.set(entry.node.id, { x: PARKED_X, y: PARKED_TOP + i * PARKED_STEP }))
    if (rootId !== undefined) positions.set(rootId, { x: MAIN_CX, y: MAIN_ROOT_Y })
    if (specialId !== undefined) positions.set(specialId, { x: MAIN_CX + CHILD_DX, y: MAIN_ROOT_Y + CHILD_DY })
    positions.set(DESIGN_BASIC_ID, { x: MAIN_CX - CHILD_DX, y: MAIN_ROOT_Y + CHILD_DY })
    positions.set(ULTIMATE_NODE_ID, { x: MAIN_CX, y: MAIN_ROOT_Y - CHILD_D })
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x); maxX = Math.max(maxX, pos.x)
    minY = Math.min(minY, pos.y); maxY = Math.max(maxY, pos.y)
  }
  const MARGIN = 80
  const size = Math.max(maxX - minX, maxY - minY) + 2 * MARGIN
  const shiftX = size / 2 - (minX + maxX) / 2
  const shiftY = size / 2 - (minY + maxY) / 2
  for (const pos of positions.values()) { pos.x += shiftX; pos.y += shiftY }
  return { positions, size }
})

// Zoom-to-fit: coordinates stay in the layout's natural square space;
// the tree scales the whole graph (cards included) into the viewport.
// Minh ruling: a mortal owns exactly one precursor seat, so it renders
// centered (the radial layout already anchors a lone root at the core)
// and 3x rather than fit-shrunk.
const mortalSolo = computed(() => skillTree.value.mortal && graph.value.entries.length === 1)
// Design-mode positions can place nodes beyond the authored layout
// square - the tree reports its true rendered extent so the fit still
// keeps every node inside the paper backdrop.
const renderExtent = ref(0)
const graphSize = computed(() => Math.max(layout.value.size > 0 ? layout.value.size : CANVAS_W, renderExtent.value))
const graphFit = computed(() =>
  mortalSolo.value ? 3 : graphSize.value > 0 ? Math.min(1, CANVAS_H / graphSize.value) : 1,
)

function nodeName(id: string): string {
  return allNodes.value.find((node) => node.id === id)?.name ?? id
}
function realmName(id: string): string {
  try { return getCurrentRealm(id as never).name } catch { return id }
}
function skillName(id: string): string {
  // Resolve from the template registry first - skillManager only knows
  // skills the player owns, so unowned foreign-element ids leaked raw.
  return gameManager.catalogOps.getSkillTemplate(id)?.name
    ?? gameManager.skillManager.get(id)?.name
    ?? id
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

// Node art (NODE_ICON_MANIFEST) outranks the granted-skill icon and
// the element orb - drawn seats carry their own identity.
function nodeArtIcon(nodeId: string): string | undefined {
  const path = NODE_ICON_MANIFEST[nodeId]
  return path !== undefined ? resolveAssetUrl(path) : undefined
}

// Skill-granting seats render the hand-drawn skill icon
// (grantsSkillIds -> display meta iconKey -> SKILL_ICON_MANIFEST ->
// /assets/skills/<key>.png); stat-only nodes keep the element orb.
function grantIcon(row: BetaSkillTreeNode): string | undefined {
  for (const skillId of row.grantsSkillIds) {
    const key = turnSkillDisplayMetaOf(skillId)?.iconKey
    const path = key !== undefined ? SKILL_ICON_MANIFEST[key] : undefined
    if (path !== undefined) return resolveAssetUrl(path)
  }
  return undefined
}

// Detail-card stat rows (Minh's block order: level -> xp -> stats ->
// conditions -> description). Reads the live Skill template's trigger
// actions + legacy effects so the card reports real combat numbers.
function skillStatRows(skill: Skill | undefined): { id: string; label: string; value: string }[] {
  if (skill === undefined) return []
  const rows: { id: string; label: string; value: string }[] = []
  const push = (label: string, value: string) => rows.push({ id: `stat-${rows.length}`, label, value })
  const damageSuffix = (damageType: 'physical' | 'primordial' | undefined) =>
    damageType === 'physical'
      ? ` ${t('skill.damageTypePhysical')}`
      : damageType === 'primordial'
        ? ` ${t('skill.damageTypePrimordial')}`
        : ''
  const ailmentLine = (buffId: string, chance: number | undefined) => {
    const name = BUFF_REGISTRY.tryGet(buffId)?.name ?? buffId
    const pct = chance === undefined ? '100%' : `${Math.round(chance * 100)}%`
    push(t('skill.statAilmentChance'), `${pct} ${name}`)
  }
  for (const binding of skill.triggers ?? []) {
    for (const action of binding.actions) {
      if (action.type === 'dealDamage') {
        push(t('skill.statDamage'), `x${formatNumber(action.value ?? 0)}${damageSuffix(action.damageType)}`)
      } else if (action.type === 'applyBuff' || action.type === 'applyDebuff') {
        ailmentLine(action.buffId, action.chance)
      } else if (action.type === 'heal') {
        push(t('skill.statHeal'), `x${formatNumber(action.value ?? 0)}`)
      }
    }
  }
  for (const effect of skill.effects) {
    if (effect.type === 'damage') {
      push(t('skill.statDamage'), `x${formatNumber(effect.value ?? 0)}${damageSuffix(effect.damageType)}`)
      if (effect.ailmentChance !== undefined && effect.buffId !== undefined) {
        ailmentLine(effect.buffId, effect.ailmentChance)
      }
    } else if (effect.type === 'debuff' && effect.buffId !== undefined) {
      ailmentLine(effect.buffId, effect.ailmentChance)
    } else if (effect.type === 'heal') {
      push(t('skill.statHeal'), `x${formatNumber(effect.value ?? 0)}`)
    }
  }
  if (skill.execution?.kind === 'cooldown') {
    push(t('skill.statCooldown'), `${formatNumber(skill.cooldown)}s`)
  }
  if (skill.cost !== undefined && skill.resourceType !== undefined && skill.resourceType !== 'none') {
    push(t('skill.statCost'), `${formatNumber(skill.cost)} ${skill.resourceType}`)
  }
  return rows
}

// Info-anchor presentation: the node's seat renders the LIVE skill
// state (template + core level + cast progress) and never an action -
// the skill's own channel owns leveling, Insight is not an input.
function infoUiNode(node: ProgressionNode, row: BetaSkillTreeNode, entry: GraphEntry): SkillUiNode {
  const skillId = row.infoSkillId!
  const skill = gameManager.catalogOps.getSkillTemplate(skillId)
  // The lit seat is the basic the mortal actually fights with (beta
  // fixes the pick to linh_bao); the other learned-but-unpickable
  // precursors stay visually locked - readable, never selectable.
  const isActiveBasic = player.$state.mortalBasicSkillId === skillId
  const coreLevel = gameManager.progressionOps.getSkillLevel(skillId, player.$state)
  const maxLevel = gameManager.progressionOps.getSkillCoreMaxLevel(skillId)
  const casts = player.$state.skillCastCounts?.[skillId] ?? 0
  const thresholds = CAST_LEVELING_THRESHOLDS[skillId]
  let nextThreshold: number | undefined
  if (thresholds !== undefined && coreLevel < maxLevel) {
    nextThreshold = coreLevel >= 2 ? thresholds.lv3 : thresholds.lv2
  }
  const position = layout.value.positions.get(node.id) ?? { x: 0, y: 0 }

  return {
    id: node.id,
    name: skill?.name ?? row.name,
    icon:
      SKILL_ICON_MANIFEST[skillId] !== undefined
        ? resolveAssetUrl(SKILL_ICON_MANIFEST[skillId])
        : nodeIcon(node),
    x: position.x,
    y: position.y,
    prominent: entry.depth === 0,
    emphasis: 'normal',
    level: `${coreLevel} / ${maxLevel}`,
    levelCurrent: coreLevel,
    levelMax: maxLevel,
    state: isActiveBasic ? 'learned' : 'locked',
    description: skill?.description ?? row.description ?? '',
    experience:
      nextThreshold !== undefined
        ? `${formatNumber(casts)} / ${formatNumber(nextThreshold)}`
        : formatNumber(casts),
    stats: skillStatRows(skill),
    conditions: [t('panels.skillPath.nodeInspector.infoOnly')],
    costLabel: '',
    actionLabel: '',
    actionDisabled: true,
    actionHint: '',
    frameKind: (MORTAL_PRECURSOR_SKILL_IDS as readonly string[]).includes(skillId)
      ? (coreLevel >= 3 ? 'parent' : coreLevel >= 2 ? 'main' : 'sub')
      : undefined,
  }
}

// Grant-seat presentation: realm-reward nodes render readable -
// their level arrives only via breakthrough grants, so the inspector
// shows the seat + level and never an Insight action.
function grantUiNode(node: ProgressionNode, row: BetaSkillTreeNode, entry: GraphEntry): SkillUiNode {
  const owned = row.level >= 1
  const position = layout.value.positions.get(node.id) ?? { x: 0, y: 0 }

  return {
    id: node.id,
    name: row.name,
    icon: nodeArtIcon(node.id) ?? grantIcon(row) ?? nodeIcon(node),
    x: position.x,
    y: position.y,
    prominent: entry.depth === 0,
    emphasis: 'normal',
    level: `${row.level} / ${row.maxLevel}`,
    levelCurrent: row.level,
    levelMax: row.maxLevel,
    state: owned ? 'learned' : 'locked',
    description: row.description ?? '',
    experience: '',
    stats: row.grantsSkillIds.map((skillId, i) => ({ id: `grant-${i}`, label: t('skill.grants'), value: skillName(skillId) })),
    conditions: [t('panels.skillPath.nodeInspector.grantOnly')],
    costLabel: '',
    actionLabel: '',
    actionDisabled: true,
    actionHint: '',
    nextCost: null,
    levelEffects: buildLevelEffects(node, row),
  }
}

// 'Hieu Qua' ladder (Minh 2026-10-07): each level line carries the real
// cumulative contribution that level buys - numbers folded from
// node.effect (statModifiers + cast-scoped/cooldown deltas), not prose.
// A 'once' contrib (e.g. the Ngu Viem +1-CD trade) lands only on the
// level-1 line since ownership applies it once.
interface LevelContrib {
  label: string
  value: number
  stat?: StatType
  turns?: boolean
  once?: boolean
}
function levelContribs(node: ProgressionNode): LevelContrib[] {
  const out: LevelContrib[] = []
  for (const mod of node.effect?.statModifiers ?? []) {
    out.push({ label: statLabel(mod.stat), value: mod.perLevelFlat ?? mod.flat ?? 0, stat: mod.stat })
  }
  for (const spec of node.effect?.skillDefinitionModifiers ?? []) {
    const sName = skillName(spec.skillId)
    for (const cm of spec.castStatModifiers ?? []) {
      out.push({ label: `${sName} · ${statLabel(cm.stat)}`, value: cm.perLevel, stat: cm.stat })
    }
    if (spec.cooldownTurnsDelta?.perLevel !== undefined) {
      out.push({ label: `${sName} · ${t('skill.statCooldown')}`, value: spec.cooldownTurnsDelta.perLevel, turns: true })
    }
    if (spec.cooldownTurnsDelta?.flat !== undefined) {
      out.push({ label: `${sName} · ${t('skill.statCooldown')}`, value: spec.cooldownTurnsDelta.flat, turns: true, once: true })
    }
  }
  return out
}
function buildLevelEffects(
  node: ProgressionNode,
  row: BetaSkillTreeNode,
): SkillUiNode['levelEffects'] {
  const contribs = levelContribs(node)
  if (!contribs.length) return undefined
  return Array.from({ length: row.maxLevel }, (_, i) => {
    const lv = i + 1
    const parts = contribs
      .filter((c) => !c.once || lv === 1)
      .map((c) => {
        const v = c.value * (c.once === true ? 1 : lv)
        if (c.turns === true) return `${c.label} ${v > 0 ? '+' : ''}${v} hiệp`
        const fmt = c.stat !== undefined ? formatStat(c.stat, v) : `${v}`
        return `${c.label} ${v >= 0 ? '+' : ''}${fmt}`
      })
    return { lv, text: parts.join(' · '), met: lv <= row.level }
  })
}

function toUiNode(entry: GraphEntry): SkillUiNode {
  const { node, row } = entry
  if (row.infoSkillId !== undefined) return infoUiNode(node, row, entry)
  if (row.rewardOnly === true) return grantUiNode(node, row, entry)
  const owned = row.level >= 1
  // Minh ruling (2026-10-07): only unmet conditions read as locked.
  // 'available' (gates met, insight short) is merely not-yet-activated -
  // dimmed, no lock icon.
  const state: SkillUiNode['state'] = owned
    ? 'learned'
    : row.state === 'purchasable' || row.state === 'available'
      ? 'available'
      : 'locked'
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
    }
    // conditions[0] is already the rail's first lock line - the action
    // hint must not repeat it under the button.
  } else {
    const maxed = row.nextLevelCost === null && !row.canUpgrade
    actionLabel = maxed
      ? t('panels.skillPath.nodeInspector.status.maxed')
      : t('panels.skillPath.nodeInspector.actions.upgrade')
    if (!maxed) {
      costLabel = t('panels.skillPath.nodeInspector.cost.upgrade', { cost: row.nextLevelCost ?? 0 })
      actionDisabled = !row.canUpgrade || inBattle.value
    } else {
      actionDisabled = true
    }
  }

  const position = layout.value.positions.get(node.id) ?? { x: 0, y: 0 }

  return {
    id: node.id,
    name: row.name,
    icon: nodeArtIcon(node.id) ?? grantIcon(row) ?? nodeIcon(node),
    x: position.x,
    y: position.y,
    prominent: entry.depth === 0,
    emphasis: 'normal',
    level: `${row.level} / ${row.maxLevel}`,
    levelCurrent: row.level,
    levelMax: row.maxLevel,
    state,
    description: row.description ?? '',
    experience: '',
    stats: row.grantsSkillIds.map((skillId, i) => ({ id: `grant-${i}`, label: t('skill.grants'), value: skillName(skillId) })),
    conditions,
    costLabel,
    actionLabel,
    actionDisabled,
    actionHint,
    // Cam Ngo for the NEXT authored level - row.nextLevelCost is null
    // whenever a level gate shrinks effectiveMaxLevel, but the Insight
    // price still exists, so read the authored curve directly.
    nextCost: row.level < row.maxLevel ? getNextLevelCost(node, row.level) : null,
    levelEffects: buildLevelEffects(node, row),
    frameKind: row.grantsSkillIds.some((id) => ELEMENT_SPECIAL_SKILL_IDS.has(id))
      ? 'parent'
      : row.role === 'keystone'
        ? 'keystone'
        : undefined,
  }
}

// Skill-seat placeholders for Minh's design tree: the element basic
// (Ly Hoa Thuat) sits as a learned child of the root, and the sealed
// top seat stays locked until its skill is authored. Element
// trees only - the mortal tree keeps the radial layout.
function basicUiNode(): SkillUiNode {
  const position = layout.value.positions.get(DESIGN_BASIC_ID) ?? { x: 0, y: 0 }
  const skillId = committedElement.value !== undefined ? SPELL_KIT_IDS[committedElement.value][0] : ''
  const skill = skillId !== '' ? gameManager.catalogOps.getSkillTemplate(skillId) : undefined
  return {
    id: DESIGN_BASIC_ID,
    name: skill?.name ?? DESIGN_BASIC_ID,
    icon: skillId !== '' ? (resolveAssetUrl(SKILL_ICON_MANIFEST[skillId] ?? '') || FALLBACK_ICON) : FALLBACK_ICON,
    x: position.x,
    y: position.y,
    prominent: false,
    emphasis: 'normal',
    level: '1 / 1',
    levelCurrent: 1,
    levelMax: 1,
    state: 'learned',
    description: skill?.description ?? '',
    experience: '',
    stats: [],
    conditions: [],
    costLabel: '',
    actionLabel: '',
    actionDisabled: true,
    actionHint: '',
    frameKind: 'main',
  }
}
function ultimateUiNode(): SkillUiNode {
  const position = layout.value.positions.get(ULTIMATE_NODE_ID) ?? { x: 0, y: 0 }
  return {
    id: ULTIMATE_NODE_ID,
    name: t('skill.designMode.ultimatePlaceholder'),
    icon: FALLBACK_ICON,
    x: position.x,
    y: position.y,
    prominent: false,
    emphasis: 'normal',
    level: '0 / 1',
    levelCurrent: 0,
    levelMax: 1,
    state: 'locked',
    description: '',
    experience: '',
    stats: [],
    conditions: [t('skill.designMode.ultimateLocked')],
    costLabel: '',
    actionLabel: '',
    actionDisabled: true,
    actionHint: '',
    frameKind: 'main',
  }
}
const nodes = computed<SkillUiNode[]>(() => {
  const list = graph.value.entries.map(toUiNode)
  if (!skillTree.value.mortal && committedElement.value !== undefined && graph.value.entries.length > 1) {
    list.push(basicUiNode(), ultimateUiNode())
  }
  return list
})
const edges = computed<SkillUiEdge[]>(() => {
  if (skillTree.value.mortal) {
    return graph.value.entries.filter((entry) => entry.parentId !== null).map((entry) => ({ from: entry.parentId!, to: entry.node.id }))
  }
  const rootId = graph.value.entries.find((entry) => entry.depth === 0)?.node.id
  if (committedElement.value === 'fire' && rootId !== undefined) {
    // Fire design wiring - see FIRE_DESIGN_EDGES. Only emit edges whose
    // both ends are actually rendered (node rows or the 2 skill seats).
    const ids = new Set<string>([DESIGN_BASIC_ID, ULTIMATE_NODE_ID, ...graph.value.entries.map((entry) => entry.node.id)])
    return FIRE_DESIGN_EDGES.filter(([from, to]) => ids.has(from) && ids.has(to)).map(([from, to]) => ({ from, to }))
  }
  // Design mode: exactly 3 pipelines, root -> each skill child.
  const specialId = graph.value.entries.find((entry) =>
    entry.row.grantsSkillIds.some((id) => ELEMENT_SPECIAL_SKILL_IDS.has(id)),
  )?.node.id
  if (rootId === undefined) return []
  return [
    { from: rootId, to: DESIGN_BASIC_ID },
    { from: rootId, to: ULTIMATE_NODE_ID },
    ...(specialId !== undefined ? [{ from: rootId, to: specialId }] : []),
  ]
})

const selectedId = ref<string | null>(null)
watch(nodes, (list) => {
  if (selectedId.value && list.some((node) => node.id === selectedId.value)) return
  selectedId.value = list.find((node) => node.prominent)?.id ?? list[0]?.id ?? null
}, { immediate: true })
const selected = computed(() => nodes.value.find((node) => node.id === selectedId.value) ?? null)

const insightLabel = computed(() => `${t('panels.nodeTree.labels.insight')}: ${formatNumber(player.skillInsight)}`)

function onSelectElement(id: string) {
  unlockingId.value = ''
  selectedElement.value = id as ElementType
}
function onSelect(id: string) {
  selectedId.value = id
}
function onUpgrade(id: string) {
  const row = rowsById.value.get(id)
  if (!row || inBattle.value) return
  const ok = row.level >= 1 ? (row.canUpgrade && upgradeNode(id)) : (row.state === 'purchasable' && purchaseNode(id))
  if (ok) flagUnlock(id)
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
  unlockingId.value = ''
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
      :notice="notice"
      :identity="wayIdentity"
      :insight-label="insightLabel"
      :respec-disabled="respecDisabled"
      :graph-size="graphSize"
      :graph-fit="graphFit"
      :unlocking="unlockingId"
      @select="onSelect"
      @element="onSelectElement"
      @upgrade="onUpgrade"
      @extent="renderExtent = $event"
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
