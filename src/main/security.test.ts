import { describe, expect, it } from 'vitest'
import { isAllowedRequestUrl, isAppPageUrl } from './security'

const DEV_SERVER = 'http://localhost:5173'

describe('isAllowedRequestUrl', () => {
  it('allows offline schemes', () => {
    expect(isAllowedRequestUrl('file:///C:/glossa/out/renderer/app/index.html', undefined)).toBe(
      true,
    )
    expect(isAllowedRequestUrl('data:image/png;base64,AAAA', undefined)).toBe(true)
    expect(isAllowedRequestUrl('blob:file:///1234', undefined)).toBe(true)
    expect(isAllowedRequestUrl('devtools://devtools/bundled/inspector.html', undefined)).toBe(true)
  })

  it('blocks the internet', () => {
    expect(isAllowedRequestUrl('https://example.com/track', undefined)).toBe(false)
    expect(isAllowedRequestUrl('http://example.com', DEV_SERVER)).toBe(false)
    expect(isAllowedRequestUrl('wss://example.com/socket', DEV_SERVER)).toBe(false)
  })

  it('allows the dev server only while developing', () => {
    expect(isAllowedRequestUrl('http://localhost:5173/app/index.html', DEV_SERVER)).toBe(true)
    expect(isAllowedRequestUrl('ws://localhost:5173/', DEV_SERVER)).toBe(true)
    expect(isAllowedRequestUrl('http://localhost:5173/app/index.html', undefined)).toBe(false)
  })

  it('blocks other local ports, which could be any local service', () => {
    expect(isAllowedRequestUrl('http://localhost:8080/', DEV_SERVER)).toBe(false)
  })

  it('blocks malformed URLs', () => {
    expect(isAllowedRequestUrl('not a url', DEV_SERVER)).toBe(false)
  })
})

describe('isAppPageUrl', () => {
  it('trusts bundled pages and the dev server', () => {
    expect(isAppPageUrl('file:///C:/glossa/out/renderer/app/index.html', undefined)).toBe(true)
    expect(isAppPageUrl('http://localhost:5173/app/index.html', DEV_SERVER)).toBe(true)
  })

  it('does not trust data:, blob:, or remote pages', () => {
    expect(isAppPageUrl('data:text/html,<h1>hi</h1>', DEV_SERVER)).toBe(false)
    expect(isAppPageUrl('blob:file:///1234', DEV_SERVER)).toBe(false)
    expect(isAppPageUrl('https://example.com', DEV_SERVER)).toBe(false)
    expect(isAppPageUrl('http://localhost:5173/app/index.html', undefined)).toBe(false)
  })
})
