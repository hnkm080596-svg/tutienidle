<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import HuyenKimParallaxStack from '@/components/common/HuyenKimParallaxStack.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { TALENT_RARITY_LABELS, type TalentDefinition } from '@/core/talent/Talent'
import { characterCreationService } from '@/services/character/CharacterCreationServiceFactory'
import { isValidCharacterName } from '@/services/character/CharacterCreationService'
import type { RemoteCharacterMetadata } from '@/services/session/BackendStatus'
import { useAudioStore } from '@/stores/audio'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

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

const { t, te } = useI18n()
const sectionPlaqueUrl = hkChromeUrl('section-plaque')

// ui-audit creation-meta - talent tag chips rendered raw enum values
// ('combat', 'risk_reward'); route through locale keys, fall back to the
// raw tag only when a future tag ships without a label.
function talentTagLabel(tag: string): string {
  const key = `onboarding.creation.talentStep.tags.${tag}`
  return te(key) ? t(key) : tag
}

const validName = computed(() => isValidCharacterName(name.value))
const ready = computed(() => validName.value && selectedTalentIds.value.length === 1)

const pickedTalentName = computed(
  () => talents.value.find((talent) => talent.id === selectedTalentIds.value[0])?.name ?? '',
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
  <main class="creation-screen" data-testid="character-creation-screen" data-hk-scene="creation">
    <HuyenKimParallaxStack stack="auth-creation" />
    <GameButton class="creation-back" variant="ghost" size="sm" :disabled="creating" @click="emit('back')">{{ t('onboarding.creation.back') }}</GameButton>

    <section class="creation-panel" data-hk-region="creation-card">
      <InkNineSlice chrome-id="surface-xl-scroll" layer="surface" />
      <InkNineSlice chrome-id="frame-xl-ceremony" layer="frame" />

      <header class="creation-title"><p>{{ t('onboarding.creation.headerKicker') }}</p><h1>{{ t('onboarding.creation.headerTitle') }}</h1></header>

      <div class="creation-section name-section">
        <p class="kicker">{{ t('onboarding.creation.nameStep.kicker') }}</p><h2 class="creation-plaque"><img v-if="sectionPlaqueUrl" :src="sectionPlaqueUrl" alt="" aria-hidden="true" /><span>{{ t('onboarding.creation.nameStep.title') }}</span></h2>
        <p>{{ t('onboarding.creation.nameStep.description') }}</p>
        <label><span>{{ t('onboarding.creation.nameStep.label') }}</span><span class="creation-field"><InkNineSlice chrome-id="text-field" layer="surface" /><input v-model="name" maxlength="20" autofocus :disabled="creating" :placeholder="t('onboarding.creation.nameStep.placeholder')" data-testid="creation-name-input" /></span></label>
        <small :class="{ valid: validName }">{{ t('onboarding.creation.nameStep.minLengthHint', { length: name.length }) }}</small>
      </div>

      <div class="creation-section talent-section">
        <div class="panel-heading"><div><p class="kicker">{{ t('onboarding.creation.talentStep.kicker') }}</p><h2 class="creation-plaque"><img v-if="sectionPlaqueUrl" :src="sectionPlaqueUrl" alt="" aria-hidden="true" /><span>{{ t('onboarding.creation.talentStep.title') }}</span></h2></div><strong>{{ t('onboarding.creation.talentStep.selected', { count: selectedTalentIds.length }) }}</strong></div>
        <p v-if="rolling && talents.length === 0" class="loading-roll">{{ t('onboarding.creation.talentStep.rolling') }}</p>
        <p v-else-if="error && talents.length === 0" class="loading-roll">{{ error }}</p>
        <div v-else class="talent-grid" :class="{ 'is-rolling': rolling }" :aria-busy="rolling" data-hk-region="talent-grid">
          <button v-for="talent in talents" :key="talent.id" type="button" class="talent-card" :data-testid="`creation-talent-${talent.id}`" :class="[`talent-tier-${talent.rarity}`, { selected: selectedTalentIds.includes(talent.id) }]" :disabled="rolling || creating" @click="toggleTalent(talent)">
            <span class="talent-card__rarity">{{ TALENT_RARITY_LABELS[talent.rarity] }}</span><h3>{{ talent.name }}</h3><p>{{ talent.description }}</p><small>{{ talentTagLabel(talent.tags[0] ?? '') }}</small>
          </button>
        </div>
        <div class="section-actions"><GameButton variant="secondary" :disabled="rolling || creating" @click="reroll">{{ t('onboarding.creation.talentStep.reroll') }}</GameButton></div>
      </div>

      <p v-if="error && talents.length > 0" class="creation-error">{{ error }}</p>
      <footer class="panel-actions">
        <p v-if="ready" class="creation-summary" data-testid="creation-summary">{{ t('onboarding.creation.summary', { name: name.trim(), talent: pickedTalentName }) }}</p>
        <GameButton variant="primary" size="lg" :disabled="!ready || creating" data-testid="creation-finish" data-hk-region="primary-action" @click="finish">{{ creating ? t('onboarding.creation.creating') : t('onboarding.creation.finish') }}</GameButton>
      </footer>
    </section>
  </main>
</template>

<style scoped>
/* Scene 02 spec: vista dominant on the left ~56%; creation scroll
   anchored right (design x=940 w=660 -> ~40% width, ~4.3% margin),
   back button floating top-left. */
.creation-screen { position: relative; width: 100vw; height: 100vh; box-sizing: border-box; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1fr) clamp(500px, 39.5vw, 660px); gap: clamp(16px, 3vw, 48px); padding: 16px clamp(20px, 4.3vw, 72px) 18px clamp(20px, 4vw, 64px); color: var(--paper-text, #211f1a); background: var(--paper-50, #f5f0e4); }
.creation-back { position: absolute; top: 20px; left: 20px; z-index: 2; }
.creation-panel { position: relative; z-index: 1; isolation: isolate; grid-column: 2; align-self: center; max-height: calc(100vh - 34px); box-sizing: border-box; border-radius: 0; padding: clamp(26px, 4vh, 48px) clamp(54px, 4.6vw, 72px); background: transparent; box-shadow: none; overflow-y: auto; scrollbar-width: none; }
.creation-panel::-webkit-scrollbar { display: none; }
.creation-title { text-align: center; margin-bottom: 10px; }
.creation-title p,.kicker { margin: 0; color: var(--hk-gold, var(--chrome-500)); font-size: var(--text-xs); letter-spacing: .25em; }
.creation-title h1 { margin: 2px 0; font: 700 var(--text-panel-title) var(--font-display); }
@media (max-width: 1100px) {
  .creation-screen { grid-template-columns: 1fr; overflow-y: auto; }
  .creation-panel { grid-column: 1; max-height: none; }
}
.creation-panel > :not(.ink-nine-slice) { position: relative; z-index: 3; }
.creation-section { margin-bottom: 12px; }.creation-section h2 { margin: 4px 0 6px; font: 600 var(--text-panel-title) var(--font-display); }.creation-section>p:not(.kicker) { margin: 0 0 6px; color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); }
.name-section label { display: grid; gap: 6px; margin: 6px 0 4px; color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); }
.name-section label > span:first-of-type { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
/* The plaque title already names the section - the kicker overline is
   duplicate hierarchy the reference card does not carry. */
.creation-section .kicker { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.creation-field { position: relative; display: block; isolation: isolate; }
.creation-field .ink-nine-slice { z-index: 0; }
.name-section input { position: relative; z-index: 1; box-sizing: border-box; width: 100%; padding: 10px 14px; border: 0; border-radius: 2px; background: transparent; color: var(--hk-text-primary, #ede6d6); font: 600 var(--text-md) var(--font-display); text-align: center; outline: none; }.name-section input::placeholder { color: color-mix(in srgb, var(--hk-text-primary, #ede6d6) 42%, transparent); }.name-section input:focus { box-shadow: 0 0 0 2px color-mix(in srgb, var(--hk-gold, #c99a4a) 45%, transparent); }.name-section small { display: block; color: var(--text-muted); }.name-section small.valid { color: var(--jade); }
/* section-plaque chrome: PNG plaque behind the section title. */
.creation-plaque { position: relative; display: inline-grid; place-items: center; min-width: 180px; max-width: 100%; min-height: 30px; padding: 2px 24px; isolation: isolate; }
.creation-plaque span { position: relative; color: var(--hk-text-primary, #ede6d6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.creation-plaque img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; z-index: -1; pointer-events: none; }
.panel-heading { display: flex; justify-content: space-between; align-items: end; margin-bottom: 8px; }.panel-heading strong { color: var(--hk-jade-deep, #1f6b58); font-size: var(--text-xs); }.section-description { color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); margin: 0 0 12px; }
.talent-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }.talent-card { position: relative; min-height: 0; padding: 8px 9px 6px; border: 1px solid var(--hk-border-muted, rgba(122,98,52,.42)); border-radius: 2px; background: linear-gradient(170deg, color-mix(in srgb, var(--hk-surface-overlay, #1b2621) 92%, transparent), color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 96%, transparent)); color: var(--hk-text-primary, #ede6d6); text-align: left; cursor: pointer; transition: transform .15s,border-color .15s; }.talent-card:hover { transform: translateY(-2px); }.talent-card.selected { border-color: var(--hk-border-ceremony, #e8c35a); box-shadow: inset 0 0 0 1px var(--hk-border-ceremony, #e8c35a); background: linear-gradient(170deg, color-mix(in srgb, var(--hk-jade-deep, #1f6b58) 55%, var(--hk-surface-overlay, #1b2621)), var(--hk-surface-base, #0b0f0d)); }.talent-card__rarity { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .13em; }.talent-card h3 { margin: 5px 0 4px; font: 600 var(--text-xs) var(--font-display); line-height: 1.25; }.talent-card p { margin: 0 0 4px; color: color-mix(in srgb, var(--hk-text-primary, #ede6d6) 66%, transparent); font-size: var(--text-xs); line-height: 1.35; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden; }.talent-card small { color: color-mix(in srgb, var(--hk-text-primary, #ede6d6) 45%, transparent); font-size: var(--text-xs); }
.talent-grid.is-rolling { opacity: .45; pointer-events: none; }.talent-tier-pham .talent-card__rarity{color:var(--rank-color-1)}.talent-tier-linh .talent-card__rarity{color:var(--rank-color-3)}.talent-tier-dia .talent-card__rarity{color:var(--rank-color-5)}.talent-tier-thien .talent-card__rarity{color:var(--rank-color-7)}.talent-tier-di .talent-card__rarity{color:var(--rank-color-8)}
.section-actions { display: flex; justify-content: flex-end; margin-top: 6px; }
.loading-roll { min-height: 140px; display: grid; place-items: center; color: var(--hk-gold, #c99a4a); font-family: var(--font-display); }.creation-error { margin: 10px 0 0; color: var(--hk-cinnabar, var(--crimson)); text-align: center; font-size: var(--text-xs); }
/* Sticky footer keeps the commit CTA reachable inside the scroll card's
   safe area even when sections grow (long error text, tall content). */
.panel-actions { position: sticky; bottom: 0; z-index: 4; display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 12px; padding: 6px 0 2px; background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--paper-50, #f5f0e4) 82%, transparent) 38%); }
.creation-summary { margin: 0; color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); }
@media(max-width:760px){.talent-grid{grid-template-columns:repeat(2,1fr)}.creation-header{grid-template-columns:1fr auto}.creation-header>div{grid-column:1/-1;grid-row:1}.creation-header button{grid-row:2}.panel-heading{align-items:start}}
</style>
