<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AlchemyJobDisplay } from './alchemyUi'

defineProps<{ jobs: readonly AlchemyJobDisplay[]; capacity: number }>()

const emit = defineEmits<{ cancel: [id: string] }>()

const { t } = useI18n()

function percent(value: number) { return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0 }
</script>

<template>
  <section class="queue" :aria-label="t('alchemy.queueTitle')">
    <div class="queue-heading"><h2>{{ t('alchemy.queueTitle') }}</h2><span>{{ jobs.length }} / {{ capacity }}</span></div>
    <div class="job-scroll">
      <article v-for="job in jobs" :key="job.id" class="job"><img :src="job.icon" alt=""><div class="job-info"><h3>{{ job.name }}</h3><div class="job-progress" role="progressbar" :aria-label="job.name" :aria-valuenow="percent(job.progress)" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: `${percent(job.progress)}%` }" /></div><span class="remaining">{{ job.remaining }}</span></div><button class="cancel" :aria-label="t('alchemy.cancelJob')" @click="emit('cancel', job.id)">×</button></article>
      <div v-if="jobs.length < capacity" class="empty-slot"><span class="empty-glyph" aria-hidden="true">◇</span><span>{{ t('alchemy.emptySlot') }}</span></div>
    </div>
  </section>
</template>

<style scoped>
.queue { position:absolute; left:235px; top:618px; width:714px; height:99px; }
.queue-heading { display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; color:#796037; }
.queue-heading h2 { font-weight:500; font-size:17px; margin:0; }
.queue-heading span { font-size:13px; }
.job-scroll { display:flex; gap:10px; overflow-x:auto; scrollbar-width:thin; padding-bottom:3px; }
.job { flex:0 0 246px; height:65px; display:flex; gap:9px; align-items:center; position:relative; padding:8px 11px; border:1px solid #b1966066; border-radius:4px; background:#decda555; }
.job > img { width:36px; height:36px; object-fit:contain; }
.job-info { flex:1; min-width:0; }
.job-info h3 { font-size:14px; font-weight:500; margin:0 17px 8px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.job-progress { height:5px; background:#b5a07955; border:1px solid #a3884b55; overflow:hidden; border-radius:3px; }
.job-progress span { display:block; height:100%; background:linear-gradient(90deg,#426b4e,#b59b58); }
.remaining { display:block; margin-top:4px; font-size:10px; color:#8b713f; }
.cancel { position:absolute; right:5px; top:4px; width:25px; height:25px; border:0; background:none; color:#8c7241; font-size:19px; cursor:pointer; }
.cancel:focus-visible { outline:2px solid #3c694e; }
.empty-slot { flex:1 0 170px; display:flex; justify-content:center; align-items:center; gap:8px; height:65px; border:1px dashed #b69c6577; border-radius:4px; color:#998458; font-size:13px; }
.empty-glyph { font-size:23px; }
</style>
