/// <reference types="electron" />
import { join } from 'node:path'
import { createSession, endSession, liveMetrics, processFrame } from '../core/session'
import type { SessionState } from '../core/session'
import type { EngineEvent, EngineRequest } from '../shared/engine'
import { ModelFile } from '../shared/models'
import { FrameBuffer } from './frameBuffer'
import { SileroVad, VAD_FRAME_SAMPLES, VAD_SAMPLE_RATE_HZ } from './sileroVad'

// Entry point of the engine: a hidden background process (started by
// src/main/engine.ts) that turns raw microphone audio into live metrics.
// It never touches the disk except to load models, and never keeps audio:
// each frame is analysed and then dropped.

const FRAME_DURATION_MS = (VAD_FRAME_SAMPLES / VAD_SAMPLE_RATE_HZ) * 1000

/** How often (in audio time) fresh numbers are sent to the overlay: 4 times a second. */
const METRICS_INTERVAL_MS = 250

let vad: SileroVad | undefined
let session: SessionState | undefined
let lastMetricsAtMs = 0
const frames = new FrameBuffer(VAD_FRAME_SAMPLES)

function send(event: EngineEvent): void {
  process.parentPort.postMessage(event)
}

async function startSession(modelsDir: string): Promise<void> {
  vad ??= await SileroVad.load(join(modelsDir, ModelFile.voiceActivity))
  vad.reset()
  frames.reset()
  session = createSession()
  lastMetricsAtMs = 0
  send({ type: 'sessionStarted' })
}

async function processAudio(samples: Float32Array): Promise<void> {
  // Audio that arrives before a session starts or after it stops is dropped.
  if (!session || !vad) return
  for (const frame of frames.push(samples)) {
    const probability = await vad.speechProbability(frame)
    const step = processFrame(session, probability, FRAME_DURATION_MS)
    session = step.state
    if (step.event || session.elapsedMs - lastMetricsAtMs >= METRICS_INTERVAL_MS) {
      lastMetricsAtMs = session.elapsedMs
      send({ type: 'metrics', metrics: liveMetrics(session) })
    }
  }
}

function stopSession(): void {
  const summary = endSession(session ?? createSession())
  session = undefined
  frames.reset()
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
