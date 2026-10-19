# `sharp` stand-in

Glossa uses [transformers.js](https://github.com/huggingface/transformers.js)
to run the Whisper speech model. transformers.js also supports image models,
so it loads the [sharp](https://sharp.pixelplumbing.com) image library at
startup, and refuses to start if it's missing, even though Glossa never
touches an image.

Real sharp would add about 20 MB of native image-processing code to every
installer, plus native files to unpack and (on macOS) sign. Instead,
`package.json` tells pnpm to install this folder in its place:

```json
"pnpm": { "overrides": { "sharp": "file:./stubs/sharp" } }
```

It satisfies transformers.js's startup check, and throws a clear error if
anything ever tries to process an image.

If Glossa ever needs images, remove the override and this folder.
