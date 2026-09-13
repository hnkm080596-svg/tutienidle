// AudioManager — singleton SFX playback via Tone.js synthesis.
//
// Why Tone.js (instead of raw Web Audio API):
//   - Strong synth engines (FMSynth, AMSynth, MetalSynth, MembraneSynth)
//     produce quality cultivation-genre sounds that plain oscillators
//     cannot (gong strikes, wooden bells, ringing with natural tails).
//   - Built-in Filter + Reverb — lowpass cuts harsh harmonics, reverb
//     adds the "ethereal" tail.
//   - 0 asset bundles, 0 external audio files, 0 downloads.
//
// API:
//   - getInstance()       → singleton
//   - unlock()            → calls Tone.start() (autoplay policy); idempotent
//   - play(id)            → plays one sound (per-id cooldown anti-spam)
//   - setEnabled(false)   → mutes everything
//   - setMasterVolume(v)  → 0..1
//
// Bug-fix pass 2026-09-06 (systematic debugging):
//   B1  NoiseSynth.triggerAttackRelease does NOT take a note — signature is
//       (duration, time?, velocity?). Old code passed recipe.note ("16n")
//       as arg 1 → duration shifted wrong. Now split per engine.
//   B2  Reverb needs await .ready (offline IR generation) before the first
//       sound; old code set unlocked synchronously → first sound had no
//       tail. Now unlock() async-chains: start → init → ready.
//   B3  Combat events (hit/damage) fire many times per tick → same sound
//       id stacking into a "noise wall". Now per-id 60ms cooldown.
//   B4  Suspended tab (autoplay policy re-engaged) → play() went silent.
//       Now play() checks ctx.state and resume()s when suspended.
//   B5  initChain failing midway leaked already-created nodes; retry
//       stacked a new chain on top. Now disposes partial chain + full
//       dispose on reset.
//   B6  unlock() failing once blocked retries forever (startInFlight).
//       Now retry is allowed after failure.

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

// Recipe per sound — engine kind + note + duration.
type SynthEngine = 'metal' | 'fm' | 'am' | 'membrane' | 'noise'

interface SoundRecipe {
  engine: SynthEngine
  // Tone.js note notation: "C4", "A3", etc. Ignored for engine 'noise'.
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
  // UI — cultivation-genre gong taps: MetalSynth, low pitch, short decay.
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

  // Toast — cultivation bells: FMSynth with high harmonicity (3-5).
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

  // Battle — horn/fanfare (low bell + long tail)
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
 * Per-id cooldown (ms). Combat events (hit/damage) can fire many times
 * per tick — stacking the same sound makes a "noise wall". 60ms merges
 * same-frame events while keeping distinct hits audible.
 */
const MIN_GAP_MS = 60

type AnySynth = Tone.MetalSynth | Tone.FMSynth | Tone.AMSynth | Tone.MembraneSynth | Tone.NoiseSynth

/**
 * Builds a synth per engine + applies envelope/params. Kept out of the
 * class for readability; identical behavior to the old switch
 * (per-engine default envelopes).
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
  /** 'idle' | 'pending' | 'ready' — unlock() only runs while idle; unlocked ≡ (state==='ready'). */
  private unlockState: 'idle' | 'pending' | 'ready' = 'idle'

  private synthCache = new Map<SoundId, AnySynth>()
  private lastPlayAt = new Map<SoundId, number>()

  // Tone chain: synth → reverb → lowpass → master → destination
  private master: Tone.Gain | null = null
  private lowpass: Tone.Filter | null = null
  private reverb: Tone.Reverb | null = null

  /**
   * Generation counter — incremented on every dispose(). unlock()'s async
   * continuation compares the generation captured at start vs after await:
   * a mismatch means the instance was disposed mid-flight → the chain just
   * built is GARBAGE, dispose it immediately and do NOT set 'ready'
   * (dispose-vs-pending-unlock race guard).
   */
  private generation = 0

  isUnlocked(): boolean {
    return this.unlockState === 'ready'
  }

  /**
   * Calls Tone.start() to satisfy the autoplay policy. MUST be called
   * inside a user gesture (e.g. first button click). Idempotent while
   * pending/ready; retry allowed after failure.
   */
  unlock(): void {
    if (this.unlockState !== 'idle') return

    const gen = this.generation
    this.unlockState = 'pending'
    void Tone.start().then(
      async () => {
        try {
          await this.buildChain()
          // Race guard: if dispose() ran while buildChain awaited (gen
          // bumped), the chain just built is GARBAGE — dispose now, do NOT
          // set 'ready' on a dead instance.
          if (this.generation !== gen) {
            this.disposeChain()
            return
          }
          this.unlockState = 'ready'
        } catch {
          // B5: dispose the partial chain (e.g. Reverb threw after
          // Gain+Filter were created) — no leaked nodes.
          this.disposeChain()
          // B6: back to idle so the user can retry (unless disposed).
          if (this.generation === gen) {
            this.unlockState = 'idle'
          }
        }
      },
      () => {
        // Tone.start() rejected (e.g. no user gesture) — allow retry.
        if (this.generation === gen) {
          this.unlockState = 'idle'
        }
      },
    )
  }

  /**
   * Builds the Gain → Filter → Reverb chain. Each node is assigned to its
   * field right after construction so a later throw still lets
   * disposeChain() clean up the earlier nodes (B5). Awaits Reverb.ready
   * (B2 — offline IR generation).
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
    try { this.reverb?.dispose() } catch { /* already disposed */ }
    try { this.lowpass?.dispose() } catch { /* already disposed */ }
    try { this.master?.dispose() } catch { /* already disposed */ }
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
   * Plays a sound by id. Does not throw when audio is not unlocked or Tone
   * is unavailable (SSR/test environments) — silent no-op.
   */
  play(id: SoundId): void {
    if (!this.enabled) return
    if (this.unlockState !== 'ready') return

    try {
      // B4: suspended tab → resume before playing (no throw on failure).
      const ctx = Tone.getContext()
      if (ctx.state === 'suspended') {
        void ctx.resume()
      }

      // B3: per-id anti-spam cooldown.
      const now = Date.now()
      const last = this.lastPlayAt.get(id) ?? 0
      if (now - last < MIN_GAP_MS) return
      this.lastPlayAt.set(id, now)

      const recipe = SOUND_LIBRARY[id]
      const synth = this.getOrCreateSynth(id, recipe)
      if (!synth) return

      this.triggerSynth(synth, recipe)
    } catch {
      // Tone.js not ready (e.g. no AudioContext in jsdom/test) — silent no-op.
    }
  }

  /**
   * B1: NoiseSynth.triggerAttackRelease signature is (duration, time?,
   * velocity?) — NO note. Monophonic synths (metal/fm/am/membrane) take
   * (note, duration, time?, velocity?). Wrong args shift the duration.
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

    // Route: synth → reverb → lowpass → master → destination
    synth.connect(this.reverb)

    this.synthCache.set(id, synth)
    return synth
  }

  /** Disposes all Tone nodes + caches — called on reset/test teardown. */
  dispose(): void {
    // Bump generation BEFORE cleanup: any pending unlock() sees the gen
    // mismatch in its continuation and self-disposes the garbage chain
    // instead of setting 'ready'.
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