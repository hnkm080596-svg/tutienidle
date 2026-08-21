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
// vận hành trong combat (xem BattleSystem.updateAutoCast()), "equip cả
// 1 Hành" không cộng thêm ý nghĩa nào khác.
import { computed, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import ElementPathList from './skill-path/ElementPathList.vue'
import NodeTreePanel from './loadout-sections/NodeTreePanel.vue'
import NodeInspector from './skill-path/NodeInspector.vue'
import SkillPathList from './skill-path/SkillPathList.vue'
import SkillDetailView from './skill-path/SkillDetailView.vue'
import SkillLoadoutStrip from './skill-path/SkillLoadoutStrip.vue'
import { canPurchaseNode } from '@/core/progression/NodeSystem'
import { CULTIVATION_PATH_KITS } from '@/core/player/CultivationPathKit'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'
import type { ElementType } from '@/core/element/ElementType'
import type { Skill } from '@/core/skill/Skill'

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

const showTree = computed(() => player.cultivationPath === 'phap_tu')

// ---- Nhánh phap_tu (Hành -> Node Tree) ----
const selectedBranch = ref<ElementType>('fire')

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
// khi purchasedNodeIds/skillPoints đổi, không chờ người chơi bấm lại
// vào node.
watch(
  () => [player.purchasedNodeIds.length, player.skillPoints] as const,
  () => {
    if (!selectedNode.value) {
      return
    }

    selectedNodePurchased.value = player.purchasedNodeIds.includes(selectedNode.value.id)
    selectedNodePurchasable.value = canPurchaseNode(player.$state, selectedNode.value)
  },
)

// ---- Nhánh khác (Kiếm Tu 3 skill cố định / Phàm Nhân chỉ Trảm) ----
const fixedSkills = computed<Skill[]>(() => {
  stateVersion.value

  if (player.cultivationPath === 'kiem_tu') {
    const skillIds = CULTIVATION_PATH_KITS.kiem_tu.skillIds ?? []

    return skillIds
      .map(id => gameManager.skillManager.get(id))
      .filter((skill): skill is Skill => skill !== undefined)
  }

  // Phàm Nhân (chưa chọn path) — chỉ có đúng Trảm.
  const basic = gameManager.skillManager.getBasicAttackSkill()

  return basic ? [basic] : []
})

const selectedSkillId = ref<string | null>(null)

const selectedSkill = computed<Skill | null>(() => {
  stateVersion.value

  return fixedSkills.value.find(skill => skill.id === selectedSkillId.value) ?? null
})

function onSelectSkill(skill: Skill) {
  selectedSkillId.value = skill.id
}

function close() {
  ui.standalonePanel = null
}
</script>

<template>
  <div v-if="ui.standalonePanel === 'skill'" class="skill-path-panel" @click.self="close">
    <div class="skill-path-panel__card">
      <div class="skill-path-panel__header">
        <div>
          <h3 class="skill-path-panel__title">Kỹ Năng</h3>
          <span v-if="showTree" class="skill-path-panel__subtitle">Con đường Ngũ Hành</span>
        </div>

        <span v-if="showTree" class="skill-path-panel__points">✦ {{ player.skillPoints }} Điểm Pháp Tu</span>

        <button type="button" class="skill-path-panel__close" @click="close">✕</button>
      </div>

      <div class="skill-path-panel__body">
        <div class="skill-path-panel__col skill-path-panel__col--left">
          <ElementPathList v-if="showTree" :selected="selectedBranch" @select="onSelectBranch" />

          <SkillPathList v-else :skills="fixedSkills" :selected-id="selectedSkillId" @select="onSelectSkill" />
        </div>

        <div class="skill-path-panel__col skill-path-panel__col--center">
          <NodeTreePanel
            v-if="showTree"
            :branch-tag="selectedBranch"
            :selected-node-id="selectedNode?.id ?? null"
            :unlock-trigger="unlockTrigger"
            @select="onSelectNode"
          />

          <SkillDetailView v-else :skill="selectedSkill" />
        </div>

        <div class="skill-path-panel__col skill-path-panel__col--right">
          <span class="skill-path-panel__col-title">Pháp Thuật Đang Vận Hành</span>

          <SkillLoadoutStrip />
        </div>
      </div>

      <NodeInspector
        v-if="showTree"
        :node="selectedNode"
        :purchased="selectedNodePurchased"
        :purchasable="selectedNodePurchasable"
        @unlocked="onNodeUnlocked"
      />
    </div>
  </div>
</template>

<style scoped>
.skill-path-panel {
  position: absolute;
  inset: 0;
  z-index: 1800;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 13, 0.72);
}

.skill-path-panel__card {
  width: min(1400px, 94%);
  height: min(760px, 88%);
  display: flex;
  flex-direction: column;
  background: var(--ink-900);
  border: 1px solid var(--gold-500);
  box-shadow: var(--shadow-panel);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  color: var(--text-primary);
  overflow: hidden;
}

.skill-path-panel__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--ink-line);
}

.skill-path-panel__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  color: var(--gold-500);
}

.skill-path-panel__subtitle {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.skill-path-panel__points {
  font-size: 0.8rem;
  color: var(--gold-500);
}

.skill-path-panel__close {
  width: 26px;
  height: 26px;
  padding: 0;
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
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

.skill-path-panel__col--left {
  flex: 0 0 20%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-right: 1px solid var(--ink-line);
}

.skill-path-panel__col--center {
  flex: 1 1 auto;
}

.skill-path-panel__col--right {
  flex: 0 0 22%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-left: 1px solid var(--ink-line);
}

.skill-path-panel__col-title {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--gold-500);
}
</style>
