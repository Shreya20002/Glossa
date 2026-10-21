import { appendFile } from 'node:fs/promises'
import type { ElectronApplication, Page } from '@playwright/test'
import { recentProcessOutput } from './launch'
import { LEAD_IN_MS } from './speechClip'

/**
 * Prints what each window shows and measures the fake microphone directly,
 * so a failing CI log says *why* no speech was detected:
 *  - "getUserMedia timed out": opening the microphone hangs
 *  - "audio clock advanced 0.00 s": the audio system never started
 *  - "peak 0.00": the microphone delivers silence (e.g. the clip couldn't be read)
 *  - a healthy peak: audio is fine, so look at the engine instead
 *
 * CI posts the same report as an annotation on the run, which (unlike the raw
 * log) anyone can read without signing in.
 */
export async function printDiagnostics(
  app: ElectronApplication,
  context: string[] = [],
): Promise<void> {
  const lines: string[] = [...context]
  for (const page of app.windows()) {
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => '(window closed)')
    lines.push(`[window ${page.url()}]`, text.replace(/\n+/g, ' | '))
  }
  const main = app.windows().find((page) => page.url().includes('/app/'))
  if (main) lines.push(`[microphone probe] ${await probeMicrophone(main)}`)
  const output = recentProcessOutput(app)
  lines.push(`[app process output, last ${output.length} lines]`, ...output.map((l) => `  ${l}`))

  console.log(['──── Diagnostics ────', ...lines, '─────────────────────'].join('\n'))
  // Also saved to a file, which CI posts as an annotation on the run (see ci.yml).
  await appendFile(DIAGNOSTICS_FILE, [...lines, ''].join('\n'))
}

/** Where diagnostics are saved for CI to publish. */
const DIAGNOSTICS_FILE = 'test-results/e2e-diagnostics.txt'

/**
 * How long the probe listens. Opening the microphone can start the clip from
 * the beginning, so listen past its silent lead-in, then to 2 s of speech.
 */
const PROBE_LISTEN_MS = LEAD_IN_MS + 2_000

/** Opens the (fake) microphone and reports what it hears. */
function probeMicrophone(page: Page): Promise<string> {
  return page.evaluate(async (listenMs) => {
    const timeout = (ms: number, label: string) =>
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(label)), ms))
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter((d) => d.kind === 'audioinput').map((d) => d.label || '?')
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true }),
        timeout(5_000, 'getUserMedia timed out after 5 s'),
      ])
      const context = new AudioContext({ sampleRate: 16_000 })
      const analyser = context.createAnalyser()
      context.createMediaStreamSource(stream).connect(analyser)
      await Promise.race([context.resume(), timeout(3_000, 'AudioContext.resume() timed out')])
      const startedAt = context.currentTime
      const samples = new Float32Array(analyser.fftSize)
      let peak = 0
      for (let listenedMs = 0; listenedMs < listenMs; listenedMs += 100) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        analyser.getFloatTimeDomainData(samples)
        for (const value of samples) peak = Math.max(peak, Math.abs(value))
      }
      const result =
        `inputs [${inputs.join(', ')}], track "${stream.getAudioTracks()[0]?.label ?? '-'}", ` +
        `context ${context.state} at ${context.sampleRate} Hz, ` +
        `audio clock advanced ${(context.currentTime - startedAt).toFixed(2)} s ` +
        `in ${(listenMs / 1000).toFixed(1)} s, peak ${peak.toFixed(2)}`
      for (const track of stream.getTracks()) track.stop()
      await context.close()
      return result
    } catch (error) {
      return `failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }, PROBE_LISTEN_MS)
}
