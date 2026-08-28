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
import GameButton from '@/components/common/GameButton.vue'
import Chip from '@/components/common/primitives/Chip.vue'
import SceneHeader from '@/components/common/SceneHeader.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import { getCurrentRealm } from '@/core/realm/realmSystem'

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
const selectedChapter = ref<number>(stagesInZone.value[0]?.chapter ?? 1)

const chapterOptions = computed(() => {
  const chapters = new Map<number, { chapter: number; label: string }>()

  for (const stage of stagesInZone.value) {
    const chapter = stage.chapter ?? 1
    if (!chapters.has(chapter)) {
      chapters.set(chapter, {
        chapter,
        label: stage.requiredRealmId ? getCurrentRealm(stage.requiredRealmId).name : `Chương ${chapter}`,
      })
    }
  }

  return [...chapters.values()]
})

const visibleStages = computed(() =>
  stagesInZone.value.filter(stage => (stage.chapter ?? 1) === selectedChapter.value),
)

function selectFirstStageInChapter() {
  selectedStageId.value = visibleStages.value.find(stage => isStageUnlocked(stage))?.id
    ?? visibleStages.value[0]?.id
    ?? null
}

// Đổi Địa Giới thì bỏ chọn Màn cũ (Màn thuộc Địa Giới trước, không còn
// hợp lệ ở Địa Giới mới).
// Đổi chapter.value → watcher bên dưới tự chọn lại stage (đúng 1 lần);
// chapter GIỮ NGUYÊN (đa số zone đều bắt đầu ở chapter 1) thì watcher
// đó không bắn, nên gọi trực tiếp ở đây để không rơi mất lần chọn lại.
watch(selectedZoneId, () => {
  const nextChapter = stagesInZone.value[0]?.chapter ?? 1

  if (selectedChapter.value === nextChapter) {
    selectFirstStageInChapter()
  } else {
    selectedChapter.value = nextChapter
  }
}, { immediate: true })

watch(selectedChapter, selectFirstStageInChapter)

const selectedStage = computed(() =>
  stagesInZone.value.find(stage => stage.id === selectedStageId.value) ?? null,
)

const stageNodes = computed(() => visibleStages.value.map((stage, index) => ({
  stage,
  isLast: index === visibleStages.value.length - 1,
  enemies: stage.enemyPool
    .map(entry => gameManager.getEnemyTemplate(entry.enemyId)?.name ?? entry.enemyId),
})))

const selectedEncounters = computed(() => {
  if (!selectedStage.value) return []

  return selectedStage.value.enemyPool.map((entry) => {
    const enemy = gameManager.getEnemyTemplate(entry.enemyId)
    return {
      id: entry.enemyId,
      name: enemy?.name ?? entry.enemyId,
      level: enemy?.level,
      archetype: enemy?.archetype ?? 'melee',
      weight: entry.weight,
      eliteChance: entry.eliteChance ?? 0,
    }
  })
})

const selectedBoss = computed(() => {
  const bossId = selectedStage.value?.bossEnemyId
  if (!bossId) return null
  return gameManager.getEnemyTemplate(bossId)
})

const ARCHETYPE_LABELS: Record<string, string> = {
  melee: 'Cận chiến',
  ranged: 'Tầm xa',
  caster: 'Pháp thuật',
  tank: 'Hộ vệ',
}

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

