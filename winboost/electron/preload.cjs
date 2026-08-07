const { contextBridge, ipcRenderer } = require('electron')

const invokeChannels = new Set([
  'system:getStats', 'system:listDrives', 'system:openSettings',
  'smart:scan', 'safety:status', 'safety:createRestorePoint', 'history:list',
  'cleanup:scan', 'cleanup:clean',
  'malware:scan', 'malware:remove',
  'uninstaller:list', 'uninstaller:uninstall',
  'shredder:pickFiles', 'shredder:shred',
  'maintenance:list', 'maintenance:run', 'maintenance:runAll',
  'diskanalyzer:scan', 'largefiles:scan', 'largefiles:reveal', 'largefiles:trash',
  'registry:scan', 'registry:fix', 'registry:openBackups',
  'startup:list', 'startup:toggle',
  'privacy:list', 'privacy:set', 'privacy:recommended',
  'performance:list', 'performance:set', 'performance:apply', 'performance:applyAll',
  'clamav:detect', 'clamav:update', 'clamav:scan',
  'debloat:list', 'debloat:remove', 'debloat:removeAll',
  'winget:featured', 'winget:install',
  'sysutils:sfc', 'sysutils:dismCheck', 'sysutils:dismRestore', 'sysutils:chkdsk', 'sysutils:cleanWinUpdate',
  'network:status', 'network:setDns', 'network:optimize', 'network:reset',
])

const sendChannels = new Set(['window-minimize', 'window-maximize', 'window-close'])

const receiveChannels = new Set([
  'smart:progress', 'cleanup:progress', 'malware:scan-progress',
  'shredder:progress', 'shredder:log', 'maintenance:progress',
  'diskanalyzer:progress', 'largefiles:progress', 'registry:progress',
  'clamav:update-progress',
  'debloat:progress', 'winget:progress',
  'sysutils:progress', 'sysutils:chkdsk-progress',
])

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  invoke: (channel, ...args) => {
    if (!invokeChannels.has(channel)) return Promise.reject(new Error(`Blocked IPC channel: ${channel}`))
    return ipcRenderer.invoke(channel, ...args)
  },
  send: (channel, ...args) => {
    if (!sendChannels.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`)
    ipcRenderer.send(channel, ...args)
  },
  on: (channel, callback) => {
    if (!receiveChannels.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`)
    const handler = (_event, ...args) => callback(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
})
