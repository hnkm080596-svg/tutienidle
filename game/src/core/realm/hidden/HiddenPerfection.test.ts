// Design 2026-09-23 sec.17 pins for the persisted HiddenPerfection
// contract: default state, save-shape validation, and the fail-closed
// preflight integrity assert (restore boundary).
import { describe, expect, it } from 'vitest'
import {
  assertHiddenPerfectionIntegrity,
  createDefaultHiddenPerfection,
  validateHiddenPerfectionPersistedState,
  type HiddenPerfectionState,
} from './HiddenPerfection'
import {
  HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL,
  HIDDEN_MECHANIC_QUAN_THE,
} from '../../../data/realm/HiddenBodyRealms'

function issuesOf(player: { hiddenPerfection?: unknown }): string[] {
  const issues: { path: string; message: string }[] = []
  validateHiddenPerfectionPersistedState(player, (issue) => issues.push(issue))
  return issues.map((issue) => `${issue.path}: ${issue.message}`)
}

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

describe('createDefaultHiddenPerfection', () => {
  it('trang thai mac dinh: lineage mo, khong body nao, khong realm state', () => {
    const state = createDefaultHiddenPerfection()
    expect(state.lineageActive).toBe(true)
    expect(state.lineageClosedByRealmId).toBeUndefined()
    expect(state.completedHiddenBodyRealmIds).toEqual([])
    expect(state.hiddenBreakthroughRealmIds).toEqual([])
    expect(state.realms).toEqual({})
  })
})

describe('validateHiddenPerfectionPersistedState (save-shape boundary)', () => {
  it('chap nhan default state', () => {
    expect(issuesOf({ hiddenPerfection: createDefaultHiddenPerfection() })).toEqual([])
  })

  it('tu choi save thieu hiddenPerfection', () => {
    expect(issuesOf({})).not.toEqual([])
    expect(issuesOf({ hiddenPerfection: null })).not.toEqual([])
    expect(issuesOf({ hiddenPerfection: [] })).not.toEqual([])
  })

  it('tu choi field sai kieu', () => {
    expect(
      issuesOf({
        hiddenPerfection: {
          ...createDefaultHiddenPerfection(),
          lineageActive: 'yes',
        },
      }),
    ).not.toEqual([])

    expect(
      issuesOf({
        hiddenPerfection: {
          ...createDefaultHiddenPerfection(),
          completedHiddenBodyRealmIds: 'mortal',
        },
      }),
    ).not.toEqual([])

    expect(
      issuesOf({
        hiddenPerfection: {
          ...createDefaultHiddenPerfection(),
          realms: { mortal: { discovered: 'yes' } },
        },
      }),
    ).not.toEqual([])
  })

  it('mechanic payload phai mang kind string', () => {
    expect(
      issuesOf({
        hiddenPerfection: {
          ...createDefaultHiddenPerfection(),
          realms: { qi_refining: { mechanic: { diverted: true } } },
        },
      }),
    ).not.toEqual([])
  })
})

