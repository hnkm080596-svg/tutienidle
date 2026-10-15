<script setup lang="ts">
// The card renders detached combat facts. Gameplay authorities own vitals,
// resources and skill actions; frame art is independent of those values.
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
import GameCard from '@/components/common/GameCard.vue'
import CombatVitalMeter from './CombatVitalMeter.vue'
import TurnCombatSkillBar from './TurnCombatSkillBar.vue'
import { useCombatPlayerVitals } from '@/composables/useCombatPlayerVitals'
import type { BuffInstanceSnapshot } from '@/core/buff2/BuffInstance'

const { t } = useI18n()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { buffsForTarget } = useTurnBattleInfo()
const { entity, hpPercent, isBattleInProgress } = useCombatPlayerVitals()

const kiemReader = makeKiemBarReader(gameManager, () => player)
const theReader = makeTheBarReader(gameManager, () => player)

const avatarFrameUrl = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/combat/player-card/avatar-ring-v1.png')
const cardFrameUrl = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/combat/player-card/frame-v1.png')

const visible = computed(() => {
  stateVersion.value

  return isBattleInProgress.value
})

// TurnBattle participant shape - the human player's CombatEntity is the
// participant whose entity.id is the literal 'player' (the CombatBuild
// partition gate). With companions in the party, players[0] ordering is
// an assumption; the id gate is the domain's own authority.

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
  <GameCard v-if="visible && entity" class="combat-player-card" :frame-src="cardFrameUrl" :aria-label="t('combat.overlay.playerCard.title')">
    <div class="combat-player-card__content">
      <div class="combat-player-card__portrait">
        <div class="combat-player-card__portrait-crop"><img class="combat-player-card__avatar" :src="avatarUrl" :alt="player.name" /></div>
        <img class="combat-player-card__avatar-ring" :src="avatarFrameUrl" alt="" aria-hidden="true" />
      </div>
      <div class="combat-player-card__identity">
        <span class="combat-player-card__name">{{ player.name }}</span>
        <span class="combat-player-card__level">{{ realmLine }}</span>
      </div>
      <div class="combat-player-card__body">
        <CombatVitalMeter :label="t('combat.overlay.playerCard.hp')" :percent="hpPercent" :ward-percent="wardPercent" :text="`${formatNumber(Math.max(0, Math.ceil(entity.currentHp)))} / ${formatNumber(Math.ceil(entity.maxHp))}`" />
        <CombatVitalMeter v-if="(entity.stats.maxMp ?? 0) > 0" tone="mp" :label="t('combat.overlay.playerCard.mp')" :percent="mpPercent" :text="`${formatNumber(Math.max(0, Math.ceil(entity.currentMp)))} / ${formatNumber(Math.ceil(entity.stats.maxMp))}`" />
        <div v-if="resourcePips" class="combat-player-card__pips" :aria-label="resourcePips.label">
          <span class="combat-player-card__pip-label">{{ resourcePips.label }}</span>
          <span v-for="pip in resourcePips.total" :key="pip" class="combat-player-card__pip" :class="{ 'is-filled': pip <= resourcePips.filled }" />
        </div>
        <CombatVitalMeter v-else-if="resourceMeterPercent" tone="resource" :label="resourceMeterPercent.label" :percent="resourceMeterPercent.percent" :text="resourceMeterPercent.text" />
        <TurnCombatSkillBar card class="combat-player-card__skills" />
        <div v-if="visibleBuffs.length > 0" class="combat-player-card__effects" :aria-label="t('combat.overlay.playerCard.effects')">
          <span v-for="buff in visibleBuffs" :key="`${buff.instanceId}:${buff.sourceId}`" class="combat-player-card__effect" :class="`is-${buffPolarity(buff)}`" v-tooltip="{ title: buffDisplayName(buff.definitionId), description: buffTooltip(buff) }">{{ buffChipText(buff) }}</span>
        </div>
      </div>
    </div>
  </GameCard>
</template>
<style scoped>
.combat-player-card.game-card {
  --game-card-frame-top: 0px;
  --game-card-frame-slice: 200 330;
  --game-card-frame-width: 20px;
  position: absolute; right: 24px; top: 154px; width: 480px; min-width: 0;
  padding: 16px; isolation: isolate; pointer-events: auto; z-index: 12;
  container-type: inline-size;
}
.combat-player-card :deep(.game-card__fill) { inset: 10px; background: #151610 url('/assets/ui/tien-hiep-2026-10/combat/player-card/backdrop-v1.png') center / 100% 100%; clip-path: inset(0 round 3px); }
.combat-player-card :deep(.game-card__frame) { clip-path: none; }
.combat-player-card__content { position: relative; display: grid; grid-template-columns: 30% minmax(0, 1fr); grid-template-rows: 54px auto; column-gap: 12px; min-width: 0; }
.combat-player-card__portrait { position: relative; grid-row: 1 / 3; align-self: center; width: 100%; aspect-ratio: 1; }
.combat-player-card__portrait-crop { position: absolute; inset: 14%; overflow: hidden; border-radius: 50%; background: #d5c4a1; }
.combat-player-card__avatar { position: absolute; width: 300%; height: 300%; left: -100%; top: -8%; object-fit: cover; }
.combat-player-card__avatar-ring { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.combat-player-card__identity { display: flex; flex-direction: column; justify-content: center; gap: 4px; min-width: 0; padding-bottom: 10px; color: #291d0e; }
.combat-player-card__name { font: 700 23px/1.1 var(--font-display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.combat-player-card__level { font: 600 12px/1.2 var(--font-body); }
.combat-player-card__body { min-width: 0; display: flex; flex-direction: column; gap: 5px; padding-top: 8px; }
.combat-player-card__skills { margin-top: 4px; }
.combat-player-card__pips { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; min-height: 16px; }
.combat-player-card__pip { width: 8px; height: 8px; transform: rotate(45deg); border: 1px solid #cfad68; background: #151610; }
.combat-player-card__pip.is-filled { background: #cfad68; }
.combat-player-card__pip-label { color: #ead4a7; font-size: 11px; margin-right: 5px; }
.combat-player-card__effects { display: flex; flex-wrap: wrap; gap: 4px; }
.combat-player-card__effect { width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid #ab935b; background: #142d26; color: #cfe8c0; font-size: 10px; }
.combat-player-card__effect.is-debuff { border-color: #a05a4f; background: #2d1414; color: #f0b8a8; }
.combat-player-card__effect.is-neutral { background: #1a1d1b; color: #c8c2ae; }
</style>
