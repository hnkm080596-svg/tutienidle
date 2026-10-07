import { chromium } from 'playwright';
import fs from 'node:fs';
const out='docs/design/tien-hiep-ui-redesign-2026-10-05/wire-outcomes-live';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto('http://127.0.0.1:5449/');
await page.getByTestId('auth-screen').waitFor();await page.getByTestId('auth-begin-button').click();await page.getByTestId('auth-guest-button').click();
await page.getByTestId('creation-name-input').fill('Outcome QA');await page.locator('[data-testid^="creation-talent-"]').first().click();await page.getByTestId('creation-finish').click();
await page.locator('.game-root').waitFor();await page.getByTestId('presentation-overlay').locator('[data-phase="idle"]').count();
await page.waitForFunction(()=>document.querySelector('[data-testid="presentation-overlay"]')?.getAttribute('data-phase')==='idle');
if(await page.locator('.tutorial-overlay').isVisible())await page.getByRole('button',{name:'Bỏ Qua'}).click();
await page.locator('[data-df-navigation="teleport_array"]').click();
await page.getByTestId('stage-start-button').waitFor();await page.getByTestId('stage-start-button').click();
await page.locator('.combat-scene-overlay').waitFor();
await page.waitForFunction(()=>document.querySelector('[data-testid="presentation-overlay"]')?.getAttribute('data-phase')==='idle');
await page.locator('.combat-skill-dock-panel').waitFor({timeout:30000});
await page.screenshot({path:out+'/combat-1600.png'});
const measures=await page.evaluate(()=>({canvas:document.querySelectorAll('canvas').length,root:document.querySelector('.combat-scene-overlay')?.getBoundingClientRect().toJSON(),top:document.querySelector('.combat-top-bar')?.getBoundingClientRect().toJSON(),dock:document.querySelector('.combat-skill-dock-panel')?.getBoundingClientRect().toJSON()}));
console.log(JSON.stringify({measures,errors}));
await page.locator('.turn-combat-skill-bar__mode-toggle input').uncheck();
await page.locator('.combat-ai-panel__option input').nth(1).check();
console.log('AUTO_AND_AI_COMMANDS_PASS');
await page.locator('.combat-defeat-panel').waitFor({timeout:90000});await page.screenshot({path:out+'/defeat-1600.png'});
await page.locator('.combat-defeat-panel__return').click();await page.waitForFunction(()=>!document.querySelector('.combat-scene-overlay'));
console.log('RETURN_HOME_PASS');
} catch(e){await page.screenshot({path:out+'/failure.png'});console.log(JSON.stringify({error:e.message,errors}));process.exitCode=1;}finally{await browser.close()}
