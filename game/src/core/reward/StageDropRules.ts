import { randomInt } from './DropRoll'

export const NORMAL_EQUIPMENT_DROP_CHANCE = 0.1
export const BOSS_EQUIPMENT_DROP_CHANCE = 0.3

export function rollMortalEssenceAmount(isBoss: boolean): number {
  return isBoss ? randomInt(5, 10) : randomInt(1, 3)
}
