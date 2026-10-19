import { join } from 'node:path'
import { test } from 'vitest'
import {
  applyTranscription,
  closeSession,
  createSession,
  processFrame,
  summarizeSession,
} from '../src/core/session'
import type { SessionSummary } from '../src/core/session'
import type { SpeechChunk } from '../src/core/speechChunks'
import type { FillerCounts, FillerWord } from '../src/core/fillers'
import { analyzeTranscript } from '../src/core/transcript'
import { ModelFile } from '../src/shared/models'
import { SileroVad, VAD_FRAME_SAMPLES, VAD_SAMPLE_RATE_HZ } from '../src/engine/sileroVad'
import { FILLER_PROMPT, SpeechRecognizer } from '../src/engine/speechRecognizer'
import { transcriptionRange } from '../src/engine/transcription'
import { loadClipAudio, normalizeLoudness, readClips } from './support/clips'
import type { Clip } from './support/clips'
import {
  LEXICAL_FILLERS,
  normalizeWords,
  precisionRecall,
  total,
  VOCAL_FILLERS,
  wordErrorRate,
} from './support/score'

// The filler benchmark: runs Glossa's real pipeline (voice detection, phrase
// grouping, Whisper, word and filler counting) over clips of real meetings,
// and compares what it heard with the corpus's hand-made transcripts.
// Run with `pnpm eval`. See eval/README.md.

// Experiment switches (defaults = exactly what the app uses):
//   EVAL_MODELS_DIR / EVAL_MODEL  try another Whisper model folder
//   EVAL_PROMPT                   try another prompt (EVAL_PROMPT= for none)
//   EVAL_TRANSCRIPTS=1            print what was heard next to the reference
const MODELS_DIR = process.env['EVAL_MODELS_DIR'] ?? join(import.meta.dirname, '..', 'models')
const MODEL = process.env['EVAL_MODEL'] ?? ModelFile.speechRecognition
const PROMPT = process.env['EVAL_PROMPT'] ?? FILLER_PROMPT
const FRAME_MS = (VAD_FRAME_SAMPLES / VAD_SAMPLE_RATE_HZ) * 1000

/** Runs one clip through the same steps as the app's engine. */
async function listen(
  samples: Float32Array,
  vad: SileroVad,
  recognizer: SpeechRecognizer,
): Promise<{ transcript: string; summary: SessionSummary }> {
  vad.reset()
  let session = createSession()
  const chunks: SpeechChunk[] = []
  for (let offset = 0; offset + VAD_FRAME_SAMPLES <= samples.length; offset += VAD_FRAME_SAMPLES) {
    const probability = await vad.speechProbability(
      samples.subarray(offset, offset + VAD_FRAME_SAMPLES),
    )
    const step = processFrame(session, probability, FRAME_MS)
    session = step.state
    if (step.chunk) chunks.push(step.chunk)
  }
  const closed = closeSession(session)
  session = closed.state
  if (closed.chunk) chunks.push(closed.chunk)

  const texts: string[] = []
  for (const chunk of chunks) {
    const { fromMs, toMs } = transcriptionRange(chunk)
    const toSample = (ms: number) =>
      Math.min(samples.length, Math.max(0, Math.round((ms * VAD_SAMPLE_RATE_HZ) / 1000)))
    const text = await recognizer.transcribe(samples.slice(toSample(fromMs), toSample(toMs)))
    texts.push(text)
    session = applyTranscription(session, chunk, analyzeTranscript(text))
  }
  return { transcript: texts.join(' '), summary: summarizeSession(session) }
}

