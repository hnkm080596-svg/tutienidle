<script setup lang="ts">
import { shallowRef } from 'vue'
import HomeProductionArtPanel from './HomeProductionArtPanel.vue'
import HomeSupportArtPanel from './HomeSupportArtPanel.vue'
import HomeQuestArtPanel from './HomeQuestArtPanel.vue'
import HomeExplorationArtPanel from './HomeExplorationArtPanel.vue'
import HomeFormationArtPanel from './HomeFormationArtPanel.vue'
import HomeAlchemyArtPanel from './HomeAlchemyArtPanel.vue'
import HomeInventoryArtPanel from './HomeInventoryArtPanel.vue'
import HomeSkillArtPanel from './HomeSkillArtPanel.vue'
import HomeEquipmentArtPanel from './HomeEquipmentArtPanel.vue'
import HomeRealmArtPanel from './HomeRealmArtPanel.vue'
import HomeTechniqueArtPanel from './HomeTechniqueArtPanel.vue'
import HomeBodyArtPanel from './HomeBodyArtPanel.vue'
import HomeCharacterArtPanel from './HomeCharacterArtPanel.vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { pcPaperIconUrl, type PcPaperIcon } from '@/presentation/assets/PcPaperIcons'
import { pcPaperControlStyles, pcPaperResourceUrl } from '@/presentation/assets/PcPaperControls'
import '@/assets/pc-paper-scene.css'

