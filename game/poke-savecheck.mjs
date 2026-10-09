import { chromium } from 'playwright-core'
const b = await chromium.connectOverCDP('http://localhost:29229')
const p = b.contexts()[0].pages().find(pg => pg.url().includes('localhost:5393')) ?? b.contexts()[0].pages()[0]
const raw = await p.evaluate(() => localStorage.getItem('tien-hiep-idle-save:guest') ?? localStorage.getItem('tien-hiep-idle-save'))
if (!raw) { console.log('NO SAVE'); }
else {
  const s = JSON.parse(raw)
  const pl = s.player ?? s
  console.log(JSON.stringify({
    name: pl.name, realm: pl.realm, cultivationPath: pl.cultivationPath,
    spellPath: pl.spellPath ?? null,
  }))
}
await b.close()
