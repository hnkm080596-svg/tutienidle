<script setup lang="ts">
// Trận Pháp panel (Combat Art Roster spec, 2026-09-05) — kéo-thả gán
// player/companion vào lưới 3x3 STANDING SLOT (local slot indices 0-2,
// luôn cố định bất kể vùng chiến trường tuyệt đối) của trận pháp đang
// chọn. Standing-slot rework (2026-09-07): grid size đọc STANDING_SLOT_COUNT
// dùng chung thay PREVIEW_GRID_SIZE local; grid resolution khớp CHÍNH XÁC
// với canvas Phaser phía dưới (cùng nguồn 1 hằng số).
// Việc map slot cục bộ sang PLAYER_SIDE_REGION tuyệt đối diễn ra ở
// FormationPlacement.localCellToAbsolute() lúc build trận — panel này
// CHỈ đọc/ghi PlayerData.formationLoadout, không đụng gì tới hệ toạ độ
// chiến trường thật.
//
// Gating dùng ui.standalonePanel (KHÔNG phải player.standalonePanel —
// flag đó không tồn tại), cùng pattern OverlayPanel như mọi panel
// standalone khác (SkillPathPanel.vue, ArtifactPanel.vue...). Mở qua
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
// Battlefield Perspective Panel (2026-09-06) — canvas Phaser 420x480 (lớn
// hơn lưới thuần để có không gian thể hiện chiều sâu phối cảnh, xem spec
// §3). Panel canvas KHÔNG đổi kích thước trong standing-slot rework —
// chỉ số ô lưới giảm 6x6 → 3x3 (cùng canvas, ô to hơn).
const PANEL_CANVAS_WIDTH = 420
const PANEL_CANVAS_HEIGHT = 480
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
        width: PANEL_CANVAS_WIDTH,
        height: PANEL_CANVAS_HEIGHT,
        transparent: true,
        // Crash fix (standing-slot plan Task 6, 2026-09-07) — thiếu physics
        // config khiến Phaser.Game bootstrap crash khi drop 1 quân vào panel
        // (CombatGridView/sprite pipeline đụng physics world truy cập qua
        // this.physics). Khớp CHÍNH XÁC bootstrap của PhaserCanvas.vue (combat
        // thật): arcade, gravity 0, debug false.
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
        <div class="tran-phap-panel__grid-stack">
          <div ref="previewContainerRef" class="tran-phap-panel__preview-canvas"></div>

          <div class="tran-phap-panel__grid tran-phap-panel__grid--overlay">
            <div v-for="row in STANDING_SLOT_COUNT" :key="row" class="tran-phap-panel__row">
              <div
                v-for="column in STANDING_SLOT_COUNT"
                :key="column"
                :class="['tran-phap-panel__cell', `tran-phap-panel__cell--${slotStateAt(row - 1, column - 1)}`]"
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
            </div>
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

.tran-phap-panel__grid-stack {
  position: relative;
}

.tran-phap-panel__preview-canvas {
  position: absolute;
  inset: 0;
  z-index: 0;
  /* Canvas Phaser 420x480 (PANEL_CANVAS_* ở trên) — overlay grid 3x3 lưới
     slot vẽ PHỦ lên trên; canvas/overlay alignment là known limitation
     (spec Part 2 Non-Goals, needs its own future plan). */
  overflow: hidden;
}

.tran-phap-panel__grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tran-phap-panel__grid--overlay {
  position: relative;
  z-index: 1;
  /* Ô vẫn giữ background/border cũ để vẫn thấy rõ vùng lit khi kéo-thả —
     Phaser canvas vẽ NGAY BÊN DƯỚI, không che overlay tương tác. */
}

.tran-phap-panel__row {
  display: flex;
  gap: 4px;
}

.tran-phap-panel__cell {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--surface-line);
  font-size: var(--text-xs, 11px);
}

/* SlotState (Battlefield Slot spec, 2026-09-06) — 'locked' giữ đúng look
   mờ cũ (--lit trước đây = false); 'enabled'/'occupied' giữ đúng look
   sáng cũ (--lit trước đây = true); 'hover' thêm viền nhấn khi đang kéo
   một quân TỚI ô này (chỉ hiện trên ô enabled, chưa có ai chiếm — xem
   slotStateAt()'s thứ tự ưu tiên locked > occupied > hover > enabled). */
.tran-phap-panel__cell--locked {
  opacity: 0.35;
}

.tran-phap-panel__cell--enabled {
  opacity: 1;
  border-color: var(--jade, #4caf50);
}

/* Standing-slot plan Task 6 (2026-09-07) — occupied TÁCH khỏi enabled:
   cùng viền xanh nhưng thêm nền xanh nhạt để phân biệt "ô trống bấm được"
   với "ô đã có quân" bằng màu (không chỉ bằng text id bên trong). */
.tran-phap-panel__cell--occupied {
  opacity: 1;
  border-color: var(--jade, #4caf50);
  background: rgba(76, 175, 80, 0.22);
}

.tran-phap-panel__cell--hover {
  opacity: 1;
  border-color: var(--jade, #4caf50);
  box-shadow: 0 0 0 2px var(--jade, #4caf50) inset;
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
