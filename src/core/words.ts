/**
 * Counts the words in a transcript the way a listener would.
 *
 * Anything separated by spaces that contains a letter or digit counts once:
 * "don't", "well-known", "2,000" and "$5" are one word each. Punctuation on its
 * own ("—", "...") doesn't count. Fillers like "um" are words too: they take
 * just as long to say.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length
}
