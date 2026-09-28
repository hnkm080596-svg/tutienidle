// AudioManager - singleton audio engine: Tone.js synth recipes (legacy
// SFX path) + decoded-asset playback through per-channel gain buses
// (sound-system W2).
//
// Routing (spec 2):
//   sfx/ui sources -> channelGain -> reverb -> lowpass -> master -> destination
//   music sources  -> musicGain   ->          lowpass -> master -> destination
// Music bypasses reverb; per-cue duckMusic ramps musicGain down (max-active,
// not summed).
//
// `playCue(cueId)` resolves via AUDIO_CUES: decoded buffer -> Tone.Player;
// else synthFallback recipe; else silent no-op (dev console.debug once/id).
// `playMusic/stopMusic/crossfadeMusic` own a single music Player slot.
// Buffers arrive through attachDecodedBuffer/attachEncodedBuffer - keys are
// manifest `src` strings; encoded data queues until the context exists.
//

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
//   - playCue(id)         -> plays one manifest cue (per-id cooldown anti-spam)
//   - playMusic/stopMusic/crossfadeMusic -> the single music slot
//   - setEnabled(false)   → mutes everything
//   - setMasterVolume(v)  → 0..1
//   - setChannelVolume(ch,v) -> per-bus volume (music/sfx/ui)
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
//   B4  Suspended tab (autoplay policy re-engaged) -> playback went silent.
//       Now playback checks ctx.state and resume()s when suspended.
//   B5  initChain failing midway leaked already-created nodes; retry
//       stacked a new chain on top. Now disposes partial chain + full
//       dispose on reset.
//   B6  unlock() failing once blocked retries forever (startInFlight).
//       Now retry is allowed after failure.

import * as Tone from 'tone'

import {
  AUDIO_CHANNELS,
  DEFAULT_CHANNEL_VOLUMES,
  type AudioChannelId,
} from './AudioChannels'
import { resolveAudioCue, type AudioCueDef, type SynthSoundId } from './AudioCueManifest'

export type { SynthSoundId }

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

