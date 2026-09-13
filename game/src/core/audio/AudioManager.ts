// AudioManager — singleton phát SFX bằng Tone.js synthesis.
//
// Lý do dùng Tone.js (thay vì Web Audio API thuần):
//   - Synth engine mạnh (FMSynth, AMSynth, MetalSynth, MembraneSynth) tạo
//     được âm thanh tu-tiên chất lượng cao mà oscillator thuần không làm được
//     (vd. tiếng cồng gõ, chuông gỗ, bell ringing với tail tự nhiên).
//   - Filter + Reverb sẵn — lowpass cắt harmonics chói, reverb tạo "vọng".
//   - 0 asset bundle, 0 file âm thanh bên ngoài, 0 phụ thuộc bạn phải tải.
//
// API:
//   - getInstance()       → singleton
//   - unlock()            → gọi Tone.start() (autoplay policy); idempotent
//   - play(id)            → phát 1 sound (cooldown per-id chống spam)
//   - setEnabled(false)   → mute toàn bộ
//   - setMasterVolume(v)  → 0..1
//
// Bug-fix pass 2026-09-06 (P15 systematic debugging):
//   B1  NoiseSynth.triggerAttackRelease KHÔNG nhận note — signature là
//       (duration, time?, velocity?). Code cũ truyền recipe.note ("16n")
//       làm arg 1 → duration bị shift sai. Nay tách theo engine.
//   B2  Reverb cần await .ready (offline IR generation) trước khi phát
//       tiếng đầu tiên; code cũ set unlocked đồng bộ → sound đầu tiên
//       không có tail. Nay unlock() async-chain: start → init → ready.
//   B3  Combat events (hit/damage) bắn nhiều lần mỗi tick → cùng sound
//       id phát chồng gây "noise wall". Nay cooldown per-id 60ms.
//   B4  Tab bị suspend (autoplay policy re-engage) → play() im lặng.
//       Nay play() kiểm tra ctx.state và resume() nếu suspended.
//   B5  initChain fail giữa chừng leak node đã tạo; retry tạo chain mới
//       chồng lên. Nay dispose partial chain + dispose toàn bộ ở reset.
//   B6  unlock() fail rồi gọi lại bị chặn vĩnh viễn (startInFlight).
//       Nay retry được sau khi fail.

import * as Tone from 'tone'

export type SoundId =
  | 'uiClick'
  | 'uiConfirm'
  | 'uiCancel'
  | 'toastLoot'
  | 'toastCraft'
  | 'toastUpgrade'
  | 'toastError'
  | 'toastWarning'
  | 'toastSave'
  | 'combatAttack'
  | 'combatHit'
  | 'combatCritical'
  | 'combatDodge'
  | 'combatBlock'
  | 'combatKill'
  | 'battleStart'
  | 'battleVictory'
  | 'battleDefeat'

// Công thức cho mỗi sound — engine kind + note + duration.
type SynthEngine = 'metal' | 'fm' | 'am' | 'membrane' | 'noise'

interface SoundRecipe {
  engine: SynthEngine
  // note dạng Tone.js notation: "C4", "A3", v.v. Bỏ qua với engine 'noise'.
  note: string
  duration: string // "8n" "16n" "0.05" — Tone.js time notation
  // velocity 0..1 (default 1)
  velocity?: number
  params?: {
    harmonicity?: number
    modulationIndex?: number
    envelope?: {
      attack?: number
      decay?: number
      sustain?: number
      release?: number
    }
  }
}