const { t } = useI18n()
const opening = new URLSearchParams(window.location.search).get('example') === 'opening'
const begun = shallowRef(false)
const background = resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/source/${opening ? 'opening' : 'world'}-vista-warm-v1.png`)
const style = { backgroundImage: `url("${background}")`, ...pcPaperControlStyles(), '--home-nav-art': `url("${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/navigation-medallion-v1.png')}")` }
const lockedNavigation: readonly PcPaperIcon[] = ['artifact','companion','guild','sect','portal']
const allNavigation: PcPaperIcon[] = ['home','character','skill','equipment','body','technique','realm','inventory','alchemy','formation','exploration','quest','production','vendor','settings','feedback',...lockedNavigation]
const activePanel = shallowRef<'character' | 'skill' | 'equipment' | 'body' | 'technique' | 'realm' | 'inventory' | 'alchemy' | 'formation' | 'exploration' | 'quest' | 'settings' | 'feedback' | 'production' | null>(null)
const railCollapsed = shallowRef(false)
const railIndicator = shallowRef(false)
function toggleRail() { railCollapsed.value = !railCollapsed.value; if (!railCollapsed.value) railIndicator.value = false }
function onRailTransitionEnd(event: TransitionEvent) { if (event.propertyName === 'transform' && railCollapsed.value) railIndicator.value = true }
function navigationLabel(id: PcPaperIcon) { return t(id === 'skill' ? 'skill.title' : id) }
function openPreview(id: PcPaperIcon) {
  if (lockedNavigation.includes(id)) return
  if (id === 'character' || id === 'skill' || id === 'equipment' || id === 'body' || id === 'technique' || id === 'realm' || id === 'inventory' || id === 'alchemy' || id === 'formation' || id === 'exploration' || id === 'quest' || id === 'settings' || id === 'feedback' || id === 'production') activePanel.value = id
  else if (id === 'home') activePanel.value = null
}
</script>

<template>
  <SceneDesignCanvas>
    <section class="landscape-design pc-paper-scene" :style="style" :data-design-example="opening ? 'opening' : 'home'">
      <div class="pc-paper-scene__frame" />
      <template v-if="opening">
        <header class="opening-design-title"><h1>{{ t('gameTitle') }}</h1><span>{{ t('gameSubtitle') }}</span></header>
        <div class="opening-design-actions">
          <PcPaperButton v-if="!begun" variant="secondary" @click="begun = true">{{ t('begin') }}</PcPaperButton>
          <template v-else><PcPaperButton v-for="id in ['login', 'newGame', 'guest', 'settings']" :key="id" variant="secondary">{{ t(id) }}</PcPaperButton><label>{{ t('playerId') }}<input :placeholder="t('playerIdPlaceholder')"></label></template>
        </div>
        <nav class="opening-design-tools"><PcPaperButton v-for="id in ['settings', 'quest', 'feedback']" :key="id" variant="secondary" icon :aria-label="t(id)"><img :src="pcPaperIconUrl(id as PcPaperIcon)" alt=""></PcPaperButton></nav>
      </template>
      <template v-else>
        <header class="home-design-profile"><div class="home-design-avatar"><img :src="pcPaperIconUrl('character')" alt=""></div><div><h2>{{ t('playerName') }}</h2><p>Lv. 35 <span class="home-design-progress"><i /></span></p></div></header>
        <div class="home-design-currencies"><PcPaperButton v-for="(amount,index) in ['1.280','325.600','4.360','120']" :key="amount" variant="secondary"><img :src="pcPaperResourceUrl((['jade','coin','crystal','essence'] as const)[index]!)" alt=""><b>{{ amount }}</b><span>＋</span></PcPaperButton></div>
        <aside class="home-design-quest"><h3>{{ t('quest') }} <span>›</span></h3><p>{{ t('questDescription') }}</p><span>1/3</span><div class="home-design-progress"><i /></div></aside>
      </template>
      <aside v-if="!opening" class="home-navigation-surface" :class="{ 'home-navigation-surface--collapsed': railCollapsed }" @transitionend="onRailTransitionEnd"><img class="home-navigation-backing" :src="resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/navigation-backing-dark-v3.png')" alt=""><nav class="home-independent-navigation"><button v-for="id in allNavigation" :key="id" :class="{ active: id === activePanel, locked: lockedNavigation.includes(id) }" :disabled="lockedNavigation.includes(id)" :aria-label="id" @click="openPreview(id)"><img :src="resolveAssetUrl('/assets/ui/tien-hiep-2026-10/icons/navigation-'+id+'-v2.png')" alt=""><span>{{ navigationLabel(id) }}</span></button></nav><button v-if="!railCollapsed" class="home-navigation-collapse" type="button" aria-label="Close rail" @click.stop="toggleRail()">«</button></aside>
      <img v-if="activePanel !== null" class="home-navigation-landscape-seam" :class="{ 'home-navigation-landscape-seam--collapsed': railCollapsed }" :src="resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/navigation-landscape-seam-v1.png')" alt="">
      <button v-if="railCollapsed && railIndicator" class="home-navigation-toggle" type="button" aria-label="Open rail" @click.stop="toggleRail()">»</button>
      <HomeCharacterArtPanel v-if="activePanel === 'character'" /><HomeSkillArtPanel v-if="activePanel === 'skill'" />
      <HomeEquipmentArtPanel v-if="activePanel === 'equipment'" />
      <HomeBodyArtPanel v-if="activePanel === 'body'" /><HomeTechniqueArtPanel v-if="activePanel === 'technique'" /><HomeRealmArtPanel v-if="activePanel === 'realm'" /><HomeInventoryArtPanel v-if="activePanel === 'inventory'" /><HomeAlchemyArtPanel v-if="activePanel === 'alchemy'" /><HomeProductionArtPanel v-if="activePanel === 'production'" /><HomeSupportArtPanel v-if="activePanel === 'settings' || activePanel === 'feedback'" :kind="activePanel" /><HomeQuestArtPanel v-if="activePanel === 'quest'" /><HomeExplorationArtPanel v-if="activePanel === 'exploration'" /><HomeFormationArtPanel v-if="activePanel === 'formation'" />
    </section>
  </SceneDesignCanvas>
</template>

<style scoped>
.home-navigation-surface {position:absolute;left:18px;top:12.5%;width:335px;height:75%;z-index:23;overflow:visible;transition:transform 260ms ease;}.home-navigation-surface--collapsed {transform:translateX(-107%);}.home-navigation-backing {position:absolute;top:-4.07%;left:0;width:100%;height:107.07%;object-fit:contain;pointer-events:none;}.home-navigation-landscape-seam {position:absolute;left:260px;top:12.5%;width:125px;height:75%;object-fit:cover;z-index:22;pointer-events:none;transition:transform 260ms ease,opacity 260ms ease;}.home-navigation-landscape-seam--collapsed {transform:translateX(-280px);opacity:0;}.home-navigation-toggle,.home-navigation-collapse {position:absolute;top:50%;transform:translateY(-50%);z-index:24;width:30px;height:88px;padding:0;border:1px solid #a9863f;border-radius:0 8px 8px 0;background:linear-gradient(#3a3a2c,#22241c);color:#e8cf93;font-size:17px;cursor:pointer;}.home-navigation-toggle {left:0;}.home-navigation-collapse {right:-30px;}.home-navigation-toggle:hover,.home-navigation-collapse:hover {color:#ffe9ae;}

.home-independent-navigation { position:absolute;inset:12px 8px;z-index:1;display:flex;flex-direction:column;gap:20px;padding:8px 6px 8px 29px;overflow-y:auto;scrollbar-width:none;overscroll-behavior:contain;background:transparent; }
.home-independent-navigation::-webkit-scrollbar {display:none;}.home-independent-navigation button {position:relative;flex:none;height:65px;width:235px;display:flex;align-items:center;padding:7px 14px 7px 9px;gap:18px;border:0;background:transparent;color:#efdcb6;font:700 17px var(--pc-font-body);cursor:pointer;}.home-independent-navigation button {transition:transform 180ms ease,filter 180ms ease;transform-origin:left center;}.home-independent-navigation button.active {transform:scale(1.1);filter:none;color:#efdcb6;}.home-independent-navigation button.active::before {filter:brightness(1.22) drop-shadow(0 0 4px #ffd279) drop-shadow(0 0 9px #df9b3f90);}.home-independent-navigation img {position:absolute;left:39px;top:48%;transform:translateY(-50%);width:35px;height:35px;object-fit:contain;}.home-independent-navigation button>span {margin-left:84px;}.home-independent-navigation button::before {content:"";position:absolute;inset:0;z-index:-1;background:var(--home-nav-art) center/contain no-repeat;}

.landscape-design { background-size: 100% 100%; }
.opening-design-title { position:absolute;left:130px;top:92px;text-align:center;color:#251907; }
.opening-design-title h1 { font:700 108px/1.1 var(--pc-font-body);margin:0;letter-spacing:-4px; }
.opening-design-title span { display:block;letter-spacing:5px;font-size:23px;margin-top:12px;color:#9e7238; }
.opening-design-actions { position:absolute;left:568px;top:330px;width:310px;display:flex;flex-direction:column;gap:17px; }
.opening-design-actions .pc-paper-button { min-height:66px;font-size:28px; }
.opening-design-actions label { display:flex;flex-direction:column;gap:6px;color:#4c3a21;font-size:16px; }
.opening-design-actions input { border:1px solid #b69558;background:#f6e8ca90;padding:8px 12px;font:18px var(--pc-font-body); }
.opening-design-tools { position:absolute;right:37px;top:33px;display:flex;gap:18px; }
.opening-design-tools img { width:34px;height:34px;object-fit:contain;filter:brightness(0) invert(.9) sepia(.45); }
.home-design-profile { position:absolute;left:32px;top:14px;display:flex;align-items:center;gap:25px; }
.home-design-avatar { width:95px;height:95px;border:4px double #b28a43;border-radius:50%;background:#f1dfbb;display:grid;place-items:center; }
.home-design-avatar img { width:75px;height:75px;object-fit:contain; }
.home-design-profile h2 { font-size:25px;margin:0 0 8px; }
.home-design-profile p { margin:0;font-size:17px;display:flex;align-items:center;gap:15px; }
.home-design-progress { display:inline-block;width:145px;height:8px;background:#2b2a20;border:1px solid #aa8040;border-radius:8px;overflow:hidden; }
.home-design-progress i { display:block;width:38%;height:100%;background:#d6a852; }
.home-design-currencies { position:absolute;left:682px;top:14px;display:flex;gap:12px; }
.home-design-currencies .pc-paper-button { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 10px;min-height:38px;font-size:17px;min-width:148px; }
.home-design-currencies img { width:28px;height:28px;object-fit:contain; }
.home-design-quest { position:absolute;right:30px;top:85px;width:245px;padding:14px 18px 20px;background:#f9edd5df;border:3px double #a67c34; }
.home-design-quest h3 { margin:-14px -18px 17px;padding:10px 16px;background:#28271f;color:#f1dfb9;font-size:22px; }
.home-design-quest h3 span { float:right; }
.home-design-quest p { margin:0 0 13px;font-size:17px; }
.home-design-quest>span { display:block;text-align:right; }
.home-design-quest .home-design-progress { width:100%;margin-top:7px; }
.home-design-footer { position:absolute;bottom:8px;left:8px;right:8px;height:75px;display:flex;align-items:center;padding:0 78px;background:#f8e9cdea;border:3px double #b48a42; }
.home-design-footer button { display:flex;align-items:center;justify-content:center;gap:16px;flex:1;height:44px;border:0;border-right:1px solid #b58b4770;background:transparent;color:#2b2113;font:20px var(--pc-font-body); }
.home-design-footer button:last-child { border-right:0; }.home-design-footer button.active { background:radial-gradient(ellipse,#e3b85299,transparent 75%);font-weight:700; }
.home-design-footer img { width:36px;height:36px;object-fit:contain; }
</style>





















<style scoped>
.home-independent-navigation button.locked {filter:grayscale(1);opacity:.48;cursor:default;}
</style>




