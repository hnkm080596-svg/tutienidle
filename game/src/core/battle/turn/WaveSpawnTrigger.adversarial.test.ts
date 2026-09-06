import { describe, expect, it } from 'vitest'
import { shouldStartNextWave, isStageComplete } from './WaveSpawnTrigger'

// QA adversarial probes (2026-09-04 quick review) — WaveSpawnTrigger.
// Migrated 2026-09-06 (Turn-Based Wave Redesign): shouldSpawnNextEnemy →
// shouldStartNextWave (wave-batch model); isStageComplete gains pendingCount.

describe('WaveSpawnTrigger adversarial (QA probes)', () => {
  it('INV-WST-1: giá trị âm không được hiểu là "sân trống hợp lệ" cho spawn', () => {
    // aliveCount/pendingCount âm là input lỗi (không có caller thật trả âm) —
    // defensive: shouldStartNextWave phải false (không spawn wave mới).
    expect(shouldStartNextWave(-1, 0, 0, 3)).toBe(false)
    expect(shouldStartNextWave(0, -1, 0, 3)).toBe(false)
  })

  it('INV-WST-2: isStageComplete với đầu vào âm — không complete', () => {
    expect(isStageComplete(-1, 5, 0, 0)).toBe(false)
    expect(isStageComplete(5, -1, 0, 0)).toBe(true) // 5 >= -1 — caller lỗi, nhưng hàm vẫn nhất quán (>=)
  })

  it('INV-WST-3: ranh giới waveIndex = waveCount - 1 + sân trống → spawn wave cuối', () => {
    expect(shouldStartNextWave(0, 0, 2, 3)).toBe(true)
    expect(shouldStartNextWave(0, 0, 3, 3)).toBe(false)
  })

  it('INV-WST-4: mutual exclusion — không bao giờ spawn wave mới khi complete', () => {
    // Với mọi trạng thái hợp lệ: nếu shouldStartNextWave true thì
    // isStageComplete phải false (điều kiện aliveCount=0/pending=0 chung,
    // nhưng waveIndex < waveCount vs spawnedCount >= total là 2 miền rời
    // khi dữ liệu nhất quán — sum(waves) === totalEnemyCount).
    for (let waveIndex = 0; waveIndex <= 3; waveIndex++) {
      for (const alive of [0, 1]) {
        for (const pending of [0, 1]) {
          const spawn = shouldStartNextWave(alive, pending, waveIndex, 3)
          const complete = isStageComplete(5, 5, alive, pending)
          if (spawn) {
            expect(complete).toBe(false)
          }
        }
      }
    }
  })
})
