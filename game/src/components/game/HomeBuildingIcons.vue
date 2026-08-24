<script setup lang="ts">
// UI redesign (spec "TIÊN HIỆP IDLE — FINAL UI/UX IMPLEMENTATION PLAN"
// mục 8) — thay hình học placeholder (chấm tròn dọc viền trên) bằng
// world object thật: mỗi Building là 1 công trình silhouette đặt ở vị
// trí CỐ ĐỊNH khớp bố cục Động Phủ (Tàng Kinh Các phía sau, Đan Phòng/
// Phù Viện trên 2 góc, Khí Đường/Trận Đài dưới 2 góc, Truyền Tống Trận
// là cổng tiền cảnh — xem BUILDING_POSITIONS). Building KHÔNG nằm
// trong BUILDING_POSITIONS (herb_garden/linh_tuyen/smelter/
// thien_cong_phuong/gathering_outpost — Building phụ, không thuộc 5
// công trình trung tâm bản thiết kế) rơi vào SECONDARY_POSITIONS, vẽ
// nhỏ hơn, rải quanh rìa cảnh — vẫn LÀ world object thật (click được y
// hệt), không xoá chức năng nào, chỉ thu nhỏ tầm quan trọng thị giác.
//
// TOÀN BỘ logic xây/nâng cấp/thu hoạch/mở panel (isBuilt/buildingLevel/
// clickIcon/BuildingDetailPopover) giữ NGUYÊN 100% — chỉ đổi cách vẽ.
import { computed, ref } from 'vue'
import { useUiStore, type LeftPanelMode } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useStageActive } from '@/composables/useStageActive'
import type { BuildingTooltipContent } from '@/composables/useTooltip'
import BuildingDetailPopover from './BuildingDetailPopover.vue'

const ui = useUiStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const stageActive = useStageActive()

const buildings = computed(() => gameManager.getBuildingDefinitions())

function isBuilt(buildingId: string): boolean {
  stateVersion.value

  return gameManager.buildingManager.getByBuildingId(buildingId) !== undefined
}

function buildingLevel(buildingId: string): number | null {
  stateVersion.value

  return gameManager.buildingManager.getByBuildingId(buildingId)?.level ?? null
}

// WS5 (2026-08-24) — trạng thái trực quan KHÔNG phụ thuộc tooltip:
// built (đã xây) / unbuilt (chưa xây) / upgradeable (đã xây, chưa max).
function isUpgradeable(buildingId: string): boolean {
  const definition = gameManager.getBuildingDefinitions().find(entry => entry.id === buildingId)

  if (!definition) {
    return false
  }

  return isBuilt(buildingId) && (buildingLevel(buildingId) ?? 0) < definition.maxLevel
}

interface BuildingSpot {
  left: number
  top: number
  accent: string
  isGate?: boolean
}

// 5 công trình trung tâm bản thiết kế (Đan Phòng/Phù Viện/Khí Đường/
// Trận Đài/Truyền Tống Trận=Cổng Thám Hiểm) — vị trí % thuần trên
// .game-root__scene, khớp đúng bố cục "Rear/Upper-left/Upper-right/
// Lower-left/Lower-right/Foreground" của bản thiết kế.
const BUILDING_POSITIONS: Record<string, BuildingSpot> = {
  pill_room: { left: 20, top: 32, accent: 'var(--el-fire)' },
  talisman_institute: { left: 80, top: 32, accent: 'var(--azure)' },
  equipment_hall: { left: 16, top: 54, accent: 'var(--crimson)' },
  formation_altar: { left: 84, top: 54, accent: 'var(--el-primordial)' },
  teleport_array: { left: 50, top: 86, accent: 'var(--gold-500)', isGate: true },
}

// Building phụ (resource/processing, không thuộc 5 công trình trung
// tâm) — rải quanh rìa, nhỏ hơn hẳn. Building mới thêm sau này (không
// có trong danh sách) rơi về fallback bên dưới, không biến mất khỏi
// scene.
const SECONDARY_POSITIONS: Record<string, BuildingSpot> = {
  herb_garden: { left: 6, top: 44, accent: 'var(--jade)' },
  spirit_spring: { left: 94, top: 44, accent: 'var(--azure)' },
  smelter: { left: 8, top: 68, accent: 'var(--crimson)' },
  artisan_workshop: { left: 92, top: 68, accent: 'var(--jade)' },
  gathering_outpost: { left: 30, top: 14, accent: 'var(--text-muted)' },
}

