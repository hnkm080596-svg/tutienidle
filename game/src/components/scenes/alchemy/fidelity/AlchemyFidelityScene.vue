<script setup lang="ts">
import GameCard from "@/components/common/GameCard.vue"
import GamePanel from '@/components/common/GamePanel.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { useDialogFocus } from '@/composables/useDialogFocus'
import GameActionButton from '@/components/common/GameActionButton.vue'
import GameTabButton from '@/components/common/GameTabButton.vue'
import EquipmentEnergyTube from '@/components/common/art/EquipmentEnergyTube.vue'
import SlotView from '@/components/common/SlotView.vue'
import type { AlchemyRecipeChoice, AlchemyRecipeDisplay, AlchemyJobDisplay } from './alchemyUi'

const props = withDefaults(defineProps<{
  recipes: readonly AlchemyRecipeChoice[]
  recipe: AlchemyRecipeDisplay | null
  variant: string | null
  jobs: readonly AlchemyJobDisplay[]
  capacity: number
  preview?: boolean
}>(), { preview: false })

const emit = defineEmits<{
  select: [id: string]
  variant: [id: string]
  brew: []
  cancel: [id: string]
  back: []
}>()

const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)

useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })

const cauldron = resolveAssetUrl('/assets/ui/huyen-kim/alchemy/alchemy-cauldron-v2.png')

const herb = computed(() => props.recipe?.variants.find(item => item.id === props.variant) ?? null)

// O nguyen lieu dung Y HET prop-set o vat lieu trong Bag (variant bag +
// day du label/amount/icon/tooltip/rank fields tu cell) - khong gan le te.
const herbCell = computed(() => {
  const item = herb.value
  if (!item) return null
  return { ...item, label: item.name }
})
const costCells = computed(() => props.recipe?.costs.map(item => ({ ...item })) ?? [])

// Slot giua lo: vien dan dang luyen - tooltip chua recipe info (name, pham,
// thoi gian, mo ta) sau khi khoi info phia tren bi bo theo ruling.
const pillCell = computed(() => {
  const recipe = props.recipe
  if (!recipe) return null
  const lines = [recipe.grade, recipe.duration, recipe.description].filter(Boolean).join('\n')
  return { name: recipe.name, label: recipe.name, icon: recipe.icon, tooltip: { title: recipe.name, description: lines } }
})

// Duong nang luong: do toa do thuc cua 4 o nguyen lieu + slot giua lo,
// 4 duong len gap nhau thanh 1 line doc noi vao slot.
const midRef = ref<HTMLElement | null>(null)
const flowPaths = ref<string[]>([])
const brewPulse = ref(false)
let brewPulseTimer: number | null = null

function onBrew() {
  emit('brew')
  brewPulse.value = false
  requestAnimationFrame(() => { brewPulse.value = true })
  if (brewPulseTimer) window.clearTimeout(brewPulseTimer)
  brewPulseTimer = window.setTimeout(() => { brewPulse.value = false }, 1300)
}
let flowObserver: ResizeObserver | null = null
let flowTimer: number | null = null
let flowSig = ''
// O ngoai (1 va 4) nang len dung nua day doc 2,3 - diem T roi giua day.
// r = 0.45/1.45 * (innerY - pillY), giai tu r = (innerY - mergeY)/2.
const outerRaise = ref(28)