function selectChapter(chapter: number) {
  selectedChapter.value = chapter
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
  <div class="stage-select-shell">
    <SceneHeader
      class="stage-select__scene"
      asset="/assets/buildings/dong-fu/teleport_array.png"
      scene="portal"
      :height="118"
      object-position="center 52%"
      :image-opacity="0.5"
    >
      <template #decoration>
        <div class="stage-select__portal" aria-hidden="true">界</div>
      </template>

      <div class="stage-select__scene-copy">
        <small>TRẬN VĂN ĐỊNH VỊ</small>
        <h3>Chọn địa giới để truyền tống</h3>
        <p>Xem trước đội hình yêu thú, số lượng và nhịp xuất hiện của từng tầng.</p>
      </div>
    </SceneHeader>

    <div class="stage-select">
      <nav class="stage-select__filters" aria-label="Chọn địa giới và chương">
        <div class="stage-select__filter-group">
          <small>Địa Giới</small>
          <Chip
            v-for="zone in zones"
            :key="zone.id"
            class="stage-select__filter-chip"
            :class="{ 'is-locked': !isZoneUnlocked(zone.id) }"
            :active="zone.id === selectedZoneId"
            :disabled="!isZoneUnlocked(zone.id)"
            @click="selectZone(zone.id)"
          >
            {{ zone.name }}
          </Chip>
        </div>

        <div class="stage-select__filter-group stage-select__filter-group--chapters">
          <small>Cảnh Giới Khu Vực</small>
          <Chip
            v-for="chapter in chapterOptions"
            :key="chapter.chapter"
            class="stage-select__filter-chip"
            :active="chapter.chapter === selectedChapter"
            @click="selectChapter(chapter.chapter)"
          >
            {{ chapter.label }}
          </Chip>
        </div>
      </nav>

      <div class="stage-select__workspace">
        <section class="stage-select__map-panel">
          <h4 class="stage-select__title">Chọn tầng</h4>

          <EmptyState v-if="visibleStages.length === 0" size="sm">Khu vực này chưa có tầng chiến đấu.</EmptyState>

          <div v-else class="stage-map">
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
              v-tooltip="node.stage.description"
              @click="selectStage(node.stage.id)"
            >
              <span class="stage-map__number">{{ node.stage.floor ?? node.stage.requiredRealmLevel ?? 1 }}</span>
              <span class="stage-map__copy">
                <strong>Tầng {{ node.stage.floor ?? node.stage.requiredRealmLevel ?? 1 }}</strong>
                <small>{{ node.enemies.join(' · ') }}</small>
              </span>
              <span v-if="node.stage.bossEnemyId" class="stage-map__boss">BOSS</span>
            </button>
          </div>
        </section>

        <section class="stage-select__detail">
      <template v-if="selectedStage">
        <h4 class="stage-select__title">{{ selectedStage.name }}</h4>
        <p class="stage-select__description">{{ selectedStage.description }}</p>

        <div class="stage-select__encounter-summary">
          <span><strong>{{ selectedStage.totalEnemyCount }}</strong> quái</span>
          <span>Mỗi <strong>{{ selectedStage.spawnIntervalSeconds }}s</strong> xuất hiện</span>
          <span v-if="selectedBoss" class="is-boss">Boss: <strong>{{ selectedBoss.name }}</strong></span>
        </div>

        <div class="stage-select__enemy-list">
          <article v-for="enemy in selectedEncounters" :key="enemy.id" class="stage-select__enemy">
            <span class="stage-select__enemy-sigil">{{ enemy.name.charAt(0) }}</span>
            <span>
              <strong>{{ enemy.name }}</strong>
              <small>
                <template v-if="enemy.level">Lv.{{ enemy.level }} · </template>{{ ARCHETYPE_LABELS[enemy.archetype] ?? enemy.archetype }} · Trọng số {{ enemy.weight }}
                <template v-if="enemy.eliteChance > 0"> · {{ Math.round(enemy.eliteChance * 100) }}% Tinh Anh</template>
              </small>
            </span>
          </article>
        </div>

        <div class="stage-select__mode">
          <Chip :active="mode === 'manual'" @click="mode = 'manual'">Thủ Công</Chip>
          <Chip :active="mode === 'repeat'" @click="mode = 'repeat'">Lặp Lại</Chip>
          <Chip :active="mode === 'progress'" @click="mode = 'progress'">Tự Động Tiến Ải</Chip>
        </div>

        <p class="stage-select__mode-hint">
          {{ mode === 'manual' ? 'Kết thúc trận và chờ bạn quyết định.' : mode === 'repeat' ? 'Tự đánh lại đúng tầng hiện tại.' : 'Thắng thì đi tiếp, thua thì dừng.' }}
        </p>

        <div class="stage-select__start-row">
          <GameButton class="stage-select__build" variant="secondary" size="sm" @click="openBuild">? Build</GameButton>

          <GameButton class="stage-select__start" size="sm" :disabled="!canStart" @click="start">
            Bắt Đầu
          </GameButton>
        </div>
      </template>

          <EmptyState v-else size="lg">Chọn một tầng để xem đội hình.</EmptyState>
        </section>
      </div>
    </div>
  </div>
  </BuildingConstructionGate>
</template>

<style scoped>
.stage-select-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background:
    radial-gradient(circle at 70% 0, color-mix(in srgb, var(--scene-portal-glow) 14%, transparent), transparent 38%),
    linear-gradient(150deg, color-mix(in srgb, var(--scene-portal-deep) 98%, transparent), color-mix(in srgb, var(--scene-portal-deep) 98%, transparent));
}

