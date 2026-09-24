// Hidden Perfection Lineage (design 2026-09-23, master spec sec.2/sec.6) -
// the persisted state shape and its integrity contract. One per-player
// slice owns every hidden-perfection flag/counter/state; consumers
// never touch the raw record directly - they go through
// core/realm/hidden/HiddenLineage.ts (reads + mutators) and the
// mechanism seams registered by sibling missions B/C.
//
// Design law (spec sec.2):
//   - lineageActive is write-once -> false. Any NORMAL breakthrough
//     SUCCESS closes it permanently (mutator-owned); a FAILED
//     attempt writes nothing.
//   - completedHiddenBodyRealmIds is a strict prefix of
//     HIDDEN_BODY_REALMS - progress may never skip an earlier realm.
//   - hiddenBreakthroughRealmIds lists realms ENTERED via a hidden
//     breakthrough (mortal is the lineage root: never entered, never
//     listed).
//   - Per-realm RealmHiddenState exists ONLY for authored realms the
//     player has actually discovered (sparse - key creation IS the
//     visibility event).

import {
  HIDDEN_BODY_REALMS,
  hiddenBodyRealmIndex,
  isAuthoredHiddenRealm,
} from '../../../data/realm/HiddenBodyRealms'
import { HIDDEN_MECHANIC_FINISHED_READERS } from './HiddenLineage'
import { getRealmIndex } from '../realmSystem'
import { REALMS } from '../../../data/realms/realm'

/**
 * Mechanism-owned persisted payload (sibling missions B/C). The `kind`
 * discriminant is fixed by HIDDEN_BODY_REALMS[].mechanicKind; the rest
 * of the shape is mechanism-owned and validated through
 * HIDDEN_MECHANIC_STATE_VALIDATORS, so the skeleton stays
 * mechanism-agnostic.
 */
export interface RealmHiddenMechanicState {
  kind: string
  [key: string]: unknown
}

export interface RealmHiddenState {
  /**
   * Visibility flag (design sec.4): false = hidden. discoverHiddenRealm
   * is the ONLY writer flipping it true; it requires
   * canProgressHiddenBody at write time - a closed lineage or
   * out-of-prefix realm can never be discovered, so freeze mechanics
   * can never fake a discovery.
   */
  discovered: boolean

  /**
   * Sole writer: completeHiddenBody (strict prefix + open lineage +
   * finished mechanism).
   */
  bodyCompleted: boolean

  /**
   * Frozen marker: written by closeHiddenLineage on EVERY record whose
   * bodyCompleted is false at lineage close (spec sec.2.3) - the
   * record stays readable-but-inert; mutators no-op on frozen realms.
   */
  frozen: boolean

  /** Mechanism-owned payload (kind per HIDDEN_BODY_REALMS). */
  mechanic?: RealmHiddenMechanicState
}

export interface HiddenPerfectionState {
  /** Once false, no record can ever restore true. */
  lineageActive: boolean

  /** Diagnostic: realm whose normal-breakthrough success closed the
   * lineage. Absent while open. */
  lineageClosedByRealmId?: string

  /** Strict prefix of HIDDEN_BODY_REALMS realm ids, in authored order. */
  completedHiddenBodyRealmIds: string[]

  /** Realms ENTERED via hidden breakthrough (entered realm id). */
  hiddenBreakthroughRealmIds: string[]

  /** Sparse per-realm hidden state - authored realms only. */
  realms: Record<string, RealmHiddenState>
}

export function createDefaultHiddenPerfection(): HiddenPerfectionState {
  return {
    lineageActive: true,
    completedHiddenBodyRealmIds: [],
    hiddenBreakthroughRealmIds: [],
    realms: {},
  }
}

/**
 * Mechanism-owned persisted-state validator registry (sibling missions
 * B/C). Keyed by HIDDEN_BODY_REALMS[].mechanicKind; an authored realm
 * whose player state carries a mechanic payload but lacks a registered
 * validator fails validation loudly (a payload the skeleton cannot
 * check is never silently accepted).
 */
export const HIDDEN_MECHANIC_STATE_VALIDATORS: Record<
  string,
  (payload: RealmHiddenMechanicState, emit: (issue: string) => void) => void
> = {}

// ---------------------------------------------------------------------------
// Persisted-state validation (save-shape boundary)

type IssueEmitter = (issue: { path: string; message: string }) => void

