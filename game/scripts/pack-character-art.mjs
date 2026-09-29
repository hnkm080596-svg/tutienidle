// Pack NEWSPRITE character dumps (Unity AssetRipper layout) into the project's
// trimmed TexturePacker-JSON-Hash atlas format consumed by
// CombatAnimationCatalogue / load.atlas().
//
// Sibling of pack-enemy-art.mjs - same emission model, different dump layout:
//   character/<slug>/anim/<slug>-idle/<slug>-idle-N.png(.png)
//   character/<slug>/anim/<slug>-attack/..., <slug>-ult/..., death/<slug>-death-N.png
//   character/<slug>/avatar/<slug>-<role>-avatar.png + <slug>.png
//   character/<slug>/portrait/<slug>-<pose>.png
//   character/<slug>/closeup/, radar-chart/  (staged, unwired)
//
// `ult` is the character-only clip (enemy packer emits skill/enrage/...
// instead). It is OPTIONAL downstream: catalogues emit it when the variant
// carries one, playback treats it like `attack` (play-once -> standby).
// `<slug>-cast-<key>` dirs emit per-skill cast clips into `manifest.cast` -
// keyed by skillId or slot role, resolved by startCastPlayback before slot-role.
//
// Missing pieces are SYNTHESIZED where the contract requires them:
//   - no `death` clip (most characters): last attack frame, darkened 45%
//   - no roster avatar: alpha-bbox crop of idle-1 into a square PNG
//
// Usage:
//   node scripts/pack-character-art.mjs --src <assets-character-dir> [--dry-run]
import { createCanvas, loadImage } from 'canvas'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const SRC_ARG = args[args.indexOf('--src') + 1] || null
const DRY_RUN = args.includes('--dry-run')
// --only <out1,out2>: emit just those EMISSIONS rows (partial rerun without
// the other dumps on hand) and MERGE their reports into the existing
// manifest instead of replacing it wholesale.
const ONLY_ARG = args[args.indexOf('--only') + 1]?.split(',').filter(Boolean) ?? null

// Impact-sync: authored impact frames live in art/animation-impact-markers.json
// (clip-local index, 0..frameCount-1, keyed by SOURCE clip name like
// 'attack'/'ult'/'cast-linh_bao'). This packer validates them and emits
// impactFrameIndex into each clip's manifest entry; the runtime reads the
// same JSON through the registries, so the manifest is a drift-check.
const IMPACT_MARKERS = JSON.parse(
  readFileSync(new URL('../art/animation-impact-markers.json', import.meta.url), 'utf8'),
).characters ?? {}

if (!SRC_ARG) {
  throw new Error('Usage: pack-character-art.mjs --src <NEWSPRITE character dir> [--dry-run]')
}
const SRC_ROOT = path.resolve(SRC_ARG)
const OUT_ROOT = path.resolve('public/assets/characters/animated')

const PADDING = 2
const MAX_SHEET = 4096
const ZERO_PAD = 3
const FRAME_SUFFIX = '.png'

// ---------------------------------------------------------------------------
// Emission table - the ONLY place character->variant wiring lives.
// ---------------------------------------------------------------------------
const EMISSIONS = [
  { out: 'zuofeng', src: 'zuofeng' },
  { out: 'fenli', src: 'fenli' },
  { out: 'gaosheng', src: 'gaosheng', scale: 0.75 },
  { out: 'jinglian', src: 'jinglian', scale: 0.75 },
  { out: 'qingshuangzi', src: 'qingshuangzi', scale: 0.75 },
  { out: 'weiqi', src: 'weiqi', scale: 0.75 },
  { out: 'xuandao', src: 'xuandao', scale: 0.75 },
  { out: 'youzhu', src: 'youzhu', scale: 0.75 },
  { out: 'yuejianxin', src: 'yuejianxin', scale: 0.75 },
  { out: 'ziyuan', src: 'ziyuan', scale: 0.75 },
  // Minh hand-drawn player sets (2026-09-27): cell-sliced dumps, 1x scale.
  { out: 'pham_nhan', src: 'pham_nhan', scale: 0.75 },
  { out: 'pham_nhan_unarmed', src: 'pham_nhan_unarmed', scale: 0.75 },
  { out: 'ngu_kiem', src: 'ngu_kiem', scale: 0.75 },
  { out: 'ngu_hanh', src: 'ngu_hanh', scale: 0.75 },
]

