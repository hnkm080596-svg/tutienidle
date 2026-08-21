import { inject, type InjectionKey, type Ref } from 'vue'
import type { GameManager } from '../core/game/GameManager'

/**
 * GameManager là plain class, không phải Vue reactive state (đúng
 * ý thiết kế — core logic tách biệt khỏi framework, xem ghi chú
 * trong GameManager.ts). Component con cần gọi method trên nó thì
 * inject qua đây thay vì prop-drilling qua nhiều tầng panel.
 *
 * `stateVersion` là cầu nối reactivity duy nhất: App.vue tick()
 * tăng nó mỗi giây, và mọi action làm thay đổi bag/equipment (equip,
 * craft, enhance...) PHẢI gọi `bumpState()` ngay sau khi mutate qua
 * GameManager để UI phản hồi tức thời thay vì chờ tick kế tiếp.
 * Component đọc bag chỉ cần `computed(() => { stateVersion.value; return gameManager.xxxBag.getAll() })`.
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
