// Clip-screenshot a DOM rect: node cdp-clip.mjs "<selector>" <pad> <out.png>
import http from 'node:http'
import fs from 'node:fs'

const selector = process.argv[2]
const pad = Number(process.argv[3] ?? 8)
const out = process.argv[4] || 'clip.png'

const list = await new Promise((res, rej) => {
  http.get('http://localhost:29229/json/list', (r) => {
    let d = ''
    r.on('data', (c) => (d += c))
    r.on('end', () => res(JSON.parse(d)))
  }).on('error', rej)
})
const page = list.find((t) => t.type === 'page' && t.url.includes('localhost:5999/'))
if (!page) { console.error('NO_PAGE'); process.exit(1) }

const ws = new WebSocket(page.webSocketDebuggerUrl)
const send = (id, method, params) => ws.send(JSON.stringify({ id, method, params }))
const pending = new Map()
let idc = 0
const call = (method, params) => new Promise((res, rej) => {
  const id = ++idc
  pending.set(id, { res, rej })
  send(id, method, params)
})
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id).res(m.result ?? m); pending.delete(m.id) }
}
await new Promise((r) => { ws.onopen = r })

const evalRes = await call('Runtime.evaluate', {
  expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`,
  returnByValue: true,
})
const rect = evalRes?.result?.value
if (!rect) { console.error('NO_EL'); process.exit(1) }

const shot = await call('Page.captureScreenshot', {
  format: 'png',
  clip: { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), width: rect.w + pad * 2, height: rect.h + pad * 2, scale: 2 },
})
fs.writeFileSync(out, Buffer.from(shot.data, 'base64'))
console.log(out, JSON.stringify(rect))
process.exit(0)
