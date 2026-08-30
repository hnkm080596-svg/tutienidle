<script setup lang="ts">
// Hotspot layer của Động Phủ (plan Workstream C) — MỘT trong HAI entry
// point của building thật (entry kia là shortcut ring 3 command wheel).
// Logic điều hướng KHÔNG còn ở đây nữa: cả hai entry đi qua
// composables/useBuildingNavigation.ts và popover dùng chung ở GameRoot
// (ui.activeBuildingPopoverId).
//
// Tàng Kinh Các KHÔNG còn là hotspot/pseudo-building (plan) — entry duy
// nhất của nó là shortcut vòng ngoài command wheel.
import { computed } from 'vue'
import { useGameManager } from '@/composables/useGameState'
import { useStageActive } from '@/composables/useStageActive'
import { useBuildingNavigation } from '@/composables/useBuildingNavigation'
import type { BuildingTooltipContent } from '@/composables/useTooltip'

const gameManager = useGameManager()

const stageActive = useStageActive()

const navigation = useBuildingNavigation()

const buildings = computed(() => gameManager.getBuildingDefinitions())

type HotspotEffect = 'alchemy' | 'forge' | 'portal' | 'spring' | 'gather'

interface BuildingHotspot {
  /** Tọa độ tâm theo % của ART (ảnh nền 1672×941, cover-fit). Tăng left = sang phải; tăng top = đi xuống. */
  left: number
  top: number
  /** Kích thước hitbox theo % của art, độc lập với hình nền. */
  width: number
  height: number
  accent: string
  effect: HotspotEffect
}

// Điểm duy nhất cần chỉnh khi căn hotspot với background Động Phủ.
// Background sở hữu toàn bộ kiến trúc; các entry dưới đây chỉ là vùng tương tác.
const BUILDING_HOTSPOTS: Record<string, BuildingHotspot> = {
  pill_room: { left: 16, top: 25, width: 15, height: 25, accent: 'var(--el-fire)', effect: 'alchemy' },
  equipment_hall: { left: 10, top: 48, width: 15, height: 25, accent: 'var(--crimson)', effect: 'forge' },
  teleport_array: { left: 50, top: 15, width: 15, height: 25, accent: 'var(--chrome-500)', effect: 'portal' },
  spirit_spring: { left: 87, top: 40, width: 25, height: 35, accent: 'var(--azure)', effect: 'spring' },
  gathering_outpost: { left: 25, top: 13, width: 15, height: 25, accent: 'var(--text-muted)', effect: 'gather' },
}

function hotspotFor(buildingId: string, index: number, total: number): BuildingHotspot {
  const configured = BUILDING_HOTSPOTS[buildingId]

  if (configured) return configured

  return {
    left: total <= 1 ? 50 : 10 + (index / (total - 1)) * 80,
    top: 10,
    width: 12,
    height: 15,
    accent: 'var(--text-muted)',
    effect: 'gather',
  }
}

function hotspotStyle(hotspot: BuildingHotspot) {
  return {
    left: `${hotspot.left}%`,
    top: `${hotspot.top}%`,
    width: `${hotspot.width}%`,
    height: `${hotspot.height}%`,
    '--accent': hotspot.accent,
  }
}

function presentationFor(buildingId: string) {
  return navigation.getBuildingPresentation(buildingId)
}

// Badge trạng thái nameplate (plan ui-discoverability §3.1) — suy ra từ
// useBuildingNavigation.getBuildingStatus() (đọc thuần BuildingSystem/
// AlchemySystem qua GameManager, không state song song).
function statusFor(buildingId: string) {
  return navigation.getBuildingStatus(buildingId)
}

function tooltipFor(building: (typeof buildings.value)[number]): BuildingTooltipContent {
  const presentation = presentationFor(building.id)

  return {
    kind: 'building',
    name: building.name,
    functionLabel: building.description,
    statusLabel: presentation.isBuilt
      ? `Đã mở · Cấp ${presentation.level}/${building.maxLevel}`
      : 'Chưa mở · Nhấn để xem yêu cầu',
  }
}
</script>

