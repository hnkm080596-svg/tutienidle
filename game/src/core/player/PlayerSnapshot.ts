import type { PlayerData } from './Player'

/**
 * Whole-player field snapshot for transactional domain ops. Capture
 * runs through the JSON domain boundary (not structuredClone): live
 * callers hand in a Pinia store's reactive $state, which
 * structuredClone cannot take. The snapshot is a detached plain-data
 * PlayerData - byte-equivalent under JSON.stringify.
 *
 * restorePlayerSnapshotInPlace writes the snapshot back over the SAME
 * object (identity preserved for the store and watchers): fields added
 * mid-transaction are deleted, every surviving field is overwritten.
 * It never grants anything - the write can only reproduce state the
 * player already had at capture time.
 */
export function capturePlayerSnapshot(player: PlayerData): PlayerData {
  return JSON.parse(JSON.stringify(player)) as PlayerData
}

export function restorePlayerSnapshotInPlace(player: PlayerData, snapshot: PlayerData): void {
  // Delete-everything-then-assign: a deleted-then-reassigned key moves
  // to the end of the object's key order, which would break
  // JSON.stringify byte-equivalence against the snapshot. Clearing
  // first re-adds every field in the snapshot's original order.
  for (const key of Object.keys(player)) {
    Reflect.deleteProperty(player, key)
  }
  Object.assign(player, snapshot)
}
