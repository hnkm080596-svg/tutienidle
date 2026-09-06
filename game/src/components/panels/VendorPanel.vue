<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import GameButton from '@/components/common/GameButton.vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import { useNotificationStore } from '@/stores/notification'

// Ký Bảo Các — gp123 6G (2026-09-06): chỉ còn Hóa Bán (thu mua nguyên
// liệu thừa lấy Linh Thạch). 2 card Đổi Phẩm (Linh Thạch 100→1, Linh
// Mộc/Khoáng 10→1 theo cảnh giới) đã XÓA cùng API quy đổi
// (GameManager.convertSpiritStonesUp/convertMaterialTier). Thu mua chỉ
// liệt kê material phẩm NGHỀ thấp hơn cảnh giới người chơi (gate
// sell-by-grade trong VendorSystem) — danh sách rỗng ở cảnh phàm nhân
// là hành vi đúng, không phải lỗi hiển thị. Tab "Cửa hàng" ẩn theo
// quyết định user (không render).
const BUILDING_ID = 'vendor'

const player = usePlayerStore()

const gameManager = useGameManager()

const { t } = useI18n({ useScope: 'local' })

const { stateVersion, bumpState } = useStateVersion()

const template = computed(() => {
  stateVersion.value

  return gameManager.getBuildingDefinitions().find((entry) => entry.id === BUILDING_ID)
})

const sellableRows = computed(() => {
  stateVersion.value

  return gameManager
    .getVendorSellableRows(player.$state)
    .filter((row) => row.owned > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
})

function sellAll(materialId: string, owned: number) {
  if (owned <= 0) {
    return
  }

  const result = gameManager.sellMaterialToVendor(materialId, owned, player.$state)

  // gp123 6G fix round 1 — gate message CHỈ khi reason là grade_not_below;
  // reason khác (sole_recipe_ingredient, bag_full, ...) nhận message
  // generic để không nói sai sự thật.
  if (!result.ok) {
    useNotificationStore().push(
      'warning',
      result.reason === 'grade_not_below'
        ? t('panels.vendor.gateNotBelow')
        : t('panels.vendor.sellRejected'),
    )

    return
  }

  bumpState()
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
          <span>
            {{ row.name }} <strong>({{ formatNumber(row.owned) }})</strong>
            — {{ formatNumber(row.unitPrice) }} {{ t('panels.vendor.sell.unitPriceSuffix') }}
          </span>

          <GameButton size="sm" @click="sellAll(row.materialId, row.owned)">
            {{ t('panels.vendor.sell.button') }}
          </GameButton>
        </div>
      </div>

      <p v-else class="resource-card__empty">{{ t('panels.vendor.sell.empty') }}</p>
    </div>
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