describe('assertHiddenPerfectionIntegrity (restore preflight, fail-closed)', () => {
  it('chap nhan default state', () => {
    expect(
      integrityIssue({ hiddenPerfection: createDefaultHiddenPerfection(), realmId: 'mortal' }),
    ).toBeUndefined()
  })

  it('throw khi field vang mat - save cu khong the tro lai lineage', () => {
    expect(integrityIssue({ realmId: 'mortal' })).toMatch(/integrity violation/)
  })

  it('throw khi lineage dong ma thieu closer realm id', () => {
    const state = createDefaultHiddenPerfection()
    state.lineageActive = false
    expect(
      integrityIssue({ hiddenPerfection: state, realmId: 'qi_refining' }),
    ).toMatch(/lineageClosedByRealmId/)
  })

  it('throw khi lineage mo ma mang closer realm id', () => {
    const state = createDefaultHiddenPerfection()
    state.lineageClosedByRealmId = 'mortal'
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'mortal' })).toMatch(
      /integrity violation/,
    )
  })

  it('skipped hidden history fail closed - completed list khong prefix', () => {
    const state = createDefaultHiddenPerfection()
    // qi_refining completed without mortal - violates strict prefix
    state.completedHiddenBodyRealmIds = ['qi_refining']
    state.realms = { qi_refining: { bodyCompleted: true, discovered: true } }
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'qi_refining' })).toMatch(
      /strict-prefix|integrity violation/,
    )
  })

  it('throw khi completed list va bodyCompleted flag khong dong nhat', () => {
    const state = createDefaultHiddenPerfection()
    state.completedHiddenBodyRealmIds = ['mortal']
    state.realms = { mortal: { discovered: true } } // missing bodyCompleted flag
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'qi_refining' })).toMatch(
      /integrity violation/,
    )

    const inverse = createDefaultHiddenPerfection()
    inverse.realms = { mortal: { bodyCompleted: true, discovered: true } }
    expect(integrityIssue({ hiddenPerfection: inverse, realmId: 'qi_refining' })).toMatch(
      /integrity violation/,
    )
  })

  it('throw khi realm key khong duoc author', () => {
    const state = createDefaultHiddenPerfection()
    state.realms = { nascent_soul: { discovered: true } }
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'mortal' })).toMatch(
      /integrity violation/,
    )
  })

  it('throw khi hiddenBreakthroughRealmIds chua mortal hoac realm chua toi', () => {
    const withMortal = createDefaultHiddenPerfection()
    withMortal.hiddenBreakthroughRealmIds = ['mortal']
    expect(integrityIssue({ hiddenPerfection: withMortal, realmId: 'mortal' })).toMatch(
      /integrity violation/,
    )

    // the CURRENT realm is legal (save right after the commit) -
    // the DEPARTING realm's hidden body is the precondition
    const selfRef = createDefaultHiddenPerfection()
    selfRef.completedHiddenBodyRealmIds = ['mortal']
    selfRef.realms = { mortal: { bodyCompleted: true } }
    selfRef.hiddenBreakthroughRealmIds = ['qi_refining']
    expect(
      integrityIssue({ hiddenPerfection: selfRef, realmId: 'qi_refining' }),
    ).toBeUndefined()

    // a FUTURE realm is impossible
    const future = createDefaultHiddenPerfection()
    future.completedHiddenBodyRealmIds = ['mortal']
    future.hiddenBreakthroughRealmIds = ['foundation_establishment']
    expect(integrityIssue({ hiddenPerfection: future, realmId: 'qi_refining' })).toMatch(
      /integrity violation/,
    )
  })

  it('throw khi entered realm thieu hidden body cua realm roi di', () => {
    // entry into foundation requires the qi_refining hidden body;
    // mortal body alone cannot unlock it
    const state = createDefaultHiddenPerfection()
    state.completedHiddenBodyRealmIds = ['mortal']
    state.realms = { mortal: { bodyCompleted: true } }
    state.hiddenBreakthroughRealmIds = ['qi_refining', 'foundation_establishment']
    expect(
      integrityIssue({ hiddenPerfection: state, realmId: 'foundation_establishment' }),
    ).toMatch(/integrity violation/)

    state.completedHiddenBodyRealmIds = ['mortal', 'qi_refining']
    state.realms = {
      mortal: { bodyCompleted: true },
      qi_refining: { bodyCompleted: true },
    }
    expect(
      integrityIssue({ hiddenPerfection: state, realmId: 'foundation_establishment' }),
    ).toBeUndefined()
  })

  it('throw khi mechanic kind khong khop authored tag', () => {
    const state = createDefaultHiddenPerfection()
    state.realms = { qi_refining: { mechanic: { kind: 'bogus' } } }
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'qi_refining' })).toMatch(
      /integrity violation/,
    )
  })

  it('throw khi frozen va bodyCompleted cung true - mau thuan', () => {
    const state = createDefaultHiddenPerfection()
    state.lineageActive = false
    state.lineageClosedByRealmId = 'mortal'
    state.completedHiddenBodyRealmIds = ['mortal']
    state.realms = { mortal: { discovered: true, bodyCompleted: true, frozen: true } }
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'qi_refining' })).toMatch(
      /integrity violation/,
    )
  })

  it('chap nhan coherent lineage dong voi frozen mechanic state', () => {
    const state = createDefaultHiddenPerfection()
    state.lineageActive = false
    state.lineageClosedByRealmId = 'mortal'
    state.realms = {
      qi_refining: {
        discovered: true,
        frozen: true,
        mechanic: { kind: HIDDEN_MECHANIC_QUAN_THE },
      },
    }
    // no validator registered yet (skeleton) -> unvalidated payload fails
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'qi_refining' })).toMatch(
      /integrity violation/,
    )
    // frozen without a mechanism is incoherent too - nothing was ever
    // frozen (closeHiddenLineage only freezes mechanic-bearing entries)
    state.realms = { qi_refining: { discovered: true, frozen: true } }
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'qi_refining' })).toMatch(
      /integrity violation/,
    )
    // discovered-only (mechanism not yet producing state) IS coherent
    // at the lineage frontier: mortal completed -> qi is next in line.
    // Fully reachable fixture: hidden qi entry, then a NORMAL
    // qi->foundation breakthrough closed the lineage - the frozen
    // discovery stays behind.
    state.lineageClosedByRealmId = 'qi_refining'
    state.hiddenBreakthroughRealmIds = ['qi_refining']
    state.completedHiddenBodyRealmIds = ['mortal']
    state.realms = {
      mortal: { discovered: true, bodyCompleted: true },
      qi_refining: { discovered: true },
    }
    expect(
      integrityIssue({ hiddenPerfection: state, realmId: 'foundation_establishment' }),
    ).toBeUndefined()
  })

  it('throw khi realm state vuot qua prefix hoan thanh - sec.4 no-leak frontier', () => {
    const state = createDefaultHiddenPerfection()
    // completed list is empty -> authored index 0 (mortal) is the
    // frontier; a foundation entry (authored index 2) is unreachable.
    state.realms = { foundation_establishment: { discovered: true } }
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'mortal' })).toMatch(
      /integrity violation/,
    )
    // qi_refining (index 1) at frontier 0 completed is also unreachable.
    state.realms = { qi_refining: { discovered: true } }
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'mortal' })).toMatch(
      /integrity violation/,
    )
    // with mortal completed, qi_refining becomes the frontier - legal.
    state.completedHiddenBodyRealmIds = ['mortal']
    state.realms = {
      mortal: { discovered: true, bodyCompleted: true },
      qi_refining: { discovered: true },
    }
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'qi_refining' })).toBeUndefined()
  })

  it('throw khi mechanic hien huu nhung chua discovered', () => {
    const state = createDefaultHiddenPerfection()
    state.realms = {
      mortal: { mechanic: { kind: HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL } },
    }
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'mortal' })).toMatch(
      /integrity violation/,
    )
  })
})
