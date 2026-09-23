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
import { useI18n } from 'vue-i18n'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { useStateVersion } from '@/composables/useGameState'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import type { BattleLogEntry } from '@/core/battle/turn/TurnOrderPreview'

const MAX_VISIBLE = 30

const { isBattleFighting, logEntries, participantNameOf } = useTurnBattleInfo()
const { t } = useI18n()
// ARCH-005 (M12): battle.log is append-only MUTATED in place — logEntries
// resolves to the same array reference on every version bump, so a
// computed chained on it alone is never re-invalidated (log panel could
// stay hidden/frozen while entries accumulate). Read the version signal
// directly in every derived projection.
const { stateVersion } = useStateVersion()

const collapsed = ref(false)

const visible = computed(() => {
  stateVersion.value

  return isBattleFighting.value && logEntries.value.length > 0
})

const recentEntries = computed(() => {
  stateVersion.value

  const entries = logEntries.value

  return entries.slice(Math.max(0, entries.length - MAX_VISIBLE))
})

// T4-36 - ids are internal; the log renders participant entity.name +
// TURN_SKILL_DISPLAY_META names, with localized fallbacks instead of
// ever leaking a raw id.
function describe(entry: BattleLogEntry): string {
  const actor = participantNameOf(entry.actorId) ?? t('combat.log.unknownActor')

  if (entry.ccBlocked) {
    return t('combat.log.entryCcBlocked', { turn: entry.turn, actor })
  }

  const skill = entry.skillId
    ? turnSkillDisplayMetaOf(entry.skillId)?.name ?? t('combat.log.unknownSkill')
    : t('combat.log.basicAttack')

  const targetNames = entry.targetIds
    .map((targetId) => participantNameOf(targetId) ?? t('combat.log.unknownActor'))
    .join(', ')

  return t('combat.log.entry', {
    turn: entry.turn,
    actor,
    skill,
    targets: targetNames.length > 0 ? ` → ${targetNames}` : '',
  })
}
</script>

<template>
  <div v-if="visible" class="battle-log-panel">
    <button
      type="button"
      class="battle-log-panel__toggle"
      :aria-expanded="!collapsed"
      @click="collapsed = !collapsed"
    >{{ collapsed ? `${t('combat.log.toggle')} ▸` : `${t('combat.log.toggle')} ▾` }}</button>

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
  color: var(--sys-text-dim, var(--text-muted, #aaa));
}

.battle-log-panel__toggle {
  align-self: flex-end;
  padding: 2px 8px;
  border: 1px solid var(--sys-line-soft, var(--surface-line, #333));
  clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px);
  background: color-mix(in srgb, var(--sys-bg-0, var(--ink-950)) 70%, transparent);
  color: var(--sys-text-dim, var(--text-muted, #aaa));
  font-size: var(--text-xs, 12px);
  cursor: pointer;
}

.battle-log-panel__toggle:focus-visible {
  outline: 2px solid var(--sys-focus, var(--jade));
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
