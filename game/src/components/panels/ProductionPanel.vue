<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { getSpiritStoneMaterialIdForRealmTier } from '@/core/material/SpiritStoneMaterial'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import { SPIRIT_STONE_LABEL } from '@/core/presentation/labels'
import BuildingConstructionGate from './BuildingConstructionGate.vue'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'
import { PILL_FAMILIES } from '@/data/pill/PillFamilies'
import { formatStat } from '@/core/stats/StatLabels'
import { formatDuration } from '@/core/format/formatDuration'

// Sản Xuất (2026-08-25, resource-professions-rework plan §9.1) — thay
// ExplorationPanel: mỗi Địa Giới hiển thị đúng ba card Lâm/Quáng/
// Động Thiên với level + speed, trạng thái idle/producing, đồng hồ
// cycle, trọng số realm tier đã chuẩn hoá, toggle Auto. Nút Start chỉ
// xuất hiện khi idle; KHÔNG có nút Claim — hoàn thành tự gửi Bag (§4.3).
const { t } = useI18n({ useScope: 'local' })

const KIND_META: Record<string, { labelKey: 'forest' | 'mine' | 'grotto'; sigil: string }> = {
  forest: { labelKey: 'forest', sigil: '木' },
  mine: { labelKey: 'mine', sigil: '礦' },
  grotto: { labelKey: 'grotto', sigil: '藥' },
}

function rewardSummary(kind: string): string {
  if (kind === 'forest') return t('panels.production.rewards.forest')

  if (kind === 'mine') return t('panels.production.rewards.mine')

  return t('panels.production.rewards.grotto', { count: PILL_FAMILIES.length })
}

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

interface SiteRow {
  siteId: string

  kind: string

  kindLabel: string

  sigil: string

  name: string

  description: string

  level: number

  maxLevel: number

  speedMultiplier: number

  nextSpeedMultiplier?: number

  autoRestart: boolean

  activeWorkerSlots: number

  assignedWorkers?: number

  isProducing: boolean

  progress: number

  remainingLabel: string
}

const rows = computed<SiteRow[]>(() => {
  stateVersion.value

  void nowMs.value

  return gameManager.getProductionViews(nowMs.value).map((view) => {
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

      speedMultiplier: view.speedMultiplier,

      nextSpeedMultiplier: view.nextSpeedMultiplier,

      autoRestart: view.state.autoRestart,

      activeWorkerSlots: view.state.activeWorkerSlots,

      assignedWorkers: view.state.assignedWorkers,

      isProducing: view.state.activeCycle !== undefined,

      progress: Math.min(1, Math.max(0, 1 - cycleRemainingMs / totalMs)),

      remainingLabel:
        remainingSeconds > 0 ? formatDuration(remainingSeconds) : t('panels.production.done'),
    }
  })
})

function start(siteId: string) {
  if (gameManager.startProductionCycle(siteId, player.$state)) {
    bumpState()
  }
}

function toggleAuto(row: SiteRow) {
  gameManager.setProductionAutoRestart(row.siteId, !row.autoRestart)

  bumpState()
}

function upgradeCostRows(siteId: string, level: number) {
  stateVersion.value

  const costs = gameManager.getProductionUpgradeCost(siteId) ?? []

  const cost = costs[level - 1]
  const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(level + 1)

  if (!cost) {
    return []
  }

  return [
    {
      label: gameManager.materialRegistry.has(cost.woodMaterialId)
        ? gameManager.materialRegistry.get(cost.woodMaterialId).name
        : cost.woodMaterialId,

      owned: gameManager.materialBag.getAmount(cost.woodMaterialId),

      amount: cost.woodAmount,
    },
    {
      label: gameManager.materialRegistry.has(spiritStoneId)
        ? gameManager.materialRegistry.get(spiritStoneId).name
        : SPIRIT_STONE_LABEL,

      // Plan Workstream F — Linh Thạch đọc từ MaterialBag.
      owned: gameManager.materialBag.getAmount(spiritStoneId),

      amount: cost.spiritStone,
    },
  ]
}

function canUpgrade(siteId: string, level: number): boolean {
  const rowsForCost = upgradeCostRows(siteId, level)

  return level + 1 <= getRealmTier(player.realmId) && rowsForCost.every((entry) => entry.owned >= entry.amount)
}

function upgrade(siteId: string) {
  if (gameManager.upgradeProductionSite(siteId, player.$state)) {
    bumpState()
  }
}

// ================= Chiêu Hiền Quán — phân bổ nhân công (2026-09-02) =================

const workerMode = ref<'auto' | 'manual'>('auto')

const workerCapacity = computed(() => player.autoWorkerCapacity ?? 0)

const assignedTotal = computed(() =>
  rows.value.reduce((sum, row) => sum + (row.assignedWorkers ?? 0), 0),
)

function setWorkerMode(mode: 'auto' | 'manual') {
  workerMode.value = mode

  if (mode === 'auto') {
    // Về auto: xóa mọi assignment manual.
    for (const row of rows.value) {
      gameManager.assignWorkers(row.siteId, undefined)
    }

    bumpState()
  }
}

function assign(row: SiteRow, count: number) {
  gameManager.assignWorkers(row.siteId, count)

  bumpState()
}

// ================= Linh mạch Khai Vật Đường (thế Linh Tuyền, 2026-09-02) =================

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
    gameManager.getBuildingStoredAmount(outpostInstance.value.instanceId, nowMs.value / 1000),
  )
})

const linMachCapacity = computed(() =>
  outpostInstance.value ? gameManager.getBuildingCapacity(outpostInstance.value.instanceId) : 0,
)

