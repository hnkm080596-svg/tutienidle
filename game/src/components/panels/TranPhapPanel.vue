<script setup lang="ts">
// Formation panel (Combat Art Roster spec, 2026-09-05) - drag-and-drop
// assignment of player/companions into the selected formation's 3x3
// STANDING-SLOT grid (local slot indices 0-2, fixed regardless of the
// absolute battlefield region). Standing-slot rework (2026-09-07): grid
// size reads the shared STANDING_SLOT_COUNT instead of the old local
// PREVIEW_GRID_SIZE; grid resolution matches the Phaser canvas below
// exactly (both read the same constant).
// Mapping local slots onto PLAYER_SIDE_REGION absolutes happens in
// FormationPlacement.localCellToAbsolute() at battle build time -- this
// panel only reads/writes PlayerData.formationLoadout and never touches
// the real battlefield coordinate system.
//
// Gating uses ui.standalonePanel (NOT player.standalonePanel - that flag
// does not exist), same OverlayPanel pattern as every other standalone
// panel (SkillPathPanel.vue, ArtifactPanel.vue...). Opened via the
// command wheel slot 'formation_slot' (game/support/commandWheelCatalog.ts).
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type Phaser from 'phaser'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion } from '@/composables/useGameState'
import { TRAN_PHAP_FORMATIONS } from '@/data/formation/TranPhap'
import { TEST_COMPANIONS } from '@/data/companion/Companions'
import type { TranPhapDefinition } from '@/data/formation/TranPhap'
import type { FormationSlotAssignment } from '@/core/player/Player'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import { STANDING_SLOT_COUNT } from '@/core/battle/BattlefieldRegions'
// Battlefield Perspective Panel (2026-09-06) - the canvas is larger than the
// pure grid to leave room for perspective depth (spec section 3). The size now
// comes from FormationCanvasSpec, its single owner (V9); this file no longer
// declares it.
import {
  createFormationProjection,
  FORMATION_CANVAS_HEIGHT,
  FORMATION_CANVAS_WIDTH,
} from '@/presentation/geometry/FormationCanvasSpec'
import { createProjectionBridge } from '@/presentation/geometry/ProjectionBridge'
import { formationSlotStyle } from '@/presentation/geometry/formationSlotBoxes'
import type { TranPhapCombatPreviewScene } from '@/game/scenes/TranPhapCombatPreviewScene'
import type { SlotState } from '@/game/support/SlotState'

const ui = useUiStore()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()
const { t } = useI18n({ useScope: 'local' })

const selectedFormationId = ref<string | null>(player.formationLoadout?.formationId ?? null)

const selectedFormation = computed<TranPhapDefinition | null>(() => {
  stateVersion.value

  return TRAN_PHAP_FORMATIONS.find((f) => f.id === selectedFormationId.value) ?? null
})

const currentAssignments = ref<FormationSlotAssignment[]>(player.formationLoadout?.assignments ?? [])

function isLitCell(row: number, column: number): boolean {
  return selectedFormation.value?.cellPattern.some((cell) => cell.row === row && cell.column === column) ?? false
}

function assignmentAt(row: number, column: number): FormationSlotAssignment | undefined {
  return currentAssignments.value.find((a) => a.row === row && a.column === column)
}

// Battlefield Slot spec (2026-09-06) — thay boolean rời (--lit) bằng
// SlotState dùng chung, để nếu sau này combat thật cần state tương tự
// (targeting thủ công, tooltip theo ô) không phải bịa lại tên khác.
const hoveredCell = ref<{ row: number; column: number } | null>(null)

// V8 — slot hit-zones are derived from the SAME projection the canvas draws
// with, via the shared factory in FormationCanvasSpec (§3.6.2). Before this,
// the DOM grid was a uniform 56px CSS grid laid over a perspective canvas: the
// two could not align, and because the absolutely-positioned canvas left the
// container to be sized by that 176px grid, most of the 420x480 render was
// clipped away and never seen.
//
// The canvas already draws the grid lines (CombatGridView.redrawGridLines), so
// the overlay draws no grid of its own. Its job is hit-testing and state tint.
//
// clip-path rather than SVG polygons on purpose: clip-path clips pointer events
// too, so the trapezoid becomes the hit area while the existing HTML5
// drag-and-drop handlers keep working untouched. SVG elements support native
// DnD inconsistently, and swapping the interaction model is Phase 3's job, not
// a side effect of fixing alignment.
const slotBridge = createProjectionBridge(createFormationProjection())

