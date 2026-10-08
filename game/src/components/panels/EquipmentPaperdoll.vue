<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from '../common/SlotView.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { usePlayerStore } from '@/stores/player'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { gradeLabel } from '@/core/presentation/labels'
import {
  animatedArtFormFor,
  resolvePlayerEntityKey,
} from '@/presentation/art/CombatPresentationCatalogue'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import EntitySpriteCanvas from '../common/EntitySpriteCanvas.vue'
import { itemQualityRank, professionGradeRank } from '@/core/profession/slotRank'
import type { EquipmentTooltipContent } from '@/composables/useTooltip'
import type { NameSegment } from '@/core/item/NameSegment'
import type { SlotBadge } from '@/components/common/SlotTypes'
import { useAudioStore } from '@/stores/audio'
import { stableSceneArtUrl } from '@/presentation/huyenKim/StableSceneArt'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

// equipment-paperdoll-base (stable art): neutral mannequin substrate under
// the six runtime sockets - no gameplay identity, decorative alignment
// only. Runtime keeps item/socket/rarity ownership.
const PAPERDOLL_BASE_SRC = stableSceneArtUrl('equipment-paperdoll-base', '@2x')
// Codex home-equipment preview spec (ui-landscape-design Trang Bi):
// circular sockets ringed by equipment-circle-frame-v1 flanking the big
// brush circle the idle figure stands inside.
const CIRCLE_FRAME_SRC = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/equipment-circle-frame-v1.png')
const BRUSH_CIRCLE_SRC = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/equipment-brush-circle-v1.png')


const { t } = useI18n()
const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()
const { unequip } = useEquipmentActions()

// Scene 12 scaffold: the item-card detail view wants the clicked
// instance; the unequip mutation below stays the slot's behavior.
const emit = defineEmits<{ select: [instanceId: string] }>()

// Two socket columns x three rows around the brush-ring figure (Codex
// home-equipment preview layout): left Vu Khi / Ao Giap / Giay, right
// Dau / Trang Suc / Nhan.
// Slot labels go through i18n (panels.bag.paperdoll.slots.*) - P16.
const SLOT_COLUMNS: readonly (readonly EquipmentSlot[])[] = [
  ['weapon', 'armor', 'boots'],
  ['helmet', 'necklace', 'ring'],
]
const SLOT_SLOTS = SLOT_COLUMNS.flat()

const equippedBySlot = computed<Record<EquipmentSlot, EquipmentInstance | undefined>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, EquipmentInstance | undefined>

  for (const slot of SLOT_SLOTS) {
    result[slot] = gameManager.equipmentBag.getEquippedInSlot(slot)
  }

  return result
})

// MASTER SPEC Muc XVI (Phase 9) - enhanceLevel gio thuoc SLOT, hien
// duoc NGAY CA KHI slot dang trong (doi/thao trang bi khong mat cap
// da cuong hoa) - minh chung truc quan cho tach Item/Slot.
const enhanceLevelBySlot = computed<Record<EquipmentSlot, number>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, number>

  for (const slot of SLOT_SLOTS) {
    result[slot] = gameManager.equipmentOps.getSlotState(slot).enhanceLevel
  }

  return result
})

// Minh ruling: the doll center plays the player's dao-path idle clip
// (same animated set combat resolves) instead of the static mannequin -
// the mannequin stays only as the no-art fallback.
const idleProfile = computed(
  () => PLAYER_VISUAL_PROFILES[player.visualProfileId] ?? PLAYER_VISUAL_PROFILES.mortal,
)
const idleClip = computed(
  () =>
    animatedArtFormFor(
      resolvePlayerEntityKey(idleProfile.value.id, idleProfile.value.combatTextureKey, {
        armed: player.visualArmed,
      }),
    )?.idle,
)

// Audit fix 2026-08-31 - equipmentRegistry.get() THROW voi itemId la
// (data edit/save lech) tung chet ca khoi trang bi qua ErrorBoundary;
// getEquipmentTemplate() tra an toan tra undefined (GameManager.ts) +
// fallback hien thi itemId tho (pattern Task 13 EquipmentBagSection).
function itemName(instance: EquipmentInstance): string {
  return gameManager.equipmentOps.getEquipmentTemplate(instance.itemId)?.name ?? instance.itemId
}

