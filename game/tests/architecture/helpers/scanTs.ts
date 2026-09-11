/**
 * Shared helpers for R14 architecture guard tests (tests/architecture/**).
 * Kept dependency-free: these guards must never import app code (they
 * police it), so they walk the filesystem directly.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

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

/** Recursively list ALL .ts files including tests (for corpus checks). */
export function listAllTs(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listAllTs(full))
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

export function readTs(path: string): string {
  return readFileSync(path, 'utf8')
}

/** Headroom for filesystem-scan guards under full-suite worker contention. */
export const SCAN_TIMEOUT = 60_000
