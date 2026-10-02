<script setup lang="ts">
// Tach khoi LoadoutManager.vue (2026-08-20, "Ky nang va tam phap gio
// can tach ra thanh 2 panel moi, khong phu thuoc vao left panel nua")
// + redesign theo tien-hiep-idle/Plans/PhapTuPanel (header/chon ky
// nang/chi tiet/Loadout). Bo cuc 3 cot AP DUNG CHO MOI PATH (ke ca
// Pham Nhan/Kiem Tu, khong rieng Phap Tu) - chi khac NOI DUNG cot
// giua vi Kiem Tu/Pham Nhan khong co Node Tree phan nhanh:
//   co tree   -> giua: NodeTreePanel (cay that cua skill/branch do)
//   khac      -> giua: SkillDetailView (chi tiet skill dang chon, doc only)
// Cot trai dung chung SkillPathList cho moi path; cot phai
// (SkillRoleStrip, "Active Arts") and
// NodeInspector (bottom, CHI co y nghia khi co node de mua) khong doi.
//
// ElementLoadoutPicker.vue (equip Hanh vao combat) da GO HAN (2026-08-20,
// yeu cau "du thua, khong co tac dung gi") - no trung chuc nang voi
// SkillRoleStrip: the 3 fixed roles from getResolvedSkillRoles are what
// actually runs in combat (see the role auto-cast scheduler in
// TurnBattleSystem), "equipping a whole Element" adds no further meaning.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import NodeTreePanel from './skill-path/NodeTreePanel.vue'
import NodeInspector from './skill-path/NodeInspector.vue'
import SkillPathList from './skill-path/SkillPathList.vue'
import SkillDetailView from './skill-path/SkillDetailView.vue'
import NativeCoreDetail from './skill-path/NativeCoreDetail.vue'
import SkillRoleStrip from './skill-path/SkillRoleStrip.vue'
import SkillWayCard from '@/components/scenes/skill/SkillWayCard.vue'
import SkillElementTabs from '@/components/scenes/skill/SkillElementTabs.vue'
import SkillTreeCanvas from '@/components/scenes/skill/SkillTreeCanvas.vue'
import SkillModeTabs from '@/components/scenes/skill/SkillModeTabs.vue'
import SkillDetailRail from '@/components/scenes/skill/SkillDetailRail.vue'
import SkillInsightChip from '@/components/scenes/skill/SkillInsightChip.vue'
import { CULTIVATION_PATH_MODULES } from '@/core/player/CultivationPathKit'
import { betaSkillAdmitted } from '@/core/betaScopeSkillDomain'
import { isBetaWay } from '@/core/betaScope'
import type { BetaSkillTreeNode } from '@/core/betaScopeSkillDomain'
import { ELEMENT_ORDER, ELEMENT_LABELS, ELEMENT_COLOR_VARS } from '@/core/element/ElementLabels'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'
import type { ElementType } from '@/core/element/ElementType'
import type { Skill } from '@/core/skill/Skill'
import type { SkillPathEntry, NativeSkillPathEntry } from './skill-path/SkillPathEntry'
import { NATIVE_CORE_SKILL_IDS } from '@/data/progression/SkillCoreNodes'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import ImperialScrollScene from '@/components/common/ImperialScrollScene.vue'
import { useAudioStore } from '@/stores/audio'

const { t } = useI18n()
const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// Kiem Tu also has a real Node Tree (KiemTuNodes.ts). purchaseNode() is
// only reachable through NodeInspector.vue, which renders when showTree.
//
// The Tu Reimagined (T22) - body/hidden_body moi path co 1 cay that
// (TheTuNodes/TheTuAnNodes) duoi branchTag trung path id: single-tag
// pass-through view qua viewBranchTags(), toan bo root (mutex cho Hien,
// non-mutex cho An) render trong cung mot tree.
//
// BETA FE-CONTRACT (sec.4, relayed scope): the canonical skill-tree
// read-model (progressionOps.betaSkillTreeFor) resolves every
// progression predicate this panel used to derive - way name/tag,
// committed element, the casting capability, per-node purchased /
// purchasable state. The panel reads the model; it never calls
// NodeSystem/CultivationPathSystem predicates itself.
const skillTree = computed(() => {
  stateVersion.value

  // The full registry catalog - the way-tagged trees (kiem_pho/body/
  // hidden_body) resolve rows for any selection, not just phap-tu.
  return gameManager.progressionOps.betaSkillTreeFor(
    player.$state,
    gameManager.nodeRegistry.getAll(),
  )
})

