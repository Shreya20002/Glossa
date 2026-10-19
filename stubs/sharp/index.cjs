// Stand-in for the "sharp" image library. See README.md for why it exists.
module.exports = function sharp() {
  throw new Error('Glossa does not process images, so the sharp image library is not included.')
}
