/**
 * `node scripts/android-icons.mjs`: the Android app's launcher icons (mobile/android/.../mipmap-*)
 * and their source (mobile/assets/icon-only.png): the white pump on Premeval blue, drawn smaller
 * than it used to be (SCALE) so it has room inside the circle or squircle a launcher crops to.
 *
 *   ic_launcher_foreground  the adaptive icon's front: the pump on transparent, 108dp canvas
 *                           (the background is @color/ic_launcher_background, #0093DD)
 *   ic_launcher             the square icon for launchers before adaptive icons
 *   ic_launcher_round       the same in a circle
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BLUE = '#0093DD'
const SCALE = 0.78 // of the pump's old size, around the centre of the 108-unit canvas
const RES = 'mobile/android/app/src/main/res'

// The pump in the adaptive icon's 108-unit canvas, as it was drawn before (centred on 54, 54).
const pump = `<g transform="translate(54 54) scale(${SCALE}) translate(-54 -54)" fill="white">
  <path fill-rule="evenodd" d="M27 20 H70.75 V88 H27 Z M32 27.5 H65.5 V43.25 H32 Z"/>
  <rect x="74.5" y="33.25" width="6.5" height="46.75"/>
</g>`

const svg = ({ background, round }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  ${background ? (round ? `<circle cx="54" cy="54" r="54" fill="${BLUE}"/>` : `<rect width="108" height="108" fill="${BLUE}"/>`) : ''}
  ${pump}
</svg>`

const DENSITIES = { ldpi: 36, mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }

const write = (markup, size, file) => sharp(Buffer.from(markup), { density: 72 * (size / 108) * 4 })
  .resize(size, size).png().toFile(file)

for (const [d, size] of Object.entries(DENSITIES)) {
  const dir = join(RES, `mipmap-${d}`)
  mkdirSync(dir, { recursive: true })
  await write(svg({ background: true }), size, join(dir, 'ic_launcher.png'))
  await write(svg({ background: true, round: true }), size, join(dir, 'ic_launcher_round.png'))
  // The adaptive foreground is 108dp: 2.25 times the 48dp icon. ldpi has none.
  if (d !== 'ldpi') await write(svg({ background: false }), Math.round(size * 2.25), join(dir, 'ic_launcher_foreground.png'))
}
await write(svg({ background: true }), 512, 'mobile/assets/icon-only.png')
console.log('Android icons written, pump at', SCALE)