function measureFlow() {
  const mid = midRef.value
  if (!mid) { flowPaths.value = []; return }
  const svg = mid.querySelector<SVGSVGElement>('.alchemy-flow')
  const pill = mid.querySelector<HTMLElement>('.alchemy-pill-slot')
  // Direct-child selector: SlotView trong variant picker (popup chon nien dai)
  // nam sau hon ben trong .alchemy-slot va khong duoc bi tinh vao day.
  const slots = Array.from(mid.querySelectorAll<HTMLElement>('.alchemy-slot > .slot-view'))
  if (!svg || !pill || slots.length === 0) { flowPaths.value = []; return }
  // jsdom SVGElement lacks getScreenCTM - tests measure nothing,
  // production always has it.
  if (typeof svg.getScreenCTM !== 'function') { flowPaths.value = []; return }
  const ctm = svg.getScreenCTM()
  if (!ctm) { flowPaths.value = []; return }
  // Stage bi scale de fit cua so - do viewport roi doi ve he toa do SVG
  // (user units) bang CTM nghich dao, mien moi zoom/scale to tien.
  const inv = ctm.inverse()
  const center = (r: DOMRect) => new DOMPoint(r.left + r.width / 2, r.top + r.height / 2).matrixTransform(inv)
  const pc = center(pill.getBoundingClientRect())
  const tops = slots.map(el => center(el.getBoundingClientRect()))
  // Do nang o ngoai tu day trong + tam vien dan (khong phu thuoc vi tri o ngoai
  // hien tai nen khong bi hoi tiep); poll ke tiep se do lai mergeY theo o da nang.
  if (tops.length > 2) {
    const innerY = Math.max(...tops.slice(1, -1).map(t => t.y))
    const raise = Math.max(0, (innerY - pc.y) * (0.45 / 1.45))
    if (Math.abs(raise - outerRaise.value) > 0.5) outerRaise.value = raise
  }
  const sig = `${pc.x.toFixed(1)}|${pc.y.toFixed(1)}|${tops.map(t => `${t.x.toFixed(1)},${t.y.toFixed(1)}`).join('|')}`
  if (sig === flowSig) return
  flowSig = sig
  // Khong gop day: 4 day chay thang tam o nguyen lieu -> tam vien dan.
  flowPaths.value = tops.map(t => `M ${t.x} ${t.y} L ${pc.x} ${pc.y}`)
}

watch(() => [props.recipe?.id, props.recipe?.costs.length], () => {
  requestAnimationFrame(measureFlow)
})

onMounted(() => {
  measureFlow()
  // jsdom lacks ResizeObserver - the 100ms re-measure below still
  // covers layout drift in tests.
  if (typeof ResizeObserver === 'function') {
    flowObserver = new ResizeObserver(measureFlow)
    if (midRef.value) flowObserver.observe(midRef.value)
  }
  // Layout tiep tuc troi sau mount (anh lo, font, so dem render) - do lai
  // dinh ky den khi toa do on dinh, chi ve lai khi co thay doi.
  flowTimer = window.setInterval(measureFlow, 100)
})
onBeforeUnmount(() => {
  flowObserver?.disconnect()
  if (flowTimer !== null) window.clearInterval(flowTimer)
  if (brewPulseTimer !== null) window.clearTimeout(brewPulseTimer)
})


// Card chon chat nien dai hien thuong truc tren nut Luyen Dan - khong can bam.
function pickVariant(id: string) {
  emit('variant', id)
}

// Dang luyen = co job trong hang cho cua dan dang chon -> sao bang quet qua
// cac o nguyen lieu + vien dan, day nang luong chay sang lien tuc.
const brewing = computed(() => props.jobs.some(j => j.state === 'active' && j.recipeId === props.recipe?.id))

const emptyJobSlots = computed(() => Math.max(0, props.capacity - props.jobs.length))

// Option-A queue card: dong phu = don vi vien trong order + ETA.
function jobSubline(job: AlchemyJobDisplay) {
  const parts: string[] = []
  if ((job.quantity ?? 1) > 1) parts.push(t('alchemy.unitsProgress', { done: job.unitsDone ?? 0, total: job.quantity }))
  if (job.remaining) parts.push(job.remaining)
  return parts.join(' · ')
}
</script>

