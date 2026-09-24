// Design 2026-09-23 sec.17 lineage-integrity pins over the production
// authority (HiddenLineage mutators/readers) - strict prefix, closure
// permanence, discovery gating, freeze semantics.
import { afterEach, describe, expect, it } from 'vitest'
import {
  HIDDEN_MECHANIC_FINISHED_READERS,
  canProgressHiddenBody,
  closeHiddenLineage,
  completeHiddenBody,
  discoverHiddenRealm,
  getCompletedHiddenBodyCount,
  getRealmHiddenState,
  isHiddenBodyCompleted,
  isHiddenLineageOpen,
  isHiddenRealmDiscovered,
  recordHiddenBreakthrough,
  wasHiddenBreakthrough,
  type HiddenLineagePlayer,
} from './HiddenLineage'
import { createDefaultHiddenPerfection } from './HiddenPerfection'
import {
  HIDDEN_BODY_REALMS,
  HIDDEN_MECHANIC_QUAN_THE,
} from '../../../data/realm/HiddenBodyRealms'
import { getEffectiveMainStatCap } from '../../stats/StatCap'

function makePlayer(overrides: Partial<HiddenLineagePlayer> = {}): HiddenLineagePlayer {
  return {
    realmId: 'mortal',
    realmLevel: 1,
    baseStats: {},
    completedStageIds: [],
    hiddenPerfection: createDefaultHiddenPerfection(),
    ...overrides,
  }
}

afterEach(() => {
  for (const key of Object.keys(HIDDEN_MECHANIC_FINISHED_READERS)) {
    delete HIDDEN_MECHANIC_FINISHED_READERS[key]
  }
})

describe('HiddenLineage strict prefix', () => {
  it('bat dau o mortal - chi mortal duoc phep tien trien', () => {
    const player = makePlayer()
    expect(canProgressHiddenBody(player, 'mortal')).toBe(true)
    expect(canProgressHiddenBody(player, 'qi_refining')).toBe(false)
    expect(canProgressHiddenBody(player, 'foundation_establishment')).toBe(false)
  })

  it('realm khong duoc author khong bao gio progress duoc', () => {
    const player = makePlayer()
    expect(canProgressHiddenBody(player, 'nascent_soul')).toBe(false)
    expect(canProgressHiddenBody(player, 'not_a_realm')).toBe(false)
  })

  it('hoan thanh mortal mo qi_refining - bo qua mortal bi chan', () => {
    const player = makePlayer()

    expect(completeHiddenBody(player, 'qi_refining')).toBeUndefined()
    expect(isHiddenBodyCompleted(player, 'qi_refining')).toBe(false)

    completeHiddenBody(player, 'mortal')
    expect(canProgressHiddenBody(player, 'mortal')).toBe(false)
    // residency gate: the player must BE in a realm to progress it
    expect(canProgressHiddenBody(player, 'qi_refining')).toBe(false)
    player.realmId = 'qi_refining'
    expect(canProgressHiddenBody(player, 'qi_refining')).toBe(true)
    expect(canProgressHiddenBody(player, 'foundation_establishment')).toBe(false)

    completeHiddenBody(player, 'qi_refining')
    player.realmId = 'foundation_establishment'
    expect(canProgressHiddenBody(player, 'foundation_establishment')).toBe(true)
  })

  it('completeHiddenBody luy dang - complete x2 la no-op tra ve entry cu', () => {
    const player = makePlayer()
    const first = completeHiddenBody(player, 'mortal')
    const second = completeHiddenBody(player, 'mortal')
    expect(second).toBe(first)
    expect(player.hiddenPerfection!.completedHiddenBodyRealmIds).toEqual(['mortal'])
  })
})

describe('HiddenLineage discovery (sec.4 no-leak)', () => {
  it('realm chua discovered khong lo state', () => {
    const player = makePlayer()
    expect(isHiddenRealmDiscovered(player, 'mortal')).toBe(false)
    expect(getRealmHiddenState(player, 'mortal')).toBeUndefined()
  })

  it('discoverHiddenRealm chi ghi realm dung luot trong prefix', () => {
    const player = makePlayer()

    expect(discoverHiddenRealm(player, 'qi_refining')).toBeUndefined()
    expect(isHiddenRealmDiscovered(player, 'qi_refining')).toBe(false)

    const entry = discoverHiddenRealm(player, 'mortal')
    expect(entry?.discovered).toBe(true)
    expect(isHiddenRealmDiscovered(player, 'mortal')).toBe(true)
  })

  it('discovery idempotent - khong ghi de co so', () => {
    const player = makePlayer()
    const first = discoverHiddenRealm(player, 'mortal')
    const second = discoverHiddenRealm(player, 'mortal')
    expect(second).toBe(first)
  })
})