function spotFor(buildingId: string, index: number, total: number): BuildingSpot & { tier: 'featured' | 'secondary' } {
  const featured = BUILDING_POSITIONS[buildingId]

  if (featured) {
    return { ...featured, tier: 'featured' }
  }

  const secondary = SECONDARY_POSITIONS[buildingId]

  if (secondary) {
    return { ...secondary, tier: 'secondary' }
  }

  // Fallback — Building mới chưa gán vị trí thiết kế, rải đều dọc rìa
  // trên thay vì mất tích khỏi scene (giữ hành vi an toàn của bản cũ).
  const left = total <= 1 ? 50 : 10 + (index / (total - 1)) * 80

  return { left, top: 10, accent: 'var(--text-muted)', tier: 'secondary' }
}

function tooltipFor(building: (typeof buildings.value)[number]): BuildingTooltipContent {
  const built = isBuilt(building.id)
  const level = buildingLevel(building.id)

  return {
    kind: 'building',

    name: building.name,

    functionLabel: building.description,

    statusLabel: built ? `Đã xây · Cấp ${level}/${building.maxLevel}` : 'Chưa xây',
  }
}

const popoverBuildingId = ref<string | null>(null)

function clickIcon(building: (typeof buildings.value)[number]) {
  if (isBuilt(building.id) && building.functionType) {
    ui.leftPanelMode = building.functionType as LeftPanelMode

    return
  }

  popoverBuildingId.value = building.id
}

// Tàng Kinh Các — KHÔNG phải Building thật (không có entry trong
// data/building/buildings.ts, luôn mở tự do qua NavMenuOverlay từ
// trước tới nay, xem stores/ui.ts's ghi chú scripture_pavilion) —
// world object TĨNH, không isBuilt/level, chỉ để có mặt trong scene
// đúng bố cục bản thiết kế (Rear). Click thẳng leftPanelMode, không
// qua BuildingDetailPopover (không có gì để xây/nâng cấp).
const SCRIPTURE_PAVILION_TOOLTIP: BuildingTooltipContent = {
  kind: 'building',

  name: 'Tàng Kinh Các',

  functionLabel: 'Tâm Pháp · Kỹ Năng · Tri Thức',

  statusLabel: 'Luôn mở',
}

function openScripturePavilion() {
  ui.leftPanelMode = 'scripture_pavilion'
}
</script>

