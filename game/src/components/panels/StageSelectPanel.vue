<script setup lang="ts">
// Thám Hiểm (2026-08-14) — màn hình chọn màn trước khi chiến đấu, thay
// nút "Chiến Đấu" trực tiếp cũ. 3 lựa chọn theo đúng thứ tự người
// dùng mô tả: Địa Giới (map lớn) → Màn (trong Địa Giới đó) → chế độ
// (Lặp Lại Khiêu Chiến / Tự Động Thám Hiểm) → Bắt Đầu.
import { computed, ref, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore, type BattleRunMode } from '@/stores/ui'
import { useGameManager } from '@/composables/useGameState'
import { useBattleActions } from '@/composables/useBattleActions'
import BuildingConstructionGate from './BuildingConstructionGate.vue'

const player = usePlayerStore()
const ui = useUiStore()
const gameManager = useGameManager()
const { startSelectedStage } = useBattleActions()

// Combat UI Redesign mục 4/15 — Chọn Ải là nơi DUY NHẤT cấu hình Auto
// Battle TRƯỚC trận (Combat Scene giờ chiếm toàn màn hình, không còn
// BottomBar/BattleControls hiện ĐƯỢC nữa trong lúc combat để bật/tắt
// giữa chừng) và shortcut để chỉnh Build — KHÔNG dựng Build UI riêng,
// chỉ deep-link. Trước trỏ vào tab Tâm Pháp của LoadoutManager.vue (đã
// xoá); giờ mở thẳng SkillPathPanel.vue (2026-08-20) — quyết định build
// THẬT SỰ (chọn skill/node) nằm ở đó, Tâm Pháp giờ chỉ đọc, không còn
// gì để "chỉnh".
function openBuild() {
  ui.standalonePanel = 'skill'
}

const zones = computed(() => gameManager.zoneRegistry.getAll())

function isZoneUnlocked(zoneId: string): boolean {
  const zone = zones.value.find(candidate => candidate.id === zoneId)
  const firstStageId = zone?.stageIds[0]
  return Boolean(firstStageId && gameManager.isStageUnlocked(firstStageId, player.$state))
}

// Luyện Khí tầng 1-10 content pass — gate MỊN hơn isZoneUnlocked (chỉ
// đại-cảnh-giới): requiredRealmLevel CHỈ được xét khi player ĐANG ở
// đúng requiredRealmId của Stage đó — nếu player đã vượt hẳn qua đại
// cảnh giới này (vd đã lên Trúc Cơ), tầng gate coi như hết ý nghĩa,
// Stage mở tự do để farm lại.
function isStageUnlocked(stage: (typeof stagesInZone.value)[number]): boolean {
  return gameManager.isStageUnlocked(stage.id, player.$state)
}

const selectedZoneId = ref<string | null>(zones.value[0]?.id ?? null)

const selectedZone = computed(() =>
  zones.value.find(zone => zone.id === selectedZoneId.value) ?? null,
)

const stagesInZone = computed(() => {
  if (!selectedZone.value) {
    return []
  }

  return selectedZone.value.stageIds
    .map(stageId => gameManager.getStage(stageId))
    .filter((stage): stage is NonNullable<typeof stage> => stage !== undefined)
})

const selectedStageId = ref<string | null>(null)

// Đổi Địa Giới thì bỏ chọn Màn cũ (Màn thuộc Địa Giới trước, không còn
// hợp lệ ở Địa Giới mới).
watch(selectedZoneId, () => {
  selectedStageId.value = null
})

const selectedStage = computed(() =>
  stagesInZone.value.find(stage => stage.id === selectedStageId.value) ?? null,
)

