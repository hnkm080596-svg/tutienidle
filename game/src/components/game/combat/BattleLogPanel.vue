<script setup lang="ts">
// Slice 7 extension (Completion Task 11) - battle log panel: nhật ký text
// từng lượt (turn-based rất hợp log rời rạc). Newest-last theo thứ tự
// append; giới hạn hiển thị 30 dòng cuối để không phình DOM.
//
// UI-013/Task 8 (2026-09-07) — dock mép phải đè lên log (z stacking đã
// xác nhận ở 9.7): log giờ CÓ nút collapse (che/bung) để người chơi tự
// giải phóng vùng nhìn khi dock che; đóng mặc định khi trận đấu bắt đầu
// bù look, log vẫn đầy đủ khi bung. Long message tự wrap (UI-006).
import { computed, ref } from 'vue'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'

const MAX_VISIBLE = 30

const { isBattleFighting, logEntries } = useTurnBattleInfo()

const collapsed = ref(false)

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
    <button
      type="button"
      class="battle-log-panel__toggle"
      :aria-expanded="!collapsed"
      @click="collapsed = !collapsed"
    >{{ collapsed ? 'Nhật ký ▸' : 'Nhật ký ▾' }}</button>

    <div v-if="!collapsed" class="battle-log-panel__entries">
      <p v-for="(entry, index) in recentEntries" :key="`${entry.turn}-${index}`" class="battle-log-panel__line">
        {{ describe(entry) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.battle-log-panel {
  position: absolute;
  right: 8px;
  bottom: 8px;
  max-width: 260px;
  max-height: 200px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 2px;
  pointer-events: auto;
  font-size: var(--text-xs, 12px);
  color: var(--text-muted, #aaa);
}

.battle-log-panel__toggle {
  align-self: flex-end;
  padding: 2px 8px;
  border: 1px solid var(--surface-line, #333);
  border-radius: var(--radius-sm, 4px);
  background: color-mix(in srgb, var(--ink-950) 70%, transparent);
  color: var(--text-muted, #aaa);
  font-size: var(--text-xs, 12px);
  cursor: pointer;
}

.battle-log-panel__toggle:focus-visible {
  outline: 2px solid var(--jade);
  outline-offset: 1px;
}

.battle-log-panel__entries {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 2px;
}

.battle-log-panel__line {
  margin: 0;
  text-shadow: 0 1px 2px rgb(0 0 0 / 80%);
  /* UI-006 — message dài (skill name/i18n) wrap, không tràn panel. */
  overflow-wrap: anywhere;
}
</style>
