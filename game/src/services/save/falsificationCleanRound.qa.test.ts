// QA FIXPOINT probe (clean-round falsification, run qa-fixpoint-master) -
// save-shape bounds that replay writer semantics against forged claims:
//
// F-CULT-OVERCAP (High): player.cultivation was bounded only at
// non-negative - a save could bank an arbitrary magnitude into the next
// breakthrough for free. addCultivation is the sole writer and clamps
// every gain at the current tier's getRequiredCultivation - overflow
// banks to cultivationOvercharge (Hai Nap) or waits at the cap for the
// breakthrough ritual - so a persisted value above required is an
// impossible writer output. The bound rejects the claim (realmLevel /
// attributePoints sibling precedent), never clamps it.
//
// F-QUEST-DUP (Medium): quests.active carried no dedup - the sole
// writer (QuestManager.ensureActive) dedupes via getProgress
// first-match, so a duplicated active questId is unproducible. The dup
// would shadow progress/claim state at restore (same class as QA-FS-4
// skills, F-TALENT-DUP talents and equipment instanceId).
import { describe, expect, it } from 'vitest'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { createDefaultPlayer } from '../../core/player/Player'
import { getRequiredCultivation } from '../../core/realm/realmSystem'

function validSave(): Record<string, unknown> {
  return {
    version: CURRENT_SAVE_VERSION,
    player: createDefaultPlayer(),
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

function pathsOf(result: ReturnType<typeof validateGameSaveShape>): string[] {
  return result.issues.map((issue) => issue.path)
}

describe('F-CULT-OVERCAP: player.cultivation is writer-bounded by the current tier requirement', () => {
  it('cultivation above getRequiredCultivation(realmId, realmLevel) is rejected', () => {
    const save = validSave()
    const player = save.player as { cultivation: number }
    player.cultivation = getRequiredCultivation('mortal', 1) + 1

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.cultivation')
  })

  it('cultivation exactly at required validates (cap while awaiting the breakthrough ritual)', () => {
    const save = validSave()
    const player = save.player as { cultivation: number }
    player.cultivation = getRequiredCultivation('mortal', 1)

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('cultivation below required validates', () => {
    const save = validSave()
    const player = save.player as { cultivation: number }
    player.cultivation = 1

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('F-QUEST-DUP: quests.active dedupes by questId like the writer does', () => {
  it('a duplicated active questId is rejected', () => {
    const save = validSave()
    ;(save as Record<string, unknown>).quests = {
      active: [
        { questId: 'quest_a', progress: 0, claimed: false },
        { questId: 'quest_a', progress: 3, claimed: false },
      ],
      completedOnceIds: [],
      lastDailyResetAtMs: 0,
    }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.quests.active[1].questId')
  })

  it('distinct active questIds validate', () => {
    const save = validSave()
    ;(save as Record<string, unknown>).quests = {
      active: [
        { questId: 'quest_a', progress: 0, claimed: false },
        { questId: 'quest_b', progress: 3, claimed: false },
      ],
      completedOnceIds: [],
      lastDailyResetAtMs: 0,
    }

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})
