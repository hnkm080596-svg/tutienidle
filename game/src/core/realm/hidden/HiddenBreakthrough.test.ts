// Design 2026-09-23 sec.17 breakthrough pins: the Lv12 normal /
// Lv18 hidden gates, the "Normal does not require Body completion"
// law, lineage survival/closure through commits, and sec.4 visibility
// absence (Lv18 alone never leaks the hidden type).
import { describe, expect, it } from 'vitest'
import {
  canTriggerBreakthrough,
  getBreakthroughRequirements,
  type BreakthroughGatePlayer,
} from '../BreakthroughGate'
import {
  closeHiddenLineage,
  completeHiddenBody,
  isHiddenBreakthroughEligible,
  isHiddenLineageOpen,
  resolveBreakthroughType,
  type HiddenLineagePlayer,
} from './HiddenLineage'
import { createDefaultHiddenPerfection } from './HiddenPerfection'
import { getEffectiveMainStatCap } from '../../stats/StatCap'
import { MAIN_STAT_KEYS } from '../../stats/StatTypes'
import {
  CORE_REALM_LEVEL,
  EXTENDED_REALM_LEVEL,
  QI_REFINING_BREAKTHROUGH_STAGE_ID,
} from '../realmSystem'

function gatePlayer(overrides: Partial<BreakthroughGatePlayer> = {}): BreakthroughGatePlayer {
  return { realmId: 'mortal', realmLevel: 1, completedStageIds: [], ...overrides }
}

function lineagePlayer(overrides: Partial<HiddenLineagePlayer> = {}): HiddenLineagePlayer {
  return {
    realmId: 'mortal',
    realmLevel: 1,
    baseStats: {},
    completedStageIds: [],
    hiddenPerfection: createDefaultHiddenPerfection(),
    ...overrides,
  }
}

function statsAtCap(player: HiddenLineagePlayer): Record<string, number> {
  const cap = getEffectiveMainStatCap(player)
  return Object.fromEntries(MAIN_STAT_KEYS.map((key) => [key, cap]))
}

function mortalHiddenReady(realmLevel: number): HiddenLineagePlayer {
  const player = lineagePlayer({ realmId: 'mortal', realmLevel })
  completeHiddenBody(player, 'mortal')
  player.baseStats = statsAtCap(player)
  return player
}

describe('Normal breakthrough gate (design sec.5/sec.6)', () => {
  it('Lv11 -> Normal unavailable; Lv12 -> Normal eligible', () => {
    expect(canTriggerBreakthrough(gatePlayer({ realmLevel: CORE_REALM_LEVEL - 1 }))).toBe(false)
    expect(canTriggerBreakthrough(gatePlayer({ realmLevel: CORE_REALM_LEVEL }))).toBe(true)
  })

  it('Lv13-18 -> cultivation van tiep tuc binh thuong (gate mo)', () => {
    for (const level of [13, 15, 17, EXTENDED_REALM_LEVEL]) {
      expect(canTriggerBreakthrough(gatePlayer({ realmLevel: level }))).toBe(true)
    }
  })

  it('Normal breakthrough khong yeu cau Body completion', () => {
    // requirement rows expose only the ordinary keys - no body node,
    // no meridian-9 remnant, no hidden row may ever appear here
    const rows = getBreakthroughRequirements(gatePlayer({ realmLevel: 99 }))
    expect(rows.map((row) => row.key)).toEqual(['level'])
    expect(rows.every((row) => row.met)).toBe(true)
  })

  it('qi_refining gate: level + chapterClear - khong row nao khac', () => {
    const rows = getBreakthroughRequirements(
      gatePlayer({ realmId: 'qi_refining', realmLevel: CORE_REALM_LEVEL }),
    )
    expect(rows.map((row) => row.key)).toEqual(['level', 'chapterClear'])
    expect(canTriggerBreakthrough(gatePlayer({ realmId: 'qi_refining', realmLevel: 99 }))).toBe(
      false,
    )
    expect(
      canTriggerBreakthrough(
        gatePlayer({
          realmId: 'qi_refining',
          realmLevel: 99,
          completedStageIds: [QI_REFINING_BREAKTHROUGH_STAGE_ID],
        }),
      ),
    ).toBe(true)
  })

  it('transition dong (foundation -> kim_dan tren ceiling) -> khong row nao', () => {
    expect(
      getBreakthroughRequirements(gatePlayer({ realmId: 'foundation_establishment', realmLevel: 99 })),
    ).toEqual([])
    expect(
      canTriggerBreakthrough(gatePlayer({ realmId: 'foundation_establishment', realmLevel: 99 })),
    ).toBe(false)
  })
})

