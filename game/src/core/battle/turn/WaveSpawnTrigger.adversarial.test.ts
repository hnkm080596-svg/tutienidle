import { describe, expect, it } from 'vitest'
import { shouldSpawnNextEnemy, isStageComplete } from './WaveSpawnTrigger'

// QA adversarial probes (2026-09-04 quick review) — WaveSpawnTrigger.

describe('WaveSpawnTrigger adversarial (QA probes)', () => {
  it('INV-WST-1: giá trị âm không được hiểu là "sân trống hợp lệ" cho spawn', () => {
    // aliveCount âm là input lỗi (không có caller thật trả âm) — defensive:
    // phải false (không spawn), vì nó không phải 0.
    expect(shouldSpawnNextEnemy(2, 5, -1)).toBe(false)
  })

  it('INV-WST-2: isStageComplete với đầu vào âm — không complete', () => {
    expect(isStageComplete(-1, 5, 0)).toBe(false)
    expect(isStageComplete(5, -1, 0)).toBe(true) // 5 >= -1 — caller lỗi, nhưng hàm vẫn nhất quán (>=)
  })

  it('INV-WST-3: ranh giới spawnedCount = totalEnemyCount - 1 + sân trống → spawn', () => {
    expect(shouldSpawnNextEnemy(4, 5, 0)).toBe(true)
    expect(shouldSpawnNextEnemy(5, 5, 0)).toBe(false)
  })

  it('INV-WST-4: mutual exclusion — không bao giờ spawn khi complete', () => {
    // Với mọi trạng thái hợp lệ: nếu shouldSpawnNextEnemy true thì
    // isStageComplete phải false và ngược lại (aliveCount=0 chung).
    for (let spawned = 0; spawned <= 6; spawned++) {
      for (const alive of [0, 1, 2]) {
        const spawn = shouldSpawnNextEnemy(spawned, 5, alive)
        const complete = isStageComplete(spawned, 5, alive)
        if (spawn) {
          expect(complete).toBe(false)
        }
      }
    }
  })
})
