<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import GameButton from '@/components/common/GameButton.vue'
import {
  SPIRIT_STONE_CONVERSION_RATIO,
  SPIRIT_STONE_MATERIAL,
  SPIRIT_STONE_MATERIAL_ID,
  SPIRIT_STONE_THUONG_PHAM_MATERIAL,
  SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID,
} from '@/core/material/SpiritStoneMaterial'
import {
  MATERIAL_TIER_CONVERSION_RATIO,
  getNextTierMaterialId,
} from '@/core/material/MaterialTierConversionBalance'
import { formatNumber } from '@/core/format/NumberFormatter'

// Ký Bảo Các (2026-08-25→30) — building CHUYÊN cho mọi cơ chế "đổi/bán",
// tách khỏi Linh Tuyền/Sản Xuất (building không chuyên). Layout 2026-08-30
// — 3 CARD NGANG HÀNG y hệt Khai Vật Đường (ProductionPanel's site-card),
// mỗi card = 1 loại tài nguyên (Linh Thạch/Linh Mộc/Linh Khoáng) thay vì
// thu hoạch, mỗi card có "Đổi Phẩm" (quy đổi theo cảnh giới, cơ chế
// MATERIAL_TIER_CONVERSION_RATIO/SPIRIT_STONE_CONVERSION_RATIO có sẵn).
// "Đổi Chất" (trục Hoàng→Tiên của Linh Mộc/Linh Khoáng, đang được agent
// khác rework thành "aged") CHƯA có cơ chế nào để wire nên KHÔNG render
// placeholder — thêm lại khi cơ chế thật tồn tại thay vì hiện admission
// "đang được thiết kế lại" cho người chơi (2026-08-30, bug report: bỏ
// thông tin nội bộ/dev-facing).
const BUILDING_ID = 'vendor'

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

const template = computed(() => {
  stateVersion.value

  return gameManager.getBuildingDefinitions().find((entry) => entry.id === BUILDING_ID)
})

// =========================
// Card Linh Thạch — Đổi Phẩm (T2, review 2026-08-28): 1 chiều LÊN, 100
// Hạ → 1 Trung, 100 Trung → 1 Thượng. Không có trục "chất" cho Linh Thạch.
// =========================

const haPhamOwned = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
})

const trungPhamOwned = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)
})

const thuongPhamOwned = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID)
})

function convertToTrungPham() {
  gameManager.convertSpiritStonesUp(SPIRIT_STONE_MATERIAL_ID, 1)
  bumpState()
}

function convertToThuongPham() {
  gameManager.convertSpiritStonesUp(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID, 1)
  bumpState()
}

// =========================
// Card Linh Mộc/Linh Khoáng — Đổi Phẩm (cảnh giới): gộp 10 bậc thấp → 1
// bậc cao theo thang Phàm Nhân → Luyện Khí → Trúc Cơ, tách riêng theo
// category material (wood/ore) để mỗi card chỉ thấy đúng loại của mình.
// =========================

interface TierConversionRow {
  fromId: string

  fromName: string

  toName: string

  owned: number
}

function buildTierConversionRows(category: 'wood' | 'ore'): TierConversionRow[] {
  const rows: TierConversionRow[] = []

  for (const stack of gameManager.materialBag.getAll()) {
    if (stack.material.category !== category) {
      continue
    }

    const fromId = stack.material.id

    const toId = getNextTierMaterialId(fromId)

    if (!toId || !gameManager.materialRegistry.has(toId)) {
      continue
    }

    rows.push({
      fromId,

      fromName: stack.material.name,

      toName: gameManager.materialRegistry.get(toId).name,

      owned: gameManager.materialBag.getAmount(fromId),
    })
  }

  return rows
}

const woodTierRows = computed(() => {
  stateVersion.value

  return buildTierConversionRows('wood')
})

const oreTierRows = computed(() => {
  stateVersion.value

  return buildTierConversionRows('ore')
})

function convertTier(fromId: string) {
  gameManager.convertMaterialTier(fromId, 1)

  bumpState()
}

// =========================
// Hóa Bán — bán nguyên liệu thừa lấy Linh Thạch (economy-fixes-sinks-plan
// §3.2 B2, backend đã có sẵn từ trước, chưa từng có UI). Không thuộc 3
// card Phẩm/Chất ở trên — áp dụng cho MỌI category bán được (herb/wood/
// ore/essence/byproduct), nên giữ thành khối riêng bên dưới.
// =========================

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

  gameManager.sellMaterialToVendor(materialId, owned, player.$state)

  bumpState()
}
</script>