const SOUND_LIBRARY: Record<SoundId, SoundRecipe> = {
  // UI — tiếng "cồng gõ" tu-tiên: MetalSynth, pitch trầm, decay ngắn.
  uiClick: {
    engine: 'metal',
    note: 'A3',
    duration: '16n',
    velocity: 0.3,
    params: {
      envelope: { attack: 0.001, decay: 0.08, release: 0.1 },
    },
  },
  uiConfirm: {
    engine: 'metal',
    note: 'C4',
    duration: '16n',
    velocity: 0.35,
    params: {
      envelope: { attack: 0.001, decay: 0.1, release: 0.12 },
    },
  },
  uiCancel: {
    engine: 'metal',
    note: 'E3',
    duration: '16n',
    velocity: 0.25,
    params: {
      envelope: { attack: 0.001, decay: 0.06, release: 0.08 },
    },
  },

  // Toast — chuông/bell tu-tiên: FMSynth harmonicity cao (3-5) tạo bell.
  toastLoot: {
    engine: 'fm',
    note: 'E5',
    duration: '8n',
    velocity: 0.4,
    params: { harmonicity: 4, modulationIndex: 8, envelope: { attack: 0.005, decay: 0.2, release: 0.3 } },
  },
  toastCraft: {
    engine: 'fm',
    note: 'C5',
    duration: '8n',
    velocity: 0.35,
    params: { harmonicity: 3, modulationIndex: 6, envelope: { attack: 0.005, decay: 0.2, release: 0.25 } },
  },
  toastUpgrade: {
    engine: 'fm',
    note: 'G5',
    duration: '8n',
    velocity: 0.4,
    params: { harmonicity: 5, modulationIndex: 10, envelope: { attack: 0.005, decay: 0.25, release: 0.35 } },
  },
  toastError: {
    engine: 'noise',
    note: '16n',
    duration: '16n',
    velocity: 0.3,
    params: { envelope: { attack: 0.001, decay: 0.08, release: 0.05 } },
  },
  toastWarning: {
    engine: 'fm',
    note: 'A3',
    duration: '8n',
    velocity: 0.4,
    params: { harmonicity: 2.5, modulationIndex: 4, envelope: { attack: 0.005, decay: 0.15, release: 0.2 } },
  },
  toastSave: {
    engine: 'fm',
    note: 'C4',
    duration: '16n',
    velocity: 0.3,
    params: { harmonicity: 3, modulationIndex: 5, envelope: { attack: 0.005, decay: 0.15, release: 0.2 } },
  },

  // Combat — quick action sounds
  combatAttack: {
    engine: 'noise',
    note: '32n',
    duration: '32n',
    velocity: 0.35,
    params: { envelope: { attack: 0.001, decay: 0.04, release: 0.03 } },
  },
  combatHit: {
    engine: 'metal',
    note: 'G3',
    duration: '32n',
    velocity: 0.5,
    params: {
      envelope: { attack: 0.001, decay: 0.06, release: 0.08 },
    },
  },
  combatCritical: {
    engine: 'metal',
    note: 'C3',
    duration: '16n',
    velocity: 0.7,
    params: {
      envelope: { attack: 0.001, decay: 0.18, release: 0.2 },
    },
  },
  combatDodge: {
    engine: 'fm',
    note: 'G6',
    duration: '32n',
    velocity: 0.25,
    params: { harmonicity: 6, modulationIndex: 4, envelope: { attack: 0.001, decay: 0.06, release: 0.05 } },
  },
  combatBlock: {
    engine: 'metal',
    note: 'D3',
    duration: '32n',
    velocity: 0.45,
    params: {
      envelope: { attack: 0.001, decay: 0.05, release: 0.06 },
    },
  },
  combatKill: {
    engine: 'metal',
    note: 'A2',
    duration: '8n',
    velocity: 0.6,
    params: {
      envelope: { attack: 0.001, decay: 0.2, release: 0.25 },
    },
  },

  // Battle — horn/fanfare (chuông trầm + tail dài)
  battleStart: {
    engine: 'fm',
    note: 'A3',
    duration: '2n',
    velocity: 0.45,
    params: { harmonicity: 2, modulationIndex: 5, envelope: { attack: 0.01, decay: 0.4, release: 0.5 } },
  },
  battleVictory: {
    engine: 'fm',
    note: 'C4',
    duration: '1n',
    velocity: 0.5,
    params: { harmonicity: 3, modulationIndex: 6, envelope: { attack: 0.01, decay: 0.5, release: 0.7 } },
  },
  battleDefeat: {
    engine: 'metal',
    note: 'A2',
    duration: '1n',
    velocity: 0.55,
    params: {
      envelope: { attack: 0.005, decay: 0.5, release: 0.6 },
    },
  },
}

/**
 * Cooldown per-id (ms). Combat events (hit/damage) có thể bắn nhiều lần
 * mỗi tick — phát chồng cùng 1 sound gây "noise wall" khó chịu. 60ms đủ
 * để gộp các event cùng frame mà vẫn nghe rời rạc giữa các đòn đánh.
 */
const MIN_GAP_MS = 60