export const SOUND_LIBRARY: Record<SynthSoundId, SoundRecipe> = {
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


const DECODE_RETRY_LIMIT = 3

class AudioManagerImpl {
  private enabled = true
  private masterVolume = 0.7
  /** 'idle' | 'pending' | 'ready' — unlock() only runs while idle; unlocked ≡ (state==='ready'). */
  private unlockState: 'idle' | 'pending' | 'ready' = 'idle'

  private synthCache = new Map<string, AnySynth>() // key `${channel}:${id}` - a recipe can back cues on different channels

  // Tone chain: master -> destination; lowpass -> master; reverb -> lowpass.
  // Channel gains: sfx/ui connect to reverb, music connects to lowpass.
  private master: Tone.Gain | null = null
  private lowpass: Tone.Filter | null = null
  private reverb: Tone.Reverb | null = null
  private channelGains: Partial<Record<AudioChannelId, Tone.Gain>> = {}
  private channelVolumes: Record<AudioChannelId, number> = { ...DEFAULT_CHANNEL_VOLUMES }

  // W2 asset path: decoded buffers keyed by manifest src; encoded data
  // queued until a live context exists; active one-shot Player tracking.
  private buffers = new Map<string, AudioBuffer>()
  private pendingEncoded = new Map<string, ArrayBuffer>()
  // Decode attempts per src (counted inside decodeInto, covering the
  // initial decode and every retry) - a failed decode keeps its bytes in
  // pendingEncoded and playCue kicks a bounded retry, so one transient
  // decode failure cannot permanently silence an src.
  private decodeAttempts = new Map<string, number>()
  
  private players = new Set<Tone.Player>()
  private musicPlayer: Tone.Player | null = null
  private desiredMusicId: string | null = null
  private playingMusicId: string | null = null
  private readyListeners = new Set<() => void>()
  private musicSuspended = false
  private cueCooldownAt = new Map<string, number>()
  private variantCursor = new Map<string, number>()
  private silentLogged = new Set<string>()
  private duck = {
    amount: 0,
    until: 0,
    timer: null as ReturnType<typeof setTimeout> | null,
  }

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
   * Registers a callback fired every time the chain becomes ready (the
   * unlock() continuation's tail). If already ready, fires immediately.
   * Returns the unregister function.
   */
  onReady(cb: () => void): () => void {
    this.readyListeners.add(cb)
    if (this.unlockState === 'ready') {
      try { cb() } catch { /* listener must not break callers */ }
    }
    return () => {
      this.readyListeners.delete(cb)
    }
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
          // W2: flush queued encoded buffers + start any music a binding
          // asked for before the context existed (spec W8 desired-music
          // contract).
          this.flushPendingEncoded()
          this.applyDesiredMusic()
          // W4: late-bound consumers (ambient driver's lazy bundle fetch)
          // that gated on isUnlocked() re-fire here.
          for (const cb of this.readyListeners) {
            try { cb() } catch { /* listener must not break unlock */ }
          }
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

    // Channel buses (spec 2): sfx/ui feed reverb; music feeds lowpass
    // directly (bed track stays clean). Assigned to the map right after
    // construction so disposeChain() can clean partial state.
    const sfxGain = new Tone.Gain(this.channelVolumes.sfx).connect(reverb)
    this.channelGains.sfx = sfxGain
    const uiGain = new Tone.Gain(this.channelVolumes.ui).connect(reverb)
    this.channelGains.ui = uiGain
    const musicGain = new Tone.Gain(this.channelVolumes.music).connect(lowpass)
    this.channelGains.music = musicGain
  }

  private disposeChain(): void {
    // Reverse order: channel gains -> reverb -> lowpass -> master.
    for (const ch of AUDIO_CHANNELS) {
      try { this.channelGains[ch]?.dispose() } catch { /* already disposed */ }
      this.channelGains[ch] = undefined
    }
    try { this.reverb?.dispose() } catch { /* already disposed */ }
    try { this.lowpass?.dispose() } catch { /* already disposed */ }
    try { this.master?.dispose() } catch { /* already disposed */ }
    this.reverb = null
    this.lowpass = null
    this.master = null
  }

  /** Per-channel volume 0..1; ramps the bus gain when the chain is live. */
  setChannelVolume(channel: AudioChannelId, value: number): void {
    this.channelVolumes[channel] = Math.max(0, Math.min(1, value))
    if (channel === 'music') {
      this.rampMusicGain()
      return
    }
    this.channelGains[channel]?.gain.rampTo(this.channelVolumes[channel], 0.05)
  }

  getChannelVolume(channel: AudioChannelId): number {
    return this.channelVolumes[channel]
  }

  setEnabled(value: boolean): void {
    this.enabled = value
    if (!value) {
      // Enabled=false silences all three channels: active music suspends but
      // keeps desiredMusicId so re-enabling resumes it (spec 6.3).
      this.suspendMusicPlayback()
    } else {
      this.applyDesiredMusic()
    }
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

  // ---- W2: cue playback -------------------------------------------------

  /**
   * Plays a manifest cue. resolve -> cooldown -> decoded buffer ->
   * synthFallback -> silent no-op (dev console.debug once per id). Never
   * throws; no-ops before unlock or when disabled.
   */
  playCue(id: string): void {
    if (!this.enabled) return
    if (this.unlockState !== 'ready') return

    const def = resolveAudioCue(id)
    if (def === undefined) {
      this.logSilent(id)
      return
    }
    // loop:true / music-channel rows are the music slot's job - a playCue
    // spawn would loop forever, unreachable by stopMusic/suspendMusic.
    if (def.loop === true || def.channel === 'music') {
      this.logSilent(id)
      return
    }

    const now = Date.now()
    const gap = def.cooldownMs ?? MIN_GAP_MS
    const last = this.cueCooldownAt.get(id) ?? 0
    if (now - last < gap) return

    try {
      // B4: suspended tab → resume before playing (no throw on failure).
      const ctx = Tone.getContext()
      if (ctx.state === 'suspended') {
        void ctx.resume()
      }

      const src = this.pickDecodedSrc(id, def.src)
      // Any src with parked bytes (context wasn't ready or a decode
      // failed) gets a bounded retry kick, not only when the whole cue
      // is undecoded - a partially-decoded variant set heals this way.
      const srcs = typeof def.src === 'string' ? (def.src === '' ? [] : [def.src]) : def.src
      for (const s of srcs) this.retryDecode(s)
      if (src !== undefined) {
        this.cueCooldownAt.set(id, now)
        this.spawnPlayer(src, def)
        return
      }
      if (def.synthFallback !== undefined) {
        this.cueCooldownAt.set(id, now)
        const recipe = SOUND_LIBRARY[def.synthFallback]
        const synth = this.getOrCreateSynth(def.channel, def.synthFallback, recipe)
        if (synth) {
          this.triggerSynth(synth, recipe)
          if (def.duckMusic !== undefined) {
            this.applyDuck(def.duckMusic, 600)
          }
        }
        return
      }
      this.logSilent(id)
    } catch {
      // Tone.js not ready - silent no-op.
    }
  }

  /**
   * Dev-mode one-shot debug line per cue id that resolved to nothing
   * playable (empty slot, unknown id). jsdom/Vitest sees the same path.
   */
  private logSilent(id: string): void {
    if (this.silentLogged.has(id)) return
    this.silentLogged.add(id)
    if (import.meta.env.DEV) {
      console.debug(`[audio] silent cue: ${id}`)
    }
  }

  /**
   * Picks a decoded src for a cue. `''` → undefined; string → itself when
   * decoded; string[] → round-robin across the decoded subset.
   */
  private pickDecodedSrc(id: string, src: AudioCueDef['src']): string | undefined {
    if (src === '') return undefined
    if (typeof src === 'string') {
      return this.buffers.has(src) ? src : undefined
    }
    const decoded = src.filter((s) => this.buffers.has(s))
    if (decoded.length === 0) return undefined
    // Start at index 0: the cursor stores the LAST served index, so the
    // first play must advance from -1, not 0 (else index 0 never leads).
    const cursor = (this.variantCursor.get(id) ?? -1) + 1
    this.variantCursor.set(id, cursor)
    return decoded[cursor % decoded.length]
  }

  private spawnPlayer(src: string, def: AudioCueDef): void {
    const gain = this.channelGains[def.channel]
    const buffer = this.buffers.get(src)
    if (!gain || !buffer) return

    const player = new Tone.Player(buffer)
    player.connect(gain)
    player.loop = def.loop ?? false
    if (def.volume !== undefined) {
      player.volume.value = def.volume <= 0 ? -Infinity : 20 * Math.log10(def.volume)
    }
    player.onstop = () => {
      this.players.delete(player)
      try { player.dispose() } catch { /* already disposed */ }
    }
    this.players.add(player)
    try {
      player.start()
    } catch (err) {
      // A start() throw would strand a connected, never-started player in
      // `players` until dispose - detach it now instead.
      this.players.delete(player)
      try { player.dispose() } catch { /* already disposed */ }
      throw err
    }

    if (def.duckMusic !== undefined) {
      this.applyDuck(def.duckMusic, Math.max(50, buffer.duration * 1000))
    }
  }

  // ---- W2: music slot + duck -------------------------------------------

  /** Requests looped music; starts now or once unlocked (desired slot). */
  playMusic(id: string): void {
    this.desiredMusicId = id
    this.pendingMusicFadeSec = 0
    // Suspension is owned only by suspendMusic()/resumeMusic() (tab
    // visibility); a play request while hidden must not un-suspend.
    this.applyDesiredMusic()
  }

  /** Crossfade to a new track: fade out current, fade in next. */
  crossfadeMusic(id: string, fadeMs: number): void {
    if (this.desiredMusicId === id && this.playingMusicId === id) return
    this.desiredMusicId = id
    const fadeSec = Math.max(0.01, fadeMs / 1000)
    this.pendingMusicFadeSec = fadeSec
    if (this.playingMusicId !== null && this.playingMusicId !== id) {
      this.releaseMusicPlayer(fadeMs)
    }
    this.applyDesiredMusic(fadeSec)
  }

  stopMusic(fadeMs = 400): void {
    this.desiredMusicId = null
    this.pendingMusicFadeSec = 0
    this.releaseMusicPlayer(fadeMs)
  }

  /**
   * Fades the music slot out and lets the player's onstop dispose it —
   * disposing immediately would cut the fade. Falls back to immediate
   * dispose when stop() throws (player never started).
   */
  private pendingReapers = new Set<ReturnType<typeof setTimeout>>()

  private releaseMusicPlayer(fadeMs: number): void {
    const old = this.musicPlayer
    this.musicPlayer = null
    this.playingMusicId = null
    if (!old) return
    old.fadeOut = Math.max(0.01, fadeMs / 1000)
    try {
      old.stop(`+${old.fadeOut}`)
      // In a suspended context onstop never fires - force-detach the
      // fading player once its fade window has fully elapsed.
      const reaper = setTimeout(() => {
        this.pendingReapers.delete(reaper)
        if (!this.players.has(old)) return
        this.players.delete(old)
        try { old.dispose() } catch { /* already disposed */ }
      }, fadeMs + 200)
      ;(reaper as unknown as { unref?: () => void }).unref?.()
      this.pendingReapers.add(reaper)
    } catch {
      this.players.delete(old)
      try { old.dispose() } catch { /* already disposed */ }
    }
  }

  /** Visibility pause: stop the player but keep the desired slot. */
  suspendMusic(): void {
    this.musicSuspended = true
    this.suspendMusicPlayback()
  }

  resumeMusic(): void {
    this.musicSuspended = false
    this.applyDesiredMusic()
  }

  private suspendMusicPlayback(): void {
    const old = this.musicPlayer
    if (old) {
      try { old.stop() } catch { /* not started */ }
      this.players.delete(old)
      try { old.dispose() } catch { /* already disposed */ }
    }
    this.musicPlayer = null
    this.playingMusicId = null
  }

  // Fade requested by the latest crossfadeMusic while not yet ready -
  // consumed once a player actually starts so pre-unlock requests still
  // fade in instead of popping (the unlock path passes no arg).
  private pendingMusicFadeSec = 0

  private applyDesiredMusic(fadeSec?: number): void {
    const id = this.desiredMusicId
    if (id === null || id === this.playingMusicId) return
    if (!this.enabled || this.musicSuspended || this.unlockState !== 'ready') return
    const fade = fadeSec ?? this.pendingMusicFadeSec
    const def = resolveAudioCue(id)
    if (def === undefined) return
    const src = this.pickDecodedSrc(id, def.src)
    if (src === undefined) {
      // Music lane gets the same decode-retry kick as playCue - a
      // transient decode failure must not park the track forever.
      const srcs = typeof def.src === 'string' ? (def.src === '' ? [] : [def.src]) : def.src
      for (const s of srcs) this.retryDecode(s)
      this.logSilent(id)
      return
    }
    const gain = this.channelGains.music
    const buffer = this.buffers.get(src)
    if (!gain || !buffer) return
    this.disposeMusicPlayer()
    let player: Tone.Player | undefined
    try {
      player = new Tone.Player(buffer)
      player.connect(gain)
      player.loop = true
      player.fadeIn = fade
      if (def.volume !== undefined) {
        player.volume.value = def.volume <= 0 ? -Infinity : 20 * Math.log10(def.volume)
      }
      const playerRef = player
      playerRef.onstop = () => {
        this.players.delete(playerRef)
        try { playerRef.dispose() } catch { /* already disposed */ }
      }
      this.players.add(playerRef)
      this.musicPlayer = playerRef
      this.playingMusicId = id
      playerRef.start()
      this.pendingMusicFadeSec = 0
    } catch {
      // Same strand guard as spawnPlayer - drop the failed player, then
      // stay silent. No rethrow: applyDesiredMusic runs inside the
      // coordinator's unguarded notify() loop and unlock()'s tail, so a
      // throw here would abort a route commit or roll back all audio.
      if (player) {
        this.players.delete(player)
        try { player.dispose() } catch { /* already disposed */ }
      }
      this.musicPlayer = null
      this.playingMusicId = null
    }
  }

  private disposeMusicPlayer(): void {
    if (this.musicPlayer) {
      this.players.delete(this.musicPlayer)
      try { this.musicPlayer.dispose() } catch { /* already disposed */ }
    }
    this.musicPlayer = null
    this.playingMusicId = null
  }

  /**
   * Ducks the music bus by `amount` (0..1) for `durationMs`. Max-active
   * semantics: a new duck raises/extends the active duck, never sums; the
   * bus restores to channel volume once the last window expires (spec §2).
   */
  applyDuck(amount: number, durationMs: number): void {
    const now = Date.now()
    const a = Math.max(0, Math.min(1, amount))
    const until = now + Math.max(0, durationMs)
    if (this.duck.until > now) {
      this.duck.amount = Math.max(this.duck.amount, a)
      this.duck.until = Math.max(this.duck.until, until)
    } else {
      this.duck.amount = a
      this.duck.until = until
    }
    this.rampMusicGain()
    if (this.duck.timer) clearTimeout(this.duck.timer)
    const delay = this.duck.until - now
    this.duck.timer = setTimeout(() => {
      this.duck.amount = 0
      this.duck.until = 0
      this.duck.timer = null
      this.rampMusicGain()
    }, delay)
  }

  private rampMusicGain(): void {
    const target = this.channelVolumes.music * (1 - this.duck.amount)
    this.channelGains.music?.gain.rampTo(target, 0.05)
  }

  // ---- W2/W4: buffer intake --------------------------------------------

  /** Decoded AudioBuffer for a manifest src key (asset lane hands it over). */
  attachDecodedBuffer(key: string, buffer: AudioBuffer): void {
    this.buffers.set(key, buffer)
  }

  hasDecodedBuffer(key: string): boolean {
    return this.buffers.has(key)
  }

  /**
   * Encoded bytes for a manifest src key. Decodes when a live context
   * exists; queues while not (attach before unlock is the normal path).
   * Never throws / never rejects.
   */
  attachEncodedBuffer(key: string, data: ArrayBuffer): void {
    if (this.unlockState !== 'ready') {
      this.pendingEncoded.set(key, data)
      return
    }
    void this.decodeInto(key, data)
  }

  private flushPendingEncoded(): void {
    if (this.pendingEncoded.size === 0) return
    const pending = [...this.pendingEncoded]
    this.pendingEncoded.clear()
    for (const [key, data] of pending) {
      void this.decodeInto(key, data)
    }
  }

  private async decodeInto(key: string, data: ArrayBuffer): Promise<void> {
    try {
      const ctx = Tone.getContext() as unknown as {
        rawContext?: AudioContext
        decodeAudioData?: (d: ArrayBuffer) => Promise<AudioBuffer>
      }
      const decode =
        typeof ctx.rawContext?.decodeAudioData === 'function'
          ? ctx.rawContext.decodeAudioData.bind(ctx.rawContext)
          : ctx.decodeAudioData?.bind(ctx)
      if (!decode) return
      const buffer = await decode(data)
      this.buffers.set(key, buffer)
      this.decodeAttempts.delete(key)
      // A desired music track may have been waiting on this buffer.
      this.applyDesiredMusic()
    } catch {
      // Decode failure counts here (covers initial + retried decodes):
      // retain the bytes for a bounded play-time retry (retryDecode).
      // Past the limit the slot stays silent - the cue keeps its
      // fallback path either way.
      const attempts = (this.decodeAttempts.get(key) ?? 0) + 1
      this.decodeAttempts.set(key, attempts)
      if (attempts < DECODE_RETRY_LIMIT) {
        this.pendingEncoded.set(key, data)
      }
    }
  }

  private retryDecode(key: string): void {
    const data = this.pendingEncoded.get(key)
    if (data === undefined) return
    this.pendingEncoded.delete(key)
    void this.decodeInto(key, data)
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

  private getOrCreateSynth(channel: AudioChannelId, id: SynthSoundId, recipe: SoundRecipe): AnySynth | null {
    const cacheKey = `${channel}:${id}`
    const cached = this.synthCache.get(cacheKey)
    if (cached) return cached

    const bus = this.channelGains[channel]
    if (!bus) return null

    const synth = createSynth(recipe)

    // Route: synth → channelGain → reverb → lowpass → master → destination
    synth.connect(bus)

    this.synthCache.set(cacheKey, synth)
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

    for (const player of this.players) {
      try { player.stop() } catch { /* not started */ }
      try { player.dispose() } catch { /* already disposed */ }
    }
    this.players.clear()
    this.disposeMusicPlayer()
    this.buffers.clear()
    this.pendingEncoded.clear()
    this.decodeAttempts.clear()
    this.cueCooldownAt.clear()
    this.variantCursor.clear()
    this.silentLogged.clear()
    if (this.duck.timer) {
      clearTimeout(this.duck.timer)
    }
    this.duck.timer = null
    this.duck.amount = 0
    this.duck.until = 0
    for (const t of this.pendingReapers) clearTimeout(t)
    this.pendingReapers.clear()
    this.desiredMusicId = null
    this.playingMusicId = null
    this.musicSuspended = false
    this.readyListeners.clear()

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