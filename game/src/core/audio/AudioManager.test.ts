// AudioManager.test.ts — unit tests cho AudioManager (Tone.js-based).
//
// Mock Tone.js để verify:
//   1. unlock() gọi Tone.start(), chờ Reverb.ready rồi mới bật unlocked.
//   2. play(id) gọi đúng triggerAttackRelease signature theo engine:
//      - Monophonic (metal/fm/am/membrane): (note, duration, time?, velocity?)
//      - NoiseSynth: (duration, time?, velocity?) — KHÔNG có note!
//   3. Cooldown per-id: play cùng id 2 lần sát nhau → chỉ phát 1 lần
//      (chống spam khi combat events bắn nhiều lần mỗi tick).
//   4. Context suspended → play() gọi resume() (tab-switch recovery).
//   5. setEnabled(false) → mute. setMasterVolume clamp [0,1].
//   6. initChain fail giữa chừng → dispose node đã tạo, retry không leak.
//   7. resetAudioManagerForTest() dispose mọi node.

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
    /** getContext() trả lazy singleton — test đổi .state để mô phỏng tab suspend. */
    ctx: null as null | { state: string; resume: ReturnType<typeof vi.fn> },
    /** makeNode() throw khi đã tạo đủ số node này (mô phỏng init fail giữa chừng). */
    failCreateAfter: null as null | number,
    /** Nếu set, Reverb.ready = promise này (test giữ pending để tạo race). */
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
    // function thường (không arrow) để `new X()` hoạt động.
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
  // Drain microtask: Tone.start().then → await reverb.ready → set unlocked.
  await vi.waitFor(() => expect(mgr.isUnlocked()).toBe(true))
  return mgr
}

function triggeredSynths(): MockNode[] {
  return meta.synths.filter((s) => s.triggerAttackRelease.mock.calls.length > 0)
}

