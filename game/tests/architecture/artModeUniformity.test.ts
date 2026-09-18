/**
 * ENTITY_ART_MODE uniformity invariant — every registered combat entity's
 * presentation `kind` must equal the compile-time mode. This is the guard
 * that makes "never half animated / half static" enforceable rather than a
 * comment: the catalogue emits kinds from the constant, and this test fails
 * the moment any entry drifts.
 *
 * Spec: docs/superpowers/plans/2026-09-19-entity-art-mode-switch.md
 */
import { describe, expect, it } from 'vitest'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import {
  combatPresentationEntityKeys,
  presentationFor,
} from '@/presentation/art/CombatPresentationCatalogue'

describe('ENTITY_ART_MODE uniformity', () => {
  it('every registered presentation kind matches ENTITY_ART_MODE', () => {
    for (const key of combatPresentationEntityKeys()) {
      expect(presentationFor(key)?.kind, `entity '${key}'`).toBe(ENTITY_ART_MODE)
    }
  })
})
