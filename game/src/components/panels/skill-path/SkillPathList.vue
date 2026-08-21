<script setup lang="ts">
// SkillPathPanel.vue redesign (2026-08-20) — cột trái CHO PATH KHÔNG
// CÓ Node Tree (Kiếm Tu/Phàm Nhân), song song ElementPathList.vue
// (dùng riêng cho phap_tu — chọn HÀNH để lọc cây, khác hẳn ý nghĩa
// "chọn 1 trong các kỹ năng cố định để xem chi tiết" ở đây, nên tách
// component riêng thay vì ép chung 1 shape prop/emit).
import type { Skill } from '@/core/skill/Skill'

const props = defineProps<{
  skills: Skill[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [skill: Skill]
}>()
</script>

<template>
  <div class="skill-path-list">
    <span class="skill-path-list__title">Kỹ Năng</span>

    <button
      v-for="skill in props.skills"
      :key="skill.id"
      type="button"
      class="skill-path-list__card"
      :class="{ 'is-selected': skill.id === selectedId }"
      @click="emit('select', skill)"
    >
      <span class="skill-path-list__label">{{ skill.name }}</span>
      <span class="skill-path-list__meta">Lv. {{ skill.level }}/{{ skill.maxLevel }}</span>
    </button>
  </div>
</template>

<style scoped>
.skill-path-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-path-list__title {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.skill-path-list__card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  color: var(--text-primary);
}

.skill-path-list__card:hover {
  border-color: var(--gold-500);
}

.skill-path-list__card.is-selected {
  border-color: var(--gold-500);
  background: color-mix(in srgb, var(--gold-500) 18%, var(--ink-800));
}

.skill-path-list__label {
  font-size: 0.8rem;
  font-weight: 700;
}

.skill-path-list__meta {
  font-size: 0.62rem;
  color: var(--text-muted);
}
</style>
