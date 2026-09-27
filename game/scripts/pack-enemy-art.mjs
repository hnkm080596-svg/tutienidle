// Pack NEWSPRITE enemy dumps (Unity AssetRipper layout) into the project's
// trimmed TexturePacker-JSON-Hash atlas format consumed by
// CombatAnimationCatalogue / load.atlas().
//
// Usage:
//   node scripts/pack-enemy-art.mjs --src <assets-enemy-dir> [--dry-run]
//
// Source layouts handled:
//   monster-library/<NN>-<slug>/{idle,attack,death,avatar}/<slug>-<clip>-N.png
//   forest-region/<slug>/anim/<slug>-<clip>/*.png  +  avatar/<slug>.png
//   boss/<dir>/<slug>-<clip>/*.png  +  avatar/
// Every PNG has a sibling Unity .json; only `m_Pivot` of the first idle
// frame is read (bottom-center anchor). The dump is never mutated.
//
// Missing pieces are SYNTHESIZED where the contract requires them:
//   - no `death` clip (forest-region): last attack frame, darkened 45%
//   - no `avatar`: alpha-bbox crop of idle-1 into a square PNG
//
// Recolor variants (ferocious / lower-realm bosses) hue-shift the dominant
// band only: high-saturation bright accents (eyes, glow) keep their hue so
// the variant reads "same species, different temper" instead of smeared.
//
// Output per emitted variant under <out>/:
//   <outSlug>/sheet-<i>.png + sheet-<i>.atlas.json
//   <outSlug>/avatar.png
//   ../audio/enemies/<outSlug>/*.ogg   (attack sfx, all speed variants staged)
//   manifest.json  (one combined manifest at <out> root)
import { createCanvas, loadImage } from 'canvas'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const SRC_ARG = args[args.indexOf('--src') + 1] || null
const DRY_RUN = args.includes('--dry-run')

if (!SRC_ARG) {
  throw new Error('Usage: pack-enemy-art.mjs --src <NEWSPRITE enemy dir> [--dry-run]')
}
const SRC_ROOT = path.resolve(SRC_ARG)
const OUT_ROOT = path.resolve('public/assets/enemies/animated')
const AUDIO_ROOT = path.resolve('public/assets/audio/enemies')

// Canvas size varies per dump family (monster-library 960x960, forest-region
// 624x624). Derived per variant from the first loaded frame; a mixed-size
// species is rejected (all clips must share one authored box).
const EXPECTED_SIZE = { w: 960, h: 960 }
const PADDING = 2
const MAX_SHEET = 4096
const ZERO_PAD = 3
const FRAME_SUFFIX = '.png'

// Ferocious recipe: warm shift + darker + slightly more saturated - reads
// "same species, maddened". Accents still guarded.
const FEROCIOUS = { hueShift: -25, valueScale: 0.82, satScale: 1.15 }