<template>
  <section ref="rootRef" class="rail-panel-scene alchemy-scene" :aria-label="t('alchemy.title')" @click.self="emit('back')">
    <GamePanel :title="t('alchemy.title')">
    
    

    <div class="alchemy-cols">
      <!-- Cot trai 20%: day nut dan phuong. -->
      <nav class="alchemy-recipes" :aria-label="t('alchemy.recipe')">
        <GameTabButton v-for="entry in recipes" :key="entry.id" class="recipe-row" :selected="recipe?.id === entry.id" :data-recipe-id="entry.id" @click="emit('select', entry.id)">
          <span class="recipe-label">{{ entry.name }}</span>
        </GameTabButton>
        <p v-if="recipes.length === 0" class="alchemy-empty">{{ t('alchemy.emptyRecipes') }}</p>
      </nav>

      <!-- Cot giua 50%: lo dan + slot nguyen lieu + nut luyen. -->
      <div ref="midRef" class="alchemy-mid" :class="{ 'is-brewing': brewing }" :style="{ '--outer-raise': `${outerRaise}px` }">
        <template v-if="recipe">
          <svg class="alchemy-flow" aria-hidden="true"><template v-for="(d, i) in flowPaths" :key="i"><path :d="d" class="flow-line flow-line--base" /><path v-if="brewing" :d="d" pathLength="100" class="flow-line flow-line--stream" /><path v-if="brewPulse" :d="d" pathLength="100" class="flow-line flow-line--pulse" /></template></svg>
          <div class="alchemy-cauldron">
            <img :src="cauldron" alt="">
            <div v-if="pillCell" class="alchemy-pill-slot">
              <SlotView static static-tooltip :item="pillCell" :icon="pillCell.icon" :label="pillCell.label" :tooltip="pillCell.tooltip" variant="circle" />
            </div>
          </div>
          <div class="alchemy-slots">
            <div v-if="herbCell" class="alchemy-slot">
              <SlotView :item="herbCell" :icon="herbCell.icon" :label="herbCell.label" :description="herbCell.description" :tooltip="herbCell.tooltip ?? { title: herbCell.name, description: t('alchemy.cycleHerbHint') }" :equipment-quality-rank="herbCell.equipmentQualityRank" :rarity-rank="herbCell.rarityRank" :rarity-rank-scale="herbCell.rarityRankScale" :name-segments="herbCell.nameSegments" variant="bag" />
              <span class="alchemy-slot__count">{{ herbCell.amount }}</span>
            </div>
            <div v-for="cost in costCells" :key="cost.id" class="alchemy-slot">
              <SlotView :item="cost" :icon="cost.icon" :label="cost.label" :description="cost.description" :tooltip="cost.tooltip ?? { title: cost.label, description: cost.value }" :equipment-quality-rank="cost.equipmentQualityRank" :rarity-rank="cost.rarityRank" :rarity-rank-scale="cost.rarityRankScale" :name-segments="cost.nameSegments" variant="bag" />
              <span class="alchemy-slot__count">{{ cost.value }}</span>
            </div>
          </div>
          <GameCard as="div" class="alchemy-variant-picker" role="listbox" :aria-label="t('alchemy.variantPicker')">
            <div v-for="v in recipe.variants" :key="v.id" class="alchemy-variant-pick">
              <SlotView :item="v" :icon="v.icon" :label="v.name" :description="v.description" :tooltip="v.tooltip ?? { title: v.name, description: v.description }" :equipment-quality-rank="v.equipmentQualityRank" :rarity-rank="v.rarityRank" :rarity-rank-scale="v.rarityRankScale" :name-segments="v.nameSegments" variant="bag" :state="{ interaction: v.id === variant ? 'selected' : 'idle' }" @click="pickVariant(v.id)" />
              <span class="alchemy-slot__count">{{ v.amount }}</span>
            </div>
          </GameCard>
          <div class="alchemy-brew">
            <GameActionButton :gold="!recipe.brewDisabled" :disabled="recipe.brewDisabled" @click="onBrew">{{ t('alchemy.startBrewing') }}</GameActionButton>
          </div>
        </template>
        <p v-else class="alchemy-empty alchemy-mid__empty">{{ t('alchemy.emptyDetail') }}</p>
      </div>

      <!-- Cot phai 30%: card chua cac job chong len nhau. -->
      <GameCard as="aside" class="alchemy-jobs" :title="t('alchemy.queueTitle')" :aria-label="t('alchemy.queueTitle')">
        <div class="alchemy-jobs__head"><span>{{ jobs.length }} / {{ capacity }}</span></div>
        <div class="alchemy-jobs__list">
        <article v-for="job in jobs" :key="job.id" :class="['job-card', job.state === 'waiting' ? 'job-card--waiting' : 'job-card--brewing']">
          <SlotView class="job-card__slot" static static-tooltip variant="bag" :item="job" :icon="job.icon" :label="job.name" />
          <div class="job-card__info">
            <div class="job-card__title"><h3>{{ job.name }}<em v-if="(job.quantity ?? 1) > 1" class="job-card__qty">×{{ job.quantity }}</em></h3><span class="job-card__state">{{ t(job.state === 'waiting' ? 'alchemy.waitingJob' : 'alchemy.activeKiln') }}</span></div>
            <EquipmentEnergyTube class="job-card__bar" :fill="Math.max(0, Math.min(100, job.progress))" :color="job.state === 'active' ? '#f5cd6d' : '#b59b58'" />
            <small>{{ jobSubline(job) }}</small>
          </div>
          <GameActionButton class="job-card__cancel" :gold="false" :aria-label="t('alchemy.cancelJob')" v-tooltip="{title:t('alchemy.cancelJob')}" @click="emit('cancel', job.id)">×</GameActionButton>
        </article>
        <div v-for="index in emptyJobSlots" :key="`empty-${index}`" class="job-card job-card--empty"><span>◇</span><small>{{ t('alchemy.emptySlot') }}</small></div>
        </div>
      </GameCard>
    </div>
    <p v-if="preview" class="alchemy-preview-label">{{ t('alchemy.previewStamp') }}</p>
    </GamePanel>
  </section>