const linMachRatePerMinute = computed(() =>
  outpostInstance.value ? gameManager.getBuildingRatePerMinute(outpostInstance.value.instanceId) : 0,
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

  gameManager.collectBuilding(outpostInstance.value.instanceId, player.$state, nowMs.value / 1000)

  bumpState()
}

</script>

<template>
  <BuildingConstructionGate building-id="gathering_outpost">
    <div class="production-panel scrollfade">
      <p class="production-panel__summary">
        {{ t('panels.production.summary') }}
      </p>

      <!-- Chiêu Hiền Quán — phân bổ nhân công (2026-09-02) -->
      <div class="worker-allocation">
        <header class="worker-allocation__header">
          <strong>{{ t('panels.production.workersHeader', { used: workerMode === 'manual' ? assignedTotal : workerCapacity, total: workerCapacity }) }}</strong>

          <div class="worker-allocation__mode">
            <label>
              <input
                type="radio"
                name="worker-mode"
                :checked="workerMode === 'auto'"
                @change="setWorkerMode('auto')"
              />
              {{ t('panels.production.workerModeAuto') }}
            </label>

            <label>
              <input
                type="radio"
                name="worker-mode"
                :checked="workerMode === 'manual'"
                @change="setWorkerMode('manual')"
              />
              {{ t('panels.production.workerModeManual') }}
            </label>
          </div>
        </header>

        <div v-if="workerMode === 'manual'" class="worker-allocation__sliders">
          <label v-for="row in rows" :key="row.siteId" class="worker-allocation__slider">
            <span>{{ row.name }}</span>

            <input
              type="range"
              min="0"
              :max="workerCapacity"
              :value="row.assignedWorkers ?? 0"
              :aria-label="t('panels.production.workerAssignAria', { name: row.name })"
              @input="assign(row, Number(($event.target as HTMLInputElement).value))"
            />

            <span class="worker-allocation__count">
              {{ row.assignedWorkers ?? 0 }}
            </span>
          </label>
        </div>

        <p v-else class="worker-allocation__auto-hint">
          {{ t('panels.production.workerAutoHint') }}
        </p>
      </div>

      <!-- Linh mạch Khai Vật Đường — claim Linh Thạch (thế Linh Tuyền) -->
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

            <span>×{{ formatStat('speedMultiplier', row.speedMultiplier) }} {{ t('panels.production.speedSuffix') }}</span>

            <span v-if="row.nextSpeedMultiplier">
              {{ t('panels.production.nextSpeedPrefix') }}{{ formatStat('speedMultiplier', row.nextSpeedMultiplier) }}
            </span>

            <span>{{ t('panels.production.workers', { count: row.activeWorkerSlots }) }}</span>
          </div>

          <!-- Bỏ dòng "Trọng số tier" (2026-08-30, bug report: thông tin
               hệ thống — số trọng số RNG nội bộ, người chơi không tác
               động được nên không giúp ra quyết định gì). -->
          <p class="site-card__reward">{{ rewardSummary(row.kind) }}</p>

          <template v-if="row.isProducing">
            <Bar class="site-card__progress" :value="row.progress" :max="1" :height="8" />

            <p class="site-card__status">{{ t('panels.production.statusProducing', { time: row.remainingLabel }) }}</p>
          </template>

          <GameButton
            v-else
            class="site-card__action"
            size="sm"
            @click="start(row.siteId)"
          >
            {{ t('panels.production.start') }}
          </GameButton>

          <label class="site-card__auto">
            <input
              type="checkbox"
              :checked="row.autoRestart"
              @change="toggleAuto(row)"
            />

            {{ t('panels.production.autoRepeat') }}
          </label>

          <div v-if="row.level < row.maxLevel" class="site-card__upgrade">
            <ul>
              <li
                v-for="(cost, index) in upgradeCostRows(row.siteId, row.level)"
                :key="index"
                :class="{ 'is-missing': cost.owned < cost.amount }"
              >
                {{ cost.label }}: {{ cost.owned }}/{{ cost.amount }}
              </li>
            </ul>

            <GameButton
              class="site-card__upgrade-button"
              variant="ghost"
              size="sm"
              :disabled="!canUpgrade(row.siteId, row.level)"
              @click="upgrade(row.siteId)"
            >
              {{ t('panels.production.upgrade') }}
            </GameButton>
          </div>
        </article>
      </div>
    </div>
  </BuildingConstructionGate>
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

/* Chiêu Hiền Quán — phân bổ nhân công */
.worker-allocation {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--jade) 35%, var(--paper-line));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--jade) 6%, var(--paper-50));
}

.worker-allocation__header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.worker-allocation__mode {
  display: flex;
  gap: 12px;
  font-size: var(--text-xs);
}

.worker-allocation__mode label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.worker-allocation__sliders {
  display: grid;
  gap: 6px;
}

.worker-allocation__slider {
  display: grid;
  grid-template-columns: minmax(80px, auto) 1fr auto;
  align-items: center;
  gap: 10px;
  font-size: var(--text-xs);
}

.worker-allocation__count {
  min-width: 2ch;
  text-align: right;
  color: var(--jade);
}

.worker-allocation__auto-hint {
  margin: 0;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

/* Linh mạch Khai Vật Đường */
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

.site-card__action {
  padding: 8px;
}

.site-card__auto {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
  cursor: pointer;
}

.site-card__upgrade ul {
  list-style: none;
  margin: 0 0 6px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--text-xs);
}

.site-card__upgrade li.is-missing {
  color: var(--crimson);
}

.site-card__upgrade-button {
  width: 100%;
}

.site-card__upgrade-button:disabled {
  color: var(--paper-text-muted);
  cursor: not-allowed;
}

</style>
