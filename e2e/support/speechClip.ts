import { execFile } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Spoken sentences, each followed by this much silence. */
export const PAUSE_MS = 4_000
const SENTENCES = [
  'Thanks for joining today. I want to walk you through the plan for the next quarter, and then leave plenty of time for questions.',
  'First, we will focus on the onboarding flow, because that is where most new users get stuck.',
]

/**
 * Creates a 16 kHz mono WAV file of speech with pauses, using the operating
 * system's built-in text-to-speech. It's generated fresh for each test run
 * and never committed, so no recording or license is involved.
 */
export async function createSpeechClip(path: string): Promise<void> {
  if (process.platform === 'win32') {
    const breakTag = `<break time="${PAUSE_MS}ms"/>`
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">${SENTENCES.map((s) => s + breakTag).join('')}</speak>`
    const ssmlPath = `${path}.ssml`
    await writeFile(ssmlPath, ssml)
    const script = [
      'Add-Type -AssemblyName System.Speech',
      '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      '$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)',
      `$synth.SetOutputToWaveFile('${path}', $format)`,
      `$synth.SpeakSsml([IO.File]::ReadAllText('${ssmlPath}'))`,
      '$synth.Dispose()',
    ].join('; ')
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script])
    return
  }
  if (process.platform === 'darwin') {
    const text = SENTENCES.map((s) => `${s} [[slnc ${PAUSE_MS}]]`).join(' ')
    await run('say', ['-o', path, '--file-format=WAVE', '--data-format=LEI16@16000', text])
    return
  }
  throw new Error('End-to-end tests need the text-to-speech built into Windows or macOS.')
}