// Base clips keep contract order; per-skill cast clips (`cast-<key>` dirs)
// sort alphabetically after them so new skills need no packer edit.
const CLIP_ORDER = ['idle', 'attack', 'ult', 'death']
const REQUIRED_CLIPS = ['idle', 'death'] // contract minimum (standby reuses idle frames)

// ---------------------------------------------------------------------------

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

function stripVersionSuffix(file) {
  // dump artifact: `foo.png.png` -> `foo.png`
  return file.endsWith('.png.png') ? file.slice(0, -4) : file
}

function clipOfDirName(dirName) {
  const last = dirName.split(/[\\/]/).pop()
  // death ships both layouts across dumps: bare `death/` AND `<slug>-death/`
  // (same convention as idle/attack/ult) - accept both or real death frames
  // are silently replaced by the synthesized last-attack frame.
  // `cast-<key>` dirs carry per-skill cast clips (key = skillId or slot role
  // like 'special') - the key rides the clip name through the manifest.
  const m = last.match(/(?:^|-)(idle|attack|ult|death|cast-[a-z0-9_]+)$/i)
  return m ? m[1].toLowerCase() : null
}

function frameIndex(file) {
  const m = stripVersionSuffix(path.basename(file)).match(/-(\d+)\.png$/i)
  return m ? Number(m[1]) : null
}

function readPivot(jsonPath) {
  // Unity serializes vectors as { m_X, m_Y }; newer dumps may use { x, y }.
  try {
    const meta = JSON.parse(readFileSync(jsonPath, 'utf8'))
    const p = meta?.m_Pivot
    if (p) {
      if (typeof p.m_X === 'number' && typeof p.m_Y === 'number') return { x: p.m_X, y: p.m_Y }
      if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y }
    }
  } catch { /* fall through to default */ }
  // Same default a missing pivot file uses (line ~204): provenance must not
  // disagree with itself depending on WHICH failure produced it.
  return { x: 0.5, y: 1.0 }
}

function darken(context, w, h, factor) {
  const img = context.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    d[i] = Math.round(d[i] * factor)
    d[i + 1] = Math.round(d[i + 1] * factor)
    d[i + 2] = Math.round(d[i + 2] * factor)
  }
  context.putImageData(img, 0, 0)
}

function opaqueBounds(context, w, h) {
  const { data } = context.getImageData(0, 0, w, h)
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) throw new Error('fully transparent frame')
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

async function loadFrame(file, sourceSize, syntheticDeath, scale = 1) {
  const img = await loadImage(file)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  if (sourceSize && (w !== sourceSize.w || h !== sourceSize.h)) {
    throw new Error(`${file}: inconsistent canvas ${w}x${h}, expected ${sourceSize.w}x${sourceSize.h}`)
  }
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = scale !== 1
  ctx.drawImage(img, 0, 0, w, h)
  if (syntheticDeath) darken(ctx, w, h, 0.55)
  return { canvas, ctx, bounds: opaqueBounds(ctx, w, h), size: { w, h } }
}

function discoverClips(speciesDir) {
  const clips = new Map() // clip -> [{file, index}]
  for (const file of walk(speciesDir)) {
    const base = stripVersionSuffix(path.basename(file))
    if (!/\.png$/i.test(base)) continue
    const clip = clipOfDirName(path.dirname(file))
    if (!clip) continue
    const idx = frameIndex(file)
    if (idx === null) continue
    if (!clips.has(clip)) clips.set(clip, [])
    clips.get(clip).push({ file, index: idx })
  }
  for (const list of clips.values()) list.sort((a, b) => a.index - b.index)
  return clips
}

