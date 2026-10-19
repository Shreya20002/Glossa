import { describe, expect, it } from 'vitest'
import {
  addFillerCounts,
  countFillers,
  fillerLabel,
  findFillers,
  MIN_FILLER_RATE_SAMPLE_MS,
  summarizeFillers,
} from './fillers'

describe('findFillers: vocal fillers', () => {
  it('finds hesitation sounds wherever they are', () => {
    expect(findFillers('So, um, I think the main problem is, uh, the setup screen.')).toEqual([
      'um',
      'uh',
    ])
    expect(findFillers('Um. Uh... er, erm, ah, hmm?')).toEqual([
      'um',
      'uh',
      'er',
      'erm',
      'ah',
      'hmm',
    ])
  })

  it('understands the different spellings', () => {
    expect(findFillers('Umm, uhm, uhh, hm, ahh')).toEqual(['um', 'um', 'uh', 'hmm', 'ah'])
  })

  it('is not fooled by capital letters or curly apostrophes', () => {
    expect(findFillers('UM, I don’t know. Uh')).toEqual(['um', 'uh'])
  })

  it('does not count agreement sounds or words that contain fillers', () => {
    expect(findFillers('Uh-huh. Mm-hmm. Mm. Hummus, umbrella, error, ahead, human.')).toEqual([])
  })
})

describe('findFillers: "like"', () => {
  it('counts "like" set off by a comma', () => {
    expect(findFillers('The new design is, like, much simpler.')).toEqual(['like'])
    expect(findFillers('Like, it was amazing.')).toEqual(['like'])
  })

  it('does not count "like" as a verb, comparison or question', () => {
    expect(
      findFillers(
        "I like it. It looks like rain. What's it like? Things like this. I'd like that.",
      ),
    ).toEqual([])
  })
})

describe('findFillers: "you know"', () => {
  it('counts "you know" set off by punctuation', () => {
    expect(findFillers('It is, you know, hard.')).toEqual(['you know'])
    expect(findFillers('You know, we removed a lot of steps.')).toEqual(['you know'])
    expect(findFillers("It's hard, you know.")).toEqual(['you know'])
    expect(findFillers("It's hard you know")).toEqual(['you know'])
  })

  it('does not count real questions or statements', () => {
    expect(
      findFillers(
        'Do you know the answer? Did you know? If you know, tell me. As you know, it shipped. You know the drill.',
      ),
    ).toEqual([])
  })
})

describe('findFillers: "I mean"', () => {
  it('counts "I mean" followed by a comma', () => {
    expect(findFillers("I mean, it's literally half the clicks.")).toEqual(['i mean', 'literally'])
  })

  it('does not count "I mean" with a real meaning', () => {
    expect(findFillers('I mean it. What I mean is simple. I mean that.')).toEqual([])
  })
})

describe('findFillers: "kind of" and "sort of"', () => {
  it('counts hedges', () => {
    expect(findFillers("It's kind of faster. We sort of agreed. Kind of, yeah.")).toEqual([
      'kind of',
      'sort of',
      'kind of',
    ])
  })

  it('does not count a real "kind" or "sort"', () => {
    expect(
      findFillers('What kind of car? A sort of tool. This kind of thing. Some sort of plan.'),
    ).toEqual([])
  })
})

describe('findFillers: "basically" and "literally"', () => {
  it('always counts them', () => {
    expect(findFillers('Basically it works. It was literally free.')).toEqual([
      'basically',
      'literally',
    ])
  })
})

describe('findFillers: mixed', () => {
  it('finds every filler in a realistic sentence, in order', () => {
    expect(
      findFillers(
        "Basically, the new design is, like, much simpler. You know, we removed a lot of steps. I mean, it's literally half the clicks, and it's kind of faster to load.",
      ),
    ).toEqual(['basically', 'like', 'you know', 'i mean', 'literally', 'kind of'])
  })

  it('handles empty and punctuation-only text', () => {
    expect(findFillers('')).toEqual([])
    expect(findFillers('... , !')).toEqual([])
  })
})

describe('countFillers and addFillerCounts', () => {
  it('counts each filler', () => {
    expect(countFillers('Um, so, um, it is, like, fine. Uh.')).toEqual({ um: 2, like: 1, uh: 1 })
  })

  it('adds counts together', () => {
    expect(addFillerCounts({ um: 2, like: 1 }, { um: 1, uh: 4 })).toEqual({ um: 3, like: 1, uh: 4 })
    expect(addFillerCounts({}, {})).toEqual({})
  })
})

describe('summarizeFillers', () => {
  it('totals, ranks and rates fillers', () => {
    expect(summarizeFillers({ um: 5, like: 3, uh: 3, 'you know': 1 }, 120_000)).toEqual({
      total: 12,
      perMinute: 6,
      top: [
        { filler: 'um', count: 5 },
        { filler: 'uh', count: 3 },
        { filler: 'like', count: 3 },
      ],
    })
  })

  it('shows no rate until there is enough speech', () => {
    expect(summarizeFillers({ um: 1 }, MIN_FILLER_RATE_SAMPLE_MS - 1).perMinute).toBeNull()
    expect(summarizeFillers({ um: 1 }, MIN_FILLER_RATE_SAMPLE_MS).perMinute).toBe(2)
  })

  it('rounds the rate to one decimal place', () => {
    expect(summarizeFillers({ um: 1 }, 7 * 60_000).perMinute).toBe(0.1)
  })

  it('summarizes no fillers as zero', () => {
    expect(summarizeFillers({}, 90_000)).toEqual({ total: 0, perMinute: 0, top: [] })
  })
})

describe('fillerLabel', () => {
  it('writes fillers the way people expect', () => {
    expect(fillerLabel('i mean')).toBe('I mean')
    expect(fillerLabel('um')).toBe('um')
    expect(fillerLabel('you know')).toBe('you know')
  })
})
