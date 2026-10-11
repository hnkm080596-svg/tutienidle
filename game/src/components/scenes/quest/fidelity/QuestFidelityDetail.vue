<script setup lang="ts">
// Preview-fallback detail (slot default inside the right
// EquipmentArtCard): same shape as the production QuestDetailPanel -
// vista banner, description, objective rows, progress meter, rewards
// and the gold claim button. `.action` stays on the claim button - the
// remainingPreview contract test clicks it.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { QuestDisplay } from './questUi'
import type { VictoryRewardDisplay } from '@/components/scenes/victory/fidelity/victoryUi'
import VictoryFidelityRewards from '@/components/scenes/victory/fidelity/VictoryFidelityRewards.vue'
import QuestObjectiveArt from '@/components/common/art/QuestObjectiveArt.vue'
import EquipmentEnergyTube from '@/components/common/art/EquipmentEnergyTube.vue'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import QuestSectionPlaque from '../detail/QuestSectionPlaque.vue'

const props = defineProps<{ quest: QuestDisplay; rewards: readonly VictoryRewardDisplay[] }>()
const emit = defineEmits<{ action: [id: string] }>()
const { t } = useI18n()

const banner = computed(() => ({ backgroundImage: `url('${props.quest.image}')` }))
</script>

<template>
  <article class="quest-detail-fallback">
    <div class="quest-detail-fallback__scroll">
      <div class="quest-detail-fallback__banner" :style="banner">
        <h2>{{ quest.name }}</h2>
        <p>{{ t(`questPreview.${quest.status}`) }}</p>
      </div>
      <p class="quest-detail-fallback__desc">{{ quest.description }}</p>
      <QuestSectionPlaque :text="t('questPreview.objectives')" />
      <QuestObjectiveArt
        v-for="item in quest.objectives"
        :key="item.id"
        :done="item.done"
        :label="item.label"
        :amount="item.value"
      />
      <template v-if="quest.progressText">
        <QuestSectionPlaque :text="t('questPreview.progress')" />
        <div class="quest-detail-fallback__meter">
          <EquipmentEnergyTube :fill="quest.progress ?? 0" color="#e7bb62" />
          <span>{{ quest.progressText }}</span>
        </div>
      </template>
      <VictoryFidelityRewards :rewards="rewards" />
    </div>
    <EquipmentArtButton gold class="action" @click="emit('action', quest.id)">
      {{ t(quest.status === 'ready' ? 'questPreview.claim' : quest.status === 'claimed' ? 'questPreview.claimed' : 'questPreview.follow') }}
    </EquipmentArtButton>
  </article>
</template>

<style scoped>
.quest-detail-fallback{flex:1;min-height:0;display:flex;flex-direction:column;gap:6px;color:#efdfb9}
.quest-detail-fallback__scroll{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;display:flex;flex-direction:column;gap:8px}
.quest-detail-fallback__scroll::-webkit-scrollbar{display:none}
.quest-detail-fallback__banner{position:relative;isolation:isolate;height:78px;flex:0 0 auto;display:flex;flex-direction:column;justify-content:flex-end;padding:8px;box-sizing:border-box;background-position:center;background-size:cover}
.quest-detail-fallback__banner::before{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(transparent,#141511e8)}
.quest-detail-fallback__banner h2{margin:0;font-size:20px;color:#ffe6aa;text-shadow:0 2px 4px #000}
.quest-detail-fallback__banner p{margin:2px 0 0;font-size:12px}
.quest-detail-fallback__desc{margin:0;font-size:12px;line-height:1.4}
.quest-detail-fallback__meter{display:flex;align-items:center;gap:9px;font-size:11px}
.quest-detail-fallback__meter span{white-space:nowrap}
.quest-detail-fallback>.action{flex:0 0 auto;min-height:38px;margin-top:auto}
</style>
