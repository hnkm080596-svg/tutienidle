import { describe, expect, it } from 'vitest'

import { createDefaultPlayer } from '../../player/Player'
import {
  BODY_CHAPTER_KINDS,
  BODY_CHAPTERS,
  BODY_CHAPTER_BY_ID,
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
    })
  })

  it('returns a fresh record per call (no shared slice references)', () => {
    const a = createDefaultBodyProgression()
    const b = createDefaultBodyProgression()
    expect(a.body_refinement).not.toBe(b.body_refinement)
    expect(a.meridian.openedIds).not.toBe(b.meridian.openedIds)
  })

  it('createDefaultPlayer seeds bodyProgression with both zero-state slices', () => {
    const player = createDefaultPlayer()
    expect(player.bodyProgression).toEqual({
      body_refinement: { completedTiers: 0, currentTierProgress: 0 },
      meridian: { openedIds: [] },
    })
  })
})

describe('BodyChapter - registry', () => {
  it('BODY_CHAPTERS holds exactly the two canonical chapters in order', () => {
    expect(BODY_CHAPTERS.map(c => c.id)).toEqual(['body_refinement', 'meridian'])
  })

  it('chapter kinds: body_refinement is baseStat (D1), meridian is modifier', () => {
    expect(BODY_CHAPTER_BY_ID.body_refinement.kind).toBe('baseStat')
    expect(BODY_CHAPTER_BY_ID.meridian.kind).toBe('modifier')
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

  it('each authored chapter declares its game-design kind', () => {
    expect(BODY_CHAPTER_BY_ID.body_refinement.chapterKind).toBe('refinement')
    expect(BODY_CHAPTER_BY_ID.meridian.chapterKind).toBe('meridian')
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
    const fake = fakeMeridianChapter({ chapterKind: 'zhou_tian' })
    const issues = validateBodyChapterRegistry([refinement, fake])
    expect(issues.some(i => i.path === 'bodyChapters.meridian.chapterKind')).toBe(false)
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
    const fake = fakeMeridianChapter({ id: 'zhou_tian' as never, chapterKind: 'zhou_tian' })
    const issues = validateBodyChapterRegistry([refinement, fake])

    expect(issues.some(i => i.path === 'bodyProgression.zhou_tian')).toBe(true)
    expect(issues.some(i => i.path === 'bodyProgression.meridian')).toBe(true)
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
