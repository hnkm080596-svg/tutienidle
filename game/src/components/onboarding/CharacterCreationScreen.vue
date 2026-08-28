<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import GameButton from '@/components/common/GameButton.vue'
import { TALENT_RARITY_LABELS, type TalentDefinition } from '@/core/talent/Talent'
import { characterCreationService } from '@/services/character/CharacterCreationServiceFactory'
import { isValidCharacterName } from '@/services/character/CharacterCreationService'

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
const attributeLabels: Record<keyof CharacterCreationPayload['attributes'], { name: string; hint: string }> = {
  strength: { name: 'Căn Cốt', hint: 'Sức mạnh thể phách' }, dexterity: { name: 'Thân Pháp', hint: 'Linh hoạt và né tránh' },
  intelligence: { name: 'Thần Thức', hint: 'Uy lực kỹ năng' }, attunement: { name: 'Linh Căn', hint: 'Cộng hưởng nguyên tố' }, vitality: { name: 'Thể Chất', hint: 'Sinh lực và bền bỉ' },
}
const pointsSpent = computed(() => Object.values(attributes.value).reduce((sum, value) => sum + value, 0))
const pointsLeft = computed(() => 5 - pointsSpent.value)
const validName = computed(() => isValidCharacterName(name.value))

function toggleTalent(talent: TalentDefinition) {
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
    error.value = 'Không thể quan sát thiên cơ. Vui lòng thử lại.'
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
  creating.value = false
  if (!result.ok) { error.value = result.message; return }
  emit('complete', payload)
}

onMounted(() => { void reroll() })
</script>

<template>
  <main class="creation-screen">
    <header class="creation-header">
      <GameButton variant="ghost" size="sm" @click="step === 1 ? emit('back') : step--">← Trở lại</GameButton>
      <div><p>KHAI MỆNH</p><h1>Tạo Nhân Vật</h1></div>
      <span>Bước {{ step }} / 3</span>
    </header>

    <nav class="stepper" aria-label="Tiến trình tạo nhân vật">
      <i v-for="number in 3" :key="number" :class="{ active: number <= step }"><b>{{ number }}</b></i>
    </nav>

    <section v-if="step === 1" class="creation-panel name-step">
      <span class="ornate-frame" aria-hidden="true" />
      <p class="kicker">ĐẠO DANH</p><h2>Danh xưng theo suốt tiên đồ</h2>
      <p>Tên nhân vật sẽ là duy nhất và không thể đổi trong giai đoạn đầu.</p>
      <label><span>Tên nhân vật</span><input v-model="name" maxlength="20" autofocus placeholder="Nhập đạo danh…" /></label>
      <small :class="{ valid: validName }">{{ name.length }}/20 · Tối thiểu 2 ký tự</small>
      <GameButton variant="primary" :disabled="!validName" @click="step = 2">Tiếp tục</GameButton>
    </section>

    <section v-else-if="step === 2" class="creation-panel talent-step">
      <span class="ornate-frame" aria-hidden="true" />
      <div class="panel-heading"><div><p class="kicker">THIÊN MỆNH</p><h2>Chọn một Thiên Phú</h2></div><strong>Đã chọn {{ selectedTalentIds.length }} / 1</strong></div>
      <p v-if="rolling" class="loading-roll">Đang quan sát thiên cơ…</p>
      <p v-else-if="error && talents.length === 0" class="loading-roll">{{ error }}</p>
      <div v-else class="talent-grid">
        <button v-for="talent in talents" :key="talent.id" type="button" class="talent-card" :class="[`talent-tier-${talent.rarity}`, { selected: selectedTalentIds.includes(talent.id) }]" @click="toggleTalent(talent)">
          <span class="talent-card__rarity">{{ TALENT_RARITY_LABELS[talent.rarity] }}</span><h3>{{ talent.name }}</h3><p>{{ talent.description }}</p><small>{{ talent.tags[0] }}</small>
        </button>
      </div>
      <footer class="panel-actions"><GameButton variant="secondary" :disabled="rolling" @click="reroll">↻ Reroll toàn bộ</GameButton><GameButton variant="primary" :disabled="selectedTalentIds.length !== 1" @click="step = 3">Xác nhận thiên phú</GameButton></footer>
    </section>

    <section v-else class="creation-panel attribute-step">
      <span class="ornate-frame" aria-hidden="true" />
      <div class="panel-heading"><div><p class="kicker">CĂN CƠ</p><h2>Phân bổ điểm khởi đầu</h2></div><strong class="points">Còn {{ pointsLeft }} điểm</strong></div>
      <div class="attribute-list">
        <div v-for="(label, key) in attributeLabels" :key="key" class="attribute-row"><div><b>{{ label.name }}</b><small>{{ label.hint }}</small></div><div class="counter"><button type="button" @click="changeAttribute(key, -1)">−</button><span>{{ attributes[key] }}</span><button type="button" @click="changeAttribute(key, 1)">+</button></div></div>
      </div>
      <div class="creation-summary"><span>{{ name }}</span><span>1 Thiên Phú</span><span>5 Điểm Căn Cơ</span></div>
      <p v-if="error" class="creation-error">{{ error }}</p>
      <footer class="panel-actions"><GameButton variant="secondary" :disabled="creating" @click="step = 2">Chọn lại thiên phú</GameButton><GameButton variant="primary" :disabled="pointsLeft !== 0 || creating" @click="finish">{{ creating ? 'Đang lập mệnh…' : 'Bước vào tiên đồ' }}</GameButton></footer>
    </section>
  </main>