// spec section 5b - aria includes the Pham word (the seal is a
// decorative glyph; screen readers get the grade via this label).
function itemAccessibleLabel(instance: EquipmentInstance): string {
  return `${itemName(instance)}, ${gradeLabel(instance.grade)}`
}

function itemDescription(instance: EquipmentInstance): string | undefined {
  return gameManager.equipmentOps.getEquipmentTemplate(instance.itemId)?.description
}

function itemIcon(instance: EquipmentInstance): string | undefined {
  return instance.icon ?? gameManager.equipmentOps.getEquipmentTemplate(instance.itemId)?.icon
}

// Ten ghep dong (2026-08-15) - Pham * Set (neu co) * Dia Gioi+Ten goc,
// xem EquipmentNaming.ts. Chi slot DANG mac moi co (dong nhat voi
// tooltipBySlot ben duoi) - slot trong fallback ve `label` mac dinh
// cua SlotView.vue.
const nameSegmentsBySlot = computed<Record<EquipmentSlot, NameSegment[] | undefined>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, NameSegment[] | undefined>

  for (const slot of SLOT_SLOTS) {
    const instance = equippedBySlot.value[slot]

    // Audit fix 2026-08-31 - registry miss -> hien thi itemId tho thay vi
    // chet panel (composeEquipmentNameSegments doi template that).
    const template = instance ? gameManager.equipmentOps.getEquipmentTemplate(instance.itemId) : undefined

    result[slot] = instance
      ? template
        ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
        : [{ text: instance.itemId }]
      : undefined
  }

  return result
})

// Tooltip co cau truc (2026-08-15) - chi slot DANG mac moi co, slot
// trong fallback ve title/description don gian mac dinh cua
// SlotView.vue (tooltip undefined = dung lai hanh vi cu).
const tooltipBySlot = computed<Record<EquipmentSlot, EquipmentTooltipContent | undefined>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, EquipmentTooltipContent | undefined>

  for (const slot of SLOT_SLOTS) {
    const instance = equippedBySlot.value[slot]

    // Audit fix 2026-08-31 - registry miss -> khong tooltip (SlotView
    // tooltip optional), slot van hien thi, khong chet panel.
    const template = instance ? gameManager.equipmentOps.getEquipmentTemplate(instance.itemId) : undefined

    // G1 (Mission G Task 37) - the tooltip contract requires the
    // authoritative range quote; a miss = malformed item data, so the
    // tooltip drops (same "registry miss -> no tooltip" rule above).
    const mainStatRangeQuote = instance && template
      ? gameManager.equipmentSystem.quoteMainStatRange(instance, gameManager.equipmentRegistry)
      : undefined

    result[slot] = instance && template && mainStatRangeQuote
      ? buildEquipmentTooltip(
          instance,
          template,
          gameManager.affixRegistry,
          gameManager.equipmentOps.getSlotState(slot),
          gameManager.zoneRegistry,
          // No compare context (item-info-card spec section 4): the
          // paperdoll renders only EQUIPPED items - an equipped item IS
          // the compare counterpart, never a candidate for one.
          undefined,
          mainStatRangeQuote,
        )
      : undefined
  }

  return result
})

// Slot Revamp (muc 17.7 "Equipment paperdoll: empty/filled, enhance,
// formation/talisman marker") - Quality/Rarity rank + badge Cuong Hoa
// gio do SlotView tu ve CSS, thay `.paperdoll__enhance-badge` absolute-
// position ben ngoai slot cu.
const qualityRankBySlot = computed<Record<EquipmentSlot, number | undefined>>(() => {
  const result = {} as Record<EquipmentSlot, number | undefined>

  for (const slot of SLOT_SLOTS) {
    const instance = equippedBySlot.value[slot]

    result[slot] = instance ? professionGradeRank(instance.grade) : undefined
  }

  return result
})

