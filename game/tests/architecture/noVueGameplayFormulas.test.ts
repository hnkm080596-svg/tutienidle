// Architecture guard (Phase 3 Slice 3.4 - V4 d, e, f, g, D6):
// Vue surfaces must consume domain/data owners rather than embedding
// gameplay formulas, string-parsing stat totals, duplicating brew-gate
// rules, mutating player store fields directly, or hardcoding constellation
// coordinate tables.

import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isTestFile, SCAN_TIMEOUT, srcCorpus } from './helpers/scanTs'

const SRC_DIR = join(process.cwd(), 'src')
const CORPUS = srcCorpus(SRC_DIR)

function fileText(fromSrc: string): string {
  const entry = CORPUS.find((file) => file.fromSrc === fromSrc)
  if (!entry) {
    throw new Error(`Expected ${fromSrc} in src corpus`)
  }
  return entry.text
}

describe('No Vue Gameplay Formulas & Read-Model Bypass (Slice 3.4)', () => {
  it(
    'CharacterSurface.vue delegates combat power calculation to @/core/player/CombatPower (V4d, D6)',
    () => {
      const text = fileText('components/scenes/character/CharacterSurface.vue')
      expect(text).toContain("from '@/core/player/CombatPower'")
      expect(text).toContain('computeCombatPower(')
      expect(text).toContain('computeCombatPowerTermContribution(')
      expect(text).not.toMatch(/\bconst\s+POWER_TERMS\b/)
    },
    SCAN_TIMEOUT,
  )

  it(
    'BodySurface.vue reads chapter totalRows from useBodySceneModel without regex-parsing display strings or importing bodyRefinementChapter (V4e)',
    () => {
      const surfaceText = fileText('components/scenes/body/BodySurface.vue')
      expect(surfaceText).not.toContain('bodyRefinementChapter')
      expect(surfaceText).not.toContain('collectBaseStatDeltas')
      expect(surfaceText).not.toMatch(/exec\(row\.value\)/)
      expect(surfaceText).toContain('activeModel.value.totalRows')

      const modelText = fileText('components/scenes/body/useBodySceneModel.ts')
      expect(modelText).toContain('collectBodyChapterBaseStatDeltas')
      expect(modelText).not.toMatch(/exec\(row\.value\)/)
    },
    SCAN_TIMEOUT,
  )

  it(
    'AlchemySurface.vue delegates brew eligibility and job progress math to GameManagerAlchemyOps.quoteAlchemyBrew and computeAlchemyJobProgress (V4f)',
    () => {
      const text = fileText('components/scenes/alchemy/AlchemySurface.vue')
      expect(text).toContain('quoteAlchemyBrew(')
      expect(text).toContain('computeAlchemyJobProgress(')
      expect(text).not.toContain('ALCHEMY_MAX_BATCH_QUANTITY')
      expect(text).not.toMatch(/\bconst\s+tailMergeable\b/)
    },
    SCAN_TIMEOUT,
  )

  it(
    'no Vue component directly mutates player.hasSeenTutorial; TutorialOverlay calls player.markTutorialSeen() (V4g)',
    () => {
      const offenders = CORPUS.filter(
        (file) =>
          !isTestFile(file.fromSrc) &&
          file.fromSrc.startsWith('components/') &&
          /\bhasSeenTutorial\s*=/.test(file.text),
      ).map((file) => file.fromSrc)

      expect(offenders).toEqual([])
      const tutorialText = fileText('components/common/TutorialOverlay.vue')
      expect(tutorialText).toContain('player.markTutorialSeen()')
    },
    SCAN_TIMEOUT,
  )

  it(
    'SkillSurface.vue delegates constellation paper layout and fire coordinate tables to @/data/skill/SkillConstellationLayouts',
    () => {
      const text = fileText('components/scenes/skill/SkillSurface.vue')
      expect(text).toContain("from '@/data/skill/SkillConstellationLayouts'")
      expect(text).toContain('computeSkillPaperLayout(')
      expect(text).toContain('computeSkillPaperEdges(')
      expect(text).not.toMatch(/\bconst\s+FIRE_DESIGN_POS\b/)
      expect(text).not.toMatch(/\bconst\s+FIRE_DESIGN_EDGES\b/)
    },
    SCAN_TIMEOUT,
  )
})
