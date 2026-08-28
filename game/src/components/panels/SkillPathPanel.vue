<script setup lang="ts">
// Tách khỏi LoadoutManager.vue (2026-08-20, "Kỹ năng và tâm pháp giờ
// cần tách ra thành 2 panel mới, không phụ thuộc vào left panel nữa")
// + redesign theo tien-hiep-idle/Plans/PhapTuPanel (header/chọn kỹ
// năng/chi tiết/Loadout). Bố cục 3 cột ÁP DỤNG CHO MỌI PATH (kể cả
// Phàm Nhân/Kiếm Tu, không riêng Pháp Tu) — chỉ khác NỘI DUNG cột
// trái/giữa vì Kiếm Tu/Phàm Nhân không có Node Tree phân nhánh:
//   phap_tu   -> trái: ElementPathList (chọn Hành để lọc cây)
//                giữa: NodeTreePanel (cây thật của Hành đó)
//   khác      -> trái: SkillPathList (liệt kê skill cố định/Trảm)
//                giữa: SkillDetailView (chi tiết skill đang chọn, đọc only)
// Cột phải (SkillLoadoutStrip, "Pháp Thuật Đang Vận Hành") và
// NodeInspector (bottom, CHỈ có ý nghĩa khi có node để mua) không đổi.
//
// ElementLoadoutPicker.vue (equip Hành vào combat) đã GỠ HẲN (2026-08-20,
// yêu cầu "dư thừa, không có tác dụng gì") — nó trùng chức năng với
// SkillLoadoutStrip: skill nào equip vào 5 ô đó mới là thứ thật sự
// vận hành trong combat (xem scheduler auto-cast thống nhất của
// BattleSystem), "equip cả 1 Hành" không cộng thêm ý nghĩa nào khác.
import { computed, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import NodeTreePanel from './loadout-sections/NodeTreePanel.vue'
import NodeInspector from './skill-path/NodeInspector.vue'
import SkillPathList from './skill-path/SkillPathList.vue'
import SkillDetailView from './skill-path/SkillDetailView.vue'
import SkillLoadoutStrip from './skill-path/SkillLoadoutStrip.vue'
import { canPurchaseNode, getNodeLevel } from '@/core/progression/NodeSystem'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'
import type { ElementType } from '@/core/element/ElementType'
import type { Skill } from '@/core/skill/Skill'
import OverlayPanel from '@/components/common/OverlayPanel.vue'

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// Final review fix (Critical #1) — Kiếm Tu path cũng có Node Tree thật
// (KiemTuNodes.ts's 2 cây kiem_tran/bat_kiem), chỉ trước đây không path
// nào wire showTree cho kiem_tu nên purchaseNode() (chỉ gọi được qua
// NodeInspector.vue, chỉ render khi showTree) hoàn toàn unreachable.
const showTree = computed(() => player.cultivationPath === 'phap_tu' || player.cultivationPath === 'kiem_tu')

// ---- Nhánh phap_tu (Hành -> Node Tree) ----
const selectedBranch = ref<ElementType>('fire')

// ---- Nhánh kiem_tu (2 cây song song, không suy được từ skill đang
// chọn như phap_tu — kiem_tran_luong_nghi là ROOT cost-0 của cây Kiếm
// Trận nhưng KHÔNG skill nào học sẵn để trỏ vào nó lúc chưa mua node
// đầu tiên, xem KiemTuNodes.ts). Toggle riêng, độc lập SkillPathList. ----
const kiemTuBranch = ref<'kiem_tran' | 'bat_kiem'>('kiem_tran')

const KIEM_TU_BRANCH_LABELS: Record<'kiem_tran' | 'bat_kiem', string> = {
  kiem_tran: 'Kiếm Trận',
  bat_kiem: 'Bạt Kiếm',
}

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

// Kiếm Tu: cây được chọn qua toggle riêng (kiemTuBranch), không phụ
// thuộc skill đang chọn ở SkillPathList. Pháp Tu: giữ hành vi cũ (chỉ
// hiện cây khi skill đang chọn có tag 'element').
const selectedSkillHasTree = computed(() => {
  if (!showTree.value) {
    return false
  }

  if (player.cultivationPath === 'kiem_tu') {
    return true
  }

  return selectedSkill.value !== null && skillElement(selectedSkill.value) !== null
})

const treeBranchTag = computed<string>(() =>
  player.cultivationPath === 'kiem_tu' ? kiemTuBranch.value : selectedBranch.value,
)
const huyKiemHiddenTreeOpen = computed(() =>
  selectedSkill.value?.id === 'tram' && selectedSkill.value.level >= 18 && player.cultivationPath === 'kiem_tu',
)

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
  <OverlayPanel :open="ui.standalonePanel === 'skill'" title="Kỹ Năng" width="min(1400px, 94vw)" height="min(760px, 88vh)" @close="close">
      <template #subtitle><span v-if="showTree" class="skill-path-panel__subtitle">Thư viện theo cảnh giới · Con đường Ngũ Hành</span></template>
      <template #header-actions><span v-if="showTree" class="skill-path-panel__points">✦ {{ player.skillInsight }} Cảm Ngộ</span></template>
      <div class="skill-path-panel">
        <div class="skill-path-panel__body">
          <div class="skill-path-panel__col skill-path-panel__col--left">
            <SkillPathList :skills="learnedSkills" :selected-id="selectedSkillId" @select="onSelectSkill" />
          </div>

          <div class="skill-path-panel__col skill-path-panel__col--center">
            <div v-if="selectedSkillHasTree && player.cultivationPath === 'kiem_tu'" class="skill-path-panel__kiem-tu-toggle">
              <button
                v-for="branch in (['kiem_tran', 'bat_kiem'] as const)"
                :key="branch"
                type="button"
                class="skill-path-panel__kiem-tu-toggle-btn"
                :class="{ 'is-active': kiemTuBranch === branch }"
                @click="kiemTuBranch = branch; selectedNode = null"
              >
                {{ KIEM_TU_BRANCH_LABELS[branch] }}
              </button>
            </div>

            <NodeTreePanel
              v-if="selectedSkillHasTree"
              :branch-tag="treeBranchTag"
              :selected-node-id="selectedNode?.id ?? null"
              :unlock-trigger="unlockTrigger"
              @select="onSelectNode"
            />

            <div v-else-if="huyKiemHiddenTreeOpen" class="huy-kiem-tree">
              <h4>Kiếm Tâm Ẩn · Huy Kiếm</h4>
              <div class="huy-kiem-tree__nodes">
                <span>Kiếm Ý Sơ Minh</span><span>Nhân Kiếm Hợp Nhất</span><span>Vạn Kiếm Quy Tông</span>
              </div>
              <p>Cây ẩn đã thức tỉnh. Các node chuyên sâu sẽ mở rộng cùng tuyến Kiếm Tu.</p>
            </div>
            <SkillDetailView v-else :skill="selectedSkill" />
          </div>

          <div class="skill-path-panel__col skill-path-panel__col--right">
            <span class="skill-path-panel__col-title">Pháp Thuật Đang Vận Hành</span>

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
.skill-path-panel__kiem-tu-toggle { display: flex; gap: 8px; margin-bottom: 10px; }
.skill-path-panel__kiem-tu-toggle-btn { padding: 6px 16px; background: var(--ink-800); color: var(--text-secondary); border: 1px solid var(--ink-line-soft); border-radius: var(--radius-sm); font-size: var(--text-sm); font-weight: 600; cursor: pointer; }
.skill-path-panel__kiem-tu-toggle-btn.is-active { color: var(--gold-500); border-color: var(--gold-500); background: color-mix(in srgb, var(--gold-500) 14%, var(--ink-800)); }
.huy-kiem-tree { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; gap: 18px; padding: 24px; text-align: center; }
.huy-kiem-tree h4 { margin: 0; color: var(--chrome-100); font-family: var(--font-display); }
.huy-kiem-tree__nodes { display: flex; align-items: center; gap: 28px; }
.huy-kiem-tree__nodes span { position: relative; display: grid; place-items: center; width: 112px; min-height: 72px; padding: 8px; color: var(--jade); background: var(--ink-800); border: 1px solid var(--jade); border-radius: 50%; box-shadow: 0 0 18px color-mix(in srgb, var(--jade) 28%, transparent); }
.huy-kiem-tree__nodes span:not(:last-child)::after { content: ''; position: absolute; left: 100%; width: 29px; height: 2px; background: var(--jade); }
.huy-kiem-tree p { color: var(--text-muted); }
.skill-path-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.skill-path-panel__subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.skill-path-panel__points {
  font-size: var(--text-sm);
  color: var(--chrome-100);
}

.skill-path-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  gap: 0;
}

.skill-path-panel__col {
  min-height: 0;
  overflow-y: auto;
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

.skill-path-panel__col--center {
  flex: 1 1 auto;
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
  color: var(--chrome-100);
}
</style>
