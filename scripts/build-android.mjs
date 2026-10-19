/**
 * Builds the Android app's screens: `npm run build:android` writes them to out/.
 *
 * A static export cannot hold the server's parts, so they are moved aside for the build and put
 * back after it, whatever happens: the API routes and the sign-in callbacks stay on the site
 * (the app calls https://www.stationmgr.site), middleware.js's checks are the app's own, and
 * the admin area is website-only.
 *
 * If a build is killed before it can put them back, the next run refuses to start and says
 * where they are.
 */
import { existsSync, mkdirSync, renameSync, rmSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const aside = join(root, '.android-build-aside')
const SERVER_ONLY = ['app/api', 'app/auth/callback', 'app/auth/confirm', 'app/admin', 'middleware.js']

if (existsSync(aside) && readdirSync(aside).length) {
  console.error(`A previous Android build left files in ${aside}.`)
  console.error(`Move each back to its place (${SERVER_ONLY.join(', ')}), delete the folder, then run again.`)
  process.exit(1)
}

const moved = []
function restore() {
  while (moved.length) {
    const path = moved.pop()
    renameSync(join(aside, path), join(root, path))
  }
  rmSync(aside, { recursive: true, force: true })
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { restore(); process.exit(1) })
}

let status = 1
try {
  for (const path of SERVER_ONLY) {
    if (!existsSync(join(root, path))) continue
    mkdirSync(dirname(join(aside, path)), { recursive: true })
    renameSync(join(root, path), join(aside, path))
    moved.push(path)
  }
  rmSync(join(root, 'out'), { recursive: true, force: true })
  const build = spawnSync('npx', ['next', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, STATIONMGR_TARGET: 'android' },
  })
  status = build.status ?? 1
} finally {
  restore()
}

// public/ holds the website's service worker from its last build; the app has none.
if (status === 0) {
  for (const name of readdirSync(join(root, 'out'))) {
    if (/^(sw|workbox-.*|fallback-.*)\.js$/.test(name)) rmSync(join(root, 'out', name))
  }
}

if (status === 0) console.log(`\nAndroid screens written to ${join(root, 'out')}`)
process.exit(status)
