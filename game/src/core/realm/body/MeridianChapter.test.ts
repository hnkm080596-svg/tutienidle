import { afterEach, describe, expect, it, vi } from 'vitest'

import { MERIDIANS } from '../../../data/realm/Meridians'
import { createDefaultPlayer, type PlayerData } from '../../player/Player'
import {
  meridianChapter,
  meridianMilestonePercent,
  readMeridianProgressSlice,
} from './MeridianChapter'

function createLuyenKhiPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  player.realmLevel = 18
  return player
}

function setProgress(player: PlayerData, entries: Array<[string, number]>): void {
  player.bodyProgression.meridian.progress = Object.fromEntries(entries)
}

afterEach(() => {
  vi.restoreAllMocks()
})

// Progressive-percent Khai Mach (owner ruling): each invest consumes
// exactly 1 Thong Mach Dan and adds a uniform Math.random gain inside
// the meridian's investGainRange; stats apply per 20% milestone.
describe('MeridianChapter - Bat Mach progressive (spec dot-pha-loi-kiep sec.4.1a)', () => {
  it('data: 8 duong dung thu tu Nham -> Doc, gain ranges per index, 1 dan per invest, KHONG cham mana', () => {
    // Hidden Perfection Lineage (2026-09-23): the 9th meridian
    // (ky_kinh_thien_dia_chi_kieu) retires - its material-gated
    // completion belonged to the old BodyPerfection authority and is
    // superseded by the HIDDEN-B Quan The seam.
    expect(MERIDIANS.map((m) => m.id)).toEqual([
      'nham_mach', 'doi_mach', 'am_kieu_mach', 'am_duy_mach',
      'duong_duy_mach', 'duong_kieu_mach', 'xung_mach', 'doc_mach',
    ])
    expect(MERIDIANS[0]!.requiredRealmLevel).toBe(2)
    expect(MERIDIANS[7]!.requiredRealmLevel).toBe(16)
    // Owner gain table by data index.
    expect(MERIDIANS.map((m) => m.investGainRange)).toEqual([
      { min: 5, max: 10 },
      { min: 4, max: 9 },
      { min: 3, max: 8 },
      { min: 2, max: 7 },
      { min: 1, max: 6 },
      { min: 1, max: 4 },
      { min: 1, max: 2 },
      { min: 0.1, max: 1 },
    ])
    for (const meridian of MERIDIANS) {
      expect(meridian.thongMachDanCost).toBe(1)
    }
    const allStats = MERIDIANS.flatMap((m) => m.stats)
    expect(allStats).not.toContain('maxMp')
    expect(allStats).not.toContain('manaRegenPerTurn')
  })

  it('invest: 1 dan per invest adds a uniform random gain inside investGainRange', () => {
    const player = createLuyenKhiPlayer()
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5)

    // idx0 Nham 5~10 -> mid 7.5
    expect(meridianChapter.invest(player, 10, 0)).toBe(1)
    expect(player.bodyProgression.meridian.progress.nham_mach).toBeCloseTo(7.5, 10)
    expect(spy).toHaveBeenCalledTimes(1)

    // Each further invest consumes exactly 1 more pill.
    expect(meridianChapter.invest(player, 9, 0)).toBe(1)
    expect(player.bodyProgression.meridian.progress.nham_mach).toBeCloseTo(15, 10)
  })

  it('invest gain stays inside the rolled range across the bounds', () => {
    const player = createLuyenKhiPlayer()
    const spy = vi.spyOn(Math, 'random')
    spy.mockReturnValue(0)
    meridianChapter.invest(player, 10, 0)
    expect(player.bodyProgression.meridian.progress.nham_mach).toBeCloseTo(5, 10)

    spy.mockReturnValue(0.999999)
    meridianChapter.invest(player, 10, 0)
    expect(player.bodyProgression.meridian.progress.nham_mach).toBeCloseTo(5 + 10 * 0.999999, 5)
  })

  it('caps progress at 100 (float kept, overshoot discarded)', () => {
    const player = createLuyenKhiPlayer()
    setProgress(player, [['nham_mach', 97]])
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)

    expect(meridianChapter.invest(player, 1, 0)).toBe(1)
    expect(player.bodyProgression.meridian.progress.nham_mach).toBe(100)
  })

  it('tuan tu: duong sau KHONG dau tu khi duong truoc chua 100', () => {
    const player = createLuyenKhiPlayer()
    // nham at 50 (partial) -> doi must NOT receive progress.
    setProgress(player, [['nham_mach', 50]])
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(meridianChapter.invest(player, 10, 0)).toBe(1)
    expect(player.bodyProgression.meridian.progress.nham_mach).toBeCloseTo(57.5, 10)
    expect(player.bodyProgression.meridian.progress.doi_mach).toBeUndefined()
  })

  it('tuan tu: duong ke tiep chi mo khi ALL truoc do = 100', () => {
    const player = createLuyenKhiPlayer()
    setProgress(player, [['nham_mach', 100]])
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(meridianChapter.invest(player, 10, 0)).toBe(1)
    // idx1 Doi 4~9 -> mid 6.5
    expect(player.bodyProgression.meridian.progress.doi_mach).toBeCloseTo(6.5, 10)
  })

  it('gate tang: dung tang 3 (Luyen Khi) khong dau tu duong 2 (mo tang 4)', () => {
    const player = createLuyenKhiPlayer()
    player.realmLevel = 3
    setProgress(player, [['nham_mach', 100]])
    expect(meridianChapter.invest(player, 10, 0)).toBe(0)
    expect(player.bodyProgression.meridian.progress.doi_mach).toBeUndefined()
  })

  it('roi Luyen Khi (da vao Truc Co): van duoc tieu not dan do (pattern Luyen The)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    setProgress(player, [['nham_mach', 100]])
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const consumed = meridianChapter.invest(player, 5, 0)
    expect(consumed).toBe(1) // 1 pill per invest
    expect(player.bodyProgression.meridian.progress.doi_mach).toBeCloseTo(4, 10)
    expect(meridianChapter.progress(player).completed).toBe(1)
  })

  // M-E (D2) - the qi_refining PAGE is realm-locked: a mortal player's
  // realm index is below the page's, so investment is structurally
  // impossible even with materials in hand. (Spec-time finding: the
  // old realmId-equality pace check let mortal invest - masked only
  // by the parked caller.)
  it('M-E: Pham Nhan KHONG dau tu duoc du page-material du (page locked)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 20
    expect(meridianChapter.invest(player, 999, 99)).toBe(0)
    expect(readMeridianProgressSlice(player.bodyProgression.meridian)).toEqual({})

    // Same for a later meridian mid-sequence.
    setProgress(player, [['nham_mach', 100]])
    expect(meridianChapter.invest(player, 999, 99)).toBe(0)
    expect(player.bodyProgression.meridian.progress.doi_mach).toBeUndefined()
  })
})