<template>
  <div v-if="!stageActive" class="home-building-hotspots">
    <!-- Art-space: box đúng bằng hình chữ nhật cover của ảnh nền 1672×941
         (aspect-ratio + min-width/min-height 100% = object-fit:cover geometry)
         để hotspot neo theo art, không trôi khỏi building khi viewport
         khác 16:9. -->
    <div class="home-building-hotspots__art-space">
      <div
        v-for="(building, index) in buildings"
        :key="building.id"
        class="building-hotspot-anchor"
        :style="hotspotStyle(hotspotFor(building.id, index, buildings.length))"
        :data-building-id="building.id"
      >
        <button
          type="button"
          class="building-hotspot"
          :class="[
            `building-hotspot--${hotspotFor(building.id, index, buildings.length).effect}`,
            {
              'is-built': presentationFor(building.id).isBuilt,
              'is-upgradeable': presentationFor(building.id).isUpgradeable,
            },
          ]"
          :aria-label="presentationFor(building.id).isBuilt ? `Mở ${building.name}` : `Xem yêu cầu mở ${building.name}`"
          v-tooltip="tooltipFor(building)"
          @click="navigation.openBuilding(building.id)"
        >
          <span class="building-hotspot__outline" />
          <span class="building-hotspot__vfx" aria-hidden="true"><i /><i /><i /></span>
          <span class="building-hotspot__hover-label">
            {{ building.name }}
            <small>{{ presentationFor(building.id).isBuilt ? `Cấp ${presentationFor(building.id).level}` : 'Chưa mở' }}</small>
          </span>
        </button>

        <span
          class="building-nameplate"
          :class="`building-nameplate--${statusFor(building.id)}`"
          aria-hidden="true"
        >
          <span
            v-if="statusFor(building.id) === 'locked'"
            class="building-nameplate__lock"
          />
          <span v-else-if="statusFor(building.id) === 'ready'" class="building-nameplate__ready" />
          <span v-else-if="statusFor(building.id) === 'active'" class="building-nameplate__active" />
          <span v-else-if="statusFor(building.id) === 'upgradeable'" class="building-nameplate__upgradeable" />
          <span class="building-nameplate__text">{{ building.name }}</span>
        </span>

      </div>
    </div>
  </div>
</template>

<style scoped>
.home-building-hotspots {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.home-building-hotspots__art-space {
  position: relative;
  aspect-ratio: 1672 / 941;
  min-width: 100%;
  min-height: 100%;
  pointer-events: none;
}

.building-hotspot-anchor {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: auto;
}

.building-hotspot {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 46%;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
}

.building-hotspot__outline {
  position: absolute;
  inset: 5%;
  border: 1px solid color-mix(in srgb, var(--accent) 76%, transparent);
  border-radius: inherit;
  background: radial-gradient(ellipse, color-mix(in srgb, var(--accent) 13%, transparent), transparent 70%);
  box-shadow: inset 0 0 18px color-mix(in srgb, var(--accent) 16%, transparent), 0 0 16px color-mix(in srgb, var(--accent) 22%, transparent);
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 150ms ease, transform 180ms ease;
}

.building-hotspot__vfx {
  position: absolute;
  inset: 8%;
  opacity: 0;
  transform: scale(0.88);
  transition: opacity 150ms ease, transform 180ms ease;
  pointer-events: none;
}

.building-hotspot:hover .building-hotspot__outline,
.building-hotspot:focus-visible .building-hotspot__outline,
.building-hotspot:hover .building-hotspot__vfx,
.building-hotspot:focus-visible .building-hotspot__vfx {
  opacity: 1;
  transform: scale(1);
}

.building-hotspot:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.building-hotspot__vfx i {
  position: absolute;
  display: block;
  pointer-events: none;
}

.building-hotspot--portal .building-hotspot__vfx i {
  inset: 10%;
  border: 2px solid color-mix(in srgb, var(--accent) 72%, transparent);
  border-left-color: transparent;
  border-radius: 50%;
}

.building-hotspot--portal:hover .building-hotspot__vfx i,
.building-hotspot--portal:focus-visible .building-hotspot__vfx i {
  animation: hotspot-spin 1.8s linear infinite;
}

.building-hotspot--portal .building-hotspot__vfx i:nth-child(2) { inset: 23%; animation-direction: reverse; animation-duration: 1.2s; }
.building-hotspot--portal .building-hotspot__vfx i:nth-child(3) { inset: 37%; border-width: 3px; box-shadow: 0 0 18px var(--accent); }

.building-hotspot--alchemy .building-hotspot__vfx i,
.building-hotspot--forge .building-hotspot__vfx i {
  left: 28%;
  bottom: 12%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.building-hotspot--alchemy .building-hotspot__vfx i:nth-child(2),
.building-hotspot--forge .building-hotspot__vfx i:nth-child(2) { left: 48%; }
.building-hotspot--alchemy .building-hotspot__vfx i:nth-child(3),
.building-hotspot--forge .building-hotspot__vfx i:nth-child(3) { left: 68%; }

.building-hotspot--alchemy:hover .building-hotspot__vfx i,
.building-hotspot--alchemy:focus-visible .building-hotspot__vfx i,
.building-hotspot--forge:hover .building-hotspot__vfx i,
.building-hotspot--forge:focus-visible .building-hotspot__vfx i { animation: hotspot-rise 1.4s ease-out infinite; }

.building-hotspot--alchemy .building-hotspot__vfx i:nth-child(2),
.building-hotspot--forge .building-hotspot__vfx i:nth-child(2) { animation-delay: 0.35s; }
.building-hotspot--alchemy .building-hotspot__vfx i:nth-child(3),
.building-hotspot--forge .building-hotspot__vfx i:nth-child(3) { animation-delay: 0.7s; }

.building-hotspot--spring .building-hotspot__vfx i,
.building-hotspot--gather .building-hotspot__vfx i {
  left: 50%;
  top: 50%;
  width: 28%;
  aspect-ratio: 1;
  border: 1px solid var(--accent);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.building-hotspot--spring:hover .building-hotspot__vfx i,
.building-hotspot--spring:focus-visible .building-hotspot__vfx i,
.building-hotspot--gather:hover .building-hotspot__vfx i,
.building-hotspot--gather:focus-visible .building-hotspot__vfx i { animation: hotspot-ripple 1.8s ease-out infinite; }

.building-hotspot--spring .building-hotspot__vfx i:nth-child(2),
.building-hotspot--gather .building-hotspot__vfx i:nth-child(2) { animation-delay: 0.55s; }
.building-hotspot--spring .building-hotspot__vfx i:nth-child(3),
.building-hotspot--gather .building-hotspot__vfx i:nth-child(3) { animation-delay: 1.1s; }

.building-hotspot__hover-label {
  position: absolute;
  left: 50%;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: max-content;
  padding: 3px 10px;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--frame-outer));
  border-radius: 999px;
  background:
    var(--paper-grain) 0 0 / 100px 100px repeat,
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 100%);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
  color: var(--paper-text);
  font: 600 var(--text-xs) var(--font-body);
  opacity: 0;
  transform: translate(-50%, 8px);
  transition: opacity 140ms ease, transform 160ms ease;
  pointer-events: none;
}

