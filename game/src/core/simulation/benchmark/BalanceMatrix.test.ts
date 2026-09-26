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
  'kiem_tu_hien/single_target': { 11: 'd801623d', 22: 'de6a4790', 33: '1bbe292d', 44: '04c15c25', 55: '3aa6b3ec', 66: '46f97dba', 77: '539a600a', 88: '70befeda' },
  'kiem_tu_hien/multi_enemy': { 11: 'a6903949', 22: 'e26c7d84', 33: '1142cf36', 44: '97a1be4c', 55: '4cc2b0de', 66: 'aa8f3f3d', 77: 'ad8bdf72', 88: '62a91328' },
  'kiem_tu_hien/durable_target': { 11: '80638a85', 22: 'a9257b46', 33: '1d5e35b8', 44: 'fdcd0cfc', 55: 'fa28749e', 66: '241b7069', 77: '175a13b3', 88: 'da9d9005' },
  'kiem_tu_hien/burst_pressure': { 11: 'd599640b', 22: 'ebcf3709', 33: 'c280af25', 44: '6936d4fd', 55: '731f7c86', 66: '9e2630e7', 77: '3e0fffd9', 88: '731f7c86' },
  'kiem_tu_hien/attrition': { 11: 'f63f96b4', 22: '8f283028', 33: 'b9975720', 44: '6d94143b', 55: 'c8feceed', 66: '65e18ba8', 77: '12187c3b', 88: '247b3e54' },
  'phap_tu_ngu_hanh/single_target': { 11: 'e69c141d', 22: 'c3a65b8e', 33: '262aac9b', 44: '18c43095', 55: 'f0cebc42', 66: '415d7fac', 77: 'f6b2f9f3', 88: '7c206c73' },
  'phap_tu_ngu_hanh/multi_enemy': { 11: 'd48f70ec', 22: 'a41c8cc2', 33: '6855819b', 44: '39e135ed', 55: '5a57dad3', 66: '09a1da65', 77: '429d902f', 88: '422aea58' },
  'phap_tu_ngu_hanh/durable_target': { 11: '85b75b74', 22: '3877dbbb', 33: '9737e504', 44: '65bee5de', 55: 'f9414ccd', 66: 'ab00fd1e', 77: 'aeb991d7', 88: '99e784a2' },
  'phap_tu_ngu_hanh/burst_pressure': { 11: 'cf22ceff', 22: '79933308', 33: '698875ab', 44: 'e8c075e2', 55: '15af7cf5', 66: '4bb35ab0', 77: 'a1702729', 88: 'e91c48f8' },
  'phap_tu_ngu_hanh/attrition': { 11: '98872801', 22: 'ea22f77c', 33: '943256cc', 44: '1b301600', 55: '93a601f3', 66: 'b0b3ef17', 77: '7ab6a1ab', 88: '79a624e4' },
  'the_tu_hien/single_target': { 11: '6f134020', 22: '80cd1df8', 33: '8753bc50', 44: '758aed3c', 55: 'a49c2787', 66: '6c92c6fe', 77: 'a62ab48d', 88: 'fa1773d1' },
  'the_tu_hien/multi_enemy': { 11: '59edd52b', 22: '2b7b07a0', 33: 'b5f3588a', 44: 'a8597545', 55: '28019eed', 66: '2a10576a', 77: '7460f59f', 88: '21204f0d' },
  'the_tu_hien/durable_target': { 11: '67047800', 22: '624522d2', 33: 'e534ed9f', 44: '502f5920', 55: '99fbd0b1', 66: '51637627', 77: 'f0d98513', 88: 'c5623218' },
  'the_tu_hien/burst_pressure': { 11: '354eac78', 22: 'c2386a93', 33: '9ee3358c', 44: '76f0c377', 55: 'a7c6cfb6', 66: '221f701a', 77: 'df4a5579', 88: 'e67e777b' },
  'the_tu_hien/attrition': { 11: '264b5b18', 22: '3648c676', 33: '523e5af2', 44: '5b27d4fc', 55: '67698cab', 66: 'e7cec04d', 77: 'ddf7130a', 88: 'a553a49c' },
  'phap_tu_ngo_dao/single_target': { 11: '86d6ff3f', 22: '4b0c77b5', 33: 'ee6a79e9', 44: 'bc66d835', 55: '38446e92', 66: '6f66764f', 77: '8751ff60', 88: 'e6002894' },
  'phap_tu_ngo_dao/multi_enemy': { 11: '8a0cf226', 22: 'b1bef5f1', 33: 'cae6dfaa', 44: '3fd2c12f', 55: '0f9c09ef', 66: '44ef9dea', 77: 'd24b805c', 88: 'f31e2756' },
  'phap_tu_ngo_dao/durable_target': { 11: '91423e36', 22: '7dc2c2c7', 33: '8beadcfa', 44: '05012b4b', 55: 'c0bf1808', 66: 'cb2791bc', 77: '5e0ab698', 88: '09bdfeee' },
  'phap_tu_ngo_dao/burst_pressure': { 11: 'b592a54c', 22: '2b9e29db', 33: 'f99c0eba', 44: 'ec350a30', 55: 'd64ff159', 66: '34abefb8', 77: '78a5c631', 88: '069d54f7' },
  'phap_tu_ngo_dao/attrition': { 11: 'dc06d25e', 22: 'fa8afdab', 33: '564ac506', 44: 'c8f6f3a7', 55: '5b203089', 66: '4293ab83', 77: 'f7295b74', 88: '9f011c1c' },
  'the_tu_ung_the/single_target': { 11: 'de9c0704', 22: 'f1b7de30', 33: 'c4f2a53f', 44: '29c143d8', 55: '77e76e37', 66: 'a7b9c6ce', 77: '5e0e3f2a', 88: '33fea95e' },
  'the_tu_ung_the/multi_enemy': { 11: '744b0a09', 22: '5be84eb0', 33: '95a7fe33', 44: '84d8332a', 55: 'f628e2a8', 66: '049846f6', 77: '8845c1a9', 88: '7c8ac260' },
  'the_tu_ung_the/durable_target': { 11: 'dd1c6d69', 22: '1812c7d3', 33: 'c2c0ec4a', 44: '0343489b', 55: '7ef9abe2', 66: '62b5e30a', 77: '5cbb10d9', 88: 'd72e8b48' },
  'the_tu_ung_the/burst_pressure': { 11: '2090970a', 22: 'c7d652db', 33: '9f709706', 44: 'cab3e268', 55: '01b55ff5', 66: '3f0c4312', 77: 'e3e2a447', 88: '4562c544' },
  'the_tu_ung_the/attrition': { 11: '858dc3bc', 22: '3ed79cba', 33: '07506795', 44: 'fe294423', 55: '46ad2a52', 66: '6baf0545', 77: '8fc9b2b8', 88: '73729934' },
  'kiem_tu_ngu/single_target': { 11: 'e65a38a1', 22: '821d0aba', 33: '6794a7b7', 44: '6b7b444b', 55: '6766573a', 66: 'd3bd4f53', 77: '0524982d', 88: '6e510c25' },
  'kiem_tu_ngu/multi_enemy': { 11: '5ad17259', 22: '8fb4531b', 33: '779816c1', 44: '3e843010', 55: '8cd601b8', 66: '1d27f4d8', 77: '5cbe5cd5', 88: 'e27c34a9' },
  'kiem_tu_ngu/durable_target': { 11: '010c23f6', 22: 'e6080b0c', 33: '5e30c54a', 44: '582d28cd', 55: 'dbb406cb', 66: '006d9fec', 77: '5bf2b7f6', 88: 'c7c86d77' },
  'kiem_tu_ngu/burst_pressure': { 11: '576e9420', 22: '576e9420', 33: '11f08f0b', 44: '540710e1', 55: '43a9c549', 66: '7f004077', 77: '2b69db6a', 88: '61423ad6' },
  'kiem_tu_ngu/attrition': { 11: 'ed9700f7', 22: 'f2510032', 33: '6073eebb', 44: '86a23ca2', 55: '09ca5b99', 66: 'ac31fe27', 77: 'ca039c4c', 88: '9aea646b' },
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
    // weakness somewhere. THE TU BETA RECORDED DEVIATION (design
    // authority: 'Exact coefficient de balance sau' - Luyen Khi The Tu
    // is basic-only by design): the_tu_hien lost its identifiable
    // strength and phap_tu_ngu_hanh's strictly-worst slot moved to
    // the_tu_hien. Pinned per-recipe so the oracle still catches drift;
    // revisit when entry-level the_tu tuning lands.
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
