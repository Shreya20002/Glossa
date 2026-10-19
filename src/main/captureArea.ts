import type { CaptureArea } from '../shared/ipc'

/**
 * Checks an area a page asked to copy as an image (the report card), and
 * snaps it to whole pixels inside the window's `windowWidth` × `windowHeight`.
 * Returns null if it isn't a usable area. The page measures in fractions of a
 * pixel, so the edges are rounded outwards.
 */
export function toCaptureArea(
  value: unknown,
  windowWidth: number,
  windowHeight: number,
): CaptureArea | null {
  if (typeof value !== 'object' || value === null) return null
  const { x, y, width, height } = value as Record<string, unknown>
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height))
    return null
  const left = Math.max(0, Math.floor(x))
  const top = Math.max(0, Math.floor(y))
  const right = Math.min(windowWidth, Math.ceil(x + width))
  const bottom = Math.min(windowHeight, Math.ceil(y + height))
  if (right - left < 1 || bottom - top < 1) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
