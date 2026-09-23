import { describe, expect, it } from 'vitest'

import { createDefaultPlayer } from '../../player/Player'
import {
  BODY_CHAPTER_KINDS,
  BODY_CHAPTERS,
  BODY_CHAPTER_BY_ID,
  bodyChapterEssenceGrade,
  createDefaultBodyProgression,
  getBodyChapterDefinition,
  isBodyChapterKind,
  validateBodyChapterRegistry,
  validateBodyProgressionPersistedState,
  type BodyChapterDefinition,
} from './BodyChapter'

describe('BodyChapter - canonical zero state', () => {
  it('createDefaultBodyProgression returns the canonical zero-state record', () => {
    expect(createDefaultBodyProgression()).toEqual({
      body_refinement: { completedTiers: 0, currentTierProgress: 0 },
      meridian: { openedIds: [] },
      zhou_tian: { circulation: 0 },
    })
  })

  it('returns a fresh record per call (no shared slice references)', () => {
    const a = createDefaultBodyProgression()
    const b = createDefaultBodyProgression()
    expect(a.body_refinement).not.toBe(b.body_refinement)
    expect(a.meridian.openedIds).not.toBe(b.meridian.openedIds)
    expect(a.zhou_tian).not.toBe(b.zhou_tian)
  })

  it('createDefaultPlayer seeds bodyProgression with all zero-state slices', () => {
    const player = createDefaultPlayer()
    expect(player.bodyProgression).toEqual({
      body_refinement: { completedTiers: 0, currentTierProgress: 0 },
      meridian: { openedIds: [] },
      zhou_tian: { circulation: 0 },
    })
  })
})

describe('BodyChapter - registry', () => {
  it('BODY_CHAPTERS holds exactly the three canonical chapters in sequential order', () => {
    // Canonical order IS the sequential chain (M-F-CHU-THIEN): each
    // chapter may only name prerequisites listed before it.
    expect(BODY_CHAPTERS.map(c => c.id)).toEqual(['body_refinement', 'meridian', 'zhou_tian'])
  })

  it('chapter kinds: body_refinement + zhou_tian are baseStat (D1), meridian is modifier', () => {
    expect(BODY_CHAPTER_BY_ID.body_refinement.kind).toBe('baseStat')
    expect(BODY_CHAPTER_BY_ID.meridian.kind).toBe('modifier')
    expect(BODY_CHAPTER_BY_ID.zhou_tian.kind).toBe('baseStat')
  })

  it('BODY_CHAPTER_BY_ID + getBodyChapterDefinition resolve every registered chapter', () => {
    for (const chapter of BODY_CHAPTERS) {
      expect(BODY_CHAPTER_BY_ID[chapter.id]).toBe(chapter)
      expect(getBodyChapterDefinition(chapter.id)).toBe(chapter)
    }
  })
})

// M-F-BODY-CORE - chapterKind is the authored classification
// (refinement | meridian | zhou_tian), orthogonal to the emission `kind`
// discriminant. 'zhou_tian' exists in the vocabulary before any chapter
// uses it - the seam is declared, not implemented.
describe('BodyChapter - chapter kind (M-F-BODY-CORE)', () => {
  it('the kind vocabulary is exactly refinement | meridian | zhou_tian', () => {
    expect([...BODY_CHAPTER_KINDS]).toEqual(['refinement', 'meridian', 'zhou_tian'])
    for (const kind of BODY_CHAPTER_KINDS) {
      expect(isBodyChapterKind(kind)).toBe(true)
    }
    expect(isBodyChapterKind('modifier')).toBe(false)
    expect(isBodyChapterKind('baseStat')).toBe(false)
    expect(isBodyChapterKind('')).toBe(false)
    expect(isBodyChapterKind(7)).toBe(false)
    expect(isBodyChapterKind(undefined)).toBe(false)
  })

  it('each authored chapter declares its game-design kind (EXPECTED pin)', () => {
    expect(BODY_CHAPTER_BY_ID.body_refinement.chapterKind).toBe('refinement')
    expect(BODY_CHAPTER_BY_ID.meridian.chapterKind).toBe('meridian')
    expect(BODY_CHAPTER_BY_ID.zhou_tian.chapterKind).toBe('zhou_tian')
  })

  it('the authored sequential chain is declared on the chapters themselves (M-F-CHU-THIEN)', () => {
    expect(BODY_CHAPTER_BY_ID.body_refinement.unlocksAfterChapters).toBeUndefined()
    expect(BODY_CHAPTER_BY_ID.meridian.unlocksAfterChapters).toEqual(['body_refinement'])
    expect(BODY_CHAPTER_BY_ID.zhou_tian.unlocksAfterChapters).toEqual(['meridian'])
  })
})

