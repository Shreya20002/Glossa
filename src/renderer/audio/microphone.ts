import captureWorkletUrl from './capture.worklet.ts?worker&url'

/** The engine's audio format: 16 kHz mono. The browser resamples the microphone to this rate. */
const CAPTURE_SAMPLE_RATE_HZ = 16_000

export interface MicrophoneCapture {
  stop(): Promise<void>
}

/**
 * Starts listening to a microphone (or the system default when `deviceId` is
 * empty) and calls `onChunk` with each 32 ms chunk of 16 kHz mono audio.
 * Nothing is played back and nothing is recorded to disk.
 */
export async function startMicrophoneCapture(
  deviceId: string,
  onChunk: (samples: Float32Array) => void,
): Promise<MicrophoneCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  })
  const context = new AudioContext({
    sampleRate: CAPTURE_SAMPLE_RATE_HZ,
    latencyHint: 'interactive',
  })
  const release = async (): Promise<void> => {
    for (const track of stream.getTracks()) track.stop()
    if (context.state !== 'closed') await context.close()
  }

  try {
    await context.audioWorklet.addModule(captureWorkletUrl)
    const source = context.createMediaStreamSource(stream)
    // Zero outputs: the node only listens, so the microphone is never played back.
    const capture = new AudioWorkletNode(context, 'glossa-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      channelCountMode: 'explicit',
    })
    capture.port.onmessage = (event: MessageEvent<Float32Array>) => onChunk(event.data)
    source.connect(capture)
    await context.resume()
    return {
      async stop() {
        capture.port.onmessage = null
        source.disconnect()
        await release()
      },
    }
  } catch (error) {
    await release()
    throw error
  }
}

/** Turns microphone errors into advice the user can act on. */
export function describeMicrophoneError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
        return 'Microphone access is blocked. On Windows, turn on Settings → Privacy & security → Microphone → "Let desktop apps access your microphone".'
      case 'NotFoundError':
      case 'OverconstrainedError':
        return "That microphone isn't available. Plug it in or choose another one."
      case 'NotReadableError':
        return 'The microphone is busy or failed to start. Close other apps using it and try again.'
    }
  }
  return error instanceof Error ? error.message : String(error)
}
