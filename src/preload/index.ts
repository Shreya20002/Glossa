import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type GlossaApi } from '../shared/ipc'

// The preload script runs before each page loads and is the only bridge
// between the page and Electron. Expose small, specific functions, never
// `ipcRenderer` itself, so a compromised page can't send arbitrary messages.
const api: GlossaApi = {
  getAppVersion: () => ipcRenderer.invoke(IpcChannel.getAppVersion),
}

contextBridge.exposeInMainWorld('glossa', api)
