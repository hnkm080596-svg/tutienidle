<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { publishPartyDockHeight } from '@/presentation/geometry/combatInsets'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { useStateVersion } from '@/composables/useGameState'
import { battlePartyCards } from '@/presentation/combat/BattlePartyCards'
import BattleCard from './BattleCard.vue'
const dock = ref<HTMLElement | null>(null)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(() => {
    if (dock.value) publishPartyDockHeight(dock.value.getBoundingClientRect().height * 228 / 204)
  })
  if (dock.value) observer.observe(dock.value)
})
onBeforeUnmount(() => { observer?.disconnect(); publishPartyDockHeight(0) })
const { battle } = useTurnBattleInfo()
const { stateVersion } = useStateVersion()
const cards = computed(() => { stateVersion.value; return battlePartyCards(battle.value?.players ?? []).filter(participant => participant !== null) })
</script>
<template><div ref="dock" class="combat-party-dock"><BattleCard v-for="(participant, index) in cards" :key="participant?.id ?? `empty-${index}`" :participant="participant" /></div></template>
<style scoped>
.combat-party-dock { position: absolute; left: 24px; right: 24px; bottom: 12px; display: flex; justify-content: center; gap: 12px; z-index: 12; pointer-events: none; }
.combat-party-dock > :deep(.battle-card) { width: calc((100% - 48px) / 5); flex: 0 0 calc((100% - 48px) / 5); }
</style>
