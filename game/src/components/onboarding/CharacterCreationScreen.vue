<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { characterCreationService } from '@/services/character/CharacterCreationServiceFactory'
import { isValidCharacterName } from '@/services/character/CharacterCreationService'
import type { TalentDefinition } from '@/core/talent/Talent'
import type { RemoteCharacterMetadata } from '@/services/session/BackendStatus'
import { useAudioStore } from '@/stores/audio'
import PcPaperScene from '@/components/common/PcPaperScene.vue'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import CreationNameSection from '@/components/scenes/creation/CreationNameSection.vue'
import CreationTalentSection from '@/components/scenes/creation/CreationTalentSection.vue'
import CreationStarterSlot from '@/components/scenes/creation/CreationStarterSlot.vue'
import { CREATION_SKILL_PREVIEW } from '@/components/scenes/creation/creationPreview'
import '@/assets/tien-hiep-entry.css'

// The committed creation contract remains name + talent only.
// Beta grants Linh Bao; the other starter tiles remain locked previews.
// The talent offer list still arrives from the existing service.
export interface CharacterCreationPayload {
  name: string
  talentIds: string[]
  /** B1.4 - the canonical character block the create_character RPC
   *  returned. Present only in supabase mode; the boot grant path
   *  prefers it over the draft fields so the starter snapshot mirrors
   *  the server-committed row. */
  character?: RemoteCharacterMetadata
}

const emit = defineEmits<{ complete: [payload: CharacterCreationPayload]; back: [] }>()
const name = ref('')
const talents = ref<TalentDefinition[]>([])
const selectedTalentIds = ref<string[]>([])
const rolling = ref(false)
const error = ref('')
const creating = ref(false)

const { t } = useI18n()

const validName = computed(() => isValidCharacterName(name.value))
const ready = computed(() => validName.value && selectedTalentIds.value.length === 1)

const pickedTalentName = computed(
  () => talents.value.find((talent) => talent.id === selectedTalentIds.value[0])?.name ?? '',
)
const summary = computed(() =>
  t('onboarding.creation.summary', { name: name.value.trim(), talent: pickedTalentName.value }),
)
function toggleTalent(talent: TalentDefinition) {
  if (rolling.value || creating.value) return
  const index = selectedTalentIds.value.indexOf(talent.id)
  if (index >= 0) selectedTalentIds.value.splice(index, 1)
  else selectedTalentIds.value = [talent.id]
}
async function reroll() {
  if (rolling.value || creating.value) return
  useAudioStore().cue('progress.reroll')
  rolling.value = true
  error.value = ''
  try {
    talents.value = await characterCreationService.rollTalents()
    selectedTalentIds.value = []
  } catch {
    error.value = t('onboarding.creation.errors.rollFailed')
  } finally {
    rolling.value = false
  }
}
async function finish() {
  if (creating.value || !ready.value) return
  const payload: CharacterCreationPayload = {
    name: name.value.trim(),
    talentIds: [...selectedTalentIds.value],
  }
  const validation = characterCreationService.validateDraft(payload, new Set(talents.value.map(talent => talent.id)))
  if (!validation.ok) { error.value = validation.message; return }
  // Per-attempt error state: a stale prior-attempt message must not drive
  // the finally's latch release or stay rendered after a success.
  error.value = ''
  creating.value = true
  try {
    const result = await characterCreationService.createCharacter(payload)
    if (!result.ok) {
      error.value = result.message
      useAudioStore().cue('ui.error')
      return
    }
    // W7: character creation commit is the onboarding completion beat.
    useAudioStore().cue('progress.create')
    // Keep `creating` until unmount - the boot/save work that follows runs while
    // this screen is still displayed under the closing curtain.
    emit('complete', { ...payload, character: result.character })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (error.value) creating.value = false
  }
}

onMounted(() => { void reroll() })
</script>

<template>
    <PcPaperScene :title="t('onboarding.creation.headerTitle')" class="pc-creation-screen" data-testid="character-creation-screen" data-hk-scene="creation">
      <section class="pc-creation-content">
        <CreationNameSection v-model="name" :valid-name="validName" :disabled="creating" />
        <CreationStarterSlot :options="CREATION_SKILL_PREVIEW" />
        <CreationTalentSection :talents="talents" :selected-ids="selectedTalentIds" :rolling="rolling" :error="error" :creating="creating" @toggle="toggleTalent" @reroll="reroll" />
        <div class="pc-creation-feedback" aria-live="polite" aria-atomic="true">
          <p v-if="talents.length > 0 && error" class="creation-footer__error">{{ error }}</p>
          <p v-else-if="ready" data-testid="creation-summary">{{ summary }}</p>
        </div>
        <p class="pc-creation-preview">{{ t('onboarding.creation.starterSlot.previewNote') }}</p>
        <footer class="pc-creation-actions">
          <PcPaperButton variant="secondary" :disabled="creating" @click="emit('back')">{{ t('onboarding.creation.back') }}</PcPaperButton>
          <PcPaperButton :aria-disabled="!ready || creating" data-testid="creation-finish" @click="finish">{{ creating ? t('onboarding.creation.creating') : t('onboarding.creation.finish') }}</PcPaperButton>
        </footer>
      </section>
    </PcPaperScene>
</template>
