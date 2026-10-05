<script setup lang="ts">
// ui-combat reskin (2026-10-04) - framed player vitals card, top-left of
// the battlefield (mock ui-combat.html: ornate avatar + name/realm line +
// skewed HP/MP meters + resource pips + buff chips). Replaces the canvas
// PlayerHudLayer: DOM overlay owns the chrome (huyen-kim slots), the
// canvas stays actor-only.
//
// Reactivity law: the TurnBattle object mutates in place, so EVERY
// computed below reads stateVersion.value directly - same rule as
// useTurnBattleInfo/useTurnCombatManual.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { makeKiemBarReader } from '@/presentation/bridges/kiemBarBridge'
import { makeTheBarReader } from '@/presentation/bridges/theBarBridge'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import { resolvePlayerEntityKey, staticArtFormFor } from '@/presentation/art/CombatPresentationCatalogue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { buffDisplayName } from '@/core/buff2/BuffNames'
import { BUFF_REGISTRY } from '@/data/buff/BuffRegistry'
import { formatNumber } from '@/core/format/NumberFormatter'
import { hkChromeUrl } from '@/ui/huyenKimChrome'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import type { BuffInstanceSnapshot } from '@/core/buff2/BuffInstance'

const { t } = useI18n()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { battle, isBattleInProgress, buffsForTarget } = useTurnBattleInfo()

const kiemReader = makeKiemBarReader(gameManager, () => player)
const theReader = makeTheBarReader(gameManager, () => player)

// The mock's ornate ring around the avatar lives under scene/combat-v2/
// (referenced by ui-combat.html) - it is NOT a manifest slot, so the URL
// resolves through resolveAssetUrl, not hkChromeUrl.
const ornamentRingUrl = resolveAssetUrl(
  '/assets/ui/huyen-kim/scene/combat-v2/ornament-ring-v1.png',
)
const avatarFrameUrl = hkChromeUrl('avatar-frame')

const visible = computed(() => {
  stateVersion.value

  return isBattleInProgress.value
})

// TurnBattle participant shape - the human player's CombatEntity is the
// participant whose entity.id is the literal 'player' (the CombatBuild
// partition gate). With companions in the party, players[0] ordering is
// an assumption; the id gate is the domain's own authority.
const entity = computed(() => {
  stateVersion.value

  return battle.value?.players.find((participant) => participant.entity.id === 'player')
    ?.entity
})

const profile = computed(
  () => PLAYER_VISUAL_PROFILES[player.visualProfileId] ?? PLAYER_VISUAL_PROFILES.mortal,
)

// Avatar = the roster portrait of the armed/unarmed variant the combat
// sprite draws (resolvePlayerEntityKey), falling back to the profile's
// full-body art when the catalogue has no static form.
const avatarUrl = computed(() => {
  const key = resolvePlayerEntityKey(
    profile.value.id,
    profile.value.combatTextureKey,
    { armed: player.visualArmed },
  )

  return (
    staticArtFormFor(key)?.texture.textureUrl ??
    resolveAssetUrl(profile.value.combatTextureUrl)
  )
})

const realmLine = computed(() => {
  const realm = getCurrentRealm(player.realmId)

  return t('home.topBar.realmLine', { realm: realm.name, level: player.realmLevel })
})

const hpPercent = computed(() => {
  const current = entity.value

  if (!current || current.maxHp <= 0) {
    return 0
  }

  return Math.round(Math.min(100, Math.max(0, (current.currentHp / current.maxHp) * 100)))
})

const mpPercent = computed(() => {
  const current = entity.value
  const maxMp = current?.stats.maxMp ?? 0

  if (!current || maxMp <= 0) {
    return 0
  }

  return Math.round(Math.min(100, Math.max(0, (current.currentMp / maxMp) * 100)))
})

// Ward overlays the HP meter (mock fidelity ward fill #cdb875): the plain
// ward pool + the Son Nhac external ward both absorb before HP.
const wardAmount = computed(() => {
  const current = entity.value

  if (!current) {
    return 0
  }

  return current.currentWard + (current.externalWard?.amount ?? 0)
})

const wardPercent = computed(() => {
  const current = entity.value

  if (!current || current.maxHp <= 0) {
    return 0
  }

  return Math.round(Math.min(100, Math.max(0, (wardAmount.value / current.maxHp) * 100)))
})

// Third resource row: kiemBarBridge is the single abstracted reader for
// every path variant (Kiem Pho preset cursor / Kiem Y forge / The Tu An),
// theBarBridge covers the spell-side The pool. Whatever is live renders;
// small caps (<= 10) draw the mock's diamond pips, larger pools draw a
// meter with the snapshot's own label.
const kiemSnapshot = computed(() => {
  stateVersion.value

  return kiemReader()
})

const theSnapshot = computed(() => {
  stateVersion.value

  return theReader()
})

const resource = computed(() => kiemSnapshot.value ?? theSnapshot.value)

