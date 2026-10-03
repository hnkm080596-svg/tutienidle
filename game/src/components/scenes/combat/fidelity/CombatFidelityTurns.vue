<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CombatFidelityPortrait from './CombatFidelityPortrait.vue'
import CombatFidelityFrame from './CombatFidelityFrame.vue'
import type { CombatDisplayTurn } from './combatUi'
defineProps<{ turns: readonly CombatDisplayTurn[]; current: string }>()
const { t } = useI18n()
</script>
<template><CombatFidelityFrame class="turn-rail" :border="20"><ol class="turn-list" :aria-label="t('turnOrder')"><li v-for="turn in turns" :key="turn.id" :class="['turn', turn.side, { current: turn.id === current }]" :aria-label="turn.name" :aria-current="turn.id === current ? 'step' : undefined"><CombatFidelityPortrait :image="turn.portrait" /><span v-if="turn.id === current" class="current-mark" aria-hidden="true">◆</span></li></ol><span class="rail-arrow" aria-hidden="true">›</span></CombatFidelityFrame></template>
<style scoped>.turn-rail { position:absolute; left:490px; top:99px; width:455px; height:67px; padding:8px 35px 8px 22px; }.turn-list { display:flex; align-items:center; gap:18px; overflow-x:auto; height:64px; margin:-6px 0 0; padding:3px; list-style:none; scrollbar-width:none; }.turn { position:relative; flex:0 0 47px; height:47px; opacity:.85; }.turn.current { flex-basis:57px; height:57px; opacity:1; filter:drop-shadow(0 0 7px #d2a94c); }.turn.enemy { filter:saturate(.7); }.current-mark { position:absolute; bottom:-7px; left:50%; transform:translateX(-50%); font-size:10px; color:#ffe6a5; }.rail-arrow { position:absolute; right:19px; top:15px; color:#e7c977; font-size:29px; }</style>