export function validateHiddenPerfectionPersistedState(
  player: { hiddenPerfection?: unknown },
  emit: IssueEmitter,
): void {
  const record = player.hiddenPerfection as unknown

  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    emit({ path: 'player.hiddenPerfection', message: 'phải là object' })
    return
  }

  const state = record as Record<string, unknown>

  if (typeof state.lineageActive !== 'boolean') {
    emit({ path: 'player.hiddenPerfection.lineageActive', message: 'phải là boolean' })
  }

  if (
    state.lineageClosedByRealmId !== undefined &&
    typeof state.lineageClosedByRealmId !== 'string'
  ) {
    emit({
      path: 'player.hiddenPerfection.lineageClosedByRealmId',
      message: 'phải là string khi có mặt',
    })
  }

  validateRealmIdList(
    state.completedHiddenBodyRealmIds,
    'player.hiddenPerfection.completedHiddenBodyRealmIds',
    emit,
  )
  validateRealmIdList(
    state.hiddenBreakthroughRealmIds,
    'player.hiddenPerfection.hiddenBreakthroughRealmIds',
    emit,
  )

  if (typeof state.realms !== 'object' || state.realms === null || Array.isArray(state.realms)) {
    emit({ path: 'player.hiddenPerfection.realms', message: 'phải là object map' })
    return
  }

  for (const [realmId, realmState] of Object.entries(state.realms)) {
    const path = `player.hiddenPerfection.realms.${realmId}`

    if (typeof realmState !== 'object' || realmState === null || Array.isArray(realmState)) {
      emit({ path, message: 'phải là object' })
      continue
    }

    const rs = realmState as Record<string, unknown>

    for (const flag of ['discovered', 'bodyCompleted', 'frozen'] as const) {
      if (typeof rs[flag] !== 'boolean') {
        emit({ path: `${path}.${flag}`, message: 'phải là boolean bắt buộc' })
      }
    }

    if (rs.mechanic !== undefined) {
      if (typeof rs.mechanic !== 'object' || rs.mechanic === null || Array.isArray(rs.mechanic)) {
        emit({ path: `${path}.mechanic`, message: 'phải là object' })
      } else {
        const payload = rs.mechanic as RealmHiddenMechanicState
        if (typeof payload.kind !== 'string' || payload.kind.length === 0) {
          emit({ path: `${path}.mechanic.kind`, message: 'phải là string không rỗng' })
        }
      }
    }
  }
}

function validateRealmIdList(
  value: unknown,
  path: string,
  emit: IssueEmitter,
): void {
  if (!Array.isArray(value)) {
    emit({ path, message: 'phải là array' })
    return
  }

  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string') {
      emit({ path: `${path}[${index}]`, message: 'phải là string' })
    }
  }
}

// ---------------------------------------------------------------------------
// Preflight integrity (GameManagerSaveRestore): runs AFTER shape
// validation, so the record's static shape is sound; this checks the
// persisted COHERENCE contracts. Fail-closed: any violation throws.

