import { inject, type InjectionKey, type Ref } from 'vue'
import type { GameManager } from '../core/game/GameManager'

/**
 * GameManager la plain class, khong phai Vue reactive state (dung
 * y thiet ke - core logic tach biet khoi framework, xem ghi chu
 * trong GameManager.ts). Component con can goi method tren no thi
 * inject qua day thay vi prop-drilling qua nhieu tang panel.
 *
 * `stateVersion` la cau noi reactivity duy nhat: App.vue tick()
 * tang no moi giay, va moi action lam thay doi bag/equipment (equip,
 * craft, enhance...) PHAI goi `bumpState()` ngay sau khi mutate qua
 * GameManager de UI phan hoi tuc thoi thay vi cho tick ke tiep.
 * Component doc bag chi can `computed(() => { stateVersion.value; return gameManager.xxxBag.getAll() })`.
 */
export const GAME_MANAGER_KEY: InjectionKey<GameManager> = Symbol('gameManager')

export const STATE_VERSION_KEY: InjectionKey<Ref<number>> = Symbol('stateVersion')

export const BUMP_STATE_KEY: InjectionKey<() => void> = Symbol('bumpState')

export function useGameManager(): GameManager {
  const gameManager = inject(GAME_MANAGER_KEY)

  if (!gameManager) {
    throw new Error('useGameManager() phải được gọi trong cây con của App.vue (chưa provide GameManager)')
  }

  return gameManager
}

export function useStateVersion(): { stateVersion: Ref<number>; bumpState: () => void } {
  const stateVersion = inject(STATE_VERSION_KEY)

  const bumpState = inject(BUMP_STATE_KEY)

  if (!stateVersion || !bumpState) {
    throw new Error('useStateVersion() phải được gọi trong cây con của App.vue (chưa provide stateVersion)')
  }

  return { stateVersion, bumpState }
}
