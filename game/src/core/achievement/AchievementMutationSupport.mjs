// Test-only Node boundary. No global Node declarations enter the browser TypeScript project.
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const candidateRoot = resolve(sourceRoot, 'core/achievement/qa/node_modules/mutants')

function contained(root, relative) {
  const absolute = resolve(root, relative)
  if (!absolute.startsWith(root + sep)) {
    throw new Error('Mutation artifact path escapes its root')
  }
  return absolute
}

export function readSource(file) {
  return readFileSync(contained(sourceRoot, `${file}.ts`), 'utf8')
}

export function createCandidate(id, provenance) {
  const candidateId = `${id}-${randomUUID()}`
  const directory = contained(candidateRoot, candidateId)
  mkdirSync(directory, { recursive: true })
  writeFileSync(resolve(directory, 'inputs.json'), provenance, { flag: 'wx' })
  writeFileSync(resolve(candidateRoot, `${id}-latest.txt`), candidateId)
  return candidateId
}

export function writeCandidate(id, file, compiled) {
  const target = contained(candidateRoot, `${id}/${file}.mjs`)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, compiled, { flag: 'wx' })
}

export function runCandidate(id, scenario) {
  const target = contained(candidateRoot, `${id}/core/achievement/AchievementSystem.mjs`)
  const script = `import { AchievementSystem } from ${JSON.stringify(pathToFileURL(target).href)};\n${scenario}`
  try {
    execFileSync(process.execPath, ['--input-type=module', '--eval', script], { encoding: 'utf8', stdio: 'pipe' })
    return ''
  } catch (error) {
    return typeof error?.stderr === 'string' ? error.stderr : String(error)
  }
}

export function runLatestCandidate(id, scenario) {
  const pointer = contained(candidateRoot, `${id}-latest.txt`)
  return runCandidate(readFileSync(pointer, 'utf8'), scenario)
}
