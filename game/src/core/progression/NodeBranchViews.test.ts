import { describe, expect, it } from 'vitest'
import { HIDDEN_BRANCH_TAGS, viewBranchTags } from './NodeBranchViews'
import { ELEMENT_ORDER } from '../element/ElementLabels'

// Phap Tu Reimagined (Task 16) — the reworked tree tags nodes by
// elementTag/routeTag, so every view is single-tag: element views
// render `elementTag === view`, Kiem Tu routes render
// `branchTag === view`. The thuan_*/lap_dao family is retired.
describe('viewBranchTags', () => {
  it('element views render exactly the element tag', () => {
    for (const element of ELEMENT_ORDER) {
      expect(viewBranchTags(element)).toEqual([element])
    }
  })

  it('kiem route views pass through unchanged (kiem_tran/bat_kiem)', () => {
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
