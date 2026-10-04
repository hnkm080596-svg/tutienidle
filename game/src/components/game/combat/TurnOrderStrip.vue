<script setup lang="ts">
// Slice 7 extension (Completion Task 11) - turn-order strip: "ai sap toi
// luot" (dac trung HSR/FF ATB). Render peekUpcomingActors(battle, 5),
// refresh theo stateVersion (khong setInterval rieng).
//
// Future Systems Task 10 Step 6 - party status toi thieu: HP/alive moi
// member hien canh turn-order (bare minimum de manual UI dung duoc voi
// >1 player unit; polish day du la Party UI spec rieng sau).
//
// ui-combat reskin (2026-10-04): the mock's framed rail centers a row of
// round portrait chips (ornament ring + circular art), the current actor
// enlarged with a gold glow + diamond marker and a '>' arrow at the tail.
// The rail now wears the surface-m-panel chrome; chips carry the avatar
// image inside the turn-token disc, and the ATB gauge moved OUT of the
// chip face into its own bottom row - the old absolute overlay is what
// clipped the actor names.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatNumber } from '@/core/format/NumberFormatter'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { useStateVersion } from '@/composables/useGameState'
import { hkChromeUrl } from '@/ui/huyenKimChrome'
import { usePlayerStore } from '@/stores/player'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import {
  PLACEHOLDER_STATIC_TEXTURE_URL,
  resolveCombatEntityKey,
  resolvePlayerEntityKey,
  staticArtFormFor,
} from '@/presentation/art/CombatPresentationCatalogue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'

// Scene 13 spec: upcoming actors render as turn-token chips.
const turnTokenUrl = hkChromeUrl('turn-token')
import { buffDisplayName } from '@/core/buff2/BuffNames'
import { BUFF_REGISTRY } from '@/data/buff/BuffRegistry'
import { GAUGE_MAX } from '@/core/battle/turn/ActionGauge'
import type { BuffInstanceSnapshot } from '@/core/buff2/BuffInstance'
import type { TurnBattleParticipant } from '@/core/battle/turn/TurnBattleSystem'

const { t } = useI18n()
const { isBattleFighting, upcomingActors, battle, roundsElapsed, activeStage, buffsForTarget } =
  useTurnBattleInfo()
// ARCH-005 (M12): derived projections read the version signal directly -
// `battle` resolves to the same in-place-mutated object forever, so a
// computed chained on it never re-invalidates (same rule as
// useTurnBattleInfo/useTurnCombatManual).
const { stateVersion } = useStateVersion()

const player = usePlayerStore()

const playerProfile = computed(
  () => PLAYER_VISUAL_PROFILES[player.visualProfileId] ?? PLAYER_VISUAL_PROFILES.mortal,
)

const visible = computed(() => {
  stateVersion.value

  return isBattleFighting.value
})

const partyMembers = computed(() => {
  stateVersion.value

  return battle.value?.players ?? []
})

// ui-combat reskin - chip portrait = the same art the combat sprite
// draws: the human player's entity (literal entity.id === 'player', the
// CombatBuild partition gate) resolves through the visual-profile path;
// every other actor - enemies AND player-type allies/companions - goes
// through the runtime-id catalogue lookup, exactly like grid-view.
// The shared placeholder texture is the last fallback.
function avatarUrlFor(actor: TurnBattleParticipant): string {
  const entityKey =
    actor.entity.id === 'player'
      ? resolvePlayerEntityKey(playerProfile.value.id, playerProfile.value.combatTextureKey, {
          armed: player.visualArmed,
        })
      : resolveCombatEntityKey(actor.entity.id)

  return resolveAssetUrl(
    staticArtFormFor(entityKey)?.texture.textureUrl ?? PLACEHOLDER_STATIC_TEXTURE_URL,
  )
}

// Combat speed gauge (2026-09-12) - ATB fill on every combatant chip:
// actionGauge / GAUGE_MAX as an integer percent, clamped (a ready actor can
// overfill). Dead members keep their last value but the bar is hidden.
function gaugePercent(actor: TurnBattleParticipant): number {
  return Math.round(Math.min(100, Math.max(0, (actor.actionGauge / GAUGE_MAX) * 100)))
}

