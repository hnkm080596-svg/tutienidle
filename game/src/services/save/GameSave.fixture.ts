import type { PlayerData } from '../../core/player/Player'
import type { SkillManager } from '../../core/skill/SkillManager'
import { SKILLS } from '../../data/skill/Skills'
import { isMortalPrecursorSkillId } from '../../core/skill/MortalPrecursors'
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
 * Saves for a post-path player (cultivationPath set) must NOT carry the
 * pick - the restore preflight rejects it - so this helper no-ops there.
 *
 * Mutates the given save (callers own the fixture lifetime). Returns the
 * same save for chaining. */
export function withMortalCreationPick(save: GameSave, skillId = 'tram'): GameSave {
  if (!isMortalPrecursorSkillId(skillId)) {
    throw new Error(`mortalSaveFixture: '${skillId}' is not a mortal precursor id`)
  }

  const player = save.player
  if (player.cultivationPath !== undefined) {
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
  if (player.cultivationPath !== undefined) {
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