function slotStyle(row: number, column: number): Record<string, string> {
  return formationSlotStyle(slotBridge, row, column)
}

const stackStyle = {
  width: `${FORMATION_CANVAS_WIDTH}px`,
  height: `${FORMATION_CANVAS_HEIGHT}px`,
}

function slotStateAt(row: number, column: number): SlotState {
  if (!isLitCell(row, column)) {
    return 'locked'
  }

  if (assignmentAt(row, column)) {
    return 'occupied'
  }

  if (hoveredCell.value?.row === row && hoveredCell.value?.column === column) {
    return 'hover'
  }

  return 'enabled'
}

// Danh sách quân "chưa được xếp vào ô nào" — kéo từ đây vào lưới.
// Player luôn là 1 lá bài cố định (id 'player'), cộng thêm mọi
// companion đã thu phục (Task 11) chưa được gán ô.
function combatantCards(): { combatantId: string; label: string }[] {
  const placed = new Set(currentAssignments.value.map((a) => a.combatantId))
  const cards: { combatantId: string; label: string }[] = []

  if (!placed.has('player')) {
    cards.push({ combatantId: 'player', label: player.name })
  }

  for (const instance of player.companions) {
    if (!placed.has(instance.definitionId)) {
      cards.push({ combatantId: instance.definitionId, label: instance.definitionId })
    }
  }

  return cards
}

function onSelectFormation(formation: TranPhapDefinition) {
  selectedFormationId.value = formation.id

  // Đổi trận pháp -> loại bỏ mọi assignment nằm ở ô KHÔNG còn hợp lệ
  // trong pattern mới; quân bị loại tự động quay lại hàng chờ (spec §4).
  currentAssignments.value = currentAssignments.value.filter((a) =>
    formation.cellPattern.some((cell) => cell.row === a.row && cell.column === a.column),
  )
}

function onDrop(row: number, column: number, combatantId: string) {
  if (!combatantId || !isLitCell(row, column)) {
    return
  }

  // Gỡ combatant khỏi vị trí cũ (nếu có) VÀ gỡ bất kỳ ai đang chiếm ô
  // đích, rồi gán lại — đảm bảo mỗi ô + mỗi combatant chỉ xuất hiện
  // đúng 1 lần trong danh sách assignment. Nhờ filter "gỡ vị trí cũ" này,
  // hàm cũng TỰ ĐỘNG đúng cho việc kéo từ Ô SANG Ô (không chỉ từ hàng
  // chờ) — bug fix 2026-09-06: chỉ cần cho ô đã gán trở thành draggable
  // (xem template, :draggable + @dragstart trên .tran-phap-panel__cell),
  // không cần sửa gì ở đây.
  currentAssignments.value = [
    ...currentAssignments.value.filter(
      (a) => a.combatantId !== combatantId && !(a.row === row && a.column === column),
    ),
    { row, column, combatantId },
  ]
}

// Bug fix (2026-09-06, user report "chỉ gắn vào chứ không tháo được ra") —
// onDrop() trước đây chỉ có nhánh GÁN, không có cách nào gỡ 1 combatant
// khỏi ô đã chiếm. Gỡ = filter theo combatantId, quân tự quay lại hàng chờ
// combatantCards() (không cần state riêng, danh sách đó vốn đã suy ra từ
// phần bù của currentAssignments).
function removeAssignment(combatantId: string) {
  currentAssignments.value = currentAssignments.value.filter((a) => a.combatantId !== combatantId)
}

