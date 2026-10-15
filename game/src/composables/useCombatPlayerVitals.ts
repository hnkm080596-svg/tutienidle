import { computed } from 'vue'
import { useStateVersion } from './useGameState'
import { useTurnBattleInfo } from './useTurnBattleInfo'

export function combatVitalPercent(current: number, maximum: number): number {
  return maximum > 0 ? Math.min(100, Math.max(0, current / maximum * 100)) : 0
}

export function useCombatPlayerVitals() {
  const { stateVersion } = useStateVersion()
  const { battle, isBattleInProgress } = useTurnBattleInfo()
  const entity = computed(() => {
    stateVersion.value
    return battle.value?.players.find(participant => participant.entity.id === 'player')?.entity
  })
  const hpPercent = computed(() => {
    stateVersion.value
    const current = entity.value
    return current ? combatVitalPercent(current.currentHp, current.maxHp) : 0
  })
  return { entity, hpPercent, isBattleInProgress }
}