const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`)

interface ClipResult {
  clip: Clip
  transcript: string
  wer: number
  referenceWords: number
  referenceNormalizedWords: number
  heardWords: number
  wordsPerMinute: number | null
  expected: FillerCounts
  heard: FillerCounts
}

/** Clips, summary lines and per-filler counts for one set of results. */
function report(title: string, results: ClipResult[]): string[] {
  const pairs = (kinds: readonly FillerWord[]) =>
    results.map((r) => ({ reference: total(r.expected, kinds), detected: total(r.heard, kinds) }))
  const vocal = precisionRecall(pairs(VOCAL_FILLERS))
  const lexical = precisionRecall(pairs(LEXICAL_FILLERS))
  const said = results.reduce((sum, r) => sum + r.referenceWords, 0)
  const heard = results.reduce((sum, r) => sum + r.heardWords, 0)
  const normalized = results.reduce((sum, r) => sum + r.referenceNormalizedWords, 0)
  const wer = results.reduce((sum, r) => sum + r.wer * r.referenceNormalizedWords, 0) / normalized
  const perFiller = [...VOCAL_FILLERS, ...LEXICAL_FILLERS]
    .map((filler) => ({
      filler,
      reference: results.reduce((sum, r) => sum + (r.expected[filler] ?? 0), 0),
      detected: results.reduce((sum, r) => sum + (r.heard[filler] ?? 0), 0),
    }))
    .filter((e) => e.reference + e.detected > 0)
    .map((e) => `${e.filler} ${e.reference} → ${e.detected}`)

  return [
    '',
    `## ${title} (${results.length} clips)`,
    '',
    '| Clip | Length | Words (said) | Words (heard) | Word errors | um/uh… (said → heard) | lexical (said → heard) | Pace |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...results.map(
      (r) =>
        `| ${r.clip.id} | ${Math.round(r.clip.endS - r.clip.startS)} s | ${r.referenceWords} | ${r.heardWords} | ${percent(r.wer)} | ${total(r.expected, VOCAL_FILLERS)} → ${total(r.heard, VOCAL_FILLERS)} | ${total(r.expected, LEXICAL_FILLERS)} → ${total(r.heard, LEXICAL_FILLERS)} | ${r.wordsPerMinute ?? '—'} |`,
    ),
    '',
    `Vocal fillers (um, uh…): recall ${percent(vocal.recall)}, precision ${percent(vocal.precision)} (${vocal.matched} matched of ${vocal.reference} said, ${vocal.detected} detected)`,
    `Lexical fillers (like, you know…): recall ${percent(lexical.recall)}, precision ${percent(lexical.precision)} (${lexical.matched} matched of ${lexical.reference} said, ${lexical.detected} detected)`,
    `Word count: ${heard} heard vs ${said} said (${percent((heard - said) / said)}); word error rate ${percent(wer)}`,
    `Per filler (said → detected): ${perFiller.join(', ')}`,
  ]
}

test('filler benchmark', { timeout: 30 * 60_000 }, async () => {
  const clips = await readClips()
  const vad = await SileroVad.load(
    join(import.meta.dirname, '..', 'models', ModelFile.voiceActivity),
  )
  const recognizer = await SpeechRecognizer.load(MODELS_DIR, MODEL, {
    prompt: PROMPT || undefined,
  })

  const results: ClipResult[] = []
  for (const clip of clips) {
    const samples = normalizeLoudness(await loadClipAudio(clip))
    const { transcript, summary } = await listen(samples, vad, recognizer)
    const reference = normalizeWords(clip.reference)
    results.push({
      clip,
      transcript,
      wer: wordErrorRate(reference, normalizeWords(transcript)),
      referenceWords: analyzeTranscript(clip.reference).words,
      referenceNormalizedWords: reference.length,
      heardWords: summary.words,
      wordsPerMinute: summary.wordsPerMinute,
      expected: analyzeTranscript(clip.reference).fillers,
      heard: analyzeTranscript(transcript).fillers,
    })
  }

  const lines = [
    '',
    `# Filler benchmark: real meetings from the AMI Meeting Corpus (CC BY 4.0)`,
    `Model: ${MODEL}${PROMPT ? `, prompt "${PROMPT}"` : ', no prompt'}`,
    ...report(
      'Held-out set: the honest score',
      results.filter((r) => r.clip.set === 'holdout'),
    ),
    ...report(
      'Tuning set: used to choose rules and prompt',
      results.filter((r) => r.clip.set === 'tuning'),
    ),
    '',
    ...(process.env['EVAL_TRANSCRIPTS']
      ? results.map(
          (r) => `${r.clip.id}\n  reference: ${r.clip.reference}\n  heard:     ${r.transcript}`,
        )
      : []),
  ]
  console.log(lines.join('\n'))
})
