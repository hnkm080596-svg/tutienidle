<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { getSpiritStoneMaterialIdForRealmTier } from '@/core/material/SpiritStoneMaterial'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import { SPIRIT_STONE_LABEL } from '@/core/presentation/labels'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'
import { PILL_FAMILIES } from '@/data/pill/PillFamilies'
import { formatStat } from '@/core/stats/StatLabels'
import { formatDuration } from '@/core/format/formatDuration'
import { betaRecipeFamilyOfId } from '@/core/betaScope'

// San Xuat (2026-08-25, resource-professions-rework plan sec9.1) - thay
// ExplorationPanel: moi Dia Gioi hien thi dung ba card Lam/Quang/
// Dong Thien voi level + speed, trang thai idle/producing, dong ho
// cycle, normalized realm-tier weights and Auto toggle. Production runs
// independently for each enabled site; completions go straight to Bag.
const { t } = useI18n()

const KIND_META: Record<string, { labelKey: 'forest' | 'mine' | 'grotto'; sigil: string }> = {
  forest: { labelKey: 'forest', sigil: '木' },
  mine: { labelKey: 'mine', sigil: '礦' },
  grotto: { labelKey: 'grotto', sigil: '藥' },
}

function rewardSummary(kind: string): string {
  if (kind === 'forest') return t('panels.production.rewards.forest')

  if (kind === 'mine') return t('panels.production.rewards.mine')

  // CONSUMER-01: advertise only beta-admitted families - the grotto can
  // never produce a scope-hidden recipe, so PILL_FAMILIES.length would
  // overstate the card against the alchemy authority seam.
  return t('panels.production.rewards.grotto', {
    count: PILL_FAMILIES.filter((family) => betaRecipeFamilyOfId(family.id) !== null).length,
  })
}

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

const nowMs = ref(gameManager.time.now())

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    nowMs.value = gameManager.time.now()
  }, 500)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

interface SiteRow {
  siteId: string

  kind: string

  kindLabel: string

  sigil: string

  name: string

  description: string

  level: number

  maxLevel: number

  productionSpeedMultiplier: number

  nextProductionSpeedMultiplier?: number

  autoRestart: boolean

  isProducing: boolean

  progress: number

  remainingLabel: string
}

const rows = computed<SiteRow[]>(() => {
  stateVersion.value

  void nowMs.value

  return gameManager.buildingOps.getProductionViews(nowMs.value).map((view) => {
    const cycleRemainingMs = view.cycleRemainingMs ?? 0

    const totalMs = view.cycleTotalMs ?? 1

    const remainingSeconds = Math.ceil(cycleRemainingMs / 1000)

    const meta = KIND_META[view.definition.kind]

    const kindLabel = meta
      ? meta.labelKey === 'forest'
        ? t('panels.production.kinds.forest')
        : meta.labelKey === 'mine'
          ? t('panels.production.kinds.mine')
          : t('panels.production.kinds.grotto')
      : view.definition.kind

    return {
      siteId: view.definition.siteId,

      kind: view.definition.kind,

      kindLabel,

      sigil: KIND_META[view.definition.kind]?.sigil ?? '•',

      name: view.definition.name,

      description: view.definition.description,

      level: view.state.level,

      maxLevel: view.definition.maxLevel,

      productionSpeedMultiplier: view.productionSpeedMultiplier,

      nextProductionSpeedMultiplier: view.nextProductionSpeedMultiplier,

      autoRestart: view.state.autoRestart,

      isProducing: view.state.autoRestart || (view.state.productionCycles?.length ?? 0) > 0,

      progress: Math.min(1, Math.max(0, 1 - cycleRemainingMs / totalMs)),

      remainingLabel:
        remainingSeconds > 0 ? formatDuration(remainingSeconds) : t('panels.production.done'),
    }
  })
})

function toggleAuto(row: SiteRow) {
  gameManager.buildingOps.setProductionAutoRestart(row.siteId, !row.autoRestart)

  bumpState()
}

// ================= Linh mach Khai Vat Duong (the Linh Tuyen, 2026-09-02) =================

