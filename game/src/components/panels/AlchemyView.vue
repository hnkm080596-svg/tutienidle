<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import type { AlchemyRecipe } from '@/core/alchemy/AlchemySystem'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'
import StatRow from '@/components/common/primitives/StatRow.vue'
import { PROFESSION_GRADE_NAMES, getProfessionGradeForRealm } from '@/core/profession/ProfessionGrade'

// Luyện Đan (2026-08-25, resource-professions-rework plan §8/§9.3) —
// thay RecipeCraftingView: mỗi đan phương nhận ĐÚNG MỘT Linh Thảo
// riêng; chọn biến thể niên đại đang có trong Túi; preview "Chắc chắn
// N viên, X% thêm 1 viên" (không dùng cụm ">100%").
// i18n (task 2.2 lô 1) — chuỗi UI qua t(); REASON_LABELS cũ (dead const,
// zero consumers) trích thành alchemy.reason.* trong locales.
const { t } = useI18n({ useScope: 'local' })

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

const nowMs = ref(Date.now())

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    nowMs.value = Date.now()
  }, 500)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

const recipes = computed<AlchemyRecipe[]>(() => {
  stateVersion.value

  return gameManager.getAlchemyRecipes().filter((recipe) => recipe.realmId === player.realmId)
})

const currentGradeLabel = computed(() => {
  const grade = getProfessionGradeForRealm(player.realmId)
  return grade ? PROFESSION_GRADE_NAMES[grade] : 'Chưa xác định'
})

const selectedRecipeId = ref<string | null>(null)

const selectedRecipe = computed(
  () => recipes.value.find((recipe) => recipe.id === selectedRecipeId.value) ?? null,
)

/** Biến thể niên đại người chơi chọn cho đan phương hiện tại. */
const selectedHerbId = ref<string | null>(null)

function selectRecipe(recipe: AlchemyRecipe) {
  selectedRecipeId.value = recipe.id

  // Mặc định chọn biến thể cao nhất người chơi đủ số lượng.
  const affordable = [...recipe.herbVariants]
    .reverse()
    .find((variant) => gameManager.materialBag.getAmount(variant.materialId) >= recipe.herbAmount)

  selectedHerbId.value =
    affordable?.materialId ?? recipe.herbVariants[recipe.herbVariants.length - 1]?.materialId ?? null
}

watch(recipes, (available) => {
  if (!available.some((recipe) => recipe.id === selectedRecipeId.value)) {
    const first = available[0]
    if (first) selectRecipe(first)
  }
}, { immediate: true })

interface VariantRow {
  materialId: string

  label: string

  owned: number

  enough: boolean
}

const variantRows = computed<VariantRow[]>(() => {
  stateVersion.value

  if (!selectedRecipe.value) {
    return []
  }

  return selectedRecipe.value.herbVariants.map((variant) => ({
    materialId: variant.materialId,

    label: variant.label,

    owned: gameManager.materialBag.getAmount(variant.materialId),

    enough: gameManager.materialBag.getAmount(variant.materialId) >= selectedRecipe.value!.herbAmount,
  }))
})

const preview = computed(() => {
  stateVersion.value

  if (!selectedRecipe.value || !selectedHerbId.value) {
    return null
  }

  return gameManager.previewAlchemyOutcome(selectedRecipe.value.id, selectedHerbId.value)
})

/** Gỗ nhiên liệu rẻ nhất đạt realm tối thiểu của recipe (hiển thị cost) — gp123 6E C2: id gỗ theo trục tuổi, ưu tiên decade. */
const fuelWoodRow = computed(() => {
  stateVersion.value

  if (!selectedRecipe.value) {
    return null
  }

  const realms = ['mortal', 'qi_refining', 'foundation_establishment']

  const ages = ['decade', 'century', 'millennium', 'myriad_year', 'thuong_co'] as const

  const minIndex = Math.max(0, realms.indexOf(selectedRecipe.value.fuelWoodRealmId))

  for (let index = minIndex; index < realms.length; index++) {
    for (const age of ages) {
      const woodId = `${realms[index]}_wood_${age}`

      if (!gameManager.materialRegistry.has(woodId)) {
        continue
      }

      return {
        label: gameManager.materialRegistry.get(woodId).name,

        owned: gameManager.materialBag.getAmount(woodId),

        amount: selectedRecipe.value.fuelWoodAmount,
      }
    }
  }

  // Không tìm thấy stack (cả registry fallback) — hiện id decade đầu tiên
  // để row không biến mất hoàn toàn.
  const fallbackId = `${realms[minIndex]}_wood_decade`

  return {
    label: gameManager.materialRegistry.has(fallbackId)
      ? gameManager.materialRegistry.get(fallbackId).name
      : fallbackId,

    owned: gameManager.materialBag.getAmount(fallbackId),

    amount: selectedRecipe.value.fuelWoodAmount,
  }
})

