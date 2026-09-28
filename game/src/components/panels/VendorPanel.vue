<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import GameButton from '@/components/common/GameButton.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import { useNotificationStore } from '@/stores/notification'
import { getSpiritStoneMaterialIdForRealmTier } from '@/core/material/SpiritStoneMaterial'
import { getRealmTier } from '@/core/realm/RealmTierMap'

// Ky Bao Cac -- gp123 6G (2026-09-06): chi con Hoa Ban (thu mua nguyen
// lieu thua lay Linh Thach). 2 card Doi Pham (Linh Thach 100->1, Linh
// Moc/Khoang 10->1 theo canh gioi) da XOA cung API quy doi
// (GameManager.convertSpiritStonesUp/convertMaterialTier). Thu mua chi
// liet ke material pham NGHE thap hon canh gioi nguoi choi (gate
// sell-by-grade trong VendorSystem) -- danh sach rong o canh pham nhan
// la hanh vi dung, khong phai loi hien thi. Tab "Cua hang" an theo
// quyet dinh user (khong render).
const BUILDING_ID = 'vendor'

const player = usePlayerStore()

const gameManager = useGameManager()

const { t } = useI18n()

const { stateVersion, bumpState } = useStateVersion()

const template = computed(() => {
  stateVersion.value

  return gameManager.buildingOps.getBuildingDefinitions().find((entry) => entry.id === BUILDING_ID)
})

const sellableRows = computed(() => {
  stateVersion.value

  return gameManager.economyOps
    .getVendorSellableRows(player.$state)
    .filter((row) => row.owned > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
})

// ui-audit economy H2 (2026-09-28) -- "Ban het" used to burn the whole
// stack on one click with no quantity, no total preview, no confirm and
// no success feedback. Rows now carry a quantity input (defaults to the
// full stack) + an inline "+N Linh Thach" total; selling the ENTIRE
// stack routes through ConfirmModal (the irreversible case), partial
// sells commit directly, and success pushes a loot toast.
const sellQuantities = reactive<Record<string, number>>({})

function qtyFor(materialId: string, owned: number): number {
  const qty = sellQuantities[materialId] ?? owned

  return Math.min(Math.max(1, Math.floor(qty) || 1), owned)
}

function onQtyInput(materialId: string, owned: number, event: Event) {
  const raw = Number((event.target as HTMLInputElement).value)

  sellQuantities[materialId] = Number.isFinite(raw)
    ? Math.min(Math.max(1, Math.floor(raw)), owned)
    : owned
}

// Sell price lands in the player's realm-tier spirit stone -- name it so
// the preview/toast read "+N Ha pham Linh Thach" instead of a bare
// "ha/don vi" fragment (audit N2).
const sellStoneName = computed(() => {
  const materialId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(player.realmId))

  return gameManager.materialRegistry.has(materialId)
    ? gameManager.materialRegistry.get(materialId).name
    : t('alchemy.spiritStones')
})

// Selling the WHOLE stack is the irreversible case - confirm it.
const confirmAllRow = ref<{ materialId: string; name: string; qty: number; total: number } | null>(null)

function sell(materialId: string, amount: number, name: string) {
  if (amount <= 0) {
    return
  }

  const result = gameManager.economyOps.sellMaterialToVendor(materialId, amount, player.$state)

  // gp123 6G fix round 1 -- gate message CHI khi reason la grade_not_below;
  // reason khac (sole_recipe_ingredient, bag_full, ...) nhan message
  // generic de khong noi sai su that.
  if (!result.ok) {
    useNotificationStore().push(
      'warning',
      result.reason === 'grade_not_below'
        ? t('panels.vendor.gateNotBelow')
        : t('panels.vendor.sellRejected'),
    )

    return
  }

  useNotificationStore().push(
    'loot',
    t('panels.vendor.sell.sold', {
      qty: formatNumber(amount),
      name,
      gained: formatNumber(result.gained ?? 0),
      stone: sellStoneName.value,
    }),
  )

  delete sellQuantities[materialId]

  bumpState()
}

