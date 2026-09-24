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

// [M-QI-01] - production caller exists: MeridianSection's next-row
// invest button routes through realmAdvanceOps.investBodyChapter. The
// chapter contract below stays the sole authority. Ported verbatim
// from the retired MeridianSystem.test.ts onto
// player.bodyProgression.meridian.openedIds.
describe('MeridianChapter - Bat Mach (spec dot-pha-loi-kiep sec.4.1a)', () => {
  it('data: 8 duong dung thu tu Nham -> Doc, cost tang dan, KHONG cham mana', () => {
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

  it('roi Luyen Khi (da vao Truc Co): van duoc tieu not dan do (pattern Luyen The)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.bodyProgression.meridian.openedIds = ['nham_mach']
    const consumed = meridianChapter.invest(player, 5, 0)
    expect(consumed).toBe(2) // Doi Mach cost 2
    expect(meridianChapter.progress(player).completed).toBe(2)
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
    player.bodyProgression.meridian.openedIds = []
    expect(meridianChapter.invest(player, 999, 99)).toBe(0)
    expect(player.bodyProgression.meridian.openedIds).toEqual([])

    // Same for a later meridian mid-sequence.
    player.bodyProgression.meridian.openedIds = ['nham_mach']
    expect(meridianChapter.invest(player, 999, 99)).toBe(0)
    expect(player.bodyProgression.meridian.openedIds).toEqual(['nham_mach'])
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

    expect(meridianChapter.progress(player)).toEqual({ completed: 0, total: 8 })
    expect(meridianChapter.isComplete(player)).toBe(false)

    player.bodyProgression.meridian.openedIds = MERIDIANS.map(m => m.id)

    expect(meridianChapter.progress(player)).toEqual({ completed: 8, total: 8 })
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

  // M-E (D2) cross-field invariant: strict-prefix passes but an opened
  // meridian on a still-locked page is semantically impossible (realm
  // index never decreases, invest gate makes it unreachable) - restore
  // would otherwise emit bat-mach:* modifiers on a locked page.
  it('integrityIssues flags an opened meridian on a page locked at player realm', () => {
    const player = createLuyenKhiPlayer()

    // Mortal + an opened qi_refining meridian: prefix-valid, page-invalid.
    player.realmId = 'mortal'
    player.bodyProgression.meridian.openedIds = ['nham_mach']
    expect(meridianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // Same payload at qi_refining -> legit.
    player.realmId = 'qi_refining'
    expect(meridianChapter.integrityIssues(player)).toHaveLength(0)

    // Foundation keeps the page unlocked - still legit.
    player.realmId = 'foundation_establishment'
    expect(meridianChapter.integrityIssues(player)).toHaveLength(0)
  })
})
