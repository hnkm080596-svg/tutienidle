import { describe, expect, it } from 'vitest'
import { EnemySystem } from './EnemySystem'
import { EnemyManager } from './EnemyManager'
import { enemyToCombatEntity } from './Enemy'
import type { Enemy } from './Enemy'

const TEMPLATE = {
  id: 'wild_wolf',
  name: 'Dã Lang',
  level: 1,
  realmId: 'qi_refining',
  stats: {} as Enemy['stats'],
  currentHp: 10,
  maxHp: 10,
  alive: true,
} as unknown as Enemy

describe('EnemySystem.spawn template id stamping (Mission E Task 1)', () => {
  it('spawn stamps templateId while minting a unique instance id', () => {
    const system = new EnemySystem(new EnemyManager())
    const spawned = system.spawn(TEMPLATE)
    expect(spawned.id).not.toBe('wild_wolf')
    expect(spawned.id.startsWith('wild_wolf_')).toBe(true)
    expect(spawned.templateId).toBe('wild_wolf')
  })

  it('enemyToCombatEntity carries templateId onto the combat entity', () => {
    const system = new EnemySystem(new EnemyManager())
    const spawned = system.spawn(TEMPLATE)
    const entity = enemyToCombatEntity(spawned)
    expect(entity.templateId).toBe('wild_wolf')
  })
})
