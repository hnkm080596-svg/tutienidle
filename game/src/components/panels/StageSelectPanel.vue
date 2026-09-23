<script setup lang="ts">
// Thám Hiểm (2026-08-14) — màn hình chọn màn trước khi chiến đấu, thay
// nút "Chiến Đấu" trực tiếp cũ. 3 lựa chọn theo đúng thứ tự người
// dùng mô tả: Địa Giới (map lớn) → Màn (trong Địa Giới đó) → chế độ
// (Lặp Lại Khiêu Chiến / Tự Động Thám Hiểm) → Bắt Đầu.
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useUiStore, type BattleRunMode } from '@/stores/ui'
import { useGameManager } from '@/composables/useGameState'
import { useBattleActions } from '@/composables/useBattleActions'
import { ASSET_BUNDLE_MANAGER_KEY } from '@/presentation/PresentationContracts'
import BuildingConstructionGate from './BuildingConstructionGate.vue'
import GameButton from '@/components/common/GameButton.vue'
import Chip from '@/components/common/primitives/Chip.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import { getCurrentRealm } from '@/core/realm/realmSystem'

const { t } = useI18n()

const player = usePlayerStore()
const ui = useUiStore()
const gameManager = useGameManager()
const { startSelectedStage } = useBattleActions()
const assetManager = inject(ASSET_BUNDLE_MANAGER_KEY, null)

onMounted(() => {
  assetManager?.prefetch(['combat']).catch(() => {})
})

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
  return Boolean(firstStageId && gameManager.catalogOps.isStageUnlocked(firstStageId, player.$state))
}

// Luyện Khí tầng 1-10 content pass — gate MỊN hơn isZoneUnlocked (chỉ
// đại-cảnh-giới): requiredRealmLevel CHỈ được xét khi player ĐANG ở
// đúng requiredRealmId của Stage đó — nếu player đã vượt hẳn qua đại
// cảnh giới này (vd đã lên Trúc Cơ), tầng gate coi như hết ý nghĩa,
// Stage mở tự do để farm lại.
function isStageUnlocked(stage: (typeof stagesInZone.value)[number]): boolean {
  return gameManager.catalogOps.isStageUnlocked(stage.id, player.$state)
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
    .map(stageId => gameManager.catalogOps.getStage(stageId))
    .filter((stage): stage is NonNullable<typeof stage> => stage !== undefined)
})

const selectedStageId = ref<string | null>(null)
const selectedChapter = ref<number>(stagesInZone.value[0]?.chapter ?? 1)

// Auto-farm B5 — armed state is player state (survives reload), so the
// panel mirrors it: running farm row + stop control, and the perfect-farm
// start only closes the panel when the domain accepted it.
const armedFarmStage = computed(() => {
  const armed = player.$state.autoFarmStage
  if (!armed) {
    return null
  }

  return gameManager.catalogOps.getStage(armed.stageId) ?? null
})

function stopAutoFarm() {
  gameManager.turnBattleOps.autoFarmOps.stopAutoFarm(player.$state)
}

