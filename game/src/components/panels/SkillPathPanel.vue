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
import TechniqueBand from './skill-path/TechniqueBand.vue'
import { canPurchaseNode, getNodeLevel } from '@/core/progression/NodeSystem'
import { getActiveWayDefinition } from '@/core/player/CultivationPathKit'
import {
  getActiveElement,
  hasStaticPathCapability,
} from '@/core/player/CultivationPathSystem'
import { ELEMENT_ORDER, ELEMENT_LABELS, ELEMENT_COLOR_VARS } from '@/core/element/ElementLabels'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'
import type { ElementType } from '@/core/element/ElementType'
import type { Skill } from '@/core/skill/Skill'
import type { SkillPathEntry, NativeSkillPathEntry } from './skill-path/SkillPathEntry'
import { NATIVE_CORE_SKILL_IDS } from '@/data/progression/SkillCoreNodes'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import { getSkillCoreLevel } from '@/core/progression/SkillCoreLevel'
import OverlayPanel from '@/components/common/OverlayPanel.vue'

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
// P1 - tree selection resolves on the WAY's declared nodeTreeTag, never
// a concrete way predicate: kiem hien -> 'kiem_pho', ngu -> 'ngu_kiem',
// body hien -> 'body', ung_the -> 'hidden_body'. Ways without a fixed
// tree (spell_pathway - element-driven; ngo_dao - none) declare no tag; the
// resolver fails closed on a corrupt pair.
const wayNodeTreeTag = computed(() => getActiveWayDefinition(player)?.nodeTreeTag)

// P7-M7 - way identity line: the committed way's self-describing name
// (e.g. 'Kiem Tu - Ngu Kiem Tam Kinh'), or Phan Nhan for a way-less
// mortal. Resolved through the canonical way read, never an id literal.
const wayIdentity = computed(
  () => getActiveWayDefinition(player)?.name ?? t('panels.skillPath.mortalName'),
)

const hasElementalCasting = computed(
  () => hasStaticPathCapability(player, 'spell.elemental_casting'),
)

const showTree = computed(
  () =>
    // M4 (R6): the Phap Tu element tree is spell_pathway machinery - the
    // 'spell.elemental_casting' capability is the gate - a collapsed
    // ('spell','hidden_spell_pathway') player owns no element branches.
    hasElementalCasting.value || wayNodeTreeTag.value !== undefined,
)

// ---- Nhánh spell (Hành -> Node Tree) ----
// Task 16: element tabs always visible for spell — the element-root
// pick happens IN the tree (element+route atomic commit), so the tree
// must render before any elemental skill is learned. Default tab = the
// committed element once the element axis resolves one.
const committedElement = computed(() => getActiveElement(player))

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
}

function onSelectNode(node: ProgressionNode, purchased: boolean, purchasable: boolean) {
  selectedNode.value = node
  selectedNodePurchased.value = purchased
  selectedNodePurchasable.value = purchasable
  centerMode.value = 'tree'
}

// Node vừa mua xong vẫn đang là selectedNode — refresh trạng thái
// purchased/purchasable hiển thị ở inspector theo state mới nhất mỗi
// khi nodeLevels/skillInsight đổi, không chờ người chơi bấm lại vào node.
watch(
  () => [Object.keys(player.nodeLevels).length, player.skillInsight] as const,
  () => {
    if (!selectedNode.value) {
      return
    }

    selectedNodePurchased.value = getNodeLevel(player.$state, selectedNode.value.id) >= 1
    selectedNodePurchasable.value = canPurchaseNode(player.$state, selectedNode.value)
  },
)

