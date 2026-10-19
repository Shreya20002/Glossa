import { join } from 'node:path'
import { app, utilityProcess } from 'electron'
import type { UtilityProcess } from 'electron'
import type { EngineEvent, EngineRequest } from '../shared/engine'

/** Where the downloaded models live: inside the installed app, or the project folder in development. */
export function modelsDir(): string {
  return app.isPackaged ? join(process.resourcesPath, 'models') : join(app.getAppPath(), 'models')
}

/**
 * Starts and talks to the engine process (src/engine/index.ts). The engine is
 * started on first use and restarted automatically if it ever crashes.
 */
export class EngineHost {
  private child: UtilityProcess | undefined
  private readonly listeners = new Set<(event: EngineEvent) => void>()

  /** Calls `listener` for every message from the engine. Returns an unsubscribe function. */
  onEvent(listener: (event: EngineEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  send(request: EngineRequest): void {
    this.ensureRunning().postMessage(request)
  }

  /** Sends `request` and resolves with the first event of type `expected`, or rejects on error/timeout. */
  request<T extends EngineEvent['type']>(
    request: EngineRequest,
    expected: T,
    timeoutMs: number,
  ): Promise<Extract<EngineEvent, { type: T }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe()
        reject(new Error(`The engine did not respond within ${timeoutMs / 1000} s`))
      }, timeoutMs)
      const unsubscribe = this.onEvent((event) => {
        if (event.type !== expected && event.type !== 'error') return
        clearTimeout(timer)
        unsubscribe()
        if (event.type === 'error') reject(new Error(event.message))
        else resolve(event as Extract<EngineEvent, { type: T }>)
      })
      this.send(request)
    })
  }

  dispose(): void {
    this.child?.kill()
    this.child = undefined
  }

  private ensureRunning(): UtilityProcess {
    if (this.child) return this.child
    const child = utilityProcess.fork(join(__dirname, 'engine.js'), [], {
      serviceName: 'Glossa Engine',
    })
    child.on('message', (event: EngineEvent) => {
      for (const listener of this.listeners) listener(event)
    })
    child.on('exit', (code) => {
      if (this.child !== child) return
      this.child = undefined
      if (code !== 0) {
        const event: EngineEvent = { type: 'error', message: `The engine stopped (code ${code})` }
        for (const listener of this.listeners) listener(event)
      }
    })
    this.child = child
    return child
  }
}