// UI redesign Step 19 (Thám Hiểm, spec mục 22 — "Không làm stage list.
// Dùng world map.") — cột "Màn" cũ đúng là 1 list nút xếp dọc, tên gọi
// của chính bug spec cấm. Stage trong 1 Zone vốn đã TUYẾN TÍNH (Tầng
// 1→10, xem requiredRealmLevel/Tầng Content Pass) — đủ để vẽ 1 world
// map thu nhỏ kiểu "đường mòn ngoằn ngoèo" (node trái/phải xen kẽ, nối
// bằng đường thẳng) thay vì bịa 1 bản đồ toạ độ tự do không có dữ liệu
// backing. Toạ độ y = px thật (chiều cao node cố định), x = đơn vị
// 0-100 kiểu % (khớp SVG viewBox + preserveAspectRatio="none" bên
// dưới, tự giãn theo chiều rộng cột thật).
const STAGE_NODE_SIZE = 46
const STAGE_ROW_SPACING = 58

const stageNodes = computed(() => stagesInZone.value.map((stage, index) => ({
  stage,
  xPercent: index % 2 === 0 ? 28 : 72,
  y: index * STAGE_ROW_SPACING + STAGE_NODE_SIZE / 2,
  isLast: index === stagesInZone.value.length - 1,
})))

const stagePathHeight = computed(() =>
  Math.max(STAGE_NODE_SIZE, stagesInZone.value.length * STAGE_ROW_SPACING),
)

const stagePathPoints = computed(() =>
  stageNodes.value.map(node => `${node.xPercent},${node.y}`).join(' '),
)

const mode = ref<BattleRunMode>('manual')

const canStart = computed(() => {
  if (!selectedZone.value || !selectedStage.value) {
    return false
  }

  return isZoneUnlocked(selectedZone.value.id) && isStageUnlocked(selectedStage.value)
})

function selectZone(zoneId: string) {
  selectedZoneId.value = zoneId
}

function selectStage(stageId: string) {
  selectedStageId.value = stageId
}

function start() {
  if (!selectedZone.value || !selectedStage.value || !canStart.value) {
    return
  }

  startSelectedStage(selectedZone.value.id, selectedStage.value, mode.value)
}
</script>

<template>
  <BuildingConstructionGate building-id="teleport_array">
  <div class="stage-select">
    <div class="stage-select__column">
      <h4 class="stage-select__title">Địa Giới</h4>

      <button
        v-for="zone in zones"
        :key="zone.id"
        type="button"
        class="stage-select__item"
        :class="{ 'is-selected': zone.id === selectedZoneId, 'is-locked': !isZoneUnlocked(zone.id) }"
        @click="selectZone(zone.id)"
      >
        {{ zone.name }}
        <span v-if="!isZoneUnlocked(zone.id)" class="stage-select__lock">
          (Cần hoàn thành địa giới trước)
        </span>
      </button>
    </div>

    <div class="stage-select__column stage-select__column--map">
      <h4 class="stage-select__title">Màn</h4>

      <p v-if="stagesInZone.length === 0" class="stage-select__empty">Chọn 1 Địa Giới bên trái.</p>

      <div v-else class="stage-map" :style="{ height: `${stagePathHeight}px` }">
        <svg class="stage-map__lines" :viewBox="`0 0 100 ${stagePathHeight}`" preserveAspectRatio="none">
          <polyline :points="stagePathPoints" fill="none" stroke="var(--ink-line)" stroke-width="1.5" />
        </svg>

        <button
          v-for="node in stageNodes"
          :key="node.stage.id"
          type="button"
          class="stage-map__node"
          :class="{
            'is-selected': node.stage.id === selectedStageId,
            'is-locked': !isStageUnlocked(node.stage),
            'is-final': node.isLast,
          }"
          :style="{ left: `${node.xPercent}%`, top: `${node.y}px` }"
          v-tooltip="node.stage.description"
          @click="selectStage(node.stage.id)"
        >
          {{ node.stage.chapter ?? 1 }}.{{ node.stage.floor ?? node.stage.requiredRealmLevel ?? 1 }}
        </button>
      </div>
    </div>

    <div class="stage-select__column stage-select__column--detail">
      <template v-if="selectedStage">
        <h4 class="stage-select__title">{{ selectedStage.name }}</h4>
        <p class="stage-select__description">{{ selectedStage.description }}</p>
        <p class="stage-select__meta">{{ selectedStage.totalEnemyCount }} quái</p>

        <div class="stage-select__mode">
          <button type="button" :class="{ 'is-active': mode === 'manual' }" @click="mode = 'manual'">
            Thủ Công
          </button>
          <button type="button" :class="{ 'is-active': mode === 'repeat' }" @click="mode = 'repeat'">
            Lặp Lại
          </button>
          <button type="button" :class="{ 'is-active': mode === 'progress' }" @click="mode = 'progress'">
            Tự Động Tiến Ải
          </button>
        </div>

        <p class="stage-select__mode-hint">
          {{ mode === 'manual' ? 'Kết thúc trận và chờ bạn quyết định.' : mode === 'repeat' ? 'Tự đánh lại đúng tầng hiện tại.' : 'Thắng thì đi tiếp, thua thì dừng.' }}
        </p>

        <div class="stage-select__start-row">
          <button type="button" class="stage-select__build" @click="openBuild">⚔ Build</button>

          <button type="button" class="stage-select__start" :disabled="!canStart" @click="start">
            Bắt Đầu
          </button>
        </div>
      </template>

      <p v-else class="stage-select__empty">Chọn 1 Màn ở giữa.</p>
    </div>
  </div>
  </BuildingConstructionGate>