// The single library: every learned active skill, independent of role/path.
// M-QI-05 - the list renders the shared SkillPathEntry union: learned
// Skill templates AND owned native cores (granted via kit roots /
// way.coreSkillIds). Levels are canonical Core Node levels; fixed
// Lv1 entries report 1.
const skillPathEntries = computed<SkillPathEntry[]>(() => {
  stateVersion.value

  const entries: SkillPathEntry[] = gameManager.skillManager
    .getAll()
    .filter(skill => skill.type === 'active')
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
    const level = getSkillCoreLevel(player.$state, skillId)

    if (level < 1) {
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

// Phap Tu Reimagined (Task 16) — cây Pháp Tu luôn hiển thị: element
// root được chọn TRONG cây (element+route atomic commit), nên không
// thể gate theo skill đang chọn (trước khi commit, player chưa có
// skill elemental nào). Kiem Tu giữ nguyên — route chốt lúc chọn path.

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
  <OverlayPanel :open="ui.standalonePanel === 'skill'" :title="t('panels.skillPath.title')" width="min(1400px, 94vw)" height="min(760px, 88vh)" @close="close">
      <template #subtitle><span class="skill-path-panel__subtitle">{{ wayIdentity }}</span></template>
      <template #header-actions><span v-if="showTree" class="skill-path-panel__points">✦ {{ player.skillInsight }} {{ t('panels.nodeTree.labels.insight') }}</span></template>
      <div class="skill-path-panel">
        <TechniqueBand />

        <div class="skill-path-panel__body">
          <div class="skill-path-panel__col skill-path-panel__col--left">
            <SkillPathList :entries="skillPathEntries" :selected-id="selectedSkillId" @select="onSelectEntry" />
          </div>

          <div class="skill-path-panel__col skill-path-panel__col--center">
            <!-- Phap Tu element tabs (Task 16) — browse all 5 branches;
                 the committed element is marked, others render locked. -->
            <div
              v-if="hasElementalCasting"
              class="skill-path-panel__element-tabs"
              role="group"
              :aria-label="t('panels.skillPath.elementTabs.aria')"
            >
              <button
                v-for="element in ELEMENT_ORDER"
                :key="element"
                type="button"
                class="skill-path-panel__element-tab"
                :class="{ 'is-selected': element === selectedBranch, 'is-committed': element === committedElement }"
                :style="{ '--element-color': ELEMENT_COLOR_VARS[element] }"
                @click="onSelectBranch(element)"
              >
                {{ ELEMENT_LABELS[element] }}
              </button>
            </div>

            <!-- M-QI-05 (D7) - Tree/Detail mode tabs: visible on every
                 tree-owning way so the detail surface (and its upgrade
                 affordance) stays reachable; Detail renders the
                 selected entry, Tree restores the node view. -->
            <div
              v-if="showTree"
              class="skill-path-panel__mode-tabs"
              role="group"
              :aria-label="t('panels.skillPath.centerTabs.aria')"
            >
              <button
                type="button"
                class="skill-path-panel__mode-tab"
                :class="{ 'is-selected': centerMode === 'tree' }"
                @click="centerMode = 'tree'"
              >
                {{ t('panels.skillPath.centerTabs.tree') }}
              </button>
              <button
                type="button"
                class="skill-path-panel__mode-tab"
                :class="{ 'is-selected': centerMode === 'detail' }"
                @click="centerMode = 'detail'"
              >
                {{ t('panels.skillPath.centerTabs.detail') }}
              </button>
            </div>

            <NodeTreePanel
              v-if="showTree && !showDetail"
              :branch-tag="treeBranchTag"
              :selected-node-id="selectedNode?.id ?? null"
              :unlock-trigger="unlockTrigger"
              @select="onSelectNode"
            />

            <NativeCoreDetail v-else-if="selectedNativeEntry" :entry="selectedNativeEntry" />

            <SkillDetailView v-else :skill="selectedSkill" />
          </div>

          <div class="skill-path-panel__col skill-path-panel__col--right">
            <span class="skill-path-panel__col-title">{{ t('panels.skillPath.colTitles.activeArts') }}</span>

            <SkillRoleStrip />
          </div>
        </div>

        <NodeInspector
          v-if="showTree && !showDetail"
          :node="selectedNode"
          :purchased="selectedNodePurchased"
          :purchasable="selectedNodePurchasable"
          @unlocked="onNodeUnlocked"
        />
      </div>
  </OverlayPanel>
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

.skill-path-panel__points {
  font-size: var(--text-sm);
  color: var(--gold-700);
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
@container overlay-panel (max-width: 900px) {
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
  border-right: 1px solid var(--ink-line);
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

/* Phap Tu element tabs (Task 16) — 5 Hành chips above the tree; the
   committed element gets a filled accent, the browsed tab an outline. */
.skill-path-panel__element-tabs {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.skill-path-panel__element-tab {
  padding: 4px 12px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: 999px;
  color: var(--element-color, var(--text-secondary));
  font-family: var(--font-body);
  font-size: var(--text-sm);
  cursor: pointer;
}

.skill-path-panel__element-tab.is-selected {
  border-color: var(--element-color, var(--chrome-300));
  font-weight: 600;
}

.skill-path-panel__element-tab.is-committed {
  background: color-mix(in srgb, var(--element-color, var(--ink-800)) 22%, var(--ink-800));
}

/* M-QI-05 (D7) - center mode tabs; same chip family as element tabs. */
.skill-path-panel__mode-tabs {
  flex: 0 0 auto;
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.skill-path-panel__mode-tab {
  padding: 4px 12px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: 999px;
  color: var(--text-secondary);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  cursor: pointer;
}

.skill-path-panel__mode-tab.is-selected {
  border-color: var(--chrome-300);
  color: var(--text-primary);
  font-weight: 600;
}

.skill-path-panel__col--right {
  flex: 0 0 min(22%, 300px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-left: 1px solid var(--ink-line);
}

.skill-path-panel__col-title {
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--paper-eyebrow);
}
</style>