type AnySynth = Tone.MetalSynth | Tone.FMSynth | Tone.AMSynth | Tone.MembraneSynth | Tone.NoiseSynth

/**
 * Tạo synth theo engine + áp envelope/params. Tách khỏi class để dễ đọc;
 * hành vi giống hệt switch cũ (default envelope khác nhau theo engine).
 */
function createSynth(recipe: SoundRecipe): AnySynth {
  const env = recipe.params?.envelope

  switch (recipe.engine) {
    case 'metal': {
      const synth = new Tone.MetalSynth()
      if (env) {
        synth.envelope.set({
          attack: env.attack ?? 0.001,
          decay: env.decay ?? 0.1,
          release: env.release ?? 0.1,
        })
      }
      return synth
    }
    case 'fm': {
      const synth = new Tone.FMSynth()
      if (recipe.params?.harmonicity !== undefined) {
        synth.harmonicity.value = recipe.params.harmonicity
      }
      if (recipe.params?.modulationIndex !== undefined) {
        synth.modulationIndex.value = recipe.params.modulationIndex
      }
      if (env) {
        synth.envelope.set({
          attack: env.attack ?? 0.01,
          decay: env.decay ?? 0.2,
          sustain: env.sustain ?? 0.2,
          release: env.release ?? 0.3,
        })
      }
      return synth
    }
    case 'am':
      return new Tone.AMSynth()
    case 'membrane':
      return new Tone.MembraneSynth()
    case 'noise': {
      const synth = new Tone.NoiseSynth()
      if (env) {
        synth.envelope.set({
          attack: env.attack ?? 0.001,
          decay: env.decay ?? 0.1,
          sustain: 0,
          release: env.release ?? 0.1,
        })
      }
      return synth
    }
  }
}

class AudioManagerImpl {
  private enabled = true
  private masterVolume = 0.7
  /** 'idle' | 'pending' | 'ready' — unlock() chỉ chạy khi idle; unlocked ≡ (state==='ready'). */
  private unlockState: 'idle' | 'pending' | 'ready' = 'idle'

  private synthCache = new Map<SoundId, AnySynth>()
  private lastPlayAt = new Map<SoundId, number>()

  // Tone chain: synth → reverb → lowpass → master → destination
  private master: Tone.Gain | null = null
  private lowpass: Tone.Filter | null = null
  private reverb: Tone.Reverb | null = null

  /**
   * Generation counter — mỗi lần dispose() tăng lên 1. Callback async của
   * unlock() so sánh gen lúc bắt đầu vs sau await: khác nghĩa là instance
   * đã bị dispose giữa chừng → chain vừa tạo là RÁC, phải dispose ngay
   * và KHÔNG bật 'ready' (chống race dispose-vs-pending-unlock).
   */
  private generation = 0

  isUnlocked(): boolean {
    return this.unlockState === 'ready'
  }

  /**
   * Gọi Tone.start() để vượt autoplay policy. PHẢI được gọi trong user
   * gesture (vd. click button đầu tiên). Idempotent khi pending/ready;
   * retry được nếu lần trước fail.
   */
  unlock(): void {
    if (this.unlockState !== 'idle') return

    const gen = this.generation
    this.unlockState = 'pending'
    void Tone.start().then(
      async () => {
        try {
          await this.buildChain()
          // Race guard: nếu dispose() chạy trong lúc buildChain await
          // (gen tăng), chain vừa tạo là RÁC — dispose ngay, KHÔNG bật
          // 'ready' trên instance đã chết.
          if (this.generation !== gen) {
            this.disposeChain()
            return
          }
          this.unlockState = 'ready'
        } catch {
          // B5: dispose partial chain (vd. Reverb throw sau khi Gain+Filter
          // đã tạo) — không leak node.
          this.disposeChain()
          // B6: về idle để user retry được (chỉ nếu chưa bị dispose).
          if (this.generation === gen) {
            this.unlockState = 'idle'
          }
        }
      },
      () => {
        // Tone.start() reject (vd. không có user gesture) — cho retry.
        if (this.generation === gen) {
          this.unlockState = 'idle'
        }
      },
    )
  }

