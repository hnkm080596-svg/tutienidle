<script setup lang="ts" generic="T">
import { computed } from 'vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import { SLOT_ASSETS, QUALITY_FRAME_PATHS, PHAM_FRAME_PATHS, QUALITY_BACKDROP_PATHS } from '@/core/assets/AssetPaths'
import type { TooltipContent } from '@/composables/useTooltip'
import type { NameSegment } from '@/core/item/NameSegment'

const props = defineProps<{
  /**
   * Item mà Slot đang chứa.
   *
   * null = slot trống.
   */
  item: T | null

  /**
   * Tên hiển thị.
   */
  label?: string

  /**
   * Số lượng.
   */
  amount?: number

  /**
   * Trạng thái highlight.
   */
  highlight?: 'none' | 'ok' | 'missing'

  /**
   * Slot đang được chọn.
   */
  selected?: boolean

  /**
   * Tooltip description.
   */
  description?: string

  /**
   * Equipment Quality.
   */
  rarity?: string

  /**
   * Item Rarity.
   */
  itemRarity?: string

  /**
   * Icon riêng của item.
   *
   * Không có itemIcon = Slot chỉ hiển thị backdrop/frame.
   */
  itemIcon?: string

  /**
   * Tooltip có cấu trúc (ảnh + nhiều khối chỉ số) — ưu tiên HƠN
   * label/description phía trên nếu có truyền vào. Không truyền =
   * dùng lại tooltip title/description đơn giản như cũ.
   */
  tooltip?: TooltipContent

  /**
   * Tên ghép động, nhiều đoạn tô màu riêng (Phẩm/Set/Địa Giới, xem
   * core/equipment/EquipmentNaming.ts) — ưu tiên HƠN `label` (chuỗi
   * đơn) nếu có truyền vào, cách nhau dấu "·" lúc render.
   */
  nameSegments?: NameSegment[]
}>()

defineEmits<{
  click: []
}>()

/**
 * Fallback tạm thời khi item chưa có icon.
 */
function monogram(label?: string): string {
  return label?.trim().charAt(0).toUpperCase() ?? ''
}

/**
 * Khung viền theo 9 bậc Quality (`rarity` prop — pham_khi..thien_dia_
 * trong_khi) — KHÔNG khớp bậc nào (vd rarity="breakthrough" của
 * TechniqueSlotCard.vue) thì rơi về khung DÙNG CHUNG (SLOT_ASSETS.frame),
 * y hệt hành vi cũ.
 */
const frameSrc = computed(() => (props.rarity && QUALITY_FRAME_PATHS[props.rarity]) || SLOT_ASSETS.frame)

/**
 * Khung ô vuông theo 5 bậc Rarity/Phẩm (`itemRarity` prop) — thay cho
 * chấm tròn CSS cũ. undefined = không hiện gì (item không phân Phẩm,
 * vd material/pill).
 */
const phamBadgeSrc = computed(() => (props.itemRarity ? PHAM_FRAME_PATHS[props.itemRarity] : undefined))

/**
 * Lớp backdrop MÀU RIÊNG theo 9 bậc Quality (2026-08-15) — nhấn thêm
 * tín hiệu song song với frameSrc, KHÔNG khớp bậc nào (item không
 * phân Quality) thì không hiện gì.
 */
const qualityBackdropSrc = computed(() => (props.rarity ? QUALITY_BACKDROP_PATHS[props.rarity] : undefined))
</script>

