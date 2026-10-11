<script setup lang="ts">
import { inject, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import EquipmentArtCard from '@/components/common/art/EquipmentArtCard.vue'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import EquipmentEnergyTube from '@/components/common/art/EquipmentEnergyTube.vue'
import SlotView from '@/components/common/SlotView.vue'
import { GAME_MANAGER_KEY } from '@/composables/useGameState'
import { createMaterialTooltipBuilder } from '@/composables/useMaterialTooltip'
import { formatNumber } from '@/core/format/NumberFormatter'
import { BODY_POUR_VISUAL, type BodyPaperModel, type BodyPaperPour, type BodyPaperUnit } from './bodyUi'

const props = defineProps<{ model: BodyPaperModel; unit: BodyPaperUnit | null; notice: string; pour?: BodyPaperPour | null }>()
const emit = defineEmits<{ invest: [] }>()
const { t } = useI18n()
// Optional inject (owner ruling 2026-10-10): ui-body.html preview has no
// GameManager - the card degrades to id names + no tooltip instead of
// crashing. In-game the manager is always provided.
const gameManager = inject(GAME_MANAGER_KEY, null)
// Shared pour-visual channel (owner ruling 2026-10-10): reports the
// fill's absolute progress so the figure reveals art tier-by-tier
// riding the bar's edge instead of lighting everything at once.
const pourVisual = inject(BODY_POUR_VISUAL, null)

// Material rows follow the Trang Bi standard (owner ruling 2026-10-09):
// icon + owned/need only, the name/info lives in the hover tooltip.
// Same .has() guard as the hall tabs - a missing material must degrade
// to no tooltip, not crash the card.
const MATERIAL_CATEGORY_ART: Record<string, string> = {
  essence: '/assets/ui/tien-hiep-2026-10/controls/resource-essence-v1.png',
  spirit_stone: '/assets/ui/tien-hiep-2026-10/controls/resource-crystal-v1.png',
}

function materialIcon(materialId: string): string | undefined {
  const material = gameManager?.materialRegistry.has(materialId)
    ? gameManager.materialRegistry.get(materialId)
    : undefined
  const art = material?.icon ?? (material?.category ? MATERIAL_CATEGORY_ART[material.category] : undefined)
  return art ? resolveAssetUrl(art) : undefined
}

const buildMaterialTooltip = createMaterialTooltipBuilder(t)

function materialTooltip(materialId: string, owned: number) {
  return gameManager?.materialRegistry.has(materialId)
    ? buildMaterialTooltip(gameManager.materialRegistry.get(materialId), { owned })
    : undefined
}

// Same ren/khai/dan art mapping the scene nav uses.
const NAV_ART: Record<string, string> = { refinement: 'ren', meridian: 'khai', cycle: 'dan' }
const navIcon = resolveAssetUrl(
  `/assets/ui/tien-hiep-2026-10/body/navigation-${NAV_ART[props.model.chapter] ?? 'ren'}-lit-v1.png`,
)

// ---- Pour animation (Rèn Thể manual invest, owner ruling 2026-10-09):
// a stream of gold motes arcs from the material slot to the LEFT END of
// the energy tube on one shared rAF timeline (~600-900ms). The material
// count drains as each mote DEPARTS the slot; the bar fills as each
// mote LANDS - count runs ahead, the bar chases the landing cadence.
// Display-only: the domain debit already committed before the spec
// arrives; the overrides below are cleared when the stream settles.
interface PourMote {
  departAt: number
  flightMs: number
  countDelta: number
  progressUnits: number
  x0: number
  y0: number
  cx: number
  cy: number
  x1: number
  y1: number
  size: number
  departed: boolean
  landed: boolean
  x: number
  y: number
  opacity: number
  scale: number
}

const cardRef = ref<InstanceType<typeof EquipmentArtCard> | null>(null)
const pourHave = ref<number | null>(null)
const pourFill = ref<number | null>(null)
const pourLabel = ref<string | null>(null)
const pourMotes = ref<PourMote[]>([])
let pourRaf = 0
let pourFlight: PourMote[] = []

function clearPourFx() {
  if (pourRaf !== 0) cancelAnimationFrame(pourRaf)
  pourRaf = 0
  pourFlight = []
  pourMotes.value = []
  pourHave.value = null
  pourFill.value = null
  pourLabel.value = null
  if (pourVisual) pourVisual.spec = null
}

onBeforeUnmount(clearPourFx)

watch(
  () => props.pour,
  (spec) => {
    if (spec !== null && spec !== undefined && spec.consumed > 0) startPour(spec)
  },
)

function startPour(spec: BodyPaperPour) {
  clearPourFx()
  if (pourVisual) {
    // Rewind the figure to the click-time state first - the sequential
    // reveal rides progressAbs as the fill advances.
    pourVisual.spec = {
      chapter: props.model.chapter,
      tierStartIndex: spec.tierStartIndex,
      caps: spec.caps,
    }
    pourVisual.progressAbs = spec.tierProgress
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const card = cardRef.value?.$el as HTMLElement | undefined
  const slotEl = card?.querySelector<HTMLElement>('.equipment-material-icon')
  const tubeEl = card?.querySelector<HTMLElement>('.equipment-energy-tube')
  if (card === undefined || !slotEl || !tubeEl) return

  // Viewport coordinates (owner ruling 2026-10-10): the motes render in a
  // layer teleported to document.body - the card's clip-path would swallow
  // the arc's leftward sweep if they stayed inside it.
  const from = slotEl.getBoundingClientRect()
  const to = tubeEl.getBoundingClientRect()
  const x0 = from.left + from.width / 2
  const y0 = from.top + from.height / 2
  const x1 = to.left // điểm đầu của bar (left end)
  const y1 = to.top + to.height / 2
  const span = Math.hypot(x1 - x0, y1 - y0) || 1

  // Fill pacing (owner ruling 2026-10-10): fixed 5s per click, cubic
  // ease-in - the bar crawls at first and accelerates toward the end
  // instead of jumping fast up front.
  const FILL_MS = 5000
  const capAt = (index: number) => spec.caps[index] ?? spec.caps[spec.caps.length - 1] ?? 1
  const totalUnits = spec.consumed * spec.progressPerMaterial

  const barPositionAt = (unitsFilled: number) => {
    // Absolute progress since the click-time tier start -> walk the caps
    // so multi-tier fills wrap onto the next bar.
    let p = spec.tierProgress + unitsFilled
    let idx = 0
    while (idx < spec.caps.length - 1 && p >= capAt(idx)) {
      p -= capAt(idx)
      idx++
    }
    return { filled: Math.min(p, capAt(idx)), cap: capAt(idx) }
  }
  const fillCurve = (elapsedMs: number) => {
    const f = Math.min(1, elapsedMs / FILL_MS)
    return totalUnits * f * f * f
  }

  // Motes pour CONTINUOUSLY for the whole fill (owner ruling 2026-10-10):
  // each one aims at where the bar's leading edge will be when it lands,
  // so the stream reads as filling the bar, not a one-shot burst.
  // Dense light stream (owner ruling 2026-10-10): many small motes read
  // as one continuous ribbon of light instead of sparse flying dots.
  const count = Math.min(120, Math.max(48, Math.round(spec.consumed * 1.5)))
  const weights = Array.from({ length: count }, () => 0.8 + Math.random() * 0.4)
  const weightSum = weights.reduce((a, b) => a + b, 0)
  const countDelta = spec.haveTo - spec.haveFrom
  // Departure window covers ~85% of the fill so the last motes still land
  // before the bar completes.
  const departWindow = FILL_MS * 0.85
  const step = count > 1 ? departWindow / (count - 1) : 0
  const tubeWidth = to.width

  const { filled, cap } = barPositionAt(0)
  pourHave.value = spec.haveFrom
  pourFill.value = cap > 0 ? (filled / cap) * 100 : 0
  pourLabel.value = `${formatNumber(Math.round(filled))} / ${formatNumber(cap)}`

  // Two staggered motes per slot (owner ruling 2026-10-10): doubles the
  // stream density at the same cadence so it reads as one ribbon of
  // light chasing the fill edge.
  pourFlight = weights.flatMap((w, index): PourMote[] => {
    const slot = index * step
    const delta = (countDelta * w) / weightSum / 2
    return [0, 1].map((sub) => {
      const departAt = slot + sub * 14 + Math.random() * 18
      const flightMs = 330 + Math.random() * 90
      // Aim at the fill head when this mote will land (exact for the shared
      // curve; a mid-flight cap wrap can leave it aiming a hair off - fine).
      const landAt = departAt + flightMs
      const pos = barPositionAt(fillCurve(landAt))
      const edgeX = x1 + Math.min(1, pos.filled / pos.cap) * tubeWidth
      // Quadratic arc control point: off the segment's perpendicular,
      // biased upward so the stream reads as a rising arc.
      const t = 0.35 + Math.random() * 0.3
      const mx = x0 + (edgeX - x0) * t
      const my = y0 + (y1 - y0) * t
      const nx = -(y1 - y0) / span
      const ny = (x1 - x0) / span
      const lift = span * (0.16 + Math.random() * 0.14)
      return {
        departAt,
        flightMs,
        countDelta: delta,
        progressUnits: 0,
        x0: x0 + (Math.random() - 0.5) * 6,
        y0: y0 + (Math.random() - 0.5) * 6,
        cx: mx + nx * lift * (Math.random() < 0.5 ? -1 : 1),
        cy: my + ny * lift - span * 0.12,
        x1: edgeX,
        y1: y1 + (Math.random() - 0.5) * 5,
        size: 2 + Math.random() * 1.8,
        departed: false,
        landed: false,
        x: x0,
        y: y0,
        opacity: 0,
        scale: 1,
      }
    })
  })
  pourMotes.value = []

  const startedAt = performance.now()
  const tick = () => {
    const now = performance.now()
    const elapsed = now - startedAt
    let alive = false
    for (const mote of pourFlight) {
      const t = (elapsed - mote.departAt) / mote.flightMs
      if (t < 0) {
        alive = true
        continue
      }
      if (!mote.departed) {
        // Departure: the count drains as the mote leaves the slot.
        mote.departed = true
        if (pourHave.value !== null) pourHave.value += mote.countDelta
      }
      if (t >= 1) {
        mote.landed = true
        continue
      }
      alive = true
      const u = 1 - t
      mote.x = u * u * mote.x0 + 2 * u * t * mote.cx + t * t * mote.x1
      mote.y = u * u * mote.y0 + 2 * u * t * mote.cy + t * t * mote.y1
      mote.opacity = Math.min(1, t / 0.15)
      mote.scale = 0.7 + 0.6 * Math.sin(t * Math.PI)
    }
    pourMotes.value = pourFlight.filter((mote) => mote.departed && !mote.landed)
    // Eased bar fill: same 5s curve every click, accelerating over time
    // (owner ruling: not fast right from the start).
    const filledNow = fillCurve(elapsed)
    if (pourVisual) pourVisual.progressAbs = spec.tierProgress + filledNow
    if (filledNow < totalUnits) {
      alive = true
      const next = barPositionAt(filledNow)
      pourFill.value = Math.min(100, (next.filled / next.cap) * 100)
      pourLabel.value = `${formatNumber(Math.round(next.filled))} / ${formatNumber(next.cap)}`
    } else if (pourFill.value !== null) {
      const last = barPositionAt(totalUnits)
      pourFill.value = Math.min(100, (last.filled / last.cap) * 100)
      pourLabel.value = `${formatNumber(Math.round(last.filled))} / ${formatNumber(last.cap)}`
    }
    if (alive) {
      pourRaf = requestAnimationFrame(tick)
    } else {
      // Stream settled and the bar reached its final fill - the real
      // unit/count takes over again.
      clearPourFx()
    }
  }
  pourRaf = requestAnimationFrame(tick)
}

</script>
<template>
  <EquipmentArtCard ref="cardRef" class="body-card body-paper-details">
    <div class="body-card-title">
      <img :src="navIcon" alt="">
      <h2>{{ unit?.title ?? model.chapterLabel }}</h2>
    </div>
    <template v-if="unit">
      <div class="body-progress-value">
        <span>{{ pourLabel ?? unit.progressLabel ?? model.progressLabel }}</span>
      </div>
      <EquipmentEnergyTube :fill="pourFill ?? unit.progressPct ?? model.progress" color="#eec76c" />
      <div class="body-scroll">
        <!-- Big-tier total stats (owner ruling 2026-10-10): Ren The is
             ONE big tier - model.totalRows is the chapter's accumulated
             grants, domain-computed including the in-progress share. -->
        <dl class="body-stat-list">
          <div v-for="row in model.totalRows" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
          <p v-if="!model.totalRows.length" class="body-empty-row">{{ t('body.noGains') }}</p>
        </dl>
        <p v-for="(gate, i) in unit.gates" :key="i" class="body-gate">{{ gate }}</p>
        <div v-if="model.extra" class="body-extra" :class="{ done: model.extra.done }">
          <div class="body-extra__head"><span>{{ model.extra.title }}</span><em>{{ model.extra.stateLabel }}</em></div>
          <p>{{ model.extra.description }}</p>
          <div v-if="model.extra.progressMax" class="body-extra__bar">
            <span :style="{ width: `${Math.min(100, (model.extra.progress ?? 0) / model.extra.progressMax * 100)}%` }" />
          </div>
          <p v-if="model.extra.progressLabel" class="body-extra__count">{{ model.extra.progressLabel }}</p>
        </div>
      </div>
      <!-- Materials sit pinned right above the CTA (owner ruling
           2026-10-09). -->
      <h3 class="body-material-title">{{ t('body.material') }}</h3>
      <div class="body-materials">
        <div
          v-for="cost in unit.costs"
          :key="cost.id"
          v-tooltip="materialTooltip(cost.id, cost.have)"
          class="equipment-material"
          :class="{ 'is-missing': !cost.met }"
        >
          <div class="equipment-material-icon">
            <SlotView
variant="equipment" static :item="null"
              :icon="cost.icon ?? materialIcon(cost.id)" :label="cost.name"
              :amount="pourHave !== null && cost.need > 0 ? Math.max(0, Math.round(pourHave)) : cost.have"
/>
          </div>
        </div>
        <p v-if="!unit.costs.length" class="body-empty-row">{{ t('body.noCost') }}</p>
      </div>
      <!-- Submit states = the Trang Bi machine (owner ruling 2026-10-09):
           dark filter-art pill while locked, gold selected art once the
           unit is investable. -->
      <EquipmentArtButton v-if="unit.actionLabel && !model.chapterComplete" filter-art class="body-invest" :gold="!unit.actionDisabled" :disabled="unit.actionDisabled" @click="emit('invest')">{{ unit.actionLabel }}</EquipmentArtButton>
    </template>
    <template v-else>
      <p class="body-empty-row">{{ model.lockHint ?? t('body.empty') }}</p>
    </template>
    <p class="body-notice" role="status" aria-live="polite">{{ notice }}</p>
  </EquipmentArtCard>
  <!-- Motes live outside the card (owner ruling 2026-10-10): its
       clip-path swallowed the leftward part of the arc. Viewport coords. -->
  <Teleport to="body">
    <div v-if="pourMotes.length" class="body-pour-layer">
      <span
        v-for="mote in pourMotes"
        :key="mote.departAt"
        class="body-pour-mote"
        :style="{
          width: `${mote.size}px`,
          height: `${mote.size}px`,
          opacity: mote.opacity,
          transform: `translate(${mote.x - mote.size / 2}px, ${mote.y - mote.size / 2}px) scale(${mote.scale})`,
        }"
      />
    </div>
  </Teleport>
</template>
<style scoped>
/* Grow the card into the free space around it (owner ruling
   2026-10-09): negative margins let it reach ~10px off the
   silhouette and the panel edge. */
.body-card { height:100%; min-height:0; display:flex; flex-direction:column; padding:14px 14px 28px; margin-left:-10px; margin-right:-8px; }
.body-card-title { display:flex; align-items:center; gap:8px; flex:none; }
.body-card-title img { width:48px; height:48px; object-fit:contain; }
.body-card-title h2 { margin:0; font-size:23px; color:#f3e4c4; }
.body-card h3 { font-size:14px; margin:6px 0 4px; color:#ebd49e; flex:none; }
.body-progress-value { display:flex; justify-content:flex-end; font-size:13px; margin-bottom:6px; color:#e8d8b8; flex:none; }
.body-card :deep(.equipment-energy-tube) { flex:none; }
.body-scroll { flex:1; min-height:0; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#8a7444 transparent; margin-top:12px; }
.body-stat-list { margin:0; }
.body-stat-list > div { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #b28a4333; font:700 13px/1.3 var(--pc-font-body, Georgia, serif); align-items:center; }
.body-stat-list dd { margin:0; color:#a3d793; }
.body-material-title { margin-top:4px; }
.body-materials { display:flex; flex-wrap:wrap; gap:10px; flex:none; }
.body-materials .equipment-material { display:flex; align-items:center; gap:6px; font-size:12px; color:#a3d793; }
.body-materials .equipment-material-icon { width:40px; height:40px; flex:none; align-self:center; }
.body-materials .equipment-material-icon :deep(.slot-view) { width:100%; height:100%; }
.body-materials .equipment-material b { font-weight:700; }
.body-materials .equipment-material.is-missing b { color:#d98a6f; }
.body-gate { margin:5px 0; font-size:12px; color:#d98a6f; }
.body-empty-row { font-size:13px; color:#9a8562; font-style:italic; }
.body-extra { margin-top:10px; padding:8px 10px; border:1px solid #3f7a5c88; border-radius:6px; background:#0f201855; }
.body-extra__head { display:flex; justify-content:space-between; align-items:baseline; font-size:14px; color:#9fd4a8; }
.body-extra__head em { font-style:normal; font-size:10px; text-transform:uppercase; letter-spacing:.4px; }
.body-extra p { margin:5px 0 0; font-size:12px; color:#b6a87e; }
.body-extra__bar { margin-top:7px; height:8px; border:1px solid #8a7444; border-radius:5px; background:#151715; overflow:hidden; }
.body-extra__bar span { display:block; height:100%; background:linear-gradient(90deg,#466c4b,#c6a047); }
.body-extra__count { font-size:11px; color:#b6a87e; }
.body-extra.done { border-color:#7fae62; }
/* Same Cường Hóa submit (owner ruling 2026-10-09): fixed-width
   filter-art pill, the 1225/324 ratio grows the frame with the
   text - smaller size + centered per his live review. */
.body-invest { width:220px; flex:none; font-size:18px; padding:0; margin:8px auto 0; }
.body-notice { position:absolute; left:14px; right:14px; bottom:6px; margin:0; font-size:11px; color:#c9a95f; min-height:14px; text-align:center; }
/* Pour stream motes (owner ruling 2026-10-09/10) - warm-gold glowing dots
   teleported to document.body so the card clip-path cannot clip the arc.
   The layer is fixed to the viewport and ignores pointer input. */
.body-pour-layer { position:fixed; left:0; top:0; z-index:9999; pointer-events:none; }
.body-pour-mote { position:absolute; left:0; top:0; border-radius:50%; background:#eec76c; box-shadow:0 0 5px 2px #eec76c, 0 0 12px 4px #eec76c55; will-change:transform,opacity; }
</style>
