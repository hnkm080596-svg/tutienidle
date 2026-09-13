// AudioManager.test.ts — unit tests for AudioManager (Tone.js-based).
//
// Tone.js is mocked to verify:
//   1. unlock() calls Tone.start(), awaits Reverb.ready, then sets unlocked.
//   2. play(id) uses the correct triggerAttackRelease signature per engine:
//      - Monophonic (metal/fm/am/membrane): (note, duration, time?, velocity?)
//      - NoiseSynth: (duration, time?, velocity?) — NO note!
//   3. Per-id cooldown: playing the same id twice in quick succession fires
//      once (anti-spam when combat events fire many times per tick).
//   4. Suspended context → play() calls resume() (tab-switch recovery).
//   5. setEnabled(false) → mute. setMasterVolume clamps to [0,1].
//   6. initChain failing midway disposes created nodes; retry does not leak.
//   7. resetAudioManagerForTest() disposes every node.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Tone mock ────────────────────────────────────────────────────────
vi.mock('tone', () => {
  function createSynthFields() {
    return {
      triggerAttackRelease: vi.fn(),
      triggerAttack: vi.fn(),
      triggerRelease: vi.fn(),
      toDestination: vi.fn(function (this: unknown) {
        return this
      }),
      connect: vi.fn(function (this: unknown) {
        return this
      }),
      dispose: vi.fn(function (this: unknown) {
        return this
      }),
      volume: { value: 0, rampTo: vi.fn() },
      gain: { value: 1, rampTo: vi.fn() },
      harmonicity: { value: 1 },
      modulationIndex: { value: 1 },
      oscillator: { type: 'sine' },
      envelope: { attack: 0, decay: 0, release: 0, set: vi.fn() },
      frequency: { value: 1000 },
      Q: { value: 1 },
      type: 'lowpass',
      rolloff: -12,
    }
  }

  const __meta = {
    synths: [] as ReturnType<typeof createSynthFields>[],
    /** getContext() returns a lazy singleton — tests flip .state to simulate a suspended tab. */
    ctx: null as null | { state: string; resume: ReturnType<typeof vi.fn> },
    /** makeNode() throws once this many nodes exist (simulates mid-init failure). */
    failCreateAfter: null as null | number,
    /** When set, Reverb.ready = this promise (tests hold it pending to create a race). */
    reverbReady: null as null | Promise<void>,
  }

  function makeNode() {
    if (__meta.failCreateAfter !== null && __meta.synths.length >= __meta.failCreateAfter) {
      throw new Error('mock node creation failed')
    }
    const node = createSynthFields()
    __meta.synths.push(node)
    return node
  }

  class MockReverb {
    ready: Promise<void>
    constructor(public _opts: unknown) {
      if (__meta.failCreateAfter !== null && __meta.synths.length >= __meta.failCreateAfter) {
        throw new Error('mock node creation failed')
      }
      this.ready = __meta.reverbReady ?? Promise.resolve()
      Object.assign(this, createSynthFields())
      __meta.synths.push(this as unknown as ReturnType<typeof createSynthFields>)
    }
  }

  const Destination = createSynthFields()

  return {
    start: vi.fn(async () => undefined),
    getDestination: vi.fn(() => Destination),
    getContext: vi.fn(function () {
      if (!__meta.ctx) {
        __meta.ctx = { state: 'running', resume: vi.fn(async () => undefined) }
      }
      return __meta.ctx
    }),
    // Plain functions (not arrows) so `new X()` works.
    MetalSynth: vi.fn(function () { return makeNode() }),
    FMSynth: vi.fn(function () { return makeNode() }),
    AMSynth: vi.fn(function () { return makeNode() }),
    Synth: vi.fn(function () { return makeNode() }),
    NoiseSynth: vi.fn(function () { return makeNode() }),
    MembraneSynth: vi.fn(function () { return makeNode() }),
    Reverb: vi.fn(function (opts: unknown) { return new MockReverb(opts) }),
    Gain: vi.fn(function () { return makeNode() }),
    Filter: vi.fn(function () { return makeNode() }),
    Destination,
    __meta,
  }
})

import { AudioManager, resetAudioManagerForTest } from './AudioManager'
import * as Tone from 'tone'

interface MockNode {
  triggerAttackRelease: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}

const meta = (Tone as unknown as {
  __meta: {
    synths: MockNode[]
    ctx: null | { state: string; resume: ReturnType<typeof vi.fn> }
    failCreateAfter: null | number
    reverbReady: null | Promise<void>
  }
}).__meta

beforeEach(() => {
  vi.clearAllMocks()
  meta.synths.length = 0
  meta.ctx = null
  meta.failCreateAfter = null
  meta.reverbReady = null
  resetAudioManagerForTest()
})

afterEach(() => {
  resetAudioManagerForTest()
  vi.useRealTimers()
})