const OUTPOST_ID = 'gathering_outpost'

const outpostInstance = computed(() => {
  stateVersion.value

  return gameManager.buildingManager.getByBuildingId(OUTPOST_ID)
})

const linMachStored = computed(() => {
  if (!outpostInstance.value) {
    return 0
  }

  return Math.floor(
    gameManager.buildingOps.getBuildingStoredAmount(outpostInstance.value.instanceId, nowMs.value / 1000),
  )
})

const linMachCapacity = computed(() =>
  outpostInstance.value ? gameManager.buildingOps.getBuildingCapacity(outpostInstance.value.instanceId) : 0,
)

const linMachRatePerMinute = computed(() =>
  outpostInstance.value ? gameManager.buildingOps.getBuildingRatePerMinute(outpostInstance.value.instanceId) : 0,
)

const linMachOutputName = computed(() => {
  const id = getSpiritStoneMaterialIdForRealmTier(getRealmTier(player.realmId))

  return gameManager.materialRegistry.has(id)
    ? gameManager.materialRegistry.get(id).name
    : SPIRIT_STONE_LABEL
})

function collectLinMach() {
  if (!outpostInstance.value || linMachStored.value <= 0) {
    return
  }

  gameManager.buildingOps.collectBuilding(outpostInstance.value.instanceId, player.$state)

  bumpState()
}

</script>

<template>
  <div class="production-panel scrollfade">
      <p class="production-panel__summary">
        {{ t('panels.production.summary') }}
      </p>

      <!-- Linh mach Khai Vat Duong - claim Linh Thach (the Linh Tuyen) -->
      <div v-if="outpostInstance" class="lin-mach">
        <h3 class="lin-mach__title">{{ t('panels.production.linMach.title') }}</h3>

        <div class="lin-mach__card">
          <Bar
            class="lin-mach__progress"
            :value="linMachStored"
            :max="linMachCapacity"
            :height="8"
            pill
          />

          <strong>{{ linMachStored }} / {{ linMachCapacity }} {{ linMachOutputName }}</strong>

          <small class="lin-mach__rate">+{{ linMachRatePerMinute.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) }} {{ t('panels.production.linMach.rateSuffix') }}</small>

          <GameButton
            class="lin-mach__collect"
            size="sm"
            :disabled="linMachStored <= 0"
            @click="collectLinMach"
          >
            {{ t('panels.production.linMach.collect') }}
          </GameButton>
        </div>
      </div>

      <div class="production-panel__grid">
        <article v-for="row in rows" :key="row.siteId" class="site-card">
          <div class="site-card__art" :data-kind="row.kind" aria-hidden="true">
            <span>{{ row.sigil }}</span>
          </div>

          <header class="site-card__header">
            <h3 class="site-card__name">{{ row.name }}</h3>

            <span class="site-card__kind">{{ row.kindLabel }}</span>
          </header>

          <p class="site-card__description">{{ row.description }}</p>

          <div class="site-card__stats">
            <span>{{ t('panels.production.level', { level: row.level, max: row.maxLevel }) }}</span>

            <span>×{{ formatStat('productionSpeedMultiplier', row.productionSpeedMultiplier) }} {{ t('panels.production.speedSuffix') }}</span>

            <span v-if="row.nextProductionSpeedMultiplier">
              {{ t('panels.production.nextSpeedPrefix') }}{{ formatStat('productionSpeedMultiplier', row.nextProductionSpeedMultiplier) }}
            </span>

          </div>

          <!-- Bo dong "Trong so tier" (2026-08-30, bug report: thong tin
               he thong - so trong so RNG noi bo, nguoi choi khong tac
               dong duoc nen khong giup ra quyet dinh gi). -->
          <p class="site-card__reward">{{ rewardSummary(row.kind) }}</p>

          <template v-if="row.isProducing">
            <Bar class="site-card__progress" :value="row.progress" :max="1" :height="8" />

            <p class="site-card__status">{{ t('panels.production.statusProducing', { time: row.remainingLabel }) }}</p>
          </template>

          <label class="site-card__auto">
            <input
              type="checkbox"
              :checked="row.autoRestart"
              @change="toggleAuto(row)"
            />

            {{ t('panels.production.autoRepeat') }}
          </label>

        </article>
      </div>
    </div>
