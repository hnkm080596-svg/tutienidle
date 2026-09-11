/**
 * Guard (Spec B §7) — a "static" entity still moves.
 *
 * Spec: docs/superpowers/specs/2026-09-11-combat-animation-metadata-design.md
 * §3.2, §4.3, §7.
 *
 * §3.2 traded animation away for art cost, not for stillness. The trade is only
 * honest if the thing given back actually exists: a `kind: 'static'` entity with
 * `amplitudePx: 0` is B5 done halfway — animation removed, nothing put in its
 * place — and it would look exactly like the bug that motion was deleted by on
 * 2026-08-26.
 *
 * That is the probe this guard is written against: set one amplitude to 0 and
 * this must go red.
 */
import { describe, expect, it } from 'vitest'
import {
  combatPresentationEntityKeys,
  presentationFor,
} from '@/presentation/art/CombatPresentationCatalogue'

function staticEntries() {
  return combatPresentationEntityKeys()
    .map((entityKey) => ({ entityKey, presentation: presentationFor(entityKey)! }))
    .filter((entry) => entry.presentation.kind === 'static')
}

describe('static entity idle motion', () => {
  it('has static entities to police — a guard over an empty corpus proves nothing', () => {
    expect(staticEntries().length).toBeGreaterThan(10)
  })

  it('every static entity has a real amplitude and a real period', () => {
    for (const { entityKey, presentation } of staticEntries()) {
      if (presentation.kind !== 'static') {
        continue
      }

      expect(
        presentation.idleMotion.amplitudePx,
        `${entityKey}: static with no motion at all`,
      ).toBeGreaterThan(0)

      expect(
        presentation.idleMotion.periodMs,
        `${entityKey}: a period of zero never completes a cycle`,
      ).toBeGreaterThan(0)
    }
  })

  it('periods differ between species, so a battlefield does not pulse as one organism', () => {
    // The phase is jittered per runtime id in `combat-grid-view.ts` — five
    // wolves share a texture key, so per-key data alone cannot separate them.
    // What this checks is the other half: two different species do not breathe
    // in lockstep either.
    const periods = new Set<number>()

    for (const { presentation } of staticEntries()) {
      if (presentation.kind === 'static') {
        periods.add(presentation.idleMotion.periodMs)
      }
    }

    expect(periods.size).toBeGreaterThan(1)
  })

  it('every static entity names a texture and a source size', () => {
    // Without these, spec C has nothing to anchor a foot against, and
    // `applySpriteSize` cannot keep the aspect ratio.
    for (const { entityKey, presentation } of staticEntries()) {
      if (presentation.kind !== 'static') {
        continue
      }

      expect(presentation.texture.textureKey, `${entityKey}: no texture key`).toBeTruthy()
      expect(presentation.texture.textureUrl, `${entityKey}: no texture url`).toBeTruthy()
      expect(presentation.texture.sourceSize.w).toBeGreaterThan(0)
      expect(presentation.texture.sourceSize.h).toBeGreaterThan(0)
    }
  })
})
