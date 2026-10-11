// Minimal CDP evaluate helper: node cdp-eval.mjs "<expression>" [awaitPromise]
// Prints the JSON-serialized result.
import http from 'node:http'
import crypto from 'node:crypto'

const expr = process.argv[2]
const awaitPromise = process.argv[3] === 'await'

const list = await new Promise((res, rej) => {
  http.get('http://localhost:29229/json/list', (r) => {
    let d = ''
    r.on('data', (c) => (d += c))
    r.on('end', () => res(JSON.parse(d)))
  }).on('error', rej)
})
const urlFilter = process.argv[4] || 'localhost:5999/'
const page = list.find((t) => t.type === 'page' &&
  (urlFilter.startsWith('=') ? t.url === urlFilter.slice(1) : t.url.includes(urlFilter)))
if (!page) {
  console.error('NO_PAGE')
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
const id = 1
const reply = await new Promise((res, rej) => {
  const to = setTimeout(() => rej(new Error('timeout')), 30000)
  ws.onopen = () => {
    ws.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression: expr, awaitPromise, returnByValue: true },
    }))
  }
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id === id) {
      clearTimeout(to)
      res(m)
    }
  }
  ws.onerror = rej
})
ws.close()
const r = reply.result
if (r.exceptionDetails) {
  console.log('THROW:', JSON.stringify(r.exceptionDetails).slice(0, 500))
} else {
  console.log(JSON.stringify(r.result?.value ?? r.result))
}
