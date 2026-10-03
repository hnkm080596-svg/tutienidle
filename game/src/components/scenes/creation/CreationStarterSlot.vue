<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CreationSectionHeader from './CreationSectionHeader.vue'
import CreationChoiceGrid from './CreationChoiceGrid.vue'
import CreationChoiceTile from './CreationChoiceTile.vue'
import CreationSkillSymbol from './CreationSkillSymbol.vue'
import type { CreationSkillOption } from './creationPreview'
const props = defineProps<{ options: readonly CreationSkillOption[] }>()
const { t } = useI18n()
// Cosmetic pick only: local state, never leaves the screen. The single
// unlocked option previews the starter pick and starts selected.
const pickedId = ref<string | null>(props.options.find((option) => !option.locked)?.id ?? null)
</script>

<template>
  <section data-hk-region="starter-slot">
    <CreationSectionHeader icon="skill" :title="t('onboarding.creation.starterSlot.title')">
      <template #hint>{{ t('onboarding.creation.hoverDetail') }}</template>
    </CreationSectionHeader>
    <!-- Locked precursors render as dimmed display cards; the starter is
         the one selectable radio - a preview affordance, not a real pick. -->
    <CreationChoiceGrid :items="options" :label="t('onboarding.creation.starterSlot.title')" role="radiogroup">
      <template #default="{ item }">
        <CreationChoiceTile
          :name="item.name" :icon="item.icon" symbol="skill"
          :tooltip="{ title: item.name, description: item.description }"
          :selected="pickedId === item.id" :display="item.locked" :locked="item.locked" :radio="!item.locked"
          :data-testid="`creation-starter-${item.id}`" @select="pickedId = item.id"
        >
          <template v-if="!item.icon" #icon><CreationSkillSymbol :motif="item.motif" /></template>
        </CreationChoiceTile>
      </template>
    </CreationChoiceGrid>
  </section>
</template>
