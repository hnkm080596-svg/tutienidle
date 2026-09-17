/**
 * Guard — the app-level overlay order has exactly one source:
 * `src/core/presentation/OverlayLayers.ts`, and the presentation curtain
 * is its TOPMOST entry.
 *
 * Why (user report 2026-09-12): `.game-root` is positioned but creates no
 * stacking context, and Teleport-to-body overlays share the same root
 * context — so every app-level z-index competes globally. The curtain was
 * a hardcoded 1000 while OfflineSummaryModal (1800), toasts, tooltips and
 * the error/save screens all outranked it, leaking above a closed curtain.
 * The fix raised the curtain to the top of a named scale and routed every
 * app-level layer through it.
 *
 * What this polices:
 *   1. OVERLAY_LAYERS.curtain is strictly the largest entry in the scale.
 *   2. The curtain component actually binds OVERLAY_LAYERS.curtain — a
 *      scale entry nobody uses is decoration.
 *   3. No production file hardcodes a z-index in the app-level range
 *      (>= OVERLAY_LAYERS.combatPause, the lowest named tier) — that is how
 *      a panel ends up over the curtain again. Intra-component stacking
 *      stays in single/double digits and is none of this guard's business.
 *   4. The known app-level overlays each bind their named tier.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { SCAN_TIMEOUT, srcCorpus } from './helpers/scanTs'

const SRC_DIR = join(process.cwd(), 'src')
const LAYERS_MODULE = 'core/presentation/OverlayLayers.ts'

const corpus = srcCorpus(SRC_DIR)
const layerFile = corpus.find((file) => file.fromSrc === LAYERS_MODULE)

/** `name: 123` entries parsed straight from the scale's source — the guard
 *  never imports app code. */
const LAYER_ENTRY = /^\s*(\w+):\s*(\d+)\s*,/gm

function parseLayers(): Record<string, number> {
  const entries: Record<string, number> = {}

  for (const match of layerFile?.text.matchAll(LAYER_ENTRY) ?? []) {
    entries[match[1]!] = Number(match[2])
  }

  return entries
}

/** Anything >= the lowest named tier is an app-level layer claim and must
 *  come from OVERLAY_LAYERS, not a literal. */
const HARDCODED_LAYER = /(?:z-index|zIndex)\s*:\s*(\d{3,})/g

/** The app-level overlays and the tier each must bind. */
const OVERLAY_BINDINGS: Record<string, string> = {
  'components/game/PresentationTransitionOverlay.vue': 'OVERLAY_LAYERS.curtain',
  'components/game/combat/CombatPauseOverlay.vue': 'OVERLAY_LAYERS.combatPause',
  'components/common/ActionFeedbackLog.vue': 'OVERLAY_LAYERS.feedback',
  'components/common/ToastContainer.vue': 'OVERLAY_LAYERS.toast',
  'components/common/OfflineSummaryModal.vue': 'OVERLAY_LAYERS.modal',
  'components/common/TutorialOverlay.vue': 'OVERLAY_LAYERS.modal',
  'components/common/WorldAnnouncementOverlay.vue': 'OVERLAY_LAYERS.announcement',
  'components/common/Tooltip.vue': 'OVERLAY_LAYERS.tooltip',
  'components/common/ErrorScreen.vue': 'OVERLAY_LAYERS.appError',
  'components/common/SaveIncompatibleScreen.vue': 'OVERLAY_LAYERS.saveGate',
}

const layers = parseLayers()
const lowestTier = Math.min(...Object.values(layers))

describe('overlay layer contract', () => {
  it(
    'the scale module is where the contract puts it and parses non-empty',
    () => {
      expect(layerFile).toBeDefined()
      expect(Object.keys(layers).length).toBeGreaterThanOrEqual(4)
    },
    SCAN_TIMEOUT,
  )

  it(
    'curtain is strictly the topmost entry — nothing in the scale may outrank it',
    () => {
      const { curtain, ...rest } = layers

      expect(curtain).toBeTypeOf('number')

      for (const [name, value] of Object.entries(rest)) {
        expect(value, `OVERLAY_LAYERS.${name} (${value}) must sit below the curtain`).toBeLessThan(
          curtain!,
        )
      }
    },
    SCAN_TIMEOUT,
  )

  it(
    'no production file hardcodes a z-index in the app-level range',
    () => {
      const offenders: string[] = []

      for (const file of corpus) {
        if (file.fromSrc === LAYERS_MODULE || file.fromSrc.endsWith('.test.ts')) {
          continue
        }

        for (const match of file.text.matchAll(HARDCODED_LAYER)) {
          if (Number(match[1]) >= lowestTier) {
            offenders.push(`${file.fromSrc} -> z-index ${match[1]}`)
          }
        }
      }

      expect(
        offenders,
        'app-level layers must come from OVERLAY_LAYERS, not literals',
      ).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'announcement sits below modal - ambient banners must never cover blocking modals',
    () => {
      expect(layers.announcement).toBeTypeOf('number')
      expect(layers.modal).toBeTypeOf('number')
      expect(layers.announcement).toBeLessThan(layers.modal!)
    },
    SCAN_TIMEOUT,
  )

  it(
    'every known app-level overlay binds its named tier',
    () => {
      for (const [fromSrc, token] of Object.entries(OVERLAY_BINDINGS)) {
        const file = corpus.find((entry) => entry.fromSrc === fromSrc)

        expect(file, `${fromSrc} missing from src/`).toBeDefined()
        expect(
          file!.text.includes(token),
          `${fromSrc} must bind ${token} on its root overlay element`,
        ).toBe(true)
      }
    },
    SCAN_TIMEOUT,
  )
})
