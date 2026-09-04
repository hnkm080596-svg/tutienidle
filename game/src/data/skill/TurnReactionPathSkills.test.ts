import { describe, expect, it } from 'vitest'
import {
  REACTION_PATH_POOL,
  REACTION_PATH_SPECIAL_ID,
  PHAP_TU_REACTION_SPECIAL,
  PHAP_TU_REACTION_ULTIMATE,
  REACTION_EMPOWERMENT_BUFF,
} from './TurnReactionPathSkills'

// Future Systems Task 4 — structural checks cho Reaction Path content.

describe('TurnReactionPathSkills', () => {
  it('pool có đủ 5 element, mỗi entry damage elemental 1 component', () => {
    expect(REACTION_PATH_POOL).toHaveLength(5)

    const elements = new Set(
      REACTION_PATH_POOL.flatMap((skill) => {
        if (skill.damage.kind !== 'elemental') {
          return []
        }

        return skill.damage.components.flatMap((component) =>
          component.kind === 'element' ? [component.element] : [],
        )
      }),
    )

    expect(elements.size).toBe(5)
  })

  it('marker special có id chuẩn Task 5 chặn + cooldown/resource gate', () => {
    expect(PHAP_TU_REACTION_SPECIAL.id).toBe(REACTION_PATH_SPECIAL_ID)
    expect(PHAP_TU_REACTION_SPECIAL.cooldownTurns).toBeGreaterThan(0)
    expect(PHAP_TU_REACTION_SPECIAL.resourceCost).toBeGreaterThan(0)
  })

  it('ultimate áp buff self reaction_empowerment', () => {
    expect(PHAP_TU_REACTION_ULTIMATE.appliesBuff).toEqual({
      definitionId: 'reaction_empowerment',
      target: 'self',
    })
  })

  it('buff Cộng Minh: statModifier reactionEffectPercent, polarity buff', () => {
    expect(REACTION_EMPOWERMENT_BUFF.polarity).toBe('buff')
    expect(REACTION_EMPOWERMENT_BUFF.effects[0]).toMatchObject({
      type: 'statModifier',
      stat: 'reactionEffectPercent',
    })
  })
})
