import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { LiveMetrics } from '../core/session'
import { IpcChannel } from '../shared/ipc'
import type { GlossaApi, SessionEnded } from '../shared/ipc'

// The preload script runs before each page loads and is the only bridge
// between the page and Electron. Expose small, specific functions, never
// `ipcRenderer` itself, so a compromised page can't send arbitrary messages.

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: GlossaApi = {
  getAppVersion: () => ipcRenderer.invoke(IpcChannel.getAppVersion),
  startSession: () => ipcRenderer.invoke(IpcChannel.startSession),
  stopSession: () => ipcRenderer.invoke(IpcChannel.stopSession),
  pushAudio: (samples) => ipcRenderer.send(IpcChannel.pushAudio, samples),
  onMetrics: (listener) => subscribe<LiveMetrics>(IpcChannel.sessionMetrics, listener),
  onSessionEnded: (listener) => subscribe<SessionEnded>(IpcChannel.sessionEnded, listener),
  getLatestReport: () => ipcRenderer.invoke(IpcChannel.latestReport),
  copyReportImage: (area) => ipcRenderer.invoke(IpcChannel.copyReportImage, area),
}

contextBridge.exposeInMainWorld('glossa', api)
