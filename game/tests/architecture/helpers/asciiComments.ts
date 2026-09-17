/**
 * P15 ratchet helpers - extract COMMENT tokens (never string literals)
 * and report the ones containing non-ASCII. Used by
 * asciiComments.test.ts; the baseline generator scripts/p15-baseline.mjs
 * implements the identical algorithm and must stay in sync.
 *
 * Why a scanner instead of a regex: '//' inside a string literal,
 * a regex literal, or a template placeholder is not a comment - the
 * TypeScript tokenizer knows the difference, so Vietnamese UI strings
 * and i18n data (explicitly allowed by P15) never false-positive.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'dist-electron',
  'release',
  'public',
  'art-source',
  'asset-drop',
  'playwright-report',
  'test-results',
  '.git',
])

const NON_ASCII = /[^\x00-\x7F]/

/** Recursively list P15-covered source files (.ts/.vue/.js/.mjs/.cjs). */
export function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, out)
    } else {
      const dot = entry.lastIndexOf('.')
      const ext = dot < 0 ? '' : entry.slice(dot)
      if (ext === '.vue' || SOURCE_EXT.has(ext)) out.push(full)
    }
  }
  return out
}

/** Whitespace-collapsed comment text - the baseline comparison key. */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Non-ASCII comment tokens inside a TS/JS source chunk. */
function scanTsChunk(text: string, violations: string[]): void {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text)
  let kind = scanner.scan()
  while (kind !== ts.SyntaxKind.EndOfFileToken) {
    if (
      (kind === ts.SyntaxKind.SingleLineCommentTrivia ||
        kind === ts.SyntaxKind.MultiLineCommentTrivia) &&
      NON_ASCII.test(scanner.getTokenText())
    ) {
      violations.push(normalize(scanner.getTokenText()))
    }
    kind = scanner.scan()
  }
}

/** Non-ASCII comments inside the non-script regions of a .vue SFC
 *  (HTML comments + CSS block comments). */
function scanVueTemplate(text: string, violations: string[]): void {
  for (const re of [/<!--[\s\S]*?-->/g, /\/\*[\s\S]*?\*\//g]) {
    for (const match of text.matchAll(re)) {
      if (NON_ASCII.test(match[0])) violations.push(normalize(match[0]))
    }
  }
}

/**
 * Every non-ASCII comment in one file, as normalized strings.
 * .vue files: <script> blocks go through the TS scanner; template and
 * style regions are checked for HTML/CSS comments. Strings, i18n
 * messages and user-facing text are never reported (P15 = comments).
 */
export function scanCommentViolations(path: string): string[] {
  const text = readFileSync(path, 'utf8')
  const violations: string[] = []

  if (path.endsWith('.vue')) {
    const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi
    let last = 0
    let m: RegExpExecArray | null
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
