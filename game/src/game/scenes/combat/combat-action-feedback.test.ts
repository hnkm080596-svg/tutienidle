// Regression pin for the turn-ready grow/shrink defect (user report
// 2026-10-04): the ready flourish must never touch sprite.boost - the
// channel CombatGridViewHost multiplies into entity size every frame in
// both render modes. The emphasis lives on the offsetX impulse channel
// and the ack on the scene clock, decoupled so a missing visual can
// never strand the 5-phase machine.
import { describe, expect, it, vi } from 'vitest'

import type { CombatScene } from '../CombatScene'
import { TURN_READY_LEAN_MS } from './combatConstants'
import { CombatActionFeedback } from './combat-action-feedback'
import type { EntitySprite } from './combatTypes'
import { mountInitiativeView, reportInitiativeTravel } from '@/presentation/combat/CombatInitiativeReady'

function makeHarness() {
  const sprite = {
    boost: { value: 1 },
    offsetX: 0,
  } as unknown as EntitySprite

  const ack = vi.fn()
  const delays: number[] = []
  const tweensAdd = vi.fn()
  const readyPolls: (() => void)[] = []

  const scene = {
    gameManagerRef: {
      getPendingPlaybackToken: () => 'tok-1',
      acknowledgeTurnReady: ack,
    },
    spriteFor: (id: string) => (id === 'ghost' ? undefined : sprite),
    playCombatAnimation: vi.fn(),
    playHorizontalImpulse: vi.fn(),
    showFloatingText: vi.fn(),
    time: {
      addEvent: (event: { callback: () => void }) => { readyPolls.push(event.callback); return { remove: vi.fn() } },
      delayedCall: (ms: number, cb: () => void) => {
        delays.push(ms)
        cb()
      },
    },
    tweens: { add: tweensAdd, killTweensOf: vi.fn() },
    events: { once: vi.fn(), off: vi.fn() },
  } as unknown as CombatScene

  return { scene, sprite, ack, delays, tweensAdd, readyPolls }
}

describe('CombatActionFeedback.onTurnReady', () => {
  it('does not release the ready phase until its visible marker reaches 100', () => {
    const release = mountInitiativeView()
    try {
      const h = makeHarness()
      new CombatActionFeedback(h.scene).onTurnReady({ actorId: 'player' })
      h.readyPolls[0]!()
      expect(h.ack).not.toHaveBeenCalled()
      reportInitiativeTravel('player', 99)
      h.readyPolls[0]!()
      expect(h.ack).not.toHaveBeenCalled()
      reportInitiativeTravel('player', 100)
      h.readyPolls[0]!()
      h.readyPolls[0]!()
      expect(h.ack).toHaveBeenCalledExactlyOnceWith('tok-1')
      expect(h.scene.events.off).toHaveBeenCalled()
    } finally { release() }
  })
  it('does not acknowledge a stale ready request after its session token changes', () => {
    const release = mountInitiativeView()
    try {
      const h = makeHarness()
      new CombatActionFeedback(h.scene).onTurnReady({ actorId: 'player' })
      reportInitiativeTravel('player', 100)
      h.scene.gameManagerRef!.getPendingPlaybackToken = () => 'new-token'
      h.readyPolls[0]!()
      expect(h.ack).not.toHaveBeenCalled()
    } finally { release() }
  })
  it('recoils a companion away from the attacker on a miss and fades its body', () => {
    const h = makeHarness()
    const target = { ...h.sprite, rect: { x: 100 } } as unknown as EntitySprite
    const attacker = { ...h.sprite, rect: { x: 200 } } as unknown as EntitySprite
    const port = h.scene as unknown as { spriteFor: (id?: string) => EntitySprite | undefined }
    port.spriteFor = id => id === 'caster' ? attacker : target
    new CombatActionFeedback(h.scene).onDodge({ sourceId: 'caster', targetId: 'companion' })
    expect(h.scene.playHorizontalImpulse).toHaveBeenCalledWith(target, -18, 130)
    expect(h.tweensAdd).toHaveBeenCalledWith(expect.objectContaining({ targets: target.rect, alpha: .55, yoyo: true }))
  })
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

  it.each(['player', 'enemy_1'])('never adds a procedural step at turn start (%s)', (actorId) => {
    const h = makeHarness()
    new CombatActionFeedback(h.scene).onTurnReady({ actorId })
    expect(h.scene.playHorizontalImpulse).not.toHaveBeenCalled()
    expect(h.sprite.offsetX).toBe(0)
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
