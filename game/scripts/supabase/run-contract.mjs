#!/usr/bin/env node
// BETA-FINAL B1-A (PR2) contract harness runner.
//
//   npm run test:supabase
//
// Drives the real staging Supabase project end to end:
//   1. connectivity + env gate (missing infra fails nonzero - no skip=pass)
//   2. historical-upgrade migration path on the project database:
//      legacy migrations -> legacy-phase probes + seeded old-era rows ->
//      prepare migration -> dual-surface probes -> cutover migration
//   3. canonical talent catalog seed (src/data/talent/Talents.ts)
//   4. fresh-install path on a disposable scratch database + catalog diff
//      against the project database (proves the two histories converge)
//   5. the playwright authority suite (real Auth/JWT/PostgREST)
//
// A rerun on an already-migrated project skips applies (ledgered in
// supabase_migrations.schema_migrations) and re-verifies the final state
// instead - migrations that were already live are not re-driven.
//
// Credentials come from game/.env.supabase.contract (gitignored) or the
// process environment; the file format is scripts/supabase/contract.env.example.
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  GAME_ROOT,
  AUTH_STUB_SQL,
  PREPARE_VERSION,
  CUTOVER_VERSION,
  loadEnv,
  dbClient,
  migrationFiles,
  applyPending,
  resetScratchDb,
  seedCanonicalTalents,
  catalogSnapshot,
  assertCatalogEqual,
} from './lib.mjs'

const report = { phases: {}, probes: [], startedAt: new Date().toISOString() }
const note = (name, ok, detail) => {
  report.probes.push({ name, ok, detail })
  console.log(`  [${ok ? 'ok' : 'FAIL'}] ${name}${detail ? ` - ${detail}` : ''}`)
  if (!ok) throw new Error(`probe failed: ${name}`)
}

// Run fn inside a transaction as the given database role + JWT subject.
async function asUser(pg, userId, role, fn) {
  if (!/^[a-z_]+$/.test(role)) throw new Error(`bad role for asUser: ${role}`)
  await pg.query('begin')
  await pg.query(`set local role ${role}`)
  await pg.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: userId, role }),
  ])
  try {
    const out = await fn()
    await pg.query('commit')
    return out
  } catch (e) {
    await pg.query('rollback')
    throw e
  }
}

async function seedAuthUser(pg, loginId = null, password = null) {
  const id = crypto.randomUUID()
  const kind = loginId ? 'registered' : 'guest'
  const email = `${id.slice(0, 8)}@seeded.test`
  await pg.query(
    `insert into auth.users(id, instance_id, aud, role, email,
       encrypted_password,
       email_confirmed_at, confirmation_token, recovery_token,
       email_change, email_change_token_new, is_anonymous,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       $2,
       case when $6::text is null then ''
            else extensions.crypt($6, extensions.gen_salt('bf')) end,
       now(), '', '', '', '', $3, '{}'::jsonb,
       jsonb_build_object('account_kind', $4::text, 'login_id', $5::text), now(), now())`,
    [id, email, kind === 'guest', kind, loginId, password],
  )
  await pg.query(
    `insert into auth.identities(user_id, provider_id, provider, identity_data, created_at, updated_at)
     values ($1, $3::text, 'email', jsonb_build_object('sub', $3::text, 'email', $2::text), now(), now())`,
    [id, email, id],
  )
  if (!loginId) {
    // guest profiles may lack a trigger-created row when the user predates the
    // schema (historical path seeds users before migrations) - create it.
    await pg.query(
      `insert into public.profiles(user_id, account_kind) values ($1, 'guest') on conflict do nothing`,
      [id],
    )
  }
  return { id, email }
}

// --- phase probes -----------------------------------------------------------

