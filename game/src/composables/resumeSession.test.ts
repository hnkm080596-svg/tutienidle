import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasExpiredLoginMarker } from './resumeSession'
import {
  clearSupabaseSession,
  storeSupabaseSession,
} from '@/services/supabase/SupabaseSession'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  setItem(key: string, value: string): void { this.store.set(key, value) }
  removeItem(key: string): void { this.store.delete(key) }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
}

beforeEach(() => {
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  vi.stubGlobal('localStorage', new MemoryStorage())
})

describe('F-BX-71 - hasExpiredLoginMarker (session expired surfacing)', () => {
  const loginSession = {
    accessToken: 'tok', refreshToken: 'rt', sessionId: 's1',
    userId: 'u1', mode: 'login' as const, expiresAtMs: Date.now() + 3_600_000,
  }

  it('marker + wiped session (both copies) -> expired login surfaces', () => {
    storeSupabaseSession(loginSession)
    // Simulate the session being wiped everywhere (revoked refresh,
    // cleared storage) while the durable marker survives.
    clearSupabaseSession()
    expect(hasExpiredLoginMarker()).toBe(true)
  })

  it('no marker + no session -> false (genuine first visit)', () => {
    expect(hasExpiredLoginMarker()).toBe(false)
  })

  it('marker + live session -> false (login still active)', () => {
    storeSupabaseSession(loginSession)
    expect(hasExpiredLoginMarker()).toBe(false)
  })

  it('guest session + marker -> false (guest resume is active, not expired)', () => {
    storeSupabaseSession(loginSession)
    clearSupabaseSession()
    storeSupabaseSession({ accessToken: 'g', refreshToken: 'g', sessionId: 'g', userId: 'ug', mode: 'guest' })
    expect(hasExpiredLoginMarker()).toBe(false)
  })
})