// ---------------------------------------------------------------------------
// Emission table - the ONLY place species->variant wiring lives.
// `src` is relative to SRC_ROOT. `recolor` shifts hue (deg, 0-360) and scales
// value; accents are protected by accentGuard.
// ---------------------------------------------------------------------------
const EMISSIONS = [
  // --- 9 approved species ---
  { out: 'graymane-wolf', src: 'monster-library/08-graymane-wolf' },
  { out: 'tusked-mountain-boar', src: 'forest-region/tusked-mountain-boar' },
  { out: 'bloodarm-ox-demon', src: 'monster-library/37-bloodarm-ox-demon' },
  { out: 'mudbelly-green-toad', src: 'monster-library/24-mudbelly-green-toad' },
  { out: 'whiteshell-venom-beetle', src: 'monster-library/09-whiteshell-venom-beetle' },
  { out: 'witherfir-vineman', src: 'monster-library/29-witherfir-vineman' },
  { out: 'drybranch-treant', src: 'forest-region/drybranch-treant' },
  { out: 'spore-flower-spirit', src: 'forest-region/spore-flower-spirit' },
  { out: 'streamgrudge-nymph', src: 'monster-library/33-streamgrudge-nymph' },
  // --- boss: real boss art ---
  { out: 'blood-locust-elder', src: 'boss/region1-boss-blood-locust-elder' },
  // --- reserved (packed, not wired in wave 1) ---
  { out: 'wugu-demon-king', src: 'boss/trial-tower-boss-wugu-demon-king', scale: 0.6 },
  // --- boss recolors: higher-realm art -> lower-realm boss-eligible ---
  {
    out: 'bloodflower-tree-fiend-mudboss',
    src: 'forest-region/bloodflower-tree-fiend',
    recolor: { hueShift: 170, valueScale: 0.8 },
  },
  {
    out: 'streamscale-forkman-floodserpent',
    src: 'monster-library/25-streamscale-forkman',
    recolor: { hueShift: 190, valueScale: 0.85 },
  },
  // --- ferocious recolors of mapped species ---
  { out: 'graymane-wolf-ferocious', src: 'monster-library/08-graymane-wolf', recolor: FEROCIOUS },
  { out: 'tusked-mountain-boar-ferocious', src: 'forest-region/tusked-mountain-boar', recolor: FEROCIOUS },
  { out: 'bloodarm-ox-demon-ferocious', src: 'monster-library/37-bloodarm-ox-demon', recolor: FEROCIOUS },
  { out: 'mudbelly-green-toad-ferocious', src: 'monster-library/24-mudbelly-green-toad', recolor: FEROCIOUS },
  { out: 'whiteshell-venom-beetle-ferocious', src: 'monster-library/09-whiteshell-venom-beetle', recolor: FEROCIOUS },
  { out: 'drybranch-treant-ferocious', src: 'forest-region/drybranch-treant', recolor: FEROCIOUS },
  { out: 'spore-flower-spirit-ferocious', src: 'forest-region/spore-flower-spirit', recolor: FEROCIOUS },
  // NOTE: no 'streamgrudge-nymph-ferocious' - the ferocious flood-dragon
  // whelp is the chapter boss and wears blood-locust-elder art instead.
  // ferocious versions of the two boss recolors (compounded recipes)
  {
    out: 'bloodflower-tree-fiend-mudboss-ferocious',
    src: 'forest-region/bloodflower-tree-fiend',
    recolor: { hueShift: 210, valueScale: 0.68, satScale: 1.1 },
  },
  {
    out: 'streamscale-forkman-floodserpent-ferocious',
    src: 'monster-library/25-streamscale-forkman',
    recolor: { hueShift: 150, valueScale: 0.72, satScale: 1.1 },
  },
]

const CLIP_ORDER = ['idle', 'attack', 'death', 'skill', 'enrage', 'stomp', 'bloodwood-devour', 'bite']
const REQUIRED_CLIPS = ['idle', 'death'] // contract minimum (standby reuses idle frames)
const CLIP_ALIASES = new Map([
  ['idle', 'idle'],
  ['attack', 'attack'],
  ['death', 'death'],
  ['skill', 'skill'],
  ['enrage', 'enrage'],
  ['stomp', 'stomp'],
  ['bloodwood-devour', 'bloodwood-devour'],
  ['devour', 'bloodwood-devour'],
  ['bite', 'bite'],
])

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
  const m = last.match(/(?:^|-)(idle|attack|death|skill|enrage|stomp|devour|bite|bloodwood-devour|avatar)$/i)
  if (!m) return null
  const key = m[1].toLowerCase()
  return CLIP_ALIASES.get(key) ?? (key === 'avatar' ? 'avatar' : null)
}

function frameIndex(file) {
  const m = stripVersionSuffix(path.basename(file)).match(/-(\d+)\.png$/i)
  return m ? Number(m[1]) : null
}

function readPivot(jsonPath) {
  // Unity serializes vectors as { m_X, m_Y }; newer dumps may use { x, y }.
  // Pivot is normalized with y=0 at the BOTTOM of the sprite (Unity
  // convention) - recorded as provenance in the manifest; Phaser JSON-Hash
  // atlases have no pivot field, placement comes from extent + feet anchor.
  try {
    const meta = JSON.parse(readFileSync(jsonPath, 'utf8'))
    const p = meta?.m_Pivot
    if (p) {
      if (typeof p.m_X === 'number' && typeof p.m_Y === 'number') return { x: p.m_X, y: p.m_Y }
      if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y }
    }
  } catch { /* fall through to default */ }
  return { x: 0.5, y: 0.0 }
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s, l]
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v] }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)]
}

function applyRecolor(context, w, h, recolor) {
  const img = context.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    let [hue, sat, lit] = rgbToHsl(d[i], d[i + 1], d[i + 2])
    // accent guard: bright saturated pixels (eyes, glow) keep ~3/4 of hue.
    const accent = sat > 0.5 && lit > 0.55
    const shift = accent ? recolor.hueShift * 0.25 : recolor.hueShift
    hue += shift
    if (!accent && recolor.satScale) sat = Math.min(1, sat * recolor.satScale)
    lit = Math.max(0, Math.min(1, lit * recolor.valueScale))
    const [r, g, b] = hslToRgb(hue, sat, lit)
    d[i] = r; d[i + 1] = g; d[i + 2] = b
  }
  context.putImageData(img, 0, 0)
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

