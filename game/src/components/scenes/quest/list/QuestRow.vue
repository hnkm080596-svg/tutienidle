<script setup lang="ts">
// One quest row inside the EquipmentArtCard list (Codex landscape
// port): thumb (row.image or the shared warm vista - per-quest art is
// unassigned), name + one-line summary, EnergyTube + 'x / y' amount
// and a status badge. Locked preview rows stay rendered as 'pending'
// (grayscale, unselectable) with their unlock reasons as the summary,
// same semantics as before - only the shape changed.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EquipmentEnergyTube from '@/components/common/art/EquipmentEnergyTube.vue'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'
import { questRowStatus } from '@/presentation/questUi'

const props = defineProps<{
  row: BetaQuestSurfaceModel
  selected?: boolean
  onSelect: () => void
}>()

const { t } = useI18n()

const locked = computed(() => props.row.lockedPreview !== undefined)

const status = computed(() => questRowStatus(props.row))

const fill = computed(() =>
  props.row.target > 0 ? (Math.min(props.row.progress, props.row.target) / props.row.target) * 100 : 0,
)
const amountText = computed(() => `${Math.min(props.row.progress, props.row.target)} / ${props.row.target}`)

const lockReasons = computed(() => {
  const preview = props.row.lockedPreview
  if (!preview) return ''
  const reasons: string[] = []
  if (preview.afterQuestName) {
    reasons.push(t('panels.quest.lockedAfter', { name: preview.afterQuestName }))
  }
  if (preview.requiredRealmId) {
    let realmName = preview.requiredRealmId
    try {
      realmName = getCurrentRealm(preview.requiredRealmId).name
    } catch { /* unknown realm id renders raw, same as the old panel */ }
    reasons.push(t('panels.quest.lockedRealm', { realm: realmName }))
  }
  return reasons.join(' ')
})
</script>

<template>
  <button
    type="button"
    class="quest-row"
    :class="{ 'is-selected': selected, 'is-locked': locked }"
    :aria-pressed="selected"
    :aria-disabled="locked || undefined"
    :tabindex="locked ? -1 : 0"
    @click="locked ? undefined : onSelect()"
  >
    <span class="quest-row__body">
      <span class="quest-row__name">{{ row.name }}</span>
      <span class="quest-row__desc">{{ locked ? lockReasons : row.description }}</span>
      <span class="quest-row__meter">
        <EquipmentEnergyTube class="quest-row__tube" :fill="fill" color="#e7bb62" />
        <i>{{ amountText }}</i>
      </span>
    </span>

    <em class="quest-row__badge" :class="status">{{ t(`panels.quest.scene.status.${status}`) }}</em>
  </button>
</template>

<style scoped>
.quest-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  color: #efdfb9;
  border: 1px solid #947444;
  background: #15171550;
  font-family: inherit;
  text-align: start;
  cursor: pointer;
}
.quest-row.is-selected {
  border-color: #f5ce78;
  box-shadow: inset 0 0 8px #e1a94370, 0 0 4px #e1a94380;
}
.quest-row.is-locked { opacity: 0.55; filter: grayscale(0.9); cursor: default; }
.quest-row.is-locked:hover { border-color: #947444; }

.quest-row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.quest-row__name {
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.quest-row__desc {
  font-size: 11px;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.quest-row__meter {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11px;
}
.quest-row__tube { flex: 1; min-width: 0; }
.quest-row__meter i { font-style: normal; white-space: nowrap; }

.quest-row__badge {
  flex: 0 0 auto;
  font-style: normal;
  font-size: 10px;
  border: 1px solid #947444;
  padding: 4px;
  white-space: nowrap;
}
.quest-row__badge.complete { color: #9ccc82; border-color: #9ccc8280; }
.quest-row__badge.ready { color: #f5ce78; border-color: #f5ce7880; }
.quest-row__badge.pending { color: #b8ad97; }
</style>
