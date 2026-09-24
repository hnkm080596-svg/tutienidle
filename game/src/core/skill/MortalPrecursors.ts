// P7-M4 - the mortal-selectable basic set, owned by the skill domain.
// Was exported from kiem-tu/KiemTuState.ts (a path module owning a
// mortal concept). CAST_LEVELING_THRESHOLDS stays the LEVELING
// authority; this list is the mortal-selectable ROLE authority - the
// contract test pins the two sets equal. Post-path starter authority
// is a separate concern: PathWayDefinition.starterBasicSkillId.
import type { PlayerData } from '../player/Player'
import { getSkillCoreLevel } from '../progression/SkillCoreLevel'

export const MORTAL_PRECURSOR_SKILL_IDS = ['tram', 'linh_bao', 'huy_quyen'] as const

export const MORTAL_DEFAULT_BASIC_ID = 'tram'

export function isMortalPrecursorSkillId(id: string): boolean {
  return (MORTAL_PRECURSOR_SKILL_IDS as readonly string[]).includes(id)
}

/**
 * BETA-CREATION (v82) - single authority for the mortal-boundary save
 * contract. Every layer that decides 'legal save' (restore preflight,
 * remote newest-wins acceptance) calls this one function so the gates
 * can never drift apart. Returns the violation message, or null when
 * the save's mortal boundary is legal.
 *
 * The mortal predicate keys on realmId, not cultivationPath: a crafted
 * non-mortal save with no path must not be treated as mortal - and
 * realmId!=='mortal' + pathless is rejected outright because no legal
 * flow can produce it (applyPathChoice writes the path inside the same
 * ritual transaction that advances the realm).
 *
 * Mortal pick contract: present + precursor + learned + core grant
 * (the creation seam's three-channel write). Post-mortal presence is
 * corrupt (the ritual clears the pick inside the commit block).
 * Sibling precursors: learnSkill grants core_<id> atomically with the
 * learn, so a LEARNED precursor missing its grant is only reachable
 * via crafted/corrupted payload.
 */
export function mortalBoundaryContractViolation(save: {
  player: PlayerData
  skills: readonly { id: string }[]
}): string | null {
  const mortalPick = save.player.mortalBasicSkillId

  if (mortalPick !== undefined && !isMortalPrecursorSkillId(mortalPick)) {
    return `Invalid mortalBasicSkillId in save: ${String(mortalPick)}`
  }

  // Self-contained pairing (F-INT-05): mortal + a path is contradictory
  // on its face - the shape layer normally rejects it first, but the
  // contract cannot accept it either, so a caller forgetting shape
  // still gets an honest reject instead of a silent pass.
  if (save.player.realmId === 'mortal' && save.player.cultivationPath !== undefined) {
    return `mortal save carries cultivationPath '${String(save.player.cultivationPath)}' (contradictory boundary)`
  }

  const isMortalSave =
    save.player.realmId === 'mortal' && save.player.cultivationPath === undefined

  if (!isMortalSave) {
    if (save.player.cultivationPath === undefined) {
      return `non-mortal save missing cultivationPath (realmId '${save.player.realmId}')`
    }
    if (mortalPick !== undefined) {
      return `mortalBasicSkillId persisted post-mortal in save: '${mortalPick}' (realmId '${save.player.realmId}', path '${String(save.player.cultivationPath)}')`
    }
    return null
  }

  if (mortalPick === undefined) {
    return 'mortal save missing required mortalBasicSkillId (creation pick)'
  }

  if (!save.skills.some((entry) => entry.id === mortalPick)) {
    return `mortalBasicSkillId not learned in save: '${mortalPick}'`
  }

  // The creation seam grants each learned precursor's core node - without
  // it that basic sits at level 0 forever (the Insight channel and
  // hidden-pathway Lv3 gate are dead).
  for (const precursorId of MORTAL_PRECURSOR_SKILL_IDS) {
    if (!save.skills.some((entry) => entry.id === precursorId)) continue
    if (getSkillCoreLevel(save.player, precursorId) < 1) {
      return precursorId === mortalPick
        ? `mortalBasicSkillId missing core grant in save: '${mortalPick}'`
        : `learned precursor missing core grant in save: '${precursorId}'`
    }
  }

  return null
}
