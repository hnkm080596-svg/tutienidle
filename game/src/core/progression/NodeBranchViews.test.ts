import { describe, expect, it } from 'vitest'
import { HIDDEN_BRANCH_TAGS, viewBranchTags } from './NodeBranchViews'
import { ELEMENT_ORDER } from '../element/ElementLabels'

// B1 fix (2026-09-14): NodeTreePanel renders `node.branchTag === viewTag`
// exactly, but PhapTuNodes ships Thuần-chain nodes under `thuan_<element>`
// plus the shared gate under `lap_dao` — 47 nodes unreachable in every
// element view. This module is the single owner for which tags a tree
// view renders (panel + coverage guard both consume it).
describe('viewBranchTags', () => {
  it('element view renders element + shared lap_dao gate + its thuan branch', () => {
    for (const element of ELEMENT_ORDER) {
      expect(viewBranchTags(element)).toEqual([element, 'lap_dao', `thuan_${element}`])
    }
  })

  it('non-element view tags pass through unchanged (kiem_tran/bat_kiem)', () => {
    expect(viewBranchTags('kiem_tran')).toEqual(['kiem_tran'])
    expect(viewBranchTags('bat_kiem')).toEqual(['bat_kiem'])
  })

  it('da_phap is hidden — never rendered by any view', () => {
    expect(HIDDEN_BRANCH_TAGS).toContain('da_phap')
    for (const element of ELEMENT_ORDER) {
      expect(viewBranchTags(element)).not.toContain('da_phap')
    }
    expect(viewBranchTags('da_phap')).toEqual([])
  })
})