// Copy every PNG of one dump subdir (avatar/, portrait/, closeup/,
// radar-chart/) into <out>/<sub>/, recording sizes keyed by the filename
// remainder after `<slug>-`. Returns {} when the subdir is absent.
async function stageSubdir(speciesDir, outDir, slug, sub) {
  const dir = path.join(speciesDir, sub)
  if (!existsSync(dir)) return {}
  const staged = {}
  const target = path.join(outDir, sub)
  for (const f of readdirSync(dir)) {
    const clean = stripVersionSuffix(f)
    if (!/\.png$/i.test(clean) || clean.endsWith('.json')) continue
    const img = await loadImage(path.join(dir, f))
    const key = clean
      .replace(/\.png$/i, '')
      .replace(new RegExp(`^${slug}-?`), '') || 'base'
    if (!DRY_RUN) {
      mkdirSync(target, { recursive: true })
      cpSync(path.join(dir, f), path.join(target, clean))
    }
    staged[key] = { file: `${sub}/${clean}`, w: img.width, h: img.height }
  }
  return staged
}

function frameName(slug, clip, index) {
  return `${slug}-${clip}-${String(index).padStart(ZERO_PAD, '0')}${FRAME_SUFFIX}`
}

async function emitVariant(emission) {
  const speciesDir = path.join(SRC_ROOT, emission.src)
  if (!existsSync(speciesDir)) throw new Error(`missing source dir: ${speciesDir}`)

  const clips = discoverClips(speciesDir)
  const missing = REQUIRED_CLIPS.filter((c) => !clips.has(c))
  // synthesize death from last attack frame when the dump lacks it
  if (missing.includes('death') && clips.has('attack')) {
    const last = clips.get('attack').at(-1)
    clips.set('death', [{ file: last.file, index: 1, syntheticDeath: true }])
  }
  const stillMissing = REQUIRED_CLIPS.filter((c) => !clips.has(c))
  if (stillMissing.length) {
    throw new Error(`${emission.out}: missing required clips ${stillMissing.join(',')}`)
  }

  const pivotJson = clips.get('idle')?.[0]?.file?.replace(/\.png(\.png)?$/i, '.png.json')
  const pivot = pivotJson && existsSync(pivotJson) ? readPivot(pivotJson) : { x: 0.5, y: 1.0 }

  const orderedClips = [
    ...CLIP_ORDER.filter((c) => clips.has(c)),
    ...[...clips.keys()].filter((c) => c.startsWith('cast-')).sort(),
  ]
  const frames = [] // {clip,index,canvas,bounds,size,syntheticDeath}
  let sourceSize = null
  for (const clip of orderedClips) {
    for (const f of clips.get(clip)) {
      const loaded = await loadFrame(f.file, sourceSize, Boolean(f.syntheticDeath), emission.scale)
      if (!sourceSize) sourceSize = loaded.size
      frames.push({ clip, index: f.index, ...loaded, syntheticDeath: Boolean(f.syntheticDeath) })
    }
  }
  // Feet-anchor crop (same model as pack-enemy-art): emitted sourceSize is the
  // idle-clip union bbox, so the runtime (0.5,1) origin lands feet on ground.
  const idleBounds = frames.filter((f) => f.clip === 'idle').map((f) => f.bounds)
  const union = {
    x: Math.min(...idleBounds.map((b) => b.x)),
    y: Math.min(...idleBounds.map((b) => b.y)),
    r: Math.max(...idleBounds.map((b) => b.x + b.w)),
    b: Math.max(...idleBounds.map((b) => b.y + b.h)),
  }
  const canvasSize = sourceSize
  sourceSize = { w: union.r - union.x, h: union.b - union.y }
  const idleTallest = idleBounds.reduce((a, b) => (b.h > a.h ? b : a))
  const extent = {
    x: (idleTallest.x - union.x) / sourceSize.w,
    y: (idleTallest.y - union.y) / sourceSize.h,
    w: idleTallest.w / sourceSize.w,
    h: idleTallest.h / sourceSize.h,
  }

  // Uniform-grid pack; a clip never splits across sheets.
  const cellW = Math.max(...frames.map((f) => f.bounds.w)) + PADDING * 2
  const cellH = Math.max(...frames.map((f) => f.bounds.h)) + PADDING * 2
  const cols = Math.max(1, Math.floor(MAX_SHEET / cellW))
  const rowsPerSheet = Math.max(1, Math.floor(MAX_SHEET / cellH))
  const capacity = cols * rowsPerSheet
  if (cellW > MAX_SHEET || cellH > MAX_SHEET) {
    throw new Error(`${emission.out}: frame ${cellW}x${cellH} exceeds ${MAX_SHEET} sheet`)
  }

  const sheets = []
  const newSheet = () => ({ canvas: createCanvas(cols * cellW, rowsPerSheet * cellH), frames: {}, used: 0, name: `sheet-${sheets.length + 1}` })
  let sheet = newSheet()
  sheets.push(sheet)
  for (const clip of orderedClips) {
    const clipFrames = frames.filter((f) => f.clip === clip)
    if (clipFrames.length > capacity) {
      throw new Error(`${emission.out}: clip ${clip} has ${clipFrames.length} frames > sheet capacity ${capacity}`)
    }
    if (sheet.used + clipFrames.length > capacity) {
      sheet = newSheet()
      sheets.push(sheet)
    }
    for (const f of clipFrames) {
      const idx = sheet.used
      const x = (idx % cols) * cellW + PADDING
      const y = Math.floor(idx / cols) * cellH + PADDING
      sheet.canvas.getContext('2d').drawImage(
        f.canvas, f.bounds.x, f.bounds.y, f.bounds.w, f.bounds.h,
        x, y, f.bounds.w, f.bounds.h,
      )
      sheet.frames[frameName(emission.out, f.clip, f.index)] = {
        frame: { x, y, w: f.bounds.w, h: f.bounds.h },
        rotated: false,
        trimmed: true,
        spriteSourceSize: {
          x: f.bounds.x - union.x,
          y: f.bounds.y - union.y,
          w: f.bounds.w,
          h: f.bounds.h,
        },
        sourceSize: { ...sourceSize },
      }
      f.sheetName = sheet.name
      sheet.used++
    }
  }

  // Validate BEFORE any bytes hit disk (Clean-R2 F-CAI-27): a clip whose
  // source indices skip a number (idle-1, idle-2, idle-4) would register a
  // frame range naming a PNG that was never emitted; and a clip split
  // across sheets would leave partial output on the throw. Both checks must
  // precede the write loop so failures are atomic.
  for (const clip of orderedClips) {
    const list = clips.get(clip)
    const placed = frames.filter((f) => f.clip === clip)
    for (let i = 1; i < list.length; i++) {
      if (list[i].index !== list[i - 1].index + 1) {
        throw new Error(
          `${emission.out}: clip ${clip} has a gap at index ${list[i - 1].index} -> ${list[i].index} ` +
          `(range ${list[0].index}..${list.at(-1).index} vs ${list.length} frames)`,
        )
      }
    }
    if (placed.some((f) => f.sheetName !== placed[0].sheetName)) {
      throw new Error(`${emission.out}: clip ${clip} split across sheets`)
    }
  }

  const outDir = path.join(OUT_ROOT, emission.out)
  const sheetFiles = []
  if (!DRY_RUN) mkdirSync(outDir, { recursive: true })
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i]
    if (!s.canvas) continue
    const png = `${emission.out}-sheet-${i + 1}.png`
    const json = `${emission.out}-sheet-${i + 1}.atlas.json`
    if (!DRY_RUN) {
      const usedRows = Math.max(1, Math.ceil(s.used / cols))
      const finalW = cols * cellW
      const finalH = usedRows * cellH
      const cropped = createCanvas(finalW, finalH)
      cropped.getContext('2d').drawImage(s.canvas, 0, 0, finalW, finalH, 0, 0, finalW, finalH)
      writeFileSync(path.join(outDir, png), cropped.toBuffer('image/png'))
      writeFileSync(path.join(outDir, json), `${JSON.stringify({
        frames: s.frames,
        meta: {
          app: 'pack-character-art.mjs', version: '1.0', image: png,
          format: 'RGBA8888', size: { w: finalW, h: finalH }, scale: '1',
        },
      }, null, 2)}\n`)
    }
    sheetFiles.push({ name: s.name, png, json })
  }

  // Static-fallback avatar: the combat fallback is a BODY still, same role
  // the enemy avatars fill - so the pick order is full-body portrait ->
  // roster-avatar -> `<slug>.png` -> derived idle-1 crop. Dump portraits run
  // ~1254px; the fallback emits at <=512 tall (it draws at person height).
  const portraitDir = path.join(speciesDir, 'portrait')
  const avatarDir = path.join(speciesDir, 'avatar')
  let avatarMode = 'none'
  let avatarSize = null
  let avatarSrc = null
  const fullBody = path.join(portraitDir, `${emission.out}-full-body.png`)
  if (existsSync(fullBody)) {
    avatarSrc = fullBody
    avatarMode = 'full-body'
  } else if (existsSync(avatarDir)) {
    const pngs = readdirSync(avatarDir).map(stripVersionSuffix).filter((f) => /\.png$/i.test(f) && !f.endsWith('.json'))
    const pick = pngs.find((f) => f.includes('roster-avatar')) ?? pngs.find((f) => f === `${emission.out}.png`) ?? pngs[0]
    if (pick) {
      avatarSrc = path.join(avatarDir, pick)
      avatarMode = 'copied'
    }
  }
  if (avatarSrc) {
    const img = await loadImage(avatarSrc)
    const scale = Math.min(1, 512 / img.height)
    avatarSize = { w: Math.round(img.width * scale), h: Math.round(img.height * scale) }
    if (!DRY_RUN) {
      if (scale === 1) {
        cpSync(avatarSrc, path.join(outDir, 'avatar.png'))
      } else {
        const c = createCanvas(avatarSize.w, avatarSize.h)
        const cx = c.getContext('2d')
        cx.imageSmoothingEnabled = true
        cx.drawImage(img, 0, 0, avatarSize.w, avatarSize.h)
        writeFileSync(path.join(outDir, 'avatar.png'), c.toBuffer('image/png'))
      }
    }
  } else {
    const idle1 = frames.find((f) => f.clip === 'idle' && f.index === Math.min(...frames.filter(x => x.clip === 'idle').map(x => x.index)))
    const sq = 512
    const c = createCanvas(sq, sq)
    const cx = c.getContext('2d')
    const side = Math.max(idle1.bounds.w, idle1.bounds.h)
    const sx = idle1.bounds.x + idle1.bounds.w / 2 - side / 2
    const sy = idle1.bounds.y + idle1.bounds.h / 2 - side / 2
    // Clamp against the full-frame canvas (canvasSize), not sourceSize - by
    // this line sourceSize is already the idle-union crop while bounds/sx/sy
    // live in the original frame's coordinate space (Clean-B2 CR2-F4).
    cx.drawImage(idle1.canvas, Math.max(0, sx), Math.max(0, sy), Math.min(side, canvasSize.w - Math.max(0, sx)), Math.min(side, canvasSize.h - Math.max(0, sy)), 0, 0, sq, sq)
    if (!DRY_RUN) writeFileSync(path.join(outDir, 'avatar.png'), c.toBuffer('image/png'))
    avatarMode = 'derived'
    avatarSize = { w: sq, h: sq }
  }

  // Stage the whole UI asset set (avatar roles, portraits, closeup,
  // radar-chart) under the variant dir - copied once here so later UI waves
  // wire them without touching the dump.
  const avatars = await stageSubdir(speciesDir, outDir, emission.out, 'avatar')
  const portraits = await stageSubdir(speciesDir, outDir, emission.out, 'portrait')
  const closeups = await stageSubdir(speciesDir, outDir, emission.out, 'closeup')
  const radars = await stageSubdir(speciesDir, outDir, emission.out, 'radar-chart')

  const clipReport = {}
  const castReport = {}
  for (const clip of orderedClips) {
    const list = clips.get(clip)
    const placed = frames.filter((f) => f.clip === clip)
    const sheetFile = sheetFiles.find((sf) => sf.name === placed[0]?.sheetName)
    const entry = {
      framePrefix: `${emission.out}-${clip}-`,
      firstFrame: list[0].index,
      lastFrame: list.at(-1).index,
      frameCount: placed.length,
      sheet: sheetFile?.png ?? null,
      atlas: sheetFile?.json ?? null,
      synthetic: list.some((f) => f.syntheticDeath) || undefined,
    }
    const marker = IMPACT_MARKERS[emission.out]?.[clip]
    if (marker !== undefined) {
      if (!Number.isInteger(marker) || marker < 0 || marker >= entry.frameCount) {
        throw new Error(`${emission.out}: impact marker '${clip}'=${marker} out of range 0..${entry.frameCount - 1}`)
      }
      entry.impactFrameIndex = marker
    }
    // `cast-<key>` clips report under `cast` keyed by the bare key - the
    // registry reads `cast.linh_bao` / `cast.special` without the prefix.
    if (clip.startsWith('cast-')) castReport[clip.slice(5)] = entry
    else clipReport[clip] = entry
  }

  // Marker hygiene: a marker naming a clip this variant never packed is
  // dead data - fail loudly instead of shipping drift.
  for (const name of Object.keys(IMPACT_MARKERS[emission.out] ?? {})) {
    if (!orderedClips.includes(name)) {
      throw new Error(`${emission.out}: impact marker names unknown clip '${name}'`)
    }
  }

  return {
    out: emission.out,
    src: emission.src,
    pivot,
    extent,
    sourceSize,
    canvasSize,
    sheets: sheets.filter((s) => s.canvas).length,
    clips: clipReport,
    cast: castReport,
    avatar: avatarMode,
    avatarSize,
    avatars,
    portraits,
    closeups,
    radars,
  }
}

