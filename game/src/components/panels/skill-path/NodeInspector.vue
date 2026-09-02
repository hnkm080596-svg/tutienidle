<script setup lang="ts">
// PhapTuPanel plan mục 10/17/29 + node level (combat-skill-flow-element-
// power-dot-plan.md §6.2) — bottom panel: chi tiết node đang CHỌN + nút
// mua/nâng cấp. Node nhiều cấp hiển thị `Cấp x/max`, Power nhận mỗi cấp
// + tổng đang nhận, chi phí cấp kế; nút "Lĩnh Ngộ" ở level 0, "Nâng
// Cấp" từ level 1, trạng thái "Tối đa" khi đạt maxLevel.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useLoadoutActions } from '@/composables/useLoadoutActions'
import GameButton from '@/components/common/GameButton.vue'
import StatRow from '@/components/common/primitives/StatRow.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import {
  getNodeLevel,
  getNextLevelCost,
  hasPrerequisite,
  canUpgradeNode,
} from '@/core/progression/NodeSystem'
import { getActiveSkillResourceStats } from '@/core/skill/SkillResourceStatLabels'
import type { ActiveSkillResourceStat } from '@/core/skill/SkillResourceStatLabels'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'

const { t } = useI18n({ useScope: 'local' })

const props = defineProps<{
  node: ProgressionNode | null
  purchased: boolean
  purchasable: boolean
}>()

const emit = defineEmits<{ unlocked: [node: ProgressionNode] }>()

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { purchaseNode, upgradeNode } = useLoadoutActions()

// Level hiện tại / max / cost cấp kế của node đang chọn.
const level = computed(() => {
  stateVersion.value

  return props.node ? getNodeLevel(player.$state, props.node.id) : 0
})

const maxLevel = computed(() => Math.max(1, props.node?.maxLevel ?? 1))

const nextCost = computed(() => {
  stateVersion.value

  if (!props.node) {
    return null
  }

  return gameManager.getNextNodeCost(props.node.id, player.$state) ?? null
})

const upgradable = computed(() => {
  stateVersion.value

  return props.node ? canUpgradeNode(player.$state, props.node) : false
})

const isMaxed = computed(() => level.value >= maxLevel.value && maxLevel.value > 1)

// Skill rework — node cấp "Thế tài nguyên" nhắm THẲNG 1 Skill qua
// effect.skillModifiers — hiện TỔNG hiện tại của skill đó (đã gồm phần
// node suy ra từ getSkillRuntimeStats(player)). Task 4 (i18n followups
// 2.3) — label/description là locale key, render qua t() ở đây.
const affectedSkillStats = computed(() => {
  stateVersion.value

  const skillId = props.node?.effect.skillModifiers?.[0]?.skillId

  if (!skillId) {
    return []
  }

  const skill = gameManager.skillManager.get(skillId)

  return skill ? getActiveSkillResourceStats(skill) : []
})

// Tham chiếu t() trong getter để reactivity locale theo computed —
// không t() trực tiếp trong template (key động từ data core).
function statLabel(stat: ActiveSkillResourceStat): string {
  return t(stat.labelKey)
}

function statDescription(stat: ActiveSkillResourceStat): string {
  return t(stat.descriptionKey)
}