// Plan Workstream F — Linh Thạch đọc từ MaterialBag.
const spiritStoneRow = computed(() => ({
  owned: gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID),

  amount: selectedRecipe.value?.spiritStoneCost ?? 0,
}))

const jobs = computed(() => {
  stateVersion.value

  void nowMs.value

  return gameManager.getAlchemyJobs().map((job) => {
    const remainingMs = Math.max(0, job.completesAtMs - nowMs.value)

    const totalSeconds = Math.max(1, Math.ceil((job.completesAtMs - job.startedAtMs) / 1000))

    const pillName = gameManager.pillRegistry.has(job.pillId)
      ? gameManager.pillRegistry.get(job.pillId).name
      : job.pillId

    return {
      jobId: job.jobId,

      pillName,

      progress: Math.min(1, 1 - remainingMs / (totalSeconds * 1000)),

      remainingLabel: `${Math.ceil(remainingMs / 60000)}p`,
    }
  })
})

function startJob() {
  if (!selectedRecipe.value || !selectedHerbId.value) {
    return
  }

  const result = gameManager.startAlchemyJob(selectedRecipe.value.id, selectedHerbId.value, player.$state)

  if (!result.ok) {
    console.warn('start alchemy failed:', result.reason)
  }

  bumpState()
}

function cancelJob(jobId: string) {
  gameManager.cancelAlchemyJob(jobId)

  bumpState()
}
</script>

<template>
  <div class="alchemy-view">
    <div class="alchemy-view__recipes scrollfade">
      <section class="alchemy-group">
        <p class="alchemy-group__eyebrow">Đan lô hiện tại</p>
        <h4 class="alchemy-group__title">{{ currentGradeLabel }}</h4>

        <button
          v-for="(recipe, index) in recipes"
          :key="recipe.id"
          type="button"
          class="alchemy-row"
          :class="{ 'is-selected': recipe.id === selectedRecipeId }"
          @click="selectRecipe(recipe)"
        >
          <span class="alchemy-row__pill">
            <b>{{ String(index + 1).padStart(2, '0') }}</b>
            {{
              gameManager.pillRegistry.has(recipe.pillId)
                ? gameManager.pillRegistry.get(recipe.pillId).name
                : recipe.pillId
            }}
          </span>

          <span class="alchemy-row__herb">{{ recipe.herbAmount }} chủ dược</span>
        </button>
      </section>
    </div>

    <div v-if="selectedRecipe" class="alchemy-detail scrollfade">
      <header class="alchemy-detail__header">
        <span>ĐAN PHƯƠNG</span>
        <h3>{{ gameManager.pillRegistry.get(selectedRecipe.pillId).name }}</h3>
        <small>{{ currentGradeLabel }}</small>
      </header>
      <!-- §9.3: preview thời gian + tỷ lệ tổng + guaranteed + chance cộng -->
      <section v-if="preview" class="alchemy-detail__block">
        <h4>Xem trước lần luyện</h4>

        <p class="alchemy-detail__outcome">
          Chắc chắn {{ preview.guaranteedPills }} viên,
          {{ preview.extraPillChance }}% thêm 1 viên
        </p>

        <!-- Bỏ "— Đan Phòng cấp N" (2026-08-30, bug report: trùng lặp
             Cấp đã hiện ở header building phía trên panel). -->
        <p class="alchemy-detail__duration">
          Thời gian: ~{{ Math.ceil(preview.durationSeconds / 60) }} phút
        </p>
      </section>

      <section class="alchemy-detail__block">
        <h4>Linh Thảo ({{ selectedRecipe.herbAmount }})</h4>

        <label
          v-for="variant in variantRows"
          :key="variant.materialId"
          class="alchemy-variant"
          :class="{ 'is-enough': variant.enough }"
        >
          <input type="radio" :value="variant.materialId" v-model="selectedHerbId" />

          <span>{{ variant.label }}</span>

          <span class="alchemy-variant__owned">×{{ variant.owned }}</span>
        </label>
      </section>

      <section class="alchemy-detail__block">
        <h4>Chi phí khác</h4>

        <ul class="alchemy-costs">
          <StatRow v-if="fuelWoodRow" :label="fuelWoodRow.label" :tone="fuelWoodRow.owned < fuelWoodRow.amount ? 'negative' : 'default'">
            {{ fuelWoodRow.owned }}/{{ fuelWoodRow.amount }}
          </StatRow>

          <StatRow :label="t('alchemy.spiritStones')" :tone="spiritStoneRow.owned < spiritStoneRow.amount ? 'negative' : 'default'">
            {{ spiritStoneRow.owned }}/{{ spiritStoneRow.amount }}
          </StatRow>
        </ul>

        <GameButton class="alchemy-detail__action" size="sm" accent-var="--scene-fire-text" @click="startJob">
          {{ t('alchemy.startBrewing') }}
        </GameButton>
      </section>

      <section v-if="jobs.length > 0" class="alchemy-detail__block">
        <h4>Lò đang luyện</h4>

        <div v-for="job in jobs" :key="job.jobId" class="alchemy-job">
          <div class="alchemy-job__head">
            <span>{{ job.pillName }}</span>

            <span>{{ job.remainingLabel }}</span>
          </div>

          <Bar class="alchemy-job__progress" :value="job.progress" :max="1" :height="6" />

          <GameButton class="alchemy-job__cancel" variant="ghost" size="sm" @click="cancelJob(job.jobId)">
            Huỷ (mất nguyên liệu)
          </GameButton>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.alchemy-view {
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  color: var(--paper-text);
  font-family: var(--font-body);
  overflow: hidden;
  background:
    var(--paper-grain) 0 0 / 160px 160px repeat,
    radial-gradient(circle at 23% 0%, color-mix(in srgb, var(--scene-fire-glow) 10%, transparent), transparent 40%),
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 60%, var(--paper-200) 100%);
}

