import { ref, type Ref } from 'vue'

interface CombatClockOwner {
  freezeCombat(reason: 'tab-hidden'): void
  resumeCombat(reason: 'tab-hidden'): void
  /**
   * r39 adjudication - latch ownership: this composable owns
   * 'tab-hidden', so it registers isPaused as the arm truth at setup.
   * Optional on the narrow owner interface - full GameManager provides
   * it, partial test stubs may not.
   */
  registerFreezeLatchTruth?(reason: 'tab-hidden', isHeld: () => boolean): () => void
}

interface Options {
  /**
   * Returns true while a battle is present and on screen. When false, a
   * visibility change does not pause: there is nothing to pause, and the
   * overlay must not appear outside combat.
   */
  isCombatActive?: () => boolean
}

/**
 * An unwatched battle pauses visibly and waits for Continue (spec sec6.1, A11).
 *
 * Returning to the tab deliberately does NOT resume: the player must see what
 * they are resuming into. This is what makes "combat has no catch-up" (A10)
 * honest, because nobody is asked to reason about time they did not watch.
 */
export function useCombatPause(
  gameManager: CombatClockOwner,
  options: Options = {},
): {
  isPaused: Ref<boolean>
  continueBattle: () => void
  dispose: () => void
} {
  const isPaused = ref(false)

  // This composable is the only legitimate 'tab-hidden' armer: register
  // isPaused as the latch's truth so a foreign freezeCombat plant
  // (synchronous emit listener) is refused at the latch instead of
  // wedging combat behind an overlay nobody armed (r39-COR-1).
  gameManager.registerFreezeLatchTruth?.('tab-hidden', () => isPaused.value)

  const onVisibilityChange = () => {
    if (document.visibilityState !== 'hidden' || isPaused.value) {
      return
    }

    if (options.isCombatActive && !options.isCombatActive()) {
      return
    }

    isPaused.value = true
    gameManager.freezeCombat('tab-hidden')
  }

  const continueBattle = () => {
    if (!isPaused.value) {
      return
    }

    isPaused.value = false
    gameManager.resumeCombat('tab-hidden')
  }

  document.addEventListener('visibilitychange', onVisibilityChange)

  return {
    isPaused,
    continueBattle,
    dispose: () => document.removeEventListener('visibilitychange', onVisibilityChange),
  }
}
