// BETA SCOPE LOCK v2 census + adversarial pool probing. The shipped
// STAGES data is the allow-list: exactly 3 chapters x 10 floors, each
// chapter on the final 12-identity roster (3 band normals + 1 boss),
// and no spawn path can surface a dormant/hidden identity on a beta
// stage.
import { describe, expect, it } from 'vitest'

import { STAGES } from './Stages'
import { ENEMIES } from '../enemy/Enemies'
import { HIDDEN_BEASTS } from '../enemy/HiddenBeasts'
import { hiddenBeastChannels } from '../drop/HiddenMaterialChannels'
import { stageSpawnableEnemyIds } from '../../core/stage/StageSpawnableEnemies'
import { StageWaveSystem } from '../../core/game/StageWaveSystem'
import { HiddenBeastSystem } from '../../core/game/HiddenBeastSystem'
import { StageSystem } from '../../core/stage/StageSystem'
import { StageManager } from '../../core/stage/StageManager'
import type { Stage } from '../../core/stage/Stage'
import { EnemySystem } from '../../core/enemy/EnemySystem'
import { EnemyManager } from '../../core/enemy/EnemyManager'
import { EventBus } from '../../core/events/EventBus'
import { TemplateRegistry } from '../../core/game/TemplateRegistry'
import { createDefaultPlayer } from '../../core/player/Player'
import type { Enemy } from '../../core/enemy/Enemy'

/** The final 12-identity beta roster (work-order section 8). */
const BETA_ROSTER = {
  1: {
    normals: ['mortal_wild_boar', 'mortal_savage_tiger', 'mortal_water_wolf'],
    boss: 'mortal_ferocious_giant_crocodile',
  },
  2: {
    normals: ['wild_wolf', 'flame_fox', 'giant_earthworm'],
    boss: 'ferocious_flood_serpent',
  },
  3: {
    normals: ['foundation_lava_hound', 'foundation_sand_scorpion', 'foundation_mud_golem'],
    boss: 'foundation_ferocious_flood_dragon_whelp',
  },
} as const

const ALL_ROSTER_IDS = Object.values(BETA_ROSTER).flatMap((chapter) => [
  ...chapter.normals,
  chapter.boss,
])

describe('beta stage roster census (BETA SCOPE LOCK v2)', () => {
  it('exactly 3 chapters, 10 floors each', () => {
    for (const chapter of [1, 2, 3] as const) {
      const stages = STAGES.filter((stage) => stage.chapter === chapter)
      expect(stages).toHaveLength(10)
      expect(stages.map((stage) => stage.floor)).toEqual(
        Array.from({ length: 10 }, (_, index) => index + 1),
      )
    }
    expect(STAGES).toHaveLength(30)
  })

  it.each([1, 2, 3] as const)(
    'chapter %i: 3 distinct band normals on 1-3/4-6/7-9 + roster boss on 10',
    (chapter) => {
      const roster = BETA_ROSTER[chapter]
      const stages = STAGES.filter((stage) => stage.chapter === chapter)

      for (const stage of stages) {
        expect(stage.enemyPool).toHaveLength(1)
        const species = stage.enemyPool[0]!.enemyId

        if (stage.floor === 10) {
          expect(species).toBe(roster.boss)
          expect(stage.bossEnemyId).toBe(roster.boss)
        } else {
          const band = Math.min(2, Math.floor((stage.floor! - 1) / 3))
          expect(species).toBe(roster.normals[band])
          expect(stage.bossEnemyId).toBeUndefined()
        }
      }
    },
  )

  it('exactly 12 distinct identities spawn across all beta stages', () => {
    const spawnable = new Set<string>()
    for (const stage of STAGES) {
      for (const id of stageSpawnableEnemyIds(stage)) {
        spawnable.add(id)
      }
    }
    expect([...spawnable].sort()).toEqual([...ALL_ROSTER_IDS].sort())
  })

  it('every roster id resolves to a real ENEMIES template', () => {
    const ids = new Set(ENEMIES.map((enemy) => enemy.id))
    for (const id of ALL_ROSTER_IDS) {
      expect(ids.has(id)).toBe(true)
    }
  })

  it('every spawnable id on every stage is on the beta roster (no dormant/hidden leak)', () => {
    const roster = new Set<string>(ALL_ROSTER_IDS)
    for (const stage of STAGES) {
      for (const id of stageSpawnableEnemyIds(stage)) {
        expect(roster.has(id)).toBe(true)
      }
    }
  })

  it('no hidden beast is spawnable on any beta stage', () => {
    const hiddenIds = new Set(HIDDEN_BEASTS.map((enemy) => enemy.id))
    for (const stage of STAGES) {
      for (const id of stageSpawnableEnemyIds(stage)) {
        expect(hiddenIds.has(id)).toBe(false)
      }
    }
  })
})

