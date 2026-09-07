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

  it('INV-WST-4: mutual exclusion with consistent data (spawnedCount < total iff waves remain), never spawns when complete', () => {    // Turn-Based Wave model: spawnedCount increments per waveIndex (sum of waves[0..i]).
    // spawnedCount < total iff waveIndex < waveCount — the two conditions cannot both
    // be true when data is consistent (invariant: sum(waves) === totalEnemyCount).
    const waves = [3, 2]
    const total = 5

    for (let waveIndex = 0; waveIndex <= waves.length; waveIndex++) {
      const spawned = waves.slice(0, waveIndex).reduce((sum, n) => sum + n, 0)

      for (const alive of [0, 1]) {
        for (const pending of [0, 1]) {
          const spawn = shouldStartNextWave(alive, pending, waveIndex, waves.length)
          const complete = isStageComplete(spawned, total, alive, pending)

          if (spawn) {
            expect(complete).toBe(false)
          }
        }
      }
    }
  })
})
