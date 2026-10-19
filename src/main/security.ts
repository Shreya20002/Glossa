import type { Session, WebContents, WebFrameMain } from 'electron'

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

/**
 * True only for a request to use the microphone (audio, never the camera) that
 * comes from one of Glossa's own pages.
 */
export function isMicrophoneRequest(
  permission: string,
  mediaTypes: readonly string[],
  requestingUrl: string,
  devServerUrl: string | undefined,
): boolean {
  return (
    permission === 'media' &&
    mediaTypes.length > 0 &&
    mediaTypes.every((type) => type === 'audio') &&
    isAppPageUrl(requestingUrl, devServerUrl)
  )
}

/** Denies every browser permission except microphone access for Glossa's own pages. */
export function restrictPermissions(session: Session, devServerUrl: string | undefined): void {
  session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    const mediaTypes = 'mediaTypes' in details ? (details.mediaTypes ?? []) : []
    callback(isMicrophoneRequest(permission, mediaTypes, details.requestingUrl, devServerUrl))
  })
  // "Checks" are silent questions such as "may this page see microphone names?"
  // (needed for the microphone picker).
  session.setPermissionCheckHandler((_contents, permission, requestingOrigin, details) => {
    const mediaTypes = details.mediaType === 'video' ? ['video'] : ['audio']
    const url = details.requestingUrl ?? requestingOrigin
    return isMicrophoneRequest(permission, mediaTypes, url, devServerUrl)
  })
}

/** Stops pages from opening new windows, navigating away, or embedding webviews. */
export function hardenWebContents(contents: WebContents): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event) => event.preventDefault())
  contents.on('will-attach-webview', (event) => event.preventDefault())
}

/** True if an IPC message came from one of Glossa's own pages. */
export function isTrustedSender(
  event: { senderFrame: WebFrameMain | null },
  devServerUrl: string | undefined,
): boolean {
  return isAppPageUrl(event.senderFrame?.url ?? '', devServerUrl)
}

/** Throws unless an IPC message came from one of Glossa's own pages. */
export function assertTrustedSender(
  event: { senderFrame: WebFrameMain | null },
  devServerUrl: string | undefined,
): void {
  if (!isTrustedSender(event, devServerUrl)) {
    throw new Error(`Rejected IPC message from untrusted page: ${event.senderFrame?.url ?? ''}`)
  }
}
