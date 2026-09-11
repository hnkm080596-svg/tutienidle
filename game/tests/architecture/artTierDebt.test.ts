/**
 * Guard (Spec B §7) — art debt is listed, not discovered.
 *
 * Spec: docs/superpowers/specs/2026-09-11-combat-animation-metadata-design.md
 * §3.2.1, §7.
 *
 * `artTierFor` says what an entity DESERVES. The catalogue says what it HAS.
 * §3.2.1 refuses to reconcile the two with a fallback, because a fallback means
 * a boss whose atlas has not been drawn either crashes or silently downgrades —
 * and art arriving later than the design for it is the normal case here, not the
 * exception.
 *
 * So they are reconciled by a LIST, with the ratchet Spec A used for cross-layer
 * imports: it may shrink without ceremony; it may not grow without someone
 * editing it.
 *
 * Boss variants are built from the SAME templates as ordinary enemies
 * (`createBossVariant()` multiplies an existing enemy's stats), so a boss wolf
 * resolves to the ordinary wolf's texture key. Every mortal template is
 * therefore debt in its boss form, and the list is long on day one BY DESIGN.
 *
 * Probes this is written against: add a template without adding it to the list
 * (must go red), and leave a listed entity in place after its entry becomes
 * animated (must also go red).
 */
import { describe, expect, it } from 'vitest'
import { artTierFor, ART_DEBT_ENTITY_KEYS } from '@/presentation/art/CombatArtTier'
import {
  combatPresentationEntityKeys,
  presentationFor,
} from '@/presentation/art/CombatPresentationCatalogue'

/**
 * Entity keys that can appear on a boss. Any mortal template can be promoted to
 * a boss variant at a stage's boss wave, so every static enemy entry qualifies.
 * The player is never a boss and is already animated.
 */
function bossCapableStaticKeys(): string[] {
  return combatPresentationEntityKeys().filter(
    (entityKey) => presentationFor(entityKey)?.kind === 'static',
  )
}

describe('art tier', () => {
  it('a boss deserves animation; an ordinary enemy and an elite do not', () => {
    expect(artTierFor({ isBoss: true })).toBe('animated')
    expect(artTierFor({ isBoss: false })).toBe('static')

    // Elite is DELIBERATELY static (§3.2.1): an elite is a reward multiplier on
    // an ordinary template, not a distinct creature. Animating elites would
    // multiply the art bill by every elite-able enemy, which is the opposite of
    // what §3.2 is for.
    expect(artTierFor({})).toBe('static')
  })

  it('the tier never decides what gets drawn — only the catalogue does', () => {
    // If this ever stopped holding, a boss with no atlas would resolve to
    // something that does not exist. The check: a key whose entry is static
    // still resolves static, whatever tier a boss flag would give it.
    for (const entityKey of bossCapableStaticKeys()) {
      expect(presentationFor(entityKey)?.kind).toBe('static')
    }
  })
})

describe('art debt ratchet', () => {
  it('has debt to police — this list is expected to be non-empty today', () => {
    expect(ART_DEBT_ENTITY_KEYS.length).toBeGreaterThan(0)
  })

  it('every entity that deserves animation but has none is on the list', () => {
    const listed = new Set(ART_DEBT_ENTITY_KEYS)
    const unlisted: string[] = []

    for (const entityKey of bossCapableStaticKeys()) {
      // artTierFor on this entity's BOSS form. The flag is the domain's, and
      // reading it here is legal under A7 — this reports, it decides nothing.
      if (artTierFor({ isBoss: true }) === 'animated' && !listed.has(entityKey)) {
        unlisted.push(entityKey)
      }
    }

    expect(unlisted, 'new art debt must be recorded, not discovered later').toEqual([])
  })

  it('nothing lingers on the list after its art lands', () => {
    // The other direction, and the half that makes it a ratchet rather than an
    // allowlist: once an entry becomes `animated`, leaving it listed would hide
    // the next real debt behind a stale one.
    const stale = ART_DEBT_ENTITY_KEYS.filter(
      (entityKey) => presentationFor(entityKey)?.kind === 'animated',
    )

    expect(stale, 'these entities now have art and must leave the debt list').toEqual([])
  })

  it('every listed entity is still a real one', () => {
    const known = new Set(combatPresentationEntityKeys())

    const phantom = ART_DEBT_ENTITY_KEYS.filter((entityKey) => !known.has(entityKey))

    expect(phantom, 'a listed key the catalogue does not know is a typo or a deletion').toEqual([])
  })
})
