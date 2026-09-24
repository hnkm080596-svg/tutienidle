// Ancient Beast trial (design 2026-09-23 sec.9, master spec sec.8.2) - the
// mortal hidden-body mechanism. An eligible mortal player who has finished
// the normal Body Refinement chapter (6/6) may, on any eligible normal
// battle cycle (manual startStage AND continuous repeat cycles - the seam
// is consulted at both entry points), roll into a hidden encounter: the
// Ancient Beast replaces the whole battle and the player must survive X
// canonical combat rounds. Surviving completes Pham Cot via
// completeHiddenBody (the ops-side trial watcher owns that adjudication);
// dying is ordinary defeat.
//
// Mechanism-owned persisted state: realms.mortal.mechanic =
//   { kind: 'ancient_beast_trial', encounters, rolls }
// encounters = trials actually fired; rolls = eligible cycles seen since
// the last fire (the bounded-pity counter). The record cannot exist
// before discovery (integrity: mechanic implies discovered), so
// pre-discovery rolls are uncounted by design - the first encounter is a
// pure-chance roll and the pity bound applies between fires.
//
// Module-load registration (this file is imported for its side effects by
// GameManagerTurnBattleOps): resolver + runner into
// HiddenBattleReplacement, validator into HIDDEN_MECHANIC_STATE_VALIDATORS.

import { HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL } from '../../../data/realm/HiddenBodyRealms'
import type { PlayerData } from '../../player/Player'
import type { RealmHiddenState } from './HiddenPerfection'
import { HIDDEN_MECHANIC_STATE_VALIDATORS } from './HiddenPerfection'
import {
  canProgressHiddenBody,
  discoverHiddenRealm,
} from './HiddenLineage'
import {
  registerHiddenBattleResolver,
  registerHiddenBattleRunner,
  type HiddenBattleContext,
  type HiddenBattlePlan,
} from './HiddenBattleReplacement'
import { bodyRefinementChapter } from '../body/BodyRefinementChapter'

// ---------------------------------------------------------------------------
// Authored constants - BALANCE-marked (design sec.9/sec.19; the dedicated
// balance pass may tune them).

/** Encounter template id in data/enemy/HiddenBeasts.ts. */
export const ANCIENT_BEAST_ENEMY_ID = 'co_thu'

/** Survival requirement in canonical ATB rounds (design sec.9.3). */
export const ANCIENT_BEAST_SURVIVAL_ROUNDS = 8

/** Per-eligible-cycle encounter probability. */
export const ANCIENT_BEAST_ENCOUNTER_CHANCE = 0.05

/** Bounded pity: guaranteed encounter after this many eligible cycles
 * since the last fire (post-discovery rolls only - see header). */
export const ANCIENT_BEAST_ENCOUNTER_PITY = 30

// ---------------------------------------------------------------------------
// Mechanism-owned persisted payload

export interface AncientBeastTrialMechanic {
  kind: typeof HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL
  /** Trials actually fired (discovery + each later encounter). */
  encounters: number
  /** Eligible cycles since the last fired trial (pity counter). */
  rolls: number
}

export function getAncientBeastTrialMechanic(
  player: Pick<PlayerData, 'hiddenPerfection'>,
): AncientBeastTrialMechanic | undefined {
  const payload = player.hiddenPerfection?.realms['mortal']?.mechanic
  if (payload === undefined || payload.kind !== HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL) {
    return undefined
  }
  return payload as unknown as AncientBeastTrialMechanic
}

function getOrCreateMechanic(record: RealmHiddenState): AncientBeastTrialMechanic {
  if (record.mechanic === undefined) {
    record.mechanic = {
      kind: HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL,
      encounters: 0,
      rolls: 0,
    } satisfies AncientBeastTrialMechanic
  }
  return record.mechanic as unknown as AncientBeastTrialMechanic
}

/** Eligibility (design sec.9.2): mortal realm + open lineage + strict
 * prefix (canProgressHiddenBody covers both) + normal body complete. */
export function isAncientBeastTrialEligible(player: PlayerData): boolean {
  return (
    player.realmId === 'mortal' &&
    canProgressHiddenBody(player, 'mortal') &&
    bodyRefinementChapter.isComplete(player)
  )
}

// ---------------------------------------------------------------------------
// Resolver + runner (registered at module load)

// The resolver is the mechanism's sole per-eligible-cycle hook - its
// pity bookkeeping (rolls += 1) is mechanism-owned and the only write it
// performs; it never touches stage/player state outside realms.mortal.
registerHiddenBattleResolver((player, _stage) => {
  if (!isAncientBeastTrialEligible(player)) {
    return undefined
  }

  const mechanic = getAncientBeastTrialMechanic(player)
  if (mechanic !== undefined) {
    mechanic.rolls += 1
  }

  const guaranteed = mechanic !== undefined && mechanic.rolls >= ANCIENT_BEAST_ENCOUNTER_PITY
  // Economy/spawn-side roll - intentionally Math.random (same scope as
  // loot/alchemy randomness, not the seeded battle-cycle stream).
  if (!guaranteed && Math.random() >= ANCIENT_BEAST_ENCOUNTER_CHANCE) {
    return undefined
  }

  const plan: HiddenBattlePlan = {
    kind: HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL,
    enemyId: ANCIENT_BEAST_ENEMY_ID,
    survivalRounds: ANCIENT_BEAST_SURVIVAL_ROUNDS,
  }
  return plan
})

// The runner fires when the replacement actually launches: discovery IS
// the fired event (spec sec.8.2), then the counters record the fire.
registerHiddenBattleRunner(HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL, (ctx: HiddenBattleContext) => {
  if (!ctx.ops.launchHiddenBattle(ctx)) {
    return false
  }

  const record = discoverHiddenRealm(ctx.player, 'mortal')
  if (record !== undefined) {
    const mechanic = getOrCreateMechanic(record)
    mechanic.encounters += 1
    mechanic.rolls = 0
  }
  return true
})

// ---------------------------------------------------------------------------
// Persisted-state validator (save-shape + integrity seam)

HIDDEN_MECHANIC_STATE_VALIDATORS[HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL] = (payload, emit) => {
  const mechanic = payload as unknown as AncientBeastTrialMechanic
  if (typeof mechanic.encounters !== 'number' || mechanic.encounters < 0) {
    emit('encounters phai la number >= 0')
  }
  if (typeof mechanic.rolls !== 'number' || mechanic.rolls < 0) {
    emit('rolls phai la number >= 0')
  }
}