const rarityRankBySlot = computed<Record<EquipmentSlot, number | undefined>>(() => {
  const result = {} as Record<EquipmentSlot, number | undefined>

  for (const slot of SLOT_SLOTS) {
    const instance = equippedBySlot.value[slot]

    result[slot] = instance ? itemQualityRank(instance.quality) : undefined
  }

  return result
})

const badgesBySlot = computed<Record<EquipmentSlot, SlotBadge[]>>(() => {
  const result = {} as Record<EquipmentSlot, SlotBadge[]>

  for (const slot of SLOT_SLOTS) {
    const level = enhanceLevelBySlot.value[slot]

    result[slot] = level > 0 ? [{ kind: 'enhance', text: `+${level}` }] : []
  }

  return result
})

function onSlotClick(instance: EquipmentInstance | undefined) {
  if (instance) {
    emit('select', instance.instanceId)
    useAudioStore().cue('ui.equip')
    unequip(instance.instanceId)
  }
}
</script>

<template>
  <div class="paperdoll">
    <img class="paperdoll__ring" :src="BRUSH_CIRCLE_SRC" alt="" aria-hidden="true" />
    <div v-if="idleClip" class="paperdoll__figure" aria-hidden="true">
      <EntitySpriteCanvas
        :sheet-url="resolveAssetUrl(`/${idleClip.sheetUrl}`)"
        :atlas-url="resolveAssetUrl(`/${idleClip.atlasUrl}`)"
        :frame-prefix="idleClip.framePrefix"
        :frame-suffix="idleClip.frameSuffix"
        :zero-pad="idleClip.zeroPad"
        :first-frame="idleClip.firstFrame"
        :last-frame="idleClip.lastFrame"
        :fps="idleClip.frameRate ?? 8"
        height="100%"
      />
    </div>
    <img v-else class="paperdoll__base" :src="PAPERDOLL_BASE_SRC" alt="" aria-hidden="true" />
    <div
      v-for="(slot, index) in SLOT_SLOTS"
      :key="slot"
      class="paperdoll__cell"
      :class="{ 'paperdoll__cell--right': index > 2 }"
      :style="{ top: `${(index % 3) * 33.33}%` }"
    >
      <div class="paperdoll__slot-wrap">
        <img class="paperdoll__frame" :src="CIRCLE_FRAME_SRC" alt="" aria-hidden="true" />
        <SlotView
          class="paperdoll__slot"
          variant="bag"
          :item="equippedBySlot[slot] ?? null"
          :label="equippedBySlot[slot] ? itemName(equippedBySlot[slot]!) : t(`panels.bag.paperdoll.slots.${slot}`)"
          :accessible-label="equippedBySlot[slot] ? itemAccessibleLabel(equippedBySlot[slot]!) : undefined"
          :name-segments="nameSegmentsBySlot[slot]"
          :description="
            equippedBySlot[slot] ? itemDescription(equippedBySlot[slot]!) : undefined
          "
          :equipment-quality-rank="qualityRankBySlot[slot]"
          :rarity-rank="rarityRankBySlot[slot]"
          :badges="badgesBySlot[slot]"
          :tooltip="tooltipBySlot[slot]"
          :icon="equippedBySlot[slot] ? itemIcon(equippedBySlot[slot]!) : undefined"
          @click="onSlotClick(equippedBySlot[slot])"
        />
      </div>
      <span class="paperdoll__label">{{ t(`panels.bag.paperdoll.slots.${slot}`) }}</span>
    </div>
  </div>
</template>

<style scoped>
.paperdoll {
  position: relative;
  /* Own stacking context so the negative-z base stays between the
     paperdoll background and the runtime socket cells. */
  isolation: isolate;
  height: 100%;
  font-family: var(--font-body);
}

/* Codex spec (EquipmentPaperdollPreview): sockets are absolute 91x33%
   units pinned to the stage edges, tops at 0/33.33/66.66%. */
.paperdoll__cell {
  position: absolute;
  left: 0;
  width: 91px;
  height: 33%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 1px;
}
.paperdoll__cell--right {
  left: auto;
  right: 0;
}