  /**
   * Tạo chain Gain → Filter → Reverb. Mỗi node được gán vào field NGAY sau
   * khi tạo thành công, nên nếu node sau throw thì disposeChain() vẫn dọn
   * được các node trước (B5). Await Reverb.ready (B2 — offline IR).
   */
  private async buildChain(): Promise<void> {
    const master = new Tone.Gain(this.masterVolume).toDestination()
    this.master = master

    const lowpass = new Tone.Filter(3000, 'lowpass').connect(master)
    this.lowpass = lowpass

    const reverb = new Tone.Reverb({ decay: 2, wet: 0.4 }).connect(lowpass)
    this.reverb = reverb

    await reverb.ready
  }

  private disposeChain(): void {
    // Reverse order: reverb → lowpass → master.
    try { this.reverb?.dispose() } catch { /* đã dispose */ }
    try { this.lowpass?.dispose() } catch { /* đã dispose */ }
    try { this.master?.dispose() } catch { /* đã dispose */ }
    this.reverb = null
    this.lowpass = null
    this.master = null
  }

  setEnabled(value: boolean): void {
    this.enabled = value
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setMasterVolume(value: number): void {
    this.masterVolume = Math.max(0, Math.min(1, value))
    if (this.master) {
      this.master.gain.rampTo(this.masterVolume, 0.05)
    }
  }

  getMasterVolume(): number {
    return this.masterVolume
  }

  /**
   * Phát sound theo id. Không throw nếu sound chưa unlock hoặc Tone chưa sẵn
   * (vd. SSR/test môi trường) — chỉ no-op.
   */
  play(id: SoundId): void {
    if (!this.enabled) return
    if (this.unlockState !== 'ready') return

    try {
      // B4: tab bị suspend → resume trước khi phát (không throw nếu fail).
      const ctx = Tone.getContext()
      if (ctx.state === 'suspended') {
        void ctx.resume()
      }

      // B3: cooldown per-id chống spam.
      const now = Date.now()
      const last = this.lastPlayAt.get(id) ?? 0
      if (now - last < MIN_GAP_MS) return
      this.lastPlayAt.set(id, now)

      const recipe = SOUND_LIBRARY[id]
      const synth = this.getOrCreateSynth(id, recipe)
      if (!synth) return

      this.triggerSynth(synth, recipe)
    } catch {
      // Tone.js chưa sẵn sàng (vd. thiếu AudioContext trong jsdom/test) — silent no-op.
    }
  }

  /**
   * B1: NoiseSynth.triggerAttackRelease có signature (duration, time?,
   * velocity?) — KHÔNG có note. Các synth Monophonic (metal/fm/am/membrane)
   * có (note, duration, time?, velocity?). Truyền sai → duration bị shift.
   */
  private triggerSynth(synth: AnySynth, recipe: SoundRecipe): void {
    const velocity = recipe.velocity ?? 0.5

    if (recipe.engine === 'noise') {
      ;(synth as Tone.NoiseSynth).triggerAttackRelease(
        recipe.duration,
        undefined,
        velocity,
      )
      return
    }

    ;(synth as Tone.MetalSynth).triggerAttackRelease(
      recipe.note,
      recipe.duration,
      undefined,
      velocity,
    )
  }

  private getOrCreateSynth(id: SoundId, recipe: SoundRecipe): AnySynth | null {
    const cached = this.synthCache.get(id)
    if (cached) return cached

    if (!this.reverb) return null

    const synth = createSynth(recipe)

    // Route synth → reverb → lowpass → master → destination
    synth.connect(this.reverb)

    this.synthCache.set(id, synth)
    return synth
  }

  /** Dọn toàn bộ Tone nodes + cache — gọi ở reset/test teardown. */
  dispose(): void {
    // Tăng generation TRƯỚC khi dọn: mọi unlock() pending sẽ thấy gen
    // lệch ở continuation và tự hủy chain rác thay vì bật 'ready'.
    this.generation++
    for (const synth of this.synthCache.values()) {
      synth.dispose()
    }
    this.synthCache.clear()
    this.lastPlayAt.clear()

    this.disposeChain()
    this.unlockState = 'idle'
  }
}

// Singleton + test reset hook.
let instance: AudioManagerImpl | null = null

export const AudioManager = {
  getInstance(): AudioManagerImpl {
    if (!instance) {
      instance = new AudioManagerImpl()
    }
    return instance
  },
}

export function resetAudioManagerForTest(): void {
  instance?.dispose()
  instance = null
}