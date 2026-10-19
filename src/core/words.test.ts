import { describe, expect, it } from 'vitest'
import { countWords } from './words'

describe('countWords', () => {
  it('counts plain words', () => {
    expect(countWords('Thanks for joining today.')).toBe(4)
  })

  it('counts contractions, hyphenated words, numbers and amounts once', () => {
    expect(countWords("don't well-known 2,000 $5 3.5")).toBe(5)
  })

  it('counts fillers, which take time to say', () => {
    expect(countWords('So, um, I think, uh, yes.')).toBe(6)
  })

  it('ignores punctuation on its own', () => {
    expect(countWords('Well — I mean ... okay')).toBe(4)
  })

  it('handles empty, blank and messy whitespace', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   \n\t ')).toBe(0)
    expect(countWords('  two\n\nwords  ')).toBe(2)
  })

  it('counts words with accents and other scripts', () => {
    expect(countWords('café naïve résumé')).toBe(3)
  })
})
