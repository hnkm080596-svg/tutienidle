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
import { HIDDEN_MECHANIC_QUAN_THE } from '../../../data/realm/HiddenBodyRealms'

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

  it('throw khi hiddenBreakthroughRealmIds chua mortal hoac realm hien tai', () => {
    const withMortal = createDefaultHiddenPerfection()
    withMortal.hiddenBreakthroughRealmIds = ['mortal']
    expect(integrityIssue({ hiddenPerfection: withMortal, realmId: 'mortal' })).toMatch(
      /integrity violation/,
    )

    const selfRef = createDefaultHiddenPerfection()
    selfRef.hiddenBreakthroughRealmIds = ['qi_refining']
    // entered realm must sit strictly behind current realm
    expect(integrityIssue({ hiddenPerfection: selfRef, realmId: 'qi_refining' })).toMatch(
      /integrity violation/,
    )
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
    // but frozen flag without mechanic payload is coherent
    state.realms = { qi_refining: { discovered: true, frozen: true } }
    expect(integrityIssue({ hiddenPerfection: state, realmId: 'qi_refining' })).toBeUndefined()
  })
})
