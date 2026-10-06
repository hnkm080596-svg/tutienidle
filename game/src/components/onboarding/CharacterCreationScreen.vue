<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { characterCreationService } from '@/services/character/CharacterCreationServiceFactory'
import { isValidCharacterName } from '@/services/character/CharacterCreationService'
import { TALENT_RARITY_LABELS, type TalentDefinition, type TalentTag } from '@/core/talent/Talent'
import type { RemoteCharacterMetadata } from '@/services/session/BackendStatus'
import { useAudioStore } from '@/stores/audio'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { CREATION_SKILL_PREVIEW } from '@/components/scenes/creation/creationPreview'
import { DAO_NAME_POOL } from '@/data/creation/DaoNamePool'
import { talentSymbolId, stableSymbolUrl, type StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

// The committed creation contract remains name + talent only.
// Beta grants Linh Bao; the other dao-lo cells are locked previews.
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

// Minh ruling: one random button randomizes every section the player has
// not directly filled/picked; touched sections are never overridden.
const nameTouched = ref(false)
const pathTouched = ref(false)
const talentTouched = ref(false)

const { t } = useI18n()

// Dao-lo row IS the starter-skill row (Minh ruling): each cell maps to a
// mortal precursor option; only Tu Phap (linh_bao) is unlocked in beta.
// The two trailing cells are unrevealed placeholders. The pick stays
// local UI state and never enters the payload.
interface DaoLoCell { skillId: string | null; labelKey: string; locked: boolean }
const DAO_LO_CELLS: readonly DaoLoCell[] = [
  { skillId: 'tram', labelKey: 'tuKiem', locked: true },
  { skillId: 'linh_bao', labelKey: 'tuPhap', locked: false },
  { skillId: 'huy_quyen', labelKey: 'tuThe', locked: true },
  { skillId: null, labelKey: 'hidden', locked: true },
  { skillId: null, labelKey: 'hidden', locked: true },
]
const starterBySkillId = new Map(CREATION_SKILL_PREVIEW.map((option) => [option.id, option]))
const pickedPathId = ref<string | null>('linh_bao')
function pickPath(cell: DaoLoCell) {
  if (cell.locked || creating.value) return
  pickedPathId.value = cell.skillId
  pathTouched.value = true
}

const TALENT_GRID_SIZE = 9
const lockedTalentSlots = computed(() => Math.max(0, TALENT_GRID_SIZE - talents.value.length))
const tagSymbols: Record<TalentTag, StableSymbolId> = {
  cultivation: 'realm', combat: 'skill', defense: 'body', resource: 'inventory',
  crafting: 'alchemy', element: 'technique', skill: 'skill', risk_reward: 'exploration', mechanic: 'settings',
}
function talentIcon(talent: TalentDefinition) {
  return stableSymbolUrl(talentSymbolId(talent.id, tagSymbols[talent.tags[0] ?? 'cultivation']))
}
const selectedTalent = computed(
  () => talents.value.find((talent) => talent.id === selectedTalentIds.value[0]) ?? null,
)

const validName = computed(() => isValidCharacterName(name.value))
const ready = computed(() => validName.value && selectedTalentIds.value.length === 1)

const pickedTalentName = computed(() => selectedTalent.value?.name ?? '')
const summary = computed(() =>
  t('onboarding.creation.summary', { name: name.value.trim(), talent: pickedTalentName.value }),
)

function masterRandom() {
  if (creating.value) return
  useAudioStore().cue('progress.reroll')
  if (!nameTouched.value || !name.value.trim()) {
    const roll = () => DAO_NAME_POOL[Math.floor(Math.random() * DAO_NAME_POOL.length)] ?? 'Lạc Vân Trần'
    let pick = roll()
    if (DAO_NAME_POOL.length > 1) {
      while (pick === name.value) pick = roll()
    }
    name.value = pick
  }
  if (!pathTouched.value) {
    const open = DAO_LO_CELLS.filter((cell) => cell.skillId !== null && !cell.locked)
    const cell = open[Math.floor(Math.random() * open.length)]
    if (cell) pickedPathId.value = cell.skillId
  }
  if ((!talentTouched.value || selectedTalentIds.value.length === 0) && talents.value.length > 0) {
    const options = talents.value.filter((talent) => talent.id !== selectedTalentIds.value[0])
    const pool = options.length > 0 ? options : talents.value
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (pick) selectedTalentIds.value = [pick.id]
  }
}

function toggleTalent(talent: TalentDefinition) {
  if (rolling.value || creating.value) return
  const index = selectedTalentIds.value.indexOf(talent.id)
  if (index >= 0) selectedTalentIds.value.splice(index, 1)
  else selectedTalentIds.value = [talent.id]
  talentTouched.value = true
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

const art = {
  panel: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/trial-creation-panel-v2.png'),
  cloud: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/cloud-ornament@2x.png'),
}
const style = { '--trial-panel': `url('${art.panel}')` }
</script>

<template>
  <section class="trial-creation-art hk-art-scene" :style="style" data-testid="character-creation-screen" data-hk-scene="creation">
    <PcPaperButton class="trial-back" variant="secondary" data-testid="creation-back" :disabled="creating" @click="emit('back')">‹ {{ t('onboarding.creation.back') }}</PcPaperButton>
    <header class="trial-heading"><img :src="art.cloud" alt=""></header>
    <div class="trial-brush-ring" aria-hidden="true"><svg viewBox="0 0 500 500"><circle cx="250" cy="250" r="222" fill="none" stroke="currentColor" stroke-width="9" stroke-dasharray="340 7 100 12 32 3 190 9" /><circle cx="250" cy="250" r="210" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="160 8 40 12" /><circle cx="250" cy="250" r="234" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="6 8 100 4" /></svg><img v-for="position in ['top','right','bottom','left']" :key="position" :class="`trial-cloud-${position}`" :src="art.cloud" alt=""></div>
    <section class="trial-creation-board" data-hk-region="creation-card">
      <div class="trial-name-row" data-hk-region="name-section"><span class="trial-name-label">{{ t('onboarding.creation.nameStep.sectionTitle') }}</span><input v-model="name" data-testid="creation-name-input" maxlength="20" :disabled="creating" :aria-invalid="name.length > 0 && !validName" :aria-label="t('onboarding.creation.nameStep.label')" :placeholder="t('onboarding.creation.nameStep.placeholder')" aria-describedby="creation-name-desc" @input="nameTouched = true"><span id="creation-name-desc" class="creation-visually-hidden">{{ t('onboarding.creation.nameStep.minLengthHint', { length: name.length }) }}</span><PcPaperButton icon variant="secondary" class="trial-name-random" data-testid="creation-random-all" :disabled="creating" :aria-label="t('onboarding.creation.talentStep.randomAll')" @click="masterRandom">⚄</PcPaperButton></div>
      <h2 class="trial-section-title trial-path-title">{{ t('onboarding.creation.pathStep.sectionTitle') }}</h2>
      <p class="trial-path-description">{{ t('onboarding.creation.pathStep.description') }}</p>
      <div class="trial-paths" data-hk-region="dao-lo" role="radiogroup" :aria-label="t('onboarding.creation.pathStep.sectionTitle')">
        <button v-for="(cell, index) in DAO_LO_CELLS" :key="cell.skillId ?? `hidden-${index}`" type="button" role="radio" :aria-checked="pickedPathId === cell.skillId" class="trial-path-cell" :class="{ selected: pickedPathId === cell.skillId, locked: cell.locked }" :disabled="cell.locked || creating" :title="cell.skillId ? starterBySkillId.get(cell.skillId)?.description : undefined" :data-testid="cell.skillId ? `creation-starter-${cell.skillId}` : `creation-starter-hidden-${index}`" @click="pickPath(cell)"><InkNineSlice :chrome-id="pickedPathId === cell.skillId ? 'seal-chip' : 'button-compact'" layer="surface" /><span class="trial-path-cell__label">{{ cell.skillId ? t(`onboarding.creation.pathStep.paths.${cell.labelKey}`) : '?' }}</span></button>
      </div>
      <h2 class="trial-section-title trial-talent-title">{{ t('onboarding.creation.talentStep.sectionTitle') }}</h2>
      <div class="trial-talent-workspace">
        <div class="trial-talent-grid" data-hk-region="talent-grid" role="radiogroup" :aria-label="t('onboarding.creation.talentStep.sectionTitle')">
          <button v-for="talent in talents" :key="talent.id" type="button" role="radio" :aria-checked="selectedTalentIds.includes(talent.id)" :data-testid="`creation-talent-${talent.id}`" :class="{ selected: selectedTalentIds.includes(talent.id) }" :disabled="rolling || creating" @click="toggleTalent(talent)"><span class="trial-talent-seal"><img :src="talentIcon(talent)" alt=""></span><b>{{ talent.name }}</b></button>
          <button v-for="slot in lockedTalentSlots" :key="`locked-${slot}`" type="button" disabled class="locked" :data-testid="`creation-locked-talent-${slot}`"><b>?</b><i>{{ t('onboarding.creation.talentStep.locked') }}</i></button>
        </div>
        <aside class="trial-talent-detail" aria-live="polite">
          <template v-if="selectedTalent">
            <span class="trial-talent-seal"><img :src="talentIcon(selectedTalent)" alt=""></span>
            <h3>{{ selectedTalent.name }} · {{ TALENT_RARITY_LABELS[selectedTalent.rarity] }}</h3>
            <p>{{ selectedTalent.description }}</p>
            <h4 class="trial-section-title">{{ t('onboarding.creation.talentStep.features') }}</h4>
            <ul><li v-for="tag in selectedTalent.tags" :key="tag">{{ t(`onboarding.creation.talentStep.tags.${tag}`) }}</li></ul>
          </template>
          <p v-else class="trial-talent-detail__empty">{{ rolling ? t('onboarding.creation.talentStep.rolling') : t('onboarding.creation.talentStep.hint') }}</p>
        </aside>
      </div>
      <PcPaperButton variant="secondary" class="trial-begin" data-testid="creation-finish" data-hk-region="primary-action" :aria-disabled="!ready || creating" @click="finish">{{ creating ? t('onboarding.creation.creating') : t('onboarding.creation.finish') }}</PcPaperButton>
      <p class="trial-notice" role="status" aria-live="polite" aria-atomic="true"><template v-if="talents.length > 0 && error">{{ error }}</template><template v-else-if="ready">{{ summary }}</template></p>
    </section>
  </section>
</template>

<style scoped>
.trial-creation-art { position: absolute; inset: 0; }
.trial-back { position: absolute; top: 20px; left: 22px; min-width: 125px; z-index: 2; font-size: 19px; }
.trial-heading { position: absolute; left: 175px; right: 40px; top: 20px; height: 82px; border-bottom: 1px solid #b08a47; }
.trial-heading img { position: absolute; right: 20px; top: -7px; width: 280px; height: 95px; object-fit: contain; opacity: .5; }
.trial-brush-ring { position: absolute; left: 82px; top: 170px; width: 550px; height: 550px; color: #ae813c; opacity: .6; pointer-events: none; }
.trial-brush-ring svg { width: 100%; height: 100%; }
.trial-brush-ring img { position: absolute; width: 190px; height: 90px; object-fit: contain; }
.trial-cloud-top { top: 5px; right: 25px; }.trial-cloud-right { right: -40px; top: 180px; }.trial-cloud-bottom { bottom: 20px; left: 15px; }.trial-cloud-left { left: -45px; top: 140px; }
.trial-creation-board { position: absolute; top: 110px; right: 40px; width: 700px; height: 650px; padding: 38px 28px 22px; color: #f1e2c0; background: var(--trial-panel) center / contain no-repeat; }
.trial-creation-board::before { display: none; }
.trial-section-title { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 0 0 8px; font: 700 22px var(--pc-font-body); }
.trial-section-title::before, .trial-section-title::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg,transparent,#b6934c); }
.trial-section-title::after { transform: rotate(180deg); }
.trial-talent-workspace { display: grid; grid-template-columns: 350px 1fr; gap: 18px; height: 260px; }
.trial-talent-grid { display: grid; grid-template-columns: repeat(3,1fr); grid-template-rows: repeat(3,minmax(0,1fr)); gap: 9px; }
.trial-talent-grid button { min-width: 0; min-height: 93px; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border: 3px double #8c794f; background: linear-gradient(145deg,#323025,#181e19); color: #f1e2c0; cursor: pointer; font: 15px var(--pc-font-body); }
.trial-talent-grid button.selected { border-color: #e2b257; background: radial-gradient(#b48b3d,#382b17); box-shadow: inset 0 0 12px #deb35b70,0 0 7px #cf9e4a60; }
.trial-talent-grid button:hover:not(.selected):not(:disabled) { border-color: #c3a464; background: #403b2b; }
.trial-talent-grid button.locked { cursor: default; color: #8a7c56; background: linear-gradient(145deg,#26241d,#131713); }
.trial-talent-grid button.locked b { font-size: 26px; line-height: 1; color: #6f633f; }
.trial-talent-grid button.locked i { font-style: normal; font-size: 12px; color: #6f633f; }
/* Real talent names can be longer than the mock's sample names - keep
   them on one line so a 2-line name cannot stretch the tile past the
   mock's 93px row height (the full name shows in the detail aside). */
.trial-talent-grid button b { max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: inherit; }
.trial-talent-seal { display: grid; place-items: center; width: 49px; height: 49px; border-radius: 50%; border: 3px double #c7ad78; background: radial-gradient(#463d28,#1b211a); }
.trial-talent-seal img { width: 35px; height: 35px; object-fit: contain; }
.trial-talent-detail { padding: 12px 16px; border: 3px double #9c844f; background: #161b17b0; text-align: center; overflow: auto; }
.trial-talent-detail .trial-talent-seal { margin: 0 auto; }
.trial-talent-detail h3 { font-size: 24px; margin: 7px 0; }
.trial-talent-detail p { font-size: 14px; line-height: 1.35; margin: 7px 0 14px; text-align: left; }
.trial-talent-detail h4 { font-size: 18px; }
.trial-talent-detail ul { text-align: left; padding-left: 16px; font-size: 14px; line-height: 1.35; margin: 0; }
.trial-talent-detail li { margin-bottom: 4px; }
.trial-talent-detail li::marker { color: #dbb260; }
.trial-talent-detail__empty { text-align: center; color: #b9a77f; }
.trial-name-row { display: flex; align-items: center; gap: 12px; padding: 0 55px; margin: 10px 0 4px; }
.trial-name-label { flex: 0 0 auto; color: #e8cf9e; font: 700 22px var(--pc-font-body); white-space: nowrap; }
.trial-name-random { flex: 0 0 auto; min-height: 42px; font-size: 26px; }
.trial-name-row input { min-width: 0; flex: 1; height: 42px; padding: 8px 16px; border: 1px solid #b49860; background: #1b211a; color: #f1e2c0; font: 15px var(--pc-font-body); }
.trial-name-row input::placeholder { color: #aaa18b; }
.trial-path-title { margin: 14px 0 4px; font-size: 18px; }
.trial-path-description { margin: 0 0 8px; font-size: 14px; text-align: center; }
.trial-talent-title { margin-top: 20px; }
.trial-paths { display: grid; grid-template-columns: repeat(5,1fr); gap: 11px; }
.trial-path-cell { position: relative; isolation: isolate; display: flex; align-items: center; justify-content: center; padding: 7px 8px; min-height: 44px; border: 0; background: transparent; color: #f1e2c0; font: 15px var(--pc-font-body); cursor: pointer; }
.trial-path-cell > :not(.ink-nine-slice) { position: relative; z-index: 2; }
.trial-path-cell.selected .trial-path-cell__label { color: #2f2415; font-weight: 700; }
.trial-path-cell.locked { cursor: default; }
.trial-path-cell.locked .ink-nine-slice { opacity: .4; }
.trial-path-cell.locked .trial-path-cell__label { color: #8a7c56; }
.trial-begin { position: absolute; left: 50%; bottom: 28px; transform: translate(-50%, 50%); display: block; width: 345px; min-height: 56px; margin: 9px auto 0; font-size: 27px; }
.trial-begin[aria-disabled="true"] { opacity: .55; cursor: not-allowed; }
.trial-notice { position: absolute; bottom: -35px; left: 0; right: 0; text-align: center; color: #543d21; font-size: 16px; margin: 0; min-height: 1.2em; }
.creation-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
