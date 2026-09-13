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
// panel never touches the real battlefield coordinate system.
// F4 (architecture-qa-repairs): the draft is committed through the
// validating owner gameManager.turnBattleOps.setFormationLoadout() instead
// of writing player.formationLoadout directly, and a watch on
// player.formationLoadout keeps the draft from going stale against
// external writes (save restore, other writers).
//
// Gating uses ui.standalonePanel (NOT player.standalonePanel - that flag
// does not exist), same OverlayPanel pattern as every other standalone
// panel (SkillPathPanel.vue, ArtifactPanel.vue...). Opened via the
// command wheel slot 'formation_slot' (game/support/commandWheelCatalog.ts).
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { TRAN_PHAP_FORMATIONS } from '@/data/formation/TranPhap'
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
import { useDynamicRegion } from '@/presentation/host/useDynamicRegion'
import { FORMATION_ASSIGNMENTS_EVENT } from '@/presentation/contracts/regionEvents'
import type { SlotState } from '@/presentation/contracts/SlotState'

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const { t } = useI18n()

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
  const style = formationSlotStyle(slotBridge, row, column, {
    width: FORMATION_CANVAS_WIDTH,
    height: FORMATION_CANVAS_HEIGHT,
  })

  // The hover beam's ::before cannot read the element's own clip-path, so the
  // same polygon is re-published as an inheritable custom property.
  style['--slot-clip'] = style.clipPath!

  return style
}