/* Neutral mannequin substrate (stable art): centered behind the socket
   grid; sockets keep full interaction above it. */
.paperdoll__base {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  /* Substrate must paint under the static grid cells - positioned
     elements at z:auto would otherwise cover the runtime sockets. */
  z-index: -1;
  height: 92%;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  opacity: 0.55;
  pointer-events: none;
}

/* Player idle figure: the dao-path animated character stands in the same
   centered zone the mannequin occupied, feet resting near the column
   bottom. Paints under the socket cells like the substrate did. */
.paperdoll__figure {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(calc(-50% - 30px), -50%);
  z-index: -1;
  height: 96%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  pointer-events: none;
}

.paperdoll__figure canvas {
  max-width: 100%;
  object-fit: contain;
}

/* Codex preview socket (EquipmentPaperdollPreview + EquipmentArtSlot
   circular): the circle-frame PNG is an <img> at inset:0 object-fit
   contain - a true circle centered in the 88x80 unit, NOT a stretched
   background. The item icon occupies the ring's inset:20% / 60%x60%
   zone with no extra backdrop disc behind it. */
.paperdoll__slot-wrap {
  position: relative;
  flex: none;
  width: 88px;
  height: 80px;
}
.paperdoll__frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.paperdoll__slot-wrap:hover .paperdoll__frame {
  filter: brightness(1.65) drop-shadow(0 0 3px #ffd785) drop-shadow(0 0 7px #e9a935aa);
}
/* SlotView covers the whole 88x80 unit so its seal/badges anchor at
   the ring's corners like before; only its own chrome (border, dark
   backdrop disc, drawn frame) is suppressed - the preview has none. */
:is(#app) .paperdoll__slot-wrap .paperdoll__slot {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  /* tien-hiep-ui.css paints the square runtime slot-frame on .slot-view via
     :is(#app, body) - ID-level specificity (1,0,1) beats every scoped rule,
     including assignments to --slot-bg-image on the same element. Beat the
     ID with the same :is(#app) trick: (1,2,0) > (1,0,1). */
  --slot-bg-image: none;
  background-image: none;
  /* The bag variant's rarity/quality aura is a box-shadow painted around
     the square button bounds - reads as a square frame around the ring. */
  box-shadow: none;
}
.paperdoll__slot-wrap :deep(.slot-view__frame-art) {
  display: none;
}
/* Preview shows no square hover chrome around the ring - suppress the
   bag variant's hover-frame layer outright (it also overflows the wrap). */
.paperdoll__slot-wrap :deep(.slot-view__hover-frame) {
  display: none;
}
/* Preview sockets show no grade seal or enhance badge - pure ring+icon.
   (aria-label still carries the grade for screen readers.) */
.paperdoll__slot-wrap :deep(.slot-view__seal),
.paperdoll__slot-wrap :deep(.slot-view__badge) {
  display: none;
}
/* Icon zone = preview's EquipmentArtSlot circular spec (inset 20%,
   60%x60% of the unit). */
.paperdoll__slot-wrap :deep(.slot-view__icon-wrap) {
  inset: 20%;
}
.paperdoll__slot-wrap :deep(.slot-view__item-icon) {
  width: 100%;
  height: 100%;
}

.paperdoll__label {
  font-size: 13px;
  line-height: 1.15;
  font-weight: 700;
  color: #3a2a14;
  text-align: center;
}

/* Paperdoll slots use variant="bag" (owner ruling 2026-10-04): the 6
   worn slots join the dense Trang Bi cells - quality aura (rarityRank
   >= 3), the max-rank bar and the shared pale-gold hover frame still
   ride on top of the circle-frame art. */
.paperdoll__slot {
  border-radius: 50%;
}

/* Big gold brush circle the figure stands inside (preview ornament). */
.paperdoll__ring {
  position: absolute;
  left: 14%;
  top: 4%;
  width: 72%;
  height: 91%;
  object-fit: contain;
  opacity: 0.64;
  pointer-events: none;
  z-index: -2;
}
</style>
