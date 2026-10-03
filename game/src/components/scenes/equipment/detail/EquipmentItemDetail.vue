<script setup lang="ts">
// Selected item detail (Trang Bi mode of the item-card region): the
// canonical buildEquipmentTooltip payload rendered by the shared
// ItemCardBody, plus the ref's furniture - quality seal chip, equipped
// seal, a quality star row, and the equip/unequip action (button-standard
// chrome per spec). Every field quotes a real model slot; the ref's
// "Duc Lai Thuoc Tinh" re-forge button is intentionally absent (wash is
// scope-hidden - contract DO-NOT-DERIVE).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ItemCardBody from '@/components/common/ItemCardBody.vue'
import GameButton from '@/components/common/GameButton.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { itemQualityRank } from '@/core/profession/slotRank'
import { gradeLabel } from '@/core/presentation/labels'
import { ITEM_QUALITY_LABELS, ITEM_QUALITY_ORDER } from '@/core/item/ItemQuality'

const props = defineProps<{
  instanceId: string | null
}>()

const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { equip, unequip } = useEquipmentActions()

const instance = computed(() => {
  stateVersion.value
  return props.instanceId ? gameManager.equipmentBag.get(props.instanceId) : undefined
})

const template = computed(() =>
  instance.value ? gameManager.equipmentOps.getEquipmentTemplate(instance.value.itemId) : undefined,
)

// Slot state is meaningful only while the item is worn (enhance level is
// slot-owned) - same rule EquipmentBagSection applies for tooltips.
const slotState = computed(() =>
  instance.value?.equipped ? gameManager.equipmentOps.getSlotState(instance.value.slot) : null,
)

const mainStatRangeQuote = computed(() =>
  instance.value && template.value
    ? gameManager.equipmentSystem.quoteMainStatRange(instance.value, gameManager.equipmentRegistry)
    : undefined,
)

// Compare context for an UNEQUIPPED pick: the worn counterpart in the
// same slot (item-info-card spec section 4) - registry miss drops it.
const compare = computed(() => {
  const item = instance.value
  if (!item || item.equipped) return undefined

  const equipped = gameManager.equipmentBag.getEquippedInSlot(item.slot)
  if (!equipped) return undefined

  const equippedTemplate = gameManager.equipmentOps.getEquipmentTemplate(equipped.itemId)
  const equippedQuote = equippedTemplate
    ? gameManager.equipmentSystem.quoteMainStatRange(equipped, gameManager.equipmentRegistry)
    : undefined

  return equippedTemplate && equippedQuote
    ? {
        instance: equipped,
        template: equippedTemplate,
        slotState: gameManager.equipmentOps.getSlotState(equipped.slot),
        mainStatRangeQuote: equippedQuote,
      }
    : undefined
})

const content = computed(() =>
  instance.value && template.value && mainStatRangeQuote.value
    ? buildEquipmentTooltip(
        instance.value,
        template.value,
        gameManager.affixRegistry,
        slotState.value,
        gameManager.zoneRegistry,
        compare.value,
        mainStatRangeQuote.value,
      )
    : undefined,
)

const enhanceLevel = computed(() => slotState.value?.enhanceLevel ?? 0)

const qualityRank = computed(() =>
  instance.value ? itemQualityRank(instance.value.quality) : 0,
)
const qualityTotal = ITEM_QUALITY_ORDER.length
const qualityLabel = computed(() =>
  instance.value ? ITEM_QUALITY_LABELS[instance.value.quality] : '',
)

const actionLabel = computed(() =>
  instance.value?.equipped
    ? t('panels.equipmentHall.scene.unequip')
    : t('panels.equipmentHall.scene.equip'),
)

function onAction() {
  const item = instance.value
  if (!item) return
  if (item.equipped) {
    unequip(item.instanceId)
  } else {
    equip(item.instanceId)
  }
}
</script>

<template>
  <div class="equipment-item-detail">
    <template v-if="instance && content">
      <div class="equipment-item-detail__seals">
        <span
          class="equipment-item-detail__seal equipment-item-detail__seal--quality"
          art-needed
          data-art-id="seal-chip"
        >
          {{ qualityLabel }}
        </span>
        <span
          v-if="instance.equipped"
          class="equipment-item-detail__seal equipment-item-detail__seal--equipped"
          art-needed
          data-art-id="seal-chip"
        >
          {{ t('panels.equipmentHall.scene.equipped') }}
        </span>
      </div>

      <ItemCardBody :content="content" />

      <p class="equipment-item-detail__subline">
        <span v-if="enhanceLevel > 0" class="equipment-item-detail__enhance">+{{ enhanceLevel }}</span>
        <span class="equipment-item-detail__grade">{{ gradeLabel(instance.grade) }}</span>
        <span class="equipment-item-detail__stars" :aria-label="t('panels.equipmentHall.scene.starsAria', { rank: qualityRank, total: qualityTotal })">
          <span
            v-for="n in qualityTotal"
            :key="n"
            class="equipment-item-detail__star"
            :class="{ 'is-lit': n <= qualityRank }"
            aria-hidden="true"
          >★</span>
        </span>
      </p>

      <GameButton
        class="equipment-item-detail__action"
        variant="primary"
        size="md"
        @click="onAction"
      >
        {{ actionLabel }}
      </GameButton>
    </template>

    <EmptyState
      v-else
      class="equipment-item-detail__empty"
      size="md"
      framed
    >{{ t('panels.equipmentHall.empty.selectItem') }}</EmptyState>
  </div>
</template>

<style scoped>
.equipment-item-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 10px;
}

.equipment-item-detail__seals {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* seal-chip chrome arrives with Minh's sheet; these are the token
   stand-ins (art-needed) matching the HK seal shape. */
.equipment-item-detail__seal {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border: 1px solid var(--hk-border-active, var(--paper-line));
  border-radius: var(--hk-radius-pill, 999px);
  font: 700 var(--text-xs, 11px) var(--hk-font-display, var(--font-display));
  letter-spacing: 0.08em;
}

.equipment-item-detail__seal--quality {
  color: var(--hk-gold, #e3bd67);
  background: color-mix(in srgb, var(--hk-gold-muted, #b99a55) 18%, transparent);
}

.equipment-item-detail__seal--equipped {
  color: var(--hk-jade-soft, #8fb8a8);
  background: color-mix(in srgb, var(--hk-jade, #315f55) 28%, transparent);
}

.equipment-item-detail__subline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: var(--text-sm);
}

.equipment-item-detail__enhance {
  color: var(--hk-jade-soft, #8fb8a8);
  font-weight: 700;
}

.equipment-item-detail__grade {
  color: var(--hk-text-muted, #b8ad97);
}

.equipment-item-detail__stars {
  display: inline-flex;
  gap: 1px;
  color: var(--hk-gold-muted, #b99a55);
}

.equipment-item-detail__star {
  color: color-mix(in srgb, var(--hk-text-muted, #b8ad97) 40%, transparent);
}
.equipment-item-detail__star.is-lit {
  color: var(--hk-gold-bright, var(--hk-gold, #e3bd67));
}

.equipment-item-detail__action {
  margin-top: auto;
}
</style>
