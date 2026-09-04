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