.stage-select__scene {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 14px 24px;
  border-bottom: 1px solid color-mix(in srgb, var(--scene-portal-accent) 30%, transparent);
}

/* Gradient ngang đặc thù panel Địa Giới — đè scrim dọc mặc định. */
.stage-select__scene :deep(.scene-header__scrim) {
  background: linear-gradient(90deg, color-mix(in srgb, var(--scene-portal-deep) 18%, transparent), color-mix(in srgb, var(--scene-portal-deep) 96%, transparent) 62%);
}

.stage-select__scene-copy {
  position: relative;
  z-index: 1;
}

.stage-select__scene-copy small { color: var(--scene-portal-accent); letter-spacing: .18em; }
.stage-select__scene-copy h3 { margin: 2px 0; color: var(--scene-portal-text); font: 700 var(--text-lg) var(--font-display); }
.stage-select__scene-copy p { margin: 0; color: var(--text-secondary); font-size: var(--text-xs); }
.stage-select__portal {
  display: grid;
  flex: 0 0 64px;
  height: 64px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--scene-portal-text-soft) 65%, transparent);
  border-radius: 50%;
  color: var(--scene-portal-text-soft);
  font: 700 var(--text-panel-title) var(--font-display);
  box-shadow: 0 0 22px color-mix(in srgb, var(--scene-portal-glow) 34%, transparent), inset 0 0 20px color-mix(in srgb, var(--scene-portal-glow) 20%, transparent);
}

.stage-select {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  font-family: var(--font-body);
  color: var(--text-primary);
}

.stage-select__filters {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ink-line-soft);
  background: color-mix(in srgb, var(--scene-portal-deep) 82%, transparent);
}

.stage-select__filter-group {
  display: flex;
  align-items: center;
  gap: 5px;
}

.stage-select__filter-group small {
  margin-right: 3px;
  color: var(--text-muted);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: .08em;
}

.stage-select__filter-chip {
  padding: 5px 10px;
  font-weight: 600;
  /* Filter Địa Giới dùng palette portal teal — đè công thức chrome chuẩn
     của Chip bằng CSS var local. */
  --chip-active-bg: color-mix(in srgb, var(--scene-portal-glow) 22%, transparent);
}

.stage-select__filter-chip.is-active {
  border-color: var(--scene-portal-accent);
  color: var(--scene-portal-text-soft);
}

.stage-select__filter-chip.is-locked {
  opacity: 0.55;
}

.stage-select__workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(290px, .75fr);
}

.stage-select__map-panel,
.stage-select__detail {
  min-width: 0;
  min-height: 0;
  padding: 10px 12px;
}

.stage-select__map-panel {
  border-right: 1px solid var(--ink-line-soft);
  overflow-y: auto;
}

.stage-select__detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stage-select__title {
  margin: 0 0 8px;
  font-family: var(--font-display);
  color: var(--chrome-100);
  font-size: var(--text-body);
}

