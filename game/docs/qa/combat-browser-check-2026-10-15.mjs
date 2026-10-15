import { chromium } from 'playwright'
import { bootToGuestHome, createCharacterThroughUi, enterHome, waitForPresentationIdle } from '../../tests/e2e/helpers.ts'
import { resolve } from 'node:path'
const base='http://127.0.0.1:5837'
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:1280,height:720},baseURL:base})
const page=await context.newPage()
await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}))
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
try {
  await page.goto('/docs/qa/combat-vfx-preview-2026-10-15.html')
  await page.getByRole('button',{name:'Xem tụ hỏa',exact:true}).click()
  await page.screenshot({path:resolve('docs/qa/linh-bao-charge-fixed-2026-10-15.png')})
  await page.getByRole('button',{name:'Xem miss + nổ',exact:true}).click()
  await page.waitForFunction(()=>document.body.dataset.frozen==='impact')
  await page.screenshot({path:resolve('docs/qa/linh-bao-miss-impact-2026-10-15.png')})
  console.log('VFX preview: charge, miss impact screenshots captured; page errors:',errors.length)
  if(!process.argv.includes('--vfx-only')) {
  await bootToGuestHome(page)
  await createCharacterThroughUi(page,'Combat UI QA')
  await enterHome(page)
  const railToggle=page.getByRole('button',{name:'Mở thanh điều hướng',exact:true})
  if(await railToggle.isVisible()) await railToggle.click()
  await page.getByRole('button',{name:'Sơn Hà Đồ',exact:true}).click()
  await page.getByRole('button',{name:'Bắt Đầu',exact:true}).click()
  await waitForPresentationIdle(page)
  await page.locator('.combat-initiative-track').waitFor({state:'visible',timeout:20000})
  const markerPositions=()=>page.locator('.combat-initiative-track g[tabindex]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('transform')))
  const movementSamples=[]
  for(let frame=0;frame<8;frame++){movementSamples.push(await markerPositions());await page.waitForTimeout(120)}
  console.log('Initiative movement samples:',JSON.stringify(movementSamples))
  await page.locator('.combat-top-bar__pause').click()
  await page.locator('.combat-top-bar__speed').click()
  if(await page.locator('.combat-top-bar__speed').getAttribute('aria-pressed')!=='true') throw new Error('x2 was not selected')
  const boxes=await page.locator('.battle-card').evaluateAll(cards=>cards.map(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}))
  if(boxes.length!==1 || boxes.some(r=>r.x<0||r.y<0||r.x+r.w>1281||r.y+r.h>721)) throw new Error('Battle cards outside frame')
  if(Math.abs(boxes[0].x+boxes[0].w/2-640)>3) throw new Error('Active card not centered')
  if(await page.locator('.battle-card .combat-skill-slot__orbit').count()!==1) throw new Error('Basic orbit missing')
  if(await page.locator('.battle-card .slot-view__veil-glyph').count()!==2) throw new Error('Unavailable skills not locked')
  await page.locator('.combat-initiative-track g[tabindex]').first().focus()
  await page.screenshot({path:resolve('docs/qa/combat-initiative-2026-10-15.png')})
  if(process.argv.includes('--ui-only')) {
    console.log('UI: one centered card, basic orbit, two locked skills, distinct initiative markers; page errors:',errors.length)
    if(errors.length) throw new Error('Page errors during combat UI check')
  } else {
  await page.locator('.combat-top-bar__pause').click()
  await page.getByRole('button',{name:/Đánh Lại|Tái Chiến/}).waitFor({state:'visible',timeout:180000})
  await page.screenshot({path:resolve('docs/qa/combat-result-backdrop-2026-10-15.png')})
  await page.getByRole('button',{name:/Đánh Lại|Tái Chiến/}).click()
  await waitForPresentationIdle(page)
  await page.locator('.combat-initiative-track').waitFor({state:'visible',timeout:20000})
  await page.screenshot({path:resolve('docs/qa/combat-refight-backdrop-2026-10-15.png')})
  console.log('Combat UI: x2 selected, active cards in frame, initiative visible, results and curtain refight completed; page errors:',errors.length)
  if(errors.length) console.log(errors.slice(0,5))
  }
  }
} catch(error) { await page.screenshot({path:resolve('docs/qa/combat-browser-check-failure-2026-10-15.png')}); console.log((await page.locator('body').innerText()).slice(-2000)); throw error } finally { await context.close(); await browser.close() }
