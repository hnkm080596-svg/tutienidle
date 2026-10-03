import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const packDir = path.resolve(scriptDir, '..')
const gameRoot = path.resolve(packDir, '../../../..')
const contractPath = path.join(scriptDir, 'stable-scene-extension.json')
const manifestPath = path.join(gameRoot, 'docs/design/huyen-kim-ui-art-manifest.json')
const contract = JSON.parse(await fs.readFile(contractPath, 'utf8'))
const mode = process.argv.includes('--build') ? 'build' : 'check'
const requiredVisualEvidence = [
  'preview/09-stable-symbols.png',
  'preview/10-scene-substrates.png',
  'preview/11-transparent-layer-kits.png',
  'preview/12-stable-scene-compositions.png',
  'preview/13-stable-scene-safe-areas.png',
  'preview/14-parallax-motion-qa.png',
]

const C = {
  ink: '#101718',
  lacquer: '#182524',
  jade: '#315f55',
  jadeHi: '#78a997',
  gold: '#b99a55',
  goldHi: '#e6ce8a',
  ivory: '#e8dfc4',
  cinnabar: '#8f342c',
  clear: 'rgba(0,0,0,0)',
}

const outputPath = (asset, scale) => path.join(packDir, `${asset.output_base}@${scale}x.png`)
const symbolPath = (id) => path.join(packDir, 'symbols', `${id}.svg`)
const rel = (value) => path.relative(packDir, value).replaceAll('\\', '/')
const esc = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

async function ensureParent(file) {
  await fs.mkdir(path.dirname(file), { recursive: true })
}

async function sha256(file) {
  const content = await fs.readFile(file)
  return createHash('sha256').update(content).digest('hex')
}

function duplicates(values) {
  const seen = new Set()
  const repeated = new Set()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated]
}

function svg(width, height, body, defs = '') {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${body}</svg>`,
  )
}

function checkerSvg(width, height) {
  return svg(width, height, `<pattern id="checker" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#202827"/><rect width="10" height="10" fill="#2d3735"/><rect x="10" y="10" width="10" height="10" fill="#2d3735"/></pattern><rect width="${width}" height="${height}" fill="url(#checker)"/>`)
}

function mapFrameSvg(asset, scale) {
  const w = asset.width * scale
  const h = asset.height * scale
  const s = scale
  return svg(w, h, `
    <path d="M${20 * s} ${54 * s}Q${20 * s} ${24 * s} ${52 * s} ${24 * s}H${w - 52 * s}Q${w - 20 * s} ${24 * s} ${w - 20 * s} ${54 * s}V${h - 54 * s}Q${w - 20 * s} ${h - 24 * s} ${w - 52 * s} ${h - 24 * s}H${52 * s}Q${20 * s} ${h - 24 * s} ${20 * s} ${h - 54 * s}Z" fill="none" stroke="${C.ink}" stroke-width="${18 * s}" opacity=".9"/>
    <path d="M${30 * s} ${54 * s}Q${30 * s} ${34 * s} ${52 * s} ${34 * s}H${w - 52 * s}Q${w - 30 * s} ${34 * s} ${w - 30 * s} ${54 * s}V${h - 54 * s}Q${w - 30 * s} ${h - 34 * s} ${w - 52 * s} ${h - 34 * s}H${52 * s}Q${30 * s} ${h - 34 * s} ${30 * s} ${h - 54 * s}Z" fill="none" stroke="${C.gold}" stroke-width="${4 * s}"/>
    <path d="M${44 * s} ${66 * s}V${44 * s}H${72 * s}M${w - 44 * s} ${66 * s}V${44 * s}H${w - 72 * s}M${44 * s} ${h - 66 * s}V${h - 44 * s}H${72 * s}M${w - 44 * s} ${h - 66 * s}V${h - 44 * s}H${w - 72 * s}" fill="none" stroke="${C.goldHi}" stroke-width="${3 * s}"/>
    <path d="M${78 * s} ${34 * s}Q${110 * s} ${10 * s} ${144 * s} ${34 * s}M${w - 78 * s} ${34 * s}Q${w - 110 * s} ${10 * s} ${w - 144 * s} ${34 * s}" fill="none" stroke="${C.jadeHi}" stroke-width="${3 * s}" opacity=".72"/>
  `)
}

function mapMaskSvg(asset, scale) {
  const w = asset.width * scale
  const h = asset.height * scale
  return svg(w, h, `
    <linearGradient id="fadeX"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset=".07" stop-color="white"/><stop offset=".93" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
    <linearGradient id="fadeY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset=".08" stop-color="white"/><stop offset=".92" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
    <mask id="m"><rect width="${w}" height="${h}" fill="url(#fadeX)"/><rect width="${w}" height="${h}" fill="url(#fadeY)" style="mix-blend-mode:multiply"/></mask>
    <rect x="${20 * scale}" y="${20 * scale}" width="${w - 40 * scale}" height="${h - 40 * scale}" rx="${26 * scale}" fill="white" mask="url(#m)"/>
  `)
}

