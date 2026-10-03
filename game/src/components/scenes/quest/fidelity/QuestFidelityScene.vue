<script setup lang="ts">
// Scene 18 (Nhiem Vu / quest) content region for the imperial scroll:
// cadence tabs | quest list rail | detail panel. The fixture internals
// stay as slot fallbacks for the preview; production mounts the real
// QuestGroupTabs/QuestList/QuestDetailPanel through #tabs/#list/#detail.
import { useI18n } from 'vue-i18n'
import type { QuestDisplay } from './questUi'
import type { VictoryRewardDisplay } from '@/components/scenes/victory/fidelity/victoryUi'
import QuestFidelityDetail from './QuestFidelityDetail.vue'
defineProps<{ quests: readonly QuestDisplay[]; selected?: QuestDisplay; filter: string; rewards: readonly VictoryRewardDisplay[] }>()
const emit = defineEmits<{ select: [id: string]; filter: [id: string]; action: [id: string] }>()
const { t } = useI18n()
const filters = ['all', 'once', 'active', 'ready', 'claimed']
</script>
<template><div class="quest-scene"><slot name="tabs"><nav class="tabs"><button v-for="id in filters" :key="id" :aria-pressed="filter===id" @click="emit('filter',id)">{{ t(`questPreview.${id}`) }}</button></nav></slot><div class="workspace"><slot name="list"><div class="quest-list"><button v-for="quest in quests" :key="quest.id" :class="{selected:selected?.id===quest.id}" @click="emit('select',quest.id)"><img :src="quest.image" alt=""><span><b>{{ quest.name }}</b><small :class="quest.status">{{ t(`questPreview.${quest.status}`) }}</small></span><i aria-hidden="true">›</i></button><p v-if="!quests.length">{{ t('questPreview.empty') }}</p></div></slot><slot name="detail"><QuestFidelityDetail v-if="selected" :quest="selected" :rewards="rewards" @action="emit('action',$event)"/></slot></div></div></template>
<style scoped>
.quest-scene{height:100%;display:flex;flex-direction:column;font-family:var(--font-display,Georgia,serif)}
.tabs{display:flex;gap:8px;height:42px;margin-bottom:17px;border-bottom:1px solid #81663a66}
.tabs button{border:0;border-bottom:3px solid transparent;background:transparent;color:#665038;font:700 17px var(--font-display,Georgia,serif);padding:0 23px;cursor:pointer}
.tabs button[aria-pressed=true]{border-color:#947133;color:#264934;background:#87733d13}
.workspace{display:grid;grid-template-columns:404px 1fr;gap:31px;flex:1;min-height:0}
.quest-list{overflow:auto;border-right:1px solid #866b3b55;padding-right:21px;min-height:0}
.quest-list>button{display:flex;gap:13px;align-items:center;width:100%;height:76px;padding:9px 12px;margin-bottom:9px;border:1px solid #997f4c77;background:#7353220b;color:#4b3a26;text-align:left;cursor:pointer}
.quest-list>button.selected{background:linear-gradient(110deg,#24452f,#12291e);color:#fae5b6;border-color:#c1a466;box-shadow:inset 0 0 0 3px #ccb47433}
.quest-list img{width:57px;height:54px;object-fit:cover;border:1px solid #ae9564}
.quest-list b{font-size:16px;display:block}
.quest-list small{display:inline-block;margin-top:7px;font-size:11px;letter-spacing:1px;color:#786344}
.quest-list .selected small{color:#c6cba6}
.quest-list .ready{color:#2d7754}
.quest-list i{margin-left:auto;font-size:25px;font-style:normal}
.tabs button:focus-visible,.quest-list button:focus-visible{outline:2px solid #8f6a30;outline-offset:2px}
</style>