</template>

<style scoped>
.production-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  padding: 12px;
  overflow-y: auto;
  color: var(--paper-text);
  font-family: var(--font-body);
  background:
    var(--paper-grain) 0 0 / 160px 160px repeat,
    radial-gradient(circle at 50% 0, color-mix(in srgb, var(--jade) 8%, transparent), transparent 40%),
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 60%, var(--paper-200) 100%);
}

.production-panel__summary {
  margin: 0;
  color: var(--paper-eyebrow);
  font-size: var(--text-sm);
}

/* Linh mach Khai Vat Duong */
.lin-mach__title {
  margin: 0;
  color: var(--paper-text-soft);
  font: 700 var(--text-sm) var(--font-display);
}

.lin-mach__card {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--scene-water-accent) 40%, var(--paper-line));
  border-radius: var(--radius-md);
  background: linear-gradient(110deg, color-mix(in srgb, var(--scene-water-accent) 12%, var(--paper-50)), color-mix(in srgb, var(--scene-water-accent) 5%, var(--paper-100)));
}

.lin-mach__rate {
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

.lin-mach__collect {
  justify-self: start;
  padding: 6px 12px;
  background: var(--scene-water-accent);
  border: 0;
  color: var(--ink-950);
}

.lin-mach__collect:disabled {
  background: var(--paper-200);
  color: var(--paper-text-muted);
}

.lin-mach__progress {
  --bar-from: var(--scene-water-accent);
  --bar-to: var(--jade);
}

.production-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: 10px;
}

.site-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: linear-gradient(145deg, color-mix(in srgb, var(--scene-forest-accent) 10%, var(--paper-50)), color-mix(in srgb, var(--scene-forest-accent) 4%, var(--paper-100)));
  border: 1px solid color-mix(in srgb, var(--scene-forest-accent) 32%, var(--paper-line));
  border-radius: var(--radius-md);
}

.site-card__art {
  position: relative;
  min-height: 92px;
  display: grid;
  place-items: center;
  overflow: hidden;
  margin: -12px -12px 2px;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  background:
    radial-gradient(circle, color-mix(in srgb, var(--scene-forest-accent) 25%, transparent), transparent 48%),
    linear-gradient(130deg, var(--scene-forest-deep), var(--scene-forest-deep-2));
}

.site-card__art[data-kind='mine'] { background: radial-gradient(circle, color-mix(in srgb, var(--scene-mine-accent) 24%, transparent), transparent 48%), linear-gradient(130deg, var(--scene-mine-deep), var(--scene-mine-deep-2)); }
.site-card__art[data-kind='grotto'] { background: radial-gradient(circle, color-mix(in srgb, var(--scene-grotto-accent) 25%, transparent), transparent 48%), linear-gradient(130deg, var(--scene-grotto-deep), var(--scene-grotto-deep-2)); }
.site-card__art span {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  color: color-mix(in srgb, var(--scene-forest-accent) 40%, var(--text-primary));
  font: 700 var(--text-display) var(--font-display);
  border: 1px solid color-mix(in srgb, var(--scene-forest-accent) 38%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--scene-forest-deep-2) 58%, transparent);
  box-shadow: 0 0 24px color-mix(in srgb, var(--scene-forest-accent) 20%, transparent), inset 0 0 16px color-mix(in srgb, var(--scene-forest-accent) 8%, transparent);
}

.site-card__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
}

.site-card__name {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-lg);
}

.site-card__kind {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ink-700);
  font-size: var(--text-xs);
  color: var(--chrome-500);
}

.site-card__description {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.site-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: var(--text-xs);
  color: var(--jade);
}

.site-card__reward {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.site-card__progress {
  border-radius: 4px;
}

.site-card__progress :deep(.bar__fill) {
  transition: width 0.5s linear;
}

.site-card__status {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.site-card__auto {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
  cursor: pointer;
}

</style>