// Round indicator (2026-09-12) - the CURRENT round (1-based, i.e.
// roundsElapsed + 1; the PC predicate requires roundsElapsed < limit at
// victory, so the deadline reads "finish before this round completes"),
// and the limit comes from the stage that launched THIS battle (not the
// UI selection). is-over once roundsElapsed >= limit - PC already lost.
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

// Phase A6 (2026-09-08) - visible buff badges for a party member's chip:
// hidden buffs skipped (same convention as the buff pipeline), badge text
// = name xstacks (remaining), title = description tooltip. buff2 M4:
// snapshots come from the battle's buff authority via the composable;
// def metadata (hidden/description) resolves through BUFF_REGISTRY.
// Read-only (P17).
function visibleBuffs(member: TurnBattleParticipant): BuffInstanceSnapshot[] {
  return buffsForTarget(member.entity.id).filter(
    (instance) => BUFF_REGISTRY.tryGet(instance.definitionId)?.hidden !== true,
  )
}

function buffBadgeText(buff: BuffInstanceSnapshot): string {
  const name = buffDisplayName(buff.definitionId)
  const remaining = buff.remaining === undefined ? '∞' : Math.ceil(buff.remaining)

  return buff.stacks > 1 ? `${name} ×${buff.stacks} (${remaining})` : `${name} (${remaining})`
}

function buffTooltip(buff: BuffInstanceSnapshot): string {
  const definition = BUFF_REGISTRY.tryGet(buff.definitionId)

  const description = definition?.description ?? ''

  return description
    ? `${buffDisplayName(buff.definitionId)} — ${description}`
    : buffDisplayName(buff.definitionId)
}

