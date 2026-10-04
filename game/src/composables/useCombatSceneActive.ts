import { computed, inject } from 'vue'
import { VUE_ROUTE_ADAPTER_KEY } from '@/presentation/PresentationContracts'

/**
 * Combat Scene (CombatSceneOverlay.vue + Phaser's CombatScene.ts) chiem
 * TOAN man hinh trong luc 1 tran dang dien ra. Single authority: the
 * presentation coordinator's active route - the coordinator already knows
 * the route only commits once the combat session is attached, so a second
 * flag (ui.combatSceneDismissed) could only disagree with it. That fallback
 * was retired with the R12 cleanup.
 */
export function useCombatSceneActive() {
  const routeAdapter = inject(VUE_ROUTE_ADAPTER_KEY, null)

  if (!routeAdapter) {
    throw new Error('useCombatSceneActive requires VUE_ROUTE_ADAPTER_KEY (provided by App.vue)')
  }

  return computed(() => routeAdapter.activeRoute.value === 'combat')
}
