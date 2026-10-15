import { describe, expect, it } from 'vitest'
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript'
import { readSource, createCandidate, writeCandidate, runCandidate } from './AchievementMutationSupport.mjs'

const files = ['core/achievement/Achievement', 'core/achievement/AchievementRegistry',
  'core/achievement/AchievementEvaluator', 'core/achievement/AchievementPersistence',
  'core/achievement/AchievementSystem', 'data/achievement/achievements', 'core/idle/GameClock']
const scenario = `
import assert from 'node:assert/strict';
const owner = new AchievementSystem('mutation-fixture', 0);
const receipt = { playerId: 'mutation-fixture', eventId: 'delivered', sourceId: 'fixture', occurredAt: 0,
  committed: true, authority: 'inventory', kind: 'material_delivered', materialId: 'material_spirit_wood_decade', quantityDelivered: 20 };
assert.equal(owner.ingest(receipt), true);
assert.equal(owner.ingest(receipt), false);
const ready = owner.snapshot();
assert.equal(owner.claim('ach_m01_lam_thu', () => false), 'delivery-failed');
assert.deepEqual(owner.snapshot(), ready);
assert.equal(owner.claim('ach_m01_lam_thu', () => true), 'granted');
assert.equal(owner.claim('ach_m01_lam_thu', () => true), 'already-claimed');
assert.equal(owner.restore(ready), false);
const other = new AchievementSystem('mutation-fixture', 0);
other.reconcile({playerId:'mutation-fixture',completedStageIds:[],completedOnceIds:[],reachedRealmIds:['foundation_establishment'],attainedElementIds:[]});
other.ingest({ playerId: 'mutation-fixture', eventId: 'assigned', sourceId: 'fixture', occurredAt: 0,
  committed: true, authority: 'formation', kind: 'formation_companion_assigned', companionId: 'a' });
other.ingest({ playerId: 'mutation-fixture', eventId: 'entitled', sourceId: 'fixture', occurredAt: 0,
  committed: true, authority: 'companion', kind: 'companion_entitled', companionId: 'b' });
assert.equal(other.get('ach_f04_dong_hanh').ready, false);
const weekly = new AchievementSystem('mutation-fixture', 0);
const state = weekly.snapshot();
assert.equal(weekly.restore({...state, revision:1, receiptIds:['w'], operationIds:['weekly:w'],
  weeklyClaims:[{claimId:'w', period:10, extra:{hidden:[]}}]}), false);
assert.equal(weekly.restore({...state, revision:1, receiptIds:['w'], operationIds:['weekly:w'],
  weeklyClaims:[{claimId:'w', period:10}]}), true);
const sparse = new AchievementSystem('mutation-fixture', 0);
assert.equal(sparse.reconcile({playerId:'mutation-fixture',completedStageIds:[],completedOnceIds:[],
  reachedRealmIds:[],attainedElementIds:[],entitledCompanionIds:Array(1),assignedCompanionIds:Array(1)}), false);
`

const mutants = [
  ['control', '', ''],
  ['receipt-replay', '|| this.state.receiptIds.includes(receipt.eventId)', '|| false'],
  ['claim-replay', "if (this.state.claimedIds.includes(id)) return 'already-claimed'", 'if (false) return \'already-claimed\''],
  ['failure-rollback', "if (delivered !== true) { this.state = previous; return 'delivery-failed' }", "if (delivered !== true) { return 'delivery-failed' }"],
  ['stale-restore', 'if (!next || !preservesAchievementHistory(this.state, next)) return false', 'if (!next) return false'],
  ['companion-identity', 'next.assignedCompanionIds.some((id) => next.entitledCompanionIds.includes(id))', 'next.assignedCompanionIds.length > 0'],
  ['nested-save-alias', '', ''],
  ['sparse-owner-ids', '', ''],
] as const

describe('isolated semantic mutants (candidate source never modified)', () => {
  it.each(mutants)('%s is a valid control or killed by a behavioral invariant', (id, needle, replacement) => {
    const originals = new Map(files.map((file) => [file, readSource(file)]))
    const original = originals.get('core/achievement/AchievementSystem')!
    const candidateId = createCandidate(id, JSON.stringify([...originals]))
    if (needle) expect(original.includes(needle)).toBe(true)
    // Preserve append-only evidence copies; node_modules keeps them out of normal discovery.
    for (const file of files) {
      let source = originals.get(file)!
      if (file === 'core/achievement/AchievementSystem' && needle) source = source.replace(needle, replacement)
      if (file === 'core/achievement/AchievementPersistence' && id === 'nested-save-alias') {
        const guard = " || Object.keys(entry).some((key) => key !== 'claimId' && key !== 'period')"
        const copy = '({ claimId: entry.claimId, period: entry.period })'
        expect(source.includes(guard)).toBe(true)
        expect(source.includes(copy)).toBe(true)
        source = source.replace(guard, '').replace(copy, '({ ...entry })')
      }
      if (file === 'core/achievement/AchievementRegistry' && id === 'sparse-owner-ids') {
        expect(source.includes('Array.from(value).every(nonempty)')).toBe(true)
        source = source.replace('Array.from(value).every(nonempty)', 'value.every(nonempty)')
      }
      const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText
        .replace(/from ['"]([^'"]+)['"]/g, (_match: string, specifier: string) => `from '${specifier}.mjs'`)
      writeCandidate(candidateId, file, compiled)
    }
    const failure = runCandidate(candidateId, scenario)
    for (const [file, unchanged] of originals) expect(readSource(file)).toBe(unchanged)
    if (id === 'control') expect(failure).toBe('')
    else {
      expect(failure).toContain('AssertionError')
      expect(failure).not.toContain('ERR_MODULE_NOT_FOUND')
      expect(failure).not.toContain('SyntaxError')
    }
  })
})
