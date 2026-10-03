/**
 * RPC allow-list pin - the server-side create_talent_roll offer pool
 * mirrors src/core/betaScope.ts::BETA_CREATION_TALENT_IDS by hand inside
 * each migration's `id = any(array[...])` clause. The live function is
 * the LAST `create or replace function create_talent_roll` in migration
 * order, so this pin finds every real redefinition, then requires the
 * latest one to still carry the allow-list and to equal the client
 * constant (sorted) - drift in either direction, including a
 * redefinition that silently drops the clause, fails here instead of
 * silently narrowing or widening the roll pool server-side.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BETA_CREATION_TALENT_IDS } from '@/core/betaScope'

const MIGRATIONS_DIR = 'supabase/migrations'

// A real redefinition - `create or replace function create_talent_roll(`
// (optional `public.` schema prefix; whitespace between tokens tolerated).
// The name is anchored immediately after `function` so call-sites,
// mention-only files (grants, comments) and lookalikes such as
// `create_talent_roll_v2` cannot enter the set. A redefinition that drops
// the allow-list clause must still be selected so the pin fails on it.
const REDEFINITION_PATTERN =
  /create\s+or\s+replace\s+function\s+(?:[\w]+\s*\.\s*)?create_talent_roll\s*\(/i

// Matches the roll's `... and id = any(array['id1','id2',...])` offer
// filter - deliberately NOT `id = any(rolled_ids)` (no `array[`).
const ALLOW_LIST_PATTERN = /id\s*=\s*any\(\s*array\[([\s\S]*?)\]/

function allowListOf(sql: string): string[] | undefined {
  const match = ALLOW_LIST_PATTERN.exec(sql)

  if (match === null) {
    return undefined
  }

  return [...match[1]!.matchAll(/'([^']+)'/g)].map((entry) => entry[1]!)
}

// Migration filenames are timestamp-prefixed so lexical order IS apply
// order; the last file redefining create_talent_roll owns the live
// function body.
const redefinitions = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .flatMap((file) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')

    if (!REDEFINITION_PATTERN.test(sql)) {
      return []
    }

    return ([[file, sql]] as [string, string][])
  })

describe('create_talent_roll migration allow-list', () => {
  it('at least one migration redefines create_talent_roll', () => {
    expect(redefinitions.length).toBeGreaterThan(0)
  })

  it('the live (latest) redefinition still carries an id allow-list', () => {
    const [file, sql] = redefinitions.at(-1)!

    expect(
      allowListOf(sql),
      `${file} redefines create_talent_roll without an \`id = any(array[...])\` offer allow-list - the roll pool would silently widen to whatever the new body returns`,
    ).toBeDefined()
  })

  it('the live (latest) allow-list equals BETA_CREATION_TALENT_IDS exactly', () => {
    const [file, sql] = redefinitions.at(-1)!
    const ids = allowListOf(sql) ?? []

    expect(
      [...ids].sort(),
      `allow-list drift in ${file}: expected the sorted BETA_CREATION_TALENT_IDS`,
    ).toEqual([...BETA_CREATION_TALENT_IDS].sort())
  })
})