function mapDividerSvg(asset, scale) {
  const w = asset.width * scale
  const h = asset.height * scale
  const cy = h / 2
  return svg(w, h, `
    <linearGradient id="g"><stop stop-color="${C.gold}" stop-opacity="0"/><stop offset=".15" stop-color="${C.gold}"/><stop offset=".5" stop-color="${C.jadeHi}"/><stop offset=".85" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></linearGradient>
    <path d="M0 ${cy}H${w}" stroke="url(#g)" stroke-width="${2 * scale}"/>
    <path d="M${w / 2 - 12 * scale} ${cy}L${w / 2} ${cy - 5 * scale}L${w / 2 + 12 * scale} ${cy}L${w / 2} ${cy + 5 * scale}Z" fill="${C.goldHi}" opacity=".78"/>
  `)
}

function meridianSvg(asset, scale) {
  const w = asset.width * scale
  const h = asset.height * scale
  const sx = w / asset.width
  const sy = h / asset.height
  const p = (x, y) => `${x * sx} ${y * sy}`
  return svg(w, h, `
    <filter id="glow"><feGaussianBlur stdDeviation="${3 * scale}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="qi" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${C.ivory}"/><stop offset=".45" stop-color="${C.goldHi}"/><stop offset="1" stop-color="${C.jadeHi}"/></linearGradient>
    <g fill="none" stroke="url(#qi)" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
      <path d="M${p(320, 70)}C${p(304, 130)} ${p(336, 170)} ${p(320, 230)}C${p(304, 300)} ${p(336, 350)} ${p(320, 448)}" stroke-width="${4 * scale}"/>
      <path d="M${p(320, 142)}C${p(270, 154)} ${p(232, 182)} ${p(214, 238)}M${p(320, 142)}C${p(370, 154)} ${p(408, 182)} ${p(426, 238)}" stroke-width="${2.4 * scale}" opacity=".86"/>
      <path d="M${p(320, 254)}C${p(280, 278)} ${p(258, 330)} ${p(248, 398)}M${p(320, 254)}C${p(360, 278)} ${p(382, 330)} ${p(392, 398)}" stroke-width="${2.4 * scale}" opacity=".8"/>
      <path d="M${p(320, 112)}C${p(288, 126)} ${p(278, 178)} ${p(286, 220)}C${p(294, 270)} ${p(278, 314)} ${p(264, 352)}M${p(320, 112)}C${p(352, 126)} ${p(362, 178)} ${p(354, 220)}C${p(346, 270)} ${p(362, 314)} ${p(376, 352)}" stroke-width="${1.4 * scale}" opacity=".6"/>
      <circle cx="${320 * sx}" cy="${270 * sy}" r="${43 * scale}" stroke-width="${2.4 * scale}" opacity=".9"/>
      <circle cx="${320 * sx}" cy="${270 * sy}" r="${27 * scale}" stroke-width="${2 * scale}" opacity=".82"/>
      <circle cx="${320 * sx}" cy="${270 * sy}" r="${9 * scale}" fill="${C.goldHi}" stroke="none" opacity=".9"/>
    </g>
  `)
}

function deterministicBuffer(asset, scale) {
  if (asset.kind === 'deterministic-meridian') return meridianSvg(asset, scale)
  if (asset.kind === 'deterministic-map-frame') return mapFrameSvg(asset, scale)
  if (asset.kind === 'deterministic-map-mask') return mapMaskSvg(asset, scale)
  if (asset.kind === 'deterministic-map-divider') return mapDividerSvg(asset, scale)
  throw new Error(`Unsupported deterministic kind: ${asset.kind}`)
}

