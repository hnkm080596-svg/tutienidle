// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { CombatScene } from './CombatScene'

interface MotionSprite {
  offsetX: number
}

interface TweenConfig {
  targets: MotionSprite
  offsetX: number
  duration: number
  yoyo: boolean
  ease: string
  onComplete?: () => void
}

interface TestableCombatScene {
  sprites: Map<string, MotionSprite>
  interpolations: Map<
    string,
    { fromX: number; toX: number; segmentStart: number; segmentDuration: number }
  >
  time: { now: number }
  tweens: {
    killTweensOf: ReturnType<typeof vi.fn>
    add: ReturnType<typeof vi.fn>
  }
  flashColor: ReturnType<typeof vi.fn>
  onAttack(event: { sourceId?: string }): void
  onHit(event: { targetId?: string }): void
}

function createScene() {
  const scene = Object.create(CombatScene.prototype) as TestableCombatScene
  const player: MotionSprite = { offsetX: 0 }
  const enemy: MotionSprite = { offsetX: 0 }

  scene.sprites = new Map([
    ['player', player],
    ['enemy', enemy],
  ])
  scene.interpolations = new Map()
  scene.time = { now: 0 }
  scene.tweens = {
    killTweensOf: vi.fn(),
    add: vi.fn(),
  }
  scene.flashColor = vi.fn()

  return { scene, player, enemy }
}

function latestTween(scene: TestableCombatScene): TweenConfig {
  const calls = scene.tweens.add.mock.calls

  return calls[calls.length - 1]![0] as TweenConfig
}

describe('CombatScene player motion feedback', () => {
  it('nhich player ve phia truoc mot nhip nho khi ra don', () => {
    const { scene, player } = createScene()

    scene.onAttack({ sourceId: 'player' })

    const tween = latestTween(scene)

    expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(player)
    expect(tween.targets).toBe(player)
    expect(tween.offsetX).toBe(8)
    expect(tween.duration).toBe(350)
    expect(tween.yoyo).toBe(true)

    player.offsetX = 8
    tween.onComplete?.()
    expect(player.offsetX).toBe(0)
  })

  it('day muc tieu lui dung huong mot nhip khi trung don', () => {
    const { scene, player, enemy } = createScene()

    scene.onHit({ targetId: 'player' })
    expect(latestTween(scene).offsetX).toBe(-6)

    scene.onHit({ targetId: 'enemy' })
    expect(latestTween(scene).offsetX).toBe(6)
  })
})
