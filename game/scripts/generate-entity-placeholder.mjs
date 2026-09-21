// Emits entity-placeholder.png - the static-mode placeholder for any entity
// with no authored art (uniformity: unregistered entities render THIS, not a
// colored Rectangle). Neutral ink silhouette, 128x128, transparent bg.
import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SIZE = 128
const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../public/assets/characters/placeholder/entity-placeholder.png',
)

const canvas = createCanvas(SIZE, SIZE)
const ctx = canvas.getContext('2d')

// Head
ctx.fillStyle = '#3a3f4a'
ctx.beginPath()
ctx.arc(64, 34, 16, 0, Math.PI * 2)
ctx.fill()

// Shoulders + body (trapezoid robe shape)
ctx.beginPath()
ctx.moveTo(64, 52)
ctx.lineTo(34, 66)
ctx.quadraticCurveTo(28, 96, 30, 118)
ctx.lineTo(98, 118)
ctx.quadraticCurveTo(100, 96, 94, 66)
ctx.closePath()
ctx.fill()

// Inner robe shadow
ctx.fillStyle = '#2c303a'
ctx.beginPath()
ctx.moveTo(64, 60)
ctx.lineTo(48, 70)
ctx.quadraticCurveTo(46, 96, 47, 118)
ctx.lineTo(64, 118)
ctx.closePath()
ctx.fill()

// Question mark, centered on chest
ctx.fillStyle = '#8b93a5'
ctx.font = 'bold 28px sans-serif'
ctx.textAlign = 'center'
ctx.textBaseline = 'middle'
ctx.fillText('?', 64, 88)

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, canvas.toBuffer('image/png'))
console.log(`wrote ${OUT}`)
