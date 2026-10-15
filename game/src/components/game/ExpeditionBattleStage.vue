<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import { presentationFor, resolveCombatEntityKey, resolvePlayerEntityKey } from '@/presentation/art/CombatPresentationCatalogue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import EntitySpriteCanvas from '@/components/common/EntitySpriteCanvas.vue'
import PcPaperButton from '@/components/common/PcPaperButton.vue'

const { t } = useI18n()
const player = usePlayerStore()
const manager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const pulse = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
function stopTimer() {
  if (timer !== undefined) {
    clearInterval(timer)
    timer = undefined
  }
}
watch(
  () => Boolean(player.autoFarmStage),
  (active) => {
    stopTimer()
    if (active) {
      timer = setInterval(() => {
        if (typeof document === 'undefined' || !document.hidden) pulse.value++
      }, 200)
    }
  },
  { immediate: true },
)
onBeforeUnmount(stopTimer)
const view = computed(() => {
  stateVersion.value
  pulse.value
  return manager.turnBattleOps.autoFarmOps.getAutoFarmView(player.$state)
})
const actors = computed(() => {
  const profile = PLAYER_VISUAL_PROFILES[player.visualProfileId]
  const enemyIds = view.value?.enemyIds ?? []
  const index = Math.min(enemyIds.length - 1, Math.floor((view.value?.progress ?? 0) * enemyIds.length))
  return [
    { side: 'player', key: resolvePlayerEntityKey(profile.id, profile.combatTextureKey) },
    { side: 'enemy', key: resolveCombatEntityKey(enemyIds[index] ?? '') },
  ].map(actor => ({ ...actor, art: presentationFor(actor.key) }))
})
// Choreography consumes cycle position only; it never resolves combat or loot.
const motion = computed(() => {
  const fraction = ((view.value?.progress ?? 0) * 6) % 1
  const impact = Math.max(0, Math.sin(fraction * Math.PI * 2))
  return { '--strike': String(impact), '--lunge': `${impact * 30}px`, '--recoil': `${impact * 10}px` }
})
function stop() {
  manager.turnBattleOps.autoFarmOps.stopAutoFarm(player.$state)
  bumpState()
}
</script>

<template>
  <section v-if="view" class="expedition-stage" data-testid="expedition-battle-stage" :aria-label="t('autoFarm.visualReplay')">
    <header><div><span class="seal">{{ t('autoFarm.perfectStage') }}</span><h2>{{ view.stageName }}</h2></div><span class="cycle">{{ t('autoFarm.cycle', { seconds: view.cycleSeconds }) }}</span></header>
    <div class="battle-vista" :style="motion" aria-hidden="true">
      <div class="mountain-mist" /><div class="ground-ring" />
      <div v-for="actor in actors" :key="actor.key" :class="['actor', `actor--${actor.side}`]">
        <EntitySpriteCanvas v-if="actor.art?.kind === 'animated'" :key="actor.key" v-bind="{ sheetUrl: resolveAssetUrl(actor.art.clips.standby.sheetUrl), atlasUrl: resolveAssetUrl(actor.art.clips.standby.atlasUrl), framePrefix: actor.art.clips.standby.framePrefix, frameSuffix: actor.art.clips.standby.frameSuffix, zeroPad: actor.art.clips.standby.zeroPad, firstFrame: actor.art.clips.standby.firstFrame, lastFrame: actor.art.clips.standby.lastFrame, fps: actor.art.clips.standby.frameRate, height: 130 }" />
        <img v-else-if="actor.art?.kind === 'static'" :src="resolveAssetUrl(actor.art.texture.textureUrl)" alt="" draggable="false">
      </div>
      <div class="sword-trail" /><div class="impact" />
      <span class="replay-caption">{{ t('autoFarm.visualReplay') }}</span>
    </div>
    <div class="progress" role="progressbar" :aria-label="t('autoFarm.running', { stage: view.stageName })" :aria-valuenow="Math.round(view.progress * 100)" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: `${view.progress * 100}%` }" /></div>
    <footer><span>{{ t('autoFarm.nextCycle', { seconds: Math.ceil(view.remainingSeconds) }) }}</span><PcPaperButton variant="primary" data-testid="autofarm-stop" @click="stop">{{ t('autoFarm.stop') }}</PcPaperButton></footer>
  </section>
</template>

<style scoped>
.expedition-stage { position:absolute; right:302px; bottom:24px; width:412px; z-index:12; padding:10px; border:3px double #b88e43; border-radius:5px; background:#f6e5bfd9; color:#3e2d18; box-shadow:0 8px 22px #30241055; font-family:var(--pc-font-body,serif); }
header { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:0 3px 8px; }
header>div { display:flex; align-items:center; gap:9px; min-width:0; }
h2 { font-size:17px; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.seal { color:#8b642c; border:1px solid #997031; padding:3px; font-size:12px; white-space:nowrap; }
.cycle { font-size:11px; white-space:nowrap; }
.battle-vista { position:relative; height:158px; overflow:hidden; border:1px solid #a3824d; background:linear-gradient(#26372822,#e7d8ab33),url('/assets/backgrounds/thanh-van/spring/morning/03-battle-ground.png') center 65%/cover; }
.mountain-mist { position:absolute; inset:0; background:linear-gradient(transparent 55%,#f0e3c057); }
.ground-ring { position:absolute; bottom:9px; left:21%; width:58%; height:24px; border:1px solid #fff0a888; border-radius:50%; box-shadow:0 0 12px #fff1be55; }
.actor { position:absolute; bottom:11px; width:130px; height:130px; display:flex; justify-content:center; align-items:flex-end; filter:drop-shadow(0 5px 4px #191d1499); }
.actor img { width:100%; height:100%; object-fit:contain; }
.actor--player { left:40px; transform:translateX(var(--lunge)); }
.actor--enemy { right:33px; transform:translateX(var(--recoil)) scaleX(-1); }
.sword-trail { position:absolute; left:39%; top:53%; width:95px; height:3px; background:linear-gradient(90deg,transparent,#fff7c2,#b3eaff); box-shadow:0 0 8px #f9d76d; transform:rotate(-18deg); opacity:var(--strike); }
.impact { position:absolute; right:98px; top:60px; width:32px; height:32px; border-radius:50%; background:radial-gradient(#fff8d9, #ffe69777 25%,transparent 70%); transform:scale(calc(.5 + var(--strike))); opacity:var(--strike); }
.replay-caption { position:absolute; left:0; right:0; bottom:0; font-size:10px; text-align:center; color:#fff1d5; background:#222e2577; padding:2px; }
.progress { height:5px; margin:8px 0 6px; background:#b79c6870; border-radius:3px; overflow:hidden; }
.progress span { display:block; height:100%; background:linear-gradient(90deg,#48694d,#b49a51); }
footer { display:flex; align-items:center; justify-content:space-between; font-size:12px; gap:8px; }
footer .pc-paper-button { min-height:38px; font-size:14px; padding:6px 16px; }
@media (prefers-reduced-motion: reduce) { .actor--player { transform:none; } .actor--enemy { transform:scaleX(-1); } .sword-trail,.impact { display:none; } }
</style>
