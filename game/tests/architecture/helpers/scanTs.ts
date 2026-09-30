/**
 * Shared helpers for R14 architecture guard tests (tests/architecture/**).
 * Kept dependency-free: these guards must never import app code (they
 * police it), so they walk the filesystem directly.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** Recursively list production .ts files (excludes *.test.ts and *.d.ts). */
export function listProductionTs(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listProductionTs(full))
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

/** Source extensions the corpus scans - .ts/.tsx/.vue plus the JS/TS
    module variants Vite accepts (.js/.jsx/.mjs/.cjs/.mts/.cts). A .mts or
    .cjs file carrying a banned import is a complete bypass lane. */
const ALL_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']
const DECL_RE = /\.d\.(ts|mts|cts)$/
const TEST_RE = /\.test\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/

/** True for `foo.test.<ext>` under any extension the corpus scans - the
    corpus widened past .ts, so the test exemption must widen with it. */
export function isTestFile(name: string): boolean {
  return TEST_RE.test(name)
}

/** Recursively list ALL script files including tests (for corpus checks). */
export function listAllTs(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listAllTs(full))
    } else if (ALL_EXTS.some((ext) => entry.endsWith(ext)) && !DECL_RE.test(entry)) {
      out.push(full)
    }
  }
  return out
}

export function readTs(path: string): string {
  return readFileSync(path, 'utf8')
}

/** Headroom for filesystem-scan guards under full-suite worker contention.
    Windows hosts measured >60s per-tokenizer/scan passes under load, so the
    budget is set for the slowest supported environment. */
export const SCAN_TIMEOUT = 120_000

/** Recursively list .vue SFCs. An SFC imports just as well as a .ts file. */
export function listVue(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listVue(full))
    } else if (entry.endsWith('.vue')) {
      out.push(full)
    }
  }
  return out
}

/** One file, already read. */
export interface SourceFile {
  /** Absolute path. */
  path: string
  /** Path relative to `src/`, slash-separated, so failure messages read well. */
  fromSrc: string
  text: string
}

const corpusCache = new Map<string, SourceFile[]>()

/**
 * Every `.ts` and `.vue` file under `srcDir`, walked and read ONCE per dir.
 *
 * The cache is per module graph AND keyed by `srcDir`, so under vitest's
 * default file isolation each guard file still pays for one pass per dir -
 * what it removes is the *repeat* reads inside a guard that makes several
 * content assertions or scans several roots (src/ and electron/).
 *
 * This is not premature optimisation; it is a fix for an observed failure. The
 * frontend-boundary guards scan roughly 750 files, and when each guard walked
 * and read the tree for itself, the full suite starved `eslintCoreSeverity` -
 * which shells out to eslint against a 60s budget - into a timeout. Isolated
 * proof: the full suite WITH the extra guard timed out, WITHOUT it passed.
 */
export function srcCorpus(srcDir: string): SourceFile[] {
  const cached = corpusCache.get(srcDir)
  if (cached) return cached

  const files = [...listAllTs(srcDir), ...listVue(srcDir)]

  const corpus = files.map((path) => ({
    path,
    fromSrc: relative(srcDir, path).split(sep).join('/'),
    text: readFileSync(path, 'utf8'),
  }))

  corpusCache.set(srcDir, corpus)
  return corpus
}

/**
 * A `*.test.*` filename alone does not make a file a test - a smuggle lane
 * just has to end in `.test.ts`. The guard exemption requires the file to
 * actually LOOK like a test: a vitest import or a `describe`/`it`/`test`
 * call site in its text. Cheap heuristic, intentionally - the stronger
 * invariant is the production import barrier (a dead test file writes
 * nothing unless production imports it, and that import is itself flagged).
 */