// The stack keeps the canvas's aspect ratio and shrinks to whatever height the
// panel can spare. The overlay is expressed in percent, so it follows exactly.
const stackStyle = {
  aspectRatio: `${FORMATION_CANVAS_WIDTH} / ${FORMATION_CANVAS_HEIGHT}`,
  maxWidth: `${FORMATION_CANVAS_WIDTH}px`,
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

// Re-seed the local draft from the committed loadout. Copies each
// assignment so the draft never shares references with player state
// (before this, the draft ref held the store's array directly).
function syncDraftFromLoadout() {
  const loadout = player.formationLoadout

  selectedFormationId.value = loadout?.formationId ?? null
  currentAssignments.value = loadout?.assignments.map((a) => ({ ...a })) ?? []
}

function onConfirm() {
  if (!selectedFormation.value) {
    return
  }

  // F4 - the commit goes through the validating owner. A stale draft (e.g.
  // a companion released while the panel was open) is rejected and the
  // draft resyncs to whatever is actually committed.
  const committed = gameManager.turnBattleOps.setFormationLoadout(player.$state, {
    formationId: selectedFormation.value.id,
    assignments: currentAssignments.value,
  })

  if (!committed) {
    syncDraftFromLoadout()
    return
  }

  bumpState()
}

function close() {
  ui.closeHomeOverlays()
}

// --- Formation combat preview tooling (2026-09-06) --------------------
// Lớp hiển thị Phaser (TranPhapPreviewScene, Task 4) vẽ NGAY BÊN DƯỚI
// lưới CSS/overlay kéo-thả ở trên — thuần hiển thị (sprite animate tại
// từng ô đã gán), KHÔNG phải drop target. Overlay HTML phía trên vẫn là
// nơi nhận @dragover/@drop thật, giữ nguyên 100% logic đã có.
const previewContainerRef = ref<HTMLDivElement | null>(null)

// V4/V10 — the hosting mechanics (dynamic import, construction, teardown
// ordering, the close-during-boot race, the local error boundary) belong to
// useDynamicRegion, not to this panel; and this panel no longer holds the
// scene. It holds a region handle and sends it one named event (§3.6).
const previewRegion = useDynamicRegion({
  container: previewContainerRef,

  // Fixed size, so no ResizeObserver: the preview canvas is exactly the size
  // FormationCanvasSpec declares, and the CSS scales it to fit the panel.
  size: { width: FORMATION_CANVAS_WIDTH, height: FORMATION_CANVAS_HEIGHT },

  config: {
    transparent: true,
    // Crash fix (standing-slot plan Task 6, 2026-09-07) — missing physics
    // config made the bootstrap crash when dropping a unit into the panel
    // (CombatGridView/sprite pipeline touches the physics world). Mirrors
    // PhaserCanvas.vue's real-combat bootstrap exactly.
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  },

  load: async () => {
    const [{ default: Phaser }, { TranPhapCombatPreviewScene }] = await Promise.all([
      import('phaser'),
      import('@/game/scenes/TranPhapCombatPreviewScene'),
    ])

    return { Phaser, scenes: [TranPhapCombatPreviewScene] }
  },

  onReady: () => {
    previewRegion.dispatch(FORMATION_ASSIGNMENTS_EVENT, currentAssignments.value)
  },
})

// F4 - external writes (save restore, another writer) replace
// formationLoadout wholesale; resync the draft so it cannot go stale.
watch(
  () => player.formationLoadout,
  () => syncDraftFromLoadout(),
)

// Bootstrap only while the panel is actually open — the container ref lives
// inside OverlayPanel's slot, so it exists in the DOM only then.
//
// GameRoot mounts this component LAZILY on first open (mountedStandalone +
// defineAsyncComponent), so by the time setup runs, standalonePanel is
// already 'tran_phap' and the watch below never sees a false->true edge for
// that first open. onMounted therefore performs the first open's work: the
// ref is bound by then because OverlayPanel renders its slot with open
// already true.
onMounted(() => {
  syncDraftFromLoadout()
  previewRegion.start()
})

watch(
  () => ui.standalonePanel === 'tran_phap',
  (isOpen) => {
    if (isOpen) {
      syncDraftFromLoadout()
      previewRegion.start()
    } else {
      previewRegion.destroy()
    }
  },
  { flush: 'post' },
)

// Keep sprites in step with drag-and-drop while the panel is open.
watch(currentAssignments, (assignments) => {
  previewRegion.dispatch(FORMATION_ASSIGNMENTS_EVENT, assignments)
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
  overflow-y: auto;
}

/* V8 — the body sizes to its content instead of being squeezed.
   It used to be `flex: 1 1 auto; min-height: 0`, which was harmless while the
   grid stack was 176px tall: nothing ever hit the limit. With the stack at the
   canvas's real 480px, a shrunken body let it overflow and cover the roster
   queue below. The panel scrolls if a short viewport cannot fit everything,
   rather than silently overlapping. */
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
  flex: 0 1 auto;
  min-height: 0;
  height: 100%;
}

.tran-phap-panel__preview-canvas {
  position: absolute;
  inset: 0;
  /* The Phaser canvas renders at its declared backing size and is CSS-scaled
     to whatever the stack can spare. The overlay is in percent, so it scales
     with it rather than beside it. */
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

.tran-phap-panel__preview-canvas :deep(canvas),
.tran-phap-panel__preview-canvas canvas {
  width: 100% !important;
  height: 100% !important;
  display: block;
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

/* Border beam (2026-09-14): two azure spots orbiting the slot edge on hover.
   The cells are clip-path trapezoids, so a rectangular border/mask trick
   cannot follow them — instead ::before paints a rotating two-wedge conic
   gradient clipped to the SAME polygon (via the inherited --slot-clip var),
   and ::after re-covers the interior on a slightly smaller box, leaving only
   a ring along the trapezoid's edge. Hover only applies to empty enabled
   slots (slotStateAt priority), so the ::after fill never hides an occupant
   label. Without @property support the gradient holds a static two-spot glow
   instead of spinning — a graceful degrade, not a break. */
@property --tran-phap-beam-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.tran-phap-panel__cell--hover::before {
  content: '';
  position: absolute;
  inset: 0;
  clip-path: var(--slot-clip);
  background: conic-gradient(
    from var(--tran-phap-beam-angle),
    transparent 0%,
    var(--azure, #5b9bd5) 7%,
    transparent 14%,
    transparent 50%,
    var(--azure, #5b9bd5) 57%,
    transparent 64%
  );
  animation: tran-phap-beam-spin 2.4s linear infinite;
}

.tran-phap-panel__cell--hover::after {
  content: '';
  position: absolute;
  inset: 7%;
  clip-path: var(--slot-clip);
  background: rgba(76, 175, 80, 0.45);
}

@keyframes tran-phap-beam-spin {
  to {
    --tran-phap-beam-angle: 1turn;
  }
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
</style>
