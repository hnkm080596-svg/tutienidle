// Companions (Companion Roster spec, 2026-09-05) — gacha-recruited
// combatants with a FIXED skill kit (no Ngũ Hành node-tree/loadout) and NO
// equipment (stats scale from grade + level only, see companionStatsAtLevel
// in CompanionCombat.ts). Reuses ItemGrade (Hoàng/Huyền/Địa/Thiên/Tiên
// Chất) for rarity — the SAME 5-tier ladder as Equipment/Pill/Talisman/
// Formation, not the unrelated 10-tier ProfessionGrade.
import type { ItemGrade } from '@/core/item/ItemGrade'
import type { TurnSkillDefinition } from '@/core/battle/turn/TurnSkillAction'

export interface CompanionBaseStats {
  maxHp: number
  attack: number
  speed: number
}

export interface CompanionDefinition {
  id: string
  name: string
  grade: ItemGrade
  baseStats: CompanionBaseStats
  basic: TurnSkillDefinition
  special?: TurnSkillDefinition
  ultimate?: TurnSkillDefinition
}

export interface CompanionInstance {
  definitionId: string
  level: number
  exp: number
}

export const COMPANIONS: readonly CompanionDefinition[] = [
  // Content added in a later balance/content pass — this file ships the
  // mechanism only (Companion Roster spec §8, out of scope: roster content).
]
