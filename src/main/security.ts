import type { IpcMainInvokeEvent, Session, WebContents } from 'electron'

/**
 * Electron security baseline, following https://www.electronjs.org/docs/latest/tutorial/security.
 *
 * Glossa's privacy promise is that nothing leaves the computer. The checks below
 * enforce that for everything the app's windows try to load.
 */

/** URL schemes that never touch the network. */
const OFFLINE_PROTOCOLS = new Set(['file:', 'data:', 'blob:', 'devtools:'])

function parseUrl(rawUrl: string): URL | undefined {
  try {
    return new URL(rawUrl)
  } catch {
    return undefined
  }
}

/**
 * True if `rawUrl` is one of Glossa's own pages: a bundled file in the packaged
 * app, or the local Vite dev server during `pnpm dev`.
 */
export function isAppPageUrl(rawUrl: string, devServerUrl: string | undefined): boolean {
  const url = parseUrl(rawUrl)
  if (!url) return false
  if (url.protocol === 'file:') return true
  const devServer = devServerUrl ? parseUrl(devServerUrl) : undefined
  return devServer !== undefined && url.protocol === 'http:' && url.host === devServer.host
}

/**
 * True if a window may load `rawUrl`. Only offline schemes are allowed, plus the
 * local dev server (pages over http:, live reload over ws:) while developing.
 */
export function isAllowedRequestUrl(rawUrl: string, devServerUrl: string | undefined): boolean {
  const url = parseUrl(rawUrl)
  if (!url) return false
  if (OFFLINE_PROTOCOLS.has(url.protocol)) return true
  const devServer = devServerUrl ? parseUrl(devServerUrl) : undefined
  return (
    devServer !== undefined &&
    (url.protocol === 'http:' || url.protocol === 'ws:') &&
    url.host === devServer.host
  )
}

/** Cancels every request that would leave the computer. */
export function blockNetworkRequests(session: Session, devServerUrl: string | undefined): void {
  session.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedRequestUrl(details.url, devServerUrl)
    if (!allowed) console.warn(`[security] Blocked network request: ${details.url}`)
    callback({ cancel: !allowed })
  })
}

/** Denies every browser permission except microphone (audio-only) access. */
export function restrictPermissions(session: Session): void {
  session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    const mediaTypes = 'mediaTypes' in details ? (details.mediaTypes ?? []) : []
    const isMicrophoneOnly =
      permission === 'media' && mediaTypes.length > 0 && mediaTypes.every((t) => t === 'audio')
    callback(isMicrophoneOnly)
  })
  session.setPermissionCheckHandler(
    (_contents, permission, _origin, details) =>
      permission === 'media' && details.mediaType !== 'video',
  )
}

/** Stops pages from opening new windows, navigating away, or embedding webviews. */
export function hardenWebContents(contents: WebContents): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event) => event.preventDefault())
  contents.on('will-attach-webview', (event) => event.preventDefault())
}

/** Throws unless an IPC message came from one of Glossa's own pages. */
export function assertTrustedSender(
  event: IpcMainInvokeEvent,
  devServerUrl: string | undefined,
): void {
  const url = event.senderFrame?.url ?? ''
  if (!isAppPageUrl(url, devServerUrl)) {
    throw new Error(`Rejected IPC message from untrusted page: ${url}`)
  }
}
