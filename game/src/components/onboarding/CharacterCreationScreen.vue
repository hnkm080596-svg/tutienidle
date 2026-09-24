<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import InkWashBackdrop from '@/components/common/InkWashBackdrop.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { TALENT_RARITY_LABELS, type TalentDefinition } from '@/core/talent/Talent'
import { MORTAL_PRECURSOR_SKILL_IDS } from '@/core/skill/MortalPrecursors'
import { SKILLS } from '@/data/skill/Skills'
import type { Skill } from '@/core/skill/Skill'
import { characterCreationService } from '@/services/character/CharacterCreationServiceFactory'
import { isValidCharacterName } from '@/services/character/CharacterCreationService'

// BETA-CREATION - ONE unified flow: name + talent + starting-skill pick on
// a single screen. The 5-point allocation step is removed entirely; base
// stats are the 1/1/1/1/1 default. The pick travels through the payload
// and is written inside the boot seam after the precursors are learned.
export interface CharacterCreationPayload {
  name: string
  talentIds: string[]
  mortalBasicSkillId: string
}

const emit = defineEmits<{ complete: [payload: CharacterCreationPayload]; back: [] }>()
const name = ref('')
const talents = ref<TalentDefinition[]>([])
const selectedTalentIds = ref<string[]>([])
const selectedSkillId = ref('')
const rolling = ref(false)
const error = ref('')
const creating = ref(false)

const { t } = useI18n()

const precursorSkills = computed<Skill[]>(() =>
  MORTAL_PRECURSOR_SKILL_IDS.map((id) => {
    const skill = SKILLS.find((candidate) => candidate.id === id)
    if (!skill) throw new Error(`Mortal precursor skill template missing: ${id}`)
    return skill
  }),
)

const validName = computed(() => isValidCharacterName(name.value))
const ready = computed(() => validName.value && selectedTalentIds.value.length === 1 && selectedSkillId.value !== '')

const pickedTalentName = computed(
  () => talents.value.find((talent) => talent.id === selectedTalentIds.value[0])?.name ?? '',
)
const pickedSkillName = computed(
  () => precursorSkills.value.find((skill) => skill.id === selectedSkillId.value)?.name ?? '',
)

function toggleTalent(talent: TalentDefinition) {
  if (rolling.value) return
  const index = selectedTalentIds.value.indexOf(talent.id)
  if (index >= 0) selectedTalentIds.value.splice(index, 1)
  else selectedTalentIds.value = [talent.id]
}
async function reroll() {
  if (rolling.value) return
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
    mortalBasicSkillId: selectedSkillId.value,
  }
  const validation = characterCreationService.validateDraft(payload, new Set(talents.value.map(talent => talent.id)))
  if (!validation.ok) { error.value = validation.message; return }
  // Per-attempt error state: a stale prior-attempt message must not drive
  // the finally's latch release or stay rendered after a success.
  error.value = ''
  creating.value = true
  try {
    const result = await characterCreationService.createCharacter(payload)
    if (!result.ok) { error.value = result.message; return }
    // Keep `creating` until unmount - the boot/save work that follows runs while
    // this screen is still displayed under the closing curtain.
    emit('complete', payload)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (error.value) creating.value = false
  }
}

onMounted(() => { void reroll() })
</script>