</template>

<style scoped>
.alchemy-scene { position:absolute; inset:0;  font-family:var(--font-display,Georgia,serif); color:#392c1d; line-height:1.3; }
.alchemy-scene :deep(*) { box-sizing:border-box; }

/* Ba cot 20 / 50 / 30 trong vung noi dung cua sheet. */
.alchemy-cols { position:absolute; left:372px; top:192px; width:1011px; height:500px; display:flex; gap:14px; }

.alchemy-recipes { width:202px; min-width:0; overflow-y:auto; scrollbar-width:thin; display:flex; flex-direction:column; gap:6px; padding:2px; }
/* Nut chon dan phuoc - art tab Trang Bi: pill nine-slice secondary,
   tab dang chon doi sang primary + chu toi. Chi con ten dan. */
.recipe-row { width:100%; flex:0 0 auto; }

.alchemy-mid { flex:1; min-width:0; position:relative; display:flex; flex-direction:column; align-items:stretch; }
.alchemy-flow { position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; z-index:1; }
/* Line cung xam mac dinh; khi bam Luyen Dan co lop sang chay tu nguyen lieu ve dan. */
.alchemy-flow .flow-line { fill:none; stroke-linecap:round; stroke-linejoin:miter; }
.alchemy-flow .flow-line--base { stroke:#9a8a6a; stroke-width:1.6; opacity:.85; }
.alchemy-flow .flow-line--pulse { stroke:#ffe9a8; stroke-width:2; stroke-dasharray:14 86; stroke-linecap:round; animation:alchemy-pulse 1.15s linear forwards; filter:drop-shadow(0 0 3px #f5cd6d) drop-shadow(0 0 7px #f0b93f); }
@keyframes alchemy-pulse { to { stroke-dashoffset:-100; } }
/* Khi co job dang chay: day chay sang lien tuc (loop), tach khoi pulse 1 lan. */
.alchemy-flow .flow-line--stream { stroke:#f5cd6d; stroke-width:1.4; stroke-dasharray:4 18; opacity:.9; animation:alchemy-stream .9s linear infinite; filter:drop-shadow(0 0 2px #f0b93f); }
@keyframes alchemy-stream { to { stroke-dashoffset:-22; } }
.alchemy-cauldron { position:absolute; inset:0; pointer-events:none; display:flex; justify-content:center; align-items:flex-start; }
#app .alchemy-pill-slot :deep(.slot-view) { border-radius:50%; border:3px solid #e6bd65; box-shadow:0 0 0 1px #3a2c12, 0 0 14px 2px #f5cd6d55; background:radial-gradient(circle at 50% 42%, #241d12 0%, #120d07 74%); }
.alchemy-pill-slot { position:absolute; left:50%; top:169px; transform:translate(-50%,-50%); width:84px; height:84px; z-index:3; pointer-events:auto; }
.alchemy-pill-slot :deep(.slot-view) { width:100%; height:100%; }
.alchemy-pill-slot :deep(.slot-view__ring-art) { display:none; }
.alchemy-pill-slot :deep(.slot-view__icon-wrap) { inset:14%; animation:alchemy-pill-float 3.6s ease-in-out infinite; }
.alchemy-pill-slot :deep(.slot-view__icon-wrap img) { animation:alchemy-pill-turn 5s ease-in-out infinite; }
@keyframes alchemy-pill-float { 0%,100% { transform:translateY(3px); } 50% { transform:translateY(-5px); } }
@keyframes alchemy-pill-turn { 0%,100% { transform:rotate(-6deg); } 50% { transform:rotate(6deg); } }
@media (prefers-reduced-motion:reduce) {
  .alchemy-pill-slot :deep(.slot-view__icon-wrap), .alchemy-pill-slot :deep(.slot-view__icon-wrap img), .alchemy-flow .flow-line { animation:none; }
}
.alchemy-cauldron img { width:auto; height:308px; object-fit:contain; opacity:.8; filter:drop-shadow(0 10px 10px #70421d35); }
.alchemy-slots { display:flex; gap:32px; margin-top:auto; justify-content:center; position:relative; z-index:2; }
.alchemy-slot { display:flex; flex-direction:column; align-items:center; gap:3px; position:relative; }
.alchemy-slot:first-child, .alchemy-slot:last-child { transform:translateY(calc(-1 * var(--outer-raise, 28px))); }
.alchemy-slot :deep(.slot-view) { flex:0 0 56px; width:56px; }
.alchemy-slot__count { font-size:11px; color:#6d5730; letter-spacing:.5px; }
.alchemy-variant-picker { display:flex; gap:10px; justify-content:center; margin-top:8px; align-self:center; position:relative; z-index:4; }
.alchemy-variant-pick { display:flex; flex-direction:column; align-items:center; gap:4px; }
.alchemy-variant-picker :deep(.slot-view) { flex:0 0 56px; width:56px; }
.alchemy-brew { display:flex; justify-content:center; }
.alchemy-brew .game-action-button { width:255px; max-width:100%; height:calc(255px * 324 / 1225); font-size:24px; padding:8px 29px; }
.alchemy-mid__empty { margin:auto; text-align:center; }

.alchemy-jobs { width:303px; min-width:0; position:relative; display:flex; flex-direction:column; gap:8px; margin-top:12px; height:calc(100% - 12px); }
.alchemy-jobs__list { flex:1; min-height:0; display:flex; flex-direction:column; gap:8px; overflow-y:auto; scrollbar-width:none; }
.alchemy-jobs__list::-webkit-scrollbar { display:none; }
.alchemy-jobs__head { display:flex; justify-content:space-between; align-items:center; color:#c9ab6f; padding-bottom:6px; border-bottom:1px solid #a98d4f66; }
.alchemy-jobs__head h2 { font-weight:500; font-size:15px; margin:0; }
.alchemy-jobs__head span { font-size:12px; }
.job-card { display:flex; gap:9px; align-items:center; padding:8px 0; border-bottom:1px solid #8f744066; position:relative; flex:none; }
.job-card__slot { width:36px; height:36px; flex:0 0 36px; }
.job-card--brewing { border-bottom-color:#e6bd65aa; }
.job-card__info { flex:1; min-width:0; }
.job-card__title { display:flex; align-items:baseline; justify-content:space-between; gap:6px; margin:0 16px 6px 0; }
.job-card__info h3 { font-size:13px; font-weight:500; margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.job-card__qty { font-style:normal; color:#f5cd6d; margin-left:4px; font-size:11px; }
.job-card__state { font-size:9px; letter-spacing:.5px; color:#c9ab6f; flex:0 0 auto; }
.job-card__bar { height:5px; }
.job-card__info small { display:block; margin-top:4px; font-size:10px; color:#8b713f; }
.job-card__cancel.game-action-button { position:absolute; right:5px; top:4px; width:28px; height:22px; min-height:0; aspect-ratio:auto; padding:0; font-size:17px; }
.job-card__cancel:focus-visible { outline:2px solid #3c694e; }
.job-card--empty { border-bottom-style:dashed; justify-content:center; color:#998458; gap:6px; }
.job-card--empty small { font-size:12px; }
.job-card--empty span { font-size:18px; }

.alchemy-empty { color:#8b7042; font-size:13px; text-align:center; margin:18px 4px; }
.alchemy-preview-label { position:absolute; left:372px; top:706px; font-size:10px; color:#7d6c48; }

/* Layout instances are relative to the owning panel content. */
.alchemy-scene :deep(.game-panel__content .alchemy-cols) { position: absolute; inset: 0; width: 100%; height: 100%; min-width: 0; min-height: 0; margin: 0; }
</style>