<template>
  <div v-if="!stageActive" class="home-buildings">
    <button
      type="button"
      class="home-building home-building--tkc"
      style="left: 50%; top: 18%; --accent: var(--gold-500);"
      v-tooltip="SCRIPTURE_PAVILION_TOOLTIP"
      @click="openScripturePavilion"
    >
      <span class="home-building__glow" />
      <span class="home-building__roof home-building__roof--upper" />
      <span class="home-building__roof" />
      <span class="home-building__body">
        <span class="home-building__door" />
      </span>
      <span class="home-building__shadow" />
      <!-- WS5 — nameplate luôn hiển thị, khỏi phụ thuộc tooltip. -->
      <span class="home-building__name">Tàng Kinh Các</span>
    </button>

    <template v-for="(building, index) in buildings" :key="building.id">
      <button
        v-if="!spotFor(building.id, index, buildings.length).isGate"
        type="button"
        class="home-building"
        :class="[
          `home-building--${spotFor(building.id, index, buildings.length).tier}`,
          {
            'is-built': isBuilt(building.id),
            'is-upgradeable': isUpgradeable(building.id),
          },
        ]"
        :style="{
          left: `${spotFor(building.id, index, buildings.length).left}%`,
          top: `${spotFor(building.id, index, buildings.length).top}%`,
          '--accent': spotFor(building.id, index, buildings.length).accent,
        }"
        v-tooltip="tooltipFor(building)"
        @click="clickIcon(building)"
      >
        <span class="home-building__glow" />
        <span class="home-building__roof" />
        <span class="home-building__body">
          <span class="home-building__door" />
          <!-- WS5 — badge cấp độ khi đã xây; chấm vàng nhấp nháy khi còn
               nâng cấp được (không cần hover/tooltip để nhận biết). -->
          <span v-if="isBuilt(building.id)" class="home-building__level">
            {{ buildingLevel(building.id) }}
            <i v-if="isUpgradeable(building.id)" class="home-building__level-dot" />
          </span>
        </span>
        <span class="home-building__shadow" />
        <span class="home-building__name">{{ building.name }}</span>
      </button>

      <button
        v-else
        type="button"
        class="home-gate"
        :class="{ 'is-built': isBuilt(building.id) }"
        :style="{
          left: `${spotFor(building.id, index, buildings.length).left}%`,
          top: `${spotFor(building.id, index, buildings.length).top}%`,
        }"
        v-tooltip="tooltipFor(building)"
        @click="clickIcon(building)"
      >
        <span class="home-gate__glow" />
        <span class="home-gate__path" />
        <span class="home-gate__pillar home-gate__pillar--l" />
        <span class="home-gate__pillar home-gate__pillar--r" />
        <span class="home-gate__lintel" />
        <span class="home-gate__portal" />
        <span class="home-building__name home-gate__name">{{ building.name }}</span>
      </button>
    </template>
  </div>

  <BuildingDetailPopover
    v-if="popoverBuildingId"
    :building-id="popoverBuildingId"
    @close="popoverBuildingId = null"
  />
</template>

<style scoped>
.home-buildings {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

/* ================= Pavilion (Đan Phòng/Phù Viện/Khí Đường/Trận Đài/
   Tàng Kinh Các/công trình phụ) ================= */
.home-building {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
  background: none;
  border: none;
  cursor: pointer;
}

.home-building__glow {
  position: absolute;
  inset: -30px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent), transparent 68%);
  opacity: 0.16;
  filter: blur(4px);
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.home-building:hover .home-building__glow {
  opacity: 0.42;
}

.home-building__roof {
  width: 84px;
  height: 24px;
  background: linear-gradient(180deg, #362c24, #1a1510);
  clip-path: polygon(50% 0%, 92% 56%, 100% 80%, 83% 62%, 17% 62%, 0% 80%, 8% 56%);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
  transition: filter 0.3s ease;
}

.home-building:hover .home-building__roof {
  filter: drop-shadow(0 0 8px var(--accent)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}

.home-building__roof--upper {
  width: 58px;
  height: 18px;
  margin-bottom: -8px;
}

.home-building__body {
  width: 66px;
  height: 36px;
  background: linear-gradient(180deg, #262019, #16130f);
  border: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.home-building:hover .home-building__body {
  border-color: var(--accent);
  box-shadow: 0 0 14px -2px var(--accent);
}

.home-building.is-built .home-building__body {
  border-color: rgba(255, 255, 255, 0.12);
}

.home-building__door {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 20px;
  border-radius: 2px 2px 0 0;
  background: radial-gradient(circle at 50% 30%, var(--accent), transparent 75%);
  opacity: 0.55;
  transition: opacity 0.3s ease;
}

.home-building.is-built .home-building__door {
  opacity: 0.9;
}

.home-building__shadow {
  width: 66px;
  height: 10px;
  margin-top: -3px;
  background: radial-gradient(ellipse, rgba(0, 0, 0, 0.55), transparent 72%);
}

/* WS5 — nameplate ngắn luôn hiển thị dưới công trình: nhận diện chức
   năng ngay khi nhìn scene, không phụ thuộc tooltip. */
.home-building__name {
  margin-top: var(--space-1);
  padding: 1px var(--space-2);
  border-radius: 999px;
  background: rgba(10, 10, 13, 0.72);
  border: 1px solid var(--ink-line);
  color: var(--text-secondary);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  line-height: var(--lh-tight);
  white-space: nowrap;
  pointer-events: none;
}

.home-building.is-built .home-building__name {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--ink-line));
}

/* Chưa xây — silhouette mờ + viền đứt gợi "available". */
.home-building:not(.is-built) .home-building__body {
  border-style: dashed;
}

.home-building:not(.is-built) .home-building__name {
  color: var(--text-muted);
}

/* Còn nâng cấp — badge cấp kèm chấm vàng nhấp nháy. */
.home-building__level {
  position: absolute;
  top: -9px;
  right: -10px;
  min-width: 20px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--ink-950);
  border: 1px solid var(--accent);
  color: var(--gold-300);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.home-building__level-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--gold-500);
  animation: home-level-dot-pulse 1.6s ease-in-out infinite;
}

