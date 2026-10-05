<script setup lang="ts">
import { i18n } from '@/i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import '@/assets/pc-paper-type.css'
const loadingPaper = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')

// Brand title via i18n.global.t (module composer - the component mounts
// without the i18n plugin installed and still stays locale-reactive).
// Beta Phase 4 (muc XVIII) - Boot -> Load Save -> Initialize -> Home.
// Boot hien tai HOAN TOAN dong bo (khong await gi) nen man nay chi
// hien trong khoanh khac rat ngan tren thuc te - dung dung khung suon
// cho tai lieu yeu cau, san sang neu sau nay co viec bat dong bo that
// (vd load save tu remote) xen vao ma khong can thiet ke lai UI.
</script>

<template>
  <div class="loading-screen" :style="{ backgroundImage: `url('${loadingPaper}')` }">
    <p class="loading-screen__title">{{ i18n.global.t('app.title') }}</p>

    <div class="loading-screen__pulse" />
  </div>
</template>

<style scoped>
.loading-screen {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #f5e8cd center / cover no-repeat;
}

.loading-screen__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-display);
  letter-spacing: -.025em;
  color: #302718;
}

.loading-screen__pulse {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid #b28a43;
  opacity: 0.7;
  animation: loading-pulse 1.1s ease-in-out infinite;
}

@keyframes loading-pulse {
  0%,
  100% {
    transform: scale(0.8);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}

/* UI-006 (Task 4, 2026-09-07) - reduced motion: pulse dung yen. */
@media (prefers-reduced-motion: reduce) {
  .loading-screen__pulse {
    animation: none;
  }
}
</style>