// Registry validation: the catalog is authored data - malformed
// structure surfaces as issues here (and assertBodyChapterRegistry
// throws on the real registry at module load). Synthetic catalogs are
// passed directly; the closed BODY_CHAPTER_BY_ID is never injected.
describe('BodyChapter - validateBodyChapterRegistry (M-F-BODY-CORE)', () => {
  const refinement = BODY_CHAPTER_BY_ID.body_refinement
  const meridian = BODY_CHAPTER_BY_ID.meridian

  function fakeMeridianChapter(overrides: Partial<BodyChapterDefinition>): BodyChapterDefinition {
    return { ...meridian, ...overrides } as BodyChapterDefinition
  }

  it('the real registry validates clean', () => {
    expect(validateBodyChapterRegistry(BODY_CHAPTERS)).toEqual([])
  })

  it('rejects a duplicate chapter id', () => {
    const issues = validateBodyChapterRegistry([refinement, refinement])
    expect(issues.some(i => i.message.includes('duplicate chapter id'))).toBe(true)
  })

  it('rejects a chapterKind outside the vocabulary', () => {
    const fake = fakeMeridianChapter({ chapterKind: 'tum' as never })
    const issues = validateBodyChapterRegistry([refinement, fake])
    expect(issues.some(i => i.path === 'bodyChapters.meridian.chapterKind')).toBe(true)
  })

  it('accepts a zhou_tian chapterKind declaration before the chapter exists', () => {
    // The kind rung is declared ahead of M-F-CHU-THIEN's chapter; a
    // future def tagged 'zhou_tian' passes kind validation (its state
    // slice would be authored with the chapter, so the slice issues it
    // reports here are expected noise, not a kind rejection).
    const fake = fakeMeridianChapter({ id: 'zhou_tian' as never, chapterKind: 'zhou_tian' })
    const issues = validateBodyChapterRegistry([refinement, fake])
    expect(issues.some(i => i.path === 'bodyChapters.zhou_tian.chapterKind')).toBe(false)
  })

  it('classifies a synthetic zhou_tian phap-material currency as essence (M-F-ESSENCE)', () => {
    // The TC chapter's declared cost shape: a material-bag phap
    // descriptor classifies at the namespace gate on bag+id alone -
    // chapter id and chapterKind never enter it - and the same def
    // draws no chapterKind issue from the registry validator.
    const fake = fakeMeridianChapter({
      id: 'zhou_tian' as never,
      chapterKind: 'zhou_tian',
      currency: { bag: 'material', id: 'tinh_hoa_phap_the' },
    })
    expect(bodyChapterEssenceGrade(fake.currency)).toBe('phap')
    const issues = validateBodyChapterRegistry([refinement, fake])
    expect(issues.some(i => i.path === 'bodyChapters.zhou_tian.chapterKind')).toBe(false)
  })

  it('rejects a mis-classified authored chapter (expected-kind pin)', () => {
    // A chapter claiming an authored id must carry that chapter's
    // expected kind - a wrong-but-valid chapterKind fails authoring
    // validation, not just the vocabulary check.
    const mistagged = fakeMeridianChapter({ chapterKind: 'refinement' })
    const issues = validateBodyChapterRegistry([refinement, mistagged])
    expect(
      issues.some(
        i => i.path === 'bodyChapters.meridian.chapterKind' && i.message.includes("must be kind 'meridian'"),
      ),
    ).toBe(true)

    const mistaggedRef = { ...refinement, chapterKind: 'meridian' } as BodyChapterDefinition
    expect(
      validateBodyChapterRegistry([mistaggedRef, meridian]).some(
        i => i.path === 'bodyChapters.body_refinement.chapterKind' && i.message.includes("must be kind 'refinement'"),
      ),
    ).toBe(true)
  })

  it('rejects an emission kind outside the discriminant union', () => {
    const fake = fakeMeridianChapter({ kind: 'sparkle' as never })
    const issues = validateBodyChapterRegistry([refinement, fake])
    expect(issues.some(i => i.path === 'bodyChapters.meridian.kind')).toBe(true)
  })

  it('rejects a modifier chapter missing applyModifiers', () => {
    const fake = fakeMeridianChapter({ applyModifiers: undefined as never })
    const issues = validateBodyChapterRegistry([refinement, fake])
    expect(issues.some(i => i.path === 'bodyChapters.meridian.applyModifiers')).toBe(true)
  })

  it('rejects a baseStat chapter missing either half of its channel', () => {
    const noCollect = { ...refinement, collectBaseStatDeltas: undefined as never }
    const noScrub = { ...refinement, scrubLegacyModifiers: undefined as never }

    expect(
      validateBodyChapterRegistry([noCollect, meridian]).some(
        i => i.path === 'bodyChapters.body_refinement.collectBaseStatDeltas',
      ),
    ).toBe(true)
    expect(
      validateBodyChapterRegistry([noScrub, meridian]).some(
        i => i.path === 'bodyChapters.body_refinement.scrubLegacyModifiers',
      ),
    ).toBe(true)
  })

  it('rejects a chapter with no persisted-state slice and an orphan slice', () => {
    const fake = fakeMeridianChapter({ id: 'other_chapter' as never, chapterKind: 'zhou_tian' })
    const issues = validateBodyChapterRegistry([refinement, fake])

    expect(issues.some(i => i.path === 'bodyProgression.other_chapter')).toBe(true)
    expect(issues.some(i => i.path === 'bodyProgression.meridian')).toBe(true)
    expect(issues.some(i => i.path === 'bodyProgression.zhou_tian')).toBe(true)
  })

  it('validates unlocksAfterChapters as backward-only refs (M-F-CHU-THIEN)', () => {
    const refinementDef = BODY_CHAPTER_BY_ID.body_refinement
    const meridianDef = BODY_CHAPTER_BY_ID.meridian
    const zhouTianDef = BODY_CHAPTER_BY_ID.zhou_tian

    // The real chain passes: meridian -> body_refinement, zhou_tian -> meridian.
    expect(
      validateBodyChapterRegistry([refinementDef, meridianDef, zhouTianDef])
        .filter(i => i.path.endsWith('.unlocksAfterChapters')),
    ).toEqual([])

    // Unknown prerequisite id.
    const unknownRef = fakeMeridianChapter({
      id: 'other_chapter' as never,
      unlocksAfterChapters: ['not_a_chapter'] as never,
    })
    expect(
      validateBodyChapterRegistry([refinementDef, meridianDef, unknownRef]).some(
        i => i.path === 'bodyChapters.other_chapter.unlocksAfterChapters'
          && i.message.includes("unknown prerequisite chapter 'not_a_chapter'"),
      ),
    ).toBe(true)

    // Forward reference (zhou_tian listed AFTER the dependent chapter).
    const forwardRef = fakeMeridianChapter({
      id: 'meridian' as never,
      unlocksAfterChapters: ['zhou_tian'],
    })
    expect(
      validateBodyChapterRegistry([refinementDef, forwardRef, zhouTianDef]).some(
        i => i.path === 'bodyChapters.meridian.unlocksAfterChapters'
          && i.message.includes("must precede 'meridian'"),
      ),
    ).toBe(true)

    // Self reference.
    const selfRef = fakeMeridianChapter({
      id: 'meridian' as never,
      unlocksAfterChapters: ['meridian'],
    })
    expect(
      validateBodyChapterRegistry([refinementDef, selfRef, zhouTianDef]).some(
        i => i.path === 'bodyChapters.meridian.unlocksAfterChapters'
          && i.message.includes("must precede 'meridian'"),
      ),
    ).toBe(true)
  })

  it('rejects an advancement owned by two chapters / spanning skips / gapped chain', () => {
    const dupFrom = fakeMeridianChapter({ physiqueAdvancement: { from: 'pham', to: 'bao' } })
    expect(
      validateBodyChapterRegistry([refinement, dupFrom]).some(
        i => i.message.includes('already owned'),
      ),
    ).toBe(true)

    const skipping = {
      ...refinement,
      physiqueAdvancement: { from: 'pham', to: 'phap' },
    } as BodyChapterDefinition
    expect(
      validateBodyChapterRegistry([skipping, meridian]).some(
        i => i.message.includes('exactly one ladder rung'),
      ),
    ).toBe(true)

    const gapped = {
      ...refinement,
      physiqueAdvancement: { from: 'bao', to: 'phap' },
    } as BodyChapterDefinition
    expect(
      validateBodyChapterRegistry([gapped, meridian]).some(
        i => i.message.includes('contiguous prefix'),
      ),
    ).toBe(true)
  })
})

