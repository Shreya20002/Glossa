// Downloads the AI models Glossa needs into models/ and verifies each one.
//
// Run it with `pnpm fetch-models`. It's safe to run again: files that are
// already present and correct are skipped.
//
// Every model is pinned to an exact source URL (a git commit, never a branch)
// and a SHA-256 checksum, a fingerprint of the file's exact bytes. If a file
// is changed in any way, even by one byte, the checksum won't match and the
// script refuses it. This is the only network code in Glossa, and it runs only
// on developer machines and in CI, never inside the app.

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODELS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'models')

/**
 * The models Glossa ships. To update one, change BOTH its url and sha256,
 * and update the credit in NOTICE if the license changes.
 * File names must match src/shared/models.ts.
 */
const MODELS = [
  {
    file: 'silero_vad.onnx',
    description: 'Silero VAD v6.2.3: detects when someone is speaking (MIT license)',
    url: 'https://raw.githubusercontent.com/snakers4/silero-vad/5cd7945676eb32225748052e2e6a0580e4686a08/src/silero_vad/data/silero_vad.onnx',
    sha256: '1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3',
  },
]

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function readIfExists(path) {
  try {
    return await readFile(path)
  } catch {
    return undefined
  }
}

async function fetchModel(model) {
  const target = join(MODELS_DIR, model.file)
  const existing = await readIfExists(target)
  if (existing && sha256(existing) === model.sha256) {
    console.log(`✓ ${model.file} is already up to date`)
    return
  }

  console.log(`↓ Downloading ${model.file}: ${model.description}`)
  const response = await fetch(model.url)
  if (!response.ok) {
    throw new Error(`Download failed for ${model.file}: HTTP ${response.status}`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  const actual = sha256(bytes)
  if (actual !== model.sha256) {
    throw new Error(
      `Checksum mismatch for ${model.file}. The file is not the one Glossa expects.\n` +
        `  expected ${model.sha256}\n  received ${actual}`,
    )
  }

  // Write to a temporary name first, so an interrupted download never leaves
  // a half-written model behind.
  const partial = `${target}.part`
  await writeFile(partial, bytes)
  await rename(partial, target)
  console.log(`✓ ${model.file} saved (${(bytes.length / 1e6).toFixed(1)} MB, checksum verified)`)
}

await mkdir(MODELS_DIR, { recursive: true })
try {
  for (const model of MODELS) await fetchModel(model)
} catch (error) {
  await Promise.all(MODELS.map((m) => rm(join(MODELS_DIR, `${m.file}.part`), { force: true })))
  console.error(`✗ ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