// P1 - tree selection resolves on the WAY's declared nodeTreeTag, never
// a concrete way predicate: kiem hien -> 'kiem_pho', ngu -> 'ngu_kiem',
// body hien -> 'body', ung_the -> 'hidden_body'. Ways without a fixed
// tree (spell_pathway - element-driven; ngo_dao - none) declare no tag.
const wayNodeTreeTag = computed(() => skillTree.value.wayNodeTreeTag)

// P7-M7 - way identity line: the committed way's self-describing name
// (e.g. 'Kiem Tu - Ngu Kiem Tam Kinh'), or Phan Nhan for a way-less
// mortal - model-resolved.
const wayIdentity = computed(
  () => skillTree.value.wayName ?? t('panels.skillPath.mortalName'),
)

// Scene 07 way-card: the base path display name rides beside the way
// identity (ref's "Phap Tu * Hoa Hanh" line). Mortal shows none, and a
// carried dormant way/path brands nothing - the chip renders only when
// the committed way is beta-admitted, or when no way is committed but
// the player's path module still owns a beta-admitted way (derived via
// CULTIVATION_PATH_MODULES[path].ways + isBetaWay - never a literal).
const pathName = computed(() => {
  const way = skillTree.value.way
  const pathModule = player.cultivationPath
    ? CULTIVATION_PATH_MODULES[player.cultivationPath]
    : undefined

  if (pathModule === undefined) return null
  if (way !== null) return isBetaWay(way) ? pathModule.name : null

  return Object.keys(pathModule.ways).some((wayId) => isBetaWay(wayId))
    ? pathModule.name
    : null
})

const hasElementalCasting = computed(() => skillTree.value.elementCasting)

const showTree = computed(
  () =>
    // M4 (R6): the Phap Tu element tree is spell_pathway machinery - the
    // 'spell.elemental_casting' capability is the gate - a collapsed
    // ('spell','hidden_spell_pathway') player owns no element branches.
    hasElementalCasting.value || wayNodeTreeTag.value !== undefined,
)

// ---- Nhanh spell (Hanh -> Node Tree) ----
// Phap Tu Reimagine: element tabs visible for spell -- the
// element-root pick happens IN the tree (element-only commit), so the
// tree must render before any elemental skill is learned. Default tab
// = the committed element once the element axis resolves one.
const committedElement = computed(() => skillTree.value.element ?? undefined)

// BETA FE-CONTRACT sec.4: the tab row renders only the elements the
// tree model still renders - a branch whose nodes are all
// 'scope-hidden' (a non-selected element after commit, via
// 'other-element-branch') gets no tab at all. Locked-but-visible
// nodes keep their element's tab; the casting gate still owns whether
// the row appears.
const visibleElementTabs = computed<ElementType[]>(() => {
  const renderable = new Set<ElementType>()

  for (const node of skillTree.value.nodes) {
    if (node.elementTag !== undefined && node.state !== 'scope-hidden') {
      renderable.add(node.elementTag)
    }
  }

  return ELEMENT_ORDER.filter((element) => renderable.has(element))
})

const selectedBranch = ref<ElementType>(committedElement.value ?? 'fire')

watch(
  committedElement,
  element => {
    if (element) {
      selectedBranch.value = element
    }
  },
)

// ---- Nhanh sword (Kiem Tu Reimagined spec sec.6) - ONE tree, two
// branchTags rendered together: 'kiem_pho' (orb branches) + 'ngu_kiem'
// (hidden root + Ngu branch). Node-level visibility is mode-filtered
// inside NodeTreePanel - this tag only selects WHICH view; the re-
// imagined tree replaces the retired kiem_tran/bat_kiem route split. ----

