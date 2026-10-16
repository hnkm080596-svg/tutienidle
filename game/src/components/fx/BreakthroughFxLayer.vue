<script setup lang="ts">
import { prefersReducedMotion } from '@/presentation/motionPreference'
// Minor-floor Dot Pha cinematic (owner spec 2026-10-11): full-screen dim
// + click/key lock -> seated silhouette manifests and trembles -> spirit-
// qi motes stream in from every direction -> qi ring blasts out to cover
// the screen. Resolves at the burst peak so the floor advance commits
// under cover of the flash. Same transport as the decompose layer:
// viewport coordinates, Teleport to body, shared rAF timeline, reduced-
// motion skip. Mounted once in GameRoot.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import {
  setBreakthroughFxLayerMounted,
  settleBreakthroughFxRun,
  useBreakthroughFxRuns,
  type BreakthroughFxRun,
} from './breakthroughFx'

// Spirit-qi mote spiraling into the silhouette along one of five vortex
// arms: polar path, shared spin direction, tight angular jitter per arm
// so the five ribbons stay readable instead of smearing into noise.
interface FxMote {
  key: string
  departAt: number
  flightMs: number
  r0: number
  ang0: number
  spin: number
  size: number
  ang: number
  departed: boolean
  landed: boolean
  x: number
  y: number
  opacity: number
}

interface FxRun {
  raf: number
  motes: FxMote[]
}

// Timeline anchors (ms). Dim covers the whole run; the resolve fires
// while the ring flash still owns the screen.
/* Owner pacing (2026-10-11): gather ~3s then detonate ~3s, ~6.4s total.
   The inhale must read as a build-up, and the blast must linger long
   enough to register as an explosion, not a blink. */
const DIM_IN_MS = 320
const SIL_START_MS = 100
const SIL_IN_MS = 420
const SHAKE_START_MS = 380
const SHAKE_MAX_PX = 11
const MOTE_FIRST_MS = 700
const MOTE_SPAN_MS = 2100
const BURST_MS = 3100
const SIL_FADE_MS = 300
const RESOLVE_MS = 3350
const FADE_OUT_MS = 5600
const END_MS = 6400

const silhouette = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/body/silhouette-seated-v1.png')

/* Preload at setup: translate(-50%,-50%) needs the image's real box -
   a not-yet-decoded image centers on a 0-height box then jumps half its
   height when the bitmap lands (the 'figure snaps upward' report). */
if (typeof Image !== 'undefined') {
  const preload = new Image()
  preload.src = silhouette
}

const runs = useBreakthroughFxRuns()

const dimOpacity = ref(0)
const silOpacity = ref(0)
const silScale = ref(1)
const silDX = ref(0)
const silDY = ref(0)
const shakeX = ref(0)
const shakeY = ref(0)
const glowOpacity = ref(0)
const ringOpacity = ref(0)
const ringScale = ref(0)
const flashOpacity = ref(0)
const motes = ref<FxMote[]>([])
const inputLocked = ref(false)

const flights = new Map<number, FxRun>()
const centers = new Map<number, { x: number; y: number }>()
const resolved = new Set<number>()

// immediate: drain runs queued while the layer was unmounted.
watch(
  runs,
  (queue) => {
    for (const run of queue) {
      if (flights.has(run.id)) continue
      /* One cinematic at a time: concurrent runs each run a tick loop
         writing the same shared refs (silDX/silScale/motes...), which
         reads as the figure flickering between two timelines. Extra
         clicks during the show resolve immediately - the domain commit
         still lands under the current overlay. */
      if (flights.size > 0) {
        run.resolve()
        settleBreakthroughFxRun(run.id)
        continue
      }
      startRun(run)
    }
  },
  { immediate: true },
)



function swallowKey(event: KeyboardEvent): void {
  event.stopPropagation()
  event.preventDefault()
}

