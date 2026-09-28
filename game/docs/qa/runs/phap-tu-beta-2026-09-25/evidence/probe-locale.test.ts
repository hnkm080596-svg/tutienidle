// QA novel-attack probe (post-COR-A state 621131c5, head 05367f86) -
// locale-key placement regression: F-B5-A1/F-B5-C6/F-INT-A4 root cause
// was roleStrip keys nested under nodeInspector while SkillRoleStrip
// reads panels.skillPath.roleStrip.*. Lives in docs/qa/runs/; run via
// vitest.probe.config.mts.
import { describe, expect, it } from 'vitest'
import vi from '../../../../../src/locales/vi.json'
import en from '../../../../../src/locales/en.json'

function at(root: Record<string, unknown>, dotted: string): unknown {
  let cur: unknown = root
  for (const part of dotted.split('.')) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

const KEYS = ['lockedByRival', 'unlockedByNode'] as const

describe('novel attack: skillPath roleStrip locale keys', () => {
  it.each([{ lang: 'vi', dict: vi }, { lang: 'en', dict: en }])(
    '$lang: roleStrip keys resolve at the path the component reads',
    ({ dict }) => {
      for (const key of KEYS) {
        const value = at(dict as Record<string, unknown>, `panels.skillPath.roleStrip.${key}`)
        expect(typeof value).toBe('string')
        expect(value as string).not.toBe('')
      }
    },
  )

  it.each([{ lang: 'vi', dict: vi }, { lang: 'en', dict: en }])(
    '$lang: the stale nested path no longer carries the keys',
    ({ dict }) => {
      expect(at(dict as Record<string, unknown>, 'panels.skillPath.nodeInspector.roleStrip')).toBeUndefined()
    },
  )
})
