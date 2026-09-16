import { describe, expect, it } from 'vitest'

import {
  BATTLE_CYCLE_POLICIES,
  BATTLE_CYCLE_RESET_FIELDS,
  FRESH_BATTLE_RESET,
} from './BattleCyclePolicy'

describe('BattleCyclePolicy', () => {
  it('repeat resets the full fresh-battle field set (locked spec C1 decision)', () => {
    // A future "carry" edit must fail loudly here.
    expect(BATTLE_CYCLE_POLICIES.repeat.reset).toEqual(FRESH_BATTLE_RESET)
    for (const field of BATTLE_CYCLE_RESET_FIELDS) {
      expect(BATTLE_CYCLE_POLICIES.repeat.reset.has(field)).toBe(true)
    }
  })

  it('repeat is the only kind that enters fighting with stage binding + loot preserved', () => {
    for (const policy of Object.values(BATTLE_CYCLE_POLICIES)) {
      if (policy.kind === 'repeat') {
        expect(policy.entryState).toBe('fighting')
        expect(policy.preserveStageBinding).toBe(true)
        expect(policy.preserveLootSession).toBe(true)
      } else {
        expect(policy.preserveStageBinding).toBe(false)
        expect(policy.preserveLootSession).toBe(false)
      }
    }
    // 'test' also enters fighting (devtools battles skip countdown) but
    // preserves nothing.
    expect(BATTLE_CYCLE_POLICIES.test.entryState).toBe('fighting')
    expect(BATTLE_CYCLE_POLICIES.fresh.entryState).toBe('intro')
    expect(BATTLE_CYCLE_POLICIES.stage.entryState).toBe('intro')
  })

  it('every policy reset set is a subset of BATTLE_CYCLE_RESET_FIELDS (typo guard)', () => {
    const known = new Set<string>(BATTLE_CYCLE_RESET_FIELDS)
    for (const policy of Object.values(BATTLE_CYCLE_POLICIES)) {
      for (const field of policy.reset) {
        expect(known.has(field)).toBe(true)
      }
    }
  })
})
