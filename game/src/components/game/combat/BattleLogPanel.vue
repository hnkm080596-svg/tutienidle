<script setup lang="ts">
// Slice 7 extension (Completion Task 11) - battle log panel: nhat ky text
// tung luot (turn-based rat hop log roi rac). Newest-last theo thu tu
// append; gioi han hien thi 30 dong cuoi de khong phinh DOM.
//
// UI-013/Task 8 (2026-09-07) - dock mep phai de len log (z stacking da
// xac nhan o 9.7): log gio CO nut collapse (che/bung) de nguoi choi tu
// giai phong vung nhin khi dock che; dong mac dinh khi tran dau bat dau
// bu look, log van day du khi bung. Long message tu wrap (UI-006).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { useStateVersion } from '@/composables/useGameState'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import type { BattleLogEntry } from '@/core/battle/turn/TurnOrderPreview'

const MAX_VISIBLE = 30

const { isBattleFighting, logEntries, participantNameOf } = useTurnBattleInfo()
const { t } = useI18n()
// ARCH-005 (M12): battle.log is append-only MUTATED in place - logEntries
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
/* Anchored inside the spec battle-log region (CombatLogFeed owns
   the 1330/620/326/280 placement). */
.battle-log-panel {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 100%;
  max-height: 100%;
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
  /* UI-006 - message dai (skill name/i18n) wrap, khong tran panel. */
  overflow-wrap: anywhere;
}
</style>
