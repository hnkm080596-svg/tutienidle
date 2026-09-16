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
// (SkillLoadoutStrip, "Pháp Thuật Đang Vận Hành") và
// NodeInspector (bottom, CHỈ có ý nghĩa khi có node để mua) không đổi.
//
// ElementLoadoutPicker.vue (equip Hành vào combat) đã GỠ HẲN (2026-08-20,
// yêu cầu "dư thừa, không có tác dụng gì") — nó trùng chức năng với
// SkillLoadoutStrip: skill nào equip vào 5 ô đó mới là thứ thật sự
// vận hành trong combat (xem scheduler auto-cast thống nhất của
// BattleSystem), "equip cả 1 Hành" không cộng thêm ý nghĩa nào khác.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import NodeTreePanel from './loadout-sections/NodeTreePanel.vue'
import NodeInspector from './skill-path/NodeInspector.vue'
import SkillPathList from './skill-path/SkillPathList.vue'
import SkillDetailView from './skill-path/SkillDetailView.vue'
import SkillLoadoutStrip from './skill-path/SkillLoadoutStrip.vue'
import { canPurchaseNode, getNodeLevel } from '@/core/progression/NodeSystem'
import { isPhapTuNguHanh } from '@/core/phap-tu/PhapTuPath'
import { ELEMENT_ORDER, ELEMENT_LABELS, ELEMENT_COLOR_VARS } from '@/core/element/ElementLabels'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'
import type { CultivationPathId } from '@/core/player/CultivationPathKit'
import type { ElementType } from '@/core/element/ElementType'
import type { Skill } from '@/core/skill/Skill'
import OverlayPanel from '@/components/common/OverlayPanel.vue'

const { t } = useI18n()
const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// Kiem Tu also has a real Node Tree (KiemTuNodes.ts). purchaseNode() is
// only reachable through NodeInspector.vue, which renders when showTree.
//
// The Tu Reimagined (T22) — the_tu/the_tu_an mỗi path có 1 cây thật
// (TheTuNodes/TheTuAnNodes) dưới branchTag trùng path id: single-tag
// pass-through view qua viewBranchTags(), toàn bộ root (mutex cho Hiện,
// non-mutex cho Ẩn) render trong cùng một tree.
const THE_TU_TREE_TAGS: Partial<Record<CultivationPathId, string>> = {
  the_tu: 'the_tu',
  the_tu_an: 'the_tu_an',
}

const theTuTreeTag = computed(() =>
  player.cultivationPath ? THE_TU_TREE_TAGS[player.cultivationPath] : undefined,
)

const showTree = computed(
  () =>
    // M4 (R6): the Phap Tu element tree is ngu_hanh machinery — a
    // collapsed ('phap_tu','ngo_dao') player owns no element branches.
    isPhapTuNguHanh(player) ||
    player.cultivationPath === 'kiem_tu' ||
    theTuTreeTag.value !== undefined,
)

// ---- Nhánh phap_tu (Hành -> Node Tree) ----
// Task 16: element tabs always visible for phap_tu — the element-root
// pick happens IN the tree (element+route atomic commit), so the tree
// must render before any elemental skill is learned. Default tab = the
// committed element once phapTu.element exists.
const selectedBranch = ref<ElementType>(player.phapTu?.element ?? 'fire')

watch(
  () => player.phapTu?.element,
  element => {
    if (element) {
      selectedBranch.value = element
    }
  },
)

// ---- Nhánh kiem_tu (Kiem Tu Reimagined spec §6) — ONE tree, two
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

// Thư viện duy nhất: mọi active skill đã học, không phụ thuộc loadout/path.
const learnedSkills = computed<Skill[]>(() => {
  stateVersion.value
  return gameManager.skillManager.getAll().filter(skill => skill.unlocked && skill.type === 'active')
})

const selectedSkillId = ref<string | null>(null)

const selectedSkill = computed<Skill | null>(() => {
  stateVersion.value

  return learnedSkills.value.find(skill => skill.id === selectedSkillId.value) ?? null
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
const selectedSkillHasTree = computed(() => {
  if (!showTree.value) {
    return false
  }

  // Kiem Tu + ca hai The Tu: cay co dinh cua path — luon hien, khong
  // phu thuoc skill dang chon o SkillPathList.
  if (
    player.cultivationPath === 'kiem_tu' ||
    isPhapTuNguHanh(player) ||
    theTuTreeTag.value !== undefined
  ) {
    return true
  }

  return selectedSkill.value !== null && skillElement(selectedSkill.value) !== null
})

const treeBranchTag = computed<string>(() => {
  if (player.cultivationPath === 'kiem_tu') {
    return player.kiemTu?.mode === 'ngu' ? 'ngu_kiem' : 'kiem_pho'
  }

  return theTuTreeTag.value ?? selectedBranch.value
})

function onSelectSkill(skill: Skill) {
  selectedSkillId.value = skill.id
  const element = skillElement(skill)
  if (element) onSelectBranch(element)
}

watch(learnedSkills, skills => {
  if (!skills.some(skill => skill.id === selectedSkillId.value)) {
    selectedSkillId.value = skills[0]?.id ?? null
  }
}, { immediate: true })

function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <OverlayPanel :open="ui.standalonePanel === 'skill'" :title="t('panels.skillPath.title')" width="min(1400px, 94vw)" height="min(760px, 88vh)" @close="close">
      <template #subtitle><span v-if="showTree" class="skill-path-panel__subtitle">{{ t('panels.skillPath.subtitle') }}</span></template>
      <template #header-actions><span v-if="showTree" class="skill-path-panel__points">✦ {{ player.skillInsight }} {{ t('panels.nodeTree.labels.insight') }}</span></template>
      <div class="skill-path-panel">
        <div class="skill-path-panel__body">
          <div class="skill-path-panel__col skill-path-panel__col--left">
            <SkillPathList :skills="learnedSkills" :selected-id="selectedSkillId" @select="onSelectSkill" />
          </div>

          <div class="skill-path-panel__col skill-path-panel__col--center">
            <!-- Phap Tu element tabs (Task 16) — browse all 5 branches;
                 the committed element is marked, others render locked. -->
            <div
              v-if="isPhapTuNguHanh(player)"
              class="skill-path-panel__element-tabs"
              role="group"
              :aria-label="t('panels.skillPath.elementTabs.aria')"
            >
              <button
                v-for="element in ELEMENT_ORDER"
                :key="element"
                type="button"
                class="skill-path-panel__element-tab"
                :class="{ 'is-selected': element === selectedBranch, 'is-committed': element === player.phapTu?.element }"
                :style="{ '--element-color': ELEMENT_COLOR_VARS[element] }"
                @click="onSelectBranch(element)"
              >
                {{ ELEMENT_LABELS[element] }}
              </button>
            </div>

            <NodeTreePanel
              v-if="selectedSkillHasTree"
              :branch-tag="treeBranchTag"
              :selected-node-id="selectedNode?.id ?? null"
              :unlock-trigger="unlockTrigger"
              @select="onSelectNode"
            />

            <SkillDetailView v-else :skill="selectedSkill" />
          </div>

          <div class="skill-path-panel__col skill-path-panel__col--right">
            <span class="skill-path-panel__col-title">{{ t('panels.skillPath.colTitles.loadoutActive') }}</span>

            <SkillLoadoutStrip />
          </div>
        </div>

        <NodeInspector
          v-if="selectedSkillHasTree"
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
