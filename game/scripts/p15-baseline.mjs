// P15 baseline generator - records every existing non-ASCII COMMENT
// (never string literals) per file into
// tests/architecture/baselines/asciiComments.json. The ratchet guard
// fails only on violations NOT in this baseline, so regenerating
// shrinks the allowed set as legacy comments get cleaned. Implements
// the identical algorithm as
// tests/architecture/helpers/asciiComments.ts - keep them in sync.
import { createRequire } from 'node:module'
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, sep, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { createScanner, ScriptTarget, SyntaxKind, LanguageVariant } = require('typescript')
const __dirname = dirname(fileURLToPath(import.meta.url))

const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'tests', 'architecture', 'baselines', 'asciiComments.json')

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'dist-electron', 'release', 'public',
  'art-source', 'asset-drop', 'playwright-report', 'test-results', '.git',
])
const NON_ASCII = /[^\x00-\x7F]/

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

const normalize = (s) => s.replace(/\s+/g, ' ').trim()

function scanTsChunk(text, violations) {
  const scanner = createScanner(ScriptTarget.Latest, false, LanguageVariant.Standard, text)
  let kind = scanner.scan()
  while (kind !== SyntaxKind.EndOfFileToken) {
    if (
      (kind === SyntaxKind.SingleLineCommentTrivia || kind === SyntaxKind.MultiLineCommentTrivia) &&
      NON_ASCII.test(scanner.getTokenText())
    ) {
      violations.push(normalize(scanner.getTokenText()))
    }
    kind = scanner.scan()
  }
}

function scanVueTemplate(text, violations) {
  for (const re of [/<!--[\s\S]*?-->/g, /\/\*[\s\S]*?\*\//g]) {
    for (const match of text.matchAll(re)) {
      if (NON_ASCII.test(match[0])) violations.push(normalize(match[0]))
    }
  }
}

function scanFile(path) {
  const text = readFileSync(path, 'utf8')
  const violations = []
  if (path.endsWith('.vue')) {
    const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi
    let last = 0
    let m
    while ((m = scriptRe.exec(text)) !== null) {
      scanVueTemplate(text.slice(last, m.index), violations)
      scanTsChunk(m[1] ?? '', violations)
      last = m.index + m[0].length
    }
    scanVueTemplate(text.slice(last), violations)
  } else {
    scanTsChunk(text, violations)
  }
  return violations
}

const baseline = {}
for (const file of walk(ROOT)) {
  const v = scanFile(file)
  if (v.length > 0) {
    baseline[relative(ROOT, file).split(sep).join('/')] = v
  }
}

mkdirSync(join(OUT, '..'), { recursive: true })
writeFileSync(OUT, JSON.stringify(baseline, null, 1) + '\n')
const total = Object.values(baseline).reduce((n, arr) => n + arr.length, 0)
console.log(`baseline written: ${Object.keys(baseline).length} files, ${total} comment violations`)
