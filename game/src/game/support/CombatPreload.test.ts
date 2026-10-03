// P2 cleanup (dong-fu plan) - queueCombatAssets khong duoc queue trung
// mot texture key trong cung luot goi: `textures.exists()` khong nhan
// biet key moi chi duoc queue, va cac Player profile dung trung key
// (sword = mortal combat key; cultivate key chung 3 profile).
import { describe, expect, it } from 'vitest'
import { PLAYER_TEXTURE_KEY, PLAYER_TEXTURE_URL, queueCombatAssets } from './CombatPreload'

describe('CombatPreload.queueCombatAssets — dedupe theo texture key', () => {
  it('queues the reskin-matched pham_nhan static for the Mortal fallback texture', () => {
    const queued = new Map<string, string>()

    const fakeScene = {
      textures: { exists: () => false },

      load: {
        image(key: string, url: string) {
          queued.set(key, url)
        },
        // Task 9 (2026-09-05) - queueCombatAssets gio CUNG load atlas
        // placeholder cho tung entity; stub no-op de khong throw.
        atlas() {},
      },
    } as never

    queueCombatAssets(fakeScene)

    expect(PLAYER_TEXTURE_URL).toBe(
      'assets/characters/player/mortal/player-mortal-pham-nhan-v1.png',
    )
    expect(queued.get(PLAYER_TEXTURE_KEY)).toBe(PLAYER_TEXTURE_URL)
  })

  it('mỗi texture key chỉ được queue ĐÚNG MỘT lần trong cùng lượt gọi', () => {
    const queued: string[] = []

    const fakeScene = {
      textures: { exists: () => false },

      load: {
        image(key: string, _url: string) {
          queued.push(key)
        },
        atlas() {},
      },
    } as never

    queueCombatAssets(fakeScene)

    const unique = new Set(queued)

    expect(queued.length).toBe(unique.size)
  })

  it('textures.exists trả true → không queue lại lần hai', () => {
    const queued: string[] = []

    const fakeScene = {
      textures: { exists: () => true },

      load: {
        image(key: string) {
          queued.push(key)
        },
      },
    } as never

    queueCombatAssets(fakeScene)

    expect(queued).toHaveLength(0)
  })
})