.alchemy-view__recipes {
  flex: 0 0 min(39%, 420px);
  overflow-y: auto;
  padding: 14px;
  border-right: 1px solid color-mix(in srgb, var(--scene-fire-accent) 35%, var(--paper-line));
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alchemy-group__eyebrow { margin: 0; color: var(--cinnabar); font-size: var(--text-xs); letter-spacing: .18em; }
.alchemy-group > small { display: block; margin-bottom: 9px; color: var(--paper-text-muted); }

.alchemy-group__title {
  margin: 2px 0;
  color: var(--paper-text);
  font: 700 var(--text-lg) var(--font-display);
}

.alchemy-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  padding: 9px 10px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--scene-fire-accent) 10%, var(--paper-50)), color-mix(in srgb, var(--scene-fire-accent) 4%, var(--paper-100)));
  border: 1px solid color-mix(in srgb, var(--scene-fire-accent) 30%, var(--paper-line));
  border-radius: var(--radius-sm);
  color: var(--paper-text);
  cursor: pointer;
  font-family: var(--font-body);
}

.alchemy-row.is-selected {
  border-color: var(--scene-fire-glow);
  box-shadow: inset 3px 0 var(--scene-fire-glow), 0 0 14px color-mix(in srgb, var(--scene-fire-glow) 18%, transparent);
}

.alchemy-row__pill { display: flex; align-items: center; gap: 8px; }
.alchemy-row__pill b { color: var(--cinnabar); font-size: var(--text-xs); }

.alchemy-row__herb {
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.alchemy-detail {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alchemy-detail__header {
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--scene-fire-accent) 32%, var(--paper-line));
  border-radius: var(--radius-md);
  background: linear-gradient(110deg, color-mix(in srgb, var(--scene-fire-accent) 12%, var(--paper-50)), color-mix(in srgb, var(--scene-fire-accent) 4%, var(--paper-100)));
}
.alchemy-detail__header span { color: var(--cinnabar); font-size: var(--text-xs); letter-spacing: .18em; }
.alchemy-detail__header h3 { margin: 3px 0; color: var(--paper-text); font: 700 var(--text-panel-title) var(--font-display); }
.alchemy-detail__header small { color: var(--paper-text-soft); }

.alchemy-detail__block h4 {
  margin: 0 0 6px;
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--cinnabar);
}

.alchemy-detail__outcome {
  margin: 0 0 4px;
  font-size: var(--text-sm);
  color: var(--jade);
  font-weight: 700;
}

.alchemy-detail__duration {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.alchemy-variant {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: var(--text-sm);
  cursor: pointer;
}

.alchemy-variant:not(.is-enough) {
  color: var(--paper-text-muted);
}

.alchemy-variant__owned {
  margin-left: auto;
  color: var(--paper-text-soft);
}

.alchemy-costs {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: var(--text-sm);
}

.alchemy-detail__action {
  width: 100%;
  padding: 8px;
}

/* Fit-refactor đợt 2 — breakpoint chuyển từ viewport sang CARD qua
   container query (overlay-panel), scene clamp vh. Cột recipes chiếm flex
   thay vì % cứng. */
@container overlay-panel (max-width: 900px) {
  .alchemy-view { flex-direction: column; }
  .alchemy-view__recipes { flex: 0 0 auto; border-right: 0; border-bottom: 1px solid color-mix(in srgb, var(--scene-fire-accent) 30%, transparent); }
}

.alchemy-job {
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.alchemy-job__head {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
}

.alchemy-job__progress {
  border-radius: 3px;
}

.alchemy-job__cancel {
  align-self: flex-end;
  color: var(--crimson);
  font-size: var(--text-xs);
}
</style>
