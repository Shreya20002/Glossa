import { appendFile } from 'node:fs/promises'
import type { ElectronApplication, Page } from '@playwright/test'
import { recentProcessOutput } from './launch'

/**
 * Prints what each window shows and measures the fake microphone directly,
 * so a failing CI log says *why* no speech was detected:
 *  - "getUserMedia timed out": opening the microphone hangs
 *  - "audio clock advanced 0.00 s": the audio system never started
 *  - "peak 0.00": the microphone delivers silence (e.g. the clip couldn't be read)
 *  - a healthy peak: audio is fine, so look at the engine instead
 *
 * In GitHub Actions the same report is added to the run's summary page, which
 * (unlike the raw log) can be read without signing in.
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
  const summaryFile = process.env['GITHUB_STEP_SUMMARY']
  if (summaryFile) {
    const report = lines.join('\n').replaceAll('```', "'''")
    await appendFile(
      summaryFile,
      `### E2E diagnostics (${process.platform})\n\n\`\`\`\n${report}\n\`\`\`\n`,
    )
  }
}

/** Opens the (fake) microphone for two seconds and reports what it hears. */
function probeMicrophone(page: Page): Promise<string> {
  return page.evaluate(async () => {
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
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        analyser.getFloatTimeDomainData(samples)
        for (const value of samples) peak = Math.max(peak, Math.abs(value))
      }
      const result =
        `inputs [${inputs.join(', ')}], track "${stream.getAudioTracks()[0]?.label ?? '-'}", ` +
        `context ${context.state} at ${context.sampleRate} Hz, ` +
        `audio clock advanced ${(context.currentTime - startedAt).toFixed(2)} s in 2 s, ` +
        `peak ${peak.toFixed(2)}`
      for (const track of stream.getTracks()) track.stop()
      await context.close()
      return result
    } catch (error) {
      return `failed: ${error instanceof Error ? error.message : String(error)}`
    }
  })
}
