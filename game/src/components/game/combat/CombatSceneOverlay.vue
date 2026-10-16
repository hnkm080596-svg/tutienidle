<script setup lang="ts">
// 6A-T8 (2026-09-01, spec docs/superpowers/specs/2026-09-01-combat-scene-
// ui-redesign-design.md) - CombatSceneOverlay top-only: 3 bar DOM duoi
// (Status/Event/Control) roi DOM - HP/MP/Kiet + exit zone vao canvas
// (PlayerHudLayer T4/T5), floating text kill/heal (T2), confirm modal
// extract rieng (T6), slider/ult vao Build HUD (T7).
//
// Insets: chi TopBar con la DOM chrome phia tren; publishInsets chi
// do top (bottom luon 0 tu T3).
//
// Combat Art Pipeline Task 7 (2026-09-05, spec sec.7.5) - Build HUD +
// TurnCombatSkillBar roi battlefield slot vao CombatSkillDockPanel
// (dock mep phai, publish `right` rieng). Overlay nay gio chi publish
// `top` (publishTopBarHeight - giu nguyen `right` cua dock), khong con
// giu import cho 2 component da doi.
import { nextTick, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'
import CombatTopRail from '@/components/scenes/combat/CombatTopRail.vue'
import CombatTurnRail from '@/components/scenes/combat/CombatTurnRail.vue'
import CombatAiRail from '@/components/scenes/combat/CombatAiRail.vue'
import CombatPartyDock from './hud/CombatPartyDock.vue'
import { clearSkillDockWidth } from '@/presentation/geometry/combatInsets'
import CombatLogFeed from '@/components/scenes/combat/CombatLogFeed.vue'
import CombatModalLayer from '@/components/scenes/combat/CombatModalLayer.vue'
import CombatPanel from '@/components/scenes/combat/CombatPanel.vue'
import { publishTopBarHeight, resetCombatInsets } from '@/presentation/geometry/combatInsets'
import { useTurnCombatManual } from '@/composables/useTurnCombatManual'
import { mountCombatChromeRoot } from '@/presentation/combat/CombatChromeAssetGate'

const rootRef = ref<HTMLElement | null>(null)
const layoutVersion = ref(0)
let unmountChromeRoot: (() => void) | undefined

// Skill dock mounts only while the battle is fighting: its only content
// (TurnCombatSkillBar) self-hides otherwise, and an empty dock would be a
// dead panel blocking the battlefield edge (UI audit 2026-09-28). Unmount
// also clears the published `right` inset via the dock's own unmount hook.
const { isBattleFighting } = useTurnCombatManual()

let insetsObserver: ResizeObserver | null = null

// Chi TopBar - chrome DOM duy nhat con lai phia tren canvas.
const BAR_CLASSES = ['combat-scene-overlay__top-bar']

function barHeight(root: HTMLElement, className: string): number {
  return root.querySelector<HTMLElement>(`:scope > .${className}`)?.getBoundingClientRect().height ?? 0
}

function onPanelLayout() {
  clearSkillDockWidth()
  layoutVersion.value++
  publishInsets()
}

function publishInsets() {
  const root = rootRef.value

  if (!root) {
    return
  }

  const top = barHeight(root, 'combat-scene-overlay__top-bar')

  if (top > 0) {
    // Chi ghi `top` (publishTopBarHeight giu `right` cua dock) - setCombatInsets
    // tho ghi de ca 3 truong, se xoa width dock vua publish.
    publishTopBarHeight(top)
  }
}

function observeBars() {
  const root = rootRef.value

  if (!root || !insetsObserver) {
    return
  }

  for (const className of [...BAR_CLASSES, 'combat-scene-overlay__battlefield']) {
    const element = root.querySelector<HTMLElement>(`:scope > .${className}`)

    if (element) {
      insetsObserver.observe(element)
    }
  }
}

onMounted(() => {
  unmountChromeRoot = mountCombatChromeRoot(rootRef.value)
  void nextTick(publishInsets)

  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    insetsObserver = new ResizeObserver(() => {
      observeBars()
      publishInsets()
    })

    observeBars()
  }
})

onBeforeUnmount(() => {
  unmountChromeRoot?.()
  unmountChromeRoot = undefined
  insetsObserver?.disconnect()
  insetsObserver = null
})

onUnmounted(() => {
  // onUnmounted (KHONG onBeforeUnmount) - Vue teardown cha-truoc-con:
  // dock (con) clear `right` cua no trong onBeforeUnmount truoc khi hook
  // nay chay, resetCombatInsets() o day xoa phan con lai sau cung.
  resetCombatInsets()
})
</script>

<template>
  <!-- 6A - background chien dau la vung giao dien chinh; canvas Phaser
       duy nhat cua app van la PhaserCanvas.vue trong MainScene.vue.
       Overlay chi con TopBar (thong tin zone/stage), AI panel, dock
       ky nang mep phai va cac modal. Bottom = full canvas. -->
  <CombatPanel @layout="onPanelLayout">
  <div ref="rootRef" class="combat-scene-overlay">
    <CombatTopRail class="combat-scene-overlay__top-bar" />

    <CombatPartyDock />

    <div class="combat-scene-overlay__battlefield">
      <!-- ui-combat reskin (2026-10-04) - the framed player vitals card
           top-left (mock: avatar + HP/MP + resource + buff chips); it
           replaces the retired canvas PlayerHudLayer. -->


      <!-- Combat AI panel - ngay duoi nut Tu Dong o goc tren phai. -->
      <CombatAiRail class="combat-scene-overlay__ai-panel" />
    </div>

    <!-- Slice 7 extension - turn-order preview (top, duoi TopBar) + battle
         log (goc phai-duoi, self-guarded khi khong fighting). -->
    <CombatTurnRail class="combat-scene-overlay__turn-order-strip" />

    <CombatLogFeed />


    <!-- 6A-T6 - confirm thoat tran + result/intro/countdown (scene exit
         zone -> bridge event). -->
  </div>
  <template #overlays><CombatModalLayer /></template>
  </CombatPanel>
</template>
<style scoped>
/* T8.1 (2026-09-02) - khoi phuc styles bi mat trong 6A T8 rewrite
   (991ba75 da xoa toan bo style scoped): root phu canvas, AI panel
   neo duoi nut Tu Dong, battlefield la vung chua. */
.combat-scene-overlay {
  --combat-topbar-h: 94px;
  position: absolute;
  inset: 0;
  z-index: 15;
  display: flex;
  flex-direction: column;
  pointer-events: none;
  font-family: var(--font-body);
}

.combat-scene-overlay__top-bar {
  flex: 0 0 auto;
  height: var(--combat-topbar-h);
}

.combat-scene-overlay__battlefield {
  position: absolute;
  inset: 0;
  flex: 1 1 auto;
  pointer-events: none;
}

.combat-scene-overlay__ai-panel {
  position: absolute;
  right: 248px;
  left: auto;
  top: 68px;
  width: 210px;
  max-height: 380px;
  overflow: visible;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  z-index: 12;
}

.combat-scene-overlay__turn-order-strip {
  position: absolute;
  top: 0;
  left: 50%;
  right: auto;
  width: 640px;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  z-index: 12;
}
</style>


