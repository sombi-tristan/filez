/**
 * `npm run build:android:json`: a debug APK whose API is this PC's `npm run dev:json`, for
 * trying the Android app on the seeded test data from a phone on the same Wi-Fi.
 *
 *   1. the app's screens, with the JSON datastore client and this PC as the API (next.config.mjs)
 *   2. cap sync, then mixed content allowed in the synced config: the app's pages are on
 *      https://localhost and the PC answers on plain http. The synced config is generated, so
 *      the next ordinary sync (npm run apk) puts it back.
 *   3. assembleDebug. Plain http is allowed by app/src/debug/AndroidManifest.xml, debug only.
 *
 * The address is this PC's Wi-Fi IPv4 unless JSONDB_API_ORIGIN says otherwise.
 * Stop `npm run dev:json` first: build:android moves app/api aside while it builds.
 */
import { networkInterfaces } from 'node:os'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mobile = join(root, 'mobile')
const android = join(mobile, 'android')

function lanAddress() {
  const candidates = Object.entries(networkInterfaces()).flatMap(([name, addrs]) =>
    (addrs || []).filter((a) => a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254')).map((a) => ({ name, address: a.address })))
  return (candidates.find((c) => /wi-?fi|wlan|wireless/i.test(c.name)) || candidates[0])?.address
}

const origin = process.env.JSONDB_API_ORIGIN || (lanAddress() && `http://${lanAddress()}:${process.env.PORT || 3000}`)
if (!origin) {
  console.error('No network address found. Set JSONDB_API_ORIGIN, e.g. http://192.168.1.20:3000')
  process.exit(1)
}
console.log(`Test APK will use the JSON datastore at ${origin}\n`)

const env = { ...process.env, DATA_SOURCE: 'json', JSONDB_API_ORIGIN: origin }
const run = (cmd, args, cwd) => {
  // npx and gradlew.bat need a shell on Windows; node itself must not go through one, since
  // its path ("C:\Program Files\nodejs\node.exe") would be split at the space.
  const shell = process.platform === 'win32' && cmd !== process.execPath
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run(process.execPath, [join(root, 'scripts', 'build-android.mjs')], root)
run('npx', ['cap', 'sync', 'android'], mobile)

const synced = join(android, 'app', 'src', 'main', 'assets', 'capacitor.config.json')
const config = JSON.parse(readFileSync(synced, 'utf8'))
config.android = { ...config.android, allowMixedContent: true }
writeFileSync(synced, `${JSON.stringify(config, null, 2)}\n`)

run(join(android, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'), ['assembleDebug'], android)

const apk = join(android, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
console.log(existsSync(apk)
  ? `\nTest APK: ${apk}\nInstall it on a phone on the same Wi-Fi, start \`npm run dev:json\` here, and sign in as owner@test.local / password123.`
  : '\nThe build finished but no app-debug.apk was found.')