<template>
  <main class="creation-screen" data-testid="character-creation-screen">
    <InkWashBackdrop left-mountain right-mountain bottom-mist />
    <header class="creation-header">
      <GameButton variant="ghost" size="sm" :disabled="creating" @click="emit('back')">{{ t('onboarding.creation.back') }}</GameButton>
      <div><p>{{ t('onboarding.creation.headerKicker') }}</p><h1>{{ t('onboarding.creation.headerTitle') }}</h1></div>
    </header>

    <section class="creation-panel">
      <InkNineSlice asset-id="surface-xl-paper-scroll" layer="surface" />
      <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" />

      <div class="creation-section name-section">
        <p class="kicker">{{ t('onboarding.creation.nameStep.kicker') }}</p><h2>{{ t('onboarding.creation.nameStep.title') }}</h2>
        <p>{{ t('onboarding.creation.nameStep.description') }}</p>
        <label><span>{{ t('onboarding.creation.nameStep.label') }}</span><input v-model="name" maxlength="20" autofocus :placeholder="t('onboarding.creation.nameStep.placeholder')" data-testid="creation-name-input" /></label>
        <small :class="{ valid: validName }">{{ t('onboarding.creation.nameStep.minLengthHint', { length: name.length }) }}</small>
      </div>

      <div class="creation-section talent-section">
        <div class="panel-heading"><div><p class="kicker">{{ t('onboarding.creation.talentStep.kicker') }}</p><h2>{{ t('onboarding.creation.talentStep.title') }}</h2></div><strong>{{ t('onboarding.creation.talentStep.selected', { count: selectedTalentIds.length }) }}</strong></div>
        <p v-if="rolling && talents.length === 0" class="loading-roll">{{ t('onboarding.creation.talentStep.rolling') }}</p>
        <p v-else-if="error && talents.length === 0" class="loading-roll">{{ error }}</p>
        <div v-else class="talent-grid" :class="{ 'is-rolling': rolling }" :aria-busy="rolling">
          <button v-for="talent in talents" :key="talent.id" type="button" class="talent-card" :data-testid="`creation-talent-${talent.id}`" :class="[`talent-tier-${talent.rarity}`, { selected: selectedTalentIds.includes(talent.id) }]" :disabled="rolling" @click="toggleTalent(talent)">
            <span class="talent-card__rarity">{{ TALENT_RARITY_LABELS[talent.rarity] }}</span><h3>{{ talent.name }}</h3><p>{{ talent.description }}</p><small>{{ talent.tags[0] }}</small>
          </button>
        </div>
        <div class="section-actions"><GameButton variant="secondary" :disabled="rolling" @click="reroll">{{ t('onboarding.creation.talentStep.reroll') }}</GameButton></div>
      </div>

      <div class="creation-section skill-section">
        <div class="panel-heading"><div><p class="kicker">{{ t('onboarding.creation.skillStep.kicker') }}</p><h2>{{ t('onboarding.creation.skillStep.title') }}</h2></div><strong>{{ t('onboarding.creation.skillStep.selected', { count: selectedSkillId === '' ? 0 : 1 }) }}</strong></div>
        <p class="section-description">{{ t('onboarding.creation.skillStep.description') }}</p>
        <div class="skill-grid">
          <button v-for="skill in precursorSkills" :key="skill.id" type="button" class="skill-card" :data-testid="`creation-skill-${skill.id}`" :class="{ selected: selectedSkillId === skill.id }" @click="selectedSkillId = skill.id">
            <h3>{{ skill.name }}</h3><p>{{ skill.description }}</p>
          </button>
        </div>
      </div>

      <p v-if="error && talents.length > 0" class="creation-error">{{ error }}</p>
      <footer class="panel-actions">
        <p v-if="ready" class="creation-summary" data-testid="creation-summary">{{ t('onboarding.creation.summary', { name: name.trim(), talent: pickedTalentName, skill: pickedSkillName }) }}</p>
        <GameButton variant="primary" :disabled="!ready || creating" data-testid="creation-finish" @click="finish">{{ creating ? t('onboarding.creation.creating') : t('onboarding.creation.finish') }}</GameButton>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.creation-screen { position: relative; width: 100vw; height: 100vh; box-sizing: border-box; overflow: auto; padding: 22px clamp(20px,5vw,72px) 34px; color: var(--paper-text, #211f1a); background: var(--paper-50, #f5f0e4); }
.creation-header,.creation-panel { position: relative; z-index: 1; }
.creation-header { max-width: 1120px; margin: 0 auto 18px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; text-align: center; }.creation-header button { justify-self: start; }.creation-header p,.kicker { margin: 0; color: var(--chrome-500); font-size: var(--text-xs); letter-spacing: .25em; }.creation-header h1 { margin: 4px 0; font: 700 var(--text-display) var(--font-display); }
.creation-panel { position: relative; isolation: isolate; max-width: 1120px; margin: auto; box-sizing: border-box; border-radius: 0; padding: clamp(40px,4vw,56px) clamp(30px,5vw,64px); background: transparent; box-shadow: none; }
.creation-panel > :not(.ink-nine-slice) { position: relative; z-index: 3; }
.creation-section { margin-bottom: 28px; }.creation-section h2 { margin: 5px 0 8px; font: 600 var(--text-display) var(--font-display); }.creation-section>p:not(.kicker) { color: var(--paper-text-soft, #5e5a50); }
.name-section label { display: grid; gap: 8px; margin: 16px 0 8px; color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); }.name-section input { padding: 15px; border: 1px solid var(--paper-line, rgba(42,41,36,.42)); border-radius: 2px; background: color-mix(in srgb, var(--paper-50, #f5f0e4) 88%, transparent); color: var(--paper-text, #211f1a); font: 600 var(--text-panel-title) var(--font-display); text-align: center; outline: none; }.name-section input:focus { border-color: var(--cinnabar, #b54432); }.name-section small { display: block; color: var(--text-muted); }.name-section small.valid { color: var(--jade); }
.panel-heading { display: flex; justify-content: space-between; align-items: end; margin-bottom: 14px; }.panel-heading strong { color: var(--cinnabar, #b54432); font-size: var(--text-xs); }.section-description { color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); margin: 0 0 12px; }
.talent-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }.talent-card { position: relative; min-height: 128px; padding: 15px; border: 1px solid var(--paper-line, rgba(42,41,36,.42)); border-radius: 2px; background: color-mix(in srgb, var(--paper-50, #f5f0e4) 88%, transparent); color: var(--paper-text, #211f1a); text-align: left; cursor: pointer; transition: transform .15s,border-color .15s; }.talent-card:hover { transform: translateY(-2px); }.talent-card.selected { border-color: var(--cinnabar, #b54432); box-shadow: inset 0 0 0 1px var(--cinnabar, #b54432); }.talent-card__rarity { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .13em; }.talent-card h3 { margin: 7px 0; font: 600 var(--text-md) var(--font-display); }.talent-card p { margin: 0 0 8px; color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); line-height: 1.5; }.talent-card small { color: var(--text-muted); }
.talent-grid.is-rolling { opacity: .45; pointer-events: none; }.talent-tier-pham .talent-card__rarity{color:var(--rank-color-1)}.talent-tier-linh .talent-card__rarity{color:var(--rank-color-3)}.talent-tier-dia .talent-card__rarity{color:var(--rank-color-5)}.talent-tier-thien .talent-card__rarity{color:var(--rank-color-7)}.talent-tier-di .talent-card__rarity{color:var(--rank-color-8)}
.section-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
.skill-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }.skill-card { min-height: 96px; padding: 15px; border: 1px solid var(--paper-line, rgba(42,41,36,.42)); border-radius: 2px; background: color-mix(in srgb, var(--paper-50, #f5f0e4) 88%, transparent); color: var(--paper-text, #211f1a); text-align: left; cursor: pointer; transition: transform .15s,border-color .15s; }.skill-card:hover { transform: translateY(-2px); }.skill-card.selected { border-color: var(--cinnabar, #b54432); box-shadow: inset 0 0 0 1px var(--cinnabar, #b54432); }.skill-card h3 { margin: 0 0 7px; font: 600 var(--text-md) var(--font-display); }.skill-card p { margin: 0; color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); line-height: 1.5; }
.loading-roll { min-height: min(220px, 30vh); display: grid; place-items: center; color: var(--cinnabar, #b54432); font-family: var(--font-display); }.creation-error { margin: 14px 0 0; color: var(--crimson); text-align: center; font-size: var(--text-xs); }
.panel-actions { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 22px; }
.creation-summary { margin: 0; color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); }
@media(max-width:760px){.talent-grid,.skill-grid{grid-template-columns:1fr 1fr}.creation-header{grid-template-columns:1fr auto}.creation-header>div{grid-column:1/-1;grid-row:1}.creation-header button{grid-row:2}.panel-heading{align-items:start}}
</style>