.building-hotspot__hover-label small { color: var(--paper-text-muted); font-size: var(--text-xs); font-weight: 400; }
.building-hotspot:hover .building-hotspot__hover-label,
.building-hotspot:focus-visible .building-hotspot__hover-label { opacity: 1; transform: translate(-50%, 0); }

/* Nameplate + badge trạng thái (plan ui-discoverability §3.1) — luôn
   hiện ở zoom mặc định, đặt phía dưới vùng bấm hotspot. */
.building-nameplate {
  position: absolute;
  left: 50%;
  top: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: max-content;
  max-width: 220%;
  padding: 2px 8px;
  border: 1px solid var(--frame-outer);
  border-radius: var(--radius-sm);
  background:
    var(--paper-grain) 0 0 / 100px 100px repeat,
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 100%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  color: var(--paper-text);
  font: 500 var(--text-xs) var(--font-body);
  line-height: var(--lh-tight);
  transform: translateX(-50%);
  pointer-events: none;
}

.building-nameplate__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.building-nameplate__lock {
  flex: 0 0 auto;
  width: 0.58em;
  height: 0.5em;
  border: 1px solid currentColor;
  border-radius: 2px;
  position: relative;
}

.building-nameplate__lock::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -0.55em;
  width: 0.36em;
  height: 0.55em;
  border: 1px solid currentColor;
  border-bottom: 0;
  border-radius: 0.36em 0.36em 0 0;
  transform: translateX(-50%);
}

.building-nameplate__ready,
.building-nameplate__active,
.building-nameplate__upgradeable {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.building-nameplate--locked {
  color: var(--paper-text-muted);
  opacity: 0.85;
}

.building-nameplate--locked .building-nameplate__lock {
  border-color: var(--text-muted);
}

.building-nameplate--ready {
  color: var(--jade);
}

.building-nameplate--ready .building-nameplate__ready {
  background: var(--jade);
  box-shadow: 0 0 6px var(--jade);
}

.building-nameplate--active {
  color: var(--el-fire);
}

.building-nameplate--active .building-nameplate__active {
  background: var(--el-fire);
  box-shadow: 0 0 6px var(--el-fire);
  animation: nameplate-pulse 1.4s ease-in-out infinite;
}

.building-nameplate--upgradeable {
  color: var(--gold-500);
}

.building-nameplate--upgradeable .building-nameplate__upgradeable {
  background: var(--gold-500);
  box-shadow: 0 0 6px var(--gold-500);
  animation: nameplate-glow 1.8s ease-in-out infinite;
}

@keyframes nameplate-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.8); }
}

@keyframes nameplate-glow {
  0%, 100% { box-shadow: 0 0 4px var(--gold-500); }
  50% { box-shadow: 0 0 10px var(--gold-500); }
}

@media (prefers-reduced-motion: reduce) {
  .building-nameplate__active,
  .building-nameplate__upgradeable {
    animation: none !important;
  }
}

@keyframes hotspot-spin { to { transform: rotate(360deg); } }
@keyframes hotspot-rise {
  0% { opacity: 0; transform: translateY(0) scale(0.7); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-70px) scale(1.2); }
}
@keyframes hotspot-ripple {
  0% { opacity: 0.8; transform: translate(-50%, -50%) scale(0.45); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(2.4); }
}

@media (prefers-reduced-motion: reduce) {
  .building-hotspot__vfx i { animation: none !important; }
}
</style>
