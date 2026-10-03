// One-off P15 debt cleanup: rewrite non-ASCII characters inside COMMENT
// tokens only (never string literals) using the same tokenization as
// tests/architecture/helpers/asciiComments.ts + scripts/p15-baseline.mjs.
// Run from game/ cwd: node /home/ubuntu/p15-ascii-fix.mjs [root]
import { createRequire } from 'node:module'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const require = createRequire('/home/ubuntu/repos/tutienidle/game/package.json')
const { createScanner, ScriptTarget, SyntaxKind, LanguageVariant } = require('typescript')

const ROOT = join(process.cwd(), process.argv[2] ?? '.')
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'dist-electron', 'release', 'public',
  'art-source', 'asset-drop', 'playwright-report', 'test-results', '.git',
])
const NON_ASCII = /[^\x00-\x7F]/

// Explicit character map for symbols Vietnamese-diacritic stripping can't cover.
const CHAR_MAP = new Map(Object.entries({
  'đ': 'd', 'Đ': 'D',
  '→': '->', '⟶': '->', '↦': '->', '⇒': '=>', '⇐': '<-', '←': '<-',
  '↔': '<->', '↑': '^', '↓': 'v', '↗': '/', '↘': '\\',
  '—': '-', '–': '-', '‒': '-', '―': '-', '−': '-',
  '“': '"', '”': '"', '„': '"', '«': '"', '»': '"',
  '‘': "'", '’': "'", '‚': "'", '‛': "'",
  '…': '...', '⋯': '...',
  '×': 'x', '÷': '/', '±': '+/-', '∞': 'inf',
  '≥': '>=', '≤': '<=', '≠': '!=', '≈': '~', '≡': '==',
  '•': '*', '·': '*', '‣': '*', '◦': 'o', '∙': '*',
  '°': 'deg', 'µ': 'u',
  '─': '-', '━': '=', '│': '|', '┃': '|', '╌': '-', '╍': '=',
  '┌': '+', '┐': '+', '└': '+', '┘': '+',
  '├': '+', '┤': '+', '┬': '+', '┴': '+', '┼': '+',
  '═': '=', '║': '|', '╔': '#', '╗': '#', '╚': '#', '╝': '#',
  '╠': '#', '╣': '#', '╦': '#', '╩': '#', '╬': '#',
  '█': '#', '▓': '#', '▒': ':', '░': '.', '▌': '|', '▐': '|',
  '▀': '-', '▄': '_', '■': '#', '□': '#', '▪': '#', '▫': '.',
  '●': 'o', '○': 'o', '◆': '<>', '◇': '<>', '▲': '^', '▼': 'v',
  '►': '>', '◄': '<', '▶': '>', '◀': '<',
  '★': '*', '☆': '*', '✓': 'v', '✔': 'v', '✗': 'x', '✘': 'x',
  '⚠': '!', '☠': '!', '♦': '<>', '♥': '<3', '♠': '<>',
  'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'Δ': 'Delta',
  'θ': 'theta', 'λ': 'lambda', 'μ': 'mu', 'π': 'pi', 'σ': 'sigma',
  'Σ': 'Sigma', 'φ': 'phi', 'Φ': 'Phi', 'ω': 'omega', 'Ω': 'Omega',
  '½': '1/2', '¼': '1/4', '¾': '3/4',
  '①': '(1)', '②': '(2)', '③': '(3)', '④': '(4)', '⑤': '(5)',
  '⑥': '(6)', '⑦': '(7)', '⑧': '(8)', '⑨': '(9)', '⑩': '(10)',
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5',
  '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5',
  '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₫': 'VND',
  '©': '(c)', '®': '(R)', '™': '(TM)',
  '§': 'sec', '¡': '!', '¢': 'c', '¬': '!', 'Æ': 'AE', 'æ': 'ae',
  'œ': 'oe', 'Œ': 'OE', '†': '+', '‡': '+', '¿': '?', '¶': 'P',
  '‹': '<', '›': '>', '‰': 'o/oo', '¦': '|', '¤': '*', '¨': '"',
  '¯': '-', '´': "'", '¸': ',', 'º': 'o', 'ª': 'a',
  '∈': 'in', '∉': 'not in', '∝': '~', '⊇': 'superset', '⊆': 'subset',
  '↕': '<->', 'ˆ': '^', '�': '', '∘': 'o', 'ƒ': 'f',
  '­': '', '⬺': '>', '⬹': '<', '⬡': '#', '⬝': '#',
  '概': '', '率': '', '浪': '', '费': '', '窗': '', '口': '',
  ' ': ' ', '　': ' ',
}))

const unresolved = []
const census = new Map()
const CENSUS_ONLY = process.argv.includes('--census')

// UTF-8-read-as-Latin-1 mojibake recovery: a comment that was double-
// encoded contains only latin1-mappable chars; decoding back restores the
// original text (often proper Vietnamese/Unicode). Returns null when the
// decode yields U+FFFD (comment was not wholly mojibake) or when the input
// has no non-ASCII at all.
// CP1252 reverse map for the 0x80-0x9F block (where latin1 and CP1252
// differ). Covers every CP1252 glyph, so a double-encoded comment whose
// bytes passed through a Windows code page still round-trips.
const CP1252_GLYPHS = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…',
  0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: '‹',
  0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“',
  0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜',
  0x99: '™', 0x9a: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
}
const CP1252_REVERSE = new Map(
  Object.entries(CP1252_GLYPHS).map(([b, ch]) => [ch, Number(b)]),
)