const chapterOptions = computed(() => {
  const chapters = new Map<number, { chapter: number; label: string }>()

  for (const stage of stagesInZone.value) {
    const chapter = stage.chapter ?? 1
    if (!chapters.has(chapter)) {
      chapters.set(chapter, {
        chapter,
        label: stage.requiredRealmId ? getCurrentRealm(stage.requiredRealmId).name : t('panels.stageSelect.labels.chapterPrefix', { chapter }),
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
    .map(entry => gameManager.catalogOps.getEnemyTemplate(entry.enemyId)?.name ?? entry.enemyId),
})))

const selectedEncounters = computed(() => {
  if (!selectedStage.value) return []

  return selectedStage.value.enemyPool.map((entry) => {
    const enemy = gameManager.catalogOps.getEnemyTemplate(entry.enemyId)
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
  return gameManager.catalogOps.getEnemyTemplate(bossId)
})

const ARCHETYPE_LABEL_KEYS: Record<string, string> = {
  melee: 'panels.stageSelect.archetypes.melee',
  ranged: 'panels.stageSelect.archetypes.ranged',
  caster: 'panels.stageSelect.archetypes.caster',
  tank: 'panels.stageSelect.archetypes.tank',
}

const mode = ref<BattleRunMode>('manual')

// T4-38 - an armed mode must not leak across stage selection: every
// writer of selectedStageId (selectStage click, zone/chapter re-pick)
// funnels through this watcher, so one reset covers all paths.
watch(selectedStageId, () => {
  mode.value = 'manual'
})

// Auto-farm Task 6 — chip thứ 4 chỉ bật khi stage đang chọn đã Hoàn Mỹ.
const isSelectedStagePerfectClear = computed(() =>
  Boolean(selectedStage.value && player.$state.perfectClearStageIds.includes(selectedStage.value.id)),
)

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

  // Auto-farm Task 6 (2026-09-04) — perfect_farm KHÔNG start trận thật:
  // gọi startAutoFarm trực tiếp (roll reward theo wall-clock, không
  // hoạt ảnh) — khác mọi mode khác đều qua startSelectedStage.
  if (mode.value === 'perfect_farm') {
    // Only close on an accepted start - a refused start (slot held by a
    // running farm, missing perfect clear) keeps the panel open so the
    // failure is visible instead of silent (partial T4-38).
    if (gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player.$state, selectedStage.value.id)) {
      ui.leftPanelMode = null
    }
    return
  }

  void startSelectedStage(selectedZone.value.id, selectedStage.value, mode.value)
}
</script>

<template>
  <BuildingConstructionGate building-id="teleport_array">
  <div class="stage-select-shell">
    <!-- Banner ảnh teleport_array đã bỏ (2026-08-30, bug report: hình dư
         thừa). Intro text (eyebrow/h3/mô tả) BỎ LUÔN (2026-08-30, bug
         report thứ 2: trùng lặp — title bar OverlayPanel đã hiện "Địa
         Giới", nhãn filter "Địa Giới"/"Cảnh Giới Khu Vực" bên dưới đã tự
         giải thích, không cần lặp lại bằng câu văn). -->
    <div class="stage-select">
      <nav class="stage-select__filters" :aria-label="t('panels.stageSelect.aria.filters')">
        <div class="stage-select__filter-group">
          <small>{{ t('panels.stageSelect.labels.zoneFilter') }}</small>
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
          <small>{{ t('panels.stageSelect.labels.chapterFilter') }}</small>
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
        <section class="stage-select__map-panel scrollfade sys-chamfer">
          <h4 class="stage-select__title">{{ t('panels.stageSelect.sections.selectFloor') }}</h4>

          <EmptyState v-if="visibleStages.length === 0" size="sm">{{ t('panels.stageSelect.empty.noStages') }}</EmptyState>

          <div v-else class="stage-map">
            <button
              v-for="node in stageNodes"
              :key="node.stage.id"
              type="button"
              class="stage-map__node sys-chamfer"
              :data-testid="`stage-node-${node.stage.id}`"
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
                <strong>{{ t('panels.stageSelect.labels.floorPrefix', { floor: node.stage.floor ?? node.stage.requiredRealmLevel ?? 1 }) }}</strong>
                <small>{{ node.enemies.join(' · ') }}</small>
              </span>
              <span v-if="node.stage.bossEnemyId" class="stage-map__boss">{{ t('panels.stageSelect.labels.boss') }}</span>
            </button>
          </div>
        </section>

        <section class="stage-select__detail sys-chamfer">
        <div v-if="armedFarmStage" class="stage-select__autofarm">
          <span>{{ t('autoFarm.running', { stage: armedFarmStage.name }) }}</span>
          <GameButton variant="danger" size="sm" data-testid="autofarm-stop" @click="stopAutoFarm">
            {{ t('autoFarm.stop') }}
          </GameButton>
        </div>
      <template v-if="selectedStage">
        <h4 class="stage-select__title">{{ selectedStage.name }}</h4>
        <p class="stage-select__description">{{ selectedStage.description }}</p>

        <div class="stage-select__encounter-summary">
          <span><strong>{{ selectedStage.totalEnemyCount }}</strong> {{ t('panels.stageSelect.labels.enemiesSuffix') }}</span>
          <span v-if="selectedBoss" class="is-boss">{{ t('panels.stageSelect.labels.bossNamePrefix') }} <strong>{{ selectedBoss.name }}</strong></span>
        </div>

        <div class="stage-select__enemy-list">
          <article v-for="enemy in selectedEncounters" :key="enemy.id" class="stage-select__enemy">
            <span class="stage-select__enemy-sigil">{{ enemy.name.charAt(0) }}</span>
            <span>
              <strong>{{ enemy.name }}</strong>
              <!-- Bỏ "Trọng số {{enemy.weight}}" (2026-08-30, bug report:
                   số trọng số RNG nội bộ, không có ngữ cảnh tổng nên
                   không giúp người chơi quyết định gì). -->
              <small>
                <template v-if="enemy.level">{{ t('panels.stageSelect.labels.levelPrefix', { level: enemy.level }) }} · </template>{{ t(ARCHETYPE_LABEL_KEYS[enemy.archetype] ?? 'panels.stageSelect.archetypes.melee') }}
                <template v-if="enemy.eliteChance > 0"> · {{ t('panels.stageSelect.labels.eliteChance', { percent: Math.round(enemy.eliteChance * 100) }) }}</template>
              </small>
            </span>
          </article>
        </div>

        <div class="stage-select__mode">
          <Chip :active="mode === 'manual'" @click="mode = 'manual'">{{ t('panels.stageSelect.modes.manual') }}</Chip>
          <Chip :active="mode === 'repeat'" @click="mode = 'repeat'">{{ t('panels.stageSelect.modes.repeat') }}</Chip>
          <Chip :active="mode === 'progress'" @click="mode = 'progress'">{{ t('panels.stageSelect.modes.progress') }}</Chip>
          <Chip
            :active="mode === 'perfect_farm'"
            :disabled="!isSelectedStagePerfectClear"
            @click="isSelectedStagePerfectClear && (mode = 'perfect_farm')"
          >{{ t('panels.stageSelect.modes.perfectFarm') }}</Chip>
        </div>

        <p class="stage-select__mode-hint">
          {{ mode === 'manual' ? t('panels.stageSelect.modeHints.manual') : mode === 'repeat' ? t('panels.stageSelect.modeHints.repeat') : mode === 'progress' ? t('panels.stageSelect.modeHints.progress') : t('panels.stageSelect.modeHints.perfectFarm') }}
        </p>

        <div class="stage-select__start-row">
          <GameButton class="stage-select__build" variant="secondary" size="sm" @click="openBuild">{{ t('panels.stageSelect.actions.editBuild') }}</GameButton>

          <GameButton class="stage-select__start" size="sm" :disabled="!canStart" data-testid="stage-start-button" @click="start">
            {{ t('panels.stageSelect.actions.start') }}
          </GameButton>
        </div>
      </template>

          <EmptyState v-else size="lg">{{ t('panels.stageSelect.empty.selectStage') }}</EmptyState>
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
    var(--sys-grain, var(--paper-grain)) 0 0 / 160px 160px repeat,
    radial-gradient(circle at 70% 0, color-mix(in srgb, var(--sys-violet, var(--scene-portal-glow)) 10%, transparent), transparent 40%),
    linear-gradient(175deg, var(--sys-bg-0, var(--paper-50)) 0%, var(--sys-bg-1, var(--paper-100)) 60%, var(--sys-bg-1, var(--paper-200)) 100%);
}

.stage-select {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  font-family: var(--sys-font-body, var(--font-body));
  color: var(--sys-text, var(--paper-text));
}

.stage-select__filters {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--sys-line-soft, var(--paper-line));
  background: color-mix(in srgb, var(--sys-violet, var(--scene-portal-glow)) 6%, var(--sys-bg-1, var(--paper-100)));
}