describe('AudioManager (Tone.js-based)', () => {
  // ── unlock lifecycle ──────────────────────────────────────────────
  it('unlock() gọi Tone.start() và chỉ bật unlocked sau khi chain sẵn sàng', async () => {
    const mgr = await unlockedManager()
    expect(mgr.isUnlocked()).toBe(true)
    expect(Tone.start).toHaveBeenCalledTimes(1)
  })

  it('unlock() KHÔNG bật unlocked đồng bộ (chờ async chain ready)', () => {
    const mgr = AudioManager.getInstance()
    mgr.unlock()
    expect(mgr.isUnlocked()).toBe(false)
  })

  it('unlock() idempotent — gọi nhiều lần chỉ start 1 lần', async () => {
    const mgr = AudioManager.getInstance()
    mgr.unlock()
    mgr.unlock()
    mgr.unlock()
    await vi.waitFor(() => expect(mgr.isUnlocked()).toBe(true))
    expect(Tone.start).toHaveBeenCalledTimes(1)
  })

  it('unlock() fail (Tone không init được) → unlocked=false, không throw', async () => {
    meta.failCreateAfter = 0 // node đầu tiên throw ngay
    const mgr = AudioManager.getInstance()
    mgr.unlock()
    await vi.waitFor(() => expect(mgr.isUnlocked()).toBe(false))
  })

  it('unlock() fail giữa chừng → dispose node đã tạo (không leak)', async () => {
    meta.failCreateAfter = 2 // Gain + Filter tạo xong, Reverb throw
    const mgr = AudioManager.getInstance()
    mgr.unlock()
    // Chờ async path chạy xong: 2 node partial phải được dispose.
    await vi.waitFor(() => {
      expect(meta.synths[0]!.dispose).toHaveBeenCalled()
      expect(meta.synths[1]!.dispose).toHaveBeenCalled()
    })
    expect(mgr.isUnlocked()).toBe(false)
    expect(meta.synths).toHaveLength(2)
  })

  it('unlock() retry SAU khi fail → tạo chain mới thành công, node cũ đã dispose', async () => {
    meta.failCreateAfter = 2
    const mgr = AudioManager.getInstance()
    mgr.unlock()
    await vi.waitFor(() => {
      expect(meta.synths[0]!.dispose).toHaveBeenCalled()
    })

    meta.failCreateAfter = null
    mgr.unlock()
    await vi.waitFor(() => expect(mgr.isUnlocked()).toBe(true))

    // 2 node của lần fail phải được dispose.
    expect(meta.synths[0]!.dispose).toHaveBeenCalled()
    expect(meta.synths[1]!.dispose).toHaveBeenCalled()
  })

  // ── B1: triggerAttackRelease signature theo engine ────────────────
  it('play(uiClick) [metal] → triggerAttackRelease(note, duration, undefined, velocity)', async () => {
    const mgr = await unlockedManager()

    mgr.play('uiClick')

    const fired = triggeredSynths()
    expect(fired).toHaveLength(1)
    expect(fired[0]!.triggerAttackRelease).toHaveBeenCalledWith('A3', '16n', undefined, 0.3)
  })

  it('play(toastError) [noise] → triggerAttackRelease(duration, undefined, velocity) — KHÔNG có note arg', async () => {
    const mgr = await unlockedManager()

    mgr.play('toastError')

    const fired = triggeredSynths()
    expect(fired).toHaveLength(1)
    // NoiseSynth signature: (duration, time?, velocity?) — arg 1 là DURATION.
    expect(fired[0]!.triggerAttackRelease).toHaveBeenCalledWith('16n', undefined, 0.3)
  })

  it('play(combatAttack) [noise] → cùng signature noise đúng', async () => {
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

  // ── B3: cooldown chống spam ───────────────────────────────────────
  it('play cùng id 2 lần sát nhau → chỉ phát 1 lần (cooldown)', async () => {
    vi.useFakeTimers()
    const mgr = await unlockedManager()

    mgr.play('combatHit')
    mgr.play('combatHit')
    mgr.play('combatHit')

    const fired = triggeredSynths()
    expect(fired).toHaveLength(1)
    expect(fired[0]!.triggerAttackRelease).toHaveBeenCalledTimes(1)
  })

  it('play cùng id sau khi cooldown trôi qua → phát lại', async () => {
    vi.useFakeTimers()
    const mgr = await unlockedManager()

    mgr.play('combatHit')
    vi.advanceTimersByTime(200)
    mgr.play('combatHit')

    const fired = triggeredSynths()
    expect(fired[0]!.triggerAttackRelease).toHaveBeenCalledTimes(2)
  })

  it('play 2 id khác nhau sát nhau → cả 2 đều phát (cooldown per-id)', async () => {
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

  // ── B4: context suspended recovery ────────────────────────────────
  it('play() khi AudioContext suspended → gọi ctx.resume()', async () => {
    const mgr = await unlockedManager()
    // Đảm bảo ctx đã được tạo (play lần 1 gọi getContext).
    mgr.play('uiClick')
    const ctx = meta.ctx!
    ctx.state = 'suspended'
    ctx.resume.mockClear()

    vi.useFakeTimers()
    vi.advanceTimersByTime(200) // vượt cooldown
    mgr.play('combatKill')
    expect(ctx.resume).toHaveBeenCalled()
  })

  // ── mute / volume ─────────────────────────────────────────────────
  it('play() KHÔNG trigger khi setEnabled(false)', async () => {
    const mgr = await unlockedManager()
    mgr.setEnabled(false)

    mgr.play('uiClick')
    expect(triggeredSynths()).toHaveLength(0)
  })

  it('play() KHÔNG trigger khi chưa unlock', () => {
    const mgr = AudioManager.getInstance()
    mgr.play('uiClick')
    expect(triggeredSynths()).toHaveLength(0)
  })

  it('setMasterVolume clamp về [0,1]', async () => {
    const mgr = await unlockedManager()
    mgr.setMasterVolume(1.5)
    expect(mgr.getMasterVolume()).toBe(1)
    mgr.setMasterVolume(-0.3)
    expect(mgr.getMasterVolume()).toBe(0)
    mgr.setMasterVolume(0.5)
    expect(mgr.getMasterVolume()).toBe(0.5)
  })

  it('resetAudioManagerForTest() dispose nodes + reset singleton', async () => {
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

  // ── Race: dispose() trong lúc unlock() đang pending ───────────────
  it('dispose() khi unlock() đang pending → không bật ready, chain dở dang bị dispose', async () => {
    // Giữ Reverb.ready pending để buildChain kẹt ở await — mô phỏng
    // window thời gian giữa "tạo node" và "chain sẵn sàng".
    let releaseReady: () => void = () => {}
    meta.reverbReady = new Promise<void>((resolve) => {
      releaseReady = resolve
    })

    const mgr = AudioManager.getInstance()
    mgr.unlock()
    // buildChain đã tạo Gain + Filter + Reverb (3 node) rồi await ready.
    await vi.waitFor(() => expect(meta.synths.length).toBeGreaterThanOrEqual(3))
    const reverbNode = meta.synths[2]!

    mgr.dispose()
    expect(mgr.isUnlocked()).toBe(false)

    // Release ready → continuation của unlock() resume. Phải FLUSH hết
    // microtask queue để continuation chạy xong rồi mới assert (nếu không,
    // test pass giả vì timing chứ không phải vì code đúng).
    releaseReady()
    await new Promise((r) => setTimeout(r, 0))
    await vi.waitFor(() => expect(reverbNode.dispose).toHaveBeenCalled())

    // Instance đã dispose KHÔNG được bật lại ready khi continuation chạy.
    expect(mgr.isUnlocked()).toBe(false)
  })

  it('Tất cả SoundId play được, không throw', async () => {
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