const resourcePips = computed(() => {
  const snap = resource.value

  if (!snap || snap.max <= 0 || snap.max > 10) {
    return null
  }

  return {
    label: snap.label,
    filled: Math.min(Math.round(snap.current), snap.max),
    total: snap.max,
  }
})

const resourceMeterPercent = computed(() => {
  const snap = resource.value

  if (!snap || snap.max <= 0 || snap.max <= 10) {
    return null
  }

  return {
    label: snap.label,
    text: `${formatNumber(Math.max(0, Math.ceil(snap.current)))} / ${formatNumber(snap.max)}`,
    percent: Math.round(Math.min(100, Math.max(0, (snap.current / snap.max) * 100))),
  }
})

// Buff chips - same authority + hidden/polarity convention as
// TurnOrderStrip (getBattleBuffs through the ops delegate, BUFF_REGISTRY
// for hidden/polarity/description). Buffs carry no icon field; the chip
// monogram is the display name's first letters, tooltip carries the rest.
const visibleBuffs = computed<BuffInstanceSnapshot[]>(() => {
  stateVersion.value

  const current = entity.value

  if (!current) {
    return []
  }

  return buffsForTarget(current.id).filter(
    (instance) => BUFF_REGISTRY.tryGet(instance.definitionId)?.hidden !== true,
  )
})

