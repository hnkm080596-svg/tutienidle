// validate-art.cjs — QA cho thanh-van-dong-fu-art-production-plan.md:
// giải mã PNG (zlib + unfilter) kiểm tra DIMENSIONS / RGBA / transparency
// thật thay vì chỉ đọc header. Chạy: node scripts/validate-art.cjs
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ROOT = path.resolve(__dirname, '..')

function decodePng(file) {
  const buf = fs.readFileSync(file)

  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png')

  let pos = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat = []

  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)

    if (type === 'IHDR') {
      width = buf.readUInt32BE(pos + 8)
      height = buf.readUInt32BE(pos + 12)
      bitDepth = buf[pos + 16]
      colorType = buf[pos + 17]
    } else if (type === 'IDAT') {
      idat.push(buf.slice(pos + 8, pos + 8 + length))
    } else if (type === 'IEND') {
      break
    }

    pos += 12 + length
  }

  if (bitDepth !== 8 || colorType !== 6) {
    return { width, height, bitDepth, colorType }
  }

  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * 4
  const pixels = Buffer.alloc(height * stride)

  let paeth = (a, b, c) => {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const rowStart = y * (stride + 1) + 1

    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rowStart + x]
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0
      const upLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0

      let value

      switch (filter) {
        case 1: value = rawByte + left; break
        case 2: value = rawByte + up; break
        case 3: value = rawByte + ((left + up) >> 1); break
        case 4: value = rawByte + paeth(left, up, upLeft); break
        default: value = rawByte
      }

      pixels[y * stride + x] = value & 0xff
    }
  }

  // Alpha statistics: đếm pixel trong suốt một phần + kiểm tra 4 góc padding.
  let transparent = 0
  let partial = 0

  for (let i = 3; i < pixels.length; i += 4) {
    const a = pixels[i]

    if (a === 0) transparent++
    else if (a < 255) partial++
  }

  const total = width * height
  const cornerAt = (x, y) => pixels[(y * width + x) * 4 + 3]
  const cornersTransparent =
    cornerAt(2, 2) === 0 &&
    cornerAt(width - 3, 2) === 0 &&
    cornerAt(2, height - 3) === 0 &&
    cornerAt(width - 3, height - 3) === 0

  return {
    width,
    height,
    bitDepth,
    colorType,

    transparentPct: Math.round((transparent / total) * 100),
    partialPct: Math.round((partial / total) * 100),
    cornersTransparent,
  }
}

const rel = (p) => path.join(ROOT, 'public/assets', p)

// Spec rút từ README + plan §10/§11.
const checks = []
const addDir = (dir, filterFn, expect) => {
  const abs = rel(dir)

  if (!fs.existsSync(abs)) {
    checks.push({ file: `${dir}/ (thư mục)`, ok: false, note: 'THIẾU thư mục' })

    return
  }

  for (const name of fs.readdirSync(abs)) {
    if (!name.endsWith('.png') || !filterFn(name)) continue

    checks.push({ file: `${dir}/${name}`, expect })
  }
}

// 1) Season layers — 1672×941 RGBA, PHẢI trong suốt thật.
for (const season of ['spring', 'summer', 'autumn', 'winter']) {
  for (let layer = 1; layer <= 6; layer++) {
    const name = `0${layer}-${['far-mountains', 'midground', 'battle-ground', 'foreground-left', 'foreground-right', 'atmosphere'][layer - 1]}.png`

    checks.push({
      file: `backgrounds/thanh-van/modular/seasons/${season}/${name}`,

      expect: { w: 1672, h: 941, rgba: true, minTransparentPct: 5 },
    })
  }
}

// 2) Time skies — 1672×941, opaque hợp lệ.
for (const time of ['morning', 'noon', 'evening', 'night']) {
  checks.push({
    file: `backgrounds/thanh-van/modular/times/${time}/00-sky.png`,

    expect: { w: 1672, h: 941, rgba: false },
  })
}

// 3) Động Phủ base — environment-only 1672×941.
checks.push({
  file: 'backgrounds/dong-fu/thanh-van-dong-fu-base.png',

  expect: { w: 1672, h: 941 },
})

// 4) Buildings — 1254×1254 RGBA trong suốt thật (+ góc padding trong suốt).
for (const building of [
  'scripture_pavilion',
  'spirit_spring',
  'equipment_hall',
  'pill_room',
  'teleport_array',
  'gathering_outpost',
]) {
  checks.push({
    file: `buildings/dong-fu/${building}.png`,

    expect: { w: 1254, h: 1254, rgba: true, minTransparentPct: 10, cornersTransparent: true },
  })
}

let pass = 0
let fail = 0

for (const check of checks) {
  const file = rel(check.file)

  if (!fs.existsSync(file)) {
    fail++

    console.log(`FAIL (missing)  ${check.file}`)

    continue
  }

  try {
    const img = decodePng(file)
    const problems = []

    if (check.expect && check.expect.w) {
      if (img.width !== check.expect.w || img.height !== check.expect.h) {
        problems.push(`size ${img.width}x${img.height} ≠ ${check.expect.w}x${check.expect.h}`)
      }
    }

    if (check.expect?.rgba && img.colorType !== 6) {
      problems.push(`colorType ${img.colorType} ≠ 6 (RGBA)`)
    }

    if (check.expect?.minTransparentPct !== undefined) {
      const pct = img.transparentPct ?? 0

      if (pct < check.expect.minTransparentPct) {
        problems.push(`transparent ${pct}% < ${check.expect.minTransparentPct}%`)
      }
    }

    if (check.expect?.cornersTransparent && !img.cornersTransparent) {
      problems.push('góc ảnh không trong suốt (padding không ổn định)')
    }

    if (problems.length > 0) {
      fail++

      console.log(`FAIL            ${check.file}  → ${problems.join('; ')}`)
    } else {
      pass++

      console.log(
        `OK              ${check.file}  (${img.width}x${img.height}, ct${img.colorType}, alpha0=${img.transparentPct ?? '-'}%)`,
      )
    }
  } catch (error) {
    fail++

    console.log(`FAIL (decode)   ${check.file}  → ${error.message}`)
  }
}

console.log(`\n${pass} pass / ${fail} fail / ${checks.length} total`)

process.exit(fail > 0 ? 1 : 0)