async function normalizeGenerated(asset) {
  const source = path.join(packDir, asset.source)
  if (!(await exists(source))) throw new Error(`Missing generated source: ${rel(source)}`)
  const targetW = asset.width * 2
  const targetH = asset.height * 2
  let pipeline = sharp(source, { failOn: 'error' }).rotate()

  if (!asset.alpha) {
    const buffer = await pipeline
      .flatten({ background: C.ink })
      .resize(targetW, targetH, { fit: 'cover', position: asset.position ?? 'centre', kernel: sharp.kernel.lanczos3 })
      .removeAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer()
    return buffer
  }

  if (asset.fit === 'cover') {
    return pipeline
      .ensureAlpha()
      .resize(targetW, targetH, { fit: 'cover', position: asset.position ?? 'centre', kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 9 })
      .toBuffer()
  }

  const margin = asset.transparent_margin
  const innerW = targetW - (margin.left + margin.right) * 2
  const innerH = targetH - (margin.top + margin.bottom) * 2
  const trimmed = await pipeline
    .ensureAlpha()
    .trim({ background: C.clear })
    .resize(innerW, innerH, { fit: 'inside', withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer()
  const meta = await sharp(trimmed).metadata()
  const left = Math.round((targetW - meta.width) / 2)
  let top = Math.round((targetH - meta.height) / 2)
  if (asset.position === 'north') top = margin.top * 2
  if (asset.position === 'south') top = targetH - margin.bottom * 2 - meta.height
  return sharp({ create: { width: targetW, height: targetH, channels: 4, background: C.clear } })
    .composite([{ input: trimmed, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function buildAsset(asset) {
  const two = asset.kind === 'generated'
    ? await normalizeGenerated(asset)
    : await sharp(deterministicBuffer(asset, 2)).png({ compressionLevel: 9 }).toBuffer()
  const twoPath = outputPath(asset, 2)
  const onePath = outputPath(asset, 1)
  await ensureParent(twoPath)
  await fs.writeFile(twoPath, two)
  const one = await sharp(two)
    .resize(asset.width, asset.height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await fs.writeFile(onePath, one)
}

async function alphaBounds(file) {
  const image = sharp(file).ensureAlpha()
  const stats = await image.stats()
  const alpha = stats.channels[3]
  if (!alpha || alpha.min === 255) return null
  if (alpha.max === 0) return { empty: true }
  const { info } = await image
    .trim({ background: C.clear })
    .png()
    .toBuffer({ resolveWithObject: true })
  return {
    x: -(info.trimOffsetLeft ?? 0),
    y: -(info.trimOffsetTop ?? 0),
    width: info.width,
    height: info.height,
  }
}

async function validateSymbol(id) {
  const file = symbolPath(id)
  const errors = []
  if (!(await exists(file))) return [`missing symbol: ${rel(file)}`]
  const content = await fs.readFile(file, 'utf8')
  if (!/viewBox=["']0 0 24 24["']/.test(content)) errors.push(`${id}: viewBox must be 0 0 24 24`)
  if (/<text\b/i.test(content)) errors.push(`${id}: text element is forbidden`)
  if (/<image\b/i.test(content)) errors.push(`${id}: embedded raster is forbidden`)
  if (/#[0-9a-f]{3,8}/i.test(content)) errors.push(`${id}: literal color is forbidden`)
  if (!/<(path|polyline|polygon|circle|rect|line)\b/i.test(content)) errors.push(`${id}: no vector geometry`)
  if (!/currentColor/.test(content)) errors.push(`${id}: currentColor tint contract is required`)
  return errors
}

async function validateAsset(asset) {
  const errors = []
  const records = []
  if (!Number.isInteger(asset.width) || asset.width <= 0 || !Number.isInteger(asset.height) || asset.height <= 0) {
    errors.push(`${asset.asset_id}: width and height must be positive integers`)
  }
  const boxes = [asset.content_safe_rect, ...(asset.runtime_reserved_rects ?? [])]
  for (const box of boxes) {
    const valid = box && [box.x, box.y, box.width, box.height].every((value) => Number.isFinite(value))
    const inBounds = valid
      && box.x >= 0 && box.y >= 0 && box.width >= 0 && box.height >= 0
      && box.x + box.width <= asset.width && box.y + box.height <= asset.height
    if (!inBounds) errors.push(`${asset.asset_id}: safe or reserved rectangle is outside the canvas`)
  }
  for (const scale of [1, 2]) {
    const file = outputPath(asset, scale)
    if (!(await exists(file))) {
      errors.push(`missing output: ${rel(file)}`)
      continue
    }
    const metadata = await sharp(file).metadata()
    const expectedW = asset.width * scale
    const expectedH = asset.height * scale
    if (metadata.width !== expectedW || metadata.height !== expectedH) {
      errors.push(`${asset.asset_id}@${scale}x: expected ${expectedW}x${expectedH}, got ${metadata.width}x${metadata.height}`)
    }
    if (asset.alpha && !metadata.hasAlpha) errors.push(`${asset.asset_id}@${scale}x: alpha channel required`)
    const stats = await sharp(file).ensureAlpha().stats()
    if (asset.alpha && stats.channels[3].min === 255) errors.push(`${asset.asset_id}@${scale}x: transparency required`)
    if (!asset.alpha && metadata.hasAlpha && stats.channels[3].min < 255) errors.push(`${asset.asset_id}@${scale}x: must be opaque`)
    const bounds = await alphaBounds(file)
    if (asset.alpha && bounds?.empty) errors.push(`${asset.asset_id}@${scale}x: transparent asset must contain visible pixels`)
    records.push({ scale, file: rel(file), width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha, bounds })
  }
  if (records.length === 2 && asset.alpha && records[0].bounds && records[1].bounds && !records[0].bounds.empty && !records[1].bounds.empty) {
    for (const key of ['x', 'y', 'width', 'height']) {
      if (Math.abs(records[0].bounds[key] * 2 - records[1].bounds[key]) > 4) {
        errors.push(`${asset.asset_id}: paired alpha bounds drift on ${key}`)
      }
    }
  }
  const normalized = `/${asset.output_base}/`
  for (const fragment of contract.banned_output_fragments) {
    if (normalized.includes(fragment)) errors.push(`${asset.asset_id}: banned output category ${fragment}`)
  }
  return { errors, records }
}

async function validateHumanVisualInspection() {
  const inspection = contract.human_visual_inspection
  if (!inspection || inspection.status !== 'PASS') {
    return { status: inspection?.status ?? 'PENDING', errors: [] }
  }
  const errors = []
  if (!Array.isArray(inspection.evidence) || inspection.evidence.length === 0) {
    return { status: 'STALE', errors: ['human visual inspection PASS requires hashed evidence'] }
  }
  const evidencePaths = inspection.evidence.map((item) => item?.path)
  const missingRequired = requiredVisualEvidence.filter((item) => !evidencePaths.includes(item))
  const unexpected = evidencePaths.filter((item) => !requiredVisualEvidence.includes(item))
  if (missingRequired.length || unexpected.length || duplicates(evidencePaths).length) {
    errors.push('human visual inspection evidence must match the six canonical preview sheets')
  }
  for (const evidence of inspection.evidence) {
    if (!evidence || typeof evidence.path !== 'string' || !/^[0-9a-f]{64}$/i.test(evidence.sha256 ?? '')) {
      errors.push('human visual inspection evidence requires path and SHA-256')
      continue
    }
    const file = path.join(packDir, evidence.path)
    if (!(await exists(file))) {
      errors.push(`human visual inspection evidence is missing: ${evidence.path}`)
      continue
    }
    const actual = await sha256(file)
    if (actual !== evidence.sha256.toLowerCase()) {
      errors.push(`human visual inspection evidence changed: ${evidence.path}`)
    }
  }
  return { status: errors.length ? 'STALE' : 'PASS', errors }
}

async function validateManifestParity() {
  const errors = []
  if (!(await exists(manifestPath))) return [`missing frontend manifest: ${path.relative(gameRoot, manifestPath)}`]
  let manifest
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  } catch (error) {
    return [`frontend manifest is not valid JSON: ${error.message}`]
  }
  const extension = manifest.stable_scene_extension
  if (!extension) return ['frontend manifest is missing stable_scene_extension']
  const expectedCounts = {
    package_count: contract.packages.length,
    raster_asset_count: contract.assets.length,
    production_png_files: contract.assets.length * 2,
    symbol_count: contract.symbols.length,
  }
  for (const [key, expected] of Object.entries(expectedCounts)) {
    if (extension[key] !== expected) errors.push(`frontend manifest ${key}: expected ${expected}, got ${extension[key]}`)
  }
  const aggregateExpected = (manifest.meta?.production_png_files ?? 0) + expectedCounts.production_png_files + expectedCounts.symbol_count
  if (manifest.meta?.aggregate_production_files !== aggregateExpected) {
    errors.push(`frontend manifest aggregate_production_files: expected ${aggregateExpected}, got ${manifest.meta?.aggregate_production_files}`)
  }
  const manifestPackages = new Map((extension.packages ?? []).map((item) => [item.package_id, item]))
  if (manifestPackages.size !== contract.packages.length) errors.push('frontend manifest package set does not match the contract')
  for (const item of contract.packages) {
    const actual = manifestPackages.get(item.package_id)
    if (!actual || JSON.stringify(actual) !== JSON.stringify(item)) errors.push(`frontend manifest package drift: ${item.package_id}`)
  }
  const manifestAssets = new Map((extension.raster_assets ?? []).map((item) => [item.asset_id, item]))
  if (manifestAssets.size !== contract.assets.length) errors.push('frontend manifest raster asset set does not match the contract')
  for (const asset of contract.assets) {
    const actual = manifestAssets.get(asset.asset_id)
    if (!actual) {
      errors.push(`frontend manifest missing raster asset: ${asset.asset_id}`)
      continue
    }
    const expectedPath = {
      '@1x': `public/assets/ui/huyen-kim/${asset.output_base}@1x.png`,
      '@2x': `public/assets/ui/huyen-kim/${asset.output_base}@2x.png`,
    }
    const comparable = ['package_id', 'width', 'height', 'alpha', 'content_safe_rect', 'runtime_reserved_rects', 'parallax']
    if (JSON.stringify(actual.path) !== JSON.stringify(expectedPath)) errors.push(`frontend manifest path drift: ${asset.asset_id}`)
    for (const key of comparable) {
      if (JSON.stringify(actual[key] ?? null) !== JSON.stringify(asset[key] ?? null)) {
        errors.push(`frontend manifest ${key} drift: ${asset.asset_id}`)
      }
    }
  }
  const manifestSymbols = new Map((extension.symbols ?? []).map((item) => [path.basename(item.path ?? '', '.svg'), item]))
  if (manifestSymbols.size !== contract.symbols.length) errors.push('frontend manifest symbol set does not match the contract')
  for (const id of contract.symbols) {
    const actual = manifestSymbols.get(id)
    if (!actual || actual.asset_id !== `symbol-${id}` || actual.path !== `public/assets/ui/huyen-kim/symbols/${id}.svg`) {
      errors.push(`frontend manifest symbol drift: ${id}`)
    }
  }
  if (extension.qa_report !== 'public/assets/ui/huyen-kim/_source/stable-scene-extension-qa.json') {
    errors.push('frontend manifest qa_report path drift')
  }
  return errors
}

async function validateAll({ checkVisualEvidence = true } = {}) {
  const errors = []
  const files = []
  const packageIds = contract.packages.map((item) => item.package_id)
  for (const id of duplicates(packageIds)) errors.push(`duplicate package_id: ${id}`)
  for (const id of duplicates(contract.assets.map((item) => item.asset_id))) errors.push(`duplicate asset_id: ${id}`)
  for (const output of duplicates(contract.assets.map((item) => item.output_base))) errors.push(`duplicate output_base: ${output}`)
  for (const id of duplicates(contract.symbols)) errors.push(`duplicate symbol id: ${id}`)
  const knownPackages = new Set(packageIds)
  for (const asset of contract.assets) {
    if (!knownPackages.has(asset.package_id)) errors.push(`${asset.asset_id}: unknown package_id ${asset.package_id}`)
  }
  for (const asset of contract.assets) {
    const result = await validateAsset(asset)
    errors.push(...result.errors)
    files.push(...result.records.map((record) => ({ asset_id: asset.asset_id, ...record })))
  }
  for (const id of contract.symbols) errors.push(...await validateSymbol(id))
  errors.push(...await validateManifestParity())
  let visualInspection = { status: contract.human_visual_inspection?.status ?? 'PENDING', errors: [] }
  if (checkVisualEvidence) {
    visualInspection = await validateHumanVisualInspection()
    errors.push(...visualInspection.errors)
  }
  const stacks = new Map()
  for (const asset of contract.assets.filter((item) => item.parallax)) {
    const list = stacks.get(asset.parallax.stack) ?? []
    list.push(asset)
    stacks.set(asset.parallax.stack, list)
  }
  for (const [stackId, stackAssets] of stacks) {
    stackAssets.sort((a, b) => a.parallax.order - b.parallax.order)
    const width = stackAssets[0].width
    const height = stackAssets[0].height
    const orders = stackAssets.map((asset) => asset.parallax.order)
    const uniqueOrders = new Set(orders)
    if (uniqueOrders.size !== orders.length) errors.push(`${stackId}: duplicate parallax order`)
    if (orders.some((order, index) => order !== index)) errors.push(`${stackId}: parallax order must be contiguous from zero`)
    const depths = stackAssets.map((asset) => asset.parallax.depth)
    const uniqueDepths = new Set(depths)
    if (uniqueDepths.size !== depths.length) errors.push(`${stackId}: duplicate parallax depth`)
    if (depths.some((depth, index) => depth !== `L${index}`)) errors.push(`${stackId}: parallax depth must match contiguous order`)
    if (stackAssets.some((asset) => asset.width !== width || asset.height !== height)) errors.push(`${stackId}: all parallax canvases must align`)
    if (stackAssets[0].alpha) errors.push(`${stackId}: order zero sky must be opaque`)
    if (stackAssets.slice(1).some((asset) => !asset.alpha)) errors.push(`${stackId}: upper parallax layers must preserve alpha`)
    if (stackAssets.some((asset) => asset.parallax.reduced_motion_offset_px !== 0)) errors.push(`${stackId}: reduced-motion offset must be zero`)
    if (stackAssets.some((asset) => asset.parallax.max_drift_px.x < 0 || asset.parallax.max_drift_px.y < 0)) errors.push(`${stackId}: maximum drift must be non-negative`)
    for (let i = 1; i < stackAssets.length; i++) {
      const previous = stackAssets[i - 1].parallax.max_drift_px
      const current = stackAssets[i].parallax.max_drift_px
      if (current.x < previous.x || current.y < previous.y) errors.push(`${stackId}: near-layer drift must not be smaller than far-layer drift`)
    }
  }
  return { errors, files, visualInspection }
}

async function renderAssetPreview(asset, width, height) {
  const file = outputPath(asset, 1)
  const background = asset.alpha
    ? sharp(checkerSvg(width, height)).png()
    : sharp({ create: { width, height, channels: 4, background: C.ink } })
  const image = await sharp(file).resize(width - 28, height - 48, { fit: 'inside', withoutEnlargement: false }).png().toBuffer()
  const meta = await sharp(image).metadata()
  return background
    .composite([
      { input: image, left: Math.round((width - meta.width) / 2), top: 12 + Math.round((height - 48 - meta.height) / 2) },
      { input: svg(width, 36, `<rect width="${width}" height="36" fill="#0b1112" opacity=".94"/><text x="12" y="23" fill="${C.ivory}" font-family="Arial" font-size="14">${esc(asset.asset_id)}</text>`), left: 0, top: height - 36 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function contactSheet(filename, title, assetIds, columns = 3) {
  const cellW = 390
  const cellH = 280
  const rows = Math.ceil(assetIds.length / columns)
  const width = columns * cellW
  const height = 64 + rows * cellH
  const layers = [{ input: svg(width, 64, `<rect width="${width}" height="64" fill="${C.ink}"/><text x="18" y="38" fill="${C.goldHi}" font-family="Arial" font-size="22">${esc(title)}</text>`), left: 0, top: 0 }]
  for (let i = 0; i < assetIds.length; i++) {
    const asset = contract.assets.find((item) => item.asset_id === assetIds[i])
    const card = await renderAssetPreview(asset, cellW - 16, cellH - 16)
    layers.push({ input: card, left: (i % columns) * cellW + 8, top: 64 + Math.floor(i / columns) * cellH + 8 })
  }
  const out = path.join(packDir, 'preview', filename)
  await ensureParent(out)
  await sharp({ create: { width, height, channels: 4, background: '#131b1b' } }).composite(layers).png({ compressionLevel: 9 }).toFile(out)
}

async function symbolSheet() {
  const cell = 96
  const columns = 6
  const rows = Math.ceil(contract.symbols.length / columns)
  const width = cell * columns
  const height = 64 + rows * cell
  const layers = [{ input: svg(width, 64, `<rect width="${width}" height="64" fill="${C.ink}"/><text x="18" y="38" fill="${C.goldHi}" font-family="Arial" font-size="21">Stable symbols at 20 / 24 / 32 px</text>`), left: 0, top: 0 }]
  for (let i = 0; i < contract.symbols.length; i++) {
    const id = contract.symbols[i]
    const source = await fs.readFile(symbolPath(id), 'utf8')
    const tinted = source.replaceAll('currentColor', C.goldHi)
    const icon = await sharp(Buffer.from(tinted)).resize(32, 32).png().toBuffer()
    const x = (i % columns) * cell
    const y = 64 + Math.floor(i / columns) * cell
    layers.push({ input: svg(cell - 8, cell - 8, `<rect x="1" y="1" width="${cell - 10}" height="${cell - 10}" rx="8" fill="${i % 2 ? C.ivory : C.lacquer}" stroke="${C.gold}"/><text x="${(cell - 8) / 2}" y="${cell - 20}" text-anchor="middle" fill="${i % 2 ? C.ink : C.ivory}" font-family="Arial" font-size="10">${esc(id)}</text>`), left: x + 4, top: y + 4 })
    layers.push({ input: icon, left: x + 32, top: y + 18 })
  }
  const out = path.join(packDir, 'preview', '09-stable-symbols.png')
  await ensureParent(out)
  await sharp({ create: { width, height, channels: 4, background: '#111817' } }).composite(layers).png({ compressionLevel: 9 }).toFile(out)
}

async function sceneThumbnail(label, assetIds, overlays = []) {
  const width = 400
  const height = 250
  const base = sharp({ create: { width, height, channels: 4, background: '#17201f' } })
  const layers = []
  for (const id of assetIds) {
    const asset = contract.assets.find((item) => item.asset_id === id)
    const file = outputPath(asset, 1)
    const image = await sharp(file).resize(width, height - 34, { fit: asset.alpha ? 'contain' : 'cover', position: 'center' }).png().toBuffer()
    const meta = await sharp(image).metadata()
    layers.push({ input: image, left: Math.round((width - meta.width) / 2), top: Math.round((height - 34 - meta.height) / 2) })
  }
  const overlayBody = overlays.map((box) => `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="none" stroke="${box.color ?? C.goldHi}" stroke-width="2" stroke-dasharray="6 4"/>`).join('')
  layers.push({ input: svg(width, height, `${overlayBody}<rect y="${height - 34}" width="${width}" height="34" fill="#0b1112" opacity=".94"/><text x="12" y="${height - 12}" fill="${C.ivory}" font-family="Arial" font-size="13">${esc(label)} - runtime regions are dashed</text>`), left: 0, top: 0 })
  return base.composite(layers).png({ compressionLevel: 9 }).toBuffer()
}

async function compositionSheet() {
  const scenes = [
    ['01/02 Auth + Creation', ['auth-creation-00-sky', 'auth-creation-01-far-mountains', 'auth-creation-02-mid-landscape', 'auth-creation-03-focal-architecture', 'auth-creation-04-low-mist', 'auth-creation-05-foreground'], [{ x: 252, y: 28, width: 124, height: 174 }]],
    ['05 Realm', ['realm-ascent-00-sky', 'realm-ascent-01-far-mountains', 'realm-ascent-02-mid-ascent', 'realm-ascent-03-summit-architecture', 'realm-ascent-04-low-mist'], [{ x: 42, y: 20, width: 278, height: 184 }]],
    ['06 Technique', ['technique-display-plinth'], [{ x: 92, y: 34, width: 216, height: 130 }]],
    ['07 Skill', ['skill-tree-00-sky', 'skill-tree-01-far-mountains', 'skill-tree-02-celestial-field', 'skill-tree-03-atmosphere'], [{ x: 58, y: 28, width: 284, height: 158 }]],
    ['08 Body', ['body-cultivation-figure', 'body-meridian-overlay'], [{ x: 52, y: 22, width: 296, height: 176 }]],
    ['10 Exploration', ['exploration-map-mask', 'exploration-map-frame', 'exploration-chapter-divider'], [{ x: 45, y: 28, width: 310, height: 166 }]],
    ['12 Equipment', ['equipment-paperdoll-base'], [{ x: 80, y: 24, width: 240, height: 178 }]],
    ['14 Tribulation', ['tribulation-sky-vignette', 'tribulation-storm-far', 'tribulation-storm-near', 'tribulation-dais'], [{ x: 104, y: 24, width: 192, height: 172 }]],
  ]
  const width = 800
  const height = 64 + 4 * 250
  const layers = [{ input: svg(width, 64, `<rect width="${width}" height="64" fill="${C.ink}"/><text x="18" y="38" fill="${C.goldHi}" font-family="Arial" font-size="21">Stable scene composition boards - review only</text>`), left: 0, top: 0 }]
  for (let i = 0; i < scenes.length; i++) {
    const card = await sceneThumbnail(...scenes[i])
    layers.push({ input: card, left: (i % 2) * 400, top: 64 + Math.floor(i / 2) * 250 })
  }
  const out = path.join(packDir, 'preview', '12-stable-scene-compositions.png')
  await ensureParent(out)
  await sharp({ create: { width, height, channels: 4, background: '#111817' } }).composite(layers).png({ compressionLevel: 9 }).toFile(out)
}

async function parallaxCard(stackId, factor) {
  const width = 400
  const height = 250
  const assets = contract.assets
    .filter((asset) => asset.parallax?.stack === stackId)
    .sort((a, b) => a.parallax.order - b.parallax.order)
  const layers = []
  for (const asset of assets) {
    const drift = asset.parallax.max_drift_px
    const x = Math.round((drift.x * factor * width) / asset.width)
    const y = Math.round((drift.y * factor * (height - 34)) / asset.height)
    const buffer = await sharp(outputPath(asset, 1))
      .resize(width + 16, height - 26, { fit: 'fill' })
      .extract({ left: 8 - x, top: 4 - y, width, height: height - 34 })
      .png()
      .toBuffer()
    layers.push({ input: buffer, left: 0, top: 0 })
  }
  let label = 'neutral'
  if (factor < 0) label = 'max negative drift'
  if (factor > 0) label = 'max positive drift'
  layers.push({ input: svg(width, 34, `<rect width="${width}" height="34" fill="#0b1112"/><text x="12" y="22" fill="${C.ivory}" font-family="Arial" font-size="13">${esc(stackId)} - ${label}</text>`), left: 0, top: height - 34 })
  return sharp({ create: { width, height, channels: 4, background: C.ink } }).composite(layers).png({ compressionLevel: 9 }).toBuffer()
}

async function parallaxMotionSheet() {
  const stacks = ['auth-creation', 'realm-ascent', 'skill-tree']
  const factors = [-1, 0, 1]
  const width = 1200
  const height = 64 + stacks.length * 250
  const layers = [{ input: svg(width, 64, `<rect width="${width}" height="64" fill="${C.ink}"/><text x="18" y="38" fill="${C.goldHi}" font-family="Arial" font-size="21">Parallax motion QA - aligned canvas and bounded drift</text>`), left: 0, top: 0 }]
  for (let row = 0; row < stacks.length; row++) {
    for (let col = 0; col < factors.length; col++) {
      layers.push({ input: await parallaxCard(stacks[row], factors[col]), left: col * 400, top: 64 + row * 250 })
    }
  }
  const out = path.join(packDir, 'preview', '14-parallax-motion-qa.png')
  await ensureParent(out)
  await sharp({ create: { width, height, channels: 4, background: '#111817' } }).composite(layers).png({ compressionLevel: 9 }).toFile(out)
}

async function safeAreaSheet() {
  const columns = 3
  const cellW = 400
  const cellH = 280
  const rows = Math.ceil(contract.assets.length / columns)
  const width = columns * cellW
  const height = 64 + rows * cellH
  const layers = [{ input: svg(width, 64, `<rect width="${width}" height="64" fill="${C.ink}"/><text x="18" y="38" fill="${C.goldHi}" font-family="Arial" font-size="21">Stable scene safe-area QA</text>`), left: 0, top: 0 }]
  for (let i = 0; i < contract.assets.length; i++) {
    const asset = contract.assets[i]
    const x = (i % columns) * cellW
    const y = 64 + Math.floor(i / columns) * cellH
    const preview = await renderAssetPreview(asset, cellW - 16, cellH - 16)
    const scale = Math.min((cellW - 44) / asset.width, (cellH - 74) / asset.height)
    const ox = x + 8 + Math.round((cellW - 16 - asset.width * scale) / 2)
    const oy = y + 20 + Math.round((cellH - 64 - asset.height * scale) / 2)
    const box = asset.content_safe_rect
    layers.push({ input: preview, left: x + 8, top: y + 8 })
    layers.push({ input: svg(cellW, cellH, `<rect x="${ox - x + box.x * scale}" y="${oy - y + box.y * scale}" width="${box.width * scale}" height="${box.height * scale}" fill="none" stroke="#63d68f" stroke-width="2"/><text x="14" y="18" fill="#63d68f" font-family="Arial" font-size="10">green = content safe</text>`), left: x, top: y })
  }
  const out = path.join(packDir, 'preview', '13-stable-scene-safe-areas.png')
  await ensureParent(out)
  await sharp({ create: { width, height, channels: 4, background: '#111817' } }).composite(layers).png({ compressionLevel: 9 }).toFile(out)
}

async function buildPreviews() {
  await symbolSheet()
  await contactSheet('10-scene-substrates.png', 'Aligned parallax background layers', ['auth-creation-00-sky', 'auth-creation-01-far-mountains', 'auth-creation-02-mid-landscape', 'auth-creation-03-focal-architecture', 'auth-creation-04-low-mist', 'auth-creation-05-foreground', 'realm-ascent-00-sky', 'realm-ascent-01-far-mountains', 'realm-ascent-02-mid-ascent', 'realm-ascent-03-summit-architecture', 'realm-ascent-04-low-mist', 'skill-tree-00-sky', 'skill-tree-01-far-mountains', 'skill-tree-02-celestial-field', 'skill-tree-03-atmosphere'], 3)
  await contactSheet('11-transparent-layer-kits.png', 'Stable independent layer kits', ['body-cultivation-figure', 'body-meridian-overlay', 'equipment-paperdoll-base', 'technique-display-plinth', 'exploration-map-frame', 'exploration-map-mask', 'exploration-chapter-divider', 'tribulation-storm-far', 'tribulation-storm-near', 'tribulation-dais', 'tribulation-sky-vignette'], 3)
  await compositionSheet()
  await safeAreaSheet()
  await parallaxMotionSheet()
}

async function writeQa(files, visualInspection) {
  const qa = {
    generated_at: new Date().toISOString(),
    contract: rel(contractPath),
    asset_count: contract.assets.length,
    raster_file_count: files.length,
    symbol_count: contract.symbols.length,
    checks: {
      exact_dimensions: 'PASS',
      alpha_contract: 'PASS',
      paired_scale_alignment: 'PASS',
      banned_output_categories: 'PASS',
      symbol_structure: 'PASS',
      human_visual_inspection: visualInspection.status,
    },
    human_visual_inspection: contract.human_visual_inspection ?? null,
    files: files.map((file) => {
      const asset = contract.assets.find((item) => item.asset_id === file.asset_id)
      return { ...file, parallax: asset.parallax ?? null }
    }),
  }
  await fs.writeFile(path.join(scriptDir, 'stable-scene-extension-qa.json'), `${JSON.stringify(qa, null, 2)}\n`)
}

if (mode === 'build') {
  for (const asset of contract.assets) await buildAsset(asset)
  const result = await validateAll({ checkVisualEvidence: false })
  if (result.errors.length) {
    console.error(result.errors.join('\n'))
    process.exitCode = 1
  } else {
    await buildPreviews()
    const finalResult = await validateAll()
    if (finalResult.errors.length) {
      console.error(finalResult.errors.join('\n'))
      process.exitCode = 1
    } else {
      await writeQa(finalResult.files, finalResult.visualInspection)
      console.log(JSON.stringify({ assets: contract.assets.length, pngs: finalResult.files.length, symbols: contract.symbols.length, previews: 6 }, null, 2))
    }
  }
} else {
  const result = await validateAll()
  if (result.errors.length) {
    console.error(result.errors.join('\n'))
    process.exitCode = 1
  } else {
    console.log(JSON.stringify({ status: 'PASS', assets: contract.assets.length, pngs: result.files.length, symbols: contract.symbols.length }, null, 2))
  }
}