export function assertHiddenPerfectionIntegrity(player: {
  hiddenPerfection?: HiddenPerfectionState
  realmId: string
}): void {
  const issues: string[] = []

  const record = player.hiddenPerfection as unknown
  if (typeof record !== 'object' || record === null) {
    throw new Error('HiddenPerfection integrity violation: hiddenPerfection missing or not an object')
  }

  const state = record as HiddenPerfectionState
  const realms = state.realms ?? {}

  // lineageClosedByRealmId coherence: present iff !lineageActive, and
  // it must name a real realm.
  if (state.lineageActive && state.lineageClosedByRealmId !== undefined) {
    issues.push('lineageClosedByRealmId có mặt trong khi lineageActive = true')
  }
  if (!state.lineageActive && typeof state.lineageClosedByRealmId !== 'string') {
    issues.push('lineageActive = false nhưng lineageClosedByRealmId vắng mặt')
  }
  if (
    typeof state.lineageClosedByRealmId === 'string' &&
    getRealmIndex(state.lineageClosedByRealmId) === -1
  ) {
    issues.push(`lineageClosedByRealmId '${state.lineageClosedByRealmId}' không phải realm hợp lệ`)
  }

  // completedHiddenBodyRealmIds: strict prefix of HIDDEN_BODY_REALMS.
  const completed = state.completedHiddenBodyRealmIds ?? []
  for (const [index, realmId] of completed.entries()) {
    if (HIDDEN_BODY_REALMS[index]?.realmId !== realmId) {
      issues.push(
        `completedHiddenBodyRealmIds[${index}] '${realmId}' vi phạm strict-prefix ` +
          `(kỳ vọng '${HIDDEN_BODY_REALMS[index]?.realmId ?? '<end>'}')`,
      )
      break
    }
  }

  // The completed list and per-realm bodyCompleted flags are two views
  // of one fact - they may never disagree in either direction.
  for (const realmId of completed) {
    if (realms[realmId]?.bodyCompleted !== true) {
      issues.push(`realms.${realmId}.bodyCompleted phải là true khi realm nằm trong completed list`)
    }
  }
  for (const [realmId, realmState] of Object.entries(realms)) {
    if (realmState.bodyCompleted === true && !completed.includes(realmId)) {
      issues.push(`realms.${realmId}.bodyCompleted = true nhưng realm không nằm trong completed list`)
    }
  }

  // hiddenBreakthroughRealmIds: every element names a real realm that
  // is NOT 'mortal' (the lineage root is never entered); duplicates are
  // impossible because realmId never decreases; and every entered realm
  // must sit at or behind the player's current realm index, with the
  // DEPARTING realm's hidden body completed.
  const playerIndex = getRealmIndex(player.realmId)
  const seen = new Set<string>()
  for (const realmId of state.hiddenBreakthroughRealmIds ?? []) {
    if (getRealmIndex(realmId) === -1) {
      issues.push(`hiddenBreakthroughRealmIds chứa realm không hợp lệ '${realmId}'`)
      continue
    }
    if (realmId === 'mortal') {
      issues.push("hiddenBreakthroughRealmIds không được chứa 'mortal' (realm gốc)")
    }
    if (seen.has(realmId)) {
      issues.push(`hiddenBreakthroughRealmIds chứa '${realmId}' trùng lặp`)
    }
    seen.add(realmId)

    const enteredIndex = getRealmIndex(realmId)
    // the entered realm may BE the current realm (a save taken right
    // after the commit) but never a FUTURE one
    if (enteredIndex !== -1 && playerIndex !== -1 && enteredIndex > playerIndex) {
      issues.push(
        `hiddenBreakthroughRealmIds chứa '${realmId}' không nằm sau realm hiện tại '${player.realmId}'`,
      )
    }

    // hidden entry into realm i is only possible when the DEPARTING
    // realm (i-1) completed its hidden body
    if (enteredIndex > 0 && !completed.includes(REALMS[enteredIndex - 1]!.id)) {
      issues.push(
        `hiddenBreakthroughRealmIds chứa '${realmId}' nhưng hidden body của realm trước '${REALMS[enteredIndex - 1]!.id}' chưa hoàn thành`,
      )
    }
  }

  // realms map: authored keys only + per-realm coherence + mechanism
  // validator dispatch.
  for (const [realmId, realmState] of Object.entries(realms)) {
    if (!isAuthoredHiddenRealm(realmId)) {
      issues.push(`realms.${realmId}: realm không có hidden body được author`)
      continue
    }

    // Strict-reach rule (sec.4 no-leak): a realm may only carry hidden
    // state (discovered/mechanic/frozen/bodyCompleted) while it is the
    // next uncompleted body in lineage order or already completed -
    // writes through discoverHiddenRealm/completeHiddenBody can never
    // land past that frontier.
    const authoredIndex = hiddenBodyRealmIndex(realmId)
    if (authoredIndex !== -1 && authoredIndex > completed.length) {
      issues.push(
        `realms.${realmId}: mang trạng thái vượt quá prefix hoàn thành ` +
          `(chỉ ${completed.length} body hoàn thành)`,
      )
    }

    // Mechanic implies discovered: every mechanism writer runs after
    // the realm's hidden surface was revealed (sec.4).
    if (realmState.mechanic !== undefined && realmState.discovered !== true) {
      issues.push(`realms.${realmId}: mechanic hiện hữu nhưng chưa discovered`)
    }

    // Mechanism payload must carry the AUTHORED kind and pass its
    // registered validator (B/C register one per kind).
    if (realmState.mechanic !== undefined) {
      const authored = HIDDEN_BODY_REALMS.find((r) => r.realmId === realmId)
      if (realmState.mechanic.kind !== authored?.mechanicKind) {
        issues.push(
          `realms.${realmId}.mechanic.kind '${realmState.mechanic.kind}' ` +
            `không khớp authored '${authored?.mechanicKind}'`,
        )
      }

      const validator = HIDDEN_MECHANIC_STATE_VALIDATORS[realmState.mechanic.kind]
      if (validator === undefined) {
        issues.push(
          `realms.${realmId}.mechanic.kind '${realmState.mechanic.kind}' chưa có validator đăng ký`,
        )
      } else {
        validator(realmState.mechanic, (issue) =>
          issues.push(`realms.${realmId}.mechanic: ${issue}`),
        )
      }

      // Mechanism-finished must mirror bodyCompleted: a payload whose
      // registered reader reports finished while the flag is false (or
      // the reverse) is incoherent - e.g. completed>=36 with
      // bodyCompleted=false would short-circuit 'complete' forever
      // while the +10pp completion never lands.
      const finishedReader = HIDDEN_MECHANIC_FINISHED_READERS[realmState.mechanic.kind]
      if (
        finishedReader !== undefined &&
        finishedReader(realmState.mechanic) !== (realmState.bodyCompleted === true)
      ) {
        issues.push(
          `realms.${realmId}.mechanic: finished-state khong khop bodyCompleted`,
        )
      }
    }

    // Spec sec.6.3: freeze can only be written by closure - a frozen
    // record on an OPEN lineage is corruption; and a completed body
    // never freezes (closeHiddenLineage skips bodyCompleted=true).
    if (realmState.frozen === true && state.lineageActive === true) {
      issues.push(`realms.${realmId}: frozen=true trong khi lineageActive=true (freeze chỉ ghi bởi closure)`)
    }
    if (realmState.frozen === true && realmState.bodyCompleted === true) {
      issues.push(`realms.${realmId}: frozen=true và bodyCompleted=true mâu thuẫn`)
    }
  }

  if (issues.length > 0) {
    throw new Error(`HiddenPerfection integrity violation: ${issues.join('; ')}`)
  }
}
