<script setup lang="ts">
defineProps<{ motif: 'sword' | 'orb' | 'fist' }>()
</script>

<template>
  <svg class="creation-skill-symbol" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="motif === 'sword'">
      <path d="m17 31 19-23 5-2-1 6-22 21M13 27l10 10M17 33l-7 7-3-3 7-7M26 21l8-9" />
      <path d="M8 23c-2-11 7-18 16-18M24 43c11 0 19-9 19-18" opacity=".35" />
    </template>
    <template v-else-if="motif === 'orb'">
      <path d="M24 4c3 10-2 11-5 17-3 6 0 10 5 11 8-1 10-7 7-14 9 6 12 19 2 24-9 5-24-1-23-11 0-7 8-10 8-17 3 2 4 5 4 6 4-6 1-10 2-16Z" />
      <circle cx="25" cy="29" r="5" fill="currentColor" opacity=".45" />
      <path d="M5 18l3 2M39 7l-2 5M41 30l4 1" opacity=".55" />
    </template>
    <template v-else>
      <path d="M16 23V12c0-4 6-4 6 0v9-13c0-4 6-4 6 0v13-11c0-4 6-4 6 0v13-8c0-4 6-4 6 0v13c0 7-5 11-9 14v3H17v-4c-4-3-7-6-8-10l-2-6c-1-4 4-6 6-2l4 6 9-1" />
      <path d="M17 37h16M22 29v6M28 28v6" opacity=".5" />
    </template>
  </svg>
</template>

<style scoped>
.creation-skill-symbol { width: 48px; height: 48px; filter: drop-shadow(0 0 8px #c9b76e40); }
</style>
