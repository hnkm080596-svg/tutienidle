<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import InkWashBackdrop from '@/components/common/InkWashBackdrop.vue'
import SysPanel from '@/components/common/system/SysPanel.vue'
import { TALENT_RARITY_LABELS, type TalentDefinition } from '@/core/talent/Talent'
import { characterCreationService } from '@/services/character/CharacterCreationServiceFactory'
import { isValidCharacterName, CHARACTER_CREATION_ATTRIBUTE_POINTS } from '@/services/character/CharacterCreationService'

export interface CharacterCreationPayload {
  name: string
  talentIds: string[]
  attributes: Record<'strength' | 'dexterity' | 'intelligence' | 'attunement' | 'vitality', number>
}

const emit = defineEmits<{ complete: [payload: CharacterCreationPayload]; back: [] }>()
const step = ref<1 | 2 | 3>(1)
const name = ref('')
const talents = ref<TalentDefinition[]>([])
const selectedTalentIds = ref<string[]>([])
const rolling = ref(false)
const error = ref('')
const creating = ref(false)
const attributes = ref<CharacterCreationPayload['attributes']>({ strength: 0, dexterity: 0, intelligence: 0, attunement: 0, vitality: 0 })

const { t } = useI18n()

const attributeLabels = computed<Record<keyof CharacterCreationPayload['attributes'], { name: string; hint: string }>>(() => ({
  strength: { name: t('onboarding.creation.attributes.strength.name'), hint: t('onboarding.creation.attributes.strength.hint') },
  dexterity: { name: t('onboarding.creation.attributes.dexterity.name'), hint: t('onboarding.creation.attributes.dexterity.hint') },
  intelligence: { name: t('onboarding.creation.attributes.intelligence.name'), hint: t('onboarding.creation.attributes.intelligence.hint') },
  attunement: { name: t('onboarding.creation.attributes.attunement.name'), hint: t('onboarding.creation.attributes.attunement.hint') },
  vitality: { name: t('onboarding.creation.attributes.vitality.name'), hint: t('onboarding.creation.attributes.vitality.hint') },
}))
const pointsSpent = computed(() => Object.values(attributes.value).reduce((sum, value) => sum + value, 0))
const pointsLeft = computed(() => CHARACTER_CREATION_ATTRIBUTE_POINTS - pointsSpent.value)
const validName = computed(() => isValidCharacterName(name.value))

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
function changeAttribute(key: keyof CharacterCreationPayload['attributes'], delta: number) {
  const next = attributes.value[key] + delta
  if (next < 0 || (delta > 0 && pointsLeft.value <= 0)) return
  attributes.value[key] = next
}
async function finish() {
  if (creating.value) return
  const payload = { name: name.value.trim(), talentIds: [...selectedTalentIds.value], attributes: { ...attributes.value } }
  const validation = characterCreationService.validateDraft(payload, new Set(talents.value.map(talent => talent.id)))
  if (!validation.ok) { error.value = validation.message; return }
  creating.value = true
  const result = await characterCreationService.createCharacter(payload)
  if (!result.ok) { creating.value = false; error.value = result.message; return }
  // Keep `creating` until unmount - the boot/save work that follows runs while
  // this screen is still displayed under the closing curtain.
  emit('complete', payload)
}

onMounted(() => { void reroll() })
</script>

