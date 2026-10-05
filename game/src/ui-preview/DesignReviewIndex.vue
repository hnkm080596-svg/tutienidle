<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import '@/assets/pc-paper-type.css'
const { t } = useI18n()
const root = '/docs/design/tien-hiep-ui-redesign-2026-10-05/runtime-evidence/'
const pages = [
  ['inventory', 'ui-design-system.html', 'design-paper-inventory-1672.png'],
  ['body', 'ui-design-system.html', 'design-paper-body-1672.png'],
  ['equipment', 'ui-design-system.html', 'design-paper-equipment-1672.png'],
  ['graph', 'ui-design-system.html', 'design-paper-graph-1672.png'],
  ['map', 'ui-design-system.html', 'design-paper-map-1672.png'],
  ['progression', 'ui-design-system.html', 'design-paper-progression-1672.png'],
  ['home', 'ui-landscape-design.html', 'design-landscape-home-1672.png'],
  ['opening', 'ui-landscape-design.html', 'design-landscape-opening-1672.png'],
  ['formation', 'ui-auxiliary-design.html', 'design-aux-formation-1672.png'],
  ['tooltip', 'ui-auxiliary-design.html', 'design-aux-tooltip-1672.png'],
  ['dialog', 'ui-auxiliary-design.html', 'design-aux-dialog-1672.png'],
  ['settings', 'ui-auxiliary-design.html', 'design-aux-settings-1672.png'],
  ['character', 'ui-character-progression-design.html', 'design-paper-character-1672.png'],
  ['creation', 'ui-character-progression-design.html', 'design-paper-creation-1672.png'],
  ['technique', 'ui-character-progression-design.html', 'design-paper-technique-1672.png'],
  ['meridian', 'ui-character-progression-design.html', 'design-paper-meridian-1672.png'],
  ['zhou', 'ui-character-progression-design.html', 'design-paper-zhou-1672.png'],
  ['battle', 'ui-combat-outcome-design.html', 'design-battle-1672.png'],
  ['victory', 'ui-combat-outcome-design.html', 'design-victory-1672.png'],
  ['defeat', 'ui-combat-outcome-design.html', 'design-defeat-1672.png'],
  ['tribulation', 'ui-combat-outcome-design.html', 'design-tribulation-1672.png'],
  ['alchemy', 'ui-collection-craft-design.html', 'design-craft-alchemy-1672.png'],
  ['forge', 'ui-collection-craft-design.html', 'design-craft-forge-1672.png'],
  ['companion', 'ui-collection-craft-design.html', 'design-craft-companion-1672.png'],
  ['artifact', 'ui-collection-craft-design.html', 'design-craft-artifact-1672.png'],
  ['vendor', 'ui-collection-craft-design.html', 'design-craft-vendor-1672.png'],
  ['quest', 'ui-collection-craft-design.html', 'design-craft-quest-1672.png'],
  ['feedback', 'ui-system-design.html', 'design-system-feedback-1672.png'],
  ['confirm', 'ui-system-design.html', 'design-system-confirm-1672.png'],
  ['entitlement', 'ui-system-design.html', 'design-system-entitlement-1672.png'],
  ['incompatible', 'ui-system-design.html', 'design-system-incompatible-1672.png'],
  ['loading', 'ui-system-design.html', 'design-system-loading-1672.png'],
] as const
</script>

<template>
  <main class="design-review"><header><h1>{{ t('title') }}</h1><p>{{ t('intro') }}</p><small>{{ t('boundary') }}</small></header><div class="design-review-grid"><a v-for="[id,page,screenshot] in pages" :key="id" :href="`/${page}?example=${id}`"><img :src="root + screenshot" :alt="t(id)"><span>{{ t(id) }} <b>↗</b></span></a></div></main>
</template>

<style>
html,body,#app { margin:0;min-height:100%;background:#f4e7cc;color:#2c2113;font-family:var(--pc-font-body); }
.design-review { padding:40px;max-width:1520px;margin:auto; }.design-review header { margin:0 0 30px;border-bottom:1px solid #b28a43;padding-bottom:20px; }.design-review h1 { font-size:48px;margin:0 0 12px; }.design-review p { font-size:23px;margin:0 0 12px; }.design-review small { font-size:17px;color:#765a32; }
.design-review-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:25px; }.design-review-grid a { color:inherit;text-decoration:none;background:#ead6af;border:1px solid #b38b46; }.design-review-grid img { display:block;width:100%;aspect-ratio:1672/941;object-fit:contain; }.design-review-grid span { display:block;padding:14px 18px;font-size:25px; }.design-review-grid b { float:right;color:#967034; }.design-review-grid a:hover { outline:2px solid #967034;outline-offset:3px; }
</style>
