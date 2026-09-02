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
  // Pháp Tu Thuần Hệ (E-2, 2026-09-03) — node "Độc Chướng" (+1 trần
  // Trúng Độc): buff id → số tầng TRẦN cộng thêm vào maxStacks của
  // definition khi BuffSystem tạo instance mới (xem BuffSystem.
  // resolveMaxStacks). Map rỗng/undefined = không đổi hành vi cũ.
  maxStacksBonusByBuffId?: Record<string, number>
}

export type SkillRuntimeNumericStatKey = {
  [K in keyof SkillRuntimeStats]-?: SkillRuntimeStats[K] extends number ? K : never
}[keyof SkillRuntimeStats]

export type SkillResourceStatKey = SkillRuntimeNumericStatKey

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
