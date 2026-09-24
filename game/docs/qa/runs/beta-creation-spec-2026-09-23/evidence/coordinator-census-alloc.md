# Coordinator census: allocation path @44abadfb

## rg CHARACTER_CREATION_ATTRIBUTE_POINTS|\.attributes|attributeStep|createCharacterThroughUi|p_attributes (src+tests+locales)

```
src/core/simulation/earlygame/PerfectionEconomy.test.ts:16:import { CHARACTER_CREATION_ATTRIBUTE_POINTS } from '../../../services/character/CharacterCreationService'
src/core/simulation/earlygame/PerfectionEconomy.test.ts:40:      CHARACTER_CREATION_ATTRIBUTE_POINTS +
src/core/simulation/earlygame/PerfectionEconomy.ts:25:import { CHARACTER_CREATION_ATTRIBUTE_POINTS } from '../../../services/character/CharacterCreationService'
src/core/simulation/earlygame/PerfectionEconomy.ts:102:  const available = CHARACTER_CREATION_ATTRIBUTE_POINTS + breakthroughPoints
src/core/simulation/earlygame/PerfectionEconomy.ts:111:    creationPoints: CHARACTER_CREATION_ATTRIBUTE_POINTS,
src/services/character/SupabaseCharacterCreationService.ts:65:          p_attributes: draft.attributes,
src/services/character/CharacterCreationService.ts:3:export const CHARACTER_CREATION_ATTRIBUTE_POINTS = 5
src/services/character/CharacterCreationService.ts:53:  if (values.some(value => !Number.isInteger(value) || value < 0) || values.reduce((sum, value) => sum + value, 0) !== CHARACTER_CREATION_ATTRIBUTE_POINTS) {
src/components/onboarding/CharacterCreationScreen.test.ts:5:import { CHARACTER_CREATION_ATTRIBUTE_POINTS } from '@/services/character/CharacterCreationService'
src/components/onboarding/CharacterCreationScreen.test.ts:52:  it('remaining points derive from the shared CHARACTER_CREATION_ATTRIBUTE_POINTS', async () => {
src/components/onboarding/CharacterCreationScreen.test.ts:58:    expect(points.textContent).toContain(String(CHARACTER_CREATION_ATTRIBUTE_POINTS))
src/components/onboarding/CharacterCreationScreen.test.ts:63:    expect(points.textContent).toContain(String(CHARACTER_CREATION_ATTRIBUTE_POINTS - 1))
src/components/onboarding/CharacterCreationScreen.vue:9:import { isValidCharacterName, CHARACTER_CREATION_ATTRIBUTE_POINTS } from '@/services/character/CharacterCreationService'
src/components/onboarding/CharacterCreationScreen.vue:37:const pointsLeft = computed(() => CHARACTER_CREATION_ATTRIBUTE_POINTS - pointsSpent.value)
src/components/onboarding/CharacterCreationScreen.vue:120:      <div class="panel-heading"><div><p class="kicker">{{ t('onboarding.creation.attributeStep.kicker') }}</p><h2>{{ t('onboarding.creation.attributeStep.title') }}</h2></div><strong class="points">{{ t('onboarding.creation.attributeStep.pointsLeft', { count: pointsLeft }) }}</strong></div>
src/components/onboarding/CharacterCreationScreen.vue:124:      <div class="creation-summary"><span>{{ name }}</span><span>{{ t('onboarding.creation.attributeStep.summaryTalent') }}</span><span>{{ t('onboarding.creation.attributeStep.summaryPoints') }}</span></div>
src/components/onboarding/CharacterCreationScreen.vue:126:      <footer class="panel-actions"><GameButton variant="secondary" :disabled="creating" @click="step = 2">{{ t('onboarding.creation.attributeStep.rechooseTalent') }}</GameButton><GameButton variant="primary" :disabled="pointsLeft !== 0 || creating" data-testid="creation-finish" @click="finish">{{ creating ? t('onboarding.creation.attributeStep.creating') : t('onboarding.creation.attributeStep.finish') }}</GameButton></footer>
tests/e2e/wave-vfx-capture.spec.ts:5:import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'
tests/e2e/wave-vfx-capture.spec.ts:27:    await createCharacterThroughUi(page, 'QA VFX Capture')
tests/e2e/announcement-layering.spec.ts:2:import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'
tests/e2e/announcement-layering.spec.ts:18:    await createCharacterThroughUi(page, 'Layer Test')
tests/e2e/body-perfection-hidden.spec.ts:6:  createCharacterThroughUi,
tests/e2e/body-perfection-hidden.spec.ts:28:    await createCharacterThroughUi(page, 'E2E Thể Phách')
tests/e2e/body-perfection-hidden.spec.ts:54:    await createCharacterThroughUi(page, 'E2E Hoàn Thiện')
tests/e2e/technique-frozen-warning.spec.ts:7:  createCharacterThroughUi,
tests/e2e/technique-frozen-warning.spec.ts:137:    await createCharacterThroughUi(page, 'E2E Tâm Pháp')
tests/e2e/error-recovery.spec.ts:3:import { bootToGuestHome, createCharacterThroughUi, reauthAndEnterHome } from './helpers'
tests/e2e/error-recovery.spec.ts:58:    await createCharacterThroughUi(page, 'Reload Recovery')
tests/e2e/combat-idle-motion-capture.spec.ts:5:import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'
tests/e2e/combat-idle-motion-capture.spec.ts:49:    await createCharacterThroughUi(page, 'QA Idle Motion')
tests/e2e/system-ui.spec.ts:2:import { createCharacterThroughUi, enterHome } from './helpers'
tests/e2e/system-ui.spec.ts:41:    await createCharacterThroughUi(page, 'Hệ Thống')
tests/e2e/system-ui.spec.ts:95:    await createCharacterThroughUi(page, 'Hệ Thống')
tests/e2e/system-ui.spec.ts:123:    await createCharacterThroughUi(page, 'Hệ Thống')
tests/e2e/tribulation-flow.spec.ts:7:  createCharacterThroughUi,
tests/e2e/tribulation-flow.spec.ts:118:    await createCharacterThroughUi(page, 'E2E Độ Kiếp')
tests/e2e/combat-overlay-layout.spec.ts:3:import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'
tests/e2e/combat-overlay-layout.spec.ts:23:  await createCharacterThroughUi(page, name)
tests/e2e/save-reload.spec.ts:5:  createCharacterThroughUi,
tests/e2e/save-reload.spec.ts:70:    await createCharacterThroughUi(page, characterName)
tests/e2e/ink-wash-ui.spec.ts:2:import { createCharacterThroughUi, enterHome } from './helpers'
tests/e2e/ink-wash-ui.spec.ts:62:      await createCharacterThroughUi(page, `Mặc${viewport.width}`)
tests/e2e/standing-slot-panel.spec.ts:4:  createCharacterThroughUi,
tests/e2e/standing-slot-panel.spec.ts:108:    await createCharacterThroughUi(page, 'P14 Slot Panel')
tests/e2e/cultivation-path-ritual.spec.ts:7:  createCharacterThroughUi,
tests/e2e/cultivation-path-ritual.spec.ts:297:    await createCharacterThroughUi(page, 'E2E Ritual Gate')
tests/e2e/cultivation-path-ritual.spec.ts:315:    await createCharacterThroughUi(page, 'E2E Kiếm Hiển')
tests/e2e/cultivation-path-ritual.spec.ts:386:    await createCharacterThroughUi(page, 'E2E Kiếm Ngự')
tests/e2e/cultivation-path-ritual.spec.ts:426:    await createCharacterThroughUi(page, 'E2E Ngũ Hành')
tests/e2e/cultivation-path-ritual.spec.ts:491:    await createCharacterThroughUi(page, 'E2E Ngộ Đạo')
tests/e2e/cultivation-path-ritual.spec.ts:606:    await createCharacterThroughUi(page, 'E2E Thể Hiển')
tests/e2e/cultivation-path-ritual.spec.ts:627:    await createCharacterThroughUi(page, 'E2E Ứng Thế')
tests/e2e/turn-combat-hud.spec.ts:3:import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'
tests/e2e/turn-combat-hud.spec.ts:45:    await createCharacterThroughUi(page, 'E2E Turn HUD')
tests/e2e/create-to-combat.spec.ts:3:import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'
tests/e2e/create-to-combat.spec.ts:17:    await createCharacterThroughUi(page, 'E2E Chiến Đầu')
tests/e2e/helpers.ts:36:export async function createCharacterThroughUi(page: Page, name: string): Promise<void> {
tests/e2e/presentation-routing.spec.ts:3:import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'
tests/e2e/presentation-routing.spec.ts:20:    await createCharacterThroughUi(page, 'E2E Presentation 01')
tests/e2e/combat-vertical-slice.spec.ts:7:  createCharacterThroughUi,
tests/e2e/combat-vertical-slice.spec.ts:307:    await createCharacterThroughUi(page, 'E2E Vertical Slice')
tests/e2e/combat-vertical-slice.spec.ts:498:    await createCharacterThroughUi(page, 'E2E Abandon Slice')
tests/e2e/helpers.ts:58:  // There are 5 attributes; if we have >=5, click each once.
src/services/character/SupabaseCharacterCreationService.ts:65:          p_attributes: draft.attributes,
src/services/character/CharacterCreationService.ts:17:  attributes: CharacterAttributes
src/services/character/CharacterCreationService.ts:20:export type CharacterCreationErrorCode = 'invalid_name' | 'invalid_talents' | 'invalid_attributes' | 'name_taken' | 'server_unavailable'
src/services/character/CharacterCreationService.ts:52:  const values = Object.values(draft.attributes)
src/services/character/CharacterCreationService.ts:54:    return { ok: false, code: 'invalid_attributes', message: 'Phải phân bổ đúng năm điểm nguyên không âm.' }
src/components/onboarding/CharacterCreationScreen.test.ts:28:  // walk name -> talent -> attributes through the real controls.
src/services/character/CharacterCreationService.test.ts:7:  attributes: { strength: 1, dexterity: 1, intelligence: 1, attunement: 1, vitality: 1 },
src/services/character/CharacterCreationService.test.ts:19:  it('rejects non-integer, negative, or incorrectly totaled attributes', () => {
src/services/character/CharacterCreationService.test.ts:20:    expect(validateCharacterCreationDraft({ ...validDraft, attributes: { ...validDraft.attributes, strength: 1.5 } }, rollIds).ok).toBe(false)
src/services/character/CharacterCreationService.test.ts:21:    expect(validateCharacterCreationDraft({ ...validDraft, attributes: { ...validDraft.attributes, strength: -1 } }, rollIds).ok).toBe(false)
src/services/character/CharacterCreationService.test.ts:22:    expect(validateCharacterCreationDraft({ ...validDraft, attributes: { strength: 5, dexterity: 1, intelligence: 0, attunement: 0, vitality: 0 } }, rollIds).ok).toBe(false)
src/components/onboarding/CharacterCreationScreen.vue:14:  attributes: Record<'strength' | 'dexterity' | 'intelligence' | 'attunement' | 'vitality', number>
src/components/onboarding/CharacterCreationScreen.vue:25:const attributes = ref<CharacterCreationPayload['attributes']>({ strength: 0, dexterity: 0, intelligence: 0, attunement: 0, vitality: 0 })
src/components/onboarding/CharacterCreationScreen.vue:29:const attributeLabels = computed<Record<keyof CharacterCreationPayload['attributes'], { name: string; hint: string }>>(() => ({
src/components/onboarding/CharacterCreationScreen.vue:30:  strength: { name: t('onboarding.creation.attributes.strength.name'), hint: t('onboarding.creation.attributes.strength.hint') },
src/components/onboarding/CharacterCreationScreen.vue:31:  dexterity: { name: t('onboarding.creation.attributes.dexterity.name'), hint: t('onboarding.creation.attributes.dexterity.hint') },
src/components/onboarding/CharacterCreationScreen.vue:32:  intelligence: { name: t('onboarding.creation.attributes.intelligence.name'), hint: t('onboarding.creation.attributes.intelligence.hint') },
src/components/onboarding/CharacterCreationScreen.vue:33:  attunement: { name: t('onboarding.creation.attributes.attunement.name'), hint: t('onboarding.creation.attributes.attunement.hint') },
src/components/onboarding/CharacterCreationScreen.vue:34:  vitality: { name: t('onboarding.creation.attributes.vitality.name'), hint: t('onboarding.creation.attributes.vitality.hint') },
src/components/onboarding/CharacterCreationScreen.vue:36:const pointsSpent = computed(() => Object.values(attributes.value).reduce((sum, value) => sum + value, 0))
src/components/onboarding/CharacterCreationScreen.vue:59:function changeAttribute(key: keyof CharacterCreationPayload['attributes'], delta: number) {
src/components/onboarding/CharacterCreationScreen.vue:60:  const next = attributes.value[key] + delta
src/components/onboarding/CharacterCreationScreen.vue:62:  attributes.value[key] = next
src/components/onboarding/CharacterCreationScreen.vue:66:  const payload = { name: name.value.trim(), talentIds: [...selectedTalentIds.value], attributes: { ...attributes.value } }
src/components/onboarding/CharacterCreationScreen.vue:122:        <div v-for="(label, key) in attributeLabels" :key="key" class="attribute-row" :data-testid="`creation-attribute-${key}`"><div><b>{{ label.name }}</b><small>{{ label.hint }}</small></div><div class="counter"><button type="button" @click="changeAttribute(key, -1)">−</button><span>{{ attributes[key] }}</span><button type="button" :data-testid="`creation-attribute-plus-${key}`" @click="changeAttribute(key, 1)">+</button></div></div>
src/locales/en.json:923:      "attributes": {
src/locales/vi.json:923:      "attributes": {
```