// Bytes-level mojibake recovery. Try latin1 first, then CP1252 (which
// additionally maps the CP1252 0x80-0x9F glyph family back to bytes).
// Returns the decoded string when it is valid UTF-8 (no U+FFFD), else null.
function tryRecover(s) {
  if (!NON_ASCII.test(s)) return null
  for (const codec of ['latin1', 'cp1252']) {
    let bytes
    if (codec === 'latin1') {
      if ([...s].some((ch) => ch.codePointAt(0) > 0xff)) continue
      bytes = Buffer.from(s, 'latin1')
    } else {
      const arr = []
      let ok = true
      for (const ch of s) {
        const cp = ch.codePointAt(0)
        if (cp <= 0xff) arr.push(cp)
        else if (CP1252_REVERSE.has(ch)) arr.push(CP1252_REVERSE.get(ch))
        else { ok = false; break }
      }
      if (!ok) continue
      bytes = Buffer.from(arr)
    }
    const recovered = bytes.toString('utf8')
    if (!recovered.includes('�')) return recovered
  }
  return null
}

function toAscii(s, file, tag) {
  const recovered = tryRecover(s)
  if (recovered !== null) s = recovered
  let out = ''
  for (const ch of s) {
    if (ch.charCodeAt(0) < 0x80) { out += ch; continue }
    const cp = ch.codePointAt(0)
    if (cp >= 0x80 && cp <= 0x9f) continue // stray C1 control byte
    if (CHAR_MAP.has(ch)) { out += CHAR_MAP.get(ch); continue }
    // NFKD strips Latin/Greek diacritics to base letters (a, e, o, u...)
    const decomposed = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    if (/^[\x00-\x7F]+$/.test(decomposed) && decomposed.length > 0) {
      out += decomposed
    } else {
      census.set(ch, (census.get(ch) ?? 0) + 1)
      if (unresolved.length < 2000) unresolved.push(`${file} [${tag}] U+${ch.codePointAt(0).toString(16)} ${ch}`)
      out += '?'
    }
  }
  return out
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else {
      const dot = entry.lastIndexOf('.')
      const ext = dot < 0 ? '' : entry.slice(dot)
      if (ext === '.vue' || SOURCE_EXT.has(ext)) out.push(full)
    }
  }
  return out
}

// Collect [start,end) spans of non-ASCII comment tokens in a TS/JS chunk.
// Mirrors the repo helper's brace tracking: '}' closing a '${' hole must be
// re-scanned as TemplateMiddle/TemplateTail or the raw scanner desyncs.
function tsCommentSpans(text, base, spans) {
  const scanner = createScanner(ScriptTarget.Latest, false, LanguageVariant.Standard, text)
  const braceStack = []
  let kind = scanner.scan()
  while (kind !== SyntaxKind.EndOfFileToken) {
    if (kind === SyntaxKind.OpenBraceToken) {
      braceStack.push(false)
    } else if (kind === SyntaxKind.TemplateHead || kind === SyntaxKind.TemplateMiddle) {
      braceStack.push(true)
    } else if (kind === SyntaxKind.CloseBraceToken) {
      if (braceStack[braceStack.length - 1] === true) {
        braceStack.pop()
        kind = scanner.reScanTemplateToken(false)
        if (kind === SyntaxKind.TemplateMiddle) braceStack.push(true)
        if (kind === SyntaxKind.EndOfFileToken) break
      } else {
        braceStack.pop()
      }
    }
    if (
      (kind === SyntaxKind.SingleLineCommentTrivia || kind === SyntaxKind.MultiLineCommentTrivia) &&
      NON_ASCII.test(scanner.getTokenText())
    ) {
      const start = base + scanner.getTokenPos()
      spans.push([start, start + scanner.getTokenText().length])
    }
    kind = scanner.scan()
  }
}

function vueRegionSpans(text, base, spans) {
  for (const re of [/<!--[\s\S]*?-->/g, /\/\*[\s\S]*?\*\//g]) {
    for (const m of text.matchAll(re)) {
      if (NON_ASCII.test(m[0])) spans.push([base + m.index, base + m.index + m[0].length])
    }
  }
}

function fileSpans(path, text) {
  const spans = []
  if (path.endsWith('.vue')) {
    const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi
    let last = 0
    let m
    while ((m = scriptRe.exec(text)) !== null) {
      vueRegionSpans(text.slice(last, m.index), last, spans)
      const bodyStart = m.index + m[0].indexOf('>') + 1
      tsCommentSpans(m[1] ?? '', bodyStart, spans)
      last = m.index + m[0].length
    }
    vueRegionSpans(text.slice(last), last, spans)
  } else {
    tsCommentSpans(text, 0, spans)
  }
  return spans
}

let filesTouched = 0, commentsFixed = 0
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8')
  const spans = fileSpans(file, text)
  if (spans.length === 0) continue
  const rel = relative(ROOT, file).split(sep).join('/')
  // Apply back-to-front so earlier positions stay valid.
  let out = text
  for (const [s, e] of spans.sort((a, b) => b[0] - a[0])) {
    out = out.slice(0, s) + toAscii(out.slice(s, e), rel, `${s}`) + out.slice(e)
  }
  if (out !== text) {
    if (!CENSUS_ONLY) writeFileSync(file, out)
    filesTouched++
    commentsFixed += spans.length
  }
}
console.log(`${CENSUS_ONLY ? 'census' : 'fixed'} ${commentsFixed} comments across ${filesTouched} files`)
for (const [ch, n] of [...census.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`U+${ch.codePointAt(0).toString(16).padStart(4, '0')} ${ch}  x${n}`)
}
