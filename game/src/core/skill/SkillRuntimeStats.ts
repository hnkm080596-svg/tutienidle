export interface SkillRuntimeStats {
  hoaTheGainPerCast: number
  hoaTheDecayReductionPercent: number
  thuyThePercent: number
  waterReactionExtensionSeconds: number
  poisonRootPercentPerStack: number
  poisonRootMaxStacks: number
  poisonRootThresholdBonusPercent: number
  earthAoeRadius: number
  earthAoeSecondaryDamagePercent: number
  earthKnockbackDistance: number
  thoTheGainPerCast: number
  skillImpactPercent: number
  kimTheGainPerProc: number
  kimTheDotDamagePercentPerStack: number
  kimTheDotResistancePenetrationPercentPerStack: number
  kimTheMaxStacksBonus: number
  metalAilmentPotencyPercent: number
  huyetPhaGainPerProc: number
  huyetPhaBurstDamage: number
}

export type SkillResourceStatKey = keyof SkillRuntimeStats

export const SKILL_RESOURCE_STAT_KEYS = [
  'hoaTheGainPerCast', 'hoaTheDecayReductionPercent',
  'thuyThePercent', 'waterReactionExtensionSeconds',
  'poisonRootPercentPerStack', 'poisonRootMaxStacks', 'poisonRootThresholdBonusPercent',
  'earthAoeRadius', 'earthAoeSecondaryDamagePercent', 'earthKnockbackDistance',
  'thoTheGainPerCast', 'skillImpactPercent',
  'kimTheGainPerProc', 'kimTheDotDamagePercentPerStack',
  'kimTheDotResistancePenetrationPercentPerStack', 'kimTheMaxStacksBonus',
  'metalAilmentPotencyPercent', 'huyetPhaGainPerProc', 'huyetPhaBurstDamage',
] as const satisfies readonly SkillResourceStatKey[]

export function createSkillRuntimeStats(): SkillRuntimeStats {
  return Object.fromEntries(SKILL_RESOURCE_STAT_KEYS.map(key => [key, 0])) as unknown as SkillRuntimeStats
}

export function getSkillRuntimeStat(
  owner: { skillStats?: SkillRuntimeStats },
  key: SkillResourceStatKey,
): number {
  return owner.skillStats?.[key] ?? 0
}
