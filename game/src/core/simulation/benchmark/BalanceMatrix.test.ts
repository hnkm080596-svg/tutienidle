// P5-M2 - the committed balance-baseline regression oracle. The
// per-seed fingerprint set IS the snapshot: any engine/content drift
// that moves a gate-driving metric moves the fingerprint, so an exact
// match pins the whole entry-level baseline. Updating this table is a
// deliberate-review event - it must land in the same commit as the
// balance/content change that caused it, with the delta documented in
// docs/balance/.

import { describe, expect, it } from 'vitest'
import { BALANCE_SEEDS } from './BalanceBaselines'
import { runBalanceMatrix } from './BalanceReport'
import { BENCHMARKS } from './BenchmarkEncounters'

// Committed per-seed fingerprint set, keyed `${recipeId}/${benchmarkId}`.
const EXPECTED_FINGERPRINTS: Record<string, Record<number, string>> = {
  'kiem_tu_hien/attrition': { 11: 'f63f96b4', 22: '8f283028', 33: 'b9975720', 44: '6d94143b', 55: 'c8feceed', 66: '65e18ba8', 77: '12187c3b', 88: '247b3e54' },
  'kiem_tu_hien/burst_pressure': { 11: 'd599640b', 22: 'ebcf3709', 33: 'c280af25', 44: '6936d4fd', 55: '731f7c86', 66: '9e2630e7', 77: '3e0fffd9', 88: '731f7c86' },
  'kiem_tu_hien/durable_target': { 11: '80638a85', 22: 'a9257b46', 33: '1d5e35b8', 44: 'fdcd0cfc', 55: 'fa28749e', 66: '241b7069', 77: '175a13b3', 88: 'da9d9005' },
  'kiem_tu_hien/multi_enemy': { 11: 'a6903949', 22: 'e26c7d84', 33: '1142cf36', 44: '97a1be4c', 55: '4cc2b0de', 66: 'aa8f3f3d', 77: 'ad8bdf72', 88: '62a91328' },
  'kiem_tu_hien/single_target': { 11: 'd801623d', 22: 'de6a4790', 33: '1bbe292d', 44: '04c15c25', 55: '3aa6b3ec', 66: '46f97dba', 77: '539a600a', 88: '70befeda' },
  'kiem_tu_ngu/attrition': { 11: 'ed9700f7', 22: 'f2510032', 33: '6073eebb', 44: '86a23ca2', 55: '09ca5b99', 66: 'ac31fe27', 77: 'ca039c4c', 88: '9aea646b' },
  'kiem_tu_ngu/burst_pressure': { 11: '576e9420', 22: '576e9420', 33: '11f08f0b', 44: '540710e1', 55: '43a9c549', 66: '7f004077', 77: '2b69db6a', 88: '61423ad6' },
  'kiem_tu_ngu/durable_target': { 11: '010c23f6', 22: 'e6080b0c', 33: '5e30c54a', 44: '582d28cd', 55: 'dbb406cb', 66: '006d9fec', 77: '5bf2b7f6', 88: 'c7c86d77' },
  'kiem_tu_ngu/multi_enemy': { 11: '5ad17259', 22: '8fb4531b', 33: '779816c1', 44: '3e843010', 55: '8cd601b8', 66: '1d27f4d8', 77: '5cbe5cd5', 88: 'e27c34a9' },
  'kiem_tu_ngu/single_target': { 11: 'e65a38a1', 22: '821d0aba', 33: '6794a7b7', 44: '6b7b444b', 55: '6766573a', 66: 'd3bd4f53', 77: '0524982d', 88: '6e510c25' },
  // F-SCOPE-1 BUFF 2026-10-05 (docs/balance/2026-10-05-stat-wall-ladder.md):
  // hoa_cau_thuat hit 1 -> 1.07 (+7% fire kit damage, Minh ruling). Both
  // spell recipes own fire surface (ngu_hanh runs hoa_cau_thuat as its
  // kit basic; ngo_dao's kit ids include every element basic), so the
  // two phap_tu recipes below drift -- all 20 kiem_tu/the_tu cells stay
  // byte-identical (verified against the previous committed set).
  'phap_tu_ngo_dao/attrition': { 11: '3cc89031', 22: '3ce75eec', 33: '4b5ee6b1', 44: '2a7a75a9', 55: '4d7bdf75', 66: 'cb96f5a3', 77: '793cac12', 88: '190b69d1' },
  'phap_tu_ngo_dao/burst_pressure': { 11: '56b7e110', 22: '41c0ee7e', 33: '35f3019d', 44: 'bedfabac', 55: 'f31307c3', 66: 'cbecd038', 77: '265d20d2', 88: '41bf92e6' },
  'phap_tu_ngo_dao/durable_target': { 11: '1aca4d7f', 22: '34802ef8', 33: 'a2193d60', 44: '9374862f', 55: 'ec7db432', 66: 'c86a483c', 77: 'd6c2c1a1', 88: '42e25bb5' },
  'phap_tu_ngo_dao/multi_enemy': { 11: '961df44b', 22: '3546cf2a', 33: '9403c3ce', 44: 'bb23c613', 55: '95e5951f', 66: 'ca258967', 77: '3d6f5202', 88: '95ee58b4' },
  'phap_tu_ngo_dao/single_target': { 11: '2eb6d12b', 22: '9f70a898', 33: 'fb08a0fc', 44: 'f741348c', 55: 'abc4380c', 66: '60015eba', 77: 'feb34db5', 88: '9c435c75' },
  'phap_tu_ngu_hanh/attrition': { 11: '7766e506', 22: 'c85548b1', 33: '44c8b6f9', 44: 'e4dd2aa2', 55: '6b243b1f', 66: '72db8814', 77: '4afbb1c9', 88: '011b7417' },
  'phap_tu_ngu_hanh/burst_pressure': { 11: 'fbd0b091', 22: '3df0baac', 33: 'f7a91e6a', 44: '8a55c2d8', 55: '3f574376', 66: '346ef498', 77: 'cee85415', 88: 'fead0aff' },
  'phap_tu_ngu_hanh/durable_target': { 11: 'a1c50a94', 22: 'd066a161', 33: 'e2755490', 44: '0893d895', 55: 'b9819ab6', 66: '1c660b81', 77: 'fade618b', 88: '46a097bb' },
  'phap_tu_ngu_hanh/multi_enemy': { 11: '86c45abc', 22: 'f400382d', 33: '6a96625d', 44: '286a1491', 55: 'e031aa03', 66: '70be7efb', 77: 'e5f5ec0f', 88: '5ef283d8' },
  'phap_tu_ngu_hanh/single_target': { 11: '3593e45d', 22: 'd8e226f3', 33: '23ba67fe', 44: 'aa29e6cd', 55: '399f3742', 66: '77afe358', 77: '399f3742', 88: 'db95ec95' },
  'the_tu_hien/attrition': { 11: '264b5b18', 22: '3648c676', 33: '523e5af2', 44: '5b27d4fc', 55: '67698cab', 66: 'e7cec04d', 77: 'ddf7130a', 88: 'a553a49c' },
  'the_tu_hien/burst_pressure': { 11: '354eac78', 22: 'c2386a93', 33: '9ee3358c', 44: '76f0c377', 55: 'a7c6cfb6', 66: '221f701a', 77: 'df4a5579', 88: 'e67e777b' },
  'the_tu_hien/durable_target': { 11: '67047800', 22: '624522d2', 33: 'e534ed9f', 44: '502f5920', 55: '99fbd0b1', 66: '51637627', 77: 'f0d98513', 88: 'c5623218' },
  'the_tu_hien/multi_enemy': { 11: '59edd52b', 22: '2b7b07a0', 33: 'b5f3588a', 44: 'a8597545', 55: '28019eed', 66: '2a10576a', 77: '7460f59f', 88: '21204f0d' },
  'the_tu_hien/single_target': { 11: '6f134020', 22: '80cd1df8', 33: '8753bc50', 44: '758aed3c', 55: 'a49c2787', 66: '6c92c6fe', 77: 'a62ab48d', 88: 'fa1773d1' },
  'the_tu_ung_the/attrition': { 11: '6d49f9f3', 22: '4fcbe1c2', 33: '57152bc0', 44: '929c9537', 55: 'beaaad3a', 66: 'edb7285c', 77: '508890b0', 88: '7727065b' },
  'the_tu_ung_the/burst_pressure': { 11: '3b17ac9b', 22: '43084e0c', 33: 'ad45492c', 44: '861bceb5', 55: '30e556e9', 66: 'e7c80ce1', 77: '25af8bef', 88: '19cc7f6d' },
  'the_tu_ung_the/durable_target': { 11: '1344027a', 22: '2b123065', 33: '9e615af0', 44: 'c6e4eec5', 55: 'ec9b484b', 66: '47496082', 77: '7a72b0bd', 88: '17457b91' },
  'the_tu_ung_the/multi_enemy': { 11: 'b954ffc2', 22: 'f9d36641', 33: '2aba04c2', 44: 'de31004e', 55: '065de686', 66: '3c3d66c4', 77: 'ce57009f', 88: 'eabbc848' },
  'the_tu_ung_the/single_target': { 11: '5535e6d5', 22: '2b3772ca', 33: '9ee92ab7', 44: '7918e2db', 55: '023ee932', 66: '5fa643dc', 77: '0ed7c153', 88: '184db9cf' },
}

