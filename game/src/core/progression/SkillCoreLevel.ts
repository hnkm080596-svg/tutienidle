import type { PlayerData } from '../player/Player'

// M-QI-05 / QI-D3 - canonical skill-level authority leaf. Imports
// nothing besides types so every layer (NodeSystem, GameManager,
// providers, restore validation) can read the convention without a
// dependency cycle.
//
// A Core Node is a ProgressionNode with `levelsSkillId`; its level
// lives ONLY in player.nodeLevels[core_<skillId>].

export function skillCoreNodeId(skillId: string): string {
  return `core_${skillId}`
}

/** Raw canonical level read - 0 means the core was never granted. */
export function getSkillCoreLevel(player: PlayerData, skillId: string): number {
  return player.nodeLevels?.[skillCoreNodeId(skillId)] ?? 0
}

/**
 * Frozen Insight curve for Core upgrades (re-homed verbatim from the
 * retired SkillUpgradeBalance): level L -> L+1 costs 5 + 3x(L-1).
 * Level 0 prices like level 1 - grants bypass cost entirely.
 */
export function getSkillCoreUpgradeCost(currentLevel: number): number {
  return 5 + 3 * Math.max(0, currentLevel - 1)
}