</template>

<style scoped>
.stage-select {
  display: flex;
  height: 100%;
  min-height: 0;
  font-family: var(--font-body);
  color: var(--text-primary);
}

.stage-select__column {
  flex: 1 1 0;
  min-width: 0;
  padding: 10px;
  overflow-y: auto;
  border-right: 1px solid var(--ink-line-soft);
}

.stage-select__column--detail {
  border-right: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stage-select__title {
  margin: 0 0 8px;
  font-family: var(--font-display);
  color: var(--gold-500);
  font-size: 0.85rem;
}

.stage-select__item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px;
  margin-bottom: 4px;
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.75rem;
}

.stage-select__item.is-selected {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.stage-select__item.is-locked {
  opacity: 0.55;
}

.stage-select__lock {
  display: block;
  font-size: 0.65rem;
  color: var(--text-muted);
}

.stage-select__empty {
  color: var(--text-muted);
  font-size: 0.75rem;
}

/* World map thu nhỏ (spec mục 22) — đường mòn ngoằn ngoèo, xem
   stageNodes/stagePathPoints. */
.stage-map {
  position: relative;
  width: 100%;
}

.stage-map__lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.stage-map__node {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--ink-800);
  border: 2px solid var(--ink-line-soft);
  color: var(--text-primary);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stage-map__node:hover {
  border-color: var(--gold-500);
}

.stage-map__node.is-selected {
  border-color: var(--gold-500);
  background: color-mix(in srgb, var(--gold-500) 22%, var(--ink-800));
  box-shadow: 0 0 10px -2px var(--gold-500);
}

.stage-map__node.is-locked {
  opacity: 0.45;
  cursor: not-allowed;
}

.stage-map__node.is-final:not(.is-selected) {
  border-color: var(--crimson);
}

.stage-select__description,
.stage-select__meta {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.stage-select__mode {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.stage-select__mode button {
  padding: 6px;
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.72rem;
}

.stage-select__mode button.is-active {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.stage-select__mode-hint {
  margin: 0;
  font-size: 0.65rem;
  color: var(--text-muted);
}

.stage-select__auto {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.stage-select__start-row {
  margin-top: auto;
  display: flex;
  gap: 8px;
}

.stage-select__build {
  padding: 8px 10px;
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
}

.stage-select__build:hover {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.stage-select__start {
  flex: 1;
  padding: 8px;
  background: var(--gold-500);
  color: var(--gold-ink);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
}

.stage-select__start:disabled {
  background: var(--ink-700);
  color: var(--text-muted);
  cursor: not-allowed;
}
</style>
