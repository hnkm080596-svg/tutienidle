// B1.9 - ordered logout: flush through the ONE save queue first; a
// failed flush blocks unless explicitly acknowledged; authService.logout
// carries revoke+signout; the account binding clears; the App-bound
// teardown runs LAST (it unmounts the calling UI).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bindSessionTeardown, requestSessionLogout, unbindSessionTeardown } from './useSessionAccount'
import { bindOnlineAuthority, unbindOnlineAuthority } from './useOnlineAuthority'
import { OnlineSessionController } from '../services/session/OnlineSessionController'
import { authService } from '../services/auth/AuthServiceFactory'
import { resolveSaveAccountId, setSaveAccountId } from '../services/save/saveKeys'
import type { CloudSaveWriteResult } from '../services/cloudSave/CloudSaveService'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
  removeItem(key: string): void { this.store.delete(key) }
  setItem(key: string, value: string): void { this.store.set(key, value) }
}

function makeAuthority(flushSave?: () => Promise<CloudSaveWriteResult>) {
  let handle = 0
  const authority = bindOnlineAuthority(new OnlineSessionController({
    monotonicNow: () => Date.now(),
    scheduleInterval: () => ++handle,
    clearHandle: () => undefined,
    flushSave,
  }))
  // flush() only reaches the save queue from 'ready'.
  authority.beginChecking()
  authority.markReady()
  return authority
}

describe('useSessionAccount - B1.9 ordered logout', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    vi.stubGlobal('sessionStorage', new MemoryStorage())
    vi.restoreAllMocks()
  })

  it('saved flush -> logout -> clear binding -> teardown, in order', async () => {
    const order: string[] = []
    const authority = makeAuthority(async () => { order.push('flush'); return { status: 'ok', revision: 3 } })
    vi.spyOn(authService, 'logout').mockImplementation(async () => {
      order.push('logout')
      return { serverRevoke: 'confirmed', signout: 'confirmed' }
    })
    const teardown = vi.fn(() => { order.push('teardown') })
    bindSessionTeardown(teardown)
    setSaveAccountId('u-guest')

    const result = await requestSessionLogout()

    expect(result.status).toBe('done')
    expect(order).toEqual(['flush', 'logout', 'teardown'])
    // The explicit account binding is cleared; resolver falls to guest.
    expect(resolveSaveAccountId()).toBe('guest')
    unbindOnlineAuthority(authority)
    unbindSessionTeardown(teardown)
  })

  it('a failed flush blocks logout until acknowledgeUnsynced', async () => {
    const authority = makeAuthority(async () => ({ status: 'unavailable', message: 'offline', retryable: false }))
    const logout = vi.spyOn(authService, 'logout').mockResolvedValue({ serverRevoke: 'unconfirmed', signout: 'local-only' })
    const teardown = vi.fn()
    bindSessionTeardown(teardown)

    const blocked = await requestSessionLogout()
    expect(blocked.status).toBe('flush-blocked')
    expect(logout).not.toHaveBeenCalled()
    expect(teardown).not.toHaveBeenCalled()

    const done = await requestSessionLogout({ acknowledgeUnsynced: true })
    expect(done.status).toBe('done')
    expect(logout).toHaveBeenCalledTimes(1)
    unbindOnlineAuthority(authority)
    unbindSessionTeardown(teardown)
  })

  it('a blocked flush (terminal authority) does NOT gate - the state is not saveable', async () => {
    // No flushSave dep -> flush() reports 'blocked' (nothing to write).
    const authority = makeAuthority()
    const logout = vi.spyOn(authService, 'logout').mockResolvedValue({ serverRevoke: 'skipped', signout: 'skipped' })
    const teardown = vi.fn()
    bindSessionTeardown(teardown)

    const result = await requestSessionLogout()

    expect(result.status).toBe('done')
    expect(logout).toHaveBeenCalledTimes(1)
    unbindOnlineAuthority(authority)
    unbindSessionTeardown(teardown)
  })

  it('logout still completes with NO bound teardown or authority (defensive)', async () => {
    const logout = vi.spyOn(authService, 'logout').mockResolvedValue({ serverRevoke: 'skipped', signout: 'skipped' })

    const result = await requestSessionLogout()

    expect(result.status).toBe('done')
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
