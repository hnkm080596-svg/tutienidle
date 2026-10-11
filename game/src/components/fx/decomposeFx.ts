// Hoa Luyen / Phan Giai dissolve effect (owner spec 2026-10-11): when a
// decompose/dissolve confirm lands, the consumed cells crumble into
// shards and light motes arc UP to the matching resource chip on the
// Dong Fu top bar - one stream per output family. Display-only: the
// domain grant already committed before a burst is queued.
//
// Plumbing mirrors the body-scene pour channel (owner ruling 2026-10-10)
// but module-scoped so both surfaces (Trang Bi hall, Tru Vat tab) can
// reach the single layer mounted in GameRoot: confirm handlers call
// playDecomposeFx() with per-family streams whose origin points were
// captured BEFORE the bag cells unmounted; DecomposeFxLayer drains the
// queue and animates the burst + flights on a shared rAF timeline.
import { ref } from 'vue'
import {
  BUI_GO_ID,
  LUYEN_DAN_TINH_HOA_ID,
  LUYEN_KHI_TINH_HOA_ID,
} from '@/core/equipment/TinhHoaMaterial'

export interface DecomposeFxPoint {
  x: number
  y: number
}

export interface DecomposeFxStream {
  // Output material id - resolves the target chip live at play time.
  materialId: string
  // Granted amount (preview maxAmount while the domain returns a range) -
  // scales the mote count only; never rendered as a number.
  amount: number
  // Viewport centers of the consumed item cells.
  origins: DecomposeFxPoint[]
}

export interface DecomposeFxBurst {
  id: number
  streams: DecomposeFxStream[]
}

const pending = ref<DecomposeFxBurst[]>([])
let nextBurstId = 0

/**
 * Queue one dissolve burst. Streams without a visible origin are dropped
 * here so callers can hand over best-effort collections.
 */
export function playDecomposeFx(streams: DecomposeFxStream[]): void {
  const viable = streams.filter((stream) => stream.origins.length > 0)

  if (viable.length === 0) {
    return
  }

  pending.value = [...pending.value, { id: ++nextBurstId, streams: viable }]
}

/** Queue the GameRoot layer watches; each burst settles itself. */
export function useDecomposeFxBursts() {
  return pending
}

/** Remove a burst from the queue - the layer calls this when it settles. */
export function settleDecomposeFxBurst(id: number): void {
  pending.value = pending.value.filter((burst) => burst.id !== id)
}

// Warm-gold default matches the body pour motes; each output family tints
// its own stream so parallel families stay readable mid-flight.
const FAMILY_TINT: Readonly<Record<string, string>> = {
  [LUYEN_KHI_TINH_HOA_ID]: '#eec76c',
  [LUYEN_DAN_TINH_HOA_ID]: '#8fd49a',
  [BUI_GO_ID]: '#c9a06a',
}

export function decomposeFxTint(materialId: string): string {
  return FAMILY_TINT[materialId] ?? '#eec76c'
}

/**
 * Live viewport position of the resource chip carrying a material id.
 * Chips opt in via data-currency-id (DongFuStage top strip, DongFuHud).
 * The material-family chips (luyen_khi/bui_go/luyen_dan tinh hoa) are not
 * in the strip yet - the fallback aims at the strip's trailing corner,
 * which is where they land once mounted; never a hardcoded pixel target.
 */
export function resolveFxChipPoint(materialId: string): DecomposeFxPoint | null {
  if (typeof document === 'undefined') {
    return null
  }

  const chip = document.querySelector<HTMLElement>(`[data-currency-id="${cssEscape(materialId)}"]`)

  if (chip !== null) {
    return rectCenter(chip.getBoundingClientRect())
  }

  const strip = document.querySelector<HTMLElement>('.home-design-currencies, .df-resources')

  if (strip !== null) {
    const rect = strip.getBoundingClientRect()
    return { x: rect.left + rect.width * 0.85, y: rect.top + rect.height / 2 }
  }

  if (typeof window === 'undefined') {
    return null
  }

  // No HUD mounted at all (tests, isolated surfaces) - aim at the top
  // corner where the strip would sit so the flight still reads upward.
  return { x: window.innerWidth * 0.82, y: 30 }
}

/**
 * Viewport centers of bag cells. With `keys` (material/instance ids) the
 * lookup goes through the data-bag-key attr the pick-mode SlotViews
 * carry; without keys it takes every picked-marked cell.
 */
export function collectBagCellPoints(
  root: HTMLElement | null,
  keys?: readonly string[],
): DecomposeFxPoint[] {
  if (root === null) {
    return []
  }

  if (keys !== undefined) {
    const points: DecomposeFxPoint[] = []

    for (const key of keys) {
      const el = root.querySelector<HTMLElement>(`.bag-section__slot[data-bag-key="${cssEscape(key)}"]`)

      if (el !== null) {
        points.push(rectCenter(el.getBoundingClientRect()))
      }
    }

    return points
  }

  return Array.from(root.querySelectorAll<HTMLElement>('.bag-section__slot--picked')).map((el) =>
    rectCenter(el.getBoundingClientRect()),
  )
}

/** Grid center - stand-in origin for picked cells on other bag pages. */
export function bagGridPoint(root: HTMLElement | null): DecomposeFxPoint | null {
  const grid = root?.querySelector<HTMLElement>('.bag-section__grid')

  return grid ? rectCenter(grid.getBoundingClientRect()) : null
}

function rectCenter(rect: DOMRect): DecomposeFxPoint {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/"/g, '\\"')
}