<template>
  <main class="creation-screen" data-testid="character-creation-screen">
    <InkWashBackdrop left-mountain right-mountain bottom-mist />
    <header class="creation-header">
      <GameButton variant="system" accent-var="var(--sys-text-dim)" size="sm" @click="step === 1 ? emit('back') : step--">{{ t('onboarding.creation.back') }}</GameButton>
      <div><p>{{ t('onboarding.creation.headerKicker') }}</p><h1>{{ t('onboarding.creation.headerTitle') }}</h1></div>
      <span>{{ t('onboarding.creation.step', { step, total: 3 }) }}</span>
    </header>

    <!-- M-UI-OVERHAUL: stepper -> sys-seg segmented progress rail. -->
    <nav class="stepper sys-seg" :aria-label="t('onboarding.creation.stepperAria')">
      <i v-for="number in 3" :key="number" class="sys-seg__cell" :class="{ 'is-on': number <= step }" />
    </nav>

    <SysPanel v-if="step === 1" variant="primary" :rim-active="true" class="creation-panel name-step">
      <p class="kicker">{{ t('onboarding.creation.nameStep.kicker') }}</p><h2>{{ t('onboarding.creation.nameStep.title') }}</h2>
      <p>{{ t('onboarding.creation.nameStep.description') }}</p>
      <label><span>{{ t('onboarding.creation.nameStep.label') }}</span><input v-model="name" maxlength="20" autofocus :placeholder="t('onboarding.creation.nameStep.placeholder')" data-testid="creation-name-input" /></label>
      <small :class="{ valid: validName }">{{ t('onboarding.creation.nameStep.minLengthHint', { length: name.length }) }}</small>
      <GameButton variant="system" :disabled="!validName" data-testid="creation-continue-name" @click="step = 2">{{ t('onboarding.creation.nameStep.continue') }}</GameButton>
    </SysPanel>

    <SysPanel v-else-if="step === 2" variant="primary" :rim-active="true" class="creation-panel talent-step">
      <div class="panel-heading"><div><p class="kicker">{{ t('onboarding.creation.talentStep.kicker') }}</p><h2>{{ t('onboarding.creation.talentStep.title') }}</h2></div><strong>{{ t('onboarding.creation.talentStep.selected', { count: selectedTalentIds.length }) }}</strong></div>
      <p v-if="rolling && talents.length === 0" class="loading-roll">{{ t('onboarding.creation.talentStep.rolling') }}</p>
      <p v-else-if="error && talents.length === 0" class="loading-roll">{{ error }}</p>
      <div v-else class="talent-grid" :class="{ 'is-rolling': rolling }" :aria-busy="rolling">
        <button v-for="talent in talents" :key="talent.id" type="button" class="talent-card" :data-testid="`creation-talent-${talent.id}`" :class="[`talent-tier-${talent.rarity}`, { selected: selectedTalentIds.includes(talent.id) }]" :disabled="rolling" @click="toggleTalent(talent)">
          <span class="talent-card__rarity">{{ TALENT_RARITY_LABELS[talent.rarity] }}</span><h3>{{ talent.name }}</h3><p>{{ talent.description }}</p><small>{{ talent.tags[0] }}</small>
        </button>
      </div>
      <footer class="panel-actions"><GameButton variant="system" accent-var="var(--sys-text-dim)" :disabled="rolling" @click="reroll">{{ t('onboarding.creation.talentStep.reroll') }}</GameButton><GameButton variant="system" :disabled="selectedTalentIds.length !== 1" data-testid="creation-confirm-talent" @click="step = 3">{{ t('onboarding.creation.talentStep.confirm') }}</GameButton></footer>
    </SysPanel>

    <SysPanel v-else variant="primary" :rim-active="true" class="creation-panel attribute-step">
      <div class="panel-heading"><div><p class="kicker">{{ t('onboarding.creation.attributeStep.kicker') }}</p><h2>{{ t('onboarding.creation.attributeStep.title') }}</h2></div><strong class="points">{{ t('onboarding.creation.attributeStep.pointsLeft', { count: pointsLeft }) }}</strong></div>
      <div class="attribute-list">
        <div v-for="(label, key) in attributeLabels" :key="key" class="attribute-row" :data-testid="`creation-attribute-${key}`"><div><b>{{ label.name }}</b><small>{{ label.hint }}</small></div><div class="counter"><button type="button" @click="changeAttribute(key, -1)">−</button><span>{{ attributes[key] }}</span><button type="button" :data-testid="`creation-attribute-plus-${key}`" @click="changeAttribute(key, 1)">+</button></div></div>
      </div>
      <div class="creation-summary"><span>{{ name }}</span><span>{{ t('onboarding.creation.attributeStep.summaryTalent') }}</span><span>{{ t('onboarding.creation.attributeStep.summaryPoints') }}</span></div>
      <p v-if="error" class="creation-error">{{ error }}</p>
      <footer class="panel-actions"><GameButton variant="system" accent-var="var(--sys-text-dim)" :disabled="creating" @click="step = 2">{{ t('onboarding.creation.attributeStep.rechooseTalent') }}</GameButton><GameButton variant="system" :disabled="pointsLeft !== 0 || creating" data-testid="creation-finish" @click="finish">{{ creating ? t('onboarding.creation.attributeStep.creating') : t('onboarding.creation.attributeStep.finish') }}</GameButton></footer>
    </SysPanel>
  </main>
