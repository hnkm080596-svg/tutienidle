// BuffModifierEngine.ts -- spec sec.29-35. Pure entry math + identity;
// the BuffSystem owns event emission and pending-uses bookkeeping.
//
// Resolution math (spec sec.31):
//   resolved = base
//   + Sigma(all 'add' modifiers)      -- ordered (priority asc, id asc)
//   x Pi(all 'multiply' modifiers)    -- same ordering (float products are
//                                      order-sensitive; order locked for
//                                      determinism)
//   -> any 'set' wins outright: highest priority; tie -> lexicographically
//      smallest authored id, then smallest modifierRuntimeId (two
//      same-authored-id generations can both be 'set').
//
// Reapply (spec sec.32): identity = modifier.id (+appliedBy where
// relevant -- entries authored by different entities are different
// logical modifiers). 'replace' overwrites same-id; 'stack' appends a
// distinct entry; 'max'/'min' keep the extreme. Every inserted or
// overwritten entry mints a NEW modifierRuntimeId (r4 HIGH 1): pending
// uses-marks and removeModifier key the exact generation -- a same-id
// replacement inside a consequence tree is a different generation and can
// never be consumed by an earlier request's reservation (its mark dies
// with the replaced entry).
//
// Refresh isolation (spec sec.35): buff duration refresh NEVER refreshes
// modifier lifetime -- lifetimes decrement only in their matching
// post-settle lifecycle phase or on explicit removal.

import type { BuffModifierChannel, BuffModifierPayload } from '../battle/contracts/operations'
import type { BuffInstance } from './BuffInstance'
import type { BuffModifier } from './BuffModifier'

/** Active entries for a channel: pending-marked entries are reserved for
    an in-flight request and fold into NOTHING until finalized (spec
    addendum v1.2 -- released on non-resolved settle). */
function activeEntries(
  mods: readonly BuffModifier[],
  channel: BuffModifierChannel,
): BuffModifier[] {
  return mods.filter(
    (m) => m.channel === channel && m.pendingRequestId === undefined,
  )
}

function byCanonicalOrder(a: BuffModifier, b: BuffModifier): number {
  return (
    a.priority - b.priority ||
    a.id.localeCompare(b.id) ||
    a.modifierRuntimeId.localeCompare(b.modifierRuntimeId)
  )
}

export function resolveChannel(
  mods: readonly BuffModifier[],
  channel: BuffModifierChannel,
  base: number,
): number {
  const matching = activeEntries(mods, channel)
  if (matching.length === 0) return base

  const sets = matching.filter((m) => m.operation === 'set')
  if (sets.length > 0) {
    // 'set' wins outright -- highest priority; tie -> smallest authored
    // id, then smallest runtime id (locked deterministic choice).
    sets.sort(
      (a, b) =>
        b.priority - a.priority ||
        a.id.localeCompare(b.id) ||
        a.modifierRuntimeId.localeCompare(b.modifierRuntimeId),
    )
    return sets[0]!.value
  }

  const ordered = [...matching].sort(byCanonicalOrder)
  let result = base
  for (const m of ordered) if (m.operation === 'add') result += m.value
  let product = 1
  for (const m of ordered) if (m.operation === 'multiply') product *= m.value
  return result * product
}

/** Identity for reapply (spec sec.32): authored id + appliedBy. */
function sameLogicalModifier(a: BuffModifier, b: BuffModifierPayload): boolean {
  return a.id === b.id && a.appliedBy === b.appliedBy
}

export interface AttachModifierResult {
  entry: BuffModifier
  /** Entries evicted by the reapply (replace/max/min overwrites). The
      system drops their pending marks -- a replaced generation can never
      be consumed. */
  evicted: readonly BuffModifier[]
}

/** Attach or reapply a modifier payload onto the instance. `mintRuntimeId`
    produces `bmr.${instanceId}.${n}` (per-instance monotonic -- minted
    fresh for EVERY entry, including overwrites). */
export function attachModifier(
  instance: BuffInstance,
  payload: BuffModifierPayload,
  mintRuntimeId: () => string,
): AttachModifierResult {
  const evicted: BuffModifier[] = []
  const existing = instance.modifiers.find((m) => sameLogicalModifier(m, payload))

  let entry: BuffModifier
  switch (payload.reapply) {
    case 'stack':
      entry = {
        ...payload,
        instanceId: instance.instanceId,
        modifierRuntimeId: mintRuntimeId(),
      }
      instance.modifiers.push(entry)
      break
    case 'max':
    case 'min': {
      if (
        existing !== undefined &&
        (payload.reapply === 'max' ? existing.value >= payload.value : existing.value <= payload.value)
      ) {
        // Existing keeps the extreme -- the incoming payload is absorbed;
        // report the surviving entry, evict nothing.
        return { entry: existing, evicted }
      }
      if (existing !== undefined) {
        evicted.push(existing)
        instance.modifiers.splice(instance.modifiers.indexOf(existing), 1)
      }
      entry = {
        ...payload,
        instanceId: instance.instanceId,
        modifierRuntimeId: mintRuntimeId(),
      }
      instance.modifiers.push(entry)
      break
    }
    case 'replace':
    default: {
      if (existing !== undefined) {
        evicted.push(existing)
        const index = instance.modifiers.indexOf(existing)
        entry = {
          ...payload,
          instanceId: instance.instanceId,
          modifierRuntimeId: mintRuntimeId(),
        }
        instance.modifiers[index] = entry
      } else {
        entry = {
          ...payload,
          instanceId: instance.instanceId,
          modifierRuntimeId: mintRuntimeId(),
        }
        instance.modifiers.push(entry)
      }
      break
    }
  }
  return { entry, evicted }
}

/** all_matching removal (r5 HIGH 1): removes EVERY runtime entry carrying
    the authored modifierId -- a same-id stack is one logical modifier to
    its author. */
export function removeModifiersById(
  instance: BuffInstance,
  modifierId: string,
): readonly BuffModifier[] {
  const removed = instance.modifiers.filter((m) => m.id === modifierId)
  if (removed.length === 0) return []
  instance.modifiers = instance.modifiers.filter((m) => m.id !== modifierId)
  return removed
}

/** Turn-clock decrement (spec sec.33-34): decrement `remaining` on
    entries whose lifetime type matches `clock`; entries reaching 0 are
    removed and returned so the caller emits buff_modifier_removed per
    generation. 'uses' entries are NOT decremented here -- they are
    consumed by the settled event that finalized their request. */
export function decrementModifierLifetimes(
  instance: BuffInstance,
  clock: 'holder_turns' | 'source_turns' | 'rounds',
): readonly BuffModifier[] {
  const expired: BuffModifier[] = []
  const surviving: BuffModifier[] = []
  for (const m of instance.modifiers) {
    if (m.lifetime.type === clock) {
      const remaining = m.lifetime.remaining - 1
      if (remaining <= 0) {
        expired.push(m)
      } else {
        m.lifetime = { ...m.lifetime, remaining }
        surviving.push(m)
      }
    } else {
      surviving.push(m)
    }
  }
  if (expired.length > 0) instance.modifiers = surviving
  return expired
}
