import { describe, expect, it, vi } from 'vitest'
import {
  assertGateSeeded,
  GateNotSeededError,
  readOptionalGate,
  readRequiredGate,
  REQUIRED_GATE_KEYS,
  writeGate,
  type GateRegistry,
} from './PresentationGate'

/** A registry with Phaser's shape and none of Phaser. */
function fakeRegistry(seed: Record<string, unknown> = {}): GateRegistry {
  const store = new Map<string, unknown>(Object.entries(seed))

  return {
    get: (key) => store.get(key),
    set: (key, value) => void store.set(key, value),
  }
}

const port = {
  acknowledgeTurnReady: vi.fn(),
  acknowledgeActionImpact: vi.fn(),
  acknowledgeActionComplete: vi.fn(),
  getPendingPlaybackToken: () => null,
}

const bus = { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown as never

describe('presentation gate', () => {
  it('round-trips a value through the registry unchanged', () => {
    const registry = fakeRegistry()

    writeGate(registry, 'gameManager', port)

    expect(readRequiredGate(registry, 'gameManager')).toBe(port)
  })

  it('names the missing key when a required one was never seeded', () => {
    const registry = fakeRegistry()

    expect(() => readRequiredGate(registry, 'eventBus')).toThrow(GateNotSeededError)
    expect(() => readRequiredGate(registry, 'eventBus')).toThrow(/'eventBus'/)
  })

  it('treats a seeded-then-cleared required key as unseeded', () => {
    // `registry.set(key, undefined)` is how the host clears a stale snapshot.
    // A `key in store` check would call that "present" and hand back undefined.
    const registry = fakeRegistry({ eventBus: bus })

    writeGate(registry, 'eventBus', undefined)

    expect(() => readRequiredGate(registry, 'eventBus')).toThrow(GateNotSeededError)
  })

  it('returns undefined for an absent optional key, without throwing', () => {
    const registry = fakeRegistry()

    expect(readOptionalGate(registry, 'sceneAdapter')).toBeUndefined()
    expect(readOptionalGate(registry, 'lastBattlePositionsSnapshot')).toBeUndefined()
  })

  it('normalises a null optional value to undefined', () => {
    const registry = fakeRegistry({ lastBattlePositionsSnapshot: null })

    expect(readOptionalGate(registry, 'lastBattlePositionsSnapshot')).toBeUndefined()
  })

  it('assertGateSeeded passes once every required key is present', () => {
    const registry = fakeRegistry({ gameManager: port, eventBus: bus })

    expect(() => assertGateSeeded(registry)).not.toThrow()
  })

  it('assertGateSeeded fails at the host, naming the key it lacks', () => {
    const registry = fakeRegistry({ gameManager: port })

    expect(() => assertGateSeeded(registry)).toThrow(/'eventBus'/)
  })

  it('the required list is not empty — an empty one would assert nothing', () => {
    expect(REQUIRED_GATE_KEYS.length).toBeGreaterThan(0)
  })
})
