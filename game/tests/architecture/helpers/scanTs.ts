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

let cachedCorpus: SourceFile[] | null = null

/**
 * Every `.ts` and `.vue` file under `src/`, walked and read ONCE.
 *
 * The cache is per module graph, so under vitest's default file isolation each
 * guard file still pays for one pass — what it removes is the *repeat* reads
 * inside a guard that makes several content assertions.
 *
 * This is not premature optimisation; it is a fix for an observed failure. The
 * frontend-boundary guards scan roughly 750 files, and when each guard walked
 * and read the tree for itself, the full suite starved `eslintCoreSeverity` —
 * which shells out to eslint against a 60s budget — into a timeout. Isolated
 * proof: the full suite WITH the extra guard timed out, WITHOUT it passed.
 */
export function srcCorpus(srcDir: string): SourceFile[] {
  if (cachedCorpus) return cachedCorpus

  const files = [...listAllTs(srcDir), ...listVue(srcDir)]

  cachedCorpus = files.map((path) => ({
    path,
    fromSrc: relative(srcDir, path).split(sep).join('/'),
    text: readFileSync(path, 'utf8'),
  }))

  return cachedCorpus
}
