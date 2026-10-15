import { expect, it, vi } from 'vitest'
vi.mock('phaser', () => ({ default: { BlendModes: { ADD: 1 }, Math: { Between: () => 0, FloatBetween: (a: number, b: number) => (a+b)/2 } } }))
import { CombatRewardGourd } from './combat-reward-gourd'
it('reward motes follow the live player and do not schedule a gourd pulse', () => {
  let target = { x: 200, y: 300 }
  const position = vi.fn()
  const mote = {
    setBlendMode() { return this }, setDepth() { return this }, setAlpha() { return this },
    setPosition: position, setRotation() { return this }, setScale() { return this }, destroy() {},
  }
  const flights: Array<{ targets: { progress: number }; onUpdate?: () => void }> = []
  const delayedCall = vi.fn()
  const scene = {
    bodyAnchorScreen: () => target,
    resolveRewardSourcePoint: () => ({ x: 10, y: 20 }),
    add: { ellipse: () => mote }, tweens: { add: (config: typeof flights[number]) => flights.push(config) },
    time: { delayedCall },
  }
  const stream = new CombatRewardGourd(scene as never)
  stream.onRewardParticle({ sourceId: 'enemy', kind: 'item', color: 0xffffff } as never)
  expect(flights.length).toBeGreaterThan(0)
  target = { x: 400, y: 500 }
  const flight = flights[0]!
  flight.targets.progress = 1
  flight.onUpdate!()
  expect(position).toHaveBeenLastCalledWith(400, 500)
  expect(delayedCall).not.toHaveBeenCalled()
})
