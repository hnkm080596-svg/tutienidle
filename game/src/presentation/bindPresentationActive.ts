import type { CoordinatorSnapshot } from './PresentationContracts'

interface PlaybackTarget {
  setPresentationActive(active: boolean): void
}

interface SnapshotSource {
  subscribe(listener: (snapshot: CoordinatorSnapshot) => void): () => void
}

/**
 * `presentationActive` has exactly one owner: the coordinator. It is true only
 * while the COMMITTED route is combat and the combat session is attached.
 * CombatScene must never assert this for itself; a scene claiming its own
 * readiness is the self-report pattern the coordinator design rejected.
 */
export function bindPresentationActive(
  coordinator: SnapshotSource,
  target: PlaybackTarget,
): () => void {
  let last: boolean | null = null

  return coordinator.subscribe((snapshot) => {
    const active =
      snapshot.currentRoute === 'combat' &&
      snapshot.currentSession !== null &&
      snapshot.currentSession.kind === 'combat'

    if (active === last) {
      return
    }

    last = active
    target.setPresentationActive(active)
  })
}
