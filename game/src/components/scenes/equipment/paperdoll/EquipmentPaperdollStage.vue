<script setup lang="ts">
// Paperdoll stage (spec region paperdoll, 380 x 610): the worn figure
// presented as an open vista (no panel chrome) - the canonical
// EquipmentPaperdoll renders the mannequin substrate and six runtime
// sockets; the stage adds a soft plinth shadow under the figure while
// Minh's painted stage art is pending (art-needed).
//
// The ref's "Chien LUC" plaque under the figure is intentionally absent:
// Chien Luc is a CharacterPanel-local display heuristic, not a shared
// read-model, so nothing is quoted here (flagged for the audit report).
import EquipmentPaperdoll from '@/components/panels/EquipmentPaperdoll.vue'

const emit = defineEmits<{ select: [instanceId: string] }>()

withDefaults(
  defineProps<{
    /** Forwarded to EquipmentPaperdoll - true on the Trang Bi tab only;
     * op tabs select the item for their operation instead of stripping. */
    unequipOnSelect?: boolean
  }>(),
  { unequipOnSelect: true },
)

function forward(instanceId: string) {
  emit('select', instanceId)
}
</script>

<template>
  <section class="equipment-paperdoll-stage" data-hk-region="paperdoll">
    <span
      class="equipment-paperdoll-stage__plinth"
      art-needed
      data-art-id="equipment-stage-plinth"
      aria-hidden="true"
    />
    <EquipmentPaperdoll
      class="equipment-paperdoll-stage__doll"
      :unequip-on-select="unequipOnSelect"
      @select="forward"
    />
  </section>
</template>

<style scoped>
.equipment-paperdoll-stage {
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
}

/* Temp plinth: a low jade shadow + gold lip under the figure - stands
   in for the painted stage slab in the ref. */
.equipment-paperdoll-stage__plinth {
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: 4%;
  height: 12%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--hk-jade, #315f55) 55%, transparent) 0%,
    color-mix(in srgb, var(--hk-jade, #315f55) 22%, transparent) 55%,
    transparent 78%
  );
  border-bottom: 1px solid color-mix(in srgb, var(--hk-gold-muted, #b99a55) 45%, transparent);
  pointer-events: none;
}

.equipment-paperdoll-stage__doll {
  position: relative;
  width: 100%;
  min-height: 0;
}
</style>
