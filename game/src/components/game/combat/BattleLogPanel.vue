<script setup lang="ts">
// Slice 7 extension (Completion Task 11) — battle log panel: nhật ký text
// từng lượt (turn-based rất hợp log rời rạc). Newest-last theo thứ tự
// append; giới hạn hiển thị 30 dòng cuối để không phình DOM.
import { computed } from 'vue'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'

const MAX_VISIBLE = 30

const { isBattleFighting, logEntries } = useTurnBattleInfo()

const visible = computed(() => isBattleFighting.value && logEntries.value.length > 0)

const recentEntries = computed(() => {
  const entries = logEntries.value

  return entries.slice(Math.max(0, entries.length - MAX_VISIBLE))
})

function describe(entry: {
  turn: number
  actorId: string
  skillId: string
  targetIds: string[]
  ccBlocked: boolean
}): string {
  if (entry.ccBlocked) {
    return `Lượt ${entry.turn}: ${entry.actorId} bị khóa (CC)`
  }

  const targets = entry.targetIds.length > 0 ? ` → ${entry.targetIds.join(', ')}` : ''

  return `Lượt ${entry.turn}: ${entry.actorId} dùng ${entry.skillId || 'đòn thường'}${targets}`
}
</script>

<template>
  <div v-if="visible" class="battle-log-panel">
    <p v-for="(entry, index) in recentEntries" :key="`${entry.turn}-${index}`" class="battle-log-panel__line">
      {{ describe(entry) }}
    </p>
  </div>
</template>

<style scoped>
.battle-log-panel {
  position: absolute;
  right: 8px;
  bottom: 8px;
  max-width: 260px;
  max-height: 180px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 2px;
  pointer-events: none;
  font-size: var(--text-xs, 12px);
  color: var(--text-muted, #aaa);
}

.battle-log-panel__line {
  margin: 0;
  text-shadow: 0 1px 2px rgb(0 0 0 / 80%);
}
</style>