</template>

<style scoped>
.creation-screen { width: 100vw; height: 100vh; box-sizing: border-box; overflow: auto; padding: 22px clamp(20px,5vw,72px) 34px; background: radial-gradient(circle at 50% -15%, color-mix(in srgb, var(--chrome-700) 8%, var(--ink-950)), var(--ink-900) 42%, var(--ink-950) 85%); }
.creation-header { max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; text-align: center; }.creation-header button { justify-self: start; }.creation-header span { justify-self: end; color: var(--text-muted); font-size: var(--text-xs); }.creation-header p,.kicker { margin: 0; color: var(--chrome-500); font-size: var(--text-xs); letter-spacing: .25em; }.creation-header h1 { margin: 4px 0; font: 700 var(--text-display) var(--font-display); }
.stepper { max-width: 420px; margin: 18px auto 24px; display: flex; align-items: center; }.stepper i { display: flex; flex: 1; align-items: center; color: var(--ink-line); }.stepper i::after { content: ''; height: 1px; flex: 1; background: currentColor; }.stepper i:last-child { flex: 0; }.stepper i:last-child::after { display: none; }.stepper b { width: 26px; height: 26px; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 50%; font: 500 var(--text-xs) var(--font-body); }.stepper i.active { color: var(--chrome-100); }
.creation-panel { position: relative; max-width: 1120px; margin: auto; box-sizing: border-box; border-radius: var(--radius-md); padding: clamp(22px,3vw,36px); background: linear-gradient(160deg, var(--ink-950), var(--ink-800)); box-shadow: var(--shadow-panel); }
.creation-panel h2 { margin: 5px 0 8px; font: 600 var(--text-display) var(--font-display); }.creation-panel>p:not(.kicker) { color: var(--text-secondary); }.name-step { max-width: 560px; text-align: center; }.name-step label { display: grid; gap: 8px; margin: 30px 0 8px; text-align: left; color: var(--text-secondary); font-size: var(--text-xs); }.name-step input { padding: 15px; border: 1px solid var(--ink-line); border-radius: 6px; background: var(--ink-950); color: var(--text-primary); font: 600 var(--text-panel-title) var(--font-display); text-align: center; outline: none; }.name-step input:focus { border-color: var(--chrome-100); }.name-step small { display: block; margin-bottom: 28px; color: var(--text-muted); }.name-step small.valid { color: var(--jade); }
.panel-heading { display: flex; justify-content: space-between; align-items: end; margin-bottom: 18px; }.panel-heading strong { color: var(--chrome-100); font-size: var(--text-xs); }.talent-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }.talent-card { position: relative; min-height: 128px; padding: 15px; border: 1px solid var(--ink-line); border-radius: var(--radius-md); background: var(--ink-900); color: var(--text-primary); text-align: left; cursor: pointer; transition: transform .15s,border-color .15s; }.talent-card:hover { transform: translateY(-2px); }.talent-card.selected { border-color: var(--chrome-300); box-shadow: inset 0 0 0 1px var(--chrome-300), 0 0 15px color-mix(in srgb, var(--chrome-300) 12%, transparent); }.talent-card__rarity { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .13em; }.talent-card h3 { margin: 7px 0; font: 600 var(--text-md) var(--font-display); }.talent-card p { margin: 0 0 8px; color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.5; }.talent-card small { color: var(--text-muted); }.talent-tier-pham .talent-card__rarity{color:var(--rank-color-1)}.talent-tier-linh .talent-card__rarity{color:var(--rank-color-3)}.talent-tier-dia .talent-card__rarity{color:var(--rank-color-5)}.talent-tier-thien .talent-card__rarity{color:var(--rank-color-7)}.talent-tier-di .talent-card__rarity{color:var(--rank-color-8)}
.panel-actions { display: flex; justify-content: space-between; gap: 12px; margin-top: 22px; }.attribute-step { max-width: 700px; }.points { padding: 8px 12px; border: 1px solid color-mix(in srgb, var(--chrome-300) 25%, transparent); border-radius: 20px; }.attribute-list { display: grid; gap: 8px; }.attribute-row { display: flex; justify-content: space-between; align-items: center; padding: 13px 16px; border: 1px solid var(--ink-line-soft); background: var(--ink-900); }.attribute-row>div:first-child { display: grid; gap: 3px; }.attribute-row small { color: var(--text-muted); }.counter { display: flex; align-items: center; gap: 16px; }.counter button { min-width: var(--tap-min); min-height: var(--tap-min); border: 1px solid var(--ink-line); border-radius: 50%; background: var(--ink-800); color: var(--chrome-100); cursor: pointer; }.counter span { min-width: 18px; text-align: center; font-weight: 700; }.creation-summary { display: flex; justify-content: center; gap: 22px; margin-top: 20px; color: var(--text-secondary); font-size: var(--text-xs); }
.loading-roll { min-height: min(380px, 50vh); display: grid; place-items: center; color: var(--chrome-100); font-family: var(--font-display); }.creation-error { margin: 14px 0 0; color: var(--crimson); text-align: center; font-size: var(--text-xs); }
@media(max-width:760px){.talent-grid{grid-template-columns:1fr 1fr}.creation-header{grid-template-columns:1fr auto}.creation-header>div{grid-column:1/-1;grid-row:1}.creation-header button{grid-row:2}.creation-header span{grid-row:2}.panel-heading{align-items:start}.creation-summary{flex-wrap:wrap}}
</style>