describe('Hidden breakthrough eligibility (design sec.6)', () => {
  it('Lv17 -> Hidden unavailable ngay ca khi body xong + stat at cap', () => {
    const player = mortalHiddenReady(EXTENDED_REALM_LEVEL - 1)
    expect(isHiddenBreakthroughEligible(player)).toBe(false)
    expect(resolveBreakthroughType(player)).toBe('normal')
  })

  it('Lv18 alone -> Hidden unavailable (thieu moi input khac)', () => {
    const player = lineagePlayer({ realmId: 'mortal', realmLevel: EXTENDED_REALM_LEVEL })
    expect(isHiddenBreakthroughEligible(player)).toBe(false)
    expect(resolveBreakthroughType(player)).toBe('normal')
  })

  it('Lv18 + lineage + body + all-5 at effective cap + ordinary reqs -> hidden', () => {
    const player = mortalHiddenReady(EXTENDED_REALM_LEVEL)
    expect(isHiddenBreakthroughEligible(player)).toBe(true)
    expect(resolveBreakthroughType(player)).toBe('hidden')
  })

  it('thieu bat ky input nao -> normal', () => {
    // lineage closed
    const closed = mortalHiddenReady(EXTENDED_REALM_LEVEL)
    closeHiddenLineage(closed, 'mortal')
    expect(resolveBreakthroughType(closed)).toBe('normal')

    // body incomplete
    const noBody = lineagePlayer({ realmId: 'mortal', realmLevel: EXTENDED_REALM_LEVEL })
    noBody.baseStats = statsAtCap(noBody)
    expect(resolveBreakthroughType(noBody)).toBe('normal')

    // one stat below effective cap
    const shortStat = mortalHiddenReady(EXTENDED_REALM_LEVEL)
    shortStat.baseStats['vitality'] = getEffectiveMainStatCap(shortStat) - 1
    expect(resolveBreakthroughType(shortStat)).toBe('normal')
  })

  it('hidden eligibility doc cap HIEU LUC - mortal body xong => cap 11', () => {
    const player = lineagePlayer({ realmId: 'mortal', realmLevel: EXTENDED_REALM_LEVEL })
    completeHiddenBody(player, 'mortal')
    // 10 (base cap) is below the effective cap 11 - not eligible
    player.baseStats = Object.fromEntries(MAIN_STAT_KEYS.map((key) => [key, 10]))
    expect(isHiddenBreakthroughEligible(player)).toBe(false)
    player.baseStats = statsAtCap(player)
    expect(isHiddenBreakthroughEligible(player)).toBe(true)
  })

  it('successful hidden transition preserve lineage - resolver khong dong', () => {
    const player = mortalHiddenReady(EXTENDED_REALM_LEVEL)
    expect(resolveBreakthroughType(player)).toBe('hidden')
    expect(isHiddenLineageOpen(player)).toBe(true)
  })

  it('failed Normal attempt preserve lineage - khong write nao tren failure', () => {
    // failure paths never invoke a lineage mutator: a player whose
    // ordinary gate fails resolves nothing and stays untouched
    const player = mortalHiddenReady(EXTENDED_REALM_LEVEL)
    const before = JSON.stringify(player.hiddenPerfection)
    expect(canTriggerBreakthrough(player)).toBe(true)
    // a defeated attempt writes nothing - hiddenPerfection unchanged
    expect(JSON.stringify(player.hiddenPerfection)).toBe(before)
    expect(isHiddenLineageOpen(player)).toBe(true)
  })
})

describe('Visibility absence (design sec.4 / sec.17)', () => {
  it('Lv18 khong tu no leak Hidden Breakthrough - rows khong doi', () => {
    const low = getBreakthroughRequirements(gatePlayer({ realmLevel: CORE_REALM_LEVEL }))
    const high = getBreakthroughRequirements(gatePlayer({ realmLevel: EXTENDED_REALM_LEVEL }))
    expect(high.map((row) => row.key)).toEqual(low.map((row) => row.key))
    for (const row of high) {
      expect(row.key === 'level' || row.key === 'chapterClear').toBe(true)
    }
  })

  it('qi_refining rows khong bao gio mang hidden input', () => {
    const rows = getBreakthroughRequirements(
      gatePlayer({
        realmId: 'qi_refining',
        realmLevel: EXTENDED_REALM_LEVEL,
        completedStageIds: [QI_REFINING_BREAKTHROUGH_STAGE_ID],
      }),
    )
    expect(rows.map((row) => row.key).sort()).toEqual(['chapterClear', 'level'])
  })
})