describe('beta boss mechanics preserved', () => {
  const enemyById = (id: string): Enemy => ENEMIES.find((enemy) => enemy.id === id)!

  it('ferocious_flood_serpent: water_surge every 4th own action + 60-turn enrage', () => {
    const serpent = enemyById('ferocious_flood_serpent')
    expect(serpent.specialAttacks).toEqual([
      { everyNth: 4, damageMultiplier: 2.5, presetId: 'water_surge' },
    ])
    expect(serpent.bossTrigger).toEqual({
      afterTurns: 60,
      buffDefinitionId: 'qi_refining_serpent_enrage',
    })
  })

  it('mortal_ferocious_giant_crocodile: water_surge every 4th own action + 60-turn enrage', () => {
    const croc = enemyById('mortal_ferocious_giant_crocodile')
    expect(croc.specialAttacks).toEqual([
      { everyNth: 4, damageMultiplier: 2, presetId: 'water_surge' },
    ])
    expect(croc.bossTrigger).toEqual({
      afterTurns: 60,
      buffDefinitionId: 'mortal_crocodile_enrage',
    })
  })

  it('foundation_ferocious_flood_dragon_whelp: HP 50%/25% phases + enrages + special', () => {
    const whelp = enemyById('foundation_ferocious_flood_dragon_whelp')
    expect(whelp.tribulationPhases?.map((phase) => phase.hpThresholdPercent)).toEqual([0.5, 0.25])
    expect(whelp.enrage?.afterSeconds).toBe(60)
    expect(whelp.bossTrigger?.afterTurns).toBe(60)
    expect(whelp.specialAttacks).toEqual([
      { everyNth: 4, damageMultiplier: 2.5, presetId: 'water_surge' },
    ])
  })

  it('the 3 beta bosses carry uniform resistance across the five elements', () => {
    for (const chapter of Object.values(BETA_ROSTER)) {
      const boss = enemyById(chapter.boss)
      const resistances = [
        boss.stats.woodResistance,
        boss.stats.fireResistance,
        boss.stats.earthResistance,
        boss.stats.metalResistance,
        boss.stats.waterResistance,
      ]
      expect(new Set(resistances).size).toBe(1)
      expect(resistances[0]).toBeGreaterThan(0)
    }
  })
})

describe('adversarial spawn funnel', () => {
  // Real systems end to end: the shipped hidden channel is primed open
  // and rng is pinned so the substitution roll always wins - the funnel
  // gate must still keep the substituted beast off beta stages.
  function stageWavesFor(stages: Stage[]) {
    const enemyTemplates = new TemplateRegistry<Enemy>()
    for (const enemy of [...ENEMIES, ...HIDDEN_BEASTS]) {
      enemyTemplates.register(enemy.id, enemy)
    }

    const stageTemplates = new TemplateRegistry<Stage>()
    for (const stage of stages) {
      stageTemplates.register(stage.id, stage)
    }

    const hiddenBeast = new HiddenBeastSystem({
      getEnemyTemplate: (id) => enemyTemplates.get(id),
      channels: hiddenBeastChannels(),
    })

    const waves = new StageWaveSystem({
      eventBus: new EventBus(),
      enemySystem: new EnemySystem(new EnemyManager()),
      stageManager: new StageManager(),
      stageSystem: new StageSystem(),
      stageTemplates,
      enemyTemplates,
      isStageUnlocked: () => true,
      launchBattle: () => {},
      hiddenBeast,
      sessionRng: () => 0,
    })

    return waves
  }

  it('primed hidden window + pinned winning roll: substitution can never fire on a beta stage', () => {
    const waves = stageWavesFor(STAGES)
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 10

    // Prime every shipped channel window to its kill threshold.
    for (const channel of hiddenBeastChannels()) {
      player.hiddenBeastKills[channel.id] = channel.killThreshold
    }

    // The primed window + pinned roll MUST return the beast for the
    // qi_refining band - proving the funnel's spawnable-set gate (not
    // the channel's realm band or a cold window) is what keeps it off
    // the shipped qi stages below.
    const enemyById = (id: string) => [...ENEMIES, ...HIDDEN_BEASTS].find((e) => e.id === id)
    expect(
      new HiddenBeastSystem({
        getEnemyTemplate: enemyById,
        channels: hiddenBeastChannels(),
      }).maybeReplaceSpawn(player, 'qi_refining', () => 0)?.id,
    ).toBe('huyet_mong')

    const roster = new Set<string>(ALL_ROSTER_IDS)
    const firstSpawn = STAGES.find((stage) => stage.requiredRealmId === 'mortal')!
    expect(waves.start(player, firstSpawn, false, { rng: () => 0 })).toBe(true)

    for (const stage of STAGES) {
      for (const isFinalSpawn of [false, true] as const) {
        // Non-final and final spawn positions of every stage.
        const picked = waves.pickEnemyForTurnSpawn(stage, isFinalSpawn, { rng: () => 0 })
        expect(picked).toBeDefined()
        expect(roster.has(picked!.id)).toBe(true)
        expect(picked!.id).not.toBe('huyet_mong')
      }
    }

    waves.stopRepeat()
  })

  it('floor 10 final spawn is the roster boss variant', () => {
    const waves = stageWavesFor(STAGES)

    for (const stage of STAGES.filter((candidate) => candidate.floor === 10)) {
      const picked = waves.pickEnemyForTurnSpawn(stage, true, { rng: () => 1 })
      expect(picked).toBeDefined()
      expect(picked!.id).toBe(stage.bossEnemyId)
      expect(picked!.isBoss).toBe(true)
    }
  })
})