<template>
  <button type="button" class="slot-view" :class="[
    item ? 'slot-view--filled' : 'slot-view--empty',
    highlight ? `slot-view--${highlight}` : '',
    selected ? 'slot-view--selected' : '',
  ]" :style="{
    '--slot-rarity-color': rarity
      ? `var(--rarity-${rarity})`
      : undefined,
  }" v-tooltip="tooltip ?? (label || description
    ? {
      title: label,
      description,
    }
    : undefined)
    " @click="$emit('click')">

    <img class="slot-view__backdrop" :src="SLOT_ASSETS.backdrop" alt="" aria-hidden="true" />

    <!-- Backdrop màu theo 9 bậc Quality (2026-08-15) — layer bổ sung
         song song với frame, xem qualityBackdropSrc. -->
    <img v-if="qualityBackdropSrc" class="slot-view__quality-backdrop" :src="qualityBackdropSrc" alt="" aria-hidden="true" />

    <img v-if="item && itemIcon" class="slot-view__item-icon" :src="itemIcon" :alt="label || ''" />

    <!-- Khung viền theo 9 bậc Quality (`rarity` prop) — frameSrc tự
         rơi về SLOT_ASSETS.frame nếu rarity không khớp bậc nào. -->
    <img class="slot-view__frame" :src="frameSrc" alt="" aria-hidden="true" />

    <!-- Highlight khi hover — LUÔN dùng chung 1 ảnh (không phân theo
         bậc), CHỒNG LÊN TRÊN frame (không thay thế) để khung quality
         vẫn thấy được lúc đang hover. -->
    <img class="slot-view__hover-frame" :src="SLOT_ASSETS.hoverFrame" alt="" aria-hidden="true" />
    <!-- ======================================================
         SELECTED
         ====================================================== -->

    <span v-if="selected" class="slot-view__selected" aria-hidden="true" />

    <!-- ======================================================
         ITEM RARITY — ô vuông theo 5 bậc Phẩm (`itemRarity` prop),
         thay chấm tròn CSS cũ.
         ====================================================== -->

    <img v-if="phamBadgeSrc" class="slot-view__item-rarity-badge" :src="phamBadgeSrc" alt="" aria-hidden="true" />

    <!-- ======================================================
         AMOUNT
         ====================================================== -->

    <span v-if="amount !== undefined" class="slot-view__amount">
      x{{ formatNumber(amount) }}
    </span>

    <!-- ======================================================
         CAPTION
         ====================================================== -->

    <span v-if="nameSegments && nameSegments.length > 0" class="slot-view__caption">
      <template v-for="(segment, index) in nameSegments" :key="index">
        <span v-if="index > 0" class="slot-view__caption-dot"> · </span>
        <span :style="{ color: segment.colorVar ? `var(${segment.colorVar})` : undefined }">{{ segment.text }}</span>
      </template>
    </span>

    <span v-else-if="label" class="slot-view__caption">
      {{ label }}
    </span>

  </button>
</template>

<style scoped>
/* ============================================================
   BASE SLOT
   ============================================================ */

.slot-view {
  position: relative;

  display: flex;

  flex-direction: column;

  align-items: stretch;

  justify-content: flex-end;

  width: 100%;

  aspect-ratio: 1;

  padding: 0;

  border: 1px solid var(--slot-rarity-color, var(--ink-line));

  border-radius: var(--radius-sm);

  background: var(--ink-900);

  color: var(--text-primary);

  font-family: var(--font-body);

  font-size: 0.7rem;

  cursor: pointer;

  overflow: hidden;

  isolation: isolate;

  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}


/* ============================================================
   FILLED
   ============================================================ */

.slot-view--filled {
  box-shadow:
    0 0 8px var(--slot-rarity-color,
      transparent);
}


/* ============================================================
   EMPTY
   ============================================================ */

.slot-view--empty {
  border-style: dashed;

  border-color:
    var(--ink-line-soft);
}


/* ============================================================
   HIGHLIGHT
   ============================================================ */

.slot-view--ok {
  border-color: var(--jade);
}

.slot-view--missing {
  border-color: var(--crimson);
}


/* ============================================================
   ASSET LAYERS
   ============================================================ */

.slot-view__backdrop,
.slot-view__quality-backdrop,
.slot-view__item-icon,
.slot-view__frame,
.slot-view__hover-frame {
  position: absolute;

  inset: 0;

  width: 100%;

  height: 100%;

  pointer-events: none;

  user-select: none;
}


/* ============================================================
   BACKDROP
   ============================================================ */