// Lý do khoá — thuần suy ra từ hasPrerequisite() đã có (không đụng
// core), chỉ để hiện gợi ý, KHÔNG phải nguồn sự thật.
const lockedReasons = computed(() => {
  if (!props.node || props.purchased || props.purchasable || level.value >= 1) {
    return []
  }

  const reasons: string[] = []

  const cost = nextCost.value ?? props.node.insightCost

  if (player.skillInsight < cost) {
    reasons.push(`Cần ${cost} Cảm Ngộ (đang có ${player.skillInsight})`)
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
    } else if (prereq.kind === 'nodeCount') {
      reasons.push(`Cần lĩnh ngộ ${prereq.countRequired}/${prereq.nodeIds.length} node liên quan`)
    } else if (prereq.kind === 'skillCastCount') {
      const skillName = gameManager.skillManager.get(prereq.skillId)?.name ?? prereq.skillId
      const levelPart = prereq.level !== undefined ? `cấp ${prereq.level}` : undefined
      const countPart = prereq.count !== undefined ? `${prereq.count} lần xuất chiêu` : undefined
      const requirement = [levelPart, countPart].filter(Boolean).join(' và ')

      reasons.push(`Cần ${skillName} đạt ${requirement}`)
    } else {
      reasons.push(`Cần nâng kỹ năng liên quan`)
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

function onUpgrade() {
  if (!props.node || !upgradable.value) {
    return
  }

  upgradeNode(props.node.id)
}
</script>

<template>
  <div class="node-inspector">
    <EmptyState v-if="!node" size="lg">Chọn một node trong Linh Mạch để xem chi tiết.</EmptyState>

    <template v-else>
      <div class="node-inspector__header">
        <span class="node-inspector__name">{{ node.name }}</span>

        <!-- Badge `Cấp x/max` cho node nhiều cấp (plan §6.2). -->
        <span v-if="maxLevel > 1" class="node-inspector__level">{{ level }}/{{ maxLevel }}</span>

        <span
          class="node-inspector__state"
          :class="{ 'is-purchased': purchased, 'is-purchasable': !purchased && purchasable }"
        >
          {{ isMaxed ? 'Tối Đa' : purchased ? 'Đã Lĩnh Ngộ' : purchasable ? 'Có Thể Lĩnh Ngộ' : 'Chưa Đủ Điều Kiện' }}
        </span>
      </div>

      <p v-if="node.description" class="node-inspector__desc">{{ node.description }}</p>

      <ul v-if="lockedReasons.length > 0 && level === 0" class="node-inspector__reasons">
        <li v-for="reason in lockedReasons" :key="reason">{{ reason }}</li>
      </ul>

      <ul v-if="affectedSkillStats.length > 0" class="node-inspector__skill-stats">
        <StatRow
          v-for="stat in affectedSkillStats"
          :key="stat.labelKey"
          v-tooltip="statDescription(stat)"
          :label="statLabel(stat)"
          bordered
        >
          <span class="node-inspector__stat-value">{{ stat.formatted }}</span>
        </StatRow>
      </ul>

      <div class="node-inspector__actions">
        <!-- Ẩn NỘI DUNG chi phí khi ĐÃ hiện trong danh sách lý do khoá
             phía trên (2026-08-30 frontend-design pass: 2 chỗ cùng nói
             "Cần X Cảm Ngộ" khi node đang khoá vì thiếu điểm) — giữ span
             rỗng để layout space-between với nút không bị lệch. -->
        <span class="node-inspector__cost">
          {{ lockedReasons.length > 0 && level === 0
            ? ''
            : level === 0
              ? `Chi phí: ${nextCost ?? node.insightCost} Cảm Ngộ`
              : isMaxed
                ? 'Đã đạt cấp tối đa.'
                : `Nâng cấp: ${nextCost} Cảm Ngộ` }}
        </span>

        <GameButton
          v-if="level === 0"
          class="node-inspector__buy"
          size="sm"
          :disabled="!purchasable"
          @click="onPurchase"
        >
          Lĩnh Ngộ
        </GameButton>

        <GameButton
          v-else-if="!isMaxed"
          class="node-inspector__buy"
          size="sm"
          :disabled="!upgradable"
          @click="onUpgrade"
        >
          Nâng Cấp
        </GameButton>
      </div>
    </template>
  </div>
</template>

<style scoped>
.node-inspector {
  padding: 10px 14px;
  min-height: 64px;
  background: var(--ink-800);
  border-top: 1px solid var(--ink-line);
  font-family: var(--font-body);
  color: var(--text-primary);
}

.node-inspector .empty-state {
  padding: 8px 0;
}

.node-inspector__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

/* Tên node là "hero" của khối inspector — trước đây chỉ 14px, gần như
   cùng cỡ mô tả bên dưới (2026-08-30 frontend-design pass). */
.node-inspector__name {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--chrome-100);
}

/* Badge `Cấp x/max` — node nhiều cấp (plan §6.2). */
.node-inspector__level {
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--chrome-300) 55%, transparent);
  font-size: var(--text-xs);
  color: var(--chrome-100);
}

.node-inspector__state {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.node-inspector__state.is-purchased {
  color: var(--jade);
}

.node-inspector__state.is-purchasable {
  color: var(--chrome-100);
}

.node-inspector__desc {
  margin: 4px 0;
  font-size: var(--text-sm);
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

.node-inspector__stat-value {
  color: var(--chrome-100);
}

.node-inspector__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 6px;
}

/* Dòng chi phí đứng ngay cạnh nút hành động — nâng cỡ để dẫn mắt tới
   quyết định thay vì chìm cùng cỡ với mô tả (2026-08-30 pass). */
.node-inspector__cost {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--text-secondary);
}

.node-inspector__buy {
  padding: 6px 16px;
  border: 1px solid var(--chrome-100);
}

.node-inspector__buy:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
