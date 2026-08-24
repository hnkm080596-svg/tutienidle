import fs from 'node:fs'

const raw = fs.readFileSync('src/core/battle/BattleSystem.ts', 'utf8')
let bal = 0
let line = 1
let inStr: string | null = null
let inLineComment = false
let inBlock = false

for (let i = 0; i < raw.length; i++) {
  const ch = raw[i]!
  const nx = raw[i + 1]

  if (ch === '\n') line++
  if (inLineComment) { if (ch === '\n') inLineComment = false; continue }
  if (inBlock) { if (ch === '*' && nx === '/') { inBlock = false; i++ } continue }
  if (inStr) { if (ch === inStr && raw[i - 1] !== '\\') inStr = null; continue }
  if (ch === '/' && nx === '/') { inLineComment = true; continue }
  if (ch === '/' && nx === '*') { inBlock = true; i++; continue }
  if (ch === '"' || ch === "'") { inStr = ch; continue }

  if (ch === '{') bal++
  if (ch === '}') {
    bal--
    if (bal < 0) { console.log('EXTRA } at line', line); bal = 0 }
  }
}
console.log('final balance:', bal)
