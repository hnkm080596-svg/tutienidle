import type { CombatEntity } from '../combat/CombatEntity'
import {
  KIM_THE_DECAY_INTERVAL_SECONDS,
  MAX_HOA_THE,
  MAX_THO_THE,
} from '../combat/CombatTypes'
import type { Skill } from '../skill/Skill'
import { getSkillRuntimeStat } from '../skill/SkillRuntimeStats'

const HOA_THE_BASE_DECAY_PER_SECOND = 0.5

/** Tick các resource chiến đấu riêng của Pháp Tu. */
export function updatePhapTuBattleResources(player: CombatEntity, deltaSeconds: number): void {
  if (player.currentHoaThe > 0) {
    const decayPerSecond = HOA_THE_BASE_DECAY_PER_SECOND *
      (1 - getSkillRuntimeStat(player, 'hoaTheDecayReductionPercent'))

    player.currentHoaThe = Math.max(0, player.currentHoaThe - decayPerSecond * deltaSeconds)
  }

  if (player.currentKimThe <= 0) {
    return
  }

  player.timeSinceLastBleedProc += deltaSeconds

  while (
    player.timeSinceLastBleedProc >= KIM_THE_DECAY_INTERVAL_SECONDS &&
    player.currentKimThe > 0
  ) {
    player.currentKimThe -= 1
    player.timeSinceLastBleedProc -= KIM_THE_DECAY_INTERVAL_SECONDS
  }
}

/** Áp resource nhận theo một lần cast; proc theo hit vẫn do SkillEffectSystem sở hữu. */
export function gainPhapTuCastResources(skill: Skill, source: CombatEntity): void {
  if (skill.grantsHoaThePerCast) {
    source.currentHoaThe = Math.min(
      MAX_HOA_THE,
      source.currentHoaThe + getSkillRuntimeStat(source, 'hoaTheGainPerCast'),
    )
  }

  if (skill.grantsThoThePerCast) {
    source.currentThoThe = Math.min(
      MAX_THO_THE,
      source.currentThoThe + getSkillRuntimeStat(source, 'thoTheGainPerCast'),
    )
  }
}
