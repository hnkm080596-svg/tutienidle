import http from 'node:http'
const list = await new Promise((res, rej) => {
  http.get('http://localhost:29229/json/list', (r) => {
    let d = ''
    r.on('data', (c) => (d += c))
    r.on('end', () => res(JSON.parse(d)))
  }).on('error', rej)
})
const page = list.find((t) => t.type === 'page' && t.url.includes('localhost:5999'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
const send = (id, method, params) =>
  new Promise((res) => {
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id === id) res(m)
    }
    ws.send(JSON.stringify({ id, method, params }))
  })
await send(1, 'Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
})
ws.close()
console.log('emulation cleared')
