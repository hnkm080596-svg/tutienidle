// Pin tests (design 2026-09-23 sec.10, master spec sec.8.2) - the
// qi_refining Quan The mechanism: Bat Mach 8/8 + active lineage gates
// lazy discovery at the first actionable gain; subsequent gains bank
// into quanTheProgress through the FINAL cultivation seam; at the
// authored threshold the divert releases, the hidden body completes,
// and 100% of any overflow lands on realm cultivation in the same
// settlement.
//
// The module registers its diverter+validator+finished reader at
// import - tests exercise the seam's public surface.
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '../../player/Player'
import { resolveFinalCultivationGain } from '../../cultivation/CultivationDiversion'
import { HIDDEN_MECHANIC_FINISHED_READERS } from './HiddenLineage'
import { HIDDEN_MECHANIC_STATE_VALIDATORS } from './HiddenPerfection'
import {
  getQuanTheMechanic,
  isQuanTheActionable,
  QUAN_THE_REQUIRED_CULTIVATION,
} from './QuanTheDiversion'
import { MERIDIANS } from '../../../data/realm/Meridians'

function qiPlayerWithMortalBody(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  // Mortal hidden body already completed (strict prefix) - the write
  // path is covered elsewhere; here we seed the persisted shape.
  player.hiddenPerfection.realms['mortal'] = {
    discovered: true,
    bodyCompleted: true,
    frozen: false,
  }
  player.hiddenPerfection.completedHiddenBodyRealmIds.push('mortal')
  return player
}

function openAllMeridians(player: PlayerData): void {
  player.bodyProgression.meridian.openedIds = MERIDIANS.map((m) => m.id)
}

describe('quan the - actionable gate (sec.10.2)', () => {
  it('requires qi_refining + lineage + mortal body done + Bat Mach 8/8', () => {
    const player = qiPlayerWithMortalBody()
    openAllMeridians(player)
    expect(isQuanTheActionable(player)).toBe(true)
  })

  it('rejects when the meridian chapter is short of 8/8', () => {
    const player = qiPlayerWithMortalBody()
    player.bodyProgression.meridian.openedIds = MERIDIANS.slice(0, MERIDIANS.length - 1).map((m) => m.id)
    expect(isQuanTheActionable(player)).toBe(false)
  })

  it('rejects without the mortal hidden body (strict prefix)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    openAllMeridians(player)
    expect(isQuanTheActionable(player)).toBe(false)
  })

  it('rejects a closed lineage', () => {
    const player = qiPlayerWithMortalBody()
    openAllMeridians(player)
    player.hiddenPerfection.lineageActive = false
    player.hiddenPerfection.lineageClosedByRealmId = 'foundation'
    expect(isQuanTheActionable(player)).toBe(false)
  })
})

describe('quan the - diversion (sec.10.3/sec.10.4)', () => {
  it('the first actionable gain discovers the realm and banks fully', () => {
    const player = qiPlayerWithMortalBody()
    openAllMeridians(player)

    const landed = resolveFinalCultivationGain(player, 100)

    expect(landed).toBe(0)
    const record = player.hiddenPerfection.realms['qi_refining']
    expect(record?.discovered).toBe(true)
    expect(getQuanTheMechanic(player)).toMatchObject({
      kind: 'quan_the',
      active: true,
      progress: 100,
      required: QUAN_THE_REQUIRED_CULTIVATION,
    })
  })

  it('non-actionable players gain normally (no record created)', () => {
    const player = qiPlayerWithMortalBody() // meridians still empty

    expect(resolveFinalCultivationGain(player, 250)).toBe(250)
    expect(getQuanTheMechanic(player)).toBeUndefined()
    expect(player.hiddenPerfection.realms['qi_refining']).toBeUndefined()
  })

  it('banks every gain until the threshold, then completes and overflows 100%', () => {
    const player = qiPlayerWithMortalBody()
    openAllMeridians(player)

    expect(resolveFinalCultivationGain(player, QUAN_THE_REQUIRED_CULTIVATION - 50)).toBe(0)
    expect(getQuanTheMechanic(player)?.progress).toBe(QUAN_THE_REQUIRED_CULTIVATION - 50)

    // 50 fits the remaining requirement, the 200 overflow lands.
    const landed = resolveFinalCultivationGain(player, 250)

    expect(landed).toBe(200)
    const record = player.hiddenPerfection.realms['qi_refining']
    expect(record?.bodyCompleted).toBe(true)
    expect(player.hiddenPerfection.completedHiddenBodyRealmIds).toContain('qi_refining')
    expect(getQuanTheMechanic(player)?.active).toBe(false)
    expect(getQuanTheMechanic(player)?.progress).toBe(QUAN_THE_REQUIRED_CULTIVATION)
  })

  it('after completion the divert releases - gains land fully again', () => {
    const player = qiPlayerWithMortalBody()
    openAllMeridians(player)
    resolveFinalCultivationGain(player, QUAN_THE_REQUIRED_CULTIVATION)

    expect(player.hiddenPerfection.realms['qi_refining']?.bodyCompleted).toBe(true)
    expect(resolveFinalCultivationGain(player, 500)).toBe(500)
  })

  it('a frozen record is inert - no further diversion', () => {
    const player = qiPlayerWithMortalBody()
    openAllMeridians(player)
    resolveFinalCultivationGain(player, 100)
    player.hiddenPerfection.realms['qi_refining']!.frozen = true

    expect(resolveFinalCultivationGain(player, 250)).toBe(250)
    expect(getQuanTheMechanic(player)?.progress).toBe(100)
  })
})

describe('quan the - validator + finished reader', () => {
  it('validator accepts the authored shape and rejects malformed payloads', () => {
    const issues: string[] = []
    const validator = HIDDEN_MECHANIC_STATE_VALIDATORS['quan_the']
    expect(validator).toBeDefined()
    validator!({ kind: 'quan_the', active: true, progress: 5, required: 10 }, (issue) => issues.push(issue))
    expect(issues).toEqual([])

    validator!({ kind: 'quan_the', active: 'yes', progress: -1, required: 0 }, (issue) => issues.push(issue))
    expect(issues.length).toBe(3)
  })

  it('finished reader reports progress >= required', () => {
    const reader = HIDDEN_MECHANIC_FINISHED_READERS['quan_the']
    expect(reader).toBeDefined()
    expect(reader!({ kind: 'quan_the', active: false, progress: 10, required: 10 })).toBe(true)
    expect(reader!({ kind: 'quan_the', active: true, progress: 9, required: 10 })).toBe(false)
  })
})