describe('MeridianChapter - milestone stat emission', () => {
  it('meridianMilestonePercent: floor(progress/20) of 5 milestones', () => {
    const nham = MERIDIANS[0]! // percentAtFullTier 0.05
    expect(meridianMilestonePercent(nham, 0)).toBe(0)
    expect(meridianMilestonePercent(nham, 19.99)).toBe(0)
    expect(meridianMilestonePercent(nham, 20)).toBeCloseTo(0.01, 10)
    expect(meridianMilestonePercent(nham, 60)).toBeCloseTo(0.03, 10)
    expect(meridianMilestonePercent(nham, 99.4)).toBeCloseTo(0.04, 10)
    expect(meridianMilestonePercent(nham, 100)).toBeCloseTo(0.05, 10)
  })

  it('applyModifiers emits milestone-scaled bat-mach:<id>:<stat> (20/60/100)', () => {
    const player = createLuyenKhiPlayer()
    setProgress(player, [['nham_mach', 20], ['doi_mach', 0]])
    // nham at 20 -> 1 milestone -> 0.01; doi needs nham=100 to exist
    // legitimately but applyModifiers reads the raw map - percent 0
    // emits nothing.
    meridianChapter.applyModifiers(player)
    let mods = player.modifiers.filter((m) => m.id.startsWith('bat-mach:'))
    expect(mods.map((m) => m.id)).toEqual(['bat-mach:nham_mach:maxHp'])
    expect(mods[0]!.percent).toBeCloseTo(0.01, 10)

    setProgress(player, [['nham_mach', 60]])
    meridianChapter.applyModifiers(player)
    mods = player.modifiers.filter((m) => m.id.startsWith('bat-mach:'))
    expect(mods[0]!.percent).toBeCloseTo(0.03, 10)

    setProgress(player, [['nham_mach', 100]])
    meridianChapter.applyModifiers(player)
    mods = player.modifiers.filter((m) => m.id.startsWith('bat-mach:'))
    expect(mods[0]!.percent).toBeCloseTo(0.05, 10)
  })

  it('applyModifiers clears stale entries and stays idempotent', () => {
    const player = createLuyenKhiPlayer()
    setProgress(player, [['nham_mach', 100]])

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
})

describe('MeridianChapter - chapter contract', () => {
  it('descriptor: id/prefix/currency channels - thong_mach_dan la PILL', () => {
    expect(meridianChapter.id).toBe('meridian')
    expect(meridianChapter.modifierPrefix).toBe('bat-mach:')
    expect(meridianChapter.currency).toEqual({ bag: 'pill', id: 'thong_mach_dan' })
    expect(meridianChapter.auxCurrency).toBeUndefined()
  })

  it('invest does NOT rebuild modifiers (the system dispatch owns the rebuild)', () => {
    const player = createLuyenKhiPlayer()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    player.modifiers = []
    meridianChapter.invest(player, 1, 0)

    expect(player.bodyProgression.meridian.progress.nham_mach).toBeCloseTo(7.5, 10)
    expect(player.modifiers.filter(m => m.id.startsWith('bat-mach:'))).toHaveLength(0)
  })

  it('progress / isComplete count only 100% meridians', () => {
    const player = createLuyenKhiPlayer()

    expect(meridianChapter.progress(player)).toEqual({ completed: 0, total: 8 })
    expect(meridianChapter.isComplete(player)).toBe(false)

    // A partial meridian does not count as completed.
    setProgress(player, [['nham_mach', 99.9]])
    expect(meridianChapter.progress(player)).toEqual({ completed: 0, total: 8 })
    expect(meridianChapter.isComplete(player)).toBe(false)

    setProgress(player, MERIDIANS.map((m) => [m.id, 100]))

    expect(meridianChapter.progress(player)).toEqual({ completed: 8, total: 8 })
    expect(meridianChapter.isComplete(player)).toBe(true)
  })
})

describe('MeridianChapter - persisted state + integrity + migration', () => {
  it('validatePersistedState accepts progress map AND legacy openedIds, rejects malformed slices', () => {
    const issues: { path: string; message: string }[] = []
    const emit = (issue: { path: string; message: string }) => issues.push(issue)
    const base = 'player.bodyProgression.meridian'

    meridianChapter.validatePersistedState({ progress: { nham_mach: 37.4 } }, base, emit)
    meridianChapter.validatePersistedState({ progress: {} }, base, emit)
    // Legacy v87 save shape (opened -> 100) stays loadable.
    meridianChapter.validatePersistedState({ openedIds: ['nham_mach', 'doi_mach'] }, base, emit)
    expect(issues).toHaveLength(0)

    meridianChapter.validatePersistedState('nope', base, emit)
    meridianChapter.validatePersistedState({ openedIds: 'nope' }, base, emit)
    meridianChapter.validatePersistedState({ progress: { nham_mach: 'x' } }, base, emit)
    meridianChapter.validatePersistedState({ openedIds: ['nham_mach', 5] }, base, emit)

    const paths = issues.map(i => i.path)
    expect(paths).toContain(base)
    expect(paths).toContain(`${base}.progress`)
    expect(paths).toContain(`${base}.progress.nham_mach`)
    expect(paths).toContain(`${base}.openedIds[1]`)
  })

  it('readMeridianProgressSlice translates legacy openedIds to progress=100', () => {
    expect(
      readMeridianProgressSlice({ openedIds: ['nham_mach', 'doi_mach'] }),
    ).toEqual({ nham_mach: 100, doi_mach: 100 })
    expect(readMeridianProgressSlice({ progress: { nham_mach: 42.5 } })).toEqual({
      nham_mach: 42.5,
    })
    expect(readMeridianProgressSlice({})).toEqual({})
    expect(readMeridianProgressSlice('nope')).toEqual({})
  })

  it('integrityIssues pins the strict-prefix rule over canonical MERIDIANS order', () => {
    const player = createLuyenKhiPlayer()

    expect(meridianChapter.integrityIssues(player)).toHaveLength(0)

    setProgress(player, [['nham_mach', 100], ['doi_mach', 40.2]])
    expect(meridianChapter.integrityIssues(player)).toHaveLength(0)

    // Unknown id -> corrupt
    setProgress(player, [['nham_mach', 100], ['huyen_mach', 50]])
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // Non-prefix (nham_mach incomplete while doi holds progress) -> corrupt
    setProgress(player, [['nham_mach', 50], ['doi_mach', 100]])
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // Skipped first meridian -> corrupt
    setProgress(player, [['doi_mach', 100]])
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // Out-of-range values -> corrupt
    setProgress(player, [['nham_mach', 120]])
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    setProgress(player, [['nham_mach', -5]])
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // Non-record slice -> corrupt
    player.bodyProgression.meridian.progress = 42 as never
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)
  })

  it('integrityIssues accepts a legacy openedIds slice (pre-normalize payload)', () => {
    const player = createLuyenKhiPlayer()
    player.bodyProgression.meridian = { openedIds: ['nham_mach', 'doi_mach'] } as never
    expect(meridianChapter.integrityIssues(player)).toHaveLength(0)

    player.bodyProgression.meridian = { openedIds: ['doi_mach'] } as never
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)
  })

  // M-E (D2) cross-field invariant: strict-prefix passes but a
  // progressed meridian on a still-locked page is semantically
  // impossible (realm index never decreases, invest gate makes it
  // unreachable) - restore would otherwise emit bat-mach:* modifiers
  // on a locked page.
  it('integrityIssues flags a progressed meridian on a page locked at player realm', () => {
    const player = createLuyenKhiPlayer()

    // Mortal + a progressed qi_refining meridian: prefix-valid, page-invalid.
    player.realmId = 'mortal'
    setProgress(player, [['nham_mach', 37.4]])
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // Same payload at qi_refining -> legit.
    player.realmId = 'qi_refining'
    expect(meridianChapter.integrityIssues(player)).toHaveLength(0)

    // Foundation keeps the page unlocked - still legit.
    player.realmId = 'foundation_establishment'
    expect(meridianChapter.integrityIssues(player)).toHaveLength(0)
  })

  it('integrityIssues flags partial progress below requiredRealmLevel inside the page realm', () => {
    const player = createLuyenKhiPlayer()
    player.realmLevel = 3
    setProgress(player, [['nham_mach', 100], ['doi_mach', 10]])
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)
  })
})