function buffPolarity(buff: BuffInstanceSnapshot): string {
  return BUFF_REGISTRY.tryGet(buff.definitionId)?.polarity ?? 'buff'
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
        <span class="turn-order-strip__member-name">{{ member.entity.name || member.id }}</span>
        <span class="turn-order-strip__member-hp">{{ formatNumber(Math.max(0, Math.ceil(member.entity.currentHp))) }}/{{ formatNumber(Math.max(0, Math.ceil(member.entity.maxHp))) }}</span>
        <span v-if="!member.entity.alive" class="turn-order-strip__member-dead">†</span>
        <span
          v-for="buff in visibleBuffs(member)"
          :key="`${buff.instanceId}:${buff.sourceId}`"
          class="turn-order-strip__buff"
          :class="`is-${buffPolarity(buff)}`"
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
      <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
      <span class="turn-order-strip__round" :class="{ 'is-over': isRoundOverLimit }">{{ roundLabel }}</span>

      <template v-if="upcomingActors.length > 0">
        <span class="turn-order-strip__title">{{ t('combat.overlay.turnStrip.upcoming') }}</span>

        <ol class="turn-order-strip__list">
          <li
            v-for="(actor, index) in upcomingActors"
            :key="`${actor.id}-${index}`"
            class="turn-order-strip__item"
            :class="{ 'is-current': index === 0, 'is-enemy': actor.entity.type === 'enemy' }"
            :aria-label="actor.entity.name || actor.id"
            :aria-current="index === 0 ? 'step' : undefined"
          >
            <span class="turn-order-strip__portrait">
              <img v-if="turnTokenUrl" class="turn-order-strip__token" :src="turnTokenUrl" alt="" aria-hidden="true" />
              <img class="turn-order-strip__avatar" :src="avatarUrlFor(actor)" alt="" draggable="false" />
              <span v-if="index === 0" class="turn-order-strip__current-mark" aria-hidden="true">◆</span>
            </span>
            <span class="turn-order-strip__actor-name">{{ actor.entity.name || actor.id }}</span>
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
        <span class="turn-order-strip__rail-arrow" aria-hidden="true">›</span>
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

/* ui-combat reskin - party chips share the rail's dark-ink/gold grammar
   and wrap their contents so the ATB gauge (own row) and buff badges
   never overlap the name/hp text. */
.turn-order-strip__member {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 5px;
  max-width: 180px;
  padding: 3px 9px;
  border: 1px solid #b69b5866;
  border-radius: 4px;
  background: #0c1616d0;
  color: var(--text-primary, #eee);
}

.turn-order-strip__member-name {
  font-family: var(--font-display);
  color: #efdba1;
  /* Long unbroken player names used to be able to push the 180px chip
     - ellipsis inside the flex row keeps the chip bounded. */
  min-width: 0;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

/* Phase A6 - buff duration badges (buff = jade, debuff = danger). */
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

/* The framed rail (ui-combat reskin): surface-m-panel chrome behind the
   round indicator, the 'Upcoming' caption and the portrait chips. */
.turn-order-strip__order {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 26px 8px 14px;
}

.turn-order-strip__order > :not(.ink-nine-slice) {
  position: relative;
  z-index: 2;
}

.turn-order-strip__title {
  font-family: var(--font-display);
  font-size: var(--text-xs, 12px);
  color: #e4cf95;
  white-space: nowrap;
}

.turn-order-strip__list {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin: 0;
  padding: 0 4px;
  list-style: none;
  overflow-x: auto;
  max-width: 42vw;
  scrollbar-width: none;
}

/* Portrait chip (ui-combat reskin): a column of ring portrait -> name
   caption -> gauge row. Nothing absolute inside the text rows, so the
   gauges can no longer clip the names. */
.turn-order-strip__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: none;
  gap: 2px;
  width: 56px;
  color: var(--text-primary, #eee);
  opacity: 0.85;
}

.turn-order-strip__item.is-current {
  opacity: 1;
}

.turn-order-strip__portrait {
  position: relative;
  width: 42px;
  aspect-ratio: 1;
  transition: width 0.15s ease;
}

/* turn-token chrome ring behind the circular avatar (scene 13). */
.turn-order-strip__token {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.turn-order-strip__avatar {
  position: absolute;
  inset: 12%;
  width: 76%;
  height: 76%;
  border-radius: 50%;
  object-fit: cover;
  background: #142321;
}

.turn-order-strip__item.is-enemy .turn-order-strip__avatar {
  filter: saturate(0.7);
}

.turn-order-strip__item.is-current .turn-order-strip__portrait {
  width: 52px;
  filter: drop-shadow(0 0 7px #d2a94c);
}

/* The mock's diamond marker under the current actor's portrait. */
.turn-order-strip__current-mark {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: #ffe6a5;
}

.turn-order-strip__actor-name {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--text-2xs, 10px);
  color: #efdba1;
}

.turn-order-strip__item.is-current .turn-order-strip__actor-name {
  color: #ffe8a4;
}

/* Combat speed gauge - now a dedicated bottom row of the chip column
   (used to be an absolute overlay across the name text). Jade for the
   party, crimson for enemies; a full bar brightens to signal ready. */
.turn-order-strip__gauge {
  display: block;
  width: 100%;
  height: 3px;
  background: color-mix(in srgb, var(--ink-800, #333) 60%, transparent);
}

.turn-order-strip__member .turn-order-strip__gauge {
  flex: 0 0 100%;
  margin-top: 1px;
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

/* Round indicator (2026-09-12) - completed ATB rounds (+ perfect-clear
   limit when the launching stage has one). is-over = window missed. */
.turn-order-strip__round {
  padding: 3px 10px;
  border: 1px solid #b69b58;
  border-radius: 4px;
  background: #0c1616d0;
  color: #e8cd8d;
  font-family: var(--font-display);
  white-space: nowrap;
}

.turn-order-strip__round.is-over {
  border-color: color-mix(in srgb, var(--danger, #e53935) 60%, transparent);
  color: var(--danger, #e53935);
}

/* The mock's '>' tail on the framed rail. */
.turn-order-strip__rail-arrow {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-52%);
  font-size: 22px;
  color: #e7c977;
}
</style>
