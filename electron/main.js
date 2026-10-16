// StationMGR desktop: an Electron window around the static export in out/.
//
// The app is served from a private app:// origin rather than file://, so absolute links
// ("/dashboard/...") resolve and IndexedDB — where every record lives — has a stable origin
// that survives updates. The window's own web traffic is blocked: it never touches the network.
// Linking to the web station, push, pull and the licence go through electron/web.js instead.
const { app, BrowserWindow, protocol, net, session, shell, Menu } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { resolveExportPath } = require('./resolve')
const { registerWebBridge } = require('./web')

const SCHEME = 'app'
const HOST = 'stationmgr'
const START_URL = `${SCHEME}://${HOST}/`
const OUT_DIR = path.join(__dirname, '..', 'out')

// Must run before app is ready. `standard` + `secure` give the origin the same storage and
// fetch rights as an https site.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

// One copy at a time: two windows writing the same IndexedDB is asking for trouble.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) { if (win.isMinimized()) win.restore(); win.focus() }
  })
  app.whenReady().then(start)
}

function start() {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url)
    const file = resolveExportPath(OUT_DIR, pathname)
    return net.fetch(pathToFileURL(file).toString())
  })

  registerWebBridge()

  // The window is offline: refuse every http(s) and websocket request it makes. electron/web.js
  // reaches the web station through a session of its own.
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (_details, callback) => callback({ cancel: true }),
  )

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }] },
  ]))

  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'StationMGR',
    icon: path.join(OUT_DIR, 'icon-512.png'),
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.once('ready-to-show', () => { win.maximize(); win.show() })

  // Stay inside the app. A receipt image (stored as a data: URL) opens in a viewer window;
  // a mailto:/tel: goes to the OS; nothing else opens.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('data:image/') || url.startsWith('data:application/pdf')) {
      const viewer = new BrowserWindow({ width: 900, height: 900, parent: win, title: 'Receipt', autoHideMenuBar: true, webPreferences: { sandbox: true, contextIsolation: true } })
      viewer.loadURL(url)
    } else if (url.startsWith('mailto:') || url.startsWith('tel:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${SCHEME}://${HOST}`)) event.preventDefault()
  })

  win.loadURL(START_URL)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
