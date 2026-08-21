<script setup lang="ts">
// SkillPathPanel.vue redesign (2026-08-20) — trung tâm panel cho path
// KHÔNG có Node Tree (Kiếm Tu/Phàm Nhân, xem SkillPathList.vue) — chỉ
// đọc thông tin kỹ năng ĐÃ có sẵn (cố định theo kit/Trảm), không có
// hành động mua/nâng cấp nào ở đây (khác NodeTreePanel.vue/
// NodeInspector.vue của nhánh phap_tu).
import { computed } from 'vue'
import type { Skill } from '@/core/skill/Skill'

const props = defineProps<{
  skill: Skill | null
}>()

const levelPercent = computed(() => {
  if (!props.skill || props.skill.maxLevel <= 0) {
    return 0
  }

  return Math.min(100, (props.skill.level / props.skill.maxLevel) * 100)
})
</script>

<template>
  <div class="skill-detail">
    <p v-if="!skill" class="skill-detail__empty">Chọn một kỹ năng để xem chi tiết.</p>

    <template v-else>
      <h4 class="skill-detail__name">{{ skill.name }}</h4>

      <p v-if="skill.description" class="skill-detail__desc">{{ skill.description }}</p>

      <div class="skill-detail__level">
        <div class="skill-detail__level-bar">
          <div class="skill-detail__level-fill" :style="{ width: `${levelPercent}%` }" />
        </div>

        <span class="skill-detail__level-label">Lv. {{ skill.level }}/{{ skill.maxLevel }}</span>
      </div>

      <ul class="skill-detail__rows">
        <li>
          <span>Hồi Chiêu</span>
          <span>{{ skill.cooldown }}s</span>
        </li>

        <li v-if="skill.resourceType && skill.resourceType !== 'none' && skill.cost > 0">
          <span>Tiêu Hao</span>
          <span>{{ skill.cost }} {{ skill.resourceType }}</span>
        </li>

        <li v-if="skill.isBasicAttack">
          <span>Loại</span>
          <span>Chiêu Cơ Bản</span>
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
  gap: 8px;
  margin-bottom: 10px;
}

.skill-detail__level-bar {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: var(--ink-700);
  overflow: hidden;
}

.skill-detail__level-fill {
  height: 100%;
  background: var(--gold-500);
}

.skill-detail__level-label {
  flex: 0 0 auto;
  font-size: 0.7rem;
  color: var(--text-muted);
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
