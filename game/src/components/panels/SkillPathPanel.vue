<script setup lang="ts">
// Tách khỏi LoadoutManager.vue (2026-08-20, "Kỹ năng và tâm pháp giờ
// cần tách ra thành 2 panel mới, không phụ thuộc vào left panel nữa")
// + redesign theo tien-hiep-idle/Plans/PhapTuPanel (header/chọn kỹ
// năng/chi tiết/Loadout). Bố cục 3 cột ÁP DỤNG CHO MỌI PATH (kể cả
// Phàm Nhân/Kiếm Tu, không riêng Pháp Tu) — chỉ khác NỘI DUNG cột
// giữa vì Kiếm Tu/Phàm Nhân không có Node Tree phân nhánh:
//   có tree   -> giữa: NodeTreePanel (cây thật của skill/branch đó)
//   khác      -> giữa: SkillDetailView (chi tiết skill đang chọn, đọc only)
// Cột trái dùng chung SkillPathList cho mọi path; cột phải
// (SkillRoleStrip, "Active Arts") and
// NodeInspector (bottom, CHỈ có ý nghĩa khi có node để mua) không đổi.
//
// ElementLoadoutPicker.vue (equip Hành vào combat) đã GỠ HẲN (2026-08-20,
// yêu cầu "dư thừa, không có tác dụng gì") — nó trùng chức năng với
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
// The Tu Reimagined (T22) — body/hidden_body mỗi path có 1 cây thật
// (TheTuNodes/TheTuAnNodes) dưới branchTag trùng path id: single-tag
// pass-through view qua viewBranchTags(), toàn bộ root (mutex cho Hiện,
// non-mutex cho Ẩn) render trong cùng một tree.
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
// identity (ref's "Phap Tu • Hoa Hanh" line). Mortal shows none.
const pathName = computed(() =>
  player.cultivationPath ? CULTIVATION_PATH_MODULES[player.cultivationPath]?.name ?? null : null,
)

const hasElementalCasting = computed(() => skillTree.value.elementCasting)

const showTree = computed(
  () =>
    // M4 (R6): the Phap Tu element tree is spell_pathway machinery - the
    // 'spell.elemental_casting' capability is the gate - a collapsed
    // ('spell','hidden_spell_pathway') player owns no element branches.
    hasElementalCasting.value || wayNodeTreeTag.value !== undefined,
)

// ---- Nhánh spell (Hành -> Node Tree) ----
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

// ---- Nhánh sword (Kiem Tu Reimagined spec §6) — ONE tree, two
// branchTags rendered together: 'kiem_pho' (orb branches) + 'ngu_kiem'
// (hidden root + Ngu branch). Node-level visibility is mode-filtered
// inside NodeTreePanel — this tag only selects WHICH view; the re-
// imagined tree replaces the retired kiem_tran/bat_kiem route split. ----

const selectedNode = ref<ProgressionNode | null>(null)
const selectedNodePurchased = ref(false)
const selectedNodePurchasable = ref(false)

function onSelectBranch(element: ElementType) {
  selectedBranch.value = element
  selectedNode.value = null
}

// Skill Node unlock animation (2026-08-21, Plans/SkillNode) — NodeInspector
// emit 'unlocked' NGAY SAU khi purchaseNode() thành công (KHÔNG đổi
// logic mua) — chỉ chuyển tiếp id + số thứ tự (seq) tăng dần xuống
// NodeTreePanel.vue để nó tự chạy animation connection→node. `seq`
// đảm bảo watch() ở NodeTreePanel luôn thấy giá trị MỚI kể cả khi mua
// liên tiếp cùng 1 node id (về lý thuyết không xảy ra — mỗi node chỉ
// mua 1 lần — nhưng giữ an toàn, rẻ).
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
              v-if="hasElementalCasting && visibleElementTabs.length > 0"
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
  gap: 0;
}

/* Fit-refactor đợt 5 — cột tree sâu wheel-scroll ẩn thanh (theme ẩn sẵn
   toàn cục), fade edge báo còn nội dung; ngân sách chiều cao do flex body. */
.skill-path-panel__col {
  min-height: 0;
  overflow-y: auto;
  mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%);
  padding: 12px 14px;
}

/* Fit-refactor đợt 3 — card hẹp (< 900px theo CARD, không phải viewport)
   thì stack 3 cột thành khối dọc: mỗi cột co giãn theo nội dung thay vì
   ép cột trái 70px. Cột trái thành accordion ngang bằng flex-wrap chips. */
@container (max-width: 900px) {
  .skill-path-panel__body { flex-direction: column; }
  .skill-path-panel__col { flex: 1 1 auto; overflow-y: visible; border-right: 0; border-left: 0; border-bottom: 1px solid var(--ink-line); }
  .skill-path-panel__col--left { flex: 0 0 auto; max-height: 32%; }
  .skill-path-panel__col--right { flex: 0 0 auto; border-bottom: 0; }
}

.skill-path-panel__col--left {
  flex: 0 0 min(20%, 280px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-right: 1px solid var(--hk-border-muted, var(--ink-line));
}

/* Cây kỹ năng KHÔNG cuộn nữa (2026-08-30, bug report) — NodeTreePanel
   tự thu nhỏ (zoom-to-fit) vừa khung, có nút zoom thủ công riêng thay
   vì dựa vào overflow-y:auto của cột dùng chung. */
.skill-path-panel__col--center {
  flex: 1 1 auto;
  overflow-y: hidden;
  display: flex;
  flex-direction: column;
}

.skill-path-panel__col--right {
  flex: 0 0 min(22%, 300px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-left: 1px solid var(--hk-border-muted, var(--ink-line));
}

.skill-path-panel__col-title {
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--hk-text-muted, var(--paper-eyebrow));
}
</style>
