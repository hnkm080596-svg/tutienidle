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
import CombatActionDock from '@/components/scenes/combat/CombatActionDock.vue'
import CombatLogFeed from '@/components/scenes/combat/CombatLogFeed.vue'
import CombatModalLayer from '@/components/scenes/combat/CombatModalLayer.vue'
import { publishTopBarHeight, resetCombatInsets } from '@/presentation/geometry/combatInsets'
import { useTurnCombatManual } from '@/composables/useTurnCombatManual'

const rootRef = ref<HTMLElement | null>(null)

// Skill dock mounts only while the battle is fighting: its only content
// (TurnCombatSkillBar) self-hides otherwise, and an empty dock would be a
// dead panel blocking the battlefield edge (UI audit 2026-09-28). Unmount
// also clears the published `right` inset via the dock's own unmount hook.
const { isBattleFighting } = useTurnCombatManual()

let insetsObserver: ResizeObserver | null = null

// Chi TopBar - chrome DOM duy nhat con lai phia tren canvas.
const BAR_CLASSES = ['combat-scene-overlay__top-bar']

function barHeight(root: HTMLElement, className: string): number {
  return root.querySelector<HTMLElement>(`:scope > .${className}`)?.offsetHeight ?? 0
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
  <div ref="rootRef" class="combat-scene-overlay">
    <CombatTopRail class="combat-scene-overlay__top-bar" />

    <CombatActionDock :fighting="isBattleFighting" />

    <div class="combat-scene-overlay__battlefield">
      <!-- Combat AI panel - goc TRAI battlefield, chi panel nhan pointer. -->
      <CombatAiRail class="combat-scene-overlay__ai-panel" />
    </div>

    <!-- Slice 7 extension - turn-order preview (top, duoi TopBar) + battle
         log (goc phai-duoi, self-guarded khi khong fighting). -->
    <CombatTurnRail class="combat-scene-overlay__turn-order-strip" />

    <CombatLogFeed />

    <!-- 6A-T6 - confirm thoat tran + result/intro/countdown (scene exit
         zone -> bridge event). -->
    <CombatModalLayer />
  </div>
</template>
<style scoped>
/* T8.1 (2026-09-02) - khoi phuc styles bi mat trong 6A T8 rewrite
   (991ba75 da xoa toan bo style scoped): root phu canvas, AI panel
   neo trai-tren ("bang chon muc tieu" - user report), battlefield
   la vung chua. Gia tri NGUYEN BAN tu 71357a1^ - khong cai thien
   tuy tien. Status/event/control bar rules KHONG khoi phuc (da
   retire dung chu y). */
.combat-scene-overlay {
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
  position: relative;
  flex: 1 1 auto;
  pointer-events: none;
}

/* Spec 10 ai-panel 16/140/228/280 on the 1672x941 canvas: left
   0.96vw, canvas-top 14.88vh (the battlefield starts under the top
   bar, so subtract --combat-topbar-h), 13.64vw wide, capped at
   29.76vh tall with internal scroll. */
.combat-scene-overlay__ai-panel {
  position: absolute;
  left: 0.96vw;
  top: calc(14.88vh - var(--combat-topbar-h));
  width: 13.64vw;
  max-height: 29.76vh;
  overflow-y: auto;
  z-index: 12;
}

/* Slice 7 extension - turn-order strip: neo duoi TopBar, giua.
   Layout fix (2026-09-06) - truoc dung hardcode top: 60px (xap xi chieu
   cao TopBar), nay doi sang dung token --combat-topbar-h ma TopBar va
   CombatSkillDockPanel deu dung de tro height/top cua chinh no. Strip va
   dock gio neo CUNG mot mep duoi TopBar thay vi 2 gia tri lech nhau -
   giam kha nang strip "cat" vao phan tren cua dock. Strip van full-width
   + justify-content: center nen noi dung thuc te (party/turn badges) nam
   giua man hinh; o viewport rat hep noi dung can giua co the van cham mep
   trai cua dock - pointer-events: none nen khong chan thao tac, nhung
   overlap hinh anh trong truong hop cuc hep chua duoc xu ly triet de o
   task nay (xem bao cao). */
.combat-scene-overlay__turn-order-strip {
  position: absolute;
  /* Spec scene 13 turn-strip y=64 of 941 (6.8vh) - it rides 8 design px
     (0.85vh) below the 56px top bar rather than flush against it. */
  top: calc(var(--combat-topbar-h) + 0.85vh);
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 12;
}


</style>
