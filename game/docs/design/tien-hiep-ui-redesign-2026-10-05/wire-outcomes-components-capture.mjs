import { chromium } from 'playwright';
import fs from 'node:fs';
const out='docs/design/tien-hiep-ui-redesign-2026-10-05/wire-outcomes-components';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));let vueUrl='';let piniaUrl='';page.on('request',r=>{if(r.url().includes('/deps/vue.js?v='))vueUrl=r.url();if(r.url().includes('/deps/pinia.js?v='))piniaUrl=r.url()});
try {
await page.goto('http://127.0.0.1:5449/ui-combat-outcome-design.html');
await page.locator('.co-stage').waitFor();
await page.evaluate(async()=>{await import('/src/assets/pc-paper-production.css')});
for(const kind of ['victory','defeat','tribulation']) {
 await page.evaluate(async({kind,vueUrl,piniaUrl})=>{
  window.outcomeFixtureApp?.unmount();document.querySelector('#outcome-fixture')?.remove();
  const [{createApp,h,ref},{createPinia},{i18n},{GameManager},state,{usePlayerStore},{pcPaperControlStyles}]=await Promise.all([import(vueUrl),import(piniaUrl||vueUrl.replace('vue.js','pinia.js')),import('/src/i18n/index.ts'),import('/src/core/game/GameManager.ts'),import('/src/composables/useGameState.ts'),import('/src/stores/player.ts'),import('/src/presentation/assets/PcPaperControls.ts')]);
  const pinia=createPinia();const manager=new GameManager();manager.setActivePlayer(usePlayerStore(pinia).$state);
  const components={victory:(await import('/src/components/scenes/victory/VictoryScene.vue')).default,defeat:(await import('/src/components/game/combat/CombatDefeatPanel.vue')).default};
  const summary={techniqueMastery:10,skillInsight:5,artifactInsight:2,spiritStone:120,items:[]};
  let render=()=>h(components[kind],kind==='victory'?{summary,runMode:'manual',countdownLabel:''}:{});
  if(kind==='tribulation'){
   const [Status,Mind,Hp,Result]=await Promise.all(['TribulationStatusCard','TribulationMindCard','TribulationHpCluster','TribulationResultBanner'].map(async name=>(await import('/src/components/scenes/tribulation/'+name+'.vue')).default));
   render=()=>h('div',{class:'tribulation-ui pc-outcome-live',style:{...pcPaperControlStyles(),color:'#f2e2ba'}},[h(Status,{chapterName:'Tâm Ma',chapterProgress:'1 / 3',secondsRemaining:18,strikesTaken:2,showTank:true}),h(Mind,{question:'Giữ tâm bất động giữa thiên địa?',answers:['Giữ vững đạo tâm','Lùi bước'],secondsRemaining:18,secondsLimit:30}),h(Hp,{hp:108,maxHp:120})]);
  }
  const el=document.createElement('div');el.id='outcome-fixture';el.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#182017dd';document.body.append(el);
  const app=createApp({render});app.use(pinia).use(i18n).provide(state.GAME_MANAGER_KEY,manager).provide(state.STATE_VERSION_KEY,ref(0)).provide(state.BUMP_STATE_KEY,()=>{});app.mount(el);window.outcomeFixtureApp=app;
 },{kind,vueUrl,piniaUrl});
 await page.waitForTimeout(600);
 console.log(await page.locator('#outcome-fixture').evaluate(el=>({kind:el.className,html:el.innerHTML.slice(0,450),styles:document.querySelectorAll('style').length,paper:getComputedStyle(el.querySelector('.pc-paper-chrome')||el).position})));
 await page.screenshot({path:out+'/'+kind+'-1600.png'});
 await page.setViewportSize({width:1280,height:720});await page.screenshot({path:out+'/'+kind+'-1280.png'});await page.setViewportSize({width:1600,height:900});
}
console.log(JSON.stringify({fixtureComponents:'PASS_RENDERED',errors}));
await page.evaluate(()=>window.outcomeFixtureApp?.unmount());
} catch(e){console.log(JSON.stringify({error:e.message,errors}));process.exitCode=1;}finally{await browser.close()}

