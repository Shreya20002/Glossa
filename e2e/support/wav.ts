import { readFile } from 'node:fs/promises'

/**
 * Describes a WAV file in one line, e.g.
 * "format 1 (PCM), 1 ch, 16000 Hz, 16-bit, 23.0 s, peak 0.82, chunks: fmt ,data".
 * Printed by the e2e test so a failure log shows whether the speech clip is valid.
 */
export async function describeWav(path: string): Promise<string> {
  const bytes = await readFile(path)
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    return `not a WAV file (${bytes.length} bytes)`
  }
  const chunks: string[] = []
  let format: { code: number; channels: number; rateHz: number; bits: number } | undefined
  let data: Buffer | undefined
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4)
    const size = bytes.readUInt32LE(offset + 4)
    const body = bytes.subarray(offset + 8, offset + 8 + size)
    chunks.push(id)
    if (id === 'fmt ') {
      format = {
        code: body.readUInt16LE(0),
        channels: body.readUInt16LE(2),
        rateHz: body.readUInt32LE(4),
        bits: body.readUInt16LE(14),
      }
    }
    if (id === 'data') data = body
    offset += 8 + size + (size % 2)
  }
  if (!format || !data) return `missing fmt/data chunk (chunks: ${chunks.join(',')})`

  let peak = 0
  if (format.bits === 16) {
    for (let i = 0; i + 1 < data.length; i += 2)
      peak = Math.max(peak, Math.abs(data.readInt16LE(i)))
    peak /= 32768
  }
  const seconds = data.length / (format.rateHz * format.channels * (format.bits / 8))
  const name = format.code === 1 ? 'PCM' : format.code === 0xfffe ? 'extensible' : 'other'
  return (
    `format ${format.code} (${name}), ${format.channels} ch, ${format.rateHz} Hz, ` +
    `${format.bits}-bit, ${seconds.toFixed(1)} s, peak ${peak.toFixed(2)}, chunks: ${chunks.join(',')}`
  )
}
