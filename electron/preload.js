// What the app's pages may ask of Electron: the web bridge in web.js, nothing else. The device
// token never crosses this line.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('stationmgr', {
  link: (details) => ipcRenderer.invoke('web:link', details),
  request: (details) => ipcRenderer.invoke('web:request', details),
  unlink: () => ipcRenderer.invoke('web:unlink'),
  openWeb: (pagePath) => ipcRenderer.invoke('web:open', pagePath),
})