const selectedNode = ref<ProgressionNode | null>(null)
const selectedNodePurchased = ref(false)
const selectedNodePurchasable = ref(false)

function onSelectBranch(element: ElementType) {
  selectedBranch.value = element
  selectedNode.value = null
}

// Skill Node unlock animation (2026-08-21, Plans/SkillNode) - NodeInspector
// emit 'unlocked' NGAY SAU khi purchaseNode() thanh cong (KHONG doi
// logic mua) - chi chuyen tiep id + so thu tu (seq) tang dan xuong
// NodeTreePanel.vue de no tu chay animation connection->node. `seq`
// dam bao watch() o NodeTreePanel luon thay gia tri MOI ke ca khi mua
// lien tiep cung 1 node id (ve ly thuyet khong xay ra - moi node chi
// mua 1 lan - nhung giu an toan, re).
const unlockTrigger = ref<{ nodeId: string; seq: number } | null>(null)
let unlockSeq = 0

function onNodeUnlocked(node: ProgressionNode) {
  unlockSeq += 1
  unlockTrigger.value = { nodeId: node.id, seq: unlockSeq }
  // W7: a landed node purchase is a progression beat.
  useAudioStore().cue('progress.node_unlock')
}

function onSelectNode(node: ProgressionNode, purchased: boolean, purchasable: boolean) {
  selectedNode.value = node
  selectedNodePurchased.value = purchased
  selectedNodePurchasable.value = purchasable
  centerMode.value = 'tree'
}

// In-battle the engine rejects every nodeLevels write (purchaseNode /
// upgradeNode gate on isTurnBattleInProgress) -- disable the inspector
// buttons instead of offering a dead click.
const { isBattleInProgress: inBattle } = useTurnBattleInfo()

// A just-purchased selected node stays selected - the model row
// refreshes purchased/purchasable reactively on every
// nodeLevels/skillInsight change; the inspector reads them via
// computeds, not a manual watch.
const selectedRow = computed<BetaSkillTreeNode | null>(() => {
  const node = selectedNode.value

  if (!node) {
    return null
  }

  return skillTree.value.nodes.find((entry) => entry.nodeId === node.id) ?? null
})

watch(selectedRow, (row) => {
  if (!row) {
    return
  }

  selectedNodePurchased.value = row.state === 'purchased'
  selectedNodePurchasable.value = row.state === 'purchasable'
})

// The single library: every learned active skill, independent of role/path.
// M-QI-05 - the list renders the shared SkillPathEntry union: learned
// Skill templates AND owned native cores (granted via kit roots /
// way.coreSkillIds). Levels are canonical Core Node levels; fixed
// Lv1 entries report 1.
const skillPathEntries = computed<SkillPathEntry[]>(() => {
  stateVersion.value

  const entries: SkillPathEntry[] = gameManager.skillManager
    .getAll()
    .filter(skill => skill.type === 'active' && betaSkillAdmitted(skill.id))
    .map(skill => ({
      kind: 'skill' as const,
      id: skill.id,
      name: skill.name,
      description: skill.description,
      level: Math.max(1, gameManager.progressionOps.getSkillLevel(skill.id, player.$state)),
      maxLevel: skill.maxLevel,
      realmId: skill.requiredRealmId ?? 'mortal',
      skill,
    }))

  for (const skillId of NATIVE_CORE_SKILL_IDS) {
    // Canonical core-level read via the ops facade - same seam the
    // skill rows above already consume.
    const level = gameManager.progressionOps.getSkillLevel(skillId, player.$state)

    if (level < 1 || !betaSkillAdmitted(skillId)) {
      continue
    }

    const meta = turnSkillDisplayMetaOf(skillId)
    const maxLevel = gameManager.progressionOps.getSkillCoreMaxLevel(skillId)
    const upgradeCost = gameManager.progressionOps.getSkillCoreUpgradeCost(skillId, player.$state)

    entries.push({
      kind: 'native',
      id: skillId,
      name: meta?.name ?? skillId,
      description: meta?.description,
      level,
      maxLevel,
      realmId: 'qi_refining',
      upgradeCost,
      canUpgrade: upgradeCost !== undefined && player.skillInsight >= upgradeCost,
      ...(meta ? { meta } : {}),
    })
  }

  return entries
})

