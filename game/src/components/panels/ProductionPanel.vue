<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { getSpiritStoneMaterialIdForRealmTier } from '@/core/material/SpiritStoneMaterial'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import BuildingConstructionGate from './BuildingConstructionGate.vue'
import { PILL_FAMILIES } from '@/data/pill/PillFamilies'

// Sản Xuất (2026-08-25, resource-professions-rework plan §9.1) — thay
// ExplorationPanel: mỗi Địa Giới hiển thị đúng ba card Lâm/Quáng/
// Động Thiên với level + speed, trạng thái idle/producing, đồng hồ
// cycle, trọng số realm tier đã chuẩn hoá, toggle Auto. Nút Start chỉ
// xuất hiện khi idle; KHÔNG có nút Claim — hoàn thành tự gửi Bag (§4.3).
const KIND_META: Record<string, { label: string; sigil: string }> = {
  forest: { label: 'Lâm', sigil: '木' },
  mine: { label: 'Quáng', sigil: '礦' },
  grotto: { label: 'Động Thiên', sigil: '藥' },
}

const TIER_WEIGHT_LABELS: Record<string, readonly string[]> = {
  low: ['60 / 20 / 10'],
  middle: ['40 / 40 / 20'],
  high: ['20 / 40 / 40'],
}

function tierProfileLabel(realmId: string): string {
  if (realmId === 'mortal') return '60/20/10'

  if (realmId === 'qi_refining') return '40/40/20'

  return '20/40/40'
}

function rewardSummary(kind: string): string {
  if (kind === 'forest') return 'Gỗ theo cảnh giới thu thập'

  if (kind === 'mine') return 'Quáng phẩm Hoàng → Tiên'

  return `${PILL_FAMILIES.length} chủ dược: ${PILL_FAMILIES.map((family) => family.herbName).join(' · ')}`
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

    const minutes = Math.floor(remainingSeconds / 60)

    const seconds = remainingSeconds % 60

    return {
      siteId: view.definition.siteId,

      kind: view.definition.kind,

      kindLabel: KIND_META[view.definition.kind]?.label ?? view.definition.kind,

      sigil: KIND_META[view.definition.kind]?.sigil ?? '•',

      name: view.definition.name,

      description: view.definition.description,

      level: view.state.level,

      maxLevel: view.definition.maxLevel,

      speedMultiplier: view.speedMultiplier,

      nextSpeedMultiplier: view.nextSpeedMultiplier,

      autoRestart: view.state.autoRestart,

      activeWorkerSlots: view.state.activeWorkerSlots,

      isProducing: view.state.activeCycle !== undefined,

      progress: Math.min(1, Math.max(0, 1 - cycleRemainingMs / totalMs)),

      remainingLabel:
        remainingSeconds > 0 ? `${minutes}p ${String(seconds).padStart(2, '0')}s` : 'Hoàn tất…',
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
        : 'Linh Thạch',

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
</script>

<template>
  <BuildingConstructionGate building-id="gathering_outpost">
    <div class="production-panel">
      <p class="production-panel__summary">
        Địa Giới Thanh Vân — chọn nguồn, bắt đầu cycle, nhận thẳng nguyên liệu vào Túi.
      </p>

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
            <span>Cấp {{ row.level }}/{{ row.maxLevel }}</span>

            <span>×{{ row.speedMultiplier.toFixed(2) }} tốc độ</span>

            <span v-if="row.nextSpeedMultiplier">
              kế tiếp ×{{ row.nextSpeedMultiplier.toFixed(2) }}
            </span>

            <span>Nhân công: {{ row.activeWorkerSlots }}</span>
          </div>

          <!-- Trọng số realm tier đã chuẩn hoá (§9.1) -->
          <p class="site-card__weights">
            Trọng số tier theo cấp thu thập:
            <strong>{{ tierProfileLabel(player.$state.realmId) }}</strong>
          </p>

          <p class="site-card__reward">{{ rewardSummary(row.kind) }}</p>

          <template v-if="row.isProducing">
            <div class="site-card__progress">
              <div class="site-card__progress-fill" :style="{ width: `${row.progress * 100}%` }" />
            </div>

            <p class="site-card__status">Đang sản xuất — còn {{ row.remainingLabel }}</p>
          </template>

          <button
            v-else
            type="button"
            class="site-card__action"
            @click="start(row.siteId)"
          >
            Bắt đầu
          </button>

          <label class="site-card__auto">
            <input
              type="checkbox"
              :checked="row.autoRestart"
              @change="toggleAuto(row)"
            />

            Auto lặp lại
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

            <button
              type="button"
              class="site-card__upgrade-button"
              :disabled="!canUpgrade(row.siteId, row.level)"
              @click="upgrade(row.siteId)"
            >
              Nâng cấp nguồn
            </button>
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
  color: var(--text-primary);
  font-family: var(--font-body);
  background:
    radial-gradient(circle at 50% 0, rgba(81, 154, 117, .12), transparent 38%),
    linear-gradient(150deg, rgba(13, 25, 22, .96), rgba(10, 14, 17, .98));
}

.production-panel__summary {
  margin: 0;
  color: var(--gold-500);
  font-size: var(--text-sm);
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
  background: linear-gradient(145deg, rgba(35, 48, 39, .84), rgba(16, 21, 21, .92));
  border: 1px solid rgba(111, 167, 128, .25);
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
    radial-gradient(circle, rgba(116, 197, 141, .25), transparent 48%),
    linear-gradient(130deg, #21392c, #101919);
}

.site-card__art[data-kind='mine'] { background: radial-gradient(circle, rgba(202, 159, 91, .24), transparent 48%), linear-gradient(130deg, #382e23, #171515); }
.site-card__art[data-kind='grotto'] { background: radial-gradient(circle, rgba(97, 178, 190, .25), transparent 48%), linear-gradient(130deg, #203a3b, #11191d); }
.site-card__art span {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  color: #d8eacb;
  font: 700 1.75rem var(--font-display);
  border: 1px solid rgba(213, 229, 195, .38);
  border-radius: 50%;
  background: rgba(8, 18, 14, .58);
  box-shadow: 0 0 24px rgba(101, 194, 130, .2), inset 0 0 16px rgba(153, 221, 174, .08);
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
  font-size: 1rem;
}

.site-card__kind {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ink-700);
  font-size: var(--text-xs);
  color: var(--gold-500);
}

.site-card__description {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.site-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: var(--text-xs);
  color: var(--jade);
}

.site-card__weights,
.site-card__reward {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.site-card__progress {
  height: 8px;
  border-radius: 4px;
  background: var(--ink-700);
  overflow: hidden;
}

.site-card__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--jade), var(--gold-500));
  transition: width 0.5s linear;
}

.site-card__status {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.site-card__action {
  padding: 8px;
  background: var(--gold-500);
  color: var(--gold-ink);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font-body);
}

.site-card__auto {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs);
  color: var(--text-secondary);
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
  color: var(--danger, #e05d5d);
}

.site-card__upgrade-button {
  width: 100%;
  padding: 6px;
  background: transparent;
  border: 1px solid var(--ink-line);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  cursor: pointer;
  font-size: var(--text-xs);
  font-family: var(--font-body);
}

.site-card__upgrade-button:disabled {
  color: var(--text-muted);
  cursor: not-allowed;
}
</style>