function onSellClick(row: { materialId: string; name: string; owned: number; unitPrice: number }) {
  const qty = qtyFor(row.materialId, row.owned)

  if (qty === row.owned) {
    confirmAllRow.value = {
      materialId: row.materialId,
      name: row.name,
      qty,
      total: qty * row.unitPrice,
    }

    return
  }

  sell(row.materialId, qty, row.name)
}

function confirmSellAll() {
  const row = confirmAllRow.value

  confirmAllRow.value = null

  if (row) {
    sell(row.materialId, row.qty, row.name)
  }
}
</script>

<template>
  <section class="vendor-panel scrollfade">
    <p class="vendor-panel__description">{{ template?.description }}</p>

    <div class="vendor-panel__card">
      <h3>{{ t('panels.vendor.sell.title') }}</h3>

      <small class="resource-card__rate">{{ t('panels.vendor.sell.rate') }}</small>

      <div v-if="sellableRows.length" class="resource-card__rows">
        <div v-for="row in sellableRows" :key="row.materialId" class="resource-card__row">
          <span class="resource-card__name">
            {{ row.name }} <strong>({{ formatNumber(row.owned) }})</strong>
            — {{ formatNumber(row.unitPrice) }} {{ t('panels.vendor.sell.unitPriceSuffix') }}
          </span>

          <span class="resource-card__sale">
            <input
              class="resource-card__qty"
              type="number"
              min="1"
              :max="row.owned"
              :value="qtyFor(row.materialId, row.owned)"
              :aria-label="t('panels.vendor.sell.quantityAria')"
              @input="onQtyInput(row.materialId, row.owned, $event)"
            />

            <span class="resource-card__total">
              {{ t('panels.vendor.sell.totalPreview', { total: formatNumber(qtyFor(row.materialId, row.owned) * row.unitPrice), stone: sellStoneName }) }}
            </span>

            <GameButton size="sm" @click="onSellClick(row)">
              {{ t('panels.vendor.sell.button') }}
            </GameButton>
          </span>
        </div>
      </div>

      <p v-else class="resource-card__empty">{{ t('panels.vendor.sell.empty') }}</p>
    </div>

    <ConfirmModal
      :open="confirmAllRow !== null"
      :title="t('panels.vendor.sell.confirmTitle')"
      :message="confirmAllRow
        ? t('panels.vendor.sell.confirmMessage', { qty: formatNumber(confirmAllRow.qty), name: confirmAllRow.name, total: formatNumber(confirmAllRow.total), stone: sellStoneName })
        : ''"
      :confirm-label="t('panels.vendor.sell.button')"
      @confirm="confirmSellAll"
      @cancel="confirmAllRow = null"
    />
  </section>
</template>

<style scoped>
.vendor-panel {
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
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 60%, var(--paper-200) 100%);
}

.vendor-panel__description {
  margin: 0;
  color: var(--paper-eyebrow);
  font-size: var(--text-sm);
}

.resource-card__rate {
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

.resource-card__empty {
  margin: 0;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
  font-style: italic;
}

.resource-card__rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.resource-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--mineral-gold) 6%, var(--paper-100));
  font-size: var(--text-xs);
  color: var(--paper-text);
}

.resource-card__row strong {
  color: var(--jade);
}

.resource-card__name {
  min-width: 0;
  flex: 1 1 40%;
}

.resource-card__sale {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resource-card__qty {
  width: 4.5em;
  min-height: var(--tap-min);
  padding: 0 var(--space-1);
  background: var(--paper-50);
  color: var(--paper-text);
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  text-align: right;
}

.resource-card__total {
  color: var(--mineral-gold);
  font-weight: 700;
  white-space: nowrap;
}

.vendor-panel__card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-md);
  background: linear-gradient(110deg, color-mix(in srgb, var(--mineral-gold) 12%, var(--paper-50)), color-mix(in srgb, var(--mineral-gold) 5%, var(--paper-100)));
}

.vendor-panel__card h3 {
  margin: 0;
  color: var(--mineral-gold);
  font: 700 var(--text-lg) var(--font-display);
}
</style>
