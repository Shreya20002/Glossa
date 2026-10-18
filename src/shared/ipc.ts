/**
 * The contract between the main process and renderer windows.
 *
 * Renderer windows can't call Electron directly. They call functions on
 * `window.glossa` (exposed by the preload script), which send messages over
 * these IPC channels to handlers in the main process. Keeping channel names
 * and the API shape here means both sides always agree.
 */
export const IpcChannel = {
  getAppVersion: 'app:get-version',
} as const

/** The API available to renderer code as `window.glossa`. */
export interface GlossaApi {
  getAppVersion(): Promise<string>
}
