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
'kiem_tu_hien/single_target': { 11: '3822a203', 22: 'f5115702', 33: '5d0f28aa', 44: 'ba6861b8', 55: '9c4244fc', 66: '3f81c022', 77: 'b285701d', 88: 'b2fbfb51' },
  'kiem_tu_hien/multi_enemy': { 11: '520d62c7', 22: '088553ef', 33: '2bed48aa', 44: 'e133a488', 55: 'e1c25f96', 66: 'c9ca361c', 77: '21965c7e', 88: 'dba4d383' },
  'kiem_tu_hien/durable_target': { 11: 'e2b11eb1', 22: '07b00caf', 33: 'ee3036db', 44: 'd928552c', 55: 'aae10312', 66: 'e50107a9', 77: '56f5a887', 88: '5d5c1375' },
  'kiem_tu_hien/burst_pressure': { 11: 'dd081c4b', 22: 'c2e772c2', 33: '8a1002a1', 44: 'ce139641', 55: '0127a738', 66: '890ef8e2', 77: 'c7984ca0', 88: '2aa6ddb4' },
  'kiem_tu_hien/attrition': { 11: '05c68790', 22: '984723cd', 33: 'd398b652', 44: '1b11fea7', 55: 'f4b90c8e', 66: '0f6aa27a', 77: '7cd6f3bf', 88: '4d253153' },
  'phap_tu_ngu_hanh/single_target': { 11: 'eb92af2f', 22: 'dab1e029', 33: 'cee13d94', 44: 'd67e4549', 55: 'a8407866', 66: '935ad036', 77: 'a43194ad', 88: '7bca8377' },
  'phap_tu_ngu_hanh/multi_enemy': { 11: '86edb5e6', 22: 'd12028a7', 33: '8cce382a', 44: 'b30280f7', 55: 'bd4da845', 66: '26ecd171', 77: 'dce9c296', 88: 'dd830009' },
  'phap_tu_ngu_hanh/durable_target': { 11: '94a4fd26', 22: '93654647', 33: 'ff69f9fb', 44: 'fdb2c31e', 55: '7c5c313e', 66: 'b5ee2dcc', 77: '72615caa', 88: 'de035eae' },
  'phap_tu_ngu_hanh/burst_pressure': { 11: '293a333d', 22: '8534a316', 33: 'bda09833', 44: '33655b8f', 55: 'e929642f', 66: '3db2dc0d', 77: '3533ef56', 88: '3736e643' },
  'phap_tu_ngu_hanh/attrition': { 11: '14943eee', 22: '1ceb8028', 33: 'de7e3b13', 44: '90a0e337', 55: 'e9f88175', 66: '05002142', 77: '703d9eca', 88: '7c5107b8' },
  'the_tu_hien/single_target': { 11: 'd78a1b16', 22: '1ec3ed1f', 33: '018bc48c', 44: 'c899e23f', 55: 'f7c2a8d0', 66: 'b882a56c', 77: '8fa57369', 88: 'efd5fe10' },
  'the_tu_hien/multi_enemy': { 11: '9864788c', 22: '541c31b2', 33: '60d32108', 44: '7ced0570', 55: '76f47148', 66: '3197659e', 77: 'bf94bf4a', 88: 'bd625bd5' },
  'the_tu_hien/durable_target': { 11: '0e6eae6a', 22: '0c9ab0fd', 33: 'c9a74162', 44: 'c9e47ffd', 55: 'b7fd9556', 66: '655861ae', 77: 'f209dbbf', 88: '776927d7' },
  'the_tu_hien/burst_pressure': { 11: '88d29f43', 22: 'accf585e', 33: 'c283cb85', 44: '3eef9800', 55: '6a9eaf6e', 66: '82f7afcd', 77: '299393b9', 88: 'baa5ddeb' },
  'the_tu_hien/attrition': { 11: '70349acb', 22: '352e9b96', 33: '1720036b', 44: 'f6c205fa', 55: '9491a9b8', 66: '053825c9', 77: '729d729f', 88: '2fe62ec7' },
  'phap_tu_ngo_dao/single_target': { 11: '2314ec2e', 22: '5b7558d0', 33: '5f391cb5', 44: '661972fb', 55: '05885673', 66: 'fe4d9708', 77: 'b5c937dd', 88: '5ddf4541' },
  'phap_tu_ngo_dao/multi_enemy': { 11: 'f4f1e49b', 22: '4bf8e83f', 33: '621fb9ea', 44: '7b113ff5', 55: '65575a19', 66: 'd985fe93', 77: 'ecef99dc', 88: '90484287' },
  'phap_tu_ngo_dao/durable_target': { 11: '65e6fbeb', 22: 'e5b663d1', 33: '37ab47c8', 44: '17435bc9', 55: '0107761c', 66: 'e48986a1', 77: 'f3f481d6', 88: '14dbceeb' },
  'phap_tu_ngo_dao/burst_pressure': { 11: '7b3c4eb1', 22: '135d2ad2', 33: '7958ae63', 44: '86449e78', 55: '142a1f93', 66: '74d801e3', 77: '14149cbd', 88: '6de16dd1' },
  'phap_tu_ngo_dao/attrition': { 11: '75f1fa77', 22: '06b11100', 33: '203f6068', 44: 'bc21562e', 55: '5c91ba07', 66: '1edd6587', 77: '8fa4afa6', 88: '0fb3d906' },
  'the_tu_ung_the/single_target': { 11: 'c0965c0e', 22: 'fe1ff3e2', 33: '5ddac375', 44: '8a954afa', 55: '9735e489', 66: 'b12d9670', 77: 'a5ddb182', 88: 'd77e45d5' },
  'the_tu_ung_the/multi_enemy': { 11: 'a225d8ae', 22: '7e18f836', 33: '06dea51a', 44: '914f6079', 55: '60d733c9', 66: '72b80cdb', 77: '5a1419e4', 88: '5e1a6a5e' },
  'the_tu_ung_the/durable_target': { 11: 'c5b35de1', 22: '750bb985', 33: '8be0be52', 44: '890f79a2', 55: '3dd5f9ea', 66: '055bd4fa', 77: 'ccbca3e7', 88: '4f380563' },
  'the_tu_ung_the/burst_pressure': { 11: '17ee4e8e', 22: 'c4474b57', 33: '6603f452', 44: 'eaefaa18', 55: '8572bcda', 66: 'b0b675ea', 77: '8b5b84d7', 88: '7f93cd57' },
  'the_tu_ung_the/attrition': { 11: 'b9175146', 22: '480d1e82', 33: '8e8dad07', 44: '4f1c925b', 55: '86dddd28', 66: '7a2bceb1', 77: '0ce9e73d', 88: '3d3cd5fa' },
  'kiem_tu_ngu/single_target': { 11: 'd65bdd66', 22: 'ce5e226a', 33: '26997728', 44: '650f24b2', 55: '4726e470', 66: '9c451f2b', 77: '2af04a29', 88: '4cc4e2cb' },
  'kiem_tu_ngu/multi_enemy': { 11: 'b0bb592e', 22: '864da95b', 33: '7e07f3f0', 44: '5c13379b', 55: '0006b416', 66: '5c8d9121', 77: 'e5293c54', 88: 'f3383a5f' },
  'kiem_tu_ngu/durable_target': { 11: 'bbe69b04', 22: '197aa571', 33: 'b5808209', 44: '996c45d0', 55: '9ca8cbee', 66: 'fbf982ce', 77: '897c2b55', 88: 'd0f58d09' },
  'kiem_tu_ngu/burst_pressure': { 11: '47cb2836', 22: '083f6d74', 33: '5ba31b75', 44: '9fb8adf6', 55: '871b8c5e', 66: '5058c194', 77: '09e50381', 88: '13991099' },
  'kiem_tu_ngu/attrition': { 11: '790cf405', 22: '12cded96', 33: '1f977688', 44: '9d5418ce', 55: 'a8f086ac', 66: '9faf8b3a', 77: 'a0f307cf', 88: 'a80510d3' },
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
    // weakness somewhere.
    expect(gates.strengths.pass).toBe(true)
    // No stalemate cells, no deadlocked declared channels.
    expect(gates.stalemates).toEqual([])
    expect(gates.deadlocks).toEqual([])
    // exit-4: attribution coverage is sufficient and no single non-kit
    // bucket tops EVERY primary row's pooled damage distribution.
    expect(gates.secondaryDominance).toBe('PASS')
  })
})
