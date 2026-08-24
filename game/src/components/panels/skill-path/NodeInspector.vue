<script setup lang="ts">
// PhapTuPanel plan mục 10/17/29 — bottom panel: chi tiết node đang
// CHỌN (không phải đang hover) + nút mua. ProgressionNode THẬT
// (core/progression/ProgressionNode.ts) chỉ có 1 `cost` mua 1 lần —
// KHÔNG có currentLevel/maxLevel như mockup +/- stepper của plan gốc
// (hệ leveled-node đó chưa từng được xây), nên đây CHỈ có 1 nút "Lĩnh
// Ngộ", không có +/-.
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useLoadoutActions } from '@/composables/useLoadoutActions'
import { hasPrerequisite } from '@/core/progression/NodeSystem'
import { getActiveSkillResourceStats } from '@/core/skill/SkillResourceStatLabels'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'

const props = defineProps<{
  node: ProgressionNode | null
  purchased: boolean
  purchasable: boolean
}>()

// Skill Node unlock animation (2026-08-21, Plans/SkillNode) — nguồn
// DUY NHẤT xử lý "player unlock skill node thành công" hiện có
// (onPurchase() bên dưới) — chỉ thêm đúng 1 emit ngay sau khi
// purchaseNode() thật sự thành công, KHÔNG đổi gì logic mua/skill
// point. NodeTreePanel.vue (qua SkillPathPanel.vue) lắng nghe event
// này để chạy animation connection→node, không tạo hệ thống unlock
// mới.
const emit = defineEmits<{ unlocked: [node: ProgressionNode] }>()

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { purchaseNode } = useLoadoutActions()

// Skill rework (2026-08-21) — node cấp "Thế tài nguyên" (Hỏa Thế/Thủy
// Thế/...) nhắm THẲNG 1 Skill qua node.effect.skillModifiers (không
// còn CombatEntity.stats chung nữa) — hiện TỔNG hiện tại của skill đó
// (mọi node đã mua cộng dồn), không chỉ riêng phần node này thêm (đã
// có trong node.description).
const affectedSkillStats = computed(() => {
  stateVersion.value

  const skillId = props.node?.effect.skillModifiers?.[0]?.skillId

  if (!skillId) {
    return []
  }

  const skill = gameManager.skillManager.get(skillId)

  return skill ? getActiveSkillResourceStats(skill) : []
})

// Lý do khoá — thuần suy ra từ hasPrerequisite() đã có (không đụng
// core), chỉ để hiện gợi ý, KHÔNG phải nguồn sự thật (canPurchaseNode
// vẫn là nơi quyết định thật ở NodeSystem.ts).
const lockedReasons = computed(() => {
  if (!props.node || props.purchased || props.purchasable) {
    return []
  }

  const reasons: string[] = []

  if (player.skillInsight < props.node.insightCost) {
    reasons.push(`Cần ${props.node.insightCost} Cảm Ngộ (đang có ${player.skillInsight})`)
  }

  for (const prereq of props.node.prerequisites ?? []) {
    if (hasPrerequisite(player.$state, prereq)) {
      continue
    }

    if (prereq.kind === 'node') {
      reasons.push(`Cần lĩnh ngộ trước: ${gameManager.nodeRegistry.get(prereq.nodeId).name}`)
    } else if (prereq.kind === 'realm') {
      reasons.push(`Cần đạt cảnh giới yêu cầu`)
    } else if (prereq.kind === 'element') {
      reasons.push(`Cần mở khoá Hành liên quan`)
    } else if (prereq.kind === 'excludesNode') {
      reasons.push(`Xung khắc với: ${gameManager.nodeRegistry.get(prereq.nodeId).name}`)
    } else {
      reasons.push(`Cần lĩnh ngộ ${prereq.countRequired}/${prereq.nodeIds.length} node liên quan`)
    }
  }

  return reasons
})

function onPurchase() {
  if (!props.node || !props.purchasable) {
    return
  }

  const node = props.node

  if (purchaseNode(node.id)) {
    emit('unlocked', node)
  }
}
</script>

<template>
  <div class="node-inspector">
    <p v-if="!node" class="node-inspector__empty">Chọn một node trong Linh Mạch để xem chi tiết.</p>

    <template v-else>
      <div class="node-inspector__header">
        <span class="node-inspector__name">{{ node.name }}</span>

        <span
          class="node-inspector__state"
          :class="{ 'is-purchased': purchased, 'is-purchasable': !purchased && purchasable }"
        >
          {{ purchased ? 'Đã Lĩnh Ngộ' : purchasable ? 'Có Thể Lĩnh Ngộ' : 'Chưa Đủ Điều Kiện' }}
        </span>
      </div>

      <p v-if="node.description" class="node-inspector__desc">{{ node.description }}</p>

      <ul v-if="lockedReasons.length > 0" class="node-inspector__reasons">
        <li v-for="reason in lockedReasons" :key="reason">{{ reason }}</li>
      </ul>

      <ul v-if="affectedSkillStats.length > 0" class="node-inspector__skill-stats">
        <li v-for="stat in affectedSkillStats" :key="stat.label" v-tooltip="stat.description">
          <span>{{ stat.label }}</span>
          <span>{{ stat.formatted }}</span>
        </li>
      </ul>

      <div class="node-inspector__actions">
        <span class="node-inspector__cost">Chi phí: {{ node.insightCost }} Cảm Ngộ</span>

        <button
          v-if="!purchased"
          type="button"
          class="node-inspector__buy"
          :disabled="!purchasable"
          @click="onPurchase"
        >
          Lĩnh Ngộ
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.node-inspector {
  padding: 10px 14px;
  min-height: 64px;
  background: var(--ink-850, var(--ink-800));
  border-top: 1px solid var(--ink-line);
  font-family: var(--font-body);
  color: var(--text-primary);
}

.node-inspector__empty {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-muted);
  text-align: center;
  padding: 8px 0;
}

.node-inspector__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.node-inspector__name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--gold-500);
}

.node-inspector__state {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.node-inspector__state.is-purchased {
  color: var(--jade);
}

.node-inspector__state.is-purchasable {
  color: var(--gold-500);
}

.node-inspector__desc {
  margin: 4px 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.node-inspector__reasons {
  margin: 4px 0;
  padding-left: 16px;
  font-size: var(--text-sm);
  color: var(--crimson);
}

.node-inspector__skill-stats {
  list-style: none;
  margin: 4px 0;
  padding: 0;
  font-size: var(--text-sm);
}

.node-inspector__skill-stats li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
  color: var(--text-secondary);
}

.node-inspector__skill-stats li span:last-child {
  color: var(--gold-500);
}

.node-inspector__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 6px;
}

.node-inspector__cost {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.node-inspector__buy {
  padding: 6px 16px;
  background: linear-gradient(180deg, #ffe082, #ffb300);
  color: #221a00;
  border: 1px solid #fff3c4;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 0.74rem;
  cursor: pointer;
}

.node-inspector__buy:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
