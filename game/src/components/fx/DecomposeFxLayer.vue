<script setup lang="ts">
// Hoa Luyen / Phan Giai dissolve effect layer (owner spec 2026-10-11):
// consumed cells crumble into a shard burst, then light motes arc UP to
// the matching resource chip on the Dong Fu top bar - one stream per
// output family. Same transport as the body-scene pour motes (owner
// ruling 2026-10-10): viewport coordinates, Teleport to body, a shared
// rAF timeline, reduced-motion skip. Mounted once in GameRoot.
import { onBeforeUnmount, ref, watch } from 'vue'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import {
  decomposeFxTint,
  resolveFxChipPoint,
  settleDecomposeFxBurst,
  useDecomposeFxBursts,
  type DecomposeFxBurst,
} from './decomposeFx'

// Crumble debris bursting out of a consumed cell.
interface FxShard {
  key: string
  lifeMs: number
  x0: number
  y0: number
  vx: number
  vy: number
  size: number
  tint: string
  x: number
  y: number
  opacity: number
  scale: number
}

// Light mote on a quadratic arc origin -> chip.
interface FxMote {
  key: string
  departAt: number
  flightMs: number
  x0: number
  y0: number
  cx: number
  cy: number
  x1: number
  y1: number
  size: number
  tint: string
  departed: boolean
  landed: boolean
  x: number
  y: number
  opacity: number
  scale: number
}

// Arrival pulse at the chip when a mote lands.
interface FxFlare {
  key: string
  bornAt: number
  lifeMs: number
  x: number
  y: number
  tint: string
  opacity: number
  scale: number
}

interface FxFlight {
  raf: number
  shards: FxShard[]
  motes: FxMote[]
  flares: FxFlare[]
}

const bursts = useDecomposeFxBursts()

const shards = ref<FxShard[]>([])
const motes = ref<FxMote[]>([])
const flares = ref<FxFlare[]>([])

const flights = new Map<number, FxFlight>()

// immediate: drain bursts queued while the layer was unmounted.
watch(
  bursts,
  (queue) => {
    for (const burst of queue) {
      if (!flights.has(burst.id)) {
        startBurst(burst)
      }
    }
  },
  { immediate: true },
)

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  )
}

function startBurst(burst: DecomposeFxBurst): void {
  if (prefersReducedMotion()) {
    settleDecomposeFxBurst(burst.id)
    return
  }

  const flight: FxFlight = { raf: 0, shards: [], motes: [], flares: [] }
  flights.set(burst.id, flight)

  for (const stream of burst.streams) {
    const tint = decomposeFxTint(stream.materialId)

    // Phase A - the crumble: each consumed cell bursts outward for
    // ~400ms; the bag cell itself already unmounted, so the shards
    // carry the "item broke apart" read.
    for (const origin of stream.origins) {
      for (let i = 0; i < 9; i += 1) {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.05 + Math.random() * 0.13

        flight.shards.push({
          key: `${burst.id}-s-${flight.shards.length}`,
          lifeMs: 340 + Math.random() * 160,
          x0: origin.x,
          y0: origin.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.06,
          size: 2 + Math.random() * 3,
          tint,
          x: origin.x,
          y: origin.y,
          opacity: 1,
          scale: 1,
        })
      }
    }

    // Phase B - the stream: motes depart staggered after the crumble
    // reads and arc UP to the chip (targets resolved live at play
    // time; a missing family chip falls back to the strip corner).
    const target = resolveFxChipPoint(stream.materialId)

    if (target === null) {
      continue
    }

    const count = Math.min(
      80,
      Math.max(14, stream.origins.length * 6 + Math.round(stream.amount / 2)),
    )
    const step = count > 1 ? 300 / (count - 1) : 0

    for (let i = 0; i < count; i += 1) {
      const origin = stream.origins[i % stream.origins.length]!
      const x0 = origin.x + (Math.random() - 0.5) * 10
      const y0 = origin.y + (Math.random() - 0.5) * 10
      const x1 = target.x + (Math.random() - 0.5) * 8
      const y1 = target.y + (Math.random() - 0.5) * 8
      const span = Math.hypot(x1 - x0, y1 - y0) || 1
      const t = 0.3 + Math.random() * 0.4
      const mx = x0 + (x1 - x0) * t
      const my = y0 + (y1 - y0) * t
      const nx = -(y1 - y0) / span
      const ny = (x1 - x0) / span
      const lift = span * (0.15 + Math.random() * 0.15)

      flight.motes.push({
        key: `${burst.id}-m-${i}`,
        departAt: 170 + i * step + Math.random() * 30,
        flightMs: 420 + Math.random() * 170,
        x0,
        y0,
        cx: mx + nx * lift * (Math.random() < 0.5 ? -1 : 1) * 0.5,
        cy: my + ny * lift - span * 0.18,
        x1,
        y1,
        size: 2.4 + Math.random() * 2,
        tint,
        departed: false,
        landed: false,
        x: x0,
        y: y0,
        opacity: 0,
        scale: 1,
      })
    }
  }

  const startedAt = performance.now()
  let flareSeq = 0

  const tick = () => {
    const elapsed = performance.now() - startedAt
    let alive = false

    for (const shard of flight.shards) {
      const t = elapsed / shard.lifeMs

      if (t >= 1) {
        continue
      }

      alive = true
      // Outward burst that decelerates and sinks a touch - the read is
      // "item crumbled", not "item emitted sparks".
      const ease = 1 - 0.5 * t
      shard.x = shard.x0 + shard.vx * elapsed * ease
      shard.y = shard.y0 + shard.vy * elapsed * ease + 16 * t * t
      shard.opacity = 1 - t
      shard.scale = 1 - 0.4 * t
    }

    for (const mote of flight.motes) {
      const t = (elapsed - mote.departAt) / mote.flightMs

      if (t < 0) {
        alive = true
        continue
      }

      mote.departed = true

      if (t >= 1) {
        if (!mote.landed) {
          mote.landed = true
          flight.flares.push({
            key: `${burst.id}-f-${flareSeq}`,
            bornAt: elapsed,
            lifeMs: 260,
            x: mote.x1,
            y: mote.y1,
            tint: mote.tint,
            opacity: 1,
            scale: 1,
          })
          flareSeq += 1
        }

        continue
      }

      alive = true
      const u = 1 - t
      mote.x = u * u * mote.x0 + 2 * u * t * mote.cx + t * t * mote.x1
      mote.y = u * u * mote.y0 + 2 * u * t * mote.cy + t * t * mote.y1
      mote.opacity = Math.min(1, t / 0.15)
      mote.scale = 0.7 + 0.6 * Math.sin(t * Math.PI)
    }

    for (const flare of flight.flares) {
      const t = (elapsed - flare.bornAt) / flare.lifeMs

      if (t >= 1) {
        continue
      }

      alive = true
      flare.opacity = 1 - t
      flare.scale = 0.4 + 2.4 * t
    }

    syncRender()

    if (alive) {
      flight.raf = requestAnimationFrame(tick)
    } else {
      finishBurst(burst.id)
    }
  }

  flight.raf = requestAnimationFrame(tick)
}

