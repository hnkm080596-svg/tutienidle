/**
 * i18n key parity guard (P16) — every locale key a source file can feed to
 * vue-i18n must resolve in BOTH `src/locales/vi.json` and `src/locales/en.json`.
 *
 * Origin: the 2026-09-13 whole-codebase audit observed "missing key" warnings
 * in BOTH locales on the e2e console (`panels.stageSelect.*`,
 * `panels.wheel.aria.group`, `onboarding.auth.eyebrow`, ...). Those keys were
 * never actually absent from the locale files — the warnings come from
 * `useI18n({ useScope: 'local' })` called WITHOUT a `messages` option. Such a
 * call builds a local composer with an empty message table; every t() lookup
 * misses locally ("Not found '<key>' in 'vi'/'en' locale messages") and only
 * then falls back through the fallback chain to the root messages. The text
 * resolves, but two console warnings fire per key per call. Verified live:
 * the same keys warn under `{ useScope: 'local' }` and resolve silently under
 * bare `useI18n()` (global scope) — identical output, zero warnings.
 *
 * Scope decision (LOCAL-AWARE):
 * - Components that pass `messages:` to useI18n carry their own key table
 *   (PresentationTransitionOverlay). Their t() literals are checked against
 *   the component-local vi/en blocks — a global-fallback hit would still
 *   emit the missing-key warning, so "exists globally" is not enough there.
 * - Everywhere else (bare useI18n(), explicit global scope, i18n.global.t,
 *   $t) keys resolve against the global registry: literal must exist in both
 *   locale files.
 *
 * What is scanned:
 *  1. String-literal first arguments of t()/te()/tm()/rt()/$t() calls in any
 *     src/** file (.ts + .vue, templates included — `{{ t('x') }}` and
 *     `:attr="t('x')"` are the same call shape).
 *  2. ANY string literal whose text starts with a known top-level locale
 *     namespace (`panels.`, `combat.`, `announce.`, ...) — catches keys fed
 *     indirectly: descriptor maps (titleKey/bodyKey, OP_LABEL_KEYS,
 *     useBagFilter key tables), messageKey payloads, test expectations.
 *  3. useI18n option shapes: `useScope: 'local'` without `messages` is the
 *     warning-generating defect shape and is forbidden outright.
 *  4. A `messages:` block must keep vi/en leaf parity itself.
 *
 * Known boundaries (documented, not silently skipped):
 * - Keys built at runtime with no literal anywhere (e.g. `t(var)` where var
 *   arrives over the wire) cannot be proven; every current indirect key is
 *   backed by a literal caught by rule 2.
 * - A literal containing `${...}` is dynamic: the guard proves at least one
 *   matching path exists in both locales, not that every runtime value maps
 *   to a leaf. Partial coverage by construction.
 * - Literals ending mid-path (`'skillResource.'`) are prefixes, not keys —
 *   excluded by requiring non-empty dot-separated segments.
 * - A key path that resolves to a branch (object) counts as "exists" — te()/
 *   tm() legitimately resolve branches.
 * - The scan is regex/tokenizer-based (no Vue SFC compiler): t() is assumed
 *   to be the i18n translator everywhere under src/ — a same-named local
 *   helper would surface as a loud missing-key failure, never silently pass.
 * - `d()`/`n()` (datetime/number format keys) are a different message space
 *   and are not used under src/ today; not scanned.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCAN_TIMEOUT, srcCorpus } from './helpers/scanTs'

const SRC_DIR = join(process.cwd(), 'src')
const LOCALES_DIR = join(SRC_DIR, 'locales')

/** Locale JSONs are read, not imported: guards police app code, never load it. */
const VI_MESSAGES = JSON.parse(readFileSync(join(LOCALES_DIR, 'vi.json'), 'utf8')) as unknown
const EN_MESSAGES = JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf8')) as unknown

/** Every node path — branches included; a path "exists" if it resolves at all. */
function collectPaths(node: unknown, prefix = '', out = new Set<string>()): Set<string> {
  if (node === null || typeof node !== 'object') {
    if (prefix) out.add(prefix)
    return out
  }
  if (prefix) out.add(prefix)
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    collectPaths(value, prefix ? `${prefix}.${key}` : key, out)
  }
  return out
}

const VI_PATHS = collectPaths(VI_MESSAGES)
const EN_PATHS = collectPaths(EN_MESSAGES)
const TOP_NAMESPACES = [...new Set([...VI_PATHS, ...EN_PATHS].map((p) => p.split('.')[0]!))]
const NAMESPACE_RE = new RegExp(`^(?:${TOP_NAMESPACES.join('|')})$`)

