// The desktop app's one way to the web platform. The window itself is offline (main.js refuses
// every http(s) request it makes); the station's link, push, pull and licence go through here.
//
// - Only the web addresses the app was built for (package.json "stationmgr.webOrigin", one
//   address or a list, or the STATIONMGR_WEB_ORIGIN environment variable, comma-separated), and
//   only their /api/desktop/ endpoints. They are tried in order when one cannot be reached; the
//   one that answered is tried first after that.
// - The device token from linking is kept here, encrypted with the operating system's key store
//   (safeStorage: DPAPI on Windows), and added to each request. The window never sees it.
// - Requests go through their own session, so the window's block does not apply to them.
const { app, ipcMain, session, safeStorage, shell } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const APP_ORIGIN = 'app://stationmgr'
const UNREACHABLE = { ok: false, status: 0, body: { error: 'Could not reach StationMGR on the web. Check the internet connection and try again.' } }

function webOrigins() {
  let configured = (process.env.STATIONMGR_WEB_ORIGIN || '').split(',')
  if (!configured.some((o) => o.trim())) {
    try { configured = [].concat(require('../package.json').stationmgr?.webOrigin || []) } catch { configured = [] }
  }
  return configured
    .flatMap((o) => String(o).split(','))
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => /^https:\/\//.test(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o))
}

// The address that last answered, tried first next time.
let reached = null
function webOrigin() {
  const origins = webOrigins()
  return origins.includes(reached) ? reached : origins[0] || ''
}

// One device token per linked station ({ [stationId]: token }), in one encrypted file. A computer
// from before kept a single token in device-token.bin: the first station asked for takes it, which
// is the station it was linked to (lib/local/link.js moves that link the same way).
const tokensFile = () => path.join(app.getPath('userData'), 'device-tokens.bin')
const oldTokenFile = () => path.join(app.getPath('userData'), 'device-token.bin')

function readFile(file) {
  try {
    const data = fs.readFileSync(file)
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(data) : data.toString('utf8')
  } catch {
    return null
  }
}

function readTokens() {
  try { return JSON.parse(readFile(tokensFile()) || '{}') } catch { return {} }
}

function writeTokens(tokens) {
  const text = JSON.stringify(tokens)
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text, 'utf8')
  fs.writeFileSync(tokensFile(), data, { mode: 0o600 })
}

function readToken(stationId) {
  if (typeof stationId !== 'string' || !stationId) return null
  const tokens = readTokens()
  if (tokens[stationId]) return tokens[stationId]
  const old = readFile(oldTokenFile())
  if (!old) return null
  writeTokens({ ...tokens, [stationId]: old })
  try { fs.unlinkSync(oldTokenFile()) } catch { /* already gone */ }
  return old
}

function writeToken(stationId, token) {
  writeTokens({ ...readTokens(), [stationId]: token })
}

function deleteToken(stationId) {
  const tokens = readTokens()
  delete tokens[stationId]
  writeTokens(tokens)
}

async function call(method, apiPath, body, token) {
  const origins = webOrigins()
  if (!origins.length) return { ok: false, status: 0, body: { error: 'This copy of StationMGR was built without a web address, so it cannot link, push or pull.' } }
  if (typeof apiPath !== 'string' || !apiPath.startsWith('/api/desktop/')) return { ok: false, status: 400, body: { error: 'Not a desktop request' } }
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Device ${token}`
  const first = webOrigin()
  for (const origin of [first, ...origins.filter((o) => o !== first)]) {
    try {
      const res = await session.fromPartition('stationmgr-web').fetch(origin + apiPath, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      reached = origin
      const json = await res.json().catch(() => ({}))
      return { ok: res.ok, status: res.status, body: json }
    } catch {
      // Not reachable: try the next address.
    }
  }
  return UNREACHABLE
}

// Only the app's own pages may ask.
function fromApp(event) {
  return String(event.senderFrame?.url || '').startsWith(APP_ORIGIN)
}

function registerWebBridge() {
  ipcMain.handle('web:link', async (event, { email, password, stationId, createName } = {}) => {
    if (!fromApp(event)) return { ok: false, status: 403, body: {} }
    const res = await call('POST', '/api/desktop/link', { email, password, stationId, createName, deviceName: os.hostname() })
    if (res.ok && res.body?.token && res.body.station?.id) {
      writeToken(res.body.station.id, res.body.token)
      delete res.body.token
    }
    return res
  })

  ipcMain.handle('web:request', async (event, { method = 'GET', path: apiPath, body, stationId } = {}) => {
    if (!fromApp(event)) return { ok: false, status: 403, body: {} }
    const token = readToken(stationId)
    if (!token) return { ok: false, status: 401, body: { error: 'This station is not linked' } }
    return call(method === 'POST' ? 'POST' : 'GET', apiPath, body, token)
  })

  ipcMain.handle('web:unlink', async (event, stationId) => {
    if (!fromApp(event) || typeof stationId !== 'string') return { ok: false }
    deleteToken(stationId)
    return { ok: true }
  })

  ipcMain.handle('web:open', async (event, pagePath) => {
    const origin = webOrigin()
    if (!fromApp(event) || !origin || typeof pagePath !== 'string' || !pagePath.startsWith('/')) return
    await shell.openExternal(origin + pagePath)
  })
}

module.exports = { registerWebBridge }
