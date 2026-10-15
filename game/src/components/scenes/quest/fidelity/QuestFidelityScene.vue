<script setup lang="ts">
import GamePanel from '@/components/common/GamePanel.vue'
// Scene 18 (Nhiem Vu / quest) paper surface, Codex landscape port:
// the sheet is the shared flat paper page at the common panel band
// (24%/12.5%/74%/75% of the 1440x810 canvas, same as skill-sheet /
// equipment-sheet). The element is renamed off `quest-paper` on
// purpose - tien-hiep-ui.css globals pin every <scene>-paper class to
// the legacy 156/1272 band. Inside the sheet the approved 3-column
// composition mounts: thematic group medallion rail | EquipmentArtCard
// list | EquipmentArtCard detail. The fixture internals stay slot
// fallbacks for the preview; production mounts the real
// QuestGroupRail/QuestList/QuestDetailPanel through
// #groups/#list/#detail.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import GameCard from '@/components/common/GameCard.vue'
import EquipmentEnergyTube from '@/components/common/art/EquipmentEnergyTube.vue'
import QuestCategoryArtButton from '@/components/common/art/QuestCategoryArtButton.vue'
import { questGroupIcon } from '../groups/questGroupArt'
import type { QuestDisplay } from './questUi'

withDefaults(defineProps<{
  quests: readonly QuestDisplay[]
  selected?: QuestDisplay
  filter: string
  rewards?: readonly unknown[]
  notice: string
  preview?: boolean
}>(), { preview: false })

const emit = defineEmits<{ select: [id: string]; filter: [id: string]; action: [id: string]; back: [] }>()
const { t } = useI18n()
const filters = ['all', 'once', 'active', 'ready', 'claimed']

// Same dialog contract the imperial scroll carried: focus/pointer stay
// inside the open surface and Escape closes through emit('back').
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>

<template>
  <section ref="rootRef" class="rail-panel-scene quest-scene" :aria-label="t('panels.quest.title')" @click.self="emit('back')">
    <GamePanel :title="t('panels.quest.title')">
    
    

    <div class="quest-columns">
      <nav class="quest-groups">
        <slot name="groups">
          <QuestCategoryArtButton
            v-for="id in filters"
            :key="id"
            :icon="questGroupIcon(id)"
            :label="t(`questPreview.${id}`)"
            hint=""
            :selected="filter === id"
            @click="emit('filter', id)"
          />
        </slot>
      </nav>

      <GameCard class="quest-list-card">
        <h2 class="quest-list-title">{{ t('panels.quest.scene.list') }}</h2>
        <slot name="list">
          <div class="quest-list-fallback">
            <button
              v-for="quest in quests"
              :key="quest.id"
              type="button"
              :class="{ selected: selected?.id === quest.id }"
              @click="emit('select', quest.id)"
            >
              <img :src="quest.image" alt="">
              <span class="quest-list-fallback__body">
                <b>{{ quest.name }}</b>
                <small>{{ quest.description }}</small>
                <span class="quest-list-fallback__meter">
                  <EquipmentEnergyTube :fill="quest.progress ?? 0" color="#e7bb62" />
                  <i>{{ quest.progressText ?? '' }}</i>
                </span>
              </span>
              <em :class="quest.status">{{ t(`questPreview.${quest.status}`) }}</em>
            </button>
            <p v-if="!quests.length">{{ t('questPreview.empty') }}</p>
          </div>
        </slot>
      </GameCard>

      <GameCard class="quest-detail-card">
        <slot name="detail" />
      </GameCard>
    </div>

    <p v-if="preview" class="quest-preview">{{ t('preview') }}</p>
    <p class="quest-notice" role="status">{{ notice }}</p>
    </GamePanel>
  </section>
</template>

<style scoped>
.quest-scene{position:absolute;inset:0;font-family:var(--font-display,Georgia,serif)}
.quest-scene :deep(*){box-sizing:border-box}
/* 3-column grid per the approved preview: rail | list | detail. */
.quest-columns{position:absolute;left:367px;top:200px;width:1021px;height:490px;display:grid;grid-template-columns:19% 43% minmax(0,1fr);gap:12px}
.quest-groups{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.quest-groups :deep(button){flex:0 0 auto}
.quest-list-card,.quest-detail-card{display:flex;flex-direction:column;min-height:0;gap:6px}
.quest-list-title{margin:0;flex:0 0 auto;font:700 18px var(--font-display,Georgia,serif);color:#f3e4c4}
/* Slot fallback list (preview page) - same row shape as QuestRow. */
.quest-list-fallback{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;display:flex;flex-direction:column}
.quest-list-fallback::-webkit-scrollbar{display:none}
.quest-list-fallback>button{width:100%;display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:7px;color:#efdfb9;border:1px solid #947444;background:#15171550;text-align:left;cursor:pointer;font-family:inherit}
.quest-list-fallback>button.selected{border-color:#f5ce78;box-shadow:inset 0 0 8px #e1a94370,0 0 4px #e1a94380}
.quest-list-fallback img{width:56px;height:56px;object-fit:cover;border:1px solid #ad8a46;flex:0 0 auto}
.quest-list-fallback__body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.quest-list-fallback__body b{font-size:15px}
.quest-list-fallback__body small{font-size:11px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.quest-list-fallback__meter{display:flex;align-items:center;gap:9px;font-size:11px}
.quest-list-fallback__meter i{font-style:normal;white-space:nowrap}
.quest-list-fallback>button>em{flex:0 0 auto;font-style:normal;font-size:10px;border:1px solid #947444;padding:4px;white-space:nowrap}
.quest-list-fallback .ready{color:#9ccc82}
.quest-preview{position:absolute;left:367px;top:693px;margin:0;font-size:10px;line-height:15px;color:#7d6a45}
.quest-notice{position:absolute;left:750px;top:693px;width:640px;height:13px;margin:0;text-align:right;font-size:12px;color:#62512d}

/* Layout instances are relative to the owning panel content. */
.quest-scene :deep(.game-panel__content .quest-columns) { position: absolute; inset: 0; width: 100%; height: 100%; min-width: 0; min-height: 0; margin: 0; }
.quest-scene :deep(.game-panel__content .quest-notice) { left: 0; right: 0; top: auto; bottom: 0; width: 100%; }
</style>