/**
 * Strip line/block/HTML comments while leaving string/template contents
 * alone, so a `//` inside a literal cannot eat the rest of the line and a
 * commented-out key cannot pass the scan.
 */
function uncommented(src: string): string {
  let out = ''
  let inStr = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (inStr) {
      out += c
      if (c === '\\') out += src[++i] ?? ''
      else if (c === inStr) inStr = ''
      i++
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c
      out += c
      i++
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '<' && src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4)
      i = end === -1 ? src.length : end + 3
      continue
    }
    out += c
    i++
  }
  return out
}

/** Index of the `close` that balances the `open` at openIdx (string-aware). */
function balancedEnd(src: string, openIdx: number, open: string, close: string): number {
  let depth = 0
  let inStr = ''
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]!
    if (inStr) {
      if (c === '\\') i++
      else if (c === inStr) inStr = ''
      continue
    }
    if (c === "'" || c === '"' || c === '`') inStr = c
    else if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** Leaf paths of an inline `messages` object literal ({..} incl. braces). */
const OBJ_TOKEN = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|[A-Za-z_$][\w$]*|[{}:,]/g
function objectLiteralLeafPaths(block: string): Set<string> {
  const toks = [...block.matchAll(OBJ_TOKEN)].map((m) => m[0])
  const out = new Set<string>()
  let i = 0
  const parseObj = (prefix: string): void => {
    if (toks[i] !== '{') throw new Error('messages block: expected {')
    i++
    while (i < toks.length && toks[i] !== '}') {
      const raw = toks[i++]!
      const key = raw.startsWith("'") || raw.startsWith('"') || raw.startsWith('`') ? raw.slice(1, -1) : raw
      if (toks[i] !== ':') throw new Error(`messages block: expected ':' after '${key}'`)
      i++
      if (toks[i] === '{') {
        parseObj(`${prefix}${key}.`)
      } else {
        out.add(prefix + key)
        // consume the value expression up to ',' or '}' at this depth
        let depth = 0
        while (i < toks.length && (depth > 0 || (toks[i] !== ',' && toks[i] !== '}'))) {
          if (toks[i] === '{') depth++
          else if (toks[i] === '}') depth--
          i++
        }
      }
      if (toks[i] === ',') i++
    }
    if (toks[i] !== '}') throw new Error('messages block: unterminated object')
    i++
  }
  parseObj('')
  return out
}

interface LocalMessages {
  vi: Set<string>
  en: Set<string>
}

/**
 * Per-file local message tables: every useI18n options object that carries
 * `messages:` contributes its vi/en leaf sets. Files without them return
 * null and resolve t() against the global registry only.
 */
