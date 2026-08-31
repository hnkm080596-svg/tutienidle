<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
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

function rewardSummary(kind: string): string {
  if (kind === 'forest') return 'Gỗ theo cảnh giới thu thập'

  if (kind === 'mine') return 'Quáng Thập Niên → Thượng Cổ'

  return `${PILL_FAMILIES.length} chủ dược`
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

</script>

<template>
  <BuildingConstructionGate building-id="gathering_outpost">
    <div class="production-panel scrollfade">
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

            <span>×{{ formatStat('speedMultiplier', row.speedMultiplier) }} tốc độ</span>

            <span v-if="row.nextSpeedMultiplier">
              kế tiếp ×{{ formatStat('speedMultiplier', row.nextSpeedMultiplier) }}
            </span>

            <span>Nhân công: {{ row.activeWorkerSlots }}</span>
          </div>

          <!-- Bỏ dòng "Trọng số tier" (2026-08-30, bug report: thông tin
               hệ thống — số trọng số RNG nội bộ, người chơi không tác
               động được nên không giúp ra quyết định gì). -->
          <p class="site-card__reward">{{ rewardSummary(row.kind) }}</p>

          <template v-if="row.isProducing">
            <Bar class="site-card__progress" :value="row.progress" :max="1" :height="8" />

            <p class="site-card__status">Đang sản xuất — còn {{ row.remainingLabel }}</p>
          </template>

          <GameButton
            v-else
            class="site-card__action"
            size="sm"
            @click="start(row.siteId)"
          >
            Bắt đầu
          </GameButton>

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

            <GameButton
              class="site-card__upgrade-button"
              variant="ghost"
              size="sm"
              :disabled="!canUpgrade(row.siteId, row.level)"
              @click="upgrade(row.siteId)"
            >
              Nâng cấp nguồn
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