async function legacyPhaseProbes(pg) {
  // The pre-contract world: direct table writes and fabricated save rows were
  // the normal paths. Probe them under an authenticated JWT claim so the
  // later closure is measured against a real working baseline.
  const legacyUser = (await seedAuthUser(pg)).id
  const victimUser = (await seedAuthUser(pg)).id
  const tag = crypto.randomUUID().slice(0, 6)
  // victim already owns a character (SQL-seeded; pre-contract state allowed
  // arbitrary content).
  const victimChar = (
    await pg.query(
      `insert into public.characters(user_id, name, normalized_name, selected_talent_ids,
         base_attributes, mortal_basic_skill_id)
       values ($1, $2, $3, array['tam_tinh'],
         '{"strength":1,"dexterity":1,"intelligence":1,"attunement":1,"vitality":1}'::jsonb, 'tram')
       returning id`,
      [victimUser, `LegacyVictim${tag}`, `legacyvictim${tag}`],
    )
  ).rows[0].id

  const out = await asUser(pg, legacyUser, 'authenticated', async () => {
    const claim = await pg.query(`select public.claim_active_session('legacy-client') as sid`)
    const sid = claim.rows[0].sid
    const roll = await pg.query(`select public.create_talent_roll($1) as r`, [sid])
    const rollId = roll.rows[0].r.rollId
    const talent = roll.rows[0].r.talents[0].id
    const created = await pg.query(
      `select public.create_character($1::uuid,$2::uuid,$3::text,array[$4::text],'tram','{}'::jsonb,87) as cid`,
      [sid, rollId, `LegacyChar${tag}`, talent],
    )
    const cid = created.rows[0].cid
    // The two legacy holes, proven live:
    //  (a) a fabricated {} save row is created as a side effect of character
    //      creation (p_initial_save), no payload validation;
    //  (b) saves_own_insert lets any authenticated caller insert a save row
    //      bound to ANOTHER user's character (no owner=character-owner
    //      constraint existed) - and arbitrary direct mutation of their own.
    const fakeSave = await pg.query(
      `select payload from public.character_saves where character_id = $1`, [cid],
    )
    // cross-owner drift hole: open before prepare, closed by the composite FK
    // once 202609300001 is applied (the FK enforces new writes even NOT VALID)
    let crossInsert = null
    let crossBlocked = false
    // savepoint keeps the outer transaction usable when the FK blocks the insert
    await pg.query('savepoint before_cross_insert')
    try {
      const cross = await pg.query(
        `insert into public.character_saves(character_id, user_id, schema_version, save_revision, payload)
         values ($1, $2, 87, 1, '{"direct":"write"}'::jsonb) returning character_id`,
        [victimChar, legacyUser],
      )
      crossInsert = cross.rows[0].character_id
    } catch (e) {
      await pg.query('rollback to savepoint before_cross_insert')
      crossBlocked = /character_saves_owner_is_character_owner|23503/.test(e.message) || e.code === '23503'
      if (!crossBlocked) throw e
    }
    const direct = await pg.query(
      `update public.character_saves set payload = '{"tampered":true}'::jsonb
        where character_id = $1 returning character_id`,
      [cid],
    )
    return {
      sid, cid,
      fakeSaveBytes: fakeSave.rows[0].payload,
      crossOwnerInsert: crossInsert,
      crossBlocked,
      directUpdate: direct.rows[0].character_id,
    }
  })
  note('legacy: one-arg claim works', !!out.sid)
  note('legacy: 7-arg create_character writes fabricated {} save',
    JSON.stringify(out.fakeSaveBytes) === '{}')
  note('legacy: cross-owner save insert reachable',
    !!out.crossOwnerInsert || out.crossBlocked,
    out.crossOwnerInsert ? 'succeeded (pre-contract hole)' : 'blocked early by owner-FK (prepare already applied)')
  note('legacy: direct save update succeeded (pre-contract hole)', !!out.directUpdate)
  return out
}

// Operator-side seed of a persisted {} save (the shape legacy create_character
// left behind). Kept separate from legacyPhaseProbes because the probe's own
// direct-write demonstration overwrites its {} row.
async function seedEmptyPayloadRow(pg) {
  const user = (await seedAuthUser(pg)).id
  const tag = crypto.randomUUID().slice(0, 6)
  const char = (
    await pg.query(
      `insert into public.characters(user_id, name, normalized_name, selected_talent_ids,
         base_attributes, mortal_basic_skill_id)
       values ($1, $2, $3, array['tam_tinh'],
         '{"strength":1,"dexterity":1,"intelligence":1,"attunement":1,"vitality":1}'::jsonb, 'tram')
       returning id`,
      [user, `EmptySave${tag}`, `emptysave${tag}`],
    )
  ).rows[0].id
  await pg.query(
    `insert into public.character_saves(character_id, user_id, schema_version, save_revision, payload)
     values ($1, $2, 87, 1, '{}'::jsonb)`,
    [char, user],
  )
}

