import { describe, expect, it } from 'vitest'

import { createDefaultPlayer } from '../../player/Player'
import {
  BODY_CHAPTERS,
  BODY_CHAPTER_BY_ID,
  createDefaultBodyProgression,
  getBodyChapterDefinition,
  validateBodyProgressionPersistedState,
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

  it('BODY_CHAPTER_BY_ID + getBodyChapterDefinition resolve every registered chapter', () => {
    for (const chapter of BODY_CHAPTERS) {
      expect(BODY_CHAPTER_BY_ID[chapter.id]).toBe(chapter)
      expect(getBodyChapterDefinition(chapter.id)).toBe(chapter)
    }
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
