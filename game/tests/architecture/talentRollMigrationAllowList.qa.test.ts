/**
 * RPC allow-list pin - the server-side create_talent_roll offer pool
 * mirrors src/core/betaScope.ts::BETA_CREATION_TALENT_IDS by hand inside
 * each migration's `id = any(array[...])` clause. The live function is
 * the LAST `create or replace` in migration order, so this pin parses
 * every migration's allow-list, then compares the latest one against
 * the client constant (sorted) - drift in either direction fails here
 * instead of silently narrowing the roll pool server-side.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BETA_CREATION_TALENT_IDS } from '@/core/betaScope'

const MIGRATIONS_DIR = 'supabase/migrations'

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
// allow-list (a file can carry other `id = any(array[...])` filters, so
// only roll-defining files are parsed).
const allowListByFile = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .flatMap((file) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')

    if (!sql.includes('create_talent_roll')) {
      return []
    }

    const ids = allowListOf(sql)

    return ids === undefined ? [] : ([[file, ids]] as [string, string[]][])
  })

describe('create_talent_roll migration allow-list', () => {
  it('at least one migration defines the roll allow-list', () => {
    expect(allowListByFile.length).toBeGreaterThan(0)
  })

  it('the live (latest) allow-list equals BETA_CREATION_TALENT_IDS exactly', () => {
    const [file, ids] = allowListByFile.at(-1)!

    expect(
      [...ids].sort(),
      `allow-list drift in ${file}: expected the sorted BETA_CREATION_TALENT_IDS`,
    ).toEqual([...BETA_CREATION_TALENT_IDS].sort())
  })
})
