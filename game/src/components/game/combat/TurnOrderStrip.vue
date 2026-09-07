<script setup lang="ts">
// Slice 7 extension (Completion Task 11) — turn-order strip: "ai sắp tới
// lượt" (đặc trưng HSR/FF ATB). Render peekUpcomingActors(battle, 5),
// refresh theo stateVersion (không setInterval riêng).
//
// Future Systems Task 10 Step 6 — party status tối thiểu: HP/alive mỗi
// member hiện cạnh turn-order (bare minimum để manual UI dùng được với
// >1 player unit; polish đầy đủ là Party UI spec riêng sau).
import { computed } from 'vue'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { buffDisplayName } from '@/core/battle/turn/TurnBuffNames'
import { TURN_BUFF_REGISTRY } from '@/data/buff/TurnBuffRegistry'
import type { TurnBuff } from '@/core/battle/turn/TurnBuffTypes'

const { isBattleFighting, upcomingActors, battle } = useTurnBattleInfo()

const visible = computed(() => isBattleFighting.value)

const partyMembers = computed(() => battle.value?.players ?? [])

function hpPercent(entity: { currentHp: number; maxHp: number }): number {
  if (entity.maxHp <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, (entity.currentHp / entity.maxHp) * 100))
}

function label(index: number): string {
  const actor = upcomingActors.value[index]

  if (!actor) {
    return ''
  }

  return index === 0 ? '▶ ' : ''
}

// Phase A6 (2026-09-08) — visible buff badges for a party member's chip:
// hidden buffs skipped (same convention as the buff pipeline), badge text
// = name ×stacks (remainingTurns), title = description tooltip. Read-only
// over TurnBuffPool (P17).
function visibleBuffs(member: { buffs: { getAll(): TurnBuff[] } }): TurnBuff[] {
  return member.buffs.getAll().filter((buff) => !buff.hidden)
}

function buffBadgeText(buff: TurnBuff): string {
  const name = buffDisplayName(buff.id)

  return buff.stacks > 1 ? `${name} ×${buff.stacks} (${Math.ceil(buff.remainingTurns)})` : `${name} (${Math.ceil(buff.remainingTurns)})`
}

function buffTooltip(buff: TurnBuff): string {
  const definition = (() => {
    try {
      return TURN_BUFF_REGISTRY.get(buff.id)
    } catch {
      return undefined
    }
  })()

  const description = definition?.description ?? ''

  return description ? `${buffDisplayName(buff.id)} — ${description}` : buffDisplayName(buff.id)
}
</script>

<template>
  <div v-if="visible" class="turn-order-strip">
    <div v-if="partyMembers.length > 0" class="turn-order-strip__party">
      <span
        v-for="member in partyMembers"
        :key="member.id"
        class="turn-order-strip__member"
        :class="{ 'is-dead': !member.entity.alive }"
      >
        {{ member.entity.name || member.id }}
        <span class="turn-order-strip__member-hp">{{ Math.max(0, Math.ceil(member.entity.currentHp)) }}/{{ member.entity.maxHp }}</span>
        <span v-if="!member.entity.alive" class="turn-order-strip__member-dead">†</span>
        <span
          v-for="buff in visibleBuffs(member)"
          :key="`${buff.id}:${buff.sourceId}`"
          class="turn-order-strip__buff"
          :class="`is-${buff.polarity}`"
          :title="buffTooltip(buff)"
        >{{ buffBadgeText(buff) }}</span>
      </span>
    </div>

    <div v-if="upcomingActors.length > 0" class="turn-order-strip__order">
      <span class="turn-order-strip__title">Lượt tới</span>

      <ol class="turn-order-strip__list">
        <li
          v-for="(actor, index) in upcomingActors"
          :key="`${actor.id}-${index}`"
          class="turn-order-strip__item"
          :class="{ 'is-current': index === 0 }"
        >
          {{ label(index) }}{{ actor.entity.name || actor.id }}
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.turn-order-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
  font-size: var(--text-xs, 12px);
}

.turn-order-strip__party {
  display: flex;
  gap: 8px;
}

.turn-order-strip__member {
  padding: 2px 8px;
  border: 1px solid var(--ink-800, #333);
  border-radius: 4px;
  background: color-mix(in srgb, var(--ink-950, #111) 70%, transparent);
  color: var(--text-primary, #eee);
  white-space: nowrap;
}

.turn-order-strip__member-hp {
  color: var(--jade, #4caf50);
}

.turn-order-strip__member.is-dead {
  opacity: 0.45;
}

.turn-order-strip__member-dead {
  color: var(--danger, #e53935);
}

/* Phase A6 — buff duration badges (buff = jade, debuff = danger). */
.turn-order-strip__buff {
  padding: 1px 4px;
  border-radius: 3px;
  font-size: var(--text-2xs, 10px);
}

.turn-order-strip__buff.is-buff {
  background: color-mix(in srgb, var(--jade, #4caf50) 25%, transparent);
  color: var(--jade, #4caf50);
}

.turn-order-strip__buff.is-debuff {
  background: color-mix(in srgb, var(--danger, #e53935) 25%, transparent);
  color: var(--danger, #e53935);
}

.turn-order-strip__order {
  display: flex;
  align-items: center;
  gap: 8px;
}

.turn-order-strip__title {
  color: var(--text-muted, #999);
}

.turn-order-strip__list {
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.turn-order-strip__item {
  padding: 2px 8px;
  border: 1px solid var(--ink-800, #333);
  border-radius: 4px;
  background: color-mix(in srgb, var(--ink-950, #111) 70%, transparent);
  color: var(--text-primary, #eee);
  white-space: nowrap;
}

.turn-order-strip__item.is-current {
  border-color: var(--jade, #4caf50);
  color: var(--jade, #4caf50);
}
</style>
