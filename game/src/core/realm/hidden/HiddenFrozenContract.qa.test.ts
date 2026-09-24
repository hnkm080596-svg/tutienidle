// QA repro (sealed review, BETA-HIDDEN-A @ 762d456c): the `frozen`
// flag is written but never enforced. Spec sec.6.3 lists
// `frozen === true while lineageActive === true` as an integrity
// violation; spec sec.2.3 lists `!frozen` as a hard gate on discovery/
// progress. Neither is implemented: a tampered/future save carrying
// frozen=true on an active lineage passes the restore preflight and
// the realm remains progressable.
import { describe, expect, it, afterEach } from 'vitest'
import {
  assertHiddenPerfectionIntegrity,
  createDefaultHiddenPerfection,
  HIDDEN_MECHANIC_STATE_VALIDATORS,
  type HiddenPerfectionState,
} from './HiddenPerfection'
import {
  canProgressHiddenBody,
  completeHiddenBody,
  type HiddenLineagePlayer,
} from './HiddenLineage'
import { HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL } from '../../../data/realm/HiddenBodyRealms'

afterEach(() => {
  delete HIDDEN_MECHANIC_STATE_VALIDATORS[HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL]
})

function integrityIssue(player: {
  hiddenPerfection?: HiddenPerfectionState
  realmId: string
}): string | undefined {
  try {
    assertHiddenPerfectionIntegrity(player)
    return undefined
  } catch (error) {
    return (error as Error).message
  }
}

describe('frozen flag enforcement (spec sec.2.3 gate + sec.6.3 integrity arm)', () => {
  it('integrity rejects frozen=true while lineageActive=true', () => {
    // register a stub validator so the ONLY remaining question is the
    // frozen-active arm (the skeleton ships no validators).
    HIDDEN_MECHANIC_STATE_VALIDATORS[HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL] = () => true
    const state = createDefaultHiddenPerfection()
    state.realms = {
      mortal: {
        discovered: true,
        frozen: true,
        mechanic: { kind: HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL },
      },
    }
    // spec sec.6.3: this combination is an integrity violation.
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'mortal' })).toBeDefined()
  })

  it('canProgressHiddenBody denies a frozen realm even while the lineage is open', () => {
    const player: HiddenLineagePlayer = {
      realmId: 'mortal',
      realmLevel: 1,
      baseStats: {},
      completedStageIds: [],
      hiddenPerfection: createDefaultHiddenPerfection(),
    }
    player.hiddenPerfection!.realms.mortal = {
      discovered: true,
      frozen: true,
      mechanic: { kind: HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL },
    }
    // spec sec.2.3: discoverHiddenRealm/canProgressHiddenBody require !frozen.
    expect(canProgressHiddenBody(player, 'mortal')).toBe(false)
    expect(completeHiddenBody(player, 'mortal')).toBeUndefined()
  })
})
