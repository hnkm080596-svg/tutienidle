import { describe, expect, it } from 'vitest'

import { MERIDIANS } from '../../../data/realm/Meridians'
import { createDefaultPlayer, type PlayerData } from '../../player/Player'
import { meridianChapter } from './MeridianChapter'

function createLuyenKhiPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  player.realmLevel = 18
  return player
}

// [M13 STATUS: PARKED] - the invest path has no production caller; the
// chapter contract is still implemented and tested (spec sec.4 non-goal:
// no meridian UI/gateway). Ported verbatim from the retired
// MeridianSystem.test.ts onto player.bodyProgression.meridian.openedIds.
describe('MeridianChapter - Bat Mach (spec dot-pha-loi-kiep sec.4.1a)', () => {
  it('data: 9 duong dung thu tu Nham -> Doc + Ky Kinh tang 18, cost tang dan, KHONG cham mana', () => {
    expect(MERIDIANS.map((m) => m.id)).toEqual([
      'nham_mach', 'doi_mach', 'am_kieu_mach', 'am_duy_mach',
      'duong_duy_mach', 'duong_kieu_mach', 'xung_mach', 'doc_mach', 'ky_kinh_thien_dia_chi_kieu',
    ])
    expect(MERIDIANS[0]!.requiredRealmLevel).toBe(2)
    expect(MERIDIANS[7]!.requiredRealmLevel).toBe(16)
    expect(MERIDIANS[8]!.requiredRealmLevel).toBe(18)
    expect(MERIDIANS[8]!.requiresThienDiaChiKieu).toBe(true)
    const allStats = MERIDIANS.flatMap((m) => m.stats)
    expect(allStats).not.toContain('maxMp')
    expect(allStats).not.toContain('manaRegenPerTurn')
    for (let i = 1; i < MERIDIANS.length; i++) {
      expect(MERIDIANS[i]!.thongMachDanCost).toBeGreaterThan(MERIDIANS[i - 1]!.thongMachDanCost)
    }
  })

  it('tuan tu: duong dau (Nham) mo voi dung cost 1 dan', () => {
    const player = createLuyenKhiPlayer()
    player.bodyProgression.meridian.openedIds = []
    const consumed = meridianChapter.invest(player, 10, 0)
    expect(consumed).toBe(1)
    expect(player.bodyProgression.meridian.openedIds).toEqual(['nham_mach'])
  })

  it('gate tang: dung tang 3 (Luyen Khi) khong dau tu duong 2 (mo tang 4)', () => {
    const player = createLuyenKhiPlayer()
    player.realmLevel = 3
    player.bodyProgression.meridian.openedIds = ['nham_mach']
    expect(meridianChapter.invest(player, 10, 0)).toBe(0)
    expect(player.bodyProgression.meridian.openedIds).toEqual(['nham_mach'])
  })

  it('Ky Kinh (duong 9) can ca Thong Mach Dan lan Thien Dia Chi Kieu', () => {
    const player = createLuyenKhiPlayer()
    player.bodyProgression.meridian.openedIds = MERIDIANS.slice(0, 8).map((m) => m.id)
    const consumed = meridianChapter.invest(player, 40, 0)
    expect(consumed).toBe(0)
    expect(player.bodyProgression.meridian.openedIds).toHaveLength(8)
  })

  it('du 9/9: mo Ky Kinh khi co ca 2 nguyen lieu - aux KHONG bi tieu hao boi invest (op tru)', () => {
    const player = createLuyenKhiPlayer()
    player.bodyProgression.meridian.openedIds = MERIDIANS.slice(0, 8).map((m) => m.id)
    const consumed = meridianChapter.invest(player, 40, 1)
    expect(consumed).toBe(40)
    expect(player.bodyProgression.meridian.openedIds).toHaveLength(9)
  })

  it('roi Luyen Khi (da vao Truc Co): van duoc tieu not dan do (pattern Luyen The)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.bodyProgression.meridian.openedIds = ['nham_mach']
    const consumed = meridianChapter.invest(player, 5, 0)
    expect(consumed).toBe(2) // Doi Mach cost 2
    expect(meridianChapter.progress(player).completed).toBe(2)
  })
})