async function loadFrame(file, sourceSize, recolor, syntheticDeath, scale = 1) {
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
  if (recolor) applyRecolor(ctx, w, h, recolor)
  return { canvas, ctx, bounds: opaqueBounds(ctx, w, h), size: { w, h } }
}

function discoverClips(speciesDir) {
  const clips = new Map() // clip -> [{file, index}]
  for (const file of walk(speciesDir)) {
    const base = stripVersionSuffix(path.basename(file))
    if (!/\.png$/i.test(base)) continue
    const clip = clipOfDirName(path.dirname(file))
    if (!clip || clip === 'avatar') continue
    const idx = frameIndex(file)
    if (idx === null) continue
    if (!clips.has(clip)) clips.set(clip, [])
    clips.get(clip).push({ file, index: idx })
  }
  for (const list of clips.values()) list.sort((a, b) => a.index - b.index)
  return clips
}

function discoverAvatar(speciesDir) {
  const dir = path.join(speciesDir, 'avatar')
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      const clean = stripVersionSuffix(f)
      if (/\.png$/i.test(clean) && !clean.endsWith('.json')) return path.join(dir, f)
    }
  }
  // flat sibling: <slug>.png next to anim/ (forest-region keeps it under avatar/)
  return null
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

  const pivotJson = clips.get('idle')?.[0]?.file?.replace(/\.png$/i, '.json')
  const pivot = pivotJson && existsSync(pivotJson) ? readPivot(pivotJson) : { x: 0.5, y: 1.0 }

  // Load frames per clip in CLIP_ORDER.
  const orderedClips = CLIP_ORDER.filter((c) => clips.has(c))
  const frames = [] // {clip,index,canvas,bounds,size,syntheticDeath}
  let sourceSize = null
  for (const clip of orderedClips) {
    for (const f of clips.get(clip)) {
      const loaded = await loadFrame(f.file, sourceSize, emission.recolor, Boolean(f.syntheticDeath), emission.scale)
      if (!sourceSize) sourceSize = loaded.size
      frames.push({ clip, index: f.index, ...loaded, syntheticDeath: Boolean(f.syntheticDeath) })
    }
  }
  // Feet-anchor crop (2026-09-28, measured defect): the dump's 960/624 canvases
  // carry huge authored margins - the wolf's paws end at 76% of canvas height,
  // so a sourceSize of the WHOLE canvas under the runtime's (0.5,1) feet anchor
  // floats every enemy ~0.8 person-heights above ground. The emitted sourceSize
  // is therefore the UNION bbox of the idle clip (the standing pose), and every
  // frame's spriteSourceSize is offset into that box - frames of other clips
  // may legitimately poke outside it (a lunging attack, a falling corpse),
  // which Phaser renders correctly. extent = the tallest IDLE frame's box,
  // normalized to the crop - standing height is what personHeight means.
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

  // Uniform-grid pack into sheets <= MAX_SHEET (same scheme as
  // pack-mortal-combat-art). A clip never splits across sheets: if the clip's
  // frames exceed the cells left in the current sheet, a fresh sheet starts.
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

  // Write sheets + atlases
  const outDir = path.join(OUT_ROOT, emission.out)
  const sheetFiles = [] // {png, json, name}
  if (!DRY_RUN) mkdirSync(outDir, { recursive: true })
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i]
    if (!s.canvas) continue
    const png = `${emission.out}-sheet-${i + 1}.png`
    const json = `${emission.out}-sheet-${i + 1}.atlas.json`
    if (!DRY_RUN) {
      // crop the uniform-grid canvas to the rows actually used - a 4096x4096
      // RGBA buffer with 10 frames wastes ~60MB GPU texture memory.
      const usedRows = Math.max(1, Math.ceil(s.used / cols))
      const finalW = cols * cellW
      const finalH = usedRows * cellH
      const cropped = createCanvas(finalW, finalH)
      cropped.getContext('2d').drawImage(s.canvas, 0, 0, finalW, finalH, 0, 0, finalW, finalH)
      writeFileSync(path.join(outDir, png), cropped.toBuffer('image/png'))
      writeFileSync(path.join(outDir, json), `${JSON.stringify({
        frames: s.frames,
        meta: {
          app: 'pack-enemy-art.mjs', version: '1.0', image: png,
          format: 'RGBA8888', size: { w: finalW, h: finalH }, scale: '1',
        },
      }, null, 2)}\n`)
    }
    sheetFiles.push({ name: s.name, png, json })
  }

  // Avatar
  const avatarSrc = discoverAvatar(speciesDir)
  let avatarMode = 'none'
  let avatarSize = null
  if (avatarSrc) {
    const img = await loadImage(avatarSrc)
    avatarSize = { w: img.width, h: img.height }
    if (!DRY_RUN) cpSync(avatarSrc, path.join(outDir, 'avatar.png'))
    avatarMode = 'copied'
  } else {
    const idle1 = frames.find((f) => f.clip === 'idle' && f.index === Math.min(...frames.filter(x => x.clip === 'idle').map(x => x.index)))
    const sq = 512
    const c = createCanvas(sq, sq)
    const cx = c.getContext('2d')
    const side = Math.max(idle1.bounds.w, idle1.bounds.h)
    const sx = idle1.bounds.x + idle1.bounds.w / 2 - side / 2
    const sy = idle1.bounds.y + idle1.bounds.h / 2 - side / 2
    cx.drawImage(idle1.canvas, Math.max(0, sx), Math.max(0, sy), Math.min(side, sourceSize.w - Math.max(0, sx)), Math.min(side, sourceSize.h - Math.max(0, sy)), 0, 0, sq, sq)
    if (!DRY_RUN) writeFileSync(path.join(outDir, 'avatar.png'), c.toBuffer('image/png'))
    avatarMode = 'derived'
    avatarSize = { w: sq, h: sq }
  }

  // SFX stage (x1 wired later; all variants copied)
  const sfxDir = path.join(SRC_ROOT, '..', 'audio', 'sfx', 'enemy-sfx', '01-blood-fir-forest')
  const bareSlug = emission.src.split('/').pop().replace(/^\d+-/, '').replace(/^(region\d+|trial-tower)-boss-/, '')
  let sfx = []
  if (existsSync(sfxDir)) {
    sfx = readdirSync(sfxDir).filter((f) => f.startsWith(`${bareSlug}-`) && f.endsWith('.ogg'))
    if (sfx.length && !DRY_RUN) {
      const aOut = path.join(AUDIO_ROOT, emission.out)
      mkdirSync(aOut, { recursive: true })
      for (const f of sfx) cpSync(path.join(sfxDir, f), path.join(aOut, f))
    }
  }

  // Clip descriptors - what CombatAnimationCatalogue needs per clip.
  const clipReport = {}
  for (const clip of orderedClips) {
    const list = clips.get(clip)
    const placed = frames.filter((f) => f.clip === clip)
    const sheetFile = sheetFiles.find((sf) => sf.name === placed[0]?.sheetName)
    if (placed.some((f) => f.sheetName !== placed[0].sheetName)) {
      throw new Error(`${emission.out}: clip ${clip} split across sheets`)
    }
    clipReport[clip] = {
      framePrefix: `${emission.out}-${clip}-`,
      firstFrame: list[0].index,
      lastFrame: list.at(-1).index,
      frameCount: placed.length,
      sheet: sheetFile?.png ?? null,
      atlas: sheetFile?.json ?? null,
      synthetic: list.some((f) => f.syntheticDeath) || undefined,
    }
  }

  return {
    out: emission.out,
    src: emission.src,
    recolor: emission.recolor ?? null,
    pivot,
    extent,
    sourceSize,
    canvasSize,
    sheets: sheets.filter((s) => s.canvas).length,
    clips: clipReport,
    avatar: avatarMode,
    avatarSize,
    sfx,
  }
}

async function main() {
  const manifest = { generated: 'pack-enemy-art.mjs', zeroPad: ZERO_PAD, frameSuffix: FRAME_SUFFIX, variants: {} }
  for (const e of EMISSIONS) {
    const report = await emitVariant(e)
    manifest.variants[e.out] = report
    console.log(
      `${e.out}: clips=${Object.entries(report.clips).map(([c, r]) => `${c}:${r.frameCount}${r.synthetic ? '(syn)' : ''}`).join(' ')} ` +
      `sheets=${report.sheets} avatar=${report.avatar} sfx=${report.sfx.length} pivot=(${report.pivot.x.toFixed(2)},${report.pivot.y.toFixed(2)})`,
    )
  }
  if (!DRY_RUN) {
    mkdirSync(OUT_ROOT, { recursive: true })
    writeFileSync(path.join(OUT_ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  }
  console.log(DRY_RUN ? 'dry-run complete' : `manifest written to ${path.join(OUT_ROOT, 'manifest.json')}`)
}

await main()