function startRun(run: BreakthroughFxRun): void {
  if (prefersReducedMotion()) {
    run.resolve()
    settleBreakthroughFxRun(run.id)
    return
  }

  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  const flight: FxRun = { raf: 0, motes: [] }
  flights.set(run.id, flight)
  centers.set(run.id, { x: cx, y: cy })

  // Spirit qi as an INHALE RING of dotted rays (owner spec): ~46 evenly
  // spaced bearings forming a circle; along each bearing a loose stream
  // of small round orbs converges on the figure - irregular sizes,
  // distances and speeds so no two dots fly alike.
  const SPOKES = 46
  const RING_RADIUS = Math.min(cx, cy) * 0.92

  for (let s = 0; s < SPOKES; s += 1) {
    const spokeAng = (s / SPOKES) * Math.PI * 2 + (Math.random() - 0.5) * 0.06
    /* Streams do NOT all start at once (owner spec): each spoke opens
       its own flow at a random moment across the inhale window. */
    const spokeStart = MOTE_FIRST_MS + Math.random() * 1100
    const orbsPerSpoke = 10 + Math.floor(Math.random() * 5)
    for (let j = 0; j < orbsPerSpoke; j += 1) {
      const ang0 = spokeAng + (Math.random() - 0.5) * 0.05
      const r0 = RING_RADIUS * (0.9 + Math.random() * 0.25)
      const spin = 0

      /* Streams open at staggered moments but ALL land together right
         before the detonation (owner spec): later-starting streams fly
         faster so every orb converges in one shared slam. */
      const departAt = spokeStart + Math.random() * 350
      const landAt = 2850 + Math.random() * 200
      flight.motes.push({
        key: `${run.id}-s${s}-o${j}`,
        departAt,
        flightMs: Math.max(240, landAt - departAt),
        r0,
        ang0,
        spin,
        size: 1.5 + Math.random() * 3.2,
        ang: ang0,
        departed: false,
        landed: false,
        x: cx + r0 * Math.cos(ang0),
        y: cy + r0 * Math.sin(ang0),
        opacity: 0,
      })
    }
  }

  // The overlay owns every input while the inhale builds - once the
  // burst resolves and the growth modal opens, release pointer/key lock.
  inputLocked.value = true
  window.addEventListener('keydown', swallowKey, true)

  const startedAt = performance.now()

  const tick = () => {
    const elapsed = performance.now() - startedAt
    const center = centers.get(run.id) ?? { x: cx, y: cy }
    let alive = false

    // Dim: in fast, held through the burst, out after the flash.
    const dimIn = Math.min(1, elapsed / DIM_IN_MS)
    const dimOut = elapsed <= FADE_OUT_MS ? 1 : Math.max(0, 1 - (elapsed - FADE_OUT_MS) / (END_MS - FADE_OUT_MS))
    /* Fully opaque: at 0.95 the realm card's meditation art still
       bled through and read as a second dark figure hanging off the
       top edge of the screen ('giat len giat xuong' report). */
    dimOpacity.value = dimIn * dimOut

    // Silhouette: manifests, trembles harder as the inhale builds; at the
    // detonation the figure itself blows out - swelling and burning away
    // into the flash instead of fading before the ring arrives.
    if (elapsed < BURST_MS) {
      silOpacity.value = Math.min(1, Math.max(0, (elapsed - SIL_START_MS) / SIL_IN_MS))
      silScale.value = 0.94 + 0.1 * Math.min(1, elapsed / (BURST_MS + SIL_FADE_MS))
    } else {
      const b = Math.min(1, (elapsed - BURST_MS) / 800)
      silOpacity.value = 1 - b * b
      /* Scale continues from the inhale-end 1.03 (no downward snap). */
      silScale.value = 1.03 + b * 0.87
    }
    /* Tremble in place - fast small oscillation, no drift: the figure
       vibrates under incoming qi but never leaves center. The amplitude
       eases out over ~450ms across the detonation instead of cutting to
       zero the frame the kick starts (that hard cut + the random kick
       read as 'jerk then return'). */
    const trembleFade = elapsed < BURST_MS
      ? 1
      : Math.max(0, 1 - (elapsed - BURST_MS) / 450)
    if (elapsed > SHAKE_START_MS && trembleFade > 0) {
      const amp = Math.min(SHAKE_MAX_PX, (elapsed - SHAKE_START_MS) / 240) * trembleFade
      const wob = elapsed * 0.11
      silDX.value = (Math.sin(wob) * 0.65 + Math.sin(wob * 2.7) * 0.35) * amp
      silDY.value = (Math.cos(wob * 1.19) * 0.65 + Math.sin(wob * 2.1) * 0.35) * amp * 0.8
    } else {
      silDX.value = 0
      silDY.value = 0
    }

    /* Screen shake (owner: "shake screen cang tot"): a low rumble while
       the inhale builds, then a hard camera kick at the detonation that
       decays over ~1s. Whole-layer translate shakes the dimmed world. */
    const rumble = elapsed > SHAKE_START_MS && elapsed < BURST_MS
      ? Math.min(7, (elapsed - SHAKE_START_MS) / 380)
      : 0
    const kick = elapsed >= BURST_MS
      ? 22 * Math.max(0, 1 - (elapsed - BURST_MS) / 1100)
      : 0
    const ampS = rumble + kick
    shakeX.value = (Math.random() * 2 - 1) * ampS
    shakeY.value = (Math.random() * 2 - 1) * ampS * 0.8
    glowOpacity.value = silOpacity.value * 0.85

    // Burst: one qi ring blasted to full screen plus a hot core flash.
    // The detonation lingers ~3s: the ring keeps crawling past the frame
    // edge and the core glow smoulders before the dim lifts.
    if (elapsed >= BURST_MS) {
      const r = Math.min(1, (elapsed - BURST_MS) / 1900)
      const ease = 1 - (1 - r) * (1 - r)
      const cover = (Math.hypot(window.innerWidth, window.innerHeight) / 140) * 1.25
      ringScale.value = ease * cover
      ringOpacity.value = r < 0.08 ? r / 0.08 : Math.max(0, 1 - Math.max(0, r - 0.55) / 0.45)
      const f = Math.min(1, (elapsed - BURST_MS) / 160)
      flashOpacity.value = f < 1 ? f * 0.9 : Math.max(0, 0.9 * (1 - (elapsed - BURST_MS - 160) / 1700))
    }

    for (const mote of flight.motes) {
      const mT = (elapsed - mote.departAt) / mote.flightMs

      if (mT < 0) {
        continue
      }

      mote.departed = true

      if (mT >= 1) {
        mote.landed = true
        continue
      }

      alive = true
      const r = mote.r0 * (1 - mT)
      mote.x = center.x + r * Math.cos(mote.ang0)
      mote.y = center.y + r * Math.sin(mote.ang0)
      mote.ang = mote.ang0
      mote.opacity = Math.min(1, mT / 0.12) * (mT > 0.85 ? (1 - mT) / 0.15 : 1)
    }

    motes.value = flight.motes.filter((mote) => mote.departed && !mote.landed && mote.opacity > 0)

    if (elapsed >= RESOLVE_MS && !resolved.has(run.id)) {
      resolved.add(run.id)
      inputLocked.value = false
      window.removeEventListener('keydown', swallowKey, true)
      run.resolve()
    }

    if (elapsed < END_MS) {
      flight.raf = requestAnimationFrame(tick)
    } else {
      finishRun(run.id)
    }
    void alive
    void center
  }

  flight.raf = requestAnimationFrame(tick)
}

