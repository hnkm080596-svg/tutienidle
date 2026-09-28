// QA novel-attack probe (post-COR-A state 621131c5, head 05367f86) -
// attacks the freshly added non-core nodeLevels bounds check in
// saveShapeValidation through the real validator entry. Lives in
// docs/qa/runs/ so it is excluded from productStateId; run via
// vitest.probe.config.mts.
import { describe, expect, it } from 'vitest'
import { validateGameSaveShape } from '../../../../../src/services/save/saveShapeValidation'
import { CURRENT_SAVE_VERSION } from '../../../../../src/services/save/saveVersion'
import { createDefaultPlayer } from '../../../../../src/core/player/Player'

function validSave(): Record<string, unknown> {
  return {
    version: CURRENT_SAVE_VERSION,
    player: createDefaultPlayer(),
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

function paths(save: Record<string, unknown>): string[] {
  const result = validateGameSaveShape(save)
  return result.issues.map((issue) => issue.path)
}

function withLevels(levels: Record<string, number>): Record<string, unknown> {
  const save = validSave()
  ;(save.player as Record<string, unknown>).nodeLevels = { ...levels }
  return save
}

describe('novel attack: non-core nodeLevels bounds', () => {
  it('rejects crafted levels above maxLevel on rewardOnly grant nodes', () => {
    // the_thuc_tinh maxLevel 1, tinh_thong_hoa maxLevel 2 - the exact
    // surface F-COR6-1 proved injectable.
    expect(paths(withLevels({ the_thuc_tinh: 5 }))).toContain('player.nodeLevels.the_thuc_tinh')
    expect(paths(withLevels({ tinh_thong_hoa: 3 }))).toContain('player.nodeLevels.tinh_thong_hoa')
  })

  it('rejects non-integer and out-of-range levels on registered basic-branch nodes', () => {
    for (const level of [0, -1, 2.5]) {
      expect(paths(withLevels({ fire_basic_hoa_tu_diem: level }))).toContain(
        'player.nodeLevels.fire_basic_hoa_tu_diem',
      )
    }
    // capstone maxLevel 1
    expect(paths(withLevels({ fire_basic_hoa_tu_diem: 2 }))).toContain(
      'player.nodeLevels.fire_basic_hoa_tu_diem',
    )
  })

  it('accepts legitimate levels on the same nodes', () => {
    const result = validateGameSaveShape(
      withLevels({ the_thuc_tinh: 1, tinh_thong_hoa: 2, fire_basic_hoa_tu_diem: 1 }),
    )
    expect(result.issues.filter((issue) => issue.path.startsWith('player.nodeLevels'))).toEqual([])
  })

  it('catalog-removed ids keep tolerated leniency but inject no stats surface', () => {
    // unregistered ids remain allowed (forward/removed-catalog compat);
    // assert the value is a dead key - nothing reads unregistered ids.
    const result = validateGameSaveShape(withLevels({ ghost_node_xyz: 999 }))
    expect(result.issues.filter((issue) => issue.path === 'player.nodeLevels.ghost_node_xyz')).toEqual([])
  })
})
