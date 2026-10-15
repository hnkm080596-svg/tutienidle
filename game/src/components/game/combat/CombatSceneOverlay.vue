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
import { useI18n } from 'vue-i18n'
import CombatTopRail from '@/components/scenes/combat/CombatTopRail.vue'
import CombatTurnRail from '@/components/scenes/combat/CombatTurnRail.vue'
import CombatAiRail from '@/components/scenes/combat/CombatAiRail.vue'
import CombatPartyDock from './hud/CombatPartyDock.vue'
import { clearSkillDockWidth } from '@/presentation/geometry/combatInsets'
import CombatLogFeed from '@/components/scenes/combat/CombatLogFeed.vue'
import CombatModalLayer from '@/components/scenes/combat/CombatModalLayer.vue'
import CombatPanel from '@/components/scenes/combat/CombatPanel.vue'
import CombatControlButton from '@/components/scenes/combat/CombatControlButton.vue'
import { publishTopBarHeight, resetCombatInsets } from '@/presentation/geometry/combatInsets'
import { useTurnCombatManual } from '@/composables/useTurnCombatManual'
import { useGameManager } from '@/composables/useGameState'
import { skillIconPath } from '@/data/skill/SkillIconManifest'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const { t } = useI18n()
const rootRef = ref<HTMLElement | null>(null)
const layoutVersion = ref(0)
const logOpen = ref(false)
const manager = useGameManager()
let assetsPending = false
let mounted = false
let releaseAssetLatch: (() => void) | undefined
async function prepareChrome(): Promise<void> {
  await nextTick()
  const root = rootRef.value
  if (!root || !mounted) return
  const urls = new Set<string>()
  for (const node of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    if (node instanceof HTMLImageElement && node.src) urls.add(node.src)
    for (const pseudo of [null, '::before', '::after']) {
      for (const match of getComputedStyle(node, pseudo).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.add(match[1]!)
    }
  }
  for (const actor of manager.getTurnBattle()?.players ?? []) {
    for (const skill of [actor.basic, actor.special?.skill, actor.ultimate?.skill]) {
      const icon = skill && skillIconPath(turnSkillDisplayMetaOf(skill.id)?.iconKey)
      if (icon) urls.add(resolveAssetUrl(icon))
    }
  }
  await Promise.allSettled([...urls].map(url => {
    const image = new Image()
    image.src = url
    return image.decode()
  }))
  await document.fonts.ready
  if (mounted) { assetsPending = false; manager.resumeCombat('ui-assets') }
}

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
  mounted = true
  assetsPending = true
  releaseAssetLatch = manager.registerFreezeLatchTruth('ui-assets', () => assetsPending)
  manager.freezeCombat('ui-assets')
  void prepareChrome()
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
  mounted = false
  assetsPending = false
  manager.resumeCombat('ui-assets')
  releaseAssetLatch?.()
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


      <!-- Combat AI panel - goc TRAI battlefield, chi panel nhan pointer. -->
      <CombatAiRail class="combat-scene-overlay__ai-panel" />
    </div>

    <!-- Slice 7 extension - turn-order preview (top, duoi TopBar) + battle
         log (goc phai-duoi, self-guarded khi khong fighting). -->
    <CombatTurnRail class="combat-scene-overlay__turn-order-strip" />

    <CombatLogFeed v-if="logOpen" />
    <CombatControlButton class="combat-scene-overlay__log-toggle" :aria-expanded="logOpen" @click="logOpen = !logOpen">{{ t(logOpen ? 'combat.overlay.healthHud.hideLog' : 'combat.overlay.healthHud.showLog') }}</CombatControlButton>


    <!-- 6A-T6 - confirm thoat tran + result/intro/countdown (scene exit
         zone -> bridge event). -->
  </div>
  <template #overlays><CombatModalLayer /></template>
  </CombatPanel>
</template>
<style scoped>
/* T8.1 (2026-09-02) - khoi phuc styles bi mat trong 6A T8 rewrite
   (991ba75 da xoa toan bo style scoped): root phu canvas, AI panel
   neo trai-tren ("bang chon muc tieu" - user report), battlefield
   la vung chua. Gia tri NGUYEN BAN tu 71357a1^ - khong cai thien
   tuy tien. Status/event/control bar rules KHONG khoi phuc (da
   retire dung chu y). */
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
  position: relative;
  flex: 1 1 auto;
  pointer-events: none;
}

/* ui-combat reskin (2026-10-04): mock ui-combat.html anchors the AI
   panel at left:22 top:198 of the 1366x768 canvas (~25.8vh), BELOW the
   player card it must no longer overlap. Ours sits a touch lower
   (~28vh) so the slightly taller real player card clears it - and the
   max() floor keeps it under the card even on short viewports where
   28vh lands above the card's ~1.8vh+190px bottom edge.
   left 0.96vw / width 13.64vw / scroll cap stay from spec 10. */
.combat-scene-overlay__ai-panel {
  position: absolute;
  left: 22px;
  top: 104px;
  width: 235px;
  max-height: 400px;
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
  top: 99px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 12;
}


.combat-scene-overlay__battlefield { position: absolute; inset: 0; }
.combat-scene-overlay__ai-panel { left: 24px; top: 476px; width: 210px; max-height: 380px; overflow: visible; }
.combat-scene-overlay__turn-order-strip { top: 0; left: 50%; right: auto; width: 640px; transform: translateX(-50%); }
.combat-scene-overlay__log-toggle { position: absolute; left: 24px; top: 528px; bottom: auto; pointer-events: auto; }
</style>