function localMessagesOf(src: string): LocalMessages | null {
  const local: LocalMessages = { vi: new Set(), en: new Set() }
  let found = false
  for (const call of src.matchAll(/useI18n\s*\(/g)) {
    const openParen = src.indexOf('(', call.index!)
    const closeParen = balancedEnd(src, openParen, '(', ')')
    if (closeParen === -1) continue
    const args = src.slice(openParen + 1, closeParen)
    const msgMatch = /\bmessages\s*:\s*\{/.exec(args)
    if (!msgMatch) continue
    const blockOpen = args.indexOf('{', msgMatch.index)
    const blockClose = balancedEnd(args, blockOpen, '{', '}')
    if (blockClose === -1) continue
    const block = args.slice(blockOpen, blockClose + 1)
    for (const locale of ['vi', 'en'] as const) {
      const locMatch = new RegExp(`\\b${locale}\\s*:\\s*\\{`).exec(block)
      if (!locMatch) continue
      const locOpen = block.indexOf('{', locMatch.index)
      const locClose = balancedEnd(block, locOpen, '{', '}')
      if (locClose === -1) continue
      for (const leaf of objectLiteralLeafPaths(block.slice(locOpen, locClose + 1))) {
        local[locale].add(leaf)
      }
    }
    found = true
  }
  return found ? local : null
}

/** t()/te()/tm()/rt()/$t() call with a string-literal first argument. */
const T_CALL = /(?:^|[^\w$])(\$t|t|te|tm|rt)\(\s*(['"`])((?:(?!\2)[^\\]|\\.)*)\2/g

/** True when the call is on the explicitly global composer (i18n.t/i18n.global.t/x.global.t). */
function isGlobalCall(src: string, matchIndex: number): boolean {
  const before = src.slice(Math.max(0, matchIndex - 24), matchIndex)
  return /\bglobal\s*\.\s*$/.test(before) || /\bi18n\s*\.\s*$/.test(before)
}

/** A literal shaped like a real key path: ns.segment[.segment...], no empty segments. */
const KEY_SHAPE = /^(?:[A-Za-z_$][\w$]*|\$\{[^}]*\})(?:\.(?:[A-Za-z_$][\w$]*|\$\{[^}]*\}))+$/

function keyExists(key: string, paths: Set<string>): boolean {
  if (!key.includes('${')) return paths.has(key)
  // Dynamic literal: static parts escaped, each ${expr} matches one segment.
  const re = new RegExp(
    `^${key
      .split(/\$\{[^}]*\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^.]+')}$`,
  )
  for (const p of paths) if (re.test(p)) return true
  return false
}

const FILES = srcCorpus(SRC_DIR).map((f) => ({
  ...f,
  clean: uncommented(f.text),
  local: localMessagesOf(uncommented(f.text)),
}))

describe('i18n key parity (P16)', () => {
  it(
    'has a corpus and real locale registries — a vacuous scan proves nothing',
    () => {
      expect(FILES.length).toBeGreaterThan(100)
      expect(VI_PATHS.size).toBeGreaterThan(500)
      expect(EN_PATHS.size).toBeGreaterThan(500)
      expect(TOP_NAMESPACES.length).toBeGreaterThan(10)
    },
    SCAN_TIMEOUT,
  )

  it(
    'every literal t()/te()/tm()/rt()/$t() key exists in both reachable locales',
    () => {
      const violations: string[] = []
      for (const file of FILES) {
        for (const m of file.clean.matchAll(T_CALL)) {
          const key = m[3]!
          const globalCall = isGlobalCall(file.clean, m.index!)
          // Local-messages components: a key is covered when it exists in
          // both local tables OR both global tables (root fallback exists —
          // though the fallback still warns; the next test pins that).
          const ok = globalCall || !file.local
            ? keyExists(key, VI_PATHS) && keyExists(key, EN_PATHS)
            : (keyExists(key, file.local.vi) || keyExists(key, VI_PATHS)) &&
              (keyExists(key, file.local.en) || keyExists(key, EN_PATHS))
          if (!ok) violations.push(`${file.fromSrc} → ${key}`)
        }
      }
      expect(violations).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'a component-local key actually resolves locally — a global-only key inside a local-messages file still prints the missing-key warning',
    () => {
      const violations: string[] = []
      for (const file of FILES) {
        if (!file.local) continue
        for (const m of file.clean.matchAll(T_CALL)) {
          const key = m[3]!
          if (isGlobalCall(file.clean, m.index!)) continue
          if (!keyExists(key, file.local.vi) || !keyExists(key, file.local.en)) {
            violations.push(`${file.fromSrc} → ${key} (absent from this file's local messages)`)
          }
        }
      }
      expect(violations).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'every namespace-prefixed key literal (descriptor maps, messageKey payloads) resolves in both global locales',
    () => {
      const STRING_LITERAL = /(['"`])((?:(?!\1)[^\\]|\\.)+)\1/g
      const violations: string[] = []
      for (const file of FILES) {
        for (const m of file.clean.matchAll(STRING_LITERAL)) {
          const literal = m[2]!
          if (!literal.includes('.') || !NAMESPACE_RE.test(literal.split('.')[0]!)) continue
          if (!KEY_SHAPE.test(literal)) continue
          if (!keyExists(literal, VI_PATHS) || !keyExists(literal, EN_PATHS)) {
            violations.push(`${file.fromSrc} → ${literal}`)
          }
        }
      }
      expect(violations).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    "no useI18n({ useScope: 'local' }) without messages — the empty local table is what printed 'missing key' warnings for every key in e2e",
    () => {
      const offenders: string[] = []
      for (const file of FILES) {
        for (const call of file.clean.matchAll(/useI18n\s*\(/g)) {
          const openParen = file.clean.indexOf('(', call.index!)
          const closeParen = balancedEnd(file.clean, openParen, '(', ')')
          if (closeParen === -1) continue
          const args = file.clean.slice(openParen + 1, closeParen)
          const isLocal = /\buseScope\s*:\s*['"]local['"]/.test(args)
          const hasMessages = /\bmessages\s*:/.test(args)
          if (isLocal && !hasMessages) offenders.push(file.fromSrc)
        }
      }
      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'a component-local messages block keeps vi/en leaf parity on its own',
    () => {
      const violations: string[] = []
      for (const file of FILES) {
        if (!file.local) continue
        const onlyVi = [...file.local.vi].filter((k) => !file.local!.en.has(k))
        const onlyEn = [...file.local.en].filter((k) => !file.local!.vi.has(k))
        for (const k of [...onlyVi, ...onlyEn]) violations.push(`${file.fromSrc} → ${k}`)
      }
      expect(violations).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
