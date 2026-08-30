<script setup lang="ts">
// SkillPathPanel.vue redesign (2026-08-20) — trung tâm panel cho path
// KHÔNG có Node Tree (Kiếm Tu/Phàm Nhân, xem SkillPathList.vue) — đọc
// thông tin kỹ năng ĐÃ có sẵn (cố định theo kit/Trảm). Nâng cấp bằng
// Cảm ngộ Kỹ năng (skill-insight-and-auto-combat-hud-plan.md mục 5)
// ÁP DỤNG CHO MỌI skill đã học, không riêng nhánh phap_tu — khác
// NodeTreePanel.vue/NodeInspector.vue vốn là nơi MỞ node (unlock), còn
// đây là nơi NÂNG CẤP skill đã mở.
import { computed } from 'vue'
import type { Skill } from '@/core/skill/Skill'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import GameButton from '@/components/common/GameButton.vue'
import StatRow from '@/components/common/primitives/StatRow.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'

const props = defineProps<{
  skill: Skill | null
}>()

// 2026-08-30 frontend-design pass — resourceType trước đây in THẲNG
// key nội bộ ('mana'/'sword_intent'/'momentum') ra UI. Nhãn khớp thuật
// ngữ đã dùng ở CombatStatusBar.vue (Linh Lực/Kiếm Ý); "momentum" chưa
// có nhãn Việt hoá nào trong game nên đặt "Đà Thế" cho nhất quán văn
// phong 2 chữ Hán Việt như các resource khác.
const RESOURCE_TYPE_LABELS: Partial<Record<NonNullable<Skill['resourceType']>, string>> = {
  mana: 'Linh Lực',
  sword_intent: 'Kiếm Ý',
  momentum: 'Đà Thế',
}

const resourceTypeLabel = computed(() => {
  const type = props.skill?.resourceType

  return type ? RESOURCE_TYPE_LABELS[type] ?? type : ''
})

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()

const isMaxLevel = computed(() => !!props.skill && props.skill.level >= props.skill.maxLevel)

const upgradeCost = computed(() => {
  stateVersion.value

  if (!props.skill) {
    return undefined
  }

  return gameManager.getSkillUpgradeInsightCost(props.skill.id)
})

const canUpgrade = computed(() => {
  stateVersion.value

  return upgradeCost.value !== undefined && player.skillInsight >= upgradeCost.value
})

function onUpgrade() {
  if (!props.skill) {
    return
  }

  if (gameManager.upgradeSkill(props.skill.id, player.$state)) {
    bumpState()
  }
}
</script>

<template>
  <div class="skill-detail">
    <EmptyState v-if="!skill" size="lg">Chọn một kỹ năng để xem chi tiết.</EmptyState>

    <template v-else>
      <h4 class="skill-detail__name">{{ skill.name }}</h4>

      <p v-if="skill.description" class="skill-detail__desc">{{ skill.description }}</p>

      <div class="skill-detail__level">
        <span class="skill-detail__level-label">Lv. {{ skill.level }}/{{ skill.maxLevel }}</span>

        <GameButton
          v-if="!isMaxLevel"
          class="skill-detail__upgrade"
          variant="ghost"
          size="sm"
          :disabled="!canUpgrade"
          @click="onUpgrade"
        >
          Nâng Cấp ({{ upgradeCost }} Cảm Ngộ)
        </GameButton>

        <span v-else class="skill-detail__level-label">Tối đa</span>
      </div>

      <ul class="skill-detail__rows">
        <StatRow label="Hồi Chiêu" bordered>{{ skill.cooldown }}s</StatRow>

        <StatRow
          v-if="skill.resourceType && skill.resourceType !== 'none' && (skill.cost ?? 0) > 0"
          label="Tiêu Hao"
          bordered
        >
          {{ skill.cost }} {{ resourceTypeLabel }}
        </StatRow>

        <StatRow v-if="skill.execution?.kind === 'attack_speed'" label="Loại" bordered>
          Nhịp theo Tốc Độ Đánh
        </StatRow>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.skill-detail {
  padding: 4px;
}

.skill-detail .empty-state {
  padding: 40px 0;
}

.skill-detail__name {
  margin: 0 0 6px;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--paper-text);
}

.skill-detail__desc {
  margin: 0 0 10px;
  font-size: var(--text-sm);
  color: var(--paper-text-soft);
}

.skill-detail__level {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.skill-detail__level-label {
  flex: 0 0 auto;
  font-size: var(--text-sm);
  color: var(--paper-text-muted);
}

.skill-detail__upgrade {
  flex: 0 0 auto;
  border-radius: 4px;
  color: var(--gold-700);
  border-color: var(--chrome-500);
}

.skill-detail__upgrade:disabled {
  opacity: 0.4;
}

.skill-detail__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: var(--text-sm);
}
</style>