// Bug fix (2026-09-06, user report "không thấy các nhân vật phụ test ở
// đâu") — 5 companion test tồn tại trong COMPANIONS nhưng KHÔNG tự động
// thuộc về player nào (chưa có UI gacha thật để tự pull) nên hàng chờ của
// panel này luôn rỗng phần companion. Nút TEST-ONLY này cấp thẳng những
// companion còn thiếu vào player.companions — chỉ để test Hỗn Độn Trận,
// sẽ bỏ cùng lúc với TEST_COMPANIONS khi có roster/gacha thật.
const hasUngrantedTestCompanions = computed(() => {
  stateVersion.value

  const owned = new Set(player.companions.map((instance) => instance.definitionId))

  return TEST_COMPANIONS.some((definition) => !owned.has(definition.id))
})

function grantTestCompanions() {
  const owned = new Set(player.companions.map((instance) => instance.definitionId))

  for (const definition of TEST_COMPANIONS) {
    if (!owned.has(definition.id)) {
      player.companions.push({ definitionId: definition.id, level: 1, exp: 0 })
    }
  }

  bumpState()
}

function onConfirm() {
  if (!selectedFormation.value) {
    return
  }

  player.formationLoadout = {
    formationId: selectedFormation.value.id,
    assignments: currentAssignments.value,
  }

  bumpState()
}

function close() {
  ui.closeHomeOverlays()
}

// --- Hỗn Độn Trận visual test tooling (2026-09-06) --------------------
// Lớp hiển thị Phaser (TranPhapPreviewScene, Task 4) vẽ NGAY BÊN DƯỚI
// lưới CSS/overlay kéo-thả ở trên — thuần hiển thị (sprite animate tại
// từng ô đã gán), KHÔNG phải drop target. Overlay HTML phía trên vẫn là
// nơi nhận @dragover/@drop thật, giữ nguyên 100% logic đã có.
const previewContainerRef = ref<HTMLDivElement | null>(null)

let previewGame: Phaser.Game | null = null
let previewScene: TranPhapCombatPreviewScene | null = null

// Bootstrap Phaser CHỈ khi panel thật sự mở — container ref (bên trong
// slot của OverlayPanel) chỉ tồn tại trong DOM lúc `open`, nên onMounted
// của CHÍNH component này (chạy 1 lần lúc GameRoot boot) không đủ — phải
// theo dõi bằng watch() điều kiện panel mở/đóng.
watch(
  () => ui.standalonePanel === 'tran_phap',
  async (isOpen) => {
    if (isOpen) {
      const container = previewContainerRef.value

      if (!container) {
        return
      }

      const [{ default: Phaser }, { TranPhapCombatPreviewScene: TranPhapCombatPreviewSceneClass }] = await Promise.all([
        import('phaser'),
        import('@/game/scenes/TranPhapCombatPreviewScene'),
      ])

      // Panel có thể đã đóng lại trong lúc 2 dynamic import trên đang
      // chạy (đóng rất nhanh) — kiểm tra lại trước khi tạo Game để
      // tránh Game mồ côi không ai destroy.
      if (ui.standalonePanel !== 'tran_phap' || !previewContainerRef.value) {
        return
      }

      previewGame = new Phaser.Game({
        type: Phaser.AUTO,
        parent: previewContainerRef.value,
        width: FORMATION_CANVAS_WIDTH,
        height: FORMATION_CANVAS_HEIGHT,
        transparent: true,
        // Crash fix (standing-slot plan Task 6, 2026-09-07) — missing
        // physics config made the Phaser.Game bootstrap crash when dropping
        // a unit into the panel (CombatGridView/sprite pipeline touches the
        // physics world via this.physics). Mirrors PhaserCanvas.vue's
        // real-combat bootstrap exactly: arcade, gravity 0, debug false.
        physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
        scene: [TranPhapCombatPreviewSceneClass],
      })

      previewGame.events.once('ready', () => {
        previewScene = (previewGame?.scene.getScene('TranPhapCombatPreviewScene') as TranPhapCombatPreviewScene | undefined) ?? null
        previewScene?.syncAssignments(currentAssignments.value)
      })
    } else {
      previewGame?.destroy(true)
      previewGame = null
      previewScene = null
    }
  },
  { flush: 'post' },
)

// Đồng bộ sprite mỗi khi assignment đổi (kéo-thả) trong lúc panel đang mở.
watch(currentAssignments, (assignments) => {
  previewScene?.syncAssignments(assignments)
})

