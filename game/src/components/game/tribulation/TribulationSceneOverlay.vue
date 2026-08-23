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
    <div class="tribulation-ui__timer">{{ seconds }}s</div>
    <div class="tribulation-ui__time-track"><div :style="{ width: `${timePercent}%` }" /></div>
    <div class="tribulation-ui__hp-track"><div :style="{ width: `${hpPercent}%` }" /></div>
    <div class="tribulation-ui__hp">HP {{ formatNumber(Math.ceil(hp)) }} / {{ formatNumber(maxHp) }}</div>
    <div class="tribulation-ui__hint">Sống sót cho tới khi thiên kiếp kết thúc</div>
  </div>
</template>

<style scoped>
.tribulation-ui { position:absolute; inset:0; z-index:15; pointer-events:none; display:flex; flex-direction:column; align-items:center; padding-top:108px; color:#e9f6ff; text-align:center; }
.tribulation-ui__timer { font-size:2rem; font-weight:800; text-shadow:0 0 14px #69bfff; }
.tribulation-ui__time-track,.tribulation-ui__hp-track { width:340px; height:8px; margin-top:8px; overflow:hidden; border:1px solid #9edaff; border-radius:8px; background:#08101e; }
.tribulation-ui__time-track div { height:100%; margin-left:auto; background:linear-gradient(90deg,#7658d6,#ddf6ff); transition:width .15s linear; }
.tribulation-ui__hp-track { margin-top:360px; border-color:#824a4a; }
.tribulation-ui__hp-track div { height:100%; background:#d34c4c; transition:width .15s linear; }
.tribulation-ui__hp,.tribulation-ui__hint { margin-top:6px; font-size:.72rem; text-shadow:0 1px 3px #000; }
.tribulation-ui__hint { color:#bcd8e9; }
</style>
