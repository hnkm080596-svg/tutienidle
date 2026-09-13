/**
 * R14.4 guard (combat turn mechanism contract) — the invariants the
 * 2026-09-10 combat specs settled, now enforceable since the branch
 * merged (5718137e). Protects the regression classes each spec AC named.
 *
 * Sources of authority:
 * - docs/superpowers/specs/2026-09-10-combat-turn-mechanism-design.md
 *   (turn token, pipeline, external command boundary, section 9)
 * - docs/superpowers/specs/2026-09-10-combat-realtime-turn-authority-design.md
 *   (two-clock separation AC-8, freeze classification AC-11, pause
 *   implementation AC-9b)
 * - docs/qa/2026-09-10-combat-turn-mechanism.md Task 9 finding:
 *   onBattleStart must clear the countdown telegraph handle map (the
 *   cross-system invariant previously "enforced nowhere").
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()

describe('R14.4 — combat two-clock separation (AC-8)', () => {
  it('no call path passes a delta, timestamp or step count from GameClock into CombatClock', { timeout: SCAN_TIMEOUT }, () => {
    // CombatClock consumes time ONLY through its injected ClockSource; its
    // module must not import or reference the world clock.
    const combatClock = readTs(join(GAME_ROOT, 'src/core/battle/turn/CombatClock.ts'))
    expect(combatClock.includes('GameClock')).toBe(false)

    // The world-clock module must not import CombatClock either (both
    // directions of the share are forbidden).
    const gameClock = readTs(join(GAME_ROOT, 'src/core/idle/GameClock.ts'))
    expect(gameClock.includes('CombatClock')).toBe(false)
  })

  it('CombatClock names its freeze reasons and nothing else - no actors, pipelines or gauges (AC-7c)', () => {
    // Comment-blind (same discipline as statProvenanceAndQueryPurity):
    // the freeze-reason DOC mentions "token" in prose; AC-7c bans rules,
    // not documentation of who supplies a reason.
    const raw = readTs(join(GAME_ROOT, 'src/core/battle/turn/CombatClock.ts'))
    const codeOnly = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    for (const banned of ['participant', 'pipeline', 'gauge', 'token', 'skill', 'actor']) {
      expect(
        codeOnly.toLowerCase().includes(banned),
        `CombatClock.ts must not reference "${banned}" in code — it owns timing only`,
      ).toBe(false)
    }
  })
})

describe('R14.4 — no freeze implemented by pausing the Phaser scene (AC-9b)', () => {
  it('no production source under src/game/scenes pauses the scene or its animation manager', { timeout: SCAN_TIMEOUT }, () => {
    const banned: { file: string; pattern: RegExp; label: string }[] = [
      { file: 'src/game/scenes/CombatScene.ts', pattern: /scene\.pause\(/, label: 'scene.pause(' },
      { file: 'src/game/scenes/CombatScene.ts', pattern: /anims\.pauseAll\(/, label: 'anims.pauseAll(' },
      { file: 'src/game/scenes/CombatScene.ts', pattern: /anims\.paused\s*=/, label: 'anims.paused =' },
      { file: 'src/game/scenes/TribulationScene.ts', pattern: /scene\.pause\(/, label: 'scene.pause(' },
      { file: 'src/game/scenes/TribulationScene.ts', pattern: /anims\.pauseAll\(/, label: 'anims.pauseAll(' },
    ]
    const offenders: string[] = []
    for (const b of banned) {
      const source = readTs(join(GAME_ROOT, b.file))
      if (b.pattern.test(source)) offenders.push(`${b.file}: ${b.label}`)
    }
    expect(offenders).toEqual([])
  })
})

describe('R14.4 — external command boundary (spec section 9)', () => {
  it('GameManager exposes exactly one external-command entry and drains it at the IDLE boundary', () => {
    const ops = readTs(join(GAME_ROOT, 'src/core/game/GameManagerTurnBattleOps.ts'))
    // The queue exists and is drained only when the token is IDLE.
    expect(ops.includes('boundaryQueue')).toBe(true)
    const drainIdx = ops.indexOf('private drainBoundaryQueueIfIdle')
    expect(drainIdx).toBeGreaterThan(0)
    // The IDLE gate lives inside the private method body (~30 lines).
    const window = ops.slice(drainIdx, drainIdx + 600)
    expect(window.includes("getState() !== 'IDLE'")).toBe(true)
  })
})

describe('R14.4 — CombatScene countdown telegraph handles clear on every battle start (QA Task 9)', () => {
  it('onBattleStart clears turnCountdownSpawnVfxHandles (the "enforced nowhere" invariant)', () => {
    const scene = readTs(join(GAME_ROOT, 'src/game/scenes/CombatScene.ts'))
    // Anchor on the METHOD declaration, not the comment mentions earlier in
    // the file (a line-275 comment also says "onBattleStart()").
    const startIdx = scene.indexOf('\n  onBattleStart()')
    expect(startIdx).toBeGreaterThan(0)
    // Take the method body up to the next method boundary.
    const body = scene.slice(startIdx, startIdx + 6000)
    // The countdown handle map must be destroyed+cleared like the spawn map.
    const clearsCountdown = /turnCountdownSpawnVfxHandles\.clear\(\)/.test(body)
    const destroysHandles = /for\s*\(const handle of this\.turnCountdownSpawnVfxHandles\.values\(\)\)/.test(body)
    expect(
      clearsCountdown && destroysHandles,
      'onBattleStart must destroy and clear turnCountdownSpawnVfxHandles (QA 2026-09-10 Task 9: leak returns if a forced start skips the flush snapshot)',
    ).toBe(true)
  })
})
