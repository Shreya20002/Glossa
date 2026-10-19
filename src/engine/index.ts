/// <reference types="electron" />
import { join } from 'node:path'
import {
  applyTranscription,
  closeSession,
  createSession,
  liveMetrics,
  processFrame,
  summarizeSession,
} from '../core/session'
import type { SessionState } from '../core/session'
import type { SpeechChunk } from '../core/speechChunks'
import { MAX_CHUNK_MS } from '../core/speechChunks'
import { countWords } from '../core/words'
import type { EngineEvent, EngineRequest } from '../shared/engine'
import { ModelFile } from '../shared/models'
import { AudioHistory } from './audioHistory'
import { FrameBuffer } from './frameBuffer'
import { SileroVad, VAD_FRAME_SAMPLES, VAD_SAMPLE_RATE_HZ } from './sileroVad'
import { SpeechRecognizer } from './speechRecognizer'

// Entry point of the engine: a hidden background process (started by
// src/main/engine.ts) that turns raw microphone audio into live metrics.
// It never writes to disk, and keeps audio only briefly in memory: the last
// few seconds, so a finished phrase can be transcribed. Transcripts are
// reduced to word counts straight away.

const FRAME_DURATION_MS = (VAD_FRAME_SAMPLES / VAD_SAMPLE_RATE_HZ) * 1000

/** How often (in audio time) fresh numbers are sent to the overlay: 4 times a second. */
const METRICS_INTERVAL_MS = 250

/** Extra audio around each chunk, so Whisper hears the first and last word whole. */
const TRANSCRIBE_PADDING_MS = 200

/** Audio kept in memory: enough for the longest chunk plus padding. */
const HISTORY_MS = MAX_CHUNK_MS + 5_000

let vad: SileroVad | undefined
let recognizer: SpeechRecognizer | undefined
let session: SessionState | undefined
/** Increases with every session, so late transcriptions can't leak into the next one. */
let sessionNumber = 0
let lastMetricsAtMs = 0
const frames = new FrameBuffer(VAD_FRAME_SAMPLES)
const history = new AudioHistory((HISTORY_MS / 1000) * VAD_SAMPLE_RATE_HZ, VAD_SAMPLE_RATE_HZ)

/** Transcriptions run one at a time, in order, without holding up speech detection. */
let transcriptions = Promise.resolve()

function send(event: EngineEvent): void {
  process.parentPort.postMessage(event)
}

function sendMetrics(): void {
  if (!session) return
  lastMetricsAtMs = session.elapsedMs
  send({ type: 'metrics', metrics: liveMetrics(session) })
}

async function startSession(modelsDir: string): Promise<void> {
  vad ??= await SileroVad.load(join(modelsDir, ModelFile.voiceActivity))
  recognizer ??= await SpeechRecognizer.load(modelsDir, ModelFile.speechRecognition)
  vad.reset()
  frames.reset()
  history.reset()
  session = createSession()
  sessionNumber++
  lastMetricsAtMs = 0
  send({ type: 'sessionStarted' })
}

/** Cuts the chunk's audio out of the history now, and transcribes it when the recognizer is free. */
function transcribeLater(chunk: SpeechChunk): void {
  const audio = history.slice(
    chunk.startMs - TRANSCRIBE_PADDING_MS,
    chunk.endMs + TRANSCRIBE_PADDING_MS,
  )
  const forSession = sessionNumber
  transcriptions = transcriptions.then(async () => {
    if (!recognizer) return
    try {
      const words = countWords(await recognizer.transcribe(audio))
      if (session && forSession === sessionNumber) {
        session = applyTranscription(session, chunk, words)
        sendMetrics()
      }
    } catch (error) {
      // Pace is best effort: skip this chunk rather than end the session.
      console.error('[engine] transcription failed:', error)
    }
  })
}

async function processAudio(samples: Float32Array): Promise<void> {
  // Audio that arrives before a session starts or after it stops is dropped.
  if (!session || !vad) return
  for (const frame of frames.push(samples)) {
    history.push(frame)
    const probability = await vad.speechProbability(frame)
    const step = processFrame(session, probability, FRAME_DURATION_MS)
    session = step.state
    if (step.chunk) transcribeLater(step.chunk)
    if (step.event || session.elapsedMs - lastMetricsAtMs >= METRICS_INTERVAL_MS) sendMetrics()
  }
}

async function stopSession(): Promise<void> {
  if (!session) {
    send({ type: 'sessionEnded', summary: summarizeSession(createSession()) })
    return
  }
  const closed = closeSession(session)
  session = closed.state
  if (closed.chunk) transcribeLater(closed.chunk)
  // Let the last sentence (and any backlog) land in the summary.
  await transcriptions
  const summary = summarizeSession(session)
  session = undefined
  frames.reset()
  history.reset()
  send({ type: 'sessionEnded', summary })
}

async function handle(request: EngineRequest): Promise<void> {
  switch (request.type) {
    case 'startSession':
      return startSession(request.modelsDir)
    case 'audio':
      return processAudio(request.samples)
    case 'stopSession':
      return stopSession()
  }
}

// Requests are handled strictly one at a time, in arrival order, so audio
// frames are never processed out of order or after "stop".
let queue = Promise.resolve()
process.parentPort.on('message', ({ data }) => {
  // Messages only ever come from Glossa's own main process.
  const request = data as EngineRequest
  queue = queue
    .then(() => handle(request))
    .catch((error: unknown) => {
      session = undefined
      send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    })
})