function buffChipText(buff: BuffInstanceSnapshot): string {
  const name = buffDisplayName(buff.definitionId)

  return name
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function buffTooltip(buff: BuffInstanceSnapshot): string {
  const definition = BUFF_REGISTRY.tryGet(buff.definitionId)
  const name = buffDisplayName(buff.definitionId)
  const remaining = buff.remaining === undefined ? '∞' : Math.ceil(buff.remaining)
  const stacks = buff.stacks > 1 ? ` ×${buff.stacks}` : ''
  const description = definition?.description ?? ''

  return description
    ? `${name}${stacks} (${remaining}) — ${description}`
    : `${name}${stacks} (${remaining})`
}

function buffPolarity(buff: BuffInstanceSnapshot): string {
  return BUFF_REGISTRY.tryGet(buff.definitionId)?.polarity ?? 'buff'
}
</script>

<template>
  <div v-if="visible && entity" class="combat-player-card" :aria-label="t('combat.overlay.playerCard.title')">
    <InkNineSlice chrome-id="surface-m-panel" layer="surface" />

    <div class="combat-player-card__content">
      <div class="combat-player-card__portrait">
        <img v-if="avatarFrameUrl" class="combat-player-card__avatar-disc" :src="avatarFrameUrl" alt="" aria-hidden="true" />
        <img class="combat-player-card__avatar" :src="avatarUrl" :alt="player.name" />
        <img class="combat-player-card__avatar-ring" :src="ornamentRingUrl" alt="" aria-hidden="true" />
      </div>

      <div class="combat-player-card__body">
        <div class="combat-player-card__identity">
          <span class="combat-player-card__name">{{ player.name }}</span>
          <span class="combat-player-card__level">{{ realmLine }}</span>
        </div>

        <div class="combat-player-card__meters">
          <div class="combat-player-card__meter combat-player-card__meter--hp" role="progressbar" :aria-label="t('combat.overlay.playerCard.hp')" :aria-valuenow="hpPercent" aria-valuemin="0" aria-valuemax="100">
            <span class="combat-player-card__meter-fill" :style="{ width: `${hpPercent}%` }" />
            <span v-if="wardPercent > 0" class="combat-player-card__meter-ward" :style="{ width: `${wardPercent}%` }" :aria-label="t('combat.overlay.playerCard.ward')" />
            <span class="combat-player-card__meter-value">{{ formatNumber(Math.max(0, Math.ceil(entity.currentHp))) }} / {{ formatNumber(Math.ceil(entity.maxHp)) }}</span>
          </div>

          <div v-if="(entity.stats.maxMp ?? 0) > 0" class="combat-player-card__meter combat-player-card__meter--mp" role="progressbar" :aria-label="t('combat.overlay.playerCard.mp')" :aria-valuenow="mpPercent" aria-valuemin="0" aria-valuemax="100">
            <span class="combat-player-card__meter-fill" :style="{ width: `${mpPercent}%` }" />
            <span class="combat-player-card__meter-value">{{ formatNumber(Math.max(0, Math.ceil(entity.currentMp))) }} / {{ formatNumber(Math.ceil(entity.stats.maxMp)) }}</span>
          </div>
        </div>

        <div v-if="resourcePips" class="combat-player-card__pips" :aria-label="resourcePips.label">
          <span
            v-for="pip in resourcePips.total"
            :key="pip"
            class="combat-player-card__pip"
            :class="{ 'is-filled': pip <= resourcePips.filled }"
          />
          <span class="combat-player-card__pip-label">{{ resourcePips.label }}</span>
        </div>
        <div v-else-if="resourceMeterPercent" class="combat-player-card__meter combat-player-card__meter--resource" role="progressbar" :aria-label="resourceMeterPercent.label" :aria-valuenow="resourceMeterPercent.percent" aria-valuemin="0" aria-valuemax="100">
          <span class="combat-player-card__meter-fill" :style="{ width: `${resourceMeterPercent.percent}%` }" />
          <span class="combat-player-card__meter-value">{{ resourceMeterPercent.label }} {{ resourceMeterPercent.text }}</span>
        </div>

        <div v-if="visibleBuffs.length > 0" class="combat-player-card__effects" :aria-label="t('combat.overlay.playerCard.effects')">
          <span
            v-for="buff in visibleBuffs"
            :key="`${buff.instanceId}:${buff.sourceId}`"
            class="combat-player-card__effect"
            :class="`is-${buffPolarity(buff)}`"
            :title="buffTooltip(buff)"
          >{{ buffChipText(buff) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Mock geometry (ui-combat.html, 1366x768 canvas): card 362x170 at
   left:20 top:16 - inside the battlefield that lands just under the top
   bar, so the card anchors left/top with a viewport-scale inset. */
.combat-player-card {
  position: absolute;
  top: 1.8vh;
  left: 1.2vw;
  width: min(21.7vw, 362px);
  min-width: 264px;
  isolation: isolate;
  pointer-events: auto;
  z-index: 12;
}

/* surface-m-panel paints at z-index 1 - content sits above it (same
   sibling rule as CombatAiRail). */
.combat-player-card__content {
  position: relative;
  z-index: 2;
  display: flex;
  gap: 12px;
  padding: 16px 16px 18px;
}

.combat-player-card__portrait {
  position: relative;
  flex: none;
  width: clamp(72px, 6.9vw, 116px);
  aspect-ratio: 1;
}

/* avatar-frame chrome: the dark circular plate under the portrait. */
.combat-player-card__avatar-disc {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
}

.combat-player-card__avatar {
  position: absolute;
  inset: 10%;
  width: 80%;
  height: 80%;
  object-fit: cover;
  border-radius: 50%;
}

/* The mock's gold ornament ring on top of the portrait. */
.combat-player-card__avatar-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.combat-player-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.combat-player-card__identity {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.combat-player-card__name {
  font-family: var(--font-display);
  font-size: clamp(15px, 1.5vw, 25px);
  color: #fff0bf;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.combat-player-card__level {
  font-size: var(--text-xs, 12px);
  color: #d2b565;
}

/* Skewed meters straight from the mock (CombatFidelityMeter): gold
   hairline, dark track, gradient fill, centered value unskewed. */
.combat-player-card__meters {
  display: grid;
  gap: 4px;
}

.combat-player-card__meter {
  position: relative;
  height: 17px;
  transform: skewX(-9deg);
  border: 1px solid #bca469;
  background: #100e0dd9;
  overflow: hidden;
}

.combat-player-card__meter-fill,
.combat-player-card__meter-ward {
  position: absolute;
  inset: 0 auto 0 0;
  display: block;
  transition: width 150ms linear;
}

.combat-player-card__meter--hp .combat-player-card__meter-fill {
  background: linear-gradient(#d05d48, #8b2723 60%, #5b1719);
}

.combat-player-card__meter--mp .combat-player-card__meter-fill {
  background: linear-gradient(#57b9c4, #216a83 65%, #16415b);
}

.combat-player-card__meter--resource .combat-player-card__meter-fill {
  background: linear-gradient(#cdb875, #87754c 65%, #5f4f2e);
}

/* Ward layer paints after the hp fill so it visibly sits on top. */
.combat-player-card__meter-ward {
  left: auto;
  right: 0;
  background: linear-gradient(#e3d29a, #cdb875 60%, #87754c);
  opacity: 0.85;
}

.combat-player-card__meter-value {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  transform: skewX(9deg);
  font-size: 11px;
  font-family: var(--font-body);
  color: #f4e6c0;
  text-shadow: 0 1px 2px #000;
}

/* The mock's diamond pips for small pools (The 5/5, Kiem Pho presets). */
.combat-player-card__pips {
  display: flex;
  align-items: center;
  gap: 5px;
}

.combat-player-card__pip {
  width: 9px;
  height: 9px;
  transform: rotate(45deg);
  border: 1px solid #dcba66;
  background: #141a18cc;
}

.combat-player-card__pip.is-filled {
  background: #dcba66;
  box-shadow: 0 0 5px #dcba6680;
}

.combat-player-card__pip-label {
  margin-left: 4px;
  font-size: var(--text-xs, 12px);
  color: #d2b565;
}

/* Effect chips - polarity-colored squares with a monogram; the full
   name/duration/description ride the title tooltip (no icon field on
   buff defs). */
.combat-player-card__effects {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.combat-player-card__effect {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.combat-player-card__effect.is-buff {
  border: 1px solid #ab935b;
  background: #142d26;
  color: #cfe8c0;
}

.combat-player-card__effect.is-debuff {
  border: 1px solid #a05a4f;
  background: #2d1414;
  color: #f0b8a8;
}

.combat-player-card__effect.is-neutral {
  border: 1px solid var(--hk-border-muted, #5a5a4f);
  background: #1a1d1b;
  color: var(--hk-text-secondary, #c8c2ae);
}
</style>
