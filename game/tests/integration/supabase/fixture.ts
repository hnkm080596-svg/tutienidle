// Shared fixture for the BETA B1-A authority contract suite.
//
// Real infrastructure only: real GoTrue JWTs (anonymous signup + a SQL-seeded
// registered user), real PostgREST RPC/table calls, and a direct postgres
// connection for setup/assertion. Missing infrastructure fails nonzero -
// nothing here may skip.
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'

export interface ContractEnv {
  supabaseUrl: string
  anonKey: string
  dbUrl: string
}

// Reads env (the runner already loaded .env.supabase.contract). Every required
// variable missing -> throw: infra absence is a failure, never a skip.
export function loadContractEnv(): ContractEnv {
  const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_DB_URL'].filter(
    (k) => !process.env[k],
  )
  if (missing.length) {
    throw new Error(
      `supabase contract env incomplete: missing ${missing.join(', ')} ` +
        `(expected in game/.env.supabase.contract or the shell environment)`,
    )
  }
  return {
    supabaseUrl: process.env.SUPABASE_URL!.replace(/\/+$/, ''),
    anonKey: process.env.SUPABASE_ANON_KEY!,
    dbUrl: process.env.SUPABASE_DB_URL!,
  }
}

export async function dbClient(env: ContractEnv): Promise<Client> {
  const client = new Client({ connectionString: env.dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  return client
}

export interface HttpResult {
  status: number
  // PostgREST/GoTrue bodies vary per endpoint (jsonb results, error objects,
  // raw rows); typing each would force a cast at every call site.
  body: any
}

async function http(
  env: ContractEnv,
  method: string,
  path: string,
  token: string | null,
  body?: unknown,
): Promise<HttpResult> {
  const headers: Record<string, string> = {
    apikey: env.anonKey,
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${env.supabaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const text = await res.text()
  // body may be JSON (usual) or plain text (e.g. PostgREST error messages)
  let parsed: any = text
  try {
    parsed = JSON.parse(text)
  } catch {
    /* leave raw */
  }
  return { status: res.status, body: parsed }
}

export function rpc(
  env: ContractEnv,
  token: string | null,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<HttpResult> {
  return http(env, 'POST', `/rest/v1/rpc/${fn}`, token, args)
}

export function rest(
  env: ContractEnv,
  token: string | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<HttpResult> {
  return http(env, method, `/rest/v1${path}`, token, body)
}

export interface TestUser {
  userId: string
  token: string
  kind: 'anonymous' | 'registered'
}

// GoTrue rate limits are per-endpoint buckets on hosted projects; transient
// 429s get a short bounded retry before the failure surfaces (never a skip).
async function gotruePost(env: ContractEnv, path: string, payload: object, attempts = 3) {
  let res: Response | undefined
  for (let i = 0; i < attempts; i++) {
    res = await fetch(`${env.supabaseUrl}${path}`, {
      method: 'POST',
      headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    })
    if (res.status !== 429) return res
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 20_000))
  }
  return res!
}

// Anonymous account through the real GoTrue signup endpoint.
export async function createAnonymousUser(env: ContractEnv): Promise<TestUser> {
  const res = await gotruePost(env, '/auth/v1/signup', {})
  const body = await res.json()
  if (!res.ok || !body.access_token) {
    throw new Error(`anonymous signup failed: ${res.status} ${JSON.stringify(body)}`)
  }
  return { userId: body.user.id, token: body.access_token, kind: 'anonymous' }
}

// Registered account: seeded directly in auth.users/auth.identities via the
// operator connection (the public email-signup path is domain-restricted on
// this project), then exercised through the real password grant.
export async function createRegisteredUser(
  env: ContractEnv,
  pg: Client,
): Promise<TestUser> {
  const userId = randomUUID()
  const suffix = userId.slice(0, 8)
  const email = `contract_${suffix}@example.test`
  const password = `pw-${randomUUID()}`
  const loginId = `reg_${suffix}`.slice(0, 20)
  await pg.query(
    `insert into auth.users(
       id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, confirmation_token, recovery_token,
       email_change, email_change_token_new,
       is_anonymous, raw_app_meta_data, raw_user_meta_data,
       created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       $2, extensions.crypt($3, extensions.gen_salt('bf')),
       now(), '', '', '', '',
       false, '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('account_kind','registered','login_id',$4::text),
       now(), now())`,
    [userId, email, password, loginId],
  )
  await pg.query(
    `insert into auth.identities(user_id, provider_id, provider, identity_data, created_at, updated_at)
     values ($1, $2::text, 'email', jsonb_build_object('sub', $2::text, 'email', $3::text), now(), now())`,
    [userId, userId, email],
  )
  const res = await gotruePost(env, '/auth/v1/token?grant_type=password', { email, password })
  const body = await res.json()
  if (!res.ok || !body.access_token) {
    throw new Error(`password grant failed: ${res.status} ${JSON.stringify(body)}`)
  }
  return { userId, token: body.access_token, kind: 'registered' }
}

let nameCounter = 0
export function uniqueName(prefix = 'T'): string {
  nameCounter += 1
  return `${prefix}${Date.now().toString(36)}${nameCounter.toString(36)}`.slice(0, 20)
}

// Faithful post-confirm auth state, proven live on staging GoTrue (PR6
// verdict): a confirmed email link leaves the bound email, its confirmation
// timestamp, a verified `email` identity row AND is_anonymous=false on
// auth.users. Any subset that leaves the user anonymous fails the
// post-finalize password bind (updateUser({password}) -> 422 while
// is_anonymous stays true).
export async function confirmEmailIdentity(pg: Client, userId: string, email: string) {
  await pg.query(
    'update auth.users set email = $2, email_confirmed_at = now(), is_anonymous = false, updated_at = now() where id = $1',
    [userId, email],
  )
  await pg.query(
    `insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
     values (gen_random_uuid(), $1::uuid, jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true), 'email', $2::text, now(), now(), now())
     on conflict do nothing`,
    [userId, email],
  )
}

// Anonymous signup that keeps the refresh token - the fixture's
// createAnonymousUser drops it, but token-refresh scenarios need the pair.
export async function signupAnonymousWithRefresh(env: ContractEnv) {
  const res = await gotruePost(env, '/auth/v1/signup', {})
  const body = await res.json()
  if (!res.ok || !body.access_token || !body.refresh_token) {
    throw new Error(`anonymous signup failed: ${res.status} ${JSON.stringify(body)}`)
  }
  return { userId: body.user.id as string, token: body.access_token as string, refreshToken: body.refresh_token as string }
}

// claim_active_session through the versioned admission overload; throws unless
// the server admitted the session.
export async function claimSession(
  env: ContractEnv,
  token: string,
  opts: { deviceLabel?: string; protocolVersion?: number; buildId?: string } = {},
): Promise<string> {
  const res = await rpc(env, token, 'claim_active_session', {
    p_device_label: opts.deviceLabel ?? 'contract-harness',
    p_protocol_version: opts.protocolVersion ?? 1,
    p_build_id: opts.buildId ?? 'contract-build',
  })
  if (res.status !== 200 || res.body?.status !== 'ADMITTED') {
    throw new Error(`claim not admitted: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return res.body.sessionId as string
}

export interface CharacterMeta {
  id: string
  name: string
  selectedTalentIds: string[]
  mortalBasicSkillId: string | null
  baseAttributes: Record<string, unknown>
  realmId: string
  realmLevel: number
}

// Provision a character through the real creation RPC pair.
export async function provisionCharacter(
  env: ContractEnv,
  token: string,
  sessionId: string,
  name = uniqueName(),
): Promise<CharacterMeta> {
  const roll = await rpc(env, token, 'create_talent_roll', { p_session_id: sessionId })
  if (roll.status !== 200 || !roll.body?.rollId) {
    throw new Error(`talent roll failed: ${roll.status} ${JSON.stringify(roll.body)}`)
  }
  const talentId = roll.body.talents?.[0]?.id
  if (!talentId) throw new Error(`talent roll returned no talents: ${JSON.stringify(roll.body)}`)
  const created = await rpc(env, token, 'create_character', {
    p_session_id: sessionId,
    p_roll_id: roll.body.rollId,
    p_name: name,
    p_talent_ids: [talentId],
    p_mortal_basic_skill_id: 'tram',
  })
  if (created.status !== 200 || created.body?.status !== 'CREATED') {
    throw new Error(`create_character failed: ${created.status} ${JSON.stringify(created.body)}`)
  }
  return created.body.character as CharacterMeta
}

// Canonical v87 save payload satisfying the server's contract: nonempty object,
// version == schema_version, required top-level arrays, provisioned identity.
export function buildSavePayload(
  char: CharacterMeta,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const player: Record<string, unknown> = {
    name: char.name,
    selectedTalentIds: [...char.selectedTalentIds],
  }
  if (char.mortalBasicSkillId) player.mortalBasicSkillId = char.mortalBasicSkillId
  return {
    version: 87,
    player,
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
    ...overrides,
  }
}

export interface ServerCheckpoint {
  checkpointId: string
  anchorAt: string
  leaseExpiresAt: string
}

export async function loadState(
  env: ContractEnv,
  token: string,
  sessionId: string,
// returns the raw status jsonb - each load status carries a different shape
): Promise<any> {
  const res = await rpc(env, token, 'load_game_state', { p_session_id: sessionId })
  if (res.status !== 200) {
    throw new Error(`load_game_state error: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return res.body
}

export async function writeSave(
  env: ContractEnv,
  token: string,
  args: {
    sessionId: string
    expectedRevision: number
    schemaVersion?: number
    payload: Record<string, unknown>
    buildId?: string
    mutationId?: string
    timeCheckpoint?: Record<string, unknown>
  },
): Promise<HttpResult> {
  return rpc(env, token, 'write_character_save', {
    p_session_id: args.sessionId,
    p_expected_revision: args.expectedRevision,
    p_schema_version: args.schemaVersion ?? 87,
    p_payload: args.payload,
    p_build_id: args.buildId ?? 'contract-build',
    p_mutation_id: args.mutationId ?? randomUUID(),
    p_time_checkpoint: args.timeCheckpoint ?? null,
  })
}

export function checkpointArg(cp: ServerCheckpoint, elapsedMonotonicMs = 100) {
  return { checkpointId: cp.checkpointId, elapsedMonotonicMs }
}

// ---------------------------------------------------------------------------
// Direct-SQL assertions (operator connection; mirrors what PostgREST callers
// cannot do). asUser replays a caller through set local role + jwt claims so
// in-transaction checks run under the same auth.uid() the API would see.
// ---------------------------------------------------------------------------

export async function sqlAsUser<T>(
  pg: Client,
  userId: string,
  role: 'authenticated' | 'anon',
  fn: () => Promise<T>,
): Promise<T> {
  await pg.query('begin')
  await pg.query(`set local role ${role === 'anon' ? 'anon' : 'authenticated'}`)
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

export async function saveRow(pg: Client, characterId: string) {
  const r = await pg.query(
    `select character_id, user_id, schema_version, save_revision,
            octet_length(payload::text) as payload_bytes, payload,
            progression_cutoff_at, last_mutation_id, last_client_build_id, updated_at
       from public.character_saves where character_id = $1`,
    [characterId],
  )
  const row = r.rows[0] ?? null
  // bigint columns surface as strings through node-pg; callers assert numbers
  if (row) row.save_revision = Number(row.save_revision)
  return row
}

export async function receiptRows(pg: Client, userId: string) {
  const r = await pg.query(
    `select * from public.save_mutation_receipts where owner_user_id = $1 order by created_at`,
    [userId],
  )
  return r.rows
}

// Acceptance seed (B1-C): the count of commits the server attributes to one
// mutation id - an identical retry must keep this at 1 forever.
export async function mutationReceiptCount(pg: Client, userId: string, mutationId: string) {
  const r = await pg.query(
    `select count(*)::int as n from public.save_mutation_receipts
       where owner_user_id = $1 and mutation_id = $2`,
    [userId, mutationId],
  )
  return r.rows[0].n as number
}

export async function activeSessionCount(pg: Client, userId: string) {
  const r = await pg.query(
    `select count(*)::int as n from public.account_sessions where user_id=$1 and revoked_at is null`,
    [userId],
  )
  return r.rows[0].n as number
}