describe('BodyChapter - validateBodyProgressionPersistedState', () => {
  function collectIssues(player: unknown): { path: string; message: string }[] {
    const issues: { path: string; message: string }[] = []
    validateBodyProgressionPersistedState(player, issue => issues.push(issue))
    return issues
  }

  it('accepts the canonical zero-state player', () => {
    expect(collectIssues(createDefaultPlayer())).toHaveLength(0)
  })

  it('missing / non-object bodyProgression emits an issue at player.bodyProgression', () => {
    expect(collectIssues({}).map(i => i.path)).toContain('player.bodyProgression')
    expect(collectIssues({ bodyProgression: 7 }).map(i => i.path)).toContain('player.bodyProgression')
  })

  it('dispatches to each chapter slice validator with chapter-keyed paths', () => {
    const player = createDefaultPlayer()
    const payload = JSON.parse(JSON.stringify(player)) as Record<string, unknown>
    const record = payload.bodyProgression as Record<string, unknown>
    record.body_refinement = { completedTiers: 'x', currentTierProgress: 0 }
    record.meridian = { openedIds: [1] }

    const paths = collectIssues(payload).map(i => i.path)
    expect(paths).toContain('player.bodyProgression.body_refinement.completedTiers')
    expect(paths).toContain('player.bodyProgression.meridian.openedIds[0]')
  })
})
