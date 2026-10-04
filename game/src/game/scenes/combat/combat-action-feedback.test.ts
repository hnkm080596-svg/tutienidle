// Regression pin for the turn-ready grow/shrink defect (user report
// 2026-10-04): the ready flourish must never touch sprite.boost - the
// channel CombatGridViewHost multiplies into entity size every frame in
// both render modes. The emphasis lives on the offsetX impulse channel
// and the ack on the scene clock, decoupled so a missing visual can
// never strand the 5-phase machine.
import { describe, expect, it, vi } from 'vitest'

import type { CombatScene } from '../CombatScene'
import { TURN_READY_LEAN_MS, TURN_READY_LEAN_PX } from './combatConstants'
import { CombatActionFeedback } from './combat-action-feedback'
import type { EntitySprite } from './combatTypes'

function makeHarness() {
  const sprite = {
    boost: { value: 1 },
    offsetX: 0,
  } as unknown as EntitySprite

  const ack = vi.fn()
  const delays: number[] = []
  const tweensAdd = vi.fn()

  const scene = {
    gameManagerRef: {
      getPendingPlaybackToken: () => 'tok-1',
      acknowledgeTurnReady: ack,
    },
    spriteFor: (id: string) => (id === 'ghost' ? undefined : sprite),
    playCombatAnimation: vi.fn(),
    playHorizontalImpulse: vi.fn(),
    time: {
      delayedCall: (ms: number, cb: () => void) => {
        delays.push(ms)
        cb()
      },
    },
    tweens: { add: tweensAdd, killTweensOf: vi.fn() },
  } as unknown as CombatScene

  return { scene, sprite, ack, delays, tweensAdd }
}

describe('CombatActionFeedback.onTurnReady', () => {
  it.each(['player', 'enemy_1'])(
    'never tweens sprite.boost at turn start (%s)',
    (actorId) => {
      const h = makeHarness()
      new CombatActionFeedback(h.scene).onTurnReady({ actorId })

      for (const call of h.tweensAdd.mock.calls) {
        expect(call[0]).not.toMatchObject({ targets: h.sprite.boost })
      }
      expect(h.sprite.boost.value).toBe(1)
    },
  )

  it('leans the actor toward the enemy side on the shared impulse channel', () => {
    const h = makeHarness()
    const feedback = new CombatActionFeedback(h.scene)

    feedback.onTurnReady({ actorId: 'player' })
    expect(h.scene.playHorizontalImpulse).toHaveBeenCalledWith(
      h.sprite,
      TURN_READY_LEAN_PX,
      TURN_READY_LEAN_MS,
    )

    feedback.onTurnReady({ actorId: 'enemy_1' })
    expect(h.scene.playHorizontalImpulse).toHaveBeenLastCalledWith(
      h.sprite,
      -TURN_READY_LEAN_PX,
      TURN_READY_LEAN_MS,
    )
  })

  it('acks the ready phase on the same 2 x leg wall-clock beat', () => {
    const h = makeHarness()
    new CombatActionFeedback(h.scene).onTurnReady({ actorId: 'player' })

    expect(h.delays).toEqual([TURN_READY_LEAN_MS * 2])
    expect(h.ack).toHaveBeenCalledWith('tok-1')
  })

  it('acks immediately when the actor has no sprite', () => {
    const h = makeHarness()
    new CombatActionFeedback(h.scene).onTurnReady({ actorId: 'ghost' })

    expect(h.ack).toHaveBeenCalledWith('tok-1')
    expect(h.delays).toEqual([])
  })
})