// Operator-side seed of a historical owner-mismatch save (user_id <> character
// owner). Pre-prepare clients could create this drift directly; once the FK is
// live it can only be simulated via the replication bypass operators use.
async function seedOwnerMismatchRow(pg) {
  const victimUser = (await seedAuthUser(pg)).id
  const driftUser = (await seedAuthUser(pg)).id
  const tag = crypto.randomUUID().slice(0, 6)
  const victimChar = (
    await pg.query(
      `insert into public.characters(user_id, name, normalized_name, selected_talent_ids,
         base_attributes, mortal_basic_skill_id)
       values ($1, $2, $3, array['tam_tinh'],
         '{"strength":1,"dexterity":1,"intelligence":1,"attunement":1,"vitality":1}'::jsonb, 'tram')
       returning id`,
      [victimUser, `DriftVictim${tag}`, `driftvictim${tag}`],
    )
  ).rows[0].id
  await pg.query('begin')
  try {
    await pg.query(`set local session_replication_role = 'replica'`)
    await pg.query(
      `insert into public.character_saves(character_id, user_id, schema_version, save_revision, payload)
       values ($1, $2, 87, 1, '{"legacy":"drift"}'::jsonb)`,
      [victimChar, driftUser],
    )
    await pg.query('commit')
  } catch (e) {
    await pg.query('rollback')
    throw e
  }
}

async function dualPhaseProbes(pg) {
  const r = await pg.query(`select public.beta_contract_phase() as phase`)
  note('prepare: contractPhase = prepare', r.rows[0].phase === 'prepare', r.rows[0].phase)
  const overloads = await pg.query(`
    select to_regprocedure('public.claim_active_session(text)') is not null as legacy_claim,
           to_regprocedure('public.claim_active_session(text,integer,text)') is not null as new_claim,
           to_regprocedure('public.create_character(uuid,uuid,text,text[],text,jsonb,integer)') is not null as legacy_create,
           to_regprocedure('public.create_character(uuid,uuid,text,text[],text)') is not null as new_create`)
  note('prepare: both claim overloads present', overloads.rows[0].legacy_claim && overloads.rows[0].new_claim)
  note('prepare: both create_character overloads present', overloads.rows[0].legacy_create && overloads.rows[0].new_create)
  const pol = await pg.query(`select count(*)::int n from pg_policies where schemaname='public' and tablename='character_saves'`)
  note('prepare: direct-save policies still present (dual window)', pol.rows[0].n >= 1, `${pol.rows[0].n} policies`)
  const classesOf = async () => {
    const inv = await pg.query(
      `select compatibility, count(*)::int n from public.save_inventory_compatibility group by 1`,
    )
    return Object.fromEntries(inv.rows.map((x) => [x.compatibility, x.n]))
  }
  let classes = await classesOf()
  if ((classes['empty-payload'] ?? 0) === 0) await seedEmptyPayloadRow(pg)
  if ((classes['owner-mismatch'] ?? 0) === 0) await seedOwnerMismatchRow(pg)
  classes = await classesOf()
  note('prepare: inventory view classifies seeded legacy rows',
    (classes['empty-payload'] ?? 0) >= 1 && (classes['owner-mismatch'] ?? 0) >= 1,
    JSON.stringify(classes))
}

