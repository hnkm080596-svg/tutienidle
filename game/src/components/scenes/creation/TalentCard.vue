<script setup lang="ts">
import { computed } from 'vue'
import { TALENT_RARITY_LABELS, type TalentDefinition, type TalentTag } from '@/core/talent/Talent'
import type { StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'
import CreationChoiceTile from './CreationChoiceTile.vue'
const props = defineProps<{ talent: TalentDefinition; selected: boolean; disabled?: boolean }>()
defineEmits<{ toggle: [] }>()
const symbols: Record<TalentTag, StableSymbolId> = {
  cultivation: 'realm', combat: 'skill', defense: 'body', resource: 'inventory',
  crafting: 'alchemy', element: 'technique', skill: 'skill', risk_reward: 'exploration', mechanic: 'settings',
}
const symbol = computed(() => symbols[props.talent.tags[0] ?? 'cultivation'])
const detail = computed(() => ({
  title: `${props.talent.name} · ${TALENT_RARITY_LABELS[props.talent.rarity]}`,
  description: props.talent.description,
}))
</script>

<template>
  <CreationChoiceTile :name="talent.name" :symbol="symbol" :tooltip="detail"
    :selected="selected" :disabled="disabled" :data-testid="`creation-talent-${talent.id}`"
    class="talent-card" @select="$emit('toggle')" />
</template>
