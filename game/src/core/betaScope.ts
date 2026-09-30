// BETA PLAYABLE SCOPE LOCK (2026-09-30) - the 1-month beta build ships a
// reduced playable scope: Phap Tu (spell_pathway) + every supporting
// system (combat, economy, production, Nhan Cong workforce, quests,
// tutorial, save/cloud) stay OPEN; everything below is LOCKED:
//
//   - Kiem Tu (sword_pathway) and The Tu (body_pathway) ritual offers,
//   - ALL hidden ways (hidden_spell_pathway, hidden_sword_pathway,
//     hidden_body_pathway) - never offerable regardless of precursors,
//   - ALL hidden content: Hidden Perfection lineage (discovery, Co Thu
//     trial, Quan The diversion, Nghich Chu Thien), hidden beast spawn
//     substitution + banded-kill tracking, hidden material channel
//     emissions (grotto cycle rewards),
//   - Companion gameplay: roster/progression panel access, Qua Tang gift
//     moment issuance, pull/exchange/claim/feed ops, and companion
//     deployment into formations,
//   - Tran Phap ACCESS only: the formation panel cannot be opened; the
//     formation machinery (resolvePartyFormation, committed loadouts,
//     combat integration) keeps running untouched so saves and combat
//     resolution never desync.
//
// This is a scope reduction, NOT a removal. Re-enable after beta by
// flipping the flags below (clear BETA_SCOPE_LOCKED_PATHWAYS / set the
// ENABLED consts true) - every authority point reads them live and all
// persisted state was kept compatible.
//
// EXISTING-SAVE CONTRACT: the flags gate offers, triggers, and access
// only - never persisted state. A save that already chose sword/body
// keeps its committed way (getActiveWayDefinition is ungated) and stays
// fully playable. A save that owns companions keeps them resolving in
// combat via committed formation loadouts; it just cannot acquire,
// claim, feed, or newly deploy them while locked. Hidden-lineage
// closure (closeHiddenLineage) is also suspended during beta so a
// beta-era normal breakthrough does not permanently burn the lineage -
// the open lineage persists intact for post-beta re-enable.
//
// Authority layout: each feature has ONE gate site. Pathway offers gate
// inside isCultivationPathOffered (covers listOfferableWays and
// applyPathChoice). Hidden lineage gates inside HiddenLineage's
// eligibility/mutator functions (covers the trial resolver, the Quan
// The diverter, Nghich Chu Thien attempt + reveal, and both
// breakthrough-type seams). Hidden beasts gate inside HiddenBeastSystem
// (covers spawn substitution and kill tracking + the opened-window
// event). Hidden material emissions gate inside
// ProductionSystem.rollHiddenChannelRewards (covers online + offline
// grotto cycles). Companion gameplay gates inside
// isCompanionGameplayUnlocked (ops + HUD + tabs + wheel),
// issueCompanionGifts (gift record issuance), and
// commitFormationLoadout (new deployments). Tran Phap gates at the
// command-wheel slot - its only entry point.
import type { CultivationWayId } from './player/CultivationPathKit'

/**
 * Ways the Initiation Ritual may never offer while the beta scope lock
 * is on. spell_pathway stays open - the beta ships Phap Tu only.
 */
export const BETA_SCOPE_LOCKED_PATHWAYS: ReadonlySet<CultivationWayId> =
  new Set<CultivationWayId>([
    'sword_pathway',
    'body_pathway',
    'hidden_spell_pathway',
    'hidden_sword_pathway',
    'hidden_body_pathway',
  ])

/**
 * Master switch for hidden content: lineage progression, beast
 * substitution + kill tracking, and hidden material emissions.
 */
export const BETA_HIDDEN_CONTENT_ENABLED = false

/**
 * Master switch for companion gameplay: acquisition (gift issuance,
 * pull/exchange/claim), progression (feed), the roster panel, and new
 * formation deployments. Nhan Cong workforce is a production input, not
 * companion gameplay - it stays open.
 */
export const BETA_COMPANION_CONTENT_ENABLED = false

/**
 * Tran Phap panel access. The formation SYSTEM underneath is untouched:
 * committed loadouts still resolve in combat and formation state keeps
 * persisting normally.
 */
export const BETA_FORMATION_PANEL_ENABLED = false

/**
 * Display string for scope-locked entries - same wording the command
 * wheel already uses for release-unavailable slots
 * (RELEASE_UNAVAILABLE_REASON in data/ui/commandWheelCatalog.ts).
 * Kept as a separate constant because beta scope and the release
 * ceiling are different features that may diverge post-beta.
 */
export const BETA_SCOPE_LOCKED_REASON = 'Chưa mở trong bản hiện tại'
