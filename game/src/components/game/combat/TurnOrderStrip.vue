<script setup lang="ts">
// Slice 7 extension (Completion Task 11) — turn-order strip: "ai sắp tới
// lượt" (đặc trưng HSR/FF ATB). Render peekUpcomingActors(battle, 5),
// refresh theo stateVersion (không setInterval riêng).
//
// Future Systems Task 10 Step 6 — party status tối thiểu: HP/alive mỗi
// member hiện cạnh turn-order (bare minimum để manual UI dùng được với
// >1 player unit; polish đầy đủ là Party UI spec riêng sau).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { buffDisplayName } from '@/core/battle/turn/TurnBuffNames'
import { TURN_BUFF_REGISTRY } from '@/data/buff/TurnBuffRegistry'
import { GAUGE_MAX } from '@/core/battle/turn/ActionGauge'
import type { TurnBuff } from '@/core/battle/turn/TurnBuffTypes'
import type { TurnBattleParticipant } from '@/core/battle/turn/TurnBattleSystem'

const { t } = useI18n()
const { isBattleFighting, upcomingActors, battle, roundsElapsed, activeStage } = useTurnBattleInfo()

const visible = computed(() => isBattleFighting.value)

const partyMembers = computed(() => battle.value?.players ?? [])

// Combat speed gauge (2026-09-12) — ATB fill on every combatant chip:
// actionGauge / GAUGE_MAX as an integer percent, clamped (a ready actor can
// overfill). Dead members keep their last value but the bar is hidden.
function gaugePercent(actor: TurnBattleParticipant): number {
  return Math.round(Math.min(100, Math.max(0, (actor.actionGauge / GAUGE_MAX) * 100)))
}

// Round indicator (2026-09-12) — the CURRENT round (1-based, i.e.
// roundsElapsed + 1; the PC predicate requires roundsElapsed < limit at
// victory, so the deadline reads "finish before this round completes"),
// and the limit comes from the stage that launched THIS battle (not the
// UI selection). is-over once roundsElapsed >= limit — PC already lost.
const perfectClearLimit = computed(() => activeStage.value?.perfectClearTurnLimit)

const currentRound = computed(() => roundsElapsed.value + 1)

const roundLabel = computed(() =>
  perfectClearLimit.value !== undefined
    ? t('combat.overlay.turnStrip.roundWithLimit', { current: currentRound.value, limit: perfectClearLimit.value })
    : t('combat.overlay.turnStrip.round', { current: currentRound.value }),
)

const isRoundOverLimit = computed(
  () => perfectClearLimit.value !== undefined && roundsElapsed.value >= perfectClearLimit.value,
)

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
        <span
          v-if="member.entity.alive"
          class="turn-order-strip__gauge"
          role="progressbar"
          :aria-valuenow="gaugePercent(member)"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span
            class="turn-order-strip__gauge-fill"
            :class="{ 'is-ready': gaugePercent(member) >= 100 }"
            :style="{ width: `${gaugePercent(member)}%` }"
          />
        </span>
      </span>
    </div>

    <div class="turn-order-strip__order">
      <span class="turn-order-strip__round" :class="{ 'is-over': isRoundOverLimit }">{{ roundLabel }}</span>

      <template v-if="upcomingActors.length > 0">
        <span class="turn-order-strip__title">{{ t('combat.overlay.turnStrip.upcoming') }}</span>

        <ol class="turn-order-strip__list">
          <li
            v-for="(actor, index) in upcomingActors"
            :key="`${actor.id}-${index}`"
            class="turn-order-strip__item"
            :class="{ 'is-current': index === 0, 'is-enemy': actor.entity.type === 'enemy' }"
          >
            {{ label(index) }}{{ actor.entity.name || actor.id }}
            <span
              class="turn-order-strip__gauge"
              role="progressbar"
              :aria-valuenow="gaugePercent(actor)"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <span
                class="turn-order-strip__gauge-fill"
                :class="{ 'is-ready': gaugePercent(actor) >= 100 }"
                :style="{ width: `${gaugePercent(actor)}%` }"
              />
            </span>
          </li>
        </ol>
      </template>
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
  position: relative;
  overflow: hidden;
  padding: 2px 8px 5px;
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
  position: relative;
  overflow: hidden;
  padding: 2px 8px 5px;
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

/* Combat speed gauge (2026-09-12) — thin ATB fill along the bottom edge of
   each combatant chip. Jade for the party, danger for enemies; a full bar
   brightens to signal "ready to act". */
.turn-order-strip__gauge {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: color-mix(in srgb, var(--ink-800, #333) 60%, transparent);
}

.turn-order-strip__gauge-fill {
  display: block;
  height: 100%;
  background: var(--jade, #4caf50);
  transition: width 120ms linear;
}

.turn-order-strip__gauge-fill.is-ready {
  background: var(--gold, #ffd75e);
}

.turn-order-strip__item.is-enemy .turn-order-strip__gauge-fill {
  background: var(--danger, #e53935);
}

/* Round indicator (2026-09-12) — completed ATB rounds (+ perfect-clear
   limit when the launching stage has one). is-over = window missed. */
.turn-order-strip__round {
  padding: 2px 8px;
  border: 1px solid var(--ink-800, #333);
  border-radius: 4px;
  background: color-mix(in srgb, var(--ink-950, #111) 70%, transparent);
  color: var(--gold, #ffd75e);
  white-space: nowrap;
}

.turn-order-strip__round.is-over {
  border-color: color-mix(in srgb, var(--danger, #e53935) 60%, transparent);
  color: var(--danger, #e53935);
}
</style>