const selectedSkillId = ref<string | null>(null)

const selectedEntry = computed<SkillPathEntry | null>(() => {
  stateVersion.value

  return skillPathEntries.value.find(entry => entry.id === selectedSkillId.value) ?? null
})

const selectedSkill = computed<Skill | null>(() => {
  return selectedEntry.value?.kind === 'skill' ? selectedEntry.value.skill : null
})

// D7 - the detail surface is discriminated: SkillDetailView stays
// Skill-typed; native cores render through NativeCoreDetail.
const selectedNativeEntry = computed<NativeSkillPathEntry | null>(() => {
  return selectedEntry.value?.kind === 'native' ? selectedEntry.value : null
})

function skillElement(skill: Skill): ElementType | null {
  for (const effect of skill.effects) {
    for (const component of effect.components ?? []) {
      if (component.kind === 'element') return component.element
    }
  }
  return null
}

// Phap Tu Reimagine -- the Phap Tu tree always renders: the element
// root commits IN the tree (element-only commit), so the gate cannot
// be the selected skill (pre-commit the player owns no elemental
// skill). Kiem Tu unchanged -- route locked at path pick.

// M-QI-05 (D7) - the center column has an explicit user-facing mode:
// a visible Tree/Detail tab renders whenever showTree is true. A
// native-core selection FORCES detail (natives own no tree); an
// ordinary skill selection keeps the current mode (the Detail tab is
// always reachable); selecting a tree node returns to the node view.
const centerMode = ref<'tree' | 'detail'>('tree')

const showDetail = computed(() => !showTree.value || centerMode.value === 'detail')

const treeBranchTag = computed<string>(
  () => wayNodeTreeTag.value ?? selectedBranch.value,
)

function onSelectEntry(entry: SkillPathEntry) {
  selectedSkillId.value = entry.id

  // D7 - natives own no tree: selection always reveals the detail
  // surface. Ordinary skills keep the current mode; the player reaches
  // their detail through the always-visible tab.
  if (entry.kind === 'native') {
    centerMode.value = 'detail'
  }

  if (entry.kind === 'skill') {
    const element = skillElement(entry.skill)
    if (element) onSelectBranch(element)
  }
}

watch(skillPathEntries, entries => {
  if (!entries.some(entry => entry.id === selectedSkillId.value)) {
    selectedSkillId.value = entries[0]?.id ?? null
  }
}, { immediate: true })

function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <ImperialScrollScene
    scene="skill" :open="ui.standalonePanel === 'skill'" :title="t('panels.skillPath.title')" @close="close">
      <template #header>
        <span class="skill-path-panel__subtitle">{{ wayIdentity }}</span>
        <SkillInsightChip v-if="showTree" :insight="player.skillInsight" />
      </template>
      <div class="skill-path-panel">
        <div class="skill-path-panel__body">
          <!-- Spec 07: way-card region (way identity + committed element;
               the learned-arts library rides below it in the same rail) -->
          <div class="skill-path-panel__col skill-path-panel__col--left">
            <SkillWayCard
              :way-identity="wayIdentity"
              :path-name="pathName"
              :committed-element="committedElement ?? null"
            />
            <SkillPathList :entries="skillPathEntries" :selected-id="selectedSkillId" @select="onSelectEntry" />
          </div>

          <!-- Spec 07: element tabs (pre-commit) + tree canvas + mode tabs -->
          <div class="skill-path-panel__col skill-path-panel__col--center">
            <!-- Phap Tu element tabs (Task 16) - the tab row shows the
                 branches the model renders; scope-hidden branches (the
                 non-committed elements) are absent, not locked. -->
            <SkillElementTabs
              v-if="hasElementalCasting && !committedElement && visibleElementTabs.length > 0"
              :elements="visibleElementTabs"
              :selected="selectedBranch"
              :committed="committedElement"
              @select="onSelectBranch"
            />

            <SkillTreeCanvas>
              <NodeTreePanel
                v-if="showTree && !showDetail"
                :branch-tag="treeBranchTag"
                :selected-node-id="selectedNode?.id ?? null"
                :unlock-trigger="unlockTrigger"
                @select="onSelectNode"
              />

              <NativeCoreDetail v-else-if="selectedNativeEntry" :entry="selectedNativeEntry" />

              <SkillDetailView v-else :skill="selectedSkill" />
            </SkillTreeCanvas>

            <!-- M-QI-05 (D7) - Tree/Detail mode tabs (spec 07: below the
                 tree canvas); Detail renders the selected entry, Tree
                 restores the node view. -->
            <SkillModeTabs v-if="showTree" :mode="centerMode" @select="centerMode = $event" />
          </div>

          <!-- Spec 07: detail-panel region - node inspector (upgrade) +
               active arts inside one surface-m-panel rail -->
          <div class="skill-path-panel__col skill-path-panel__col--right">
            <SkillDetailRail>
              <NodeInspector
                v-if="showTree && !showDetail"
                :node="selectedNode"
                :row="selectedRow"
                :purchased="selectedNodePurchased"
                :purchasable="selectedNodePurchasable"
                :in-battle="inBattle"
                @unlocked="onNodeUnlocked"
              />

              <span class="skill-path-panel__col-title">{{ t('panels.skillPath.colTitles.activeArts') }}</span>

              <SkillRoleStrip />
            </SkillDetailRail>
          </div>
        </div>
      </div>
  </ImperialScrollScene>