// An toàn phòng trường hợp panel đang mở mà GameRoot bị unmount (watch
// ở trên chỉ destroy khi panel ĐÓNG, không chạy khi component biến mất).
onUnmounted(() => {
  previewGame?.destroy(true)
  previewGame = null
  previewScene = null
})
</script>

<template>
  <OverlayPanel :open="ui.standalonePanel === 'tran_phap'" :title="t('panels.tranPhap.title')" width="min(1000px, 94vw)" height="min(680px, 88vh)" @close="close">
    <div class="tran-phap-panel">
      <div class="tran-phap-panel__body">
        <div class="tran-phap-panel__grid-stack" :style="stackStyle">
          <div ref="previewContainerRef" class="tran-phap-panel__preview-canvas"></div>

          <div class="tran-phap-panel__grid tran-phap-panel__grid--overlay">
            <template v-for="row in STANDING_SLOT_COUNT" :key="row">
              <div
                v-for="column in STANDING_SLOT_COUNT"
                :key="`${row}-${column}`"
                :class="['tran-phap-panel__cell', `tran-phap-panel__cell--${slotStateAt(row - 1, column - 1)}`]"
                :style="slotStyle(row - 1, column - 1)"
                :draggable="!!assignmentAt(row - 1, column - 1)"
                @dragstart="(event) => { const occupant = assignmentAt(row - 1, column - 1); if (occupant) (event as DragEvent).dataTransfer?.setData('text/plain', occupant.combatantId) }"
                @dragenter="hoveredCell = { row: row - 1, column: column - 1 }"
                @dragleave="() => { if (hoveredCell?.row === row - 1 && hoveredCell?.column === column - 1) hoveredCell = null }"
                @dragover.prevent
                @drop="(event) => { onDrop(row - 1, column - 1, (event as DragEvent).dataTransfer?.getData('text/plain') ?? ''); hoveredCell = null }"
                @click="() => { const occupant = assignmentAt(row - 1, column - 1); if (occupant) removeAssignment(occupant.combatantId) }"
              >
                {{ assignmentAt(row - 1, column - 1)?.combatantId ?? '' }}
              </div>
            </template>
          </div>
        </div>

        <div class="tran-phap-panel__formation-list">
          <button
            v-for="formation in TRAN_PHAP_FORMATIONS"
            :key="formation.id"
            type="button"
            class="tran-phap-panel__formation-button"
            :class="{ 'is-selected': formation.id === selectedFormationId }"
            @click="onSelectFormation(formation)"
          >
            {{ formation.name }}
          </button>
        </div>
      </div>

      <button
        v-if="hasUngrantedTestCompanions"
        type="button"
        class="tran-phap-panel__grant-test"
        @click="grantTestCompanions"
      >
        {{ t('panels.tranPhap.grantTest') }}
      </button>

      <div
        class="tran-phap-panel__queue"
        @dragover.prevent
        @drop="(event) => removeAssignment((event as DragEvent).dataTransfer?.getData('text/plain') ?? '')"
      >
        <div
          v-for="card in combatantCards()"
          :key="card.combatantId"
          draggable="true"
          class="tran-phap-panel__card"
          @dragstart="(event) => (event as DragEvent).dataTransfer?.setData('text/plain', card.combatantId)"
        >
          {{ card.label }}
        </div>
      </div>

      <button type="button" class="tran-phap-panel__confirm" :disabled="!selectedFormation" @click="onConfirm">
        {{ t('panels.tranPhap.confirm') }}
      </button>
    </div>
  </OverlayPanel>
</template>

<style scoped>
.tran-phap-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

.tran-phap-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  gap: var(--space-4, 16px);
}

/* V8 — the stack now declares the canvas's own size (FormationCanvasSpec).
   It used to have none, so an absolutely-positioned canvas left the overlay
   grid to size it: 176px, clipping ~85% of a 420x480 render. */
.tran-phap-panel__grid-stack {
  position: relative;
  flex: 0 0 auto;
}

