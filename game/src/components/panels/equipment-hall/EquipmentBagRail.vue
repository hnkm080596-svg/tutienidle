<script setup lang="ts">
// Huyen Kim scene 12 - compact unequipped-gear rail beside the
// paperdoll (spec: "compact bag column"). Pure projection of the same
// canonical list EquipmentBagSection renders (equipmentBag.getAll,
// unequipped only) + the same canonical op (useEquipmentActions.equip)
// - no sort/filter state is duplicated here; the full bag surface owns
// those tools in the Inventory scene.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from '../../common/SlotView.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { gradeLabel } from '@/core/presentation/labels'
import { itemQualityRank, professionGradeRank } from '@/core/profession/slotRank'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import type { EquipmentTooltipContent } from '@/composables/useTooltip'

const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { equip } = useEquipmentActions()

const items = computed(() => {
  stateVersion.value

  return gameManager.equipmentBag
    .getAll()
    .filter((instance) => !instance.equipped)
    .map((instance) => {
      const template = gameManager.equipmentOps.getEquipmentTemplate(instance.itemId)
      const name = template?.name ?? instance.itemId
      const equippedComparison = gameManager.equipmentBag.getEquippedInSlot(instance.slot)
      const equippedTemplate = equippedComparison
        ? gameManager.equipmentOps.getEquipmentTemplate(equippedComparison.itemId)
        : undefined
      const quote = template
        ? gameManager.equipmentSystem.quoteMainStatRange(instance, gameManager.equipmentRegistry)
        : undefined
      const equippedQuote = equippedComparison && equippedTemplate
        ? gameManager.equipmentSystem.quoteMainStatRange(equippedComparison, gameManager.equipmentRegistry)
        : undefined

      const tooltip: EquipmentTooltipContent | undefined =
        template && quote
          ? buildEquipmentTooltip(
              instance,
              template,
              gameManager.affixRegistry,
              null,
              gameManager.zoneRegistry,
              equippedComparison && equippedTemplate && equippedQuote
                ? {
                    instance: equippedComparison,
                    template: equippedTemplate,
                    slotState: gameManager.equipmentOps.getSlotState(equippedComparison.slot),
                    mainStatRangeQuote: equippedQuote,
                  }
                : undefined,
              quote,
            )
          : undefined

      return {
        instance,
        name,
        nameSegments: template
          ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
          : [{ text: instance.itemId }],
        accessibleLabel: `${name}, ${gradeLabel(instance.grade)}`,
        qualityRank: professionGradeRank(instance.grade),
        rarityRank: itemQualityRank(instance.quality),
        icon: instance.icon ?? template?.icon,
        tooltip,
      }
    })
})
</script>

<template>
  <div class="equip-bag-rail" data-hk-region="bag-rail">
    <span class="equip-bag-rail__title">{{ t('panels.equipmentHall.bagRail.title') }} ({{ items.length }})</span>
    <div class="equip-bag-rail__list">
      <SlotView
        v-for="entry in items"
        :key="entry.instance.instanceId"
        class="equip-bag-rail__slot"
        :item="entry.instance"
        :label="entry.name"
        :accessible-label="entry.accessibleLabel"
        :name-segments="entry.nameSegments"
        :equipment-quality-rank="entry.qualityRank"
        :rarity-rank="entry.rarityRank"
        :icon="entry.icon"
        :tooltip="entry.tooltip"
        @click="equip(entry.instance.instanceId)"
      />
      <span v-if="items.length === 0" class="equip-bag-rail__empty">
        {{ t('panels.equipmentHall.bagRail.empty') }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.equip-bag-rail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  gap: 6px;
}

.equip-bag-rail__title {
  flex: 0 0 auto;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--hk-text-secondary, var(--paper-text-muted));
  letter-spacing: 0.04em;
  text-align: center;
}

.equip-bag-rail__list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px;
  mask-image: linear-gradient(to bottom, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%);
}
.equip-bag-rail__list::-webkit-scrollbar { display: none; }
.equip-bag-rail__list { scrollbar-width: none; }

.equip-bag-rail__slot {
  flex: 0 0 auto;
  width: 100%;
  aspect-ratio: 1;
}

.equip-bag-rail__empty {
  font-size: var(--text-xs);
  color: var(--hk-text-muted, var(--text-muted));
  text-align: center;
  padding: 12px 4px;
}
</style>
