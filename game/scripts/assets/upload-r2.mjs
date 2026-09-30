// Upload cdn-assets/ to a Cloudflare R2 bucket via the S3-compatible API.
// Zero-dependency SigV4 client: HEAD-compares remote ETag (md5 of the object
// for simple PUTs) and PUTs only changed files, so re-runs are cheap.
//
// Env (never committed - read from environment only):
//   R2_ACCOUNT_ID         Cloudflare account id (R2 dashboard URL)
//   R2_ACCESS_KEY_ID      R2 API token access key (Object Read & Write)
//   R2_SECRET_ACCESS_KEY  R2 API token secret
//   R2_BUCKET             bucket name (default: tutienidle-assets)
//
// Usage:
//   node scripts/assets/upload-r2.mjs [--src DIR] [--dry-run]
import { createHash, createHmac } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const get = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : fallback
}
const SRC = path.resolve(get('--src', 'cdn-assets'))
const DRY = args.includes('--dry-run')

const ACCOUNT = process.env.R2_ACCOUNT_ID ?? ''
const ACCESS = process.env.R2_ACCESS_KEY_ID ?? ''
const SECRET = process.env.R2_SECRET_ACCESS_KEY ?? ''
const BUCKET = process.env.R2_BUCKET ?? 'tutienidle-assets'

if (!DRY && (!ACCOUNT || !ACCESS || !SECRET)) {
  console.error('missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY')
  process.exit(1)
}

const HOST = `${ACCOUNT}.r2.cloudflarestorage.com`
const REGION = 'auto'
const SERVICE = 's3'

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const hmac = (key, data, enc) => createHmac('sha256', key).update(data).digest(enc)

const CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
}

function signRequest(method, key, payloadHash, extraHeaders = {}) {
  const now = new Date()
  const amz = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const date = amz.slice(0, 8)

  const headers = {
    host: HOST,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amz,
    ...extraHeaders,
  }
  const signedNames = Object.keys(headers).sort()
  const canonicalHeaders = signedNames.map((n) => `${n}:${String(headers[n]).trim()}\n`).join('')
  const canonical = [
    method,
    `/${BUCKET}/${key}`,
    '',
    canonicalHeaders,
    signedNames.join(';'),
    payloadHash,
  ].join('\n')

  const scope = `${date}/${REGION}/${SERVICE}/aws4_request`
  const toSign = `AWS4-HMAC-SHA256\n${amz}\n${scope}\n${sha256(canonical)}`
  const kDate = hmac(`AWS4${SECRET}`, date)
  const kRegion = hmac(kDate, REGION)
  const kService = hmac(kRegion, SERVICE)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(toSign).digest('hex')

  headers.Authorization =
    `AWS4-HMAC-SHA256 Credential=${ACCESS}/${scope}, ` +
    `SignedHeaders=${signedNames.join(';')}, Signature=${signature}`
  return headers
}

async function remoteEtag(key) {
  const res = await fetch(`https://${HOST}/${BUCKET}/${key}`, {
    method: 'HEAD',
    headers: signRequest('HEAD', key, sha256('')),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HEAD ${key}: ${res.status}`)
  return res.headers.get('etag')?.replace(/"/g, '') ?? null
}

async function putObject(key, file) {
  const body = readFileSync(file)
  const ext = path.extname(file).toLowerCase()
  const res = await fetch(`https://${HOST}/${BUCKET}/${key}`, {
    method: 'PUT',
    headers: signRequest('PUT', key, sha256(body), {
      'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    }),
    body,
  })
  if (!res.ok) throw new Error(`PUT ${key}: ${res.status} ${await res.text()}`)
}

const walk = function* (dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

let uploaded = 0
let unchanged = 0
const errors = []

for (const file of walk(SRC)) {
  const key = path.relative(SRC, file).split(path.sep).join('/')
  const localMd5 = createHash('md5').update(readFileSync(file)).digest('hex')

  if (DRY) {
    console.log(`[dry] ${key} (${statSync(file).size} bytes)`)
    continue
  }

  try {
    const etag = await remoteEtag(key)
    if (etag === localMd5) {
      unchanged += 1
      continue
    }
    await putObject(key, file)
    uploaded += 1
  } catch (err) {
    errors.push(`${key}: ${String(err?.message ?? err)}`)
  }
}

console.log(`uploaded ${uploaded}, unchanged ${unchanged}, errors ${errors.length}`)
for (const e of errors) console.error(`  ${e}`)
if (errors.length > 0) process.exitCode = 1