async function unlockedManager() {
  const mgr = AudioManager.getInstance()
  mgr.unlock()
  // Drain microtasks: Tone.start().then → await reverb.ready → set unlocked.
  await vi.waitFor(() => expect(mgr.isUnlocked()).toBe(true))
  return mgr
}

function triggeredSynths(): MockNode[] {
  return meta.synths.filter((s) => s.triggerAttackRelease.mock.calls.length > 0)
}

describe('AudioManager (Tone.js-based)', () => {
  // ── unlock lifecycle ──────────────────────────────────────────────
  it('unlock() calls Tone.start() and only sets unlocked after the chain is ready', async () => {
    const mgr = await unlockedManager()
    expect(mgr.isUnlocked()).toBe(true)
    expect(Tone.start).toHaveBeenCalledTimes(1)
  })

  it('unlock() does NOT set unlocked synchronously (waits for the async chain)', () => {
    const mgr = AudioManager.getInstance()
    mgr.unlock()
    expect(mgr.isUnlocked()).toBe(false)
  })

  it('unlock() is idempotent — repeated calls only start once', async () => {
    const mgr = AudioManager.getInstance()
    mgr.unlock()
    mgr.unlock()
    mgr.unlock()
    await vi.waitFor(() => expect(mgr.isUnlocked()).toBe(true))
    expect(Tone.start).toHaveBeenCalledTimes(1)
  })

  it('unlock() failure (Tone cannot init) → unlocked=false, no throw', async () => {
    meta.failCreateAfter = 0 // first node throws immediately
    const mgr = AudioManager.getInstance()
    mgr.unlock()
    await vi.waitFor(() => expect(mgr.isUnlocked()).toBe(false))
  })

  it('unlock() failing midway → disposes created nodes (no leak)', async () => {
    meta.failCreateAfter = 2 // Gain + Filter created, Reverb throws
    const mgr = AudioManager.getInstance()
    mgr.unlock()
    // Wait for the async path to settle: both partial nodes must be disposed.
    await vi.waitFor(() => {
      expect(meta.synths[0]!.dispose).toHaveBeenCalled()
      expect(meta.synths[1]!.dispose).toHaveBeenCalled()
    })
    expect(mgr.isUnlocked()).toBe(false)
    expect(meta.synths).toHaveLength(2)
  })

  it('unlock() retry AFTER failure → builds a new chain, old nodes disposed', async () => {
    meta.failCreateAfter = 2
    const mgr = AudioManager.getInstance()
    mgr.unlock()
    await vi.waitFor(() => {
      expect(meta.synths[0]!.dispose).toHaveBeenCalled()
    })

    meta.failCreateAfter = null
    mgr.unlock()
    await vi.waitFor(() => expect(mgr.isUnlocked()).toBe(true))

    // The 2 nodes from the failed attempt must be disposed.
    expect(meta.synths[0]!.dispose).toHaveBeenCalled()
    expect(meta.synths[1]!.dispose).toHaveBeenCalled()
  })

  // ── B1: triggerAttackRelease signature per engine ────────────────
  it('play(uiClick) [metal] → triggerAttackRelease(note, duration, undefined, velocity)', async () => {
    const mgr = await unlockedManager()

    mgr.play('uiClick')

    const fired = triggeredSynths()
    expect(fired).toHaveLength(1)
    expect(fired[0]!.triggerAttackRelease).toHaveBeenCalledWith('A3', '16n', undefined, 0.3)
  })

  it('play(toastError) [noise] → triggerAttackRelease(duration, undefined, velocity) — NO note arg', async () => {
    const mgr = await unlockedManager()

    mgr.play('toastError')

    const fired = triggeredSynths()
    expect(fired).toHaveLength(1)
    // NoiseSynth signature: (duration, time?, velocity?) — arg 1 is DURATION.
    expect(fired[0]!.triggerAttackRelease).toHaveBeenCalledWith('16n', undefined, 0.3)
  })

  it('play(combatAttack) [noise] → same correct noise signature', async () => {
    const mgr = await unlockedManager()

    mgr.play('combatAttack')

    const fired = triggeredSynths()
    expect(fired[0]!.triggerAttackRelease).toHaveBeenCalledWith('32n', undefined, 0.35)
  })

  it('play(toastLoot) [fm] → triggerAttackRelease(note, duration, undefined, velocity)', async () => {
    const mgr = await unlockedManager()

    mgr.play('toastLoot')

    const fired = triggeredSynths()
    expect(fired[0]!.triggerAttackRelease).toHaveBeenCalledWith('E5', '8n', undefined, 0.4)
  })

  // ── B3: anti-spam cooldown ───────────────────────────────────────
  it('same id played twice in quick succession → fires once (cooldown)', async () => {
    vi.useFakeTimers()
    const mgr = await unlockedManager()

    mgr.play('combatHit')
    mgr.play('combatHit')
    mgr.play('combatHit')

    const fired = triggeredSynths()
    expect(fired).toHaveLength(1)
    expect(fired[0]!.triggerAttackRelease).toHaveBeenCalledTimes(1)
  })

  it('same id after the cooldown elapses → fires again', async () => {
    vi.useFakeTimers()
    const mgr = await unlockedManager()

    mgr.play('combatHit')
    vi.advanceTimersByTime(200)
    mgr.play('combatHit')

    const fired = triggeredSynths()
    expect(fired[0]!.triggerAttackRelease).toHaveBeenCalledTimes(2)
  })

  it('two different ids in quick succession → both fire (per-id cooldown)', async () => {
    vi.useFakeTimers()
    const mgr = await unlockedManager()

    mgr.play('combatHit')
    mgr.play('combatDodge')

    const totalCalls = meta.synths.reduce(
      (n, s) => n + s.triggerAttackRelease.mock.calls.length,
      0,
    )
    expect(totalCalls).toBe(2)
  })

  // ── B4: suspended-context recovery ────────────────────────────────
  it('play() while AudioContext suspended → calls ctx.resume()', async () => {
    const mgr = await unlockedManager()
    // Ensure the ctx exists (first play calls getContext).
    mgr.play('uiClick')
    const ctx = meta.ctx!
    ctx.state = 'suspended'
    ctx.resume.mockClear()

    vi.useFakeTimers()
    vi.advanceTimersByTime(200) // past the cooldown
    mgr.play('combatKill')
    expect(ctx.resume).toHaveBeenCalled()
  })

  // ── mute / volume ─────────────────────────────────────────────────
  it('play() does NOT trigger while setEnabled(false)', async () => {
    const mgr = await unlockedManager()
    mgr.setEnabled(false)

    mgr.play('uiClick')
    expect(triggeredSynths()).toHaveLength(0)
  })

  it('play() does NOT trigger before unlock', () => {
    const mgr = AudioManager.getInstance()
    mgr.play('uiClick')
    expect(triggeredSynths()).toHaveLength(0)
  })

  it('setMasterVolume clamps to [0,1]', async () => {
    const mgr = await unlockedManager()
    mgr.setMasterVolume(1.5)
    expect(mgr.getMasterVolume()).toBe(1)
    mgr.setMasterVolume(-0.3)
    expect(mgr.getMasterVolume()).toBe(0)
    mgr.setMasterVolume(0.5)
    expect(mgr.getMasterVolume()).toBe(0.5)
  })

  it('resetAudioManagerForTest() disposes nodes + resets the singleton', async () => {
    const mgr = await unlockedManager()
    mgr.play('uiClick')
    const nodes = [...meta.synths]
    expect(nodes.length).toBeGreaterThan(0)

    resetAudioManagerForTest()

    for (const n of nodes) {
      expect(n.dispose).toHaveBeenCalled()
    }
    expect(AudioManager.getInstance().isUnlocked()).toBe(false)
  })

  // ── Race: dispose() while unlock() is pending ───────────────
  it('dispose() during a pending unlock() → never sets ready, partial chain is disposed', async () => {
    // Hold Reverb.ready pending so buildChain stalls at its await —
    // simulating the window between "nodes created" and "chain ready".
    let releaseReady: () => void = () => {}
    meta.reverbReady = new Promise<void>((resolve) => {
      releaseReady = resolve
    })

    const mgr = AudioManager.getInstance()
    mgr.unlock()
    // buildChain has created Gain + Filter + Reverb (3 nodes), now awaiting ready.
    await vi.waitFor(() => expect(meta.synths.length).toBeGreaterThanOrEqual(3))
    const reverbNode = meta.synths[2]!

    mgr.dispose()
    expect(mgr.isUnlocked()).toBe(false)

    // Release ready → unlock()'s continuation resumes. Must FLUSH the
    // microtask queue before asserting (otherwise the test passes on
    // timing, not on correct code).
    releaseReady()
    await new Promise((r) => setTimeout(r, 0))
    await vi.waitFor(() => expect(reverbNode.dispose).toHaveBeenCalled())

    // The disposed instance must NOT flip back to ready when the
    // continuation runs.
    expect(mgr.isUnlocked()).toBe(false)
  })

  it('every SoundId can play without throwing', async () => {
    const mgr = await unlockedManager()

    const ids = [
      'uiClick', 'uiConfirm', 'uiCancel',
      'toastLoot', 'toastCraft', 'toastUpgrade', 'toastError', 'toastWarning', 'toastSave',
      'combatAttack', 'combatHit', 'combatCritical', 'combatDodge', 'combatBlock', 'combatKill',
      'battleStart', 'battleVictory', 'battleDefeat',
    ] as const

    for (const id of ids) {
      expect(() => mgr.play(id)).not.toThrow()
    }
  })
})