@keyframes home-level-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.75); }
}

/* Tier — công trình trung tâm to hơn hẳn công trình phụ (rải rìa).
   WS5 — công trình phụ bump lên tối thiểu ~64px hiển thị (body 56×30
   + roof), không còn nhỏ hơn icon navigation. */
.home-building--featured .home-building__roof {
  width: 108px;
  height: 30px;
}

.home-building--featured .home-building__body {
  width: 84px;
  height: 46px;
}

.home-building--featured .home-building__door {
  width: 20px;
  height: 26px;
}

.home-building--featured .home-building__shadow {
  width: 84px;
}

.home-building--secondary {
  opacity: 0.85;
}

.home-building--secondary .home-building__roof {
  width: 64px;
  height: 18px;
}

.home-building--secondary .home-building__body {
  width: 56px;
  height: 30px;
}

.home-building--secondary .home-building__shadow {
  width: 56px;
}

.home-building--tkc .home-building__roof {
  width: 130px;
  height: 34px;
}

.home-building--tkc .home-building__body {
  width: 100px;
  height: 54px;
}

.home-building--tkc .home-building__door {
  width: 22px;
  height: 30px;
}

.home-building--tkc .home-building__shadow {
  width: 100px;
}

/* ================= Cổng Thám Hiểm (Truyền Tống Trận) — KHÔNG phải
   pavilion, đường/cổng dẫn ra thế giới. ================= */
.home-gate {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 180px;
  height: 90px;
  pointer-events: auto;
  background: none;
  border: none;
  cursor: pointer;
}

.home-gate__glow {
  position: absolute;
  inset: -30px;
  z-index: -1;
  background: radial-gradient(ellipse 140px 80px at 50% 50%, rgba(255, 213, 79, 0.12), transparent 70%);
  filter: blur(4px);
  opacity: 0.7;
  transition: opacity 0.3s ease;
}

.home-gate:hover .home-gate__glow {
  opacity: 1;
}

.home-gate__path {
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 220px;
  height: 70px;
  clip-path: polygon(38% 0%, 62% 0%, 100% 100%, 0% 100%);
  background: linear-gradient(180deg, rgba(66, 165, 245, 0.04), rgba(120, 120, 130, 0.1));
}

.home-gate__pillar {
  position: absolute;
  bottom: 8px;
  width: 14px;
  height: 74px;
  background: linear-gradient(180deg, #2a2620, #131110);
  border-radius: 2px;
}

.home-gate__pillar--l {
  left: 30px;
}

.home-gate__pillar--r {
  right: 30px;
}

.home-gate__lintel {
  position: absolute;
  top: 2px;
  left: 24px;
  right: 24px;
  height: 10px;
  background: linear-gradient(180deg, #332c22, #171310);
  border-radius: 2px;
}

.home-gate__portal {
  position: absolute;
  top: 12px;
  left: 44px;
  right: 44px;
  bottom: 8px;
  background: radial-gradient(ellipse at 50% 40%, rgba(255, 224, 130, 0.3), rgba(91, 155, 213, 0.14) 55%, rgba(10, 10, 13, 0.4) 90%);
  transition: box-shadow 0.3s ease;
}

.home-gate:hover .home-gate__portal {
  box-shadow: 0 0 24px rgba(255, 213, 79, 0.25) inset;
}

.home-gate.is-built .home-gate__portal {
  box-shadow: 0 0 14px rgba(255, 213, 79, 0.15) inset;
}

/* WS5 — nameplate cổng Thám Hiểm. */
.home-gate__name {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 0;
}
</style>
