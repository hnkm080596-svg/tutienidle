// Pin tests (design 2026-09-23 sec.9, master spec sec.8.2) - the mortal
// Ancient Beast mechanism: eligibility matrix, the per-cycle encounter
// roll (bounded pity on persisted counters), the discovery-on-fire
// contract, and the persisted-state validator.
//
// The module registers its resolver+runner into HiddenBattleReplacement
// at import - tests exercise them through the seam's public surface.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '../../player/Player'
import type { Stage } from '../../stage/Stage'
import {
  ANCIENT_BEAST_ENEMY_ID,
  ANCIENT_BEAST_ENCOUNTER_PITY,
  ANCIENT_BEAST_SURVIVAL_ROUNDS,
  getAncientBeastTrialMechanic,
  isAncientBeastTrialEligible,
} from './AncientBeastTrial'
import { completeHiddenBody, discoverHiddenRealm } from './HiddenLineage'
import { HIDDEN_MECHANIC_STATE_VALIDATORS } from './HiddenPerfection'
import {
  resolveHiddenBattleReplacement,
  runHiddenBattleReplacement,
  type HiddenBattleContext,
} from './HiddenBattleReplacement'
import { BODY_REFINEMENT_TIERS } from '../../../data/realm/BodyRefinement'

const STAGE = { id: 'fixture_stage' } as Stage

function mortalPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.bodyProgression.body_refinement.completedTiers = BODY_REFINEMENT_TIERS.length
  return { ...player, ...overrides }
}

function ctxFor(player: PlayerData, launch: () => boolean): HiddenBattleContext {
  return {
    player,
    stage: STAGE,
    plan: {
      kind: 'ancient_beast_trial',
      enemyId: ANCIENT_BEAST_ENEMY_ID,
      survivalRounds: ANCIENT_BEAST_SURVIVAL_ROUNDS,
    },
    ops: { launchHiddenBattle: launch },
    resumeRepeat: false,
  }
}

describe('ancient beast trial - eligibility (sec.9.2)', () => {
  it('accepts a mortal with lineage open and body refinement complete', () => {
    expect(isAncientBeastTrialEligible(mortalPlayer())).toBe(true)
  })

  it('rejects without 6/6 body refinement', () => {
    const player = mortalPlayer()
    player.bodyProgression.body_refinement.completedTiers = BODY_REFINEMENT_TIERS.length - 1
    expect(isAncientBeastTrialEligible(player)).toBe(false)
  })

  it('rejects outside the mortal realm', () => {
    const player = mortalPlayer({ realmId: 'qi_refining' })
    expect(isAncientBeastTrialEligible(player)).toBe(false)
  })

  it('rejects a closed lineage', () => {
    const player = mortalPlayer()
    player.hiddenPerfection.lineageActive = false
    player.hiddenPerfection.lineageClosedByRealmId = 'qi_refining'
    expect(isAncientBeastTrialEligible(player)).toBe(false)
  })

  it('rejects once mortal hidden body is complete (rolls cease)', () => {
    const player = mortalPlayer()
    expect(completeHiddenBody(player, 'mortal')).toBeDefined()
    expect(isAncientBeastTrialEligible(player)).toBe(false)
  })
})

describe('ancient beast trial - encounter roll (sec.9.3)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('chance roll fires the plan on an eligible cycle', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const plan = resolveHiddenBattleReplacement(mortalPlayer(), STAGE)

    expect(plan).toMatchObject({
      kind: 'ancient_beast_trial',
      enemyId: ANCIENT_BEAST_ENEMY_ID,
      survivalRounds: ANCIENT_BEAST_SURVIVAL_ROUNDS,
    })
  })

  it('a failed roll leaves no mechanic record (pre-discovery counters do not persist)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    const player = mortalPlayer()
    expect(resolveHiddenBattleReplacement(player, STAGE)).toBeUndefined()
    expect(getAncientBeastTrialMechanic(player)).toBeUndefined()
  })

  it('post-discovery declines increment the pity counter and pity guarantees the plan', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    const player = mortalPlayer()
    const record = discoverHiddenRealm(player, 'mortal')
    expect(record).toBeDefined()
    record!.mechanic = { kind: 'ancient_beast_trial', encounters: 1, rolls: 0 }

    expect(resolveHiddenBattleReplacement(player, STAGE)).toBeUndefined()
    expect(getAncientBeastTrialMechanic(player)?.rolls).toBe(1)

    // At the pity bound the roll is guaranteed even on a high draw.
    getAncientBeastTrialMechanic(player)!.rolls = ANCIENT_BEAST_ENCOUNTER_PITY - 1
    const plan = resolveHiddenBattleReplacement(player, STAGE)
    expect(plan?.kind).toBe('ancient_beast_trial')
    expect(getAncientBeastTrialMechanic(player)?.rolls).toBe(ANCIENT_BEAST_ENCOUNTER_PITY)
  })
})

describe('ancient beast trial - runner (sec.9.5/sec.8.2)', () => {
  it('fired launch discovers the realm and stamps encounters+rolls', () => {
    const player = mortalPlayer()

    const launched = runHiddenBattleReplacement(ctxFor(player, () => true))

    expect(launched).toBe(true)
    const record = player.hiddenPerfection.realms['mortal']
    expect(record?.discovered).toBe(true)
    expect(getAncientBeastTrialMechanic(player)).toMatchObject({ encounters: 1, rolls: 0 })
  })

  it('a failed launch writes nothing (no phantom discovery)', () => {
    const player = mortalPlayer()

    expect(runHiddenBattleReplacement(ctxFor(player, () => false))).toBe(false)
    expect(player.hiddenPerfection.realms['mortal']).toBeUndefined()
  })
})

describe('ancient beast trial - persisted-state validator', () => {
  it('accepts the authored payload shape and rejects malformed counters', () => {
    const emit: string[] = []
    const validator = HIDDEN_MECHANIC_STATE_VALIDATORS['ancient_beast_trial']
    expect(validator).toBeDefined()
    validator!({ kind: 'ancient_beast_trial', encounters: 2, rolls: 7 }, (issue) => emit.push(issue))
    expect(emit).toEqual([])

    validator!({ kind: 'ancient_beast_trial', encounters: 'x', rolls: -1 }, (issue) => emit.push(issue))
    expect(emit.length).toBe(2)
  })
})
