<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { characterCreationService } from '@/services/character/CharacterCreationServiceFactory'
import { isValidCharacterName } from '@/services/character/CharacterCreationService'
import type { TalentDefinition } from '@/core/talent/Talent'
import type { RemoteCharacterMetadata } from '@/services/session/BackendStatus'
import { useAudioStore } from '@/stores/audio'
import CreationSceneLayout from '@/components/scenes/creation/CreationSceneLayout.vue'
import CreationVista from '@/components/scenes/creation/CreationVista.vue'
import CreationBackButton from '@/components/scenes/creation/CreationBackButton.vue'
import CreationScrollShell from '@/components/scenes/creation/CreationScrollShell.vue'
import CreationTitleBlock from '@/components/scenes/creation/CreationTitleBlock.vue'
import CreationNameSection from '@/components/scenes/creation/CreationNameSection.vue'
import CreationTalentSection from '@/components/scenes/creation/CreationTalentSection.vue'
import CreationStarterSlot from '@/components/scenes/creation/CreationStarterSlot.vue'
import CreationFooter from '@/components/scenes/creation/CreationFooter.vue'
import '@/components/scenes/creation/art-needed.css'

// BETA SCOPE LOCK v2 (phase-2) - the canonical creation surface is
// Name + Talent only. The mortal starter pick is gone: every beta
// character boots with 'linh_bao' (BETA_MORTAL_STARTER_SKILL_ID), and
// the talent offer list arrives already beta-admitted from the service
// - this screen never filters the registry itself.
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
  <CreationSceneLayout>
    <template #vista>
      <CreationVista />
    </template>
    <template #back>
      <CreationBackButton :disabled="creating" @back="emit('back')" />
    </template>
    <template #scroll>
      <CreationScrollShell>
        <CreationTitleBlock />
        <CreationNameSection v-model="name" :valid-name="validName" :disabled="creating" />
        <CreationTalentSection
          :talents="talents"
          :selected-ids="selectedTalentIds"
          :rolling="rolling"
          :error="error"
          :creating="creating"
          @toggle="toggleTalent"
          @reroll="reroll"
        />
        <CreationStarterSlot :visible="false" />
        <CreationFooter
          :ready="ready"
          :creating="creating"
          :summary="summary"
          :error="talents.length > 0 ? error : ''"
          @finish="finish"
        />
      </CreationScrollShell>
    </template>
  </CreationSceneLayout>
</template>
