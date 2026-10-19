# Filler benchmark

How accurately does Glossa catch filler words in **real** speech? This folder
answers that with numbers anyone can reproduce:

```bash
pnpm fetch-models
pnpm eval
```

The first run downloads about 22 MB of audio (only the needed seconds of each
recording, each checked against its SHA-256 fingerprint) into `eval/.data/`,
which git ignores. A full run takes about two minutes.

## What it measures

The benchmark runs **Glossa's real pipeline**, the same code the app uses
(voice detection, phrase grouping, Whisper with Glossa's prompt, the safety
nets, word and filler counting), over clips of real meetings. It then compares
what Glossa heard with what people actually said, according to hand-made
transcripts that write down every "um" and "uh".

| Column               | Meaning                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Words (said / heard) | Words in the human transcript vs words Glossa counted                                       |
| Word errors          | Word error rate: the share of words Whisper got wrong, missed or added (raw Whisper output) |
| um/uh…               | Vocal fillers said → detected                                                               |
| lexical              | "like", "you know", "I mean", "kind of"… said → detected                                    |
| Recall               | Of the fillers people said, how many Glossa caught                                          |
| Precision            | Of the fillers Glossa reported, how many were really said                                   |

## Results (October 2026)

Whisper tiny.en with Glossa's filler prompt:

| Set                         | um/uh recall       | um/uh precision | Lexical recall | Lexical precision | Word count | Word errors |
| --------------------------- | ------------------ | --------------- | -------------- | ----------------- | ---------- | ----------- |
| **Held-out (honest score)** | **99%** (79 of 80) | **96%**         | 100% (5 of 5)  | 71% (5 of 7)      | −4%        | 12%         |
| Tuning                      | 80% (52 of 65)     | 96%             | 100% (5 of 5)  | 100%              | −7%        | 17%         |

For comparison, **without the prompt Whisper caught 0 of 65 ums and uhs** on
the tuning set. It's trained on cleaned-up transcripts, so it deletes them. See
[docs/architecture.md](../docs/architecture.md) for the full story.

Known limits:

- Whisper sometimes writes "uh" for "um" and vice versa. The total is right, but
  the "top filler" can occasionally swap the two.
- Lexical fillers are rare in these meetings (5 per set), so their numbers are
  rough. The human transcripts also often skip the commas that Glossa's "like,"
  rule looks for, so some "false alarms" may be real fillers.
- 16 clips (about 11 minutes) of English meeting speech from three European
  research sites: a solid first benchmark, not a guarantee for every voice.

## Tuning set and held-out set

Choosing rules or prompts by looking at a set of clips makes those clips' score
look better than real life. So the clips are split:

- **Tuning** (8 clips): used to choose the filler rules and Whisper's prompt.
- **Held-out** (8 clips, different meetings): never used for any choice. Its
  score is the one to quote.

If you change the rules or the prompt, **don't tune against the held-out set**.
If it ever has to be used for a decision, add a fresh held-out set and say so
in your PR.

## Trying other settings

The benchmark uses exactly what the app uses, unless you override it:

| Variable                         | Effect                                                                      |
| -------------------------------- | --------------------------------------------------------------------------- |
| `EVAL_PROMPT="..."`              | Try another prompt. `EVAL_PROMPT=` (empty) means no prompt.                 |
| `EVAL_MODELS_DIR=… EVAL_MODEL=…` | Try another Whisper model folder (same layout as `models/whisper-tiny.en`). |
| `EVAL_TRANSCRIPTS=1`             | Print what Glossa heard next to the human transcript.                       |

## The data

Clips come from the [AMI Meeting Corpus](https://groups.inf.ed.ac.uk/ami/corpus/):
real meetings recorded with a headset microphone per person, with manual
word-level transcripts. Each clip is a 30–60 second stretch where one person
does almost all the talking (so other voices don't leak into the score), cut at
natural pauses.

`clips.json` lists each clip: the recording's URL, the exact byte range, its
SHA-256, and the reference transcript (the corpus's words, joined into plain
text).

**License and credit:** the AMI Meeting Corpus is released under the
[Creative Commons Attribution 4.0 International License (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
`clips.json` contains short excerpts of its transcripts. Changes: short
excerpts selected, and words joined into plain text with punctuation attached
to the preceding word. The audio isn't stored in this repository; it's
downloaded from the corpus when the benchmark runs. None of this data is
included in the Glossa app.

> Carletta, J. et al. (2005). The AMI Meeting Corpus: A Pre-Announcement.
> Machine Learning for Multimodal Interaction (MLMI 2005).