describe('balance matrix regression', () => {
  // 6 recipes x 5 benchmarks x 8 seeds = 240 deterministic battles.
  const matrix = runBalanceMatrix()

  it('produces the full cell grid', () => {
    expect(matrix.cells).toHaveLength(matrix.recipes.length * BENCHMARKS.length)
    for (const cell of matrix.cells) {
      expect(cell.seeds.map((s) => s.seed)).toEqual([...BALANCE_SEEDS])
    }
  })

  it('matches the committed per-seed fingerprint set exactly', () => {
    const actual: Record<string, Record<number, string>> = {}
    for (const cell of matrix.cells) {
      const key = `${cell.recipeId}/${cell.benchmarkId}`
      actual[key] = {}
      for (const seed of cell.seeds) actual[key]![seed.seed] = seed.fingerprint
    }
    expect(actual).toEqual(EXPECTED_FINGERPRINTS)
  })

  it('gate verdicts hold on the committed baseline', () => {
    const { gates } = matrix
    // exit-1: no path strictly dominates every benchmark.
    expect(gates.dominance.pass).toBe(true)
    // exit-2: every primary path has an identifiable strength AND
    // weakness somewhere. MERGED-ENGINE PIN (PT-REIM x ung-the beta):
    // the_tu_hien has no identifiable strength (master's recorded
    // deviation: Luyen Khi The Tu is basic-only by design) and
    // phap_tu_ngu_hanh shows no weakness (PT interim composition runs
    // the retired-machinery kit -- docs/balance/2026-09-26-phap-tu-
    // reimagine-engine.md). Pinned per-recipe so drift still trips.
    expect(gates.strengths.perRecipe).toEqual({
      kiem_tu_hien: { hasStrength: true, hasWeakness: true },
      phap_tu_ngu_hanh: { hasStrength: true, hasWeakness: false },
      the_tu_hien: { hasStrength: false, hasWeakness: true },
    })
    // No stalemate cells, no deadlocked declared channels.
    expect(gates.stalemates).toEqual([])
    expect(gates.deadlocks).toEqual([])
    // exit-4: attribution coverage is sufficient and no single non-kit
    // bucket tops EVERY primary row's pooled damage distribution.
    expect(gates.secondaryDominance).toBe('PASS')
  })

  // TEMPORARY USER EXCEPTION (expires at BETA-BALANCE): under the KIEM
  // PHO BETA numbers the_tu_hien has no identifiable strength, so the
  // exit-2 strengths gate is red. User ruling keeps the numbers and
  // defers the rebalance; it.fails self-flags the moment the gate goes
  // green again so this marker cannot linger. See
  // docs/balance/2026-09-25-kiem-pho-beta-rebaseline.md.
  it.fails('strengths gate - user exception pending BETA-BALANCE', () => {
    expect(matrix.gates.strengths.pass).toBe(true)
  })
})
