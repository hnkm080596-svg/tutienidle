import { afterEach, describe, expect, it } from 'vitest'
import {
  GUEST_ACCOUNT_ID,
  accountIdForSession,
  resolveSaveAccountId,
  resolveSaveKey,
  resolveRevisionKey,
  setSaveAccountId,
} from './saveKeys'

describe('saveKeys - per-account resolution (spec F8)', () => {
  afterEach(() => setSaveAccountId(null))

  it('no session, no binding -> guest slot', () => {
    expect(resolveSaveAccountId()).toBe(GUEST_ACCOUNT_ID)
    expect(resolveSaveKey()).toBe('tien-hiep-idle-save:guest')
    expect(resolveRevisionKey()).toBe('tien-hiep-idle-save-revision:guest')
  })

  it('explicit binding wins and namespaces every key', () => {
    setSaveAccountId('account-uuid-1')
    expect(resolveSaveKey()).toBe('tien-hiep-idle-save:account-uuid-1')
    setSaveAccountId('account-uuid-2')
    expect(resolveSaveKey()).toBe('tien-hiep-idle-save:account-uuid-2')
  })

  it('guest-mode sessions always resolve to the guest slot', () => {
    expect(accountIdForSession({ mode: 'guest', userId: 'anon-uuid' })).toBe('guest')
  })

  it('login/register sessions resolve to userId, falling back to loginId (mock auth)', () => {
    expect(accountIdForSession({ mode: 'login', userId: 'u-1', loginId: 'dao_huu' })).toBe('u-1')
    expect(accountIdForSession({ mode: 'register', loginId: 'dao_huu' })).toBe('dao_huu')
  })
})