async function finalStateProbes(pg) {
  const r = await pg.query(`select public.beta_contract_phase() as phase`)
  note('cutover: contractPhase = cutover', r.rows[0].phase === 'cutover', r.rows[0].phase)
  const gone = await pg.query(`
    select to_regprocedure('public.claim_active_session(text)') is null as legacy_claim_gone,
           to_regprocedure('public.create_character(uuid,uuid,text,text[],text,jsonb,integer)') is null as legacy_create_gone`)
  note('cutover: legacy overloads dropped', gone.rows[0].legacy_claim_gone && gone.rows[0].legacy_create_gone)
  const pol = await pg.query(`select count(*)::int n from pg_policies where schemaname='public' and tablename='character_saves'`)
  note('cutover: zero direct-save policies', pol.rows[0].n === 0)
  const priv = await pg.query(`
    select
      not has_table_privilege('anon', 'public.character_saves', 'select,insert,update,delete')
      and not has_table_privilege('authenticated', 'public.character_saves', 'select,insert,update,delete')
      and not has_table_privilege('service_role', 'public.character_saves', 'select,insert,update,delete') as saves_closed,
      not has_table_privilege('authenticated', 'public.save_mutation_receipts', 'select,insert,update,delete') as receipts_closed,
      not has_table_privilege('authenticated', 'public.time_checkpoints', 'select,insert,update,delete') as cps_closed,
      not has_table_privilege('authenticated', 'public.backend_config', 'select,insert,update,delete') as config_closed,
      not has_table_privilege('authenticated', 'public.save_inventory_compatibility', 'select') as view_closed`)
  const p = priv.rows[0]
  note('cutover: api roles have no table/view privileges',
    p.saves_closed && p.receipts_closed && p.cps_closed && p.config_closed && p.view_closed,
    JSON.stringify(p))
  const fnPriv = await pg.query(`
    select
      has_function_privilege('authenticated', 'public.claim_active_session(text,integer,text)', 'execute') as claim,
      has_function_privilege('authenticated', 'public.load_game_state(uuid)', 'execute') as load,
      has_function_privilege('authenticated', 'public.write_character_save(uuid,bigint,integer,jsonb,text,uuid,jsonb)', 'execute') as write,
      has_function_privilege('authenticated', 'public.heartbeat_session(uuid)', 'execute') as hb,
      has_function_privilege('authenticated', 'public.revoke_current_session(uuid)', 'execute') as revoke,
      has_function_privilege('authenticated', 'public.get_backend_status()', 'execute') as status,
      has_function_privilege('authenticated', 'public.create_character(uuid,uuid,text,text[],text)', 'execute') as create,
      not has_function_privilege('anon', 'public.write_character_save(uuid,bigint,integer,jsonb,text,uuid,jsonb)', 'execute') as anon_denied,
      not has_function_privilege('authenticated', 'public._lock_caller_profile()', 'execute') as helper_denied`)
  const f = fnPriv.rows[0]
  note('cutover: authenticated rpc grants exact, helpers internal',
    f.claim && f.load && f.write && f.hb && f.revoke && f.status && f.create && f.anon_denied && f.helper_denied,
    JSON.stringify(f))
  const sp = await pg.query(`
    select count(*)::int as bad from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.prosecdef
       and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%'`)
  note('cutover: every definer function pins search_path', sp.rows[0].bad === 0, `${sp.rows[0].bad} unpinned`)
}

// Connectivity gate: auth health + a real JWT minted through the password
// grant on a seeded account. Uses the token endpoint (separate GoTrue rate
// bucket from anonymous signup) so repeated harness runs stay green.
async function connectivity(env, pg) {
  const health = await fetch(`${env.supabaseUrl}/auth/v1/health`, {
    headers: { apikey: env.anonKey },
    signal: AbortSignal.timeout(15_000),
  })
  if (!health.ok) throw new Error(`auth health check failed: ${health.status}`)
  const password = `pw-${crypto.randomUUID()}`
  const seeded = await seedAuthUser(pg, `conn_${crypto.randomUUID().slice(0, 8)}`, password)
  const token = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: seeded.email, password }),
    signal: AbortSignal.timeout(15_000),
  })
  const body = await token.json()
  if (!token.ok || !body.access_token) {
    throw new Error(`password-grant probe failed: ${token.status} ${JSON.stringify(body)}`)
  }
  return seeded.id
}

