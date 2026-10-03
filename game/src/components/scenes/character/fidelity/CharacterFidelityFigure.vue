<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { CHARACTER_ART, elementArt, type CharacterUiElement } from './characterUi'
defineProps<{ elements: readonly CharacterUiElement[]; selected: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
</script>
<template>
  <div class="cf-figure">
    <div class="cf-aura" aria-hidden="true"><i /><i /></div>
    <img class="cf-person" :src="CHARACTER_ART.figure" alt="" draggable="false">
    <button v-for="element in elements" :key="element.id" class="cf-element" :class="{ 'is-selected': selected === element.id }" :style="{ left: `${element.x}px`, top: `${element.y}px` }" :aria-pressed="selected === element.id" :title="element.name" @click="emit('select', element.id)">
      <img :src="elementArt(element.id)" alt=""><span>{{ element.name }}</span>
    </button>
  </div>
</template>
<style scoped>
.cf-figure { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.cf-person { position: absolute; left: 310px; top: 215px; width: 580px; height: 535px; object-fit: contain; filter: drop-shadow(0 8px 9px #4a3c3040); }
.cf-aura { position: absolute; left: 438px; top: 185px; width: 420px; height: 375px; border: 1px solid #b8893d; border-radius: 50%; box-shadow: 0 0 22px #ffd98f88, inset 0 0 25px #ffe5a277; background: radial-gradient(ellipse,#e6c26d33,transparent 68%); }
.cf-aura i { position: absolute; inset: 25px; border: 1px solid #d6a95a; border-radius: 50%; transform: rotate(-25deg) scaleY(.65); box-shadow: 0 0 7px #ffe8a7; }
.cf-aura i + i { inset: 44px; transform: rotate(32deg) scaleY(.8); border-style: dashed; }
.cf-element { position: absolute; width: 84px; height: 99px; transform: translate(-50%,-50%); border: 0; background: none; padding: 0; cursor: pointer; pointer-events: auto; display: grid; justify-items: center; align-content: start; }
.cf-element img { width: 80px; height: 80px; object-fit: cover; border-radius: 50%; filter: drop-shadow(0 0 6px #fbd680); }
.cf-element span { position: relative; margin-top: -2px; padding: 0 8px; color: #fff0c5; background: #443719dc; font-size: 16px; line-height: 22px; }
.cf-element.is-selected img, .cf-element:hover img { filter: drop-shadow(0 0 11px #ffd875) brightness(1.15); outline: 2px solid #ffe9ab; outline-offset: 2px; }
</style>