const TEST_EXT_RE = /\.test\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/
const TEST_MARKER_RE =
  /from\s+['"](?:vitest|@vitest\/|vitest\/)[^'"]*['"]|require\(\s*['"]vitest['"]\)|\b(?:describe|it|test|bench|suite|expect)(?:\.\w+)*\s*\(/

export function looksLikeTestFile(path: string, text: string): boolean {
  if (!TEST_EXT_RE.test(path)) return false
  // Comment-stripped first: `// describe( it( test(` inside a comment
  // must not buy the test exemption (R15 S9). A marker inside a real
  // string literal is likewise uncounted - conservative direction is
  // to flag, never to exempt.
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
  return TEST_MARKER_RE.test(stripped)
}

/** True when an import/export/require specifier text names a `*.test*` module -
 *  extensionless spellings and query suffixes (`?import`, `?worker`, `?raw`)
 *  included. */
export function isTestSpecifier(specText: string): boolean {
  // `*.test*` module spellings (incl. extensionless and `?query`
  // suffixes) plus specifiers reaching into the test tree itself -
  // production importing `../tests/writer` sidesteps the corpus
  // boundary entirely (R15 S8).
  return (
    /\.test(?:\.|\?|$)/.test(specText) ||
    /(?:^|[/\\])(?:tests?|__tests__|e2e)(?:[/\\]|$)/.test(specText)
  )
}

/**
 * Expression-bearing text regions inside a .vue template: attribute
 * values on directive-ish names (`v-`, `@`, `:`, `#`), mustache
 * interpolations and dynamic directive arguments (`@[expr]`, `#[expr]`).
 * HTML comments and <script>/<style> bodies are stripped first so
 * inert text and script-literal strings are never scanned. Mustaches
 * match by brace depth so `{{ {a:{b:1}} }}` resolves fully.
 */
/** Vue SFC text minus inert regions: <script>/<style> bodies and
 *  HTML comments are blanked so directive/mustache scans never see
 *  script-literal strings or commented-out template. */
export function stripVueInert(text: string): string {
  const scrubbed = text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    // <textarea>/<title> are rawtext elements: mustaches inside are
    // literal text Vue never evaluates (R15 F4).
    .replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea\s*>/gi, ' ')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, ' ')
    // <el v-pre>...</el> - Vue skips compilation inside v-pre, so
    // directives and mustaches there are literal text (R15 F7).
    .replace(/<([\w-]+)\b[^>]*\bv-pre\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
  // Blank HTML comments - but only a `<!--` OUTSIDE a tag's quoted
  // attribute value: `title="<!--"` is literal text, and treating it
  // as a comment start blanks every directive after it. Track
  // tag/quote state instead of a flat regex.
  let out = ''
  let i = 0
  let inTag = false
  let quote: string | null = null
  while (i < scrubbed.length) {
    if (!inTag && scrubbed.startsWith('<!--', i)) {
      const end = scrubbed.indexOf('-->', i + 4)
      i = end === -1 ? scrubbed.length : end + 3
      continue
    }
    const ch = scrubbed[i]!
    if (inTag) {
      if (quote !== null) {
        if (ch === quote) quote = null
      } else if (ch === '"' || ch === "'") {
        quote = ch
      } else if (ch === '>') {
        inTag = false
      }
    } else if (ch === '<') {
      inTag = true
    }
    out += ch
    i++
  }
  return out
}

export function templateExpressions(text: string): string[] {
  const tpl = stripVueInert(text)
  const exprs: string[] = []
  const attrRe = /(?:^|\s)(?:v-|@|:|#)[\w:._[\]-]*\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  const dynRe = /(?:@|:|#)\[((?:[^\[\]"']|"[^"]*"|'[^']*')*)\]\s*=/g
  let m: RegExpExecArray | null
  while ((m = attrRe.exec(tpl)) !== null) {
    const v = m[1] ?? m[2] ?? m[3]
    if (v !== undefined && v.length > 0) exprs.push(v)
  }
  while ((m = dynRe.exec(tpl)) !== null) {
    const v = m[1]
    if (v !== undefined && v.length > 0) exprs.push(v)
  }
  // Mustaches: `{{` opens an expression ONLY in element content -
  // inside a tag's attribute value (`title="{{x}}"`) it is literal
  // text Vue never evaluates. Track tag/quote state like
  // stripVueInert, then scan to the matching `}}` counting brace
  // depth and skipping string literals.
  let i = 0
  let inTag = false
  let tagQuote: string | null = null
  while (i < tpl.length) {
    const ch = tpl[i]
    if (inTag) {
      if (tagQuote !== null) {
        if (ch === tagQuote) tagQuote = null
      } else if (ch === '"' || ch === "'") {
        tagQuote = ch
      } else if (ch === '>') {
        inTag = false
      }
      i++
      continue
    }
    if (ch === '<') {
      inTag = true
      i++
      continue
    }
    if (ch !== '{' || tpl[i + 1] !== '{') {
      i++
      continue
    }
    const start = i
    let j = start + 2
    let depth = 0
    let quote: string | null = null
    for (; j < tpl.length; j++) {
      const c = tpl[j]
      if (quote !== null) {
        if (c === '\\') {
          j++
        } else if (c === quote) {
          quote = null
        }
        continue
      }
      if (c === '"' || c === "'" || c === '`') {
        quote = c
      } else if (c === '{') {
        depth++
      } else if (c === '}') {
        if (tpl[j + 1] === '}' && depth === 0) break
        depth--
      }
    }
    if (j < tpl.length) {
      const v = tpl.slice(start + 2, j)
      if (v.trim().length > 0) exprs.push(v)
    }
    i = j + 2
  }
  return exprs
}