async function main() {
  const env = loadEnv()
  console.log(`[contract] target project: ${env.supabaseUrl}`)

  const pg = await dbClient(env.dbUrl)
  console.log('[contract] direct postgres connected')
  const probeUser = await connectivity(env, pg)
  console.log(`[contract] auth reachable; real JWT minted (${probeUser.slice(0, 8)}...)`)

  // --- historical-upgrade path (project database) ---------------------------
  const files = migrationFiles()
  const legacy = files.filter((f) => f.version < PREPARE_VERSION)
  const prepare = files.filter((f) => f.version === PREPARE_VERSION)
  const cutover = files.filter((f) => f.version === CUTOVER_VERSION)
  const later = files.filter((f) => f.version > CUTOVER_VERSION)
  if (!prepare.length || !cutover.length) {
    throw new Error('beta authority migrations missing from supabase/migrations')
  }

  const l1 = await applyPending(pg, legacy)
  report.phases.legacy = l1
  console.log(`[contract] legacy migrations: applied ${l1.applied.length}, skipped ${l1.skipped.length}`)

  // The talent catalog always converges to canonical authored data before any
  // roll can run (rolls need >= 9 enabled rows).
  const seed = await seedCanonicalTalents(pg)
  report.phases.talentSeedEarly = seed
  console.log(`[contract] talent catalog: seeded ${seed.seeded} canonical, disabled ${seed.disabled.length} legacy ids`)

  // Probes are driven by the ACTUAL phase reached, not by which files were
  // applied in this run: a rerun after a partial first run still exercises the
  // stage it skipped. 'legacy' here means the prepare migration is absent;
  // 'prepare' means the dual window is live; 'cutover' the final contract.
  const phaseOf = async () => {
    const hasFn = await pg.query(`select to_regprocedure('public.beta_contract_phase()') as f`)
    if (!hasFn.rows[0].f) return 'legacy'
    return (await pg.query(`select public.beta_contract_phase() as p`)).rows[0].p
  }
  let phase = await phaseOf()
  report.phases.phaseBefore = phase
  console.log(`[contract] phase: ${phase}`)

  if (phase === 'legacy') {
    // true legacy world - the direct-write and fabricated-save paths still work
    report.phases.legacyProbes = await legacyPhaseProbes(pg)
  } else if (phase === 'prepare') {
    const seeded = await pg.query(
      `select count(*)::int n from public.character_saves where payload = '{}'::jsonb`,
    )
    if (seeded.rows[0].n === 0) {
      // dual window still exposes the legacy surface - run the same probes so
      // the pre-contract baseline is proven and the classification rows exist
      report.phases.legacyProbes = await legacyPhaseProbes(pg)
    }
  }

  const l2 = await applyPending(pg, prepare)
  report.phases.prepare = l2
  console.log(`[contract] prepare migration: applied ${l2.applied.length}, skipped ${l2.skipped.length}`)
  phase = await phaseOf()
  if (phase === 'prepare') await dualPhaseProbes(pg)

  const l3 = await applyPending(pg, cutover)
  report.phases.cutover = l3
  console.log(`[contract] cutover migration: applied ${l3.applied.length}, skipped ${l3.skipped.length}`)

  const l4 = await applyPending(pg, later)
  report.phases.later = l4
  if (l4.applied.length) console.log(`[contract] later migrations applied: ${l4.applied.join(', ')}`)

  await finalStateProbes(pg)

  const seeded = await seedCanonicalTalents(pg)
  report.phases.talentSeed = seeded
  console.log(`[contract] canonical talents: ${seeded.seeded} seeded, ${seeded.disabled.length} disabled`)

  // --- fresh-install path (scratch database) --------------------------------
  const freshUrl = await resetScratchDb(env, pg)
  console.log(`[contract] fresh-install scratch db: ${env.freshDbName}`)
  const fresh = await dbClient(freshUrl)
  try {
    await fresh.query(readFileSync(AUTH_STUB_SQL, 'utf8'))
    const all = await applyPending(fresh, files)
    console.log(`[contract] fresh install: applied ${all.applied.length} migrations`)
    const seedFresh = await seedCanonicalTalents(fresh)
    const projectSnap = await catalogSnapshot(pg)
    const freshSnap = await catalogSnapshot(fresh)
    assertCatalogEqual('fresh-install vs historical-upgrade', projectSnap, freshSnap)
    note('fresh-install catalog identical to historical-upgrade', true,
      `${seedFresh.seeded} talents, ${freshSnap.functions.rows.length} functions`)
  } finally {
    await fresh.end()
  }

  await pg.end()

  // --- playwright authority suite -------------------------------------------
  console.log('[contract] running playwright authority suite')
  const run = spawnSync(
    'npx',
    ['playwright', 'test', '--config', 'playwright.supabase.config.ts'],
    { cwd: GAME_ROOT, stdio: 'inherit', env: { ...process.env } },
  )
  report.playwrightExit = run.status
  mkdirSync(join(GAME_ROOT, 'test-results'), { recursive: true })
  writeFileSync(
    join(GAME_ROOT, 'test-results', 'supabase-contract-report.json'),
    JSON.stringify(report, null, 2),
  )
  if (run.status !== 0) {
    console.error(`[contract] authority suite failed (exit ${run.status})`)
    process.exit(run.status ?? 1)
  }
  console.log('[contract] PASS - evidence in test-results/supabase-contract-report.json')
}

main().catch((e) => {
  console.error(`[contract] FAIL: ${e.message}`)
  report.error = e.message
  try {
    mkdirSync(join(GAME_ROOT, 'test-results'), { recursive: true })
    writeFileSync(join(GAME_ROOT, 'test-results', 'supabase-contract-report.json'), JSON.stringify(report, null, 2))
  } catch {}
  process.exit(1)
})
