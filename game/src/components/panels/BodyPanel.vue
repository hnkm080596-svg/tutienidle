<script setup lang="ts">
// Huyen Kim scene 08 - Dao The / Kinh Mach dedicated imperial scroll.
// Thin mount wrapper: the interior lives in components/scenes/body/*
// (chapter rail, figure focus + meridian orb ring, tier chips, detail
// card) - all reads go through the canonical body chapter seams.
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import ImperialScrollScene from '@/components/common/ImperialScrollScene.vue'
import BodyScene from '@/components/scenes/body/BodyScene.vue'

const ui = useUiStore()
const { t } = useI18n()

function close() { ui.closeHomeOverlays() }
</script>

<template>
  <ImperialScrollScene
    scene="body"
    :open="ui.standalonePanel === 'body'"
    :title="t('panels.realm.body.title')"
    @close="close"
  >
    <BodyScene />
  </ImperialScrollScene>
</template>