function finishRun(runId: number): void {
  const flight = flights.get(runId)

  if (flight !== undefined) {
    if (flight.raf !== 0) {
      cancelAnimationFrame(flight.raf)
    }

    flights.delete(runId)
  }

  centers.delete(runId)
  resolved.delete(runId)
  settleBreakthroughFxRun(runId)

  if (flights.size === 0) {
    inputLocked.value = false
    window.removeEventListener('keydown', swallowKey, true)
    dimOpacity.value = 0
    silOpacity.value = 0
    glowOpacity.value = 0
    ringOpacity.value = 0
    flashOpacity.value = 0
    shakeX.value = 0
    shakeY.value = 0
    motes.value = []
  }
}

/* Mounted flag lives in setup(): Vue HMR re-runs setup on component
   reload without re-firing onMounted, so an edit mid-session would
   strand the flag false and the FX would resolve instantly - the exact
   'single blink' the owner reported. setup() re-runs on every reload. */
setBreakthroughFxLayerMounted(true)
onMounted(() => {
  setBreakthroughFxLayerMounted(true)
})

onBeforeUnmount(() => {
  setBreakthroughFxLayerMounted(false)

  for (const [runId, flight] of flights) {
    if (flight.raf !== 0) {
      cancelAnimationFrame(flight.raf)
    }

    settleBreakthroughFxRun(runId)
  }

  flights.clear()
  centers.clear()
  resolved.clear()
  window.removeEventListener('keydown', swallowKey, true)
  motes.value = []
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="dimOpacity > 0 || motes.length || ringOpacity > 0"
      class="breakthrough-fx-layer"
      :style="{
        zIndex: OVERLAY_LAYERS.breakthroughFx,
        background: `rgba(14, 9, 3, ${dimOpacity})`,
        pointerEvents: inputLocked ? 'auto' : 'none',
      }"
      aria-hidden="true"
    >
      <div
        class="breakthrough-fx__shake"
        :style="{ transform: `translate(${shakeX}px, ${shakeY}px) scale(1.06)` }"
      >
        <div
          class="breakthrough-fx__glow"
          :style="{ opacity: glowOpacity }"
        />
        <span
          v-for="mote in motes"
          :key="mote.key"
          class="breakthrough-fx__mote"
          :style="{
            width: `${mote.size}px`,
            height: `${mote.size}px`,
            opacity: mote.opacity,
            transform: `translate(${mote.x}px, ${mote.y}px) translate(-50%, -50%)`,
          }"
        />
        <div
          v-if="flashOpacity > 0"
          class="breakthrough-fx__flash"
          :style="{ opacity: flashOpacity }"
        />
        <div
          v-if="ringOpacity > 0"
          class="breakthrough-fx__ring"
          :style="{ opacity: ringOpacity, transform: `translate(-50%, -50%) scale(${ringScale})` }"
        />
      </div>
      <!-- The figure sits OUTSIDE the shaken layer: it owns only its own
           tremble (silDX/silDY), the camera rumble/kick stays on the
           world so the two shakes never compound on the silhouette. -->
      <img
        class="breakthrough-fx__silhouette"
        :src="silhouette"
        alt=""
        :style="{
          width: 'min(360px, 40vmin)',
          aspectRatio: '1312 / 1199',
          opacity: silOpacity,
          transform: `translate(-50%, -50%) translate(${silDX}px, ${silDY}px) scale(${silScale})`,
        }"
      />
    </div>
  </Teleport>
