/**
 * Pins how the desktop app checks the station's licence with no internet
 * (lib/local/licence.js): a licence the web signed opens exactly the services that are still
 * running; one that was edited, signed by another key, or made for another station opens
 * nothing; and setting the computer's clock back to stretch a licence closes the paid features.
 *
 * The module is loaded from its source with its relative imports pointed at copies, and with a
 * stand-in localStorage, so no browser or bundler is needed.
 *
 * Run: node tests/desktop-licence.test.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { generateKeyPair, exportSPKI, SignJWT } from 'jose'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const tmp = resolve(root, 'node_modules', '.cache', 'desktop-licence-test')
mkdirSync(tmp, { recursive: true })
for (const name of ['licence', 'link', 'constants']) {
  const src = readFileSync(resolve(root, 'lib', 'local', `${name}.js`), 'utf8').replace(/from '\.\/(\w+)'/g, "from './$1.mjs'")
  writeFileSync(resolve(tmp, `${name}.mjs`), src)
}
writeFileSync(resolve(tmp, 'reportRange.mjs'), readFileSync(resolve(root, 'lib', 'reportRange.js'), 'utf8').replace("from '@/lib/local/licence'", "from './licence.mjs'"))

const memory = new Map()
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
}

const { privateKey, publicKey } = await generateKeyPair('ES256')
const other = await generateKeyPair('ES256')
process.env.NEXT_PUBLIC_DESKTOP_LICENCE_PUBLIC_KEY = (await exportSPKI(publicKey)).replace(/\n/g, '\\n')

const lic = await import(pathToFileURL(resolve(tmp, 'licence.mjs')).href)
const { setLink } = await import(pathToFileURL(resolve(tmp, 'link.mjs')).href)
const range = await import(pathToFileURL(resolve(tmp, 'reportRange.mjs')).href)

const DAY = 864e5
const STATION = 'st-1'
const sign = (svc, { key = privateKey, sub = STATION } = {}) =>
  new SignJWT({ svc }).setProtectedHeader({ alg: 'ES256' }).setIssuer('stationmgr').setAudience('stationmgr-desktop').setSubject(sub).setIssuedAt().sign(key)

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

console.log('A computer that is not linked')
check('is unlinked, with nothing running', (await lic.checkLicence()).status === 'unlinked')
check('has the paid features closed', !lic.paidNow())
check('runs a report over 5 days', range.rangeAllowed('2026-10-01', '2026-10-05'))
check('not one over 6 days', !range.rangeAllowed('2026-10-01', '2026-10-06'))
check('opens a report 5 days back', range.defaultReportStart('2026-10-16', '2026-10-01') === '2026-10-12')
check('not before the month starts', range.defaultReportStart('2026-10-02', '2026-10-01') === '2026-10-01')

setLink({ stationId: STATION, stationName: 'Kubwa' })
console.log('\nLinked, before any licence arrives')
check('is missing a licence, and locked', (s => s.status === 'missing' && !s.anyActive)(await lic.checkLicence()))

console.log('\nA licence the web signed')
const soon = new Date(Date.now() + 10 * DAY).toISOString()
const gone = new Date(Date.now() - DAY).toISOString()
await lic.saveLicence(await sign({ 'fuel-operations': soon, 'lube-management': gone }))
const good = await lic.checkLicence()
check('checks out', good.status === 'ok', good.status)
check('opens a service still inside its dates', good.active['fuel-operations'] === true)
check('keeps a lapsed service shut', !good.active['lube-management'])
check('counts the app as open', good.anyActive === true)
check('opens the paid features', lic.paidNow())
check('runs a report over any range', range.rangeAllowed('2026-01-01', '2026-10-16'))
check('opens a report at the month start', range.defaultReportStart('2026-10-16', '2026-10-01') === '2026-10-01')
check('the in-app server agrees on writes', (await lic.serviceRunning('fuel-operations')) && !(await lic.serviceRunning('lube-management')))
check('a service the station never had is shut', !(await lic.serviceRunning('customer-payments')))

console.log('\nOnce every service has lapsed')
const lapsed = await lic.checkLicence(Date.now() + 11 * DAY)
check('the paid features close', lapsed.status === 'ok' && !lapsed.anyActive && !lic.paidNow())

console.log('\nLicences that must not open anything')
let refused = false
try { await lic.saveLicence(await sign({ 'fuel-operations': soon }, { key: other.privateKey })) } catch { refused = true }
check('one signed by another key is not kept', refused)
refused = false
try { await lic.saveLicence(await sign({ 'fuel-operations': soon }, { sub: 'someone-else' })) } catch { refused = true }
check('one for another station is not kept', refused)
const token = memory.get('stationmgr.licence')
const [h, p, sgn] = token.split('.')
const edited = JSON.parse(Buffer.from(p, 'base64url').toString())
edited.svc['lube-management'] = new Date(Date.now() + 365 * DAY).toISOString()
memory.set('stationmgr.licence', [h, Buffer.from(JSON.stringify(edited)).toString('base64url'), sgn].join('.'))
check('one edited on this computer is invalid', (await lic.checkLicence()).status === 'invalid')
memory.set('stationmgr.licence', token)

console.log('\nThe computer clock')
// The lapsed check above looked 11 days ahead, which the clock check rightly remembers.
memory.delete('stationmgr.clock')
check('running normally is fine', (await lic.checkLicence(Date.now() + 2 * DAY)).status === 'ok')
check('set back more than a day closes the paid features', (await lic.checkLicence(Date.now() - 3 * DAY)).status === 'clock')
await lic.saveLicence(await sign({ 'fuel-operations': soon }))
check('a fresh licence from the web resets it', (await lic.checkLicence()).status === 'ok')

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
