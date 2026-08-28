import { describe, expect, it } from 'vitest'
import { resolveFoundation } from './FoundationResolver'
import { MaterialBag } from '../material/MaterialBag'
import { PillBag } from '../pill/PillBag'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'

function playerAt(realmLevel: number): PlayerData {
  return { ...createDefaultPlayer(), realmId: 'qi_refining', realmLevel }
}

describe('resolveFoundation (baseline 2026-08-27)', () => {
  it('luôn trả Nhân Đạo ở mốc hiện tại; các cấp đột phá ẩn chưa mở', () => {
    for (const realmLevel of [1, 9, 11, 12, 18]) {
      expect(resolveFoundation(playerAt(realmLevel), new MaterialBag(), new PillBag(), 20)).toBe('human')
    }
  })
})
