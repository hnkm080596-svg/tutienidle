<script setup lang="ts">
import { computed } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { formatNumber } from '@/core/format/NumberFormatter'

const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const active = computed(() => { stateVersion.value; return gameManager.getActiveTribulation() })
const battle = computed(() => { stateVersion.value; return gameManager.getBattle() })
const seconds = computed(() => Math.max(0, Math.ceil(active.value?.secondsRemaining ?? 0)))
const hp = computed(() => battle.value?.player.currentHp ?? 0)
const maxHp = computed(() => battle.value?.player.maxHp ?? 1)
const hpPercent = computed(() => Math.max(0, Math.min(100, hp.value / maxHp.value * 100)))
const timePercent = computed(() => active.value ? active.value.secondsRemaining / active.value.durationSeconds * 100 : 0)
</script>

<template>
  <div v-if="active" class="tribulation-ui">
    <div class="tribulation-ui__timer-cluster">
      <div class="tribulation-ui__timer">{{ seconds }}s</div>
      <div class="tribulation-ui__time-track"><div :style="{ width: `${timePercent}%` }" /></div>
    </div>
    <div class="tribulation-ui__hp-cluster">
      <div class="tribulation-ui__hp-track"><div :style="{ width: `${hpPercent}%` }" /></div>
      <div class="tribulation-ui__hp">HP {{ formatNumber(Math.ceil(hp)) }} / {{ formatNumber(maxHp) }}</div>
      <div class="tribulation-ui__hint">Sống sót cho tới khi thiên kiếp kết thúc</div>
    </div>
  </div>
</template>

<style scoped>
/* Neo theo tỉ lệ viewport khớp TribulationScene.ts: title scene ở 0.17h,
   player ở 0.62h — DOM dùng calc(% + px) thay hằng số px cứng. */
.tribulation-ui { position:absolute; inset:0; z-index:15; pointer-events:none; color:var(--scene-tribulation-text); text-align:center; }
.tribulation-ui__timer-cluster,.tribulation-ui__hp-cluster { position:absolute; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; }
.tribulation-ui__timer-cluster { top:calc(17% + 40px); }
.tribulation-ui__hp-cluster { top:calc(62% + 84px); }
.tribulation-ui__timer { font-size:var(--text-display-lg); font-weight:800; text-shadow:0 0 14px var(--scene-tribulation-glow); }
.tribulation-ui__time-track,.tribulation-ui__hp-track { width:min(340px, 80vw); height:8px; margin-top:8px; overflow:hidden; border:1px solid var(--scene-tribulation-line); border-radius:8px; background:var(--scene-tribulation-deep); }
.tribulation-ui__time-track div { height:100%; margin-left:auto; background:linear-gradient(90deg,var(--scene-tribulation-time),color-mix(in srgb, var(--scene-tribulation-line) 80%, white)); transition:width .15s linear; }
.tribulation-ui__hp-track { border-color:color-mix(in srgb, var(--scene-tribulation-hp) 50%, var(--scene-tribulation-deep)); }
.tribulation-ui__hp-track div { height:100%; background:var(--scene-tribulation-hp); transition:width .15s linear; }
.tribulation-ui__hp,.tribulation-ui__hint { margin-top:6px; font-size:var(--text-xs); text-shadow:0 1px 3px #000; }
.tribulation-ui__hint { color:var(--scene-tribulation-text-soft); }
</style>
