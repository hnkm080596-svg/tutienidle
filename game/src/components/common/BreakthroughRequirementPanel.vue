<script setup lang="ts">
import { computed, ref, useId, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useTribulation } from '@/composables/useTribulation'
import { projectTechniqueCompletion } from '@/core/technique/TechniqueProgression'
import { betaTechniqueAdmitted } from '@/core/betaScopeSkillDomain'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useAudioStore } from '@/stores/audio'
import OrnateDialog from '@/components/common/art/OrnateDialog.vue'
import OrnateDivider from '@/components/common/art/OrnateDivider.vue'
import OrnateButton from '@/components/common/art/OrnateButton.vue'

// Task 9.1 - ornate confirmation dialog before entering tribulation:
// warns that equipped gear is stripped during tribulation + optional
// unperfected technique warning + 2 ornate action buttons.
const { t } = useI18n()
const store = useBreakthroughRequirementStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { triggerBreakthrough } = useTribulation()

const titleId = useId()
const messageId = useId()
const dialogRef = ref<ComponentPublicInstance | null>(null)
const panelEl = () => (dialogRef.value?.$el as HTMLElement | undefined) ?? null

// M-F-TECHNIQUE (F-BREAK-CONFIRM) - unperfected warning: fires iff the
// live cycle's projected seal is below vien_man (the FIELD is compared
// - projectTechniqueCompletion returns an outcome object). Pure copy -
// the player may still breakthrough; sealed live-grade records return
// verbatim, in-band cycles project from the current rank + realmLevel.
const techniqueCompletionWarning = computed(() => {
  stateVersion.value

  const technique = gameManager.techniqueManager.getActive()
  if (!technique || !betaTechniqueAdmitted(technique.id)) return undefined

  const outcome = projectTechniqueCompletion(technique, player.$state.realmLevel)

  return outcome.completionState !== 'vien_man'
    ? { grade: technique.grade, state: outcome.completionState }
    : undefined
})

// The equipment warning is only real when something is actually worn -
// an always-on subtitle read as a lie on a gear-less save (ui-audit).
const hasEquippedGear = computed(() => {
  stateVersion.value
  return gameManager.equipmentBag.getEquipped().length > 0
})

function onConfirm() {
  useAudioStore().cue('ui.confirm')
  store.close()
  triggerBreakthrough()
}

function onCancel() {
  useAudioStore().cue('ui.cancel')
  store.close()
}

useDialogFocus(
  panelEl,
  computed(() => store.isOpen),
  { onEscape: onCancel },
)
</script>

<template>
  <Transition name="overlay-fade">
    <div
      v-if="store.isOpen"
      class="breakthrough-confirm-modal"
      :style="{ zIndex: OVERLAY_LAYERS.panel }"
      @click.self="onCancel"
    >
      <OrnateDialog
        ref="dialogRef"
        class="breakthrough-confirm__panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="messageId"
        :title="t('tribulation.overlay.sceneTitle')"
        :title-id="titleId"
        badge="alert"
        show-close
        :close-label="t('panels.common.close')"
        width="min(540px, 94vw)"
        @close="onCancel"
      >
        <p :id="messageId" class="breakthrough-confirm__lead">
          {{ t('tribulation.stillEquipped.title') }}
        </p>

        <OrnateDivider />

        <p v-if="hasEquippedGear" class="breakthrough-confirm__warning">
          {{ t('tribulation.stillEquipped.subtitle') }}
        </p>

        <p v-if="techniqueCompletionWarning" class="breakthrough-confirm__warning">
          {{
            t('tribulation.unperfectedTechnique.warning', {
              grade: techniqueCompletionWarning.grade,
              state: t(`tribulation.unperfectedTechnique.state.${techniqueCompletionWarning.state}`),
            })
          }}
        </p>

        <template #actions>
          <OrnateButton variant="dark" :sound="false" @click="onCancel">
            {{ t('tribulation.stillEquipped.cancel') }}
          </OrnateButton>
          <OrnateButton variant="gold" :sound="false" @click="onConfirm">
            {{ t('tribulation.stillEquipped.confirm') }}
          </OrnateButton>
        </template>
      </OrnateDialog>
    </div>
  </Transition>
</template>

<style scoped>
.breakthrough-confirm-modal {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim, rgba(10, 9, 7, 0.72));
}

.breakthrough-confirm__panel {
  flex: none;
  --ornate-button-label-size: min(3cqh, 1.8cqw, 20px);
}

.breakthrough-confirm__panel :deep(.ornate-dialog__badge) {
  height: 16cqh;
  margin-top: 0.6%;
}

.breakthrough-confirm__panel :deep(.ornate-dialog__actions) {
  margin-bottom: 3cqh;
}

.breakthrough-confirm__lead {
  margin: 0.8cqh 0 0.4cqh;
  padding: 0 2cqw;
  font-family: var(--font-display);
  font-size: min(3.3cqh, 18px);
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
  color: var(--paper-text, #302719);
}

.breakthrough-confirm__warning {
  margin: 0.6cqh 0 0;
  padding: 6px 12px;
  width: 100%;
  font-family: var(--font-body);
  font-size: min(2.6cqh, 14px);
  line-height: 1.45;
  text-align: center;
  color: var(--danger, #a63628);
  background: rgba(166, 54, 40, 0.08);
  border: 1px dashed rgba(166, 54, 40, 0.55);
  border-radius: 4px;
}
</style>
