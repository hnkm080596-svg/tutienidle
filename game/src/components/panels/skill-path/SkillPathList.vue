<script setup lang="ts">
// SkillPathPanel.vue redesign (2026-08-20) — cột trái CHO MỌI PATH
// (kể cả Phàm Nhân/Kiếm Tu): "chọn 1 trong các kỹ năng cố định để
// xem chi tiết".
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SkillPathEntry } from './SkillPathEntry'
import { getRealmIndex } from '@/core/realm/realmSystem'
import { REALMS } from '@/data/realms/realm'

const { t } = useI18n()

const props = defineProps<{
  entries: SkillPathEntry[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [entry: SkillPathEntry]
}>()

const groups = computed(() => {
  const byRealm = new Map<string, SkillPathEntry[]>()
  for (const entry of props.entries) {
    const entries = byRealm.get(entry.realmId) ?? []
    entries.push(entry)
    byRealm.set(entry.realmId, entries)
  }
  return [...byRealm.entries()]
    .sort(([left], [right]) => getRealmIndex(left) - getRealmIndex(right))
    .map(([realmId, entries]) => ({
      realmId,
      label: REALMS.find(realm => realm.id === realmId)?.name ?? realmId,
      entries,
    }))
})
</script>

<template>
  <div class="skill-path-list">
    <section v-for="group in groups" :key="group.realmId" class="skill-path-list__group">
      <span class="skill-path-list__title">{{ group.label }}</span>
      <button
        v-for="entry in group.entries"
        :key="entry.id"
        type="button"
        class="skill-path-list__card"
        :class="{ 'is-selected': entry.id === selectedId }"
        @click="emit('select', entry)"
      >
        <span class="skill-path-list__label">{{ entry.name }}</span>
        <span class="skill-path-list__meta">Lv. {{ entry.level }}/{{ entry.maxLevel }}</span>
        <span
          v-if="entry.kind === 'native' && entry.evolutionName !== undefined"
          class="skill-path-list__meta"
        >
          {{ t('panels.skillPath.list.evolution', { name: entry.evolutionName }) }}
        </span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.skill-path-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-path-list__group { display: flex; flex-direction: column; gap: 6px; padding-bottom: 8px; border-bottom: 1px solid var(--ink-line-soft); }

.skill-path-list__title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--paper-eyebrow);
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
  border-color: var(--chrome-300);
}

.skill-path-list__card.is-selected {
  border-color: var(--chrome-300);
  background: color-mix(in srgb, var(--chrome-300) 18%, var(--ink-800));
}

/* Tên skill là thứ người chơi quét mắt tìm đầu tiên trong danh sách —
   trước đây cùng cỡ 13px với tiêu đề nhóm phía trên (2026-08-30
   frontend-design pass). */
.skill-path-list__label {
  font-size: var(--text-md);
  font-weight: 700;
}

.skill-path-list__meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
}
</style>
