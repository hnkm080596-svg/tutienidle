// P2 cleanup (dong-fu plan) — queueCombatAssets không được queue trùng
// một texture key trong cùng lượt gọi: `textures.exists()` không nhận
// biết key mới chỉ được queue, và các Player profile dùng trùng key
// (kiem_tu = mortal combat key; cultivate key chung 3 profile).
import { describe, expect, it } from 'vitest'
import { queueCombatAssets } from './CombatPreload'

describe('CombatPreload.queueCombatAssets — dedupe theo texture key', () => {
  it('mỗi texture key chỉ được queue ĐÚNG MỘT lần trong cùng lượt gọi', () => {
    const queued: string[] = []

    const fakeScene = {
      textures: { exists: () => false },

      load: {
        image(key: string, _url: string) {
          queued.push(key)
        },
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