.stage-select .empty-state {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

/* World map thu nhỏ (spec mục 22) — đường mòn ngoằn ngoèo, xem
   stageNodes/stagePathPoints. */
.stage-map {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.stage-map__node {
  position: relative;
  min-width: 0;
  min-height: 94px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 5px;
  border-radius: var(--radius-sm);
  background: linear-gradient(105deg, color-mix(in srgb, var(--scene-portal-deep) 90%, transparent), color-mix(in srgb, var(--scene-portal-deep) 94%, transparent));
  border: 1px solid color-mix(in srgb, var(--scene-portal-glow) 28%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  text-align: center;
}

.stage-map__number {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--scene-portal-accent) 44%, transparent);
  border-radius: 50%;
  color: var(--scene-portal-text-soft);
  font: 700 var(--text-sm) var(--font-display);
}
.stage-map__copy { width: 100%; min-width: 0; display: flex; flex-direction: column; }
.stage-map__copy strong { font-size: var(--text-sm); }
.stage-map__copy small { overflow: hidden; color: var(--text-muted); font-size: var(--text-xs); text-overflow: ellipsis; white-space: nowrap; }
.stage-map__boss {
  position: absolute;
  top: 4px;
  right: 4px;
  color: color-mix(in srgb, var(--crimson) 62%, white);
  font-size: var(--text-xs);
  font-weight: 800;
}

.stage-map__node:hover {
  border-color: var(--chrome-300);
}

.stage-map__node.is-selected {
  border-color: var(--chrome-300);
  background: color-mix(in srgb, var(--chrome-300) 22%, var(--ink-800));
  box-shadow: 0 0 10px -2px var(--chrome-300);
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
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.stage-select__encounter-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.stage-select__encounter-summary span {
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, var(--scene-portal-glow) 24%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--scene-portal-deep) 70%, transparent);
  color: var(--text-secondary);
  font-size: var(--text-xs);
}
.stage-select__encounter-summary .is-boss { border-color: color-mix(in srgb, var(--crimson) 42%, transparent); color: color-mix(in srgb, var(--crimson) 60%, white); }
.stage-select__enemy-list { display: flex; flex-direction: column; gap: 5px; }
.stage-select__enemy {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px;
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--scene-portal-deep) 82%, transparent);
}
.stage-select__enemy-sigil {
  display: grid;
  flex: 0 0 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--scene-portal-glow) 16%, transparent);
  color: var(--scene-portal-text-soft);
  font-family: var(--font-display);
}
.stage-select__enemy > span:last-child { min-width: 0; display: flex; flex-direction: column; }
.stage-select__enemy strong { font-size: var(--text-sm); }
.stage-select__enemy small { color: var(--text-muted); font-size: var(--text-xs); }

.stage-select__mode {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-top: 4px;
}

.stage-select__mode .chip {
  padding: 6px;
  font-size: var(--text-sm);
}

.stage-select__mode-hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.stage-select__auto {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-sm);
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
}

.stage-select__start {
  flex: 1;
  padding: 8px;
}

.stage-select__start:disabled {
  background: var(--ink-700);
  color: var(--text-muted);
}

@media (max-width: 760px) {
  .stage-select__scene { flex-basis: 94px; padding: 10px 14px; }
  .stage-select__portal { flex-basis: 48px; height: 48px; }
  .stage-select { overflow-y: auto; }
  .stage-select__filters { align-items: flex-start; flex-direction: column; gap: 6px; }
  .stage-select__filter-group { width: 100%; overflow-x: auto; }
  .stage-select__workspace { display: flex; flex-direction: column; }
  .stage-select__map-panel { border-right: none; border-bottom: 1px solid var(--ink-line-soft); }
  .stage-map { grid-template-columns: repeat(5, minmax(72px, 1fr)); overflow-x: auto; }
  .stage-select__detail { min-height: 360px; }
}
</style>
