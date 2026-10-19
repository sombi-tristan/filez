/**
 * Pins the app's icons to Premeval's blue (#0093DD): the PWA icons (public/icon-192.png and
 * icon-512.png, also the desktop app's window and installer icon), the favicon (app/icon.svg) and
 * the manifest's theme colour. They were a stock blue (#2563EB).
 *
 * Run: node tests/pwa-icons.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
const sharp = createRequire(import.meta.url)('sharp')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}
const url = (p) => new URL(`../${p}`, import.meta.url)

console.log('Icons in Premeval blue')
for (const name of ['icon-192.png', 'icon-512.png']) {
  const { data, info } = await sharp(readFileSync(url(`public/${name}`))).raw().toBuffer({ resolveWithObject: true })
  const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]] }
  const [r, g, b] = px(4, 4)
  check(`${name}: the background is #0093DD`, r === 0x00 && g === 0x93 && b === 0xdd)
  const [wr, wg, wb] = px(Math.round(info.width * 0.45), Math.round(info.height * 0.6))
  check(`${name}: the pump is still white`, wr === 255 && wg === 255 && wb === 255)
}
const svg = readFileSync(url('app/icon.svg'), 'utf8')
check('the favicon is #0093DD', svg.includes('fill="#0093dd"') && !svg.toLowerCase().includes('#2563eb'))
if (existsSync(url('public/manifest.json'))) {
  const manifest = JSON.parse(readFileSync(url('public/manifest.json'), 'utf8'))
  check('the manifest theme colour is #0093DD', manifest.theme_color.toLowerCase() === '#0093dd')
}

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