.stage-select__filter-group {
  display: flex;
  align-items: center;
  gap: 5px;
}

.stage-select__filter-group small {
  margin-right: 3px;
  color: var(--sys-text-dim, var(--paper-text-muted));
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: .08em;
}

.stage-select__filter-chip {
  padding: 5px 10px;
  font-weight: 600;
  /* Filter Địa Giới dùng palette portal teal — đè công thức chrome chuẩn
     của Chip bằng CSS var local. */
  --chip-active-bg: color-mix(in srgb, var(--sys-violet, var(--scene-portal-glow)) 20%, var(--sys-bg-0, var(--paper-50)));
}

.stage-select__filter-chip.is-active {
  border-color: var(--sys-violet, var(--scene-portal-accent));
  color: color-mix(in srgb, var(--sys-violet, var(--scene-portal-accent)) 55%, var(--sys-text, var(--brush-950)) 45%);
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
  border-right: 1px solid var(--sys-line-soft, var(--paper-line));
  overflow-y: auto;
}

.stage-select__detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stage-select__title {
  margin: 0 0 8px;
  font-family: var(--sys-font-display, var(--font-display));
  color: var(--sys-text, var(--paper-text));
  font-size: var(--text-body);
}

.stage-select .empty-state {
  color: var(--sys-text-dim, var(--paper-text-muted));
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
  background: linear-gradient(105deg, color-mix(in srgb, var(--sys-violet, var(--scene-portal-glow)) 8%, var(--sys-bg-0, var(--paper-50))), color-mix(in srgb, var(--sys-violet, var(--scene-portal-glow)) 4%, var(--sys-bg-1, var(--paper-100))));
  border: 1px solid color-mix(in srgb, var(--sys-violet, var(--scene-portal-glow)) 30%, var(--sys-line-soft, var(--paper-line)));
  color: var(--sys-text, var(--paper-text));
  cursor: pointer;
  text-align: center;
}