describe('MeridianChapter - chapter contract', () => {
  it('descriptor: id/prefix/currency channels - thong_mach_dan la PILL, thien_dia_chi_kieu la material', () => {
    expect(meridianChapter.id).toBe('meridian')
    expect(meridianChapter.modifierPrefix).toBe('bat-mach:')
    expect(meridianChapter.currency).toEqual({ bag: 'pill', id: 'thong_mach_dan' })
    expect(meridianChapter.auxCurrency).toEqual({ bag: 'material', id: 'thien_dia_chi_kieu' })
  })

  it('invest does NOT rebuild modifiers (the system dispatch owns the rebuild)', () => {
    const player = createLuyenKhiPlayer()

    player.modifiers = []
    meridianChapter.invest(player, 1, 0)

    expect(player.bodyProgression.meridian.openedIds).toEqual(['nham_mach'])
    expect(player.modifiers.filter(m => m.id.startsWith('bat-mach:'))).toHaveLength(0)
  })

  it('applyModifiers emits bat-mach:<id>:<stat> per opened meridian, idempotent, clears stale entries', () => {
    const player = createLuyenKhiPlayer()
    player.bodyProgression.meridian.openedIds = ['nham_mach']

    player.modifiers = [
      {
        id: 'bat-mach:doc_mach:strength',
        sourceId: 'doc_mach',
        sourceType: 'realm',
        stat: 'strength',
        percent: 0.05,
      },
    ]

    meridianChapter.applyModifiers(player)

    const mods = player.modifiers.filter(m => m.id.startsWith('bat-mach:'))
    expect(mods.map(m => m.id)).toEqual(['bat-mach:nham_mach:maxHp'])

    const firstCount = player.modifiers.length
    meridianChapter.applyModifiers(player)
    expect(player.modifiers).toHaveLength(firstCount)
  })

  it('progress / isComplete reads', () => {
    const player = createLuyenKhiPlayer()

    expect(meridianChapter.progress(player)).toEqual({ completed: 0, total: 9 })
    expect(meridianChapter.isComplete(player)).toBe(false)

    player.bodyProgression.meridian.openedIds = MERIDIANS.map(m => m.id)

    expect(meridianChapter.progress(player)).toEqual({ completed: 9, total: 9 })
    expect(meridianChapter.isComplete(player)).toBe(true)
  })
})

describe('MeridianChapter - persisted state + integrity', () => {
  it('validatePersistedState accepts canonical openedIds and rejects malformed slices', () => {
    const issues: { path: string; message: string }[] = []
    const emit = (issue: { path: string; message: string }) => issues.push(issue)
    const base = 'player.bodyProgression.meridian'

    meridianChapter.validatePersistedState({ openedIds: ['nham_mach'] }, base, emit)
    expect(issues).toHaveLength(0)

    meridianChapter.validatePersistedState('nope', base, emit)
    meridianChapter.validatePersistedState({ openedIds: 'nope' }, base, emit)
    meridianChapter.validatePersistedState({ openedIds: [42] }, base, emit)

    const paths = issues.map(i => i.path)
    expect(paths).toContain(base)
    expect(paths).toContain(`${base}.openedIds`)
    expect(paths).toContain(`${base}.openedIds[0]`)
  })

  it('integrityIssues pins the strict-prefix rule over canonical MERIDIANS order', () => {
    const player = createLuyenKhiPlayer()

    expect(meridianChapter.integrityIssues(player)).toHaveLength(0)

    player.bodyProgression.meridian.openedIds = ['nham_mach', 'doi_mach']
    expect(meridianChapter.integrityIssues(player)).toHaveLength(0)

    // Unknown id -> corrupt
    player.bodyProgression.meridian.openedIds = ['nham_mach', 'huyen_mach']
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // Non-prefix order (skipped nham_mach) -> corrupt
    player.bodyProgression.meridian.openedIds = ['doi_mach']
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // Out-of-order known ids -> corrupt
    player.bodyProgression.meridian.openedIds = ['doi_mach', 'nham_mach']
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // Non-array slice -> corrupt (a number's .length is undefined and
    // would slip the prefix loop silently).
    player.bodyProgression.meridian.openedIds = 42 as never
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)
  })
})