</template>

<style scoped>
.creation-screen { position: relative; width: 100vw; height: 100vh; box-sizing: border-box; overflow: auto; padding: 22px clamp(20px,5vw,72px) 34px; color: var(--paper-text, #211f1a); background: var(--paper-50, #f5f0e4); }
.creation-header,.stepper,.creation-panel { position: relative; z-index: 1; }
.creation-header { max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; text-align: center; }.creation-header button { justify-self: start; }.creation-header span { justify-self: end; color: var(--text-muted); font-size: var(--text-xs); }.creation-header p,.kicker { margin: 0; color: var(--sys-accent, var(--chrome-500)); font-size: var(--text-xs); letter-spacing: .25em; text-transform: uppercase; font-family: var(--sys-font-display, var(--font-body)); }.creation-header h1 { margin: 4px 0; font: 700 var(--text-display) var(--sys-font-display, var(--font-display)); text-transform: uppercase; letter-spacing: .08em; }
.stepper { max-width: 420px; margin: 18px auto 24px; display: flex; }
.creation-panel { position: relative; isolation: isolate; max-width: 1120px; margin: auto; box-sizing: border-box; padding: clamp(34px,4vw,52px) clamp(30px,5vw,64px); }
.creation-panel h2 { margin: 5px 0 8px; font: 600 var(--text-display) var(--sys-font-display, var(--font-display)); text-transform: uppercase; letter-spacing: .06em; }.creation-panel>p:not(.kicker) { color: var(--sys-text-muted, var(--paper-text-soft, #5e5a50)); }.name-step { max-width: 560px; text-align: center; }.name-step label { display: grid; gap: 8px; margin: 24px 0 8px; text-align: left; color: var(--sys-text-muted, var(--paper-text-soft, #5e5a50)); font-size: var(--text-xs); letter-spacing: .06em; text-transform: uppercase; font-family: var(--sys-font-display, var(--font-body)); }.name-step input { padding: 15px; border: 1px solid var(--sys-line-soft, var(--paper-line, rgba(42,41,36,.42))); border-radius: 0; background: var(--sys-bg-0, color-mix(in srgb, var(--paper-50, #f5f0e4) 88%, transparent)); color: var(--sys-text, var(--paper-text, #211f1a)); font: 600 var(--text-panel-title) var(--sys-font-display, var(--font-display)); text-align: center; outline: none; clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }.name-step input:focus { border-color: var(--sys-accent, var(--cinnabar, #b54432)); }.name-step small { display: block; margin-bottom: 28px; color: var(--sys-text-dim, var(--text-muted)); }.name-step small.valid { color: var(--sys-success, var(--jade)); }
.panel-heading { display: flex; justify-content: space-between; align-items: end; margin-bottom: 18px; }.panel-heading strong { color: var(--sys-accent, var(--cinnabar, #b54432)); font-size: var(--text-xs); font-variant-numeric: tabular-nums; }.talent-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }.talent-card { position: relative; min-height: 128px; padding: 15px; border: 1px solid var(--sys-line-soft, var(--paper-line, rgba(42,41,36,.42))); border-radius: 0; background: var(--sys-bg-0, color-mix(in srgb, var(--paper-50, #f5f0e4) 88%, transparent)); color: var(--sys-text, var(--paper-text, #211f1a)); text-align: left; cursor: pointer; transition: transform .15s,border-color .15s; clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px); }.talent-card:hover { transform: translateY(-2px); border-color: var(--sys-line, var(--paper-line)); }.talent-card.selected { border-color: var(--sys-accent, var(--cinnabar, #b54432)); box-shadow: inset 0 0 0 1px var(--sys-accent, #b54432), 0 0 14px color-mix(in srgb, var(--sys-accent, #b54432) 28%, transparent); }.talent-card__rarity { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .13em; }.talent-card h3 { margin: 7px 0; font: 600 var(--text-md) var(--sys-font-display, var(--font-display)); }.talent-card p { margin: 0 0 8px; color: var(--sys-text-muted, var(--paper-text-soft, #5e5a50)); font-size: var(--text-xs); line-height: 1.5; }.talent-card small { color: var(--sys-text-dim, var(--text-muted)); }
.talent-grid.is-rolling { opacity: .45; pointer-events: none; }.talent-tier-pham .talent-card__rarity{color:var(--rank-color-1)}.talent-tier-linh .talent-card__rarity{color:var(--rank-color-3)}.talent-tier-dia .talent-card__rarity{color:var(--rank-color-5)}.talent-tier-thien .talent-card__rarity{color:var(--rank-color-7)}.talent-tier-di .talent-card__rarity{color:var(--rank-color-8)}
.panel-actions { display: flex; justify-content: space-between; gap: 12px; margin-top: 22px; }.attribute-step { max-width: 700px; }.points { padding: 8px 12px; border: 1px solid var(--sys-line-soft, var(--paper-line, rgba(42,41,36,.42))); border-radius: 20px; color: var(--sys-accent, inherit); font-variant-numeric: tabular-nums; }.attribute-list { display: grid; gap: 8px; }.attribute-row { display: flex; justify-content: space-between; align-items: center; padding: 13px 16px; border: 1px solid var(--sys-line-soft, var(--paper-line, rgba(42,41,36,.42))); background: var(--sys-bg-0, color-mix(in srgb, var(--paper-50, #f5f0e4) 88%, transparent)); clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }.attribute-row>div:first-child { display: grid; gap: 3px; }.attribute-row small { color: var(--sys-text-dim, var(--text-muted)); }.counter { display: flex; align-items: center; gap: 16px; }.counter button { min-width: var(--tap-min); min-height: var(--tap-min); border: 1px solid var(--sys-line-soft, var(--paper-line, rgba(42,41,36,.42))); border-radius: 0; background: var(--sys-bg-0, var(--paper-50, #f5f0e4)); color: var(--sys-text, var(--paper-text, #211f1a)); font-family: var(--sys-font-display, var(--font-body)); cursor: pointer; clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px); }.counter button:hover { border-color: var(--sys-accent, var(--paper-line)); }.counter span { min-width: 18px; text-align: center; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--sys-accent, inherit); }.creation-summary { display: flex; justify-content: center; gap: 22px; margin-top: 20px; color: var(--sys-text-muted, var(--paper-text-soft, #5e5a50)); font-size: var(--text-xs); }
.loading-roll { min-height: min(380px, 50vh); display: grid; place-items: center; color: var(--sys-accent, var(--cinnabar, #b54432)); font-family: var(--sys-font-display, var(--font-display)); letter-spacing: .08em; }.creation-error { margin: 14px 0 0; color: var(--sys-danger, var(--crimson)); text-align: center; font-size: var(--text-xs); }
@media(max-width:760px){.talent-grid{grid-template-columns:1fr 1fr}.creation-header{grid-template-columns:1fr auto}.creation-header>div{grid-column:1/-1;grid-row:1}.creation-header button{grid-row:2}.creation-header span{grid-row:2}.panel-heading{align-items:start}.creation-summary{flex-wrap:wrap}}
</style>
