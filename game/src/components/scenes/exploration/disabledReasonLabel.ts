// Scene 09 scaffold - map StageSurfaceDisabledReason (the read-model's
// verdict) to the same i18n labels the old panel derived from
// catalogOps.stageLockReasonCode. 'busy' is a start-gate state, never a
// lock reason - it maps to the generic progress hint defensively.
import type { ComposerTranslation } from 'vue-i18n'
import type { StageSurfaceDisabledReason } from '@/core/game/GameManagerStageOps'
import { getCurrentRealm } from '@/core/realm/realmSystem'

export function disabledReasonLabel(
  reason: StageSurfaceDisabledReason | null | undefined,
  t: ComposerTranslation,
): string {
  if (!reason) {
    return ''
  }

  if (reason.kind === 'realm') {
    return t('panels.stageSelect.locked.requireRealm', {
      realm: getCurrentRealm(reason.realmId).name,
      level: reason.realmLevel,
    })
  }

  if (reason.kind === 'floor') {
    return t('panels.stageSelect.locked.clearFloor', { floor: reason.floor })
  }

  return t('panels.stageSelect.locked.progress')
}
