// TEMP debug probe: find where same-seed sessions diverge.
import { describe, expect, it } from 'vitest'
import { EarlyGameSession } from './EarlyGameSession'
import { getRequiredCultivation } from '../../realm/realmSystem'

const PINNED = {
  name: 'probe',
  talentIds: ['hap_linh'],
  mortalBasicSkillId: 'tram',
}

function run(seed: number) {
  const s = new EarlyGameSession({ seed, profile: PINNED })
  const marks: unknown[] = []
  const mark = (label: string) =>
    marks.push({ label, insight: s.player.skillInsight, acc: s.player.cultivationInsightAccumulator, cult: s.player.cultivation, lvl: s.player.realmLevel })

  mark('boot')
  marks.push({ label: 'dong_1_a', outcome: s.runStage('mortal_dong_1'), insight: s.player.skillInsight })
  const req = getRequiredCultivation(s.player.realmId, s.player.realmLevel)
  s.cultivate(req / s.player.cultivationPerSecond + 1)
  s.breakthroughIfReady()
  mark('grind1')
  marks.push({ label: 'dong_1_b', outcome: s.runStage('mortal_dong_1'), insight: s.player.skillInsight })
  while (s.player.realmLevel < 12) {
    const r = getRequiredCultivation(s.player.realmId, s.player.realmLevel)
    s.cultivate(r / s.player.cultivationPerSecond + 1)
    s.breakthroughIfReady()
  }
  mark('lvl12')
  marks.push({ label: 'trib', outcome: s.runTribulation('qi_refining'), insight: s.player.skillInsight })
  s.performRitual('sword', 'sword_pathway')
  mark('post_ritual')
  return marks
}

describe('rng leak probe', () => {
  it('same seed diverges - find the step', () => {
    const a = run(7)
    const b = run(7)
    console.log('A', JSON.stringify(a))
    console.log('B', JSON.stringify(b))
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      expect(b[i]).toEqual(a[i])
    }
  })
})