<template>
  <section class="vendor-panel scrollfade">
    <p class="vendor-panel__description">{{ template?.description }}</p>

    <div class="vendor-panel__grid">
      <!-- Card 1: Linh Thạch — chỉ 1 trục Phẩm, không có Chất. -->
      <article class="resource-card">
        <div class="resource-card__art" aria-hidden="true"><span>石</span></div>

        <header class="resource-card__header">
          <h3 class="resource-card__name">Linh Thạch</h3>
        </header>

        <div class="resource-card__section">
          <h4>Đổi Phẩm</h4>

          <div class="resource-card__owned">
            <span>{{ SPIRIT_STONE_MATERIAL.name }}: {{ formatNumber(haPhamOwned) }}</span>
            <span>{{ SPIRIT_STONE_TRUNG_PHAM_MATERIAL.name }}: {{ formatNumber(trungPhamOwned) }}</span>
            <span>{{ SPIRIT_STONE_THUONG_PHAM_MATERIAL.name }}: {{ formatNumber(thuongPhamOwned) }}</span>
          </div>

          <div class="resource-card__actions">
            <GameButton size="sm" :disabled="haPhamOwned < SPIRIT_STONE_CONVERSION_RATIO" @click="convertToTrungPham">
              {{ SPIRIT_STONE_CONVERSION_RATIO }} Hạ → 1 Trung
            </GameButton>

            <GameButton size="sm" :disabled="trungPhamOwned < SPIRIT_STONE_CONVERSION_RATIO" @click="convertToThuongPham">
              {{ SPIRIT_STONE_CONVERSION_RATIO }} Trung → 1 Thượng
            </GameButton>
          </div>
        </div>
      </article>

      <!-- Card 2: Linh Mộc — Đổi Phẩm theo cảnh giới. -->
      <article class="resource-card">
        <div class="resource-card__art" aria-hidden="true"><span>木</span></div>

        <header class="resource-card__header">
          <h3 class="resource-card__name">Linh Mộc</h3>
        </header>

        <div class="resource-card__section">
          <h4>Đổi Phẩm <small>(cảnh giới)</small></h4>

          <p v-if="woodTierRows.length === 0" class="resource-card__empty">Chưa có Linh Mộc để đổi phẩm.</p>

          <div v-else class="resource-card__rows">
            <div v-for="row in woodTierRows" :key="row.fromId" class="resource-card__row">
              <span>{{ row.fromName }} <strong>({{ formatNumber(row.owned) }})</strong> → {{ row.toName }}</span>

              <GameButton size="sm" :disabled="row.owned < MATERIAL_TIER_CONVERSION_RATIO" @click="convertTier(row.fromId)">
                {{ MATERIAL_TIER_CONVERSION_RATIO }} → 1
              </GameButton>
            </div>
          </div>
        </div>
      </article>

      <!-- Card 3: Linh Khoáng — cùng cấu trúc Linh Mộc, lọc theo category ore. -->
      <article class="resource-card">
        <div class="resource-card__art" aria-hidden="true"><span>礦</span></div>

        <header class="resource-card__header">
          <h3 class="resource-card__name">Linh Khoáng</h3>
        </header>

        <div class="resource-card__section">
          <h4>Đổi Phẩm <small>(cảnh giới)</small></h4>

          <p v-if="oreTierRows.length === 0" class="resource-card__empty">Chưa có Linh Khoáng để đổi phẩm.</p>

          <div v-else class="resource-card__rows">
            <div v-for="row in oreTierRows" :key="row.fromId" class="resource-card__row">
              <span>{{ row.fromName }} <strong>({{ formatNumber(row.owned) }})</strong> → {{ row.toName }}</span>

              <GameButton size="sm" :disabled="row.owned < MATERIAL_TIER_CONVERSION_RATIO" @click="convertTier(row.fromId)">
                {{ MATERIAL_TIER_CONVERSION_RATIO }} → 1
              </GameButton>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div class="vendor-panel__card">
      <h3>Hóa Bán</h3>

      <small class="resource-card__rate">Bán nguyên liệu dư thừa lấy Linh Thạch theo phẩm hiện hành.</small>

      <div v-if="sellableRows.length" class="resource-card__rows">
        <div v-for="row in sellableRows" :key="row.materialId" class="resource-card__row">
          <span>
            {{ row.name }} <strong>({{ formatNumber(row.owned) }})</strong>
            — {{ formatNumber(row.unitPrice) }} hạ/đơn vị
          </span>

          <GameButton size="sm" @click="sellAll(row.materialId, row.owned)">
            Bán hết
          </GameButton>
        </div>
      </div>

      <p v-else class="resource-card__empty">Không có nguyên liệu nào bán được lúc này.</p>
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

/* 3 card NGANG HÀNG, kích thước đều — cùng pattern grid với
   ProductionPanel's .production-panel__grid (2026-08-30 spec). */
.vendor-panel__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

@container overlay-panel (max-width: 760px) {
  .vendor-panel__grid { grid-template-columns: 1fr; }
}

.resource-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: linear-gradient(145deg, color-mix(in srgb, var(--mineral-gold) 10%, var(--paper-50)), color-mix(in srgb, var(--mineral-gold) 4%, var(--paper-100)));
  border: 1px solid color-mix(in srgb, var(--mineral-gold) 32%, var(--paper-line));
  border-radius: var(--radius-md);
}

.resource-card__art {
  position: relative;
  min-height: 72px;
  display: grid;
  place-items: center;
  overflow: hidden;
  margin: -12px -12px 2px;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  background:
    radial-gradient(circle, color-mix(in srgb, var(--mineral-gold) 25%, transparent), transparent 48%),
    linear-gradient(130deg, var(--ink-800), var(--ink-900));
}

.resource-card__art span {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  color: color-mix(in srgb, var(--mineral-gold) 40%, var(--text-primary));
  font: 700 var(--text-title) var(--font-display);
  border: 1px solid color-mix(in srgb, var(--mineral-gold) 38%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--ink-900) 58%, transparent);
}

.resource-card__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.resource-card__name {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--mineral-gold);
}

/* Đổi Phẩm/Đổi Chất — 2 phần TÁCH BIỆT trong CÙNG 1 card (2026-08-30
   spec), phân cách bằng đường kẻ nhạt thay vì card lồng card. */
.resource-card__section {
  display: grid;
  gap: 6px;
}

.resource-card__section + .resource-card__section {
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--mineral-gold) 25%, var(--paper-line));
}

.resource-card__section h4 {
  margin: 0;
  color: var(--paper-text);
  font-size: var(--text-sm);
  font-weight: 700;
}

.resource-card__section h4 small {
  font-weight: 400;
  color: var(--paper-text-soft);
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

.resource-card__owned {
  display: grid;
  gap: 3px;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

.resource-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
