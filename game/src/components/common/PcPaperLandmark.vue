<script setup lang="ts">
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { pcPaperIconUrl, type PcPaperIcon } from '@/presentation/assets/PcPaperIcons'
defineProps<{ label: string; icon: PcPaperIcon }>()
const background = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/landmark-v1.png')
</script>

<template>
  <button class="pc-paper-landmark" :style="{ backgroundImage: `url('${background}')` }"><img :src="pcPaperIconUrl(icon)" alt=""><b>{{ label }}</b></button>
</template>

<style scoped>
.pc-paper-landmark { width:72px;min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:28px 15px 20px;border:0;background-color:transparent;background-size:100% 100%;color:#302411;font:700 19px/1.2 var(--pc-font-body);cursor:pointer; }
.pc-paper-landmark img { width:39px;height:39px;object-fit:contain;pointer-events:none; }.pc-paper-landmark b { max-width:44px;pointer-events:none; }.pc-paper-landmark:hover { filter:brightness(1.06); }.pc-paper-landmark:focus-visible { outline:2px solid #886429;outline-offset:3px; }
</style>
