<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import { PLACEHOLDER_STATIC_TEXTURE_URL, resolveCombatEntityKey, resolvePlayerEntityKey, staticArtFormFor } from '@/presentation/art/CombatPresentationCatalogue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { advanceInitiativeCycle, type InitiativeDisplayCycle } from '@/presentation/combat/CombatInitiativeTrack'
import { getCombatPlaybackSpeed } from '@/presentation/combat/CombatPlaybackSpeed'
import { isInitiativeReadyRequested, isInitiativeSummoned, mountInitiativeView, reportInitiativeTravel } from '@/presentation/combat/CombatInitiativeReady'
import { GAUGE_MAX } from '@/core/battle/turn/ActionGauge'
import type { TurnBattleParticipant } from '@/core/battle/turn/TurnBattleSystem'
const { t } = useI18n()
const { battle, isBattleFighting } = useTurnBattleInfo()
const { stateVersion } = useStateVersion()
const player = usePlayerStore()
const manager = useGameManager()
const displayed = shallowRef<Record<string, InitiativeDisplayCycle>>({})
let frameId = 0
let lastFrame = 0
let displayedBattle: typeof battle.value = null
let releaseView: (() => void) | undefined
function animateTrack(time: number) {
  const delta = lastFrame ? Math.min(100, Math.max(0, time - lastFrame)) : 0
  lastFrame = time
  const current = battle.value
  if (current !== displayedBattle) {
    displayedBattle = current
    displayed.value = {}
  }
  if (!isBattleFighting.value) displayed.value = {}
  else if (!manager.getFreezeReasons().some(reason => reason !== 'turn-in-flight')) {
    const next: Record<string, InitiativeDisplayCycle> = {}
    for (const actor of [...(current?.players ?? []), ...(current?.enemies ?? [])]) {
      if (!actor.entity.alive) continue
      const target = isInitiativeReadyRequested(actor.id) ? 100 : actor.actionGauge / GAUGE_MAX * 100
      next[actor.id] = advanceInitiativeCycle(displayed.value[actor.id], target, delta * getCombatPlaybackSpeed())
      reportInitiativeTravel(actor.id, next[actor.id]!.percent)
    }
    displayed.value = next
  }
  frameId = requestAnimationFrame(animateTrack)
}
onMounted(() => { releaseView = mountInitiativeView(); frameId = requestAnimationFrame(animateTrack) })
onUnmounted(() => { cancelAnimationFrame(frameId); releaseView?.() })
const playerProfile = computed(() => PLAYER_VISUAL_PROFILES[player.visualProfileId] ?? PLAYER_VISUAL_PROFILES.mortal)
const tracks = computed(() => {
  stateVersion.value
  const markers = [...(battle.value?.players ?? []), ...(battle.value?.enemies ?? [])]
    .filter(actor => actor.entity.alive && isInitiativeSummoned(actor.id))
    .map(actor => ({ actor, percent: displayed.value[actor.id]?.percent ?? 0 }))
  return markers.sort((a, b) => a.percent - b.percent || a.actor.speed - b.actor.speed)
})
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

</script>
<template>
  <section v-if="isBattleFighting" class="combat-initiative-track" :aria-label="t('combat.initiative.title')">
    <svg viewBox="0 0 600 48" role="img" :aria-label="t('combat.initiative.title')">
      <defs><linearGradient id="initiative-line" gradientUnits="userSpaceOnUse" x1="24" y1="0" x2="576" y2="0"><stop stop-color="#637c77"/><stop offset="1" stop-color="#c1a66b"/></linearGradient>
        <clipPath id="initiative-avatar-clip"><circle cx="0" cy="0" r="12" /></clipPath>
      </defs>
      <g transform="translate(0, 24)">
        <path d="M24 0H576" fill="none" stroke="url(#initiative-line)" stroke-width="6" opacity=".14" />
        <path d="M24 0H576" fill="none" stroke="url(#initiative-line)" stroke-width="1.4" />
        <g v-for="marker in tracks" :key="marker.actor.id" :data-actor-id="marker.actor.id" :data-progress="marker.percent" :transform="`translate(${24 + marker.percent * 5.52}, 0)`" tabindex="0" role="img" :aria-label="marker.actor.entity.name">
          <g>
            <circle r="14" fill="#111c19" :stroke="battle?.players.some(actor => actor.id === marker.actor.id) ? '#b8cba7' : '#b88369'" stroke-width="1.5" />
            <image :href="avatarUrlFor(marker.actor)" x="-36" y="-12" width="72" height="72" clip-path="url(#initiative-avatar-clip)" />
          </g>
        </g>
      </g>
    </svg>
  </section>
</template>
<style scoped>
.combat-initiative-track { width: 600px; height: 48px; padding: 0; box-sizing: border-box; background: none; pointer-events: auto; }
.combat-initiative-track header { display: flex; align-items: center; justify-content: space-between; font: 600 12px/1.2 var(--font-body); }
.combat-initiative-track header strong { font-family: var(--font-display); }
.combat-initiative-track svg { display: block; width: 100%; height: 48px; overflow: visible; }
.combat-initiative-track svg g[tabindex]:focus { outline: none; filter: drop-shadow(0 0 3px #c7ad70); }
</style>
