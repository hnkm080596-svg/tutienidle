/**
 * FE-06 / I-MERGE-INTEGRITY - the player nameplate must resolve through the
 * gate's reporting member getActivePlayerName(), not a hardcoded fallback.
 * A mutation dropping the call site was killed by runtime evidence during
 * the pr51 merge gate; this static pin makes the protection durable.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()

describe('player nameplate authority (FE-06)', () => {
  it('PresentationGate exposes the optional getActivePlayerName reporting member', { timeout: SCAN_TIMEOUT }, () => {
    const gate = readTs(join(GAME_ROOT, 'src/presentation/gate/PresentationGate.ts'))
    expect(gate.includes('getActivePlayerName')).toBe(true)
  })

  it('MainScene and CombatScene resolve the nameplate through the gate member', { timeout: SCAN_TIMEOUT }, () => {
    for (const rel of ['src/game/scenes/MainScene.ts', 'src/game/scenes/CombatScene.ts']) {
      const src = readTs(join(GAME_ROOT, rel))
      expect(src.includes('getActivePlayerName?.()'), `${rel} must call the gate name member`).toBe(true)
    }
  })

  it('GameManager owns the reporting member implementation', { timeout: SCAN_TIMEOUT }, () => {
    const src = readTs(join(GAME_ROOT, 'src/core/game/GameManager.ts'))
    expect(src.includes('getActivePlayerName(): string | null')).toBe(true)
  })
})