async function main() {
  const emissions = ONLY_ARG ? EMISSIONS.filter((e) => ONLY_ARG.includes(e.out)) : EMISSIONS
  if (ONLY_ARG && emissions.length !== ONLY_ARG.length) {
    throw new Error(`--only names no EMISSIONS row: ${ONLY_ARG.filter((o) => !emissions.some((e) => e.out === o)).join(',')}`)
  }
  const manifestPath = path.join(OUT_ROOT, 'manifest.json')
  const manifest = ONLY_ARG && existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : { generated: 'pack-character-art.mjs', zeroPad: ZERO_PAD, frameSuffix: FRAME_SUFFIX, variants: {} }
  for (const e of emissions) {
    const report = await emitVariant(e)
    manifest.variants[e.out] = report
    console.log(
      `${e.out}: clips=${Object.entries(report.clips).map(([c, r]) => `${c}:${r.frameCount}${r.synthetic ? '(syn)' : ''}`).join(' ')} ` +
      `sheets=${report.sheets} avatar=${report.avatar} avatars=${Object.keys(report.avatars).length} portraits=${Object.keys(report.portraits).length}`,
    )
  }
  // Marker hygiene: a marker naming a variant this pack never emitted is
  // dead data - fail loudly instead of shipping drift.
  for (const slug of Object.keys(IMPACT_MARKERS)) {
    if (!(slug in manifest.variants)) {
      throw new Error(`impact marker names unknown character variant '${slug}'`)
    }
  }
  if (!DRY_RUN) {
    mkdirSync(OUT_ROOT, { recursive: true })
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  }
  console.log(DRY_RUN ? 'dry-run complete' : `manifest written to ${manifestPath}`)
}

await main()