.stage-map__number {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--sys-violet, var(--scene-portal-accent)) 50%, transparent);
  border-radius: 50%;
  color: color-mix(in srgb, var(--sys-violet, var(--scene-portal-accent)) 55%, var(--sys-text, var(--brush-950)) 45%);
  font: 700 var(--text-sm) var(--sys-font-display, var(--font-display));
}
.stage-map__copy { width: 100%; min-width: 0; display: flex; flex-direction: column; }
.stage-map__copy strong { font-size: var(--text-sm); }
.stage-map__copy small { overflow: hidden; color: var(--sys-text-dim, var(--paper-text-muted)); font-size: var(--text-xs); text-overflow: ellipsis; white-space: nowrap; }
.stage-map__boss {
  position: absolute;
  top: 4px;
  right: 4px;
  color: var(--sys-danger, var(--crimson));
  font-size: var(--text-xs);
  font-weight: 800;
}

.stage-map__node:hover {
  border-color: var(--sys-violet, var(--scene-portal-glow));
}

.stage-map__node.is-selected {
  border-color: var(--sys-violet, var(--scene-portal-glow));
  background: color-mix(in srgb, var(--sys-violet, var(--scene-portal-glow)) 18%, var(--sys-bg-0, var(--paper-50)));
  box-shadow: 0 0 10px -2px var(--sys-violet, var(--scene-portal-glow));
}

.stage-map__node.is-locked {
  opacity: 0.45;
  cursor: not-allowed;
}

.stage-map__node.is-final:not(.is-selected) {
  border-color: var(--sys-danger, var(--crimson));
}

.stage-select__description,
.stage-select__meta {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--sys-text-muted, var(--paper-text-soft));
}

.stage-select__encounter-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.stage-select__encounter-summary span {
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, var(--sys-violet, var(--scene-portal-glow)) 28%, var(--sys-line-soft, var(--paper-line)));
  border-radius: 999px;
  background: color-mix(in srgb, var(--sys-violet, var(--scene-portal-glow)) 8%, var(--sys-bg-1, var(--paper-100)));
  color: var(--sys-text-muted, var(--paper-text-soft));
  font-size: var(--text-xs);
}
.stage-select__encounter-summary .is-boss { border-color: color-mix(in srgb, var(--sys-danger, var(--crimson)) 45%, transparent); color: var(--sys-danger, var(--crimson)); }
.stage-select__enemy-list { display: flex; flex-direction: column; gap: 5px; }
.stage-select__enemy {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px;
  border: 1px solid var(--sys-line-soft, var(--paper-line));
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--sys-violet, var(--scene-portal-glow)) 5%, var(--sys-bg-1, var(--paper-100)));
}
.stage-select__enemy-sigil {
  display: grid;
  flex: 0 0 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--sys-violet, var(--scene-portal-glow)) 20%, var(--sys-bg-0, var(--paper-50)));
  color: color-mix(in srgb, var(--sys-violet, var(--scene-portal-accent)) 55%, var(--sys-text, var(--brush-950)) 45%);
  font-family: var(--sys-font-display, var(--font-display));
}
.stage-select__enemy > span:last-child { min-width: 0; display: flex; flex-direction: column; }
.stage-select__enemy strong { font-size: var(--text-sm); }
.stage-select__enemy small { color: var(--sys-text-dim, var(--paper-text-muted)); font-size: var(--text-xs); }

.stage-select__autofarm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  color: var(--sys-text-dim, var(--text-muted));
}

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
  color: var(--sys-text-dim, var(--paper-text-muted));
}

.stage-select__auto {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-sm);
  color: var(--sys-text-muted, var(--paper-text-soft));
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
  background: var(--sys-bg-1, var(--paper-200));
  color: var(--sys-text-dim, var(--paper-text-muted));
}

/* Fit-refactor đợt 2 — đo theo CARD (overlay-panel container), không còn
   viewport; scene clamp tự co nên bỏ flex-basis override. */
@container overlay-panel (max-width: 900px) {
  .stage-select__filters { align-items: flex-start; flex-direction: column; gap: 6px; }
  .stage-select__filter-group { width: 100%; }
  .stage-select__workspace { display: flex; flex-direction: column; }
  .stage-select__map-panel { border-right: none; border-bottom: 1px solid var(--sys-line-soft, var(--ink-line-soft)); }
  .stage-map { grid-template-columns: repeat(5, minmax(72px, 1fr)); }
  .stage-select__detail { min-height: 360px; }
}
</style>
