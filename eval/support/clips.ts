import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** One benchmark clip: a stretch of a meeting's headset recording, and what was said. */
export interface Clip {
  id: string
  /**
   * "tuning" clips were used to choose the filler rules and the Whisper prompt.
   * "holdout" clips were never used for choices, so their score is the honest one.
   */
  set: 'tuning' | 'holdout'
  meeting: string
  speaker: string
  url: string
  startS: number
  endS: number
  /** Byte range of the clip inside the WAV file at `url` (end exclusive). */
  byteStart: number
  byteEnd: number
  /** SHA-256 of exactly those bytes, so a changed file is detected. */
  sha256: string
  /** The corpus's hand-made transcript of these seconds, every "um" included. */
  reference: string
}

const DATA_DIR = join(import.meta.dirname, '..', '.data')

export async function readClips(): Promise<Clip[]> {
  const file = JSON.parse(
    await readFile(join(import.meta.dirname, '..', 'clips.json'), 'utf8'),
  ) as {
    clips: Clip[]
  }
  return file.clips
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

/**
 * The clip's audio as 16 kHz mono samples. Downloads only the clip's bytes (an
 * HTTP range request) the first time, checks their fingerprint, and keeps them
 * in eval/.data for next time.
 */
export async function loadClipAudio(clip: Clip): Promise<Float32Array> {
  const cached = join(DATA_DIR, `${clip.id}.pcm`)
  let bytes: Buffer | undefined
  try {
    bytes = await readFile(cached)
  } catch {
    // Not downloaded yet.
  }
  if (!bytes || sha256(bytes) !== clip.sha256) {
    const response = await fetch(clip.url, {
      headers: { Range: `bytes=${clip.byteStart}-${clip.byteEnd - 1}` },
    })
    if (response.status !== 206) {
      throw new Error(`${clip.id}: expected a partial download (206), got ${response.status}`)
    }
    bytes = Buffer.from(await response.arrayBuffer())
    if (sha256(bytes) !== clip.sha256) {
      throw new Error(`${clip.id}: checksum mismatch. The source recording has changed.`)
    }
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(cached, bytes)
  }
  const samples = new Float32Array(bytes.length / 2)
  for (let i = 0; i < samples.length; i++) samples[i] = bytes.readInt16LE(i * 2) / 32768
  return samples
}

/** Loudness the app's microphone delivers after the browser's automatic gain control (≈ −22 dBFS). */
const TARGET_RMS = 0.08

/**
 * Some meeting headsets were recorded very quietly. In the app, the browser's
 * automatic gain control evens out microphone levels before Glossa sees them,
 * so the benchmark does the same: one gain for the whole clip, never clipping.
 */
export function normalizeLoudness(samples: Float32Array): Float32Array {
  let sumSquares = 0
  let peak = 0
  for (const sample of samples) {
    sumSquares += sample * sample
    peak = Math.max(peak, Math.abs(sample))
  }
  const rms = Math.sqrt(sumSquares / samples.length)
  if (rms === 0) return samples
  const gain = Math.min(TARGET_RMS / rms, 0.95 / peak)
  return samples.map((sample) => sample * gain)
}
