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
  // DATA-SLICE TUNE 2026-10-04 (docs/balance/skills-review.md + the dated
  // baseline delta next to it): hoa_an 0.15->0.20, tam_muoi potency
  // 1.5->2.0, trang cost 0.30->0.15. The two spell recipes below (and
  // only they) drift -- every other cell stays byte-identical.
  'phap_tu_ngo_dao/attrition': { 11: '89c96945', 22: 'c5ab6a2c', 33: '307aa7d2', 44: '72dcc152', 55: 'aec6399d', 66: 'bd5b9b9d', 77: '4b86f318', 88: 'a0ee3a66' },
  'phap_tu_ngo_dao/burst_pressure': { 11: 'fb24a3e9', 22: 'b6548536', 33: 'f99c0eba', 44: 'ba33aab6', 55: 'd64ff159', 66: 'ca1cee30', 77: '70e42708', 88: '069d54f7' },
  'phap_tu_ngo_dao/durable_target': { 11: 'f5b8b2c5', 22: 'a3936dc3', 33: '3d4805a1', 44: '48bb3a82', 55: '45b52161', 66: '9ba2404f', 77: 'bab78471', 88: '94802645' },
  'phap_tu_ngo_dao/multi_enemy': { 11: '8a0cf226', 22: 'ff065710', 33: 'cae6dfaa', 44: 'e538231e', 55: 'dba1af97', 66: 'ed86ee06', 77: 'd24b805c', 88: 'ee812cb6' },
  'phap_tu_ngo_dao/single_target': { 11: '326cf562', 22: '32179a3f', 33: '4f50df11', 44: '3fea8788', 55: 'd8b024d2', 66: 'cb0d8142', 77: 'e90f9728', 88: '4cac6a6f' },
  'phap_tu_ngu_hanh/attrition': { 11: 'ed184b98', 22: '16dc9cae', 33: 'aeeec9ca', 44: '1b34f196', 55: '22a51898', 66: '5fb34f7f', 77: '823f7d4b', 88: '34f73221' },
  'phap_tu_ngu_hanh/burst_pressure': { 11: 'f14b45e4', 22: '0128414d', 33: 'ce3be68a', 44: '20df487a', 55: '285f2ca2', 66: 'a198ea81', 77: '6ef5d8d9', 88: '1ccda3a9' },
  'phap_tu_ngu_hanh/durable_target': { 11: 'bdb5047b', 22: '2daf9d7c', 33: '84bd196e', 44: '69e13a68', 55: 'fd98a466', 66: '01f2664f', 77: '5dfdc31e', 88: '281b394d' },
  'phap_tu_ngu_hanh/multi_enemy': { 11: '96317933', 22: '71b99d3c', 33: '62a590b4', 44: '0da03397', 55: 'f1d81cf9', 66: '9303badc', 77: '474150a8', 88: '86d160d7' },
  'phap_tu_ngu_hanh/single_target': { 11: 'c6d8c2ec', 22: '4ba22abc', 33: '58989970', 44: '099d36ad', 55: '5b32e9ed', 66: 'ffa666f3', 77: 'e96ae9c4', 88: '8ca6db26' },
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
