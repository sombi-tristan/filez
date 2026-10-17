/**
 * Pins several stations on one StationMGR Desktop computer (lib/local/link.js, licence.js):
 * each station keeps its own web link and its own licence, the station open now is the one the
 * screens and checks follow, and a computer from before (one link, one licence) carries on as
 * its first station.
 *
 * Loaded from source with a stand-in localStorage, like tests/desktop-licence.test.mjs.
 *
 * Run: node tests/desktop-multi-station.test.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { generateKeyPair, exportSPKI, SignJWT } from 'jose'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const tmp = resolve(root, 'node_modules', '.cache', 'desktop-multi-station-test')
mkdirSync(tmp, { recursive: true })
for (const name of ['licence', 'link', 'constants']) {
  const src = readFileSync(resolve(root, 'lib', 'local', `${name}.js`), 'utf8').replace(/from '\.\/(\w+)'/g, "from './$1.mjs'")
  writeFileSync(resolve(tmp, `${name}.mjs`), src)
}

const memory = new Map()
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
}

const { privateKey, publicKey } = await generateKeyPair('ES256')
process.env.NEXT_PUBLIC_DESKTOP_LICENCE_PUBLIC_KEY = (await exportSPKI(publicKey)).replace(/\n/g, '\\n')

// A computer from before: one link and one licence under the old keys.
const DAY = 864e5
const soon = new Date(Date.now() + 10 * DAY).toISOString()
const sign = (sub, svc) => new SignJWT({ svc }).setProtectedHeader({ alg: 'ES256' }).setIssuer('stationmgr').setAudience('stationmgr-desktop').setSubject(sub).setIssuedAt().sign(privateKey)
memory.set('stationmgr.link', JSON.stringify({ stationId: 'kubwa', stationName: 'Kubwa' }))
memory.set('stationmgr.licence', await sign('kubwa', { 'fuel-operations': soon }))

const link = await import(pathToFileURL(resolve(tmp, 'link.mjs')).href)
const lic = await import(pathToFileURL(resolve(tmp, 'licence.mjs')).href)

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('A computer from before')
check('keeps its link as its station’s', link.getLink('kubwa')?.stationName === 'Kubwa')
check('opens that station', link.getCurrentStationId() === 'kubwa')
check('and its licence still opens the paid features', (await lic.checkLicence()).status === 'ok' && lic.paidNow())

console.log('\nA second station, offline only')
link.setCurrentStationId('wuse')
check('is the one open now', link.getCurrentStationId() === 'wuse')
check('has no link', link.getLink() === null)
check('is unlinked, so free', (await lic.checkLicence()).status === 'unlinked' && !lic.paidNow())
check('while the first keeps its own', (await lic.checkLicence(Date.now(), 'kubwa')).status === 'ok' && lic.paidNow('kubwa'))

console.log('\nLinking the second to its own web station')
link.setLink({ stationId: 'wuse', stationName: 'Wuse' })
await lic.saveLicence(await sign('wuse', { 'lube-management': soon }))
check('keeps both links', link.allLinks().map((l) => l.stationId).sort().join() === 'kubwa,wuse')
check('each licence opens its own station', (await lic.checkLicence()).active['lube-management'] === true && !(await lic.checkLicence(Date.now(), 'kubwa')).active['lube-management'])
let refused = false
try { await lic.saveLicence(await sign('kubwa', {}), 'wuse') } catch { refused = true }
check('a licence for one is not kept as the other’s', refused)

console.log('\nUnlinking one')
link.setLink(null, 'wuse')
check('leaves the other linked', link.getLink('kubwa')?.stationId === 'kubwa' && link.getLink('wuse') === null)

console.log('\nSync follows the station open now')
// The station page counts only its own waiting changes (all stations' never went down, so
// Push looked refused), and the automatic sync works only on the station being worked in.
{
  const page = readFileSync(resolve(root, 'screens', 'dashboard', 'stations', '[stationId]', 'page.js'), 'utf8')
  check('the station page counts its own waiting changes', page.includes('countPending(stationId') && !page.includes('store.outbox.count()'))
  const auto = readFileSync(resolve(root, 'components', 'desktop', 'AutoSync.js'), 'utf8')
  check('automatic sync takes the station open now', auto.includes('getCurrentStationId()') && !auto.includes('allLinks()'))
}

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
