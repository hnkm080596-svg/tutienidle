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

interface PlayerCheckpointNode {
  target: Record<PropertyKey, unknown>
  properties: Map<PropertyKey, unknown>
  children: PlayerCheckpointNode[]
}

/**
 * A reversible in-memory checkpoint for a synchronous player transaction.
 * Unlike a save snapshot, it retains own undefined fields and the identity
 * of nested objects observed by reactive consumers. It only traverses plain
 * data objects and arrays; specialized runtime owners keep their own state.
 */
export function capturePlayerCheckpoint(player: PlayerData): PlayerCheckpointNode {
  const visited = new WeakMap<object, PlayerCheckpointNode>()

  const capture = (value: Record<PropertyKey, unknown>): PlayerCheckpointNode => {
    const previous = visited.get(value)
    if (previous) return previous

    const node: PlayerCheckpointNode = {
      target: value,
      properties: new Map(),
      children: [],
    }
    visited.set(value, node)
    for (const key of Reflect.ownKeys(value)) {
      const child: unknown = Reflect.get(value, key)
      node.properties.set(key, child)
      if (child !== null && typeof child === 'object'
        && (Array.isArray(child) || Object.getPrototypeOf(child) === Object.prototype)) {
        node.children.push(capture(child as Record<PropertyKey, unknown>))
      }
    }
    return node
  }

  return capture(player as unknown as Record<PropertyKey, unknown>)
}

export function restorePlayerCheckpoint(checkpoint: PlayerCheckpointNode): void {
  const visited = new Set<PlayerCheckpointNode>()

  const restore = (node: PlayerCheckpointNode): void => {
    if (visited.has(node)) return
    visited.add(node)

    for (const key of Reflect.ownKeys(node.target)) {
      if (!node.properties.has(key)) Reflect.deleteProperty(node.target, key)
    }
    for (const [key, previous] of node.properties) {
      if (!Object.is(Reflect.get(node.target, key), previous)) {
        Reflect.set(node.target, key, previous)
      }
    }
    for (const child of node.children) restore(child)
  }

  restore(checkpoint)
}
