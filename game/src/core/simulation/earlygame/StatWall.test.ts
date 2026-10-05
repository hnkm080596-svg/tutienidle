// Stat-wall ladder pin (Minh directive 2026-10-05): each beta chapter's
// floors carry a per-floor statScale that is applied at spawn. This file
// locks the two invariants the ladder exists for:
//   1. the scale is actually stamped onto spawned enemies (normals and
//      the floor-10 boss - and the shared registry template stays
//      unscaled), and
//   2. a bare-stats player (base + attributes, zero equipment) cannot
//      free-clear past the tutorial handoff - the first floor IS the
//      first wall. If a retune ever lets a naked climber through, this
//      test must go red before the change ships.
import { describe, expect, it, beforeAll } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { EarlyGameSession } from '@/core/simulation/earlygame/EarlyGameSession'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { STAGES } from '@/data/stage/Stages'
import { ENEMIES } from '@/data/enemy/Enemies'
import { HIDDEN_BEASTS } from '@/data/enemy/HiddenBeasts'
import { hiddenBeastChannels } from '@/data/drop/HiddenMaterialChannels'
import { StageWaveSystem } from '@/core/game/StageWaveSystem'
import { HiddenBeastSystem } from '@/core/game/HiddenBeastSystem'
import { StageSystem } from '@/core/stage/StageSystem'
import { StageManager } from '@/core/stage/StageManager'
import { EnemySystem } from '@/core/enemy/EnemySystem'
import { EnemyManager } from '@/core/enemy/EnemyManager'
import { EventBus } from '@/core/events/EventBus'
import { TemplateRegistry } from '@/core/game/TemplateRegistry'
import type { Enemy } from '@/core/enemy/Enemy'
import type { Stage } from '@/core/stage/Stage'

lockBetaWaysForTests()
lockBetaFeaturesForTests()

/** Standalone spawn system over the shipped data (same wiring the
 * BetaStageRoster funnel probes use) - enough to exercise
 * pickEnemyForTurnSpawn without booting a GameManager. */
function stageWavesFor(stages: Stage[]): StageWaveSystem {
  const enemyTemplates = new TemplateRegistry<Enemy>()
  for (const enemy of [...ENEMIES, ...HIDDEN_BEASTS]) {
    enemyTemplates.register(enemy.id, enemy)
  }
  const stageTemplates = new TemplateRegistry<Stage>()
  for (const stage of stages) {
    stageTemplates.register(stage.id, stage)
  }
  return new StageWaveSystem({
    eventBus: new EventBus(),
    enemySystem: new EnemySystem(new EnemyManager()),
    stageManager: new StageManager(),
    stageSystem: new StageSystem(),
    stageTemplates,
    enemyTemplates,
    isStageUnlocked: () => true,
    launchBattle: () => {},
    hiddenBeast: new HiddenBeastSystem({
      getEnemyTemplate: (id) => enemyTemplates.get(id),
      channels: hiddenBeastChannels(),
    }),
    sessionRng: () => 0,
  })
}

const PINNED_PROFILE = {
  name: 'stat-wall probe',
  talentIds: ['hap_linh'],
  mortalBasicSkillId: 'tram',
}

function grindToLevel(s: EarlyGameSession, level: number): void {
  for (let k = 0; k < 40 && s.player.realmLevel < level; k++) {
    s.cultivate(120)
    s.breakthroughIfReady()
  }
}

/** Spend every earned attribute point (2:1 strength:vitality). */
function spendAllAttributes(s: EarlyGameSession): void {
  let i = 0
  while (s.player.attributePoints > 0 && i < 200) {
    i++
    s.allocateAttribute(i % 3 === 0 ? 'vitality' : 'strength')
  }
}

describe('stat-wall ladder - spawn stamping', () => {
  beforeAll(() => {
    setActivePinia(createPinia())
  })

  it('floors stamp statScale onto normals and the boss; templates stay unscaled', () => {
    const waves = stageWavesFor(STAGES)

    // mortal_dong_3 carries scale 1.3: 60 hp / 6 might -> 78 / 7.8.
    // rng 0.99 dodges the elite roll so the NORMAL specimen is picked.
    const dong3 = STAGES.find((stage) => stage.id === 'mortal_dong_3')!
    expect(dong3.statScale).toBe(1.3)
    const normal = waves.pickEnemyForTurnSpawn(dong3, false, { rng: () => 0.99 })
    expect(normal?.stats.maxHp).toBeCloseTo(60 * 1.3, 5)
    expect(normal?.stats.might).toBeCloseTo(6 * 1.3, 5)

    // mortal_dong_10 carries scale 3.6: the boss variant multiplies on
    // top - 390*3.6*7 hp and 30*3.6*2 might.
    const dong10 = STAGES.find((stage) => stage.id === 'mortal_dong_10')!
    expect(dong10.statScale).toBe(3.6)
    const boss = waves.pickEnemyForTurnSpawn(dong10, true, { rng: () => 0.99 })
    expect(boss?.id).toBe('mortal_ferocious_wild_boar')
    expect(boss?.stats.maxHp).toBeCloseTo(390 * 3.6 * 7, 5)
    expect(boss?.stats.might).toBeCloseTo(30 * 3.6 * 2, 5)

    // The shared registry template must never inherit a floor's scale.
    const template = ENEMIES.find((enemy) => enemy.id === 'mortal_wild_boar')!
    expect(template.stats.maxHp).toBe(60)
    expect(template.stats.might).toBe(6)
  })
})

describe('stat-wall ladder - bare-stats climber cannot free-clear', () => {
  beforeAll(() => {
    setActivePinia(createPinia())
  })

  it('a bare mortal loses mortal_dong_3 repeatedly (first floor past tutorial)', () => {
    const s = new EarlyGameSession({ seed: 20261005, profile: PINNED_PROFILE })
    s.combatCultivationParity = true
    grindToLevel(s, 3)
    spendAllAttributes(s)
    // Dong 1-2 stay the gentle onboarding handoff (scale 1.0); unlock the
    // probe straight onto the first scaled floor.
    s.player.completedStageIds = ['mortal_dong_1', 'mortal_dong_2']

    // Three attempts, all defeats - a single lucky outcome cannot fake
    // a free-clear. If the floor-3 wall ever erodes, this goes red.
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = s.runStage('mortal_dong_3')
      expect(result).toBe('defeat')
    }
  })

  it('a bare qi entrant loses qi_refining_forest (chapter entry wall)', () => {
    const s = new EarlyGameSession({ seed: 20261005, profile: PINNED_PROFILE })
    s.combatCultivationParity = true
    grindToLevel(s, 12)
    spendAllAttributes(s)
    expect(s.performRitual('spell', 'spell_pathway', 'fire')).toBe(true)
    s.player.completedStageIds = Array.from({ length: 10 }, (_, i) => `mortal_dong_${i + 1}`)

    const result = s.runStage('qi_refining_forest')
    expect(result).toBe('defeat')
  })
})
