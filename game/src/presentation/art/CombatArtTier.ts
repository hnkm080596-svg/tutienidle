// CombatArtTier — which tier of entity DESERVES animation. Policy, once.
//
// Spec B §3.2.1
// (docs/superpowers/specs/2026-09-11-combat-animation-metadata-design.md).
//
// Without this, "enemies are static" is a fact restated at every enemy entry,
// and the first boss that deserves animation makes the rule a lie in a place
// nobody is looking.
//
// Nothing new is classified. The domain ALREADY carries the tier: `Enemy` has
// `isElite`/`isBoss` (`core/enemy/Enemy.ts`), set by `createEliteVariant()` /
// `createBossVariant()`. Presentation reading a domain fact is legal under A7 —
// this reports, it does not decide anything the domain owns.

/** What an entity's art should be — NOT what it has. See `presentationFor`. */
export type CombatArtTier = 'static' | 'animated'

/**
 * ELITE IS DELIBERATELY STATIC. Elites are a reward multiplier applied to an
 * ordinary template, not a distinct creature, so they share the ordinary one's
 * art. Animating them would multiply the art bill by every elite-able enemy,
 * which is the opposite of §3.2's purpose. When an elite deserves its own look
 * it becomes a boss variant or its own template.
 */
export function artTierFor(entity: { isBoss?: boolean }): CombatArtTier {
  return entity.isBoss ? 'animated' : 'static'
}

/**
 * WHAT THIS DOES NOT DO: decide whether art exists.
 *
 * The catalogue (`presentationFor`) stays the single source of truth for what
 * has actually been drawn. The tier says what an entity DESERVES; the entry says
 * what it HAS. Collapsing the two would mean a boss whose atlas has not been
 * drawn yet either crashes or silently downgrades — and §3.2 exists precisely
 * because art arrives later than the design for it.
 *
 * The two are reconciled by a guard, not by a fallback (§7): an entity whose
 * tier is `animated` and whose entry is `static` is ART DEBT — listed, expected,
 * and allowed. Exactly the ratchet Spec A used for cross-layer imports: it may
 * shrink without ceremony; it may not grow without someone editing this list.
 *
 * IT IS NON-EMPTY ON DAY ONE, AND THAT IS THE POINT. Boss variants are built
 * from the SAME templates as ordinary enemies (`createBossVariant()` multiplies
 * an existing enemy's stats), so a boss wolf resolves to the ordinary wolf's
 * texture key. Every mortal template is therefore art debt in its boss form:
 * `artTierFor` calls it animated, and the only art drawn for that key is a still
 * PNG. Listing all twenty says that out loud instead of leaving twenty silent
 * downgrades.
 *
 * One consequence is INHERITED rather than introduced: `isBoss` is already
 * overloaded. Tribulation (Kiếp) enemies set it directly, NOT through
 * `createBossVariant()`, and the code says why — "Chỉ tái dùng cờ isBoss để
 * Combat HUD hiện thanh máu cố định" (`Enemy.ts:190-196`). They set it to get a
 * fixed HP bar, not because they are bosses. They carry no texture key of their
 * own, so they never reach this list — but if the debt list ever turns out to be
 * mostly Kiếp enemies, the fix is a separate `hasFixedHealthBar` flag on the HUD
 * side, not a special case buried in `artTierFor`.
 */
export const ART_DEBT_ENTITY_KEYS: readonly string[] = [
  'mortal-ferocious-wild-boar-v1',
  'mortal-ferocious-water-wolf-v1',
  'mortal-ferocious-savage-tiger-v1',
  'mortal-ferocious-mountain-bandit-v1',
  'mortal-ferocious-giant-crocodile-v1',
  'mortal-ferocious-stone-lynx-v1',
  'mortal-ferocious-silver-fox-v1',
  'mortal-ferocious-iron-boar-v1',
  'mortal-ferocious-mud-ox-v1',
  'mortal-ferocious-feral-dog-v1',
  'mortal-wild-boar-v1',
  'mortal-water-wolf-v1',
  'mortal-savage-tiger-v1',
  'mortal-mountain-bandit-v1',
  'mortal-giant-crocodile-v1',
  'mortal-stone-lynx-v1',
  'mortal-silver-fox-v1',
  'mortal-iron-boar-v1',
  'mortal-mud-ox-v1',
  'mortal-feral-dog-v1',
]