describe('HiddenLineage closure (sec.3.3 one-way latch)', () => {
  it('closeHiddenLineage dong vinh vien - khong write nao mo lai', () => {
    const player = makePlayer()
    closeHiddenLineage(player, 'mortal')

    expect(isHiddenLineageOpen(player)).toBe(false)
    expect(player.hiddenPerfection!.lineageClosedByRealmId).toBe('mortal')

    // every write fails closed afterward
    expect(discoverHiddenRealm(player, 'mortal')).toBeUndefined()
    expect(completeHiddenBody(player, 'mortal')).toBeUndefined()
    player.realmId = 'qi_refining'
    expect(recordHiddenBreakthrough(player, 'qi_refining')).toBe(false)
  })

  it('close idempotent - goi lan hai khong doi closer', () => {
    const player = makePlayer()
    closeHiddenLineage(player, 'mortal')
    player.realmId = 'qi_refining'
    closeHiddenLineage(player, 'qi_refining')
    expect(player.hiddenPerfection!.lineageClosedByRealmId).toBe('mortal')
  })

  it('hidden body da hoan thanh song sot qua closure - cap bonus giu nguyen', () => {
    const player = makePlayer({ realmId: 'mortal' })
    completeHiddenBody(player, 'mortal')
    expect(getEffectiveMainStatCap(player)).toBe(11)

    closeHiddenLineage(player, 'mortal')

    expect(getCompletedHiddenBodyCount(player)).toBe(1)
    expect(isHiddenBodyCompleted(player, 'mortal')).toBe(true)
    // historical Hidden Body bonuses survive lineage closure (sec.17)
    expect(getEffectiveMainStatCap(player)).toBe(11)
  })

  it('freeze: mechanism finished + body chua complete -> frozen khi close', () => {
    const player = makePlayer({ realmId: 'mortal' })
    completeHiddenBody(player, 'mortal')
    player.realmId = 'qi_refining'
    const qiEntry = discoverHiddenRealm(player, 'qi_refining')
    qiEntry!.mechanic = { kind: HIDDEN_MECHANIC_QUAN_THE, diverted: true }

    HIDDEN_MECHANIC_FINISHED_READERS[HIDDEN_MECHANIC_QUAN_THE] = (payload) =>
      payload.diverted === true

    closeHiddenLineage(player, 'qi_refining')

    expect(getRealmHiddenState(player, 'qi_refining')?.frozen).toBe(true)
    // completed body is never frozen
    expect(getRealmHiddenState(player, 'mortal')?.frozen).not.toBe(true)
  })

  it('freeze: mechanism chua finished van bi frozen (spec sec.2.3 freeze unconditional)', () => {
    const player = makePlayer({ realmId: 'mortal' })
    completeHiddenBody(player, 'mortal')
    player.realmId = 'qi_refining'
    const qiEntry = discoverHiddenRealm(player, 'qi_refining')
    qiEntry!.mechanic = { kind: HIDDEN_MECHANIC_QUAN_THE, diverted: false }

    HIDDEN_MECHANIC_FINISHED_READERS[HIDDEN_MECHANIC_QUAN_THE] = (payload) =>
      payload.diverted === true

    closeHiddenLineage(player, 'qi_refining')
    expect(getRealmHiddenState(player, 'qi_refining')?.frozen).toBe(true)
  })

  it('freeze: record discovered-only (khong mechanism) van bi frozen', () => {
    const noReader = makePlayer({ realmId: 'mortal' })
    completeHiddenBody(noReader, 'mortal')
    noReader.realmId = 'qi_refining'
    discoverHiddenRealm(noReader, 'qi_refining')
    closeHiddenLineage(noReader, 'qi_refining')
    expect(getRealmHiddenState(noReader, 'qi_refining')?.frozen).toBe(true)
  })

  it('frozen progress khong the resume hay migrate sang realm sau', () => {
    const player = makePlayer({ realmId: 'mortal' })
    completeHiddenBody(player, 'mortal')
    player.realmId = 'qi_refining'
    discoverHiddenRealm(player, 'qi_refining')!.mechanic = {
      kind: HIDDEN_MECHANIC_QUAN_THE,
      diverted: true,
    }
    HIDDEN_MECHANIC_FINISHED_READERS[HIDDEN_MECHANIC_QUAN_THE] = () => true

    closeHiddenLineage(player, 'qi_refining')

    // closed lineage: no discovery or completion may resume anywhere
    expect(canProgressHiddenBody(player, 'qi_refining')).toBe(false)
    expect(canProgressHiddenBody(player, 'foundation_establishment')).toBe(false)
    // the frozen mark stays on the closed realm only - no later realm
    // ever receives it
    expect(getRealmHiddenState(player, 'foundation_establishment')).toBeUndefined()
  })
})

describe('recordHiddenBreakthrough', () => {
  it('ghi entered realm dung mot lan - lineage van mo', () => {
    const player = makePlayer({ realmId: 'qi_refining' })
    expect(recordHiddenBreakthrough(player, 'qi_refining')).toBe(true)
    expect(wasHiddenBreakthrough(player, 'qi_refining')).toBe(true)
    expect(isHiddenLineageOpen(player)).toBe(true)
    expect(recordHiddenBreakthrough(player, 'qi_refining')).toBe(true)
    expect(player.hiddenPerfection!.hiddenBreakthroughRealmIds).toEqual(['qi_refining'])
  })

  it('fail-closed: realm root, realm khong dung, lineage dong', () => {
    const onMortal = makePlayer({ realmId: 'mortal' })
    expect(recordHiddenBreakthrough(onMortal, 'mortal')).toBe(false)
    expect(recordHiddenBreakthrough(onMortal, 'qi_refining')).toBe(false)

    const closed = makePlayer({ realmId: 'qi_refining' })
    closeHiddenLineage(closed, 'mortal')
    expect(recordHiddenBreakthrough(closed, 'qi_refining')).toBe(false)
  })
})

describe('HIDDEN_BODY_REALMS authored order', () => {
  it('registry la strict prefix cua progression axis', () => {
    expect(HIDDEN_BODY_REALMS.map((r) => r.realmId)).toEqual([
      'mortal',
      'qi_refining',
      'foundation_establishment',
    ])
  })
})