.slot-view__backdrop {
  z-index: 0;

  object-fit: cover;
}


/* ============================================================
   QUALITY BACKDROP — lớp màu riêng theo 9 bậc Quality, giữa backdrop
   nền và item icon (song song với frame ở z-index 4).
   ============================================================ */

.slot-view__quality-backdrop {
  z-index: 1;

  object-fit: cover;
}


/* ============================================================
   ITEM ICON
   ============================================================ */

.slot-view__item-icon {
  z-index: 2;

  object-fit: contain;

  padding: 8%;
}


/* ============================================================
   FALLBACK MONOGRAM
   ============================================================ */

.slot-view__monogram {
  position: absolute;

  top: 43%;

  left: 50%;

  transform:
    translate(-50%, -50%);

  z-index: 2;

  display: flex;

  align-items: center;

  justify-content: center;

  width: 62%;

  aspect-ratio: 1;

  border-radius: 50%;

  background: var(--ink-700);

  color:
    var(--slot-rarity-color,
      var(--text-secondary));

  font-family: var(--font-display);

  font-weight: 600;

  font-size: 1.1rem;
}


/* ============================================================
   NORMAL FRAME
   ============================================================ */

.slot-view__frame {
  z-index: 4;

  object-fit: fill;

  opacity: 1;

  transition:
    opacity 0.12s ease;
}


/* ============================================================
   HOVER FRAME
   ============================================================ */

.slot-view__hover-frame {
  z-index: 5;

  object-fit: fill;

  opacity: 0;

  transition:
    opacity 0.12s ease;
}


/*
 * Hover: frame (khung theo Quality) GIỮ NGUYÊN, hover-frame chỉ chồng
 * thêm 1 lớp highlight lên trên — khác bản cũ (opacity swap, frame ẩn
 * hẳn lúc hover) vì giờ frame còn mang thông tin bậc Quality, ẩn đi
 * lúc hover sẽ mất tín hiệu đó đúng lúc người chơi đang nhìn kỹ nhất.
 */

.slot-view:hover .slot-view__hover-frame {
  opacity: 1;
}


/* ============================================================
   SELECTED
   ============================================================ */

.slot-view--selected {
  outline: 2px solid var(--gold-500);

  outline-offset: -2px;
}


/*
 * Selected animation sẽ thay layer này sau.
 */

.slot-view__selected {
  position: absolute;

  inset: 0;

  z-index: 7;

  pointer-events: none;

  box-shadow:
    inset 0 0 0 2px var(--gold-500),

    inset 0 0 10px rgba(212,
      175,
      55,
      0.35);
}


/* ============================================================
   ITEM RARITY — ô vuông nhỏ theo 5 bậc Phẩm (thay chấm tròn CSS cũ,
   giờ là ảnh thật từ PHAM_FRAME_PATHS thay vì tô màu token).
   ============================================================ */

.slot-view__item-rarity-badge {
  position: absolute;

  top: 3px;

  right: 3px;

  width: 12px;

  height: 12px;

  border-radius: 2px;

  z-index: 8;

  object-fit: cover;

  pointer-events: none;

  user-select: none;
}


/* ============================================================
   AMOUNT
   ============================================================ */

.slot-view__amount {
  position: absolute;

  right: 3px;

  bottom: 16px;

  padding: 0 4px;

  border-radius: 3px;

  background:
    rgba(10,
      10,
      13,
      0.75);

  color: var(--text-secondary);

  font-size: 0.6rem;

  line-height: 1.4;

  z-index: 8;

  pointer-events: none;
}


/* ============================================================
   CAPTION
   ============================================================ */

.slot-view__caption {
  position: relative;

  flex: 0 0 auto;

  padding: 2px 3px;

  background:
    rgba(10,
      10,
      13,
      0.55);

  color: var(--text-primary);

  font-size: 0.62rem;

  line-height: 1.15;

  text-align: center;

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;

  z-index: 8;

  pointer-events: none;
}
</style>