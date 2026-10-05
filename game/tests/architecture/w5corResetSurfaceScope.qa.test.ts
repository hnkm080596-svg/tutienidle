// W5-COR pins (fixpoint-codex-w5-COR.md) - source-level witnesses for the
// wave-4 reset_character delta. Each `it` pins one leg of a finding's
// mechanism; together they are deterministic repro that the defect exists,
// without needing a live Supabase.
//
//   W5-COR-1 (High): the remote reset on SaveIncompatibleScreen is gated on
//     adapter capability alone, while useAppLifecycle routes 'pending-conflict'
//     /'pending-quarantined' (local-envelope states whose remote save row is
//     HEALTHY) to the same surface - the button the confirm presents as a
//     cache reset hard-deletes the healthy remote character.
//   W5-COR-2 (Medium): the reset confirm copy still promises "server save
//     NOT deleted / screen reappears" although reset_character now performs
//     `delete from public.characters` and the account lands on creation.
//   W5-COR-3 (Medium): 'deleted' -> boot.requireCharacter() rests on the
//     comment premise "create_character ignores deleted rows" - every SQL
//     uniqueness check it relies on ignores deleted_at, so a tombstoned
//     account loops CHARACTER_EXISTS forever.
//   W5-COR-4 (Low): bootFlow.fail() is a fire-and-forget coordinator.request
//     that the coordinator rejects outright while another transition is
//     in-flight - the resume-reject surface stays a dead write in that window.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const at = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const LIFECYCLE = at('../../src/composables/useAppLifecycle.ts')
const SCREEN = at('../../src/components/common/SaveIncompatibleScreen.vue')
const APP = at('../../src/App.vue')
const BOOTFLOW = at('../../src/composables/useBootFlow.ts')
const COORDINATOR = at('../../src/presentation/GamePresentationCoordinator.ts')
const RESET_SQL = at('../../supabase/migrations/202610060002_beta_character_reset.sql')
const BOUNDARY_SQL = at('../../supabase/migrations/202610060001_beta_save_boundary_hardening.sql')
const AUTH_CHARACTER_SQL = at('../../supabase/migrations/202608240001_online_auth_character.sql')
const VI_LOCALE = at('../../src/locales/vi.json')
const EN_LOCALE = at('../../src/locales/en.json')

describe('W5-COR-1: remote reset over-scopes to healthy-remote surfaces', () => {
  it('useAppLifecycle routes pending-conflict / pending-quarantined to the same saveIssue+fail surface', () => {
    const arm = LIFECYCLE.match(
      /loaded\.status === 'pending-conflict' \|\| loaded\.status === 'pending-quarantined'\)[\s\S]*?return \{ status: 'failed' \}/,
    )
    expect(arm, 'pending-conflict/quarantined routing arm').toBeTruthy()
    expect(arm![0]).toContain("saveIssue.report('corrupted'")
    expect(arm![0]).toContain('boot.fail()')
  })

  it('SaveIncompatibleScreen fires resetCharacter on adapter capability alone - no saveIssue.status gate', () => {
    // The remote leg checks `remoteAuthoritative` (a capability constant
    // sampled once at setup) and then calls resetCharacter() - there is no
    // branch that distinguishes 'corrupted remote row' from 'local envelope
    // problem' before the delete.
    const remoteLeg = SCREEN.match(/if \(remoteAuthoritative\) \{[\s\S]*?resetCharacter\(\)[\s\S]*?\}/)
    expect(remoteLeg, 'remote reset leg').toBeTruthy()
    expect(remoteLeg![0]).not.toContain('saveIssue.status')
    expect(SCREEN).toContain("cloudSaveCoordinator.capability === 'remote-authoritative'")
  })

  it('reset_character hard-deletes the characters row unconditionally', () => {
    expect(RESET_SQL).toMatch(/delete from public\.characters\s+where id = v_character\.id/)
    // and the schema cascades it onto save/checkpoints/receipts
    expect(AUTH_CHARACTER_SQL).toContain('on delete cascade')
    expect(RESET_SQL).not.toMatch(/update public\.characters\s+set deleted_at/)
  })
})

describe('W5-COR-2: reset confirm copy still promises server data survives', () => {
  it.each([VI_LOCALE, EN_LOCALE])(
    'saveIncompatible confirm copy claims the server save is not deleted',
    (locale) => {
      // Scope to the saveIncompatible block: the panels.settings copy is a
      // DIFFERENT (still-true) promise - the settings reset is local-only.
      const section = locale.match(/"saveIncompatible"[\s\S]*?"resetCloudBody":\s*"([^"]+)"/)
      expect(section, 'saveIncompatible.confirm.resetCloudBody key').toBeTruthy()
      // vi: "Save trên máy chủ không bị xoá" / en: "The cloud save is not
      // deleted" - false under `delete from public.characters`.
      expect(section![1]).toMatch(/không bị xoá|is not deleted|not be deleted|will not be deleted/i)
    },
  )

  it('the screen consumes exactly that copy key for the remote leg', () => {
    expect(SCREEN).toContain("t('saveIncompatible.confirm.resetCloudBody')")
  })
})

describe('W5-COR-3: deleted -> requireCharacter dead end (false premise)', () => {
  it("the routing comment claims create_character ignores deleted rows", () => {
    const arm = LIFECYCLE.match(/loaded\.status === 'deleted'\)[\s\S]*?return \{ status: 'require-character' \}/)
    expect(arm).toBeTruthy()
    expect(arm![0]).toContain('create_character ignores deleted rows')
    expect(arm![0]).toContain('boot.requireCharacter()')
  })

  it('create_character exists-check has no deleted_at predicate', () => {
    const check = BOUNDARY_SQL.match(
      /exists \(select 1 from public\.characters where user_id = v_session\.user_id[^)]*\)/,
    )
    expect(check, 'CHARACTER_EXISTS guard').toBeTruthy()
    expect(check![0]).not.toContain('deleted_at')
  })

  it('the reserved-name unique index is not partial on deleted_at', () => {
    const index = AUTH_CHARACTER_SQL.match(/create unique index characters_reserved_name_unique[^;]+;/)
    expect(index).toBeTruthy()
    expect(index![0]).not.toContain('where')
  })

  it('is_character_name_available ignores deleted_at too', () => {
    const fn = AUTH_CHARACTER_SQL.match(
      /create or replace function public\.is_character_name_available[\s\S]*?end;/,
    )
    expect(fn).toBeTruthy()
    expect(fn![0]).toContain('normalized_name')
    expect(fn![0]).not.toContain('deleted_at')
  })
})

describe('W5-COR-4: bootFlow.fail() is droppable while a transition is in-flight', () => {
  it('fail() fire-and-forgets coordinator.request', () => {
    expect(BOOTFLOW).toContain("void coordinator.request({ target: 'error' })")
  })

  it('the coordinator rejects a request that conflicts with an in-flight transition', () => {
    const arm = COORDINATOR.match(/inFlightRequest && this\.inFlightPromise[\s\S]*?status: 'rejected'/)
    expect(arm, 'in-flight rejection arm').toBeTruthy()
  })
})