</template>

<style scoped>
.skill-path-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.skill-path-panel__subtitle {
  font-size: var(--text-sm);
  color: var(--paper-text-muted);
}

.skill-path-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  /* Spec 07 column gaps: 16 design px each (16/1244). */
  gap: 1.29%;
}

/* Fit-refactor dot 5 - cot tree sau wheel-scroll an thanh (theme an san
   toan cuc), fade edge bao con noi dung; ngan sach chieu cao do flex body. */
.skill-path-panel__col {
  min-height: 0;
  /* Border-box so the spec % basis includes the padding. */
  box-sizing: border-box;
  overflow-y: auto;
  mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%);
  padding: 12px 14px;
}

/* Fit-refactor dot 3 - card hep (< 900px theo CARD, khong phai viewport)
   thi stack 3 cot thanh khoi doc: moi cot co gian theo noi dung thay vi
   ep cot trai 70px. Cot trai thanh accordion ngang bang flex-wrap chips. */
@container (max-width: 900px) {
  .skill-path-panel__body { flex-direction: column; }
  .skill-path-panel__col { flex: 1 1 auto; overflow-y: visible; border-right: 0; border-left: 0; border-bottom: 1px solid var(--ink-line); }
  .skill-path-panel__col--left { flex: 0 0 auto; max-height: 32%; }
  .skill-path-panel__col--right { flex: 0 0 auto; border-bottom: 0; }
}

/* Spec 07 columns on the 1244 band: way-card 212 | center 640 |
   detail 360 -> 17.04% | auto | 28.94%. */
.skill-path-panel__col--left {
  flex: 0 0 17.04%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-right: 1px solid var(--hk-border-muted, var(--ink-line));
}

/* Cay ky nang KHONG cuon nua (2026-08-30, bug report) - NodeTreePanel
   tu thu nho (zoom-to-fit) vua khung, co nut zoom thu cong rieng thay
   vi dua vao overflow-y:auto cua cot dung chung. */
.skill-path-panel__col--center {
  flex: 1 1 auto;
  overflow-y: hidden;
  display: flex;
  flex-direction: column;
}

.skill-path-panel__col--right {
  flex: 0 0 28.94%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-left: 1px solid var(--hk-border-muted, var(--ink-line));
  /* The nested SkillDetailRail owns its own scrollfade; the outer
     column fade reached into the rail's top ornament zone and halved
     the "Phap Thuat Dang Van Hanh" column title. */
  mask-image: none;
}

.skill-path-panel__col-title {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--hk-text-muted, var(--paper-eyebrow));
  /* Clear the rail frame's corner ornaments on both ends - the leading
     padding was for the left arm, and the trailing 'H' of the vi title
     clipped against the rail's right edge. */
  padding-left: 8px;
  padding-right: 10px;
}
</style>