.tran-phap-panel__preview-canvas {
  position: absolute;
  inset: 0;
  z-index: 0;
  /* Canvas size: FormationCanvasSpec (presentation/geometry) — overlay grid
     3x3 lưới slot vẽ PHỦ lên trên. Canvas/overlay alignment VẪN LÀ khuyết tật
     đã biết: lưới DOM là ô vuông đều, canvas vẽ hình thang phối cảnh, và
     container này bị lưới overlay quy định kích thước nên phần lớn canvas bị
     cắt. Xem V8 trong
     docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md
     — có plan riêng, KHÔNG sửa ở đợt dời hằng số này. */
  overflow: hidden;
}

/* Overlay covers the canvas exactly; each cell is placed by the projection,
   so there is no CSS grid left to disagree with what Phaser drew. */
.tran-phap-panel__grid--overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.tran-phap-panel__cell {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs, 11px);
  /* No border: the canvas below already draws the grid lines
     (CombatGridView.redrawGridLines), and a rectangular border cannot follow a
     clipped trapezoid anyway. The overlay tints state; the canvas draws shape.
     clip-path also clips POINTER EVENTS, which is what makes the trapezoid the
     real hit area and lets the existing drag-and-drop handlers stay as they
     are. */
}

/* SlotState (Battlefield Slot spec, 2026-09-06) — 'locked' giữ đúng look
   mờ cũ (--lit trước đây = false); 'enabled'/'occupied' giữ đúng look
   sáng cũ (--lit trước đây = true); 'hover' thêm viền nhấn khi đang kéo
   một quân TỚI ô này (chỉ hiện trên ô enabled, chưa có ai chiếm — xem
   slotStateAt()'s thứ tự ưu tiên locked > occupied > hover > enabled). */
/* V8 — state is carried by a BACKGROUND FILL, not a border.
   clip-path clips the background to the trapezoid exactly, giving a crisp
   projected cell; a border traces the element's rectangle and a box-shadow
   traces its border box, so neither can follow the clip. The four states keep
   their original meanings and their original jade hue — only the property
   carrying them changed. */
.tran-phap-panel__cell--locked {
  opacity: 0.35;
}

.tran-phap-panel__cell--enabled {
  opacity: 1;
  background: rgba(76, 175, 80, 0.1);
}

/* Standing-slot plan Task 6 (2026-09-07) — occupied SPLIT from enabled, so
   "empty tappable cell" reads differently from "cell already occupied" by
   colour and not only by the combatant id text inside. */
.tran-phap-panel__cell--occupied {
  opacity: 1;
  background: rgba(76, 175, 80, 0.28);
}

.tran-phap-panel__cell--hover {
  opacity: 1;
  background: rgba(76, 175, 80, 0.45);
}

.tran-phap-panel__formation-list {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.tran-phap-panel__formation-button {
  padding: var(--space-2, 8px);
  border: 1px solid var(--surface-line);
  background: transparent;
  color: var(--surface-text);
  text-align: left;
  cursor: pointer;
}

.tran-phap-panel__formation-button.is-selected {
  border-color: var(--jade, #4caf50);
}

.tran-phap-panel__queue {
  flex: 0 0 auto;
  display: flex;
  gap: var(--space-2, 8px);
  flex-wrap: wrap;
}

.tran-phap-panel__card {
  cursor: grab;
  padding: var(--space-2, 8px);
  border: 1px solid var(--surface-line);
}

.tran-phap-panel__confirm {
  flex: 0 0 auto;
  align-self: flex-end;
  padding: var(--space-2, 8px) var(--space-4, 16px);
  border: 1px solid var(--surface-line);
  background: transparent;
  color: var(--surface-text);
  cursor: pointer;
}

.tran-phap-panel__confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Nút TEST-ONLY (bug fix 2026-09-06) — cấp 5 companion test thẳng vào
   player.companions, tô màu cảnh báo để không lẫn với nút Lưu Trận Pháp
   thật. */
.tran-phap-panel__grant-test {
  align-self: flex-start;
  padding: var(--space-1, 4px) var(--space-3, 12px);
  border: 1px dashed var(--jade, #4caf50);
  background: transparent;
  color: var(--jade, #4caf50);
  font-size: var(--text-xs, 11px);
  cursor: pointer;
}
</style>