function finishBurst(burstId: number): void {
  const flight = flights.get(burstId)

  if (flight !== undefined) {
    if (flight.raf !== 0) {
      cancelAnimationFrame(flight.raf)
    }

    flights.delete(burstId)
  }

  settleDecomposeFxBurst(burstId)
  syncRender()
}

// Render lists flatten every in-flight burst so overlapping confirms
// never hide each other's particles.
function syncRender(): void {
  const active = [...flights.values()]

  shards.value = active.flatMap((flight) => flight.shards).filter((shard) => shard.opacity > 0)
  motes.value = active.flatMap((flight) => flight.motes).filter((mote) => mote.departed && !mote.landed)
  flares.value = active.flatMap((flight) => flight.flares).filter((flare) => flare.opacity > 0)
}

onBeforeUnmount(() => {
  for (const [burstId, flight] of flights) {
    if (flight.raf !== 0) {
      cancelAnimationFrame(flight.raf)
    }

    settleDecomposeFxBurst(burstId)
  }

  flights.clear()
  shards.value = []
  motes.value = []
  flares.value = []
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="shards.length || motes.length || flares.length"
      class="decompose-fx-layer"
      :style="{ zIndex: OVERLAY_LAYERS.decomposeFx }"
      aria-hidden="true"
    >
      <span
        v-for="shard in shards"
        :key="shard.key"
        class="decompose-fx__shard"
        :style="{
          width: `${shard.size}px`,
          height: `${shard.size}px`,
          opacity: shard.opacity,
          background: shard.tint,
          transform: `translate(${shard.x - shard.size / 2}px, ${shard.y - shard.size / 2}px) scale(${shard.scale})`,
        }"
      />
      <span
        v-for="mote in motes"
        :key="mote.key"
        class="decompose-fx__mote"
        :style="{
          width: `${mote.size}px`,
          height: `${mote.size}px`,
          opacity: mote.opacity,
          background: mote.tint,
          boxShadow: `0 0 5px 2px ${mote.tint}, 0 0 12px 4px ${mote.tint}55`,
          transform: `translate(${mote.x - mote.size / 2}px, ${mote.y - mote.size / 2}px) scale(${mote.scale})`,
        }"
      />
      <span
        v-for="flare in flares"
        :key="flare.key"
        class="decompose-fx__flare"
        :style="{
          opacity: flare.opacity,
          borderColor: flare.tint,
          boxShadow: `0 0 8px 2px ${flare.tint}88`,
          transform: `translate(${flare.x - 9}px, ${flare.y - 9}px) scale(${flare.scale})`,
        }"
      />
    </div>
  </Teleport>
</template>

<style scoped>
/* Fixed viewport layer above panels but under blocking modals - the
   confirm modal has already closed when a burst plays. Same recipe as
   the body pour layer: pointer-events none, dots translated per frame. */
.decompose-fx-layer { position:fixed; left:0; top:0; pointer-events:none; }
.decompose-fx__shard { position:absolute; left:0; top:0; border-radius:2px; will-change:transform,opacity; }
.decompose-fx__mote { position:absolute; left:0; top:0; border-radius:50%; will-change:transform,opacity; }
.decompose-fx__flare { position:absolute; left:0; top:0; width:18px; height:18px; border:1.5px solid; border-radius:50%; will-change:transform,opacity; }
</style>
