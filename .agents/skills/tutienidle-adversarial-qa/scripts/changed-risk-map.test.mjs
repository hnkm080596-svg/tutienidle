import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mapChangedPaths } from './changed-risk-map.mjs'

test('maps a focused combat path without forcing a deep candidate', () => {
  assert.deepEqual(mapChangedPaths(['game/src/core/battle/BattleSystem.ts']), {
    domains: ['combat-and-tribulation'],
    oneHopConsumers: [
      'combat presentation and controls',
      'loot, progression, and persistence after combat',
    ],
    deepAuditCandidate: false,
    reasons: [],
    unmappedPaths: [],
  })
})

test('normalizes Windows separators and maps save changes as deep candidates', () => {
  const result = mapChangedPaths([
    'game\\src\\services\\save\\SaveSystem.ts',
    'game\\src\\services\\cloudSave\\CloudSaveCoordinator.ts',
  ])

  assert.deepEqual(result.domains, ['save-and-cloud'])
  assert.equal(result.deepAuditCandidate, true)
  assert.deepEqual(result.reasons, ['critical state boundary: save-and-cloud'])
})

test('returns all overlapping domains and cross-system escalation', () => {
  const result = mapChangedPaths(['game/src/core/game/GameManager.ts'])

  assert.deepEqual(result.domains, [
    'combat-and-tribulation',
    'economy-and-progression',
    'pinia-phaser-sync',
    'time-and-offline',
  ])
  assert.equal(result.deepAuditCandidate, true)
  assert.ok(result.reasons.includes('cross-system change: 4 domains'))
})

test('keeps unknown paths visible instead of guessing', () => {
  assert.deepEqual(mapChangedPaths(['game/unknown/new-system.ts']), {
    domains: [],
    oneHopConsumers: [],
    deepAuditCandidate: false,
    reasons: [],
    unmappedPaths: ['game/unknown/new-system.ts'],
  })
})

test('deduplicates paths and output values', () => {
  const result = mapChangedPaths([
    './game/src/stores/player.ts',
    'game/src/stores/player.ts',
  ])

  assert.deepEqual(result.domains, ['pinia-phaser-sync'])
  assert.equal(new Set(result.oneHopConsumers).size, result.oneHopConsumers.length)
})

test('maps ArtifactSystem to battle-runtime artifact consumers', () => {
  assert.deepEqual(mapChangedPaths(['game/src/core/artifact/ArtifactSystem.ts']), {
    domains: ['combat-and-tribulation'],
    oneHopConsumers: [
      'artifact cooldown presentation and VFX',
      'battle action impact, ailments, buffs, and target state',
    ],
    deepAuditCandidate: false,
    reasons: [],
    unmappedPaths: [],
  })
})

test('maps StageSystem as a progression-to-combat spawn boundary', () => {
  assert.deepEqual(mapChangedPaths(['game/src/core/stage/StageSystem.ts']), {
    domains: ['combat-and-tribulation', 'economy-and-progression'],
    oneHopConsumers: [
      'StageWaveSystem enemy selection and eliteChance spawn handling',
      'battle enemy composition, loot eligibility, and progression flow',
    ],
    deepAuditCandidate: true,
    reasons: [
      'stage enemy selection bridges progression staging and combat spawns',
      'cross-system change: 2 domains',
    ],
    unmappedPaths: [],
  })
})

test('maps TechniqueSystem as progression ownership feeding combat stats', () => {
  assert.deepEqual(mapChangedPaths(['game/src/core/technique/TechniqueSystem.ts']), {
    domains: ['combat-and-tribulation', 'economy-and-progression'],
    oneHopConsumers: [
      'GameManager technique learn/equip rewards and save-facing ownership',
      'player stat aggregation and combat loadout',
    ],
    deepAuditCandidate: true,
    reasons: [
      'technique ownership and equip state feed progression rewards and combat stats',
      'cross-system change: 2 domains',
    ],
    unmappedPaths: [],
  })
})

test('maps StatCalculator as a shared stat pipeline with broad combat impact', () => {
  assert.deepEqual(mapChangedPaths(['game/src/core/stats/StatCalculator.ts']), {
    domains: ['combat-and-tribulation', 'economy-and-progression', 'inventory-equipment'],
    oneHopConsumers: [
      'buff, ailment, equipment, technique, pill, and formation modifiers',
      'player store derived stats and combat entity recomputation',
    ],
    deepAuditCandidate: true,
    reasons: [
      'shared stat pipeline feeds combat, progression, and equipment outcomes',
      'cross-system change: 3 domains',
    ],
    unmappedPaths: [],
  })
})

test('maps useBreakthrough as persisted progression, artifact, and UI sync boundary', () => {
  assert.deepEqual(mapChangedPaths(['game/src/composables/useBreakthrough.ts']), {
    domains: [
      'combat-and-tribulation',
      'economy-and-progression',
      'pinia-phaser-sync',
      'save-and-cloud',
    ],
    oneHopConsumers: [
      'GameManager syncRealmPassive/syncRealmStatPassive callers',
      'artifact awakening and technique equip rewards',
      'persisted realm, player artifact, technique, and announcement state',
    ],
    deepAuditCandidate: true,
    reasons: [
      'critical state boundary: save-and-cloud',
      'breakthrough composable mutates persisted realm, technique, artifact, and UI announcement state',
      'cross-system change: 4 domains',
    ],
    unmappedPaths: [],
  })
})

