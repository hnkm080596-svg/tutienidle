import type { PlayerData } from '../../core/player/Player'
import type { SkillManager } from '../../core/skill/SkillManager'
import type { Technique } from '../../core/technique/Technique'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { isMortalPrecursorSkillId } from '../../core/skill/MortalPrecursors'
import { freshSwordPathState } from '../../core/kiem-tu/KiemTuState'
import { getActiveWayDefinition } from '../../core/player/CultivationPathKit'
import { getRealmIndex } from '../../core/realm/realmSystem'
import type { GameSave } from './saveTypes'

/** Side-effect-free helper for save/restore tests (v82).
 *
 * A LEGAL mortal save carries the creation pick on three channels, all
 * written by the boot seam (bootstrapEarlyGamePlayer):
 *   - player.mortalBasicSkillId          - the picked precursor id
 *   - skills[]                            - a learned entry for that id
 *   - player.nodeLevels + purchasedNodeIds - the canonical core_<id>
 *     grant (v73 ownership + mirror)
 *
 * Saves for a non-mortal player (realmId other than 'mortal', or a
 * committed cultivationPath) must NOT carry the pick - the restore
 * preflight rejects it - so this helper no-ops there.
 *
 * Mutates the given save (callers own the fixture lifetime). Returns the
 * same save for chaining. */
export function withMortalCreationPick(save: GameSave, skillId = 'tram'): GameSave {
  if (!isMortalPrecursorSkillId(skillId)) {
    throw new Error(`mortalSaveFixture: '${skillId}' is not a mortal precursor id`)
  }

  const player = save.player
  if (player.realmId !== 'mortal' || player.cultivationPath !== undefined) {
    return save
  }

  player.mortalBasicSkillId = skillId

  if (!save.skills.some((entry) => entry.id === skillId)) {
    const template = SKILLS.find((skill) => skill.id === skillId)
    if (!template) {
      throw new Error(`mortalSaveFixture: skill template '${skillId}' missing from SKILLS`)
    }
    save.skills.push(structuredClone(template))
  }

  grantMortalPickCore(player, skillId)
  return save
}

/** Same three-channel write for manager-built saves (buildGameSave):
 * skillManager is the skills slice's source there, so the learned entry
 * goes through it rather than save.skills. Call BEFORE buildGameSave. */
export function primeMortalCreationPick(
  player: PlayerData,
  skillManager: Pick<SkillManager, 'add' | 'has'>,
  skillId = 'tram',
): void {
  if (!isMortalPrecursorSkillId(skillId)) {
    throw new Error(`mortalSaveFixture: '${skillId}' is not a mortal precursor id`)
  }
  if (player.realmId !== 'mortal' || player.cultivationPath !== undefined) {
    return
  }

  player.mortalBasicSkillId = skillId

  if (!skillManager.has(skillId)) {
    const template = SKILLS.find((skill) => skill.id === skillId)
    if (!template) {
      throw new Error(`mortalSaveFixture: skill template '${skillId}' missing from SKILLS`)
    }
    skillManager.add(structuredClone(template))
  }

  grantMortalPickCore(player, skillId)
}

function grantMortalPickCore(player: PlayerData, skillId: string): void {
  const coreId = `core_${skillId}`
  if ((player.nodeLevels[coreId] ?? 0) < 1) {
    player.nodeLevels[coreId] = 1
  }
  if (!player.purchasedNodeIds.includes(coreId)) {
    player.purchasedNodeIds.push(coreId)
  }
}

/** A LEGAL committed (non-mortal) save needs the path/way pair, the
 * path-owned slice, and the way's technique entry - the restore
 * preflight rejects a committed way whose save lacks its technique
 * (holder contract) and a non-mortal realm without a path (pairing
 * rule). Realm-dependent gradeHistory is derived so the entry stays
 * canonical: grades below the live grade are sealed, plus the live
 * grade's own record when it lags the realm index.
 *
 * Mutates the given save (callers own the fixture lifetime). Returns
 * the same save for chaining. */
export function withCommittedSwordPath(save: GameSave): GameSave {
  const player = save.player
  player.cultivationPath = 'sword'
  player.cultivationWay = 'sword_pathway'
  player.swordPath = freshSwordPathState()
  if (player.realmId === 'mortal') {
    player.realmId = 'qi_refining'
  }

  // The committed way's coreSkillIds (sword_pathway's orb cores) must be
  // granted - the shape layer rejects an owned way whose cores are
  // absent from nodeLevels.
  for (const skillId of getActiveWayDefinition(player)?.coreSkillIds ?? []) {
    const coreId = `core_${skillId}`
    if ((player.nodeLevels[coreId] ?? 0) < 1) {
      player.nodeLevels[coreId] = 1
    }
    if (!player.purchasedNodeIds.includes(coreId)) {
      player.purchasedNodeIds.push(coreId)
    }
  }

  const wayTechniqueId = 'sword_control_art'
  if (save.techniques.some((entry) => entry.id === wayTechniqueId)) {
    return save
  }

  const template = TECHNIQUES.find((technique) => technique.id === wayTechniqueId)
  if (!template) {
    throw new Error(`committedSaveFixture: technique template '${wayTechniqueId}' missing`)
  }

  const entry = structuredClone(template)
  const lagging = entry.grade < getRealmIndex(player.realmId)
  const sealedThrough = lagging ? entry.grade : entry.grade - 1
  const history: Technique['gradeHistory'] = {}
  for (let grade = 1; grade <= sealedThrough; grade += 1) {
    history[grade] = { finalRank: 12, completionState: 'dai_thanh' }
  }
  entry.gradeHistory = history
  save.techniques.push(entry)
  return save
}