</template>

<style scoped>
/* Fixed viewport layer above panels and blocking modals (below the
   authority surfaces by contract): the cinematic locks the whole screen
   so pointer-events stay ON here - every click dies on this layer. */
/* scroll-snap-type:none + children's scroll-snap-align:none: theme.css
   applies `* { scroll-snap-type:y proximity }` / `* > * { scroll-snap-align:start }`
   globally; overflow:hidden makes this layer a scroll container, so every
   tremble frame the browser re-snapped the img toward the container's
   start edge - rect teleported +-400px = the visible 'giat len xuong'. */
.breakthrough-fx-layer { position:fixed; inset:0; pointer-events:auto; overflow:hidden; scroll-snap-type:none; }
.breakthrough-fx-layer * { scroll-snap-align:none; scroll-snap-stop:normal; }
/* Inner wrapper carries the camera shake; the layer itself stays fixed
   so the silhouette (a sibling) is not dragged by rumble/kick jitter. */
.breakthrough-fx__shake { position:absolute; inset:0; will-change:transform; }
.breakthrough-fx__glow, .breakthrough-fx__ring, .breakthrough-fx__flash { will-change:transform,opacity; }
/* Warm qi glow nested behind the silhouette so the figure reads as the
   source of the inhale. */
.breakthrough-fx__glow { position:absolute; left:50%; top:50%; width:56vmin; height:56vmin; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle, #f4d98a66 0%, #f4d98a22 45%, transparent 70%); }
/* No CSS filter here: drop-shadow forces a re-raster of the bitmap on
   every transform write, and Chromium can paint the cached filtered
   snapshot at a stale offset - that was the 'figure teleports upward'
   flicker (rect jumped hundreds of px while layout stayed put). The
   __glow radial already supplies the halo; will-change keeps the img
   on its own stable composited layer for the per-frame tremble. */
.breakthrough-fx__silhouette { position:absolute; left:50%; top:50%; width:min(360px, 40vmin); aspect-ratio:1312/1199; will-change:transform; }
/* Qi motes are round gold orbs (luyen-the 'pour' spec: #eec76c core +
   double soft halo) streaming straight inward along ~46 spoke bearings
   - a dotted inhale ring, irregular sizes and speeds. */
.breakthrough-fx__mote { position:absolute; left:0; top:0; border-radius:50%; background:#eec76c; box-shadow:0 0 5px 2px #eec76c, 0 0 12px 4px #eec76c55; will-change:transform,opacity; }
/* Hot core of the blast - a soft radial flash, not a hard white fill. */
.breakthrough-fx__flash { position:absolute; left:50%; top:50%; width:150vmax; height:150vmax; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle, #fff2c8 0%, #f2d98c55 32%, transparent 68%); }
/* The qi ring itself: thin gold band scaled out until it leaves the
   frame - reads as a shockwave, not a fill. */
.breakthrough-fx__ring { position:absolute; left:50%; top:50%; width:140px; height:140px; border:5px solid #f2d98c; border-radius:50%; box-shadow:0 0 24px 6px #f2d98c88, inset 0 0 18px 4px #f2d98c44; will-change:transform,opacity; }
</style>
