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

const props = defineProps<{
  skill: Skill | null
}>()

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
    <p v-if="!skill" class="skill-detail__empty">Chọn một kỹ năng để xem chi tiết.</p>

    <template v-else>
      <h4 class="skill-detail__name">{{ skill.name }}</h4>

      <p v-if="skill.description" class="skill-detail__desc">{{ skill.description }}</p>

      <div class="skill-detail__level">
        <span class="skill-detail__level-label">Lv. {{ skill.level }}/{{ skill.maxLevel }}</span>

        <button
          v-if="!isMaxLevel"
          type="button"
          class="skill-detail__upgrade"
          :disabled="!canUpgrade"
          @click="onUpgrade"
        >
          Nâng Cấp ({{ upgradeCost }} Cảm Ngộ)
        </button>

        <span v-else class="skill-detail__level-label">Tối đa</span>
      </div>

      <ul class="skill-detail__rows">
        <li>
          <span>Hồi Chiêu</span>
          <span>{{ skill.cooldown }}s</span>
        </li>

        <li v-if="skill.resourceType && skill.resourceType !== 'none' && (skill.cost ?? 0) > 0">
          <span>Tiêu Hao</span>
          <span>{{ skill.cost }} {{ skill.resourceType }}</span>
        </li>

        <li v-if="skill.execution?.kind === 'attack_speed'">
          <span>Loại</span>
          <span>Nhịp theo Tốc Độ Đánh</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.skill-detail {
  padding: 4px;
}

.skill-detail__empty {
  margin: 0;
  padding: 40px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.skill-detail__name {
  margin: 0 0 6px;
  font-size: 1rem;
  font-weight: 700;
  color: var(--gold-500);
}

.skill-detail__desc {
  margin: 0 0 10px;
  font-size: 0.8rem;
  color: var(--text-secondary);
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
  color: var(--text-muted);
}

.skill-detail__upgrade {
  flex: 0 0 auto;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--gold-500);
  background: transparent;
  color: var(--gold-500);
  cursor: pointer;
}

.skill-detail__upgrade:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.skill-detail__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.78rem;
}

.skill-detail__rows li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 2px;
  border-bottom: 1px solid var(--ink-line-soft);
  color: var(--text-secondary);
}
</style>
