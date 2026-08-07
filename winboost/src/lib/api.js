const hasElectron = typeof window !== 'undefined' && Boolean(window.electronAPI)

function invoke(channel, ...args) {
  if (!hasElectron) return Promise.reject(new Error('This action requires the Windows desktop application.'))
  return window.electronAPI.invoke(channel, ...args)
}

function on(channel, callback) {
  if (!hasElectron) return () => {}
  return window.electronAPI.on(channel, callback)
}

function assertSuccess(result, fallback) {
  if (result?.success === false) throw new Error(result.error || fallback)
  return result
}

const browserStats = {
  cpu: { usage: 18, model: 'Windows PC', cores: 8, speed: 3.2, temperature: 0 },
  memory: { used: 5.2, total: 16, percent: 33 },
  disk: [{ fs: 'C:', used: 328, total: 512, percent: 64 }],
  os: { platform: 'Windows 11', version: '', build: '', uptime: 1.2, hostname: 'Preview' },
}

export async function getSystemStats() {
  if (!hasElectron) return browserStats
  return invoke('system:getStats')
}

export async function listDrives() {
  if (!hasElectron) return [{ id: 'home', label: 'User profile', path: 'C:\\Users\\You' }, { id: 'C:\\', label: 'C: drive', path: 'C:\\' }]
  return invoke('system:listDrives')
}

export async function openWindowsSettings(key) {
  return assertSuccess(await invoke('system:openSettings', key), 'Unable to open Windows Settings.')
}

export async function runSmartScan(onProgress) {
  if (!hasElectron) {
    onProgress?.({ percent: 100, stage: 'Preview scan complete' })
    return { success: true, score: 92, stats: browserStats, reclaimableGB: 0.8, startupCount: 4, highStartup: 1, defender: { available: true, realTimeProtection: true }, checks: [] }
  }
  const off = on('smart:progress', data => onProgress?.(data))
  try { return assertSuccess(await invoke('smart:scan'), 'Smart scan failed.') }
  finally { off() }
}

export async function getSafetyStatus() {
  if (!hasElectron) return { admin: false, localOnly: true, defender: { available: true, realTimeProtection: true, signaturesOutOfDate: false }, restore: { enabled: true, count: 2 }, history: [] }
  return invoke('safety:status')
}

export async function createRestorePoint() {
  return assertSuccess(await invoke('safety:createRestorePoint'), 'Unable to create a restore point.')
}

export async function listHistory() {
  if (!hasElectron) return []
  return invoke('history:list')
}

const previewCleanup = [
  { id: 'temp', name: 'Temporary Files', desc: 'Current-user temporary files', path: '%TEMP%', size: 0.42, bytes: 450000000, files: 620, risk: 'Low', recommended: true },
  { id: 'browser', name: 'Browser Cache', desc: 'Browser caches only', path: 'Browser profiles', size: 0.31, bytes: 330000000, files: 940, risk: 'Low', recommended: true },
  { id: 'shaders', name: 'DirectX Shader Cache', desc: 'Rebuildable graphics cache', path: 'D3DSCache', size: 0.12, bytes: 128000000, files: 90, risk: 'Low', recommended: true },
  { id: 'recycle', name: 'Recycle Bin', desc: 'Permanently empty deleted files', path: '$Recycle.Bin', size: 0.9, bytes: 960000000, files: 44, risk: 'Review', recommended: false },
]

export async function scanCleanup() {
  if (!hasElectron) return previewCleanup
  return invoke('cleanup:scan')
}

export async function runCleanup(categoryIds, onProgress) {
  if (!hasElectron) return { success: true, freed: 0, deletedFiles: 0, errors: [] }
  const off = on('cleanup:progress', data => onProgress?.(data))
  try { return await invoke('cleanup:clean', categoryIds) }
  finally { off() }
}

export async function scanMalware(type, onProgress) {
  if (!hasElectron) return []
  const off = on('malware:scan-progress', data => onProgress?.(data))
  try {
    const result = assertSuccess(await invoke('malware:scan', type), 'Microsoft Defender scan failed.')
    return result.threats || []
  } finally { off() }
}

export async function removeMalware() {
  return assertSuccess(await invoke('malware:remove'), 'Microsoft Defender could not remediate the detected threats.')
}

export async function listApps() {
  if (!hasElectron) return []
  const result = assertSuccess(await invoke('uninstaller:list'), 'Unable to read installed applications.')
  return result.apps || []
}

export async function uninstallApp(appId) {
  return assertSuccess(await invoke('uninstaller:uninstall', appId), 'Unable to launch the registered uninstaller.')
}

export async function pickFilesToShred() {
  if (!hasElectron) return []
  return invoke('shredder:pickFiles')
}

export async function shredFiles(filePaths, passes, onProgress) {
  if (!hasElectron) return { success: false, errors: ['Desktop app required.'] }
  const offProgress = on('shredder:progress', data => onProgress?.(data))
  const offLog = on('shredder:log', message => onProgress?.({ log: message }))
  try { return await invoke('shredder:shred', filePaths, passes) }
  finally { offProgress(); offLog() }
}

export async function listMaintenanceTasks() {
  if (!hasElectron) return []
  return invoke('maintenance:list')
}

export async function runMaintenanceTask(taskId, onProgress) {
  const off = on('maintenance:progress', data => { if (data.taskId === taskId) onProgress?.(data) })
  try { return await invoke('maintenance:run', taskId) }
  finally { off() }
}

export async function runAllMaintenanceTasks(taskIds, onProgress) {
  const off = on('maintenance:progress', data => onProgress?.(data))
  try { return await invoke('maintenance:runAll', taskIds) }
  finally { off() }
}

export async function analyzeDisk(targetId, onProgress) {
  if (!hasElectron) return { folders: [], types: [], root: 'Preview', scannedItems: 0 }
  const off = on('diskanalyzer:progress', data => onProgress?.(data))
  try { return assertSuccess(await invoke('diskanalyzer:scan', targetId), 'Disk analysis failed.') }
  finally { off() }
}

export async function scanLargeFiles(minSizeMB, onProgress) {
  if (!hasElectron) return { files: [], root: 'Preview', scannedItems: 0 }
  const off = on('largefiles:progress', data => onProgress?.(data))
  try { return assertSuccess(await invoke('largefiles:scan', minSizeMB), 'Large-file scan failed.') }
  finally { off() }
}

export async function revealLargeFile(fileId) {
  return assertSuccess(await invoke('largefiles:reveal', fileId), 'Unable to reveal this file.')
}

export async function trashLargeFile(fileId) {
  return assertSuccess(await invoke('largefiles:trash', fileId), 'Unable to move this file to the Recycle Bin.')
}

export async function scanRegistry(onProgress) {
  if (!hasElectron) return []
  const off = on('registry:progress', data => onProgress?.(data))
  try {
    const result = assertSuccess(await invoke('registry:scan'), 'Registry scan failed.')
    return result.issues || []
  } finally { off() }
}

export async function fixRegistry(issueIds) {
  return await invoke('registry:fix', issueIds)
}

export async function openRegistryBackups() {
  return assertSuccess(await invoke('registry:openBackups'), 'Unable to open registry backups.')
}

export async function listStartup() {
  if (!hasElectron) return []
  const result = assertSuccess(await invoke('startup:list'), 'Unable to read startup entries.')
  return result.items || []
}

export async function toggleStartup(entryId, enabled) {
  return assertSuccess(await invoke('startup:toggle', entryId, enabled), 'Unable to update this startup entry.')
}

export async function listPrivacy() {
  if (!hasElectron) return []
  const result = assertSuccess(await invoke('privacy:list'), 'Unable to read Windows privacy settings.')
  return result.groups || []
}

export async function setPrivacy(name, enabled) {
  return assertSuccess(await invoke('privacy:set', name, enabled), 'Unable to update this privacy setting.')
}

export async function applyRecommendedPrivacy() {
  return await invoke('privacy:recommended')
}

export async function listTweaks() {
  if (!hasElectron) return []
  const result = assertSuccess(await invoke('performance:list'), 'Unable to read performance settings.')
  return result.tweaks || []
}

export async function setTweak(name, enabled) {
  return assertSuccess(await invoke('performance:set', name, enabled), 'Unable to update this performance setting.')
}

export async function applyTweak(name) {
  return assertSuccess(await invoke('performance:apply', name), 'Unable to apply this performance setting.')
}

export async function applyAllTweaks() {
  return await invoke('performance:applyAll')
}

export async function detectClamAV() {
  if (!hasElectron) return { found: false, clamscan: null, freshclam: null, version: null, definitionsVersion: null, definitionsDate: null, installUrl: 'https://www.clamav.net/downloads' }
  return invoke('clamav:detect')
}

export async function updateClamAV(onProgress) {
  if (!hasElectron) return { success: false, error: 'Not available in preview' }
  const off = on('clamav:update-progress', data => onProgress?.(data))
  try { return assertSuccess(await invoke('clamav:update'), 'ClamAV update failed.') }
  finally { off() }
}

export async function scanWithClamAV(scanType, onProgress) {
  if (!hasElectron) {
    onProgress?.({ percent: 100, stage: 'Preview: scan not available', filesScanned: 0, threatsFound: 0 })
    return { threats: [], filesScanned: 0, engine: 'preview' }
  }
  const off = on('malware:scan-progress', data => onProgress?.(data))
  try { return await invoke('clamav:scan', scanType) }
  finally { off() }
}

export async function listDebloat() {
  if (!hasElectron) return { success: true, items: [], total: 0, installed: 0 }
  return invoke('debloat:list')
}

export async function removeDebloat(itemId, onProgress) {
  if (!hasElectron) return { success: false, error: 'Preview only' }
  const off = on('debloat:progress', data => onProgress?.(data))
  try { return await invoke('debloat:remove', itemId) }
  finally { off() }
}

export async function removeAllDebloat(selectedIds, onProgress) {
  if (!hasElectron) return { success: false, error: 'Preview only' }
  const off = on('debloat:progress', data => onProgress?.(data))
  try { return await invoke('debloat:removeAll', selectedIds) }
  finally { off() }
}

export async function listFeaturedApps() {
  if (!hasElectron) return { success: true, apps: [] }
  return invoke('winget:featured')
}

export async function installWingetApp(appId, onProgress) {
  if (!hasElectron) return { success: false, error: 'Preview only' }
  const off = on('winget:progress', data => onProgress?.(data))
  try { return await invoke('winget:install', appId) }
  finally { off() }
}

export async function runSFC(onProgress) {
  if (!hasElectron) return { success: false, error: 'Preview only' }
  const off = on('sysutils:progress', data => onProgress?.(data))
  try { return await invoke('sysutils:sfc') }
  finally { off() }
}

export async function runDISMCheck(onProgress) {
  if (!hasElectron) return { success: false, error: 'Preview only' }
  const off = on('sysutils:progress', data => onProgress?.(data))
  try { return await invoke('sysutils:dismCheck') }
  finally { off() }
}

export async function runDISMRestore(onProgress) {
  if (!hasElectron) return { success: false, error: 'Preview only' }
  const off = on('sysutils:progress', data => onProgress?.(data))
  try { return await invoke('sysutils:dismRestore') }
  finally { off() }
}

export async function runCHKDSK(onProgress) {
  if (!hasElectron) return { success: false, error: 'Preview only' }
  const off = on('sysutils:chkdsk-progress', data => onProgress?.(data))
  try { return await invoke('sysutils:chkdsk') }
  finally { off() }
}

export async function cleanWinUpdate() {
  if (!hasElectron) return { success: false, error: 'Preview only' }
  return invoke('sysutils:cleanWinUpdate')
}

export async function getNetworkStatus() {
  if (!hasElectron) return { success: true, adapters: [], currentDns: null, currentProvider: 'none' }
  return invoke('network:status')
}

export async function setDNS(providerId) {
  return assertSuccess(await invoke('network:setDns', providerId), 'Failed to set DNS.')
}

export async function optimizeNetwork() {
  return assertSuccess(await invoke('network:optimize'), 'Network optimization failed.')
}

export async function resetNetwork() {
  return assertSuccess(await invoke('network:reset'), 'Network reset failed.')
}

// Advanced System Info
export async function getHardwareInfo() {
  if (!hasElectron) return { success: true, cpu: { model: 'Intel Core i7-12700K', cores: 16, speed: '3600 MHz', architecture: 'x64' }, gpu: { model: 'NVIDIA GeForce RTX 3060', vram: '12 GB' }, ram: { total: 17179869184, free: 8589934592, used: 8589934592 }, disks: [{ drive: 'C:', label: 'Windows', total: 500107862016, free: 250053931008 }], motherboard: 'ASUS ROG STRIX', bios: 'American Megatrends Inc. 2.10', hostname: 'DESKTOP-ABC123', os: { platform: 'win32', release: '10.0.22621', arch: 'x64', uptime: 86400 } }
  return invoke('system:hardware')
}

export async function listProcesses() {
  if (!hasElectron) return { success: true, processes: [] }
  return invoke('system:processes')
}

export async function killProcess(pid) {
  return invoke('system:killProcess', pid)
}

export async function listServices() {
  if (!hasElectron) return { success: true, services: [] }
  return invoke('system:services')
}

// Duplicate File Finder
export async function scanDuplicates(dirPath, onProgress) {
  if (!hasElectron) return { success: true, duplicates: [], totalGroups: 0, totalWasted: 0 }
  const off = on('duplicates:progress', data => onProgress?.(data))
  try { return await invoke('duplicates:scan', dirPath) }
  finally { off() }
}

export async function deleteDuplicates(filePaths) {
  return invoke('duplicates:delete', filePaths)
}

// Browser Cleaner
export async function scanBrowsers() {
  if (!hasElectron) return { success: true, browsers: [] }
  return invoke('browser:scan')
}

export async function cleanBrowser(browserName, dataTypes) {
  return invoke('browser:clean', browserName, dataTypes)
}

// Power Management
export async function listPowerPlans() {
  if (!hasElectron) return { success: true, plans: [{ id: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced', active: true }], currentScheme: '381b4222' }
  return invoke('power:list')
}

export async function setPowerPlan(planId) {
  return invoke('power:set', planId)
}

export async function activateUltimatePerformance() {
  return invoke('power:ultimate')
}

// Network Diagnostics
export async function pingHost(host) {
  if (!hasElectron) return { success: true, host: host || '8.8.8.8', results: [12, 14, 11, 13], avg: '12ms', loss: '0%', min: '11ms', max: '14ms' }
  return invoke('network:ping', host)
}

export async function tracerouteHost(host) {
  if (!hasElectron) return { success: true, host: host || '8.8.8.8', hops: [] }
  return invoke('network:traceroute', host)
}

export async function runSpeedtest() {
  if (!hasElectron) return { success: true, download: 0, upload: 0, ping: 0 }
  return invoke('network:speedtest')
}

// Context Menu Manager
export async function listContextMenus() {
  if (!hasElectron) return { success: true, entries: [] }
  return invoke('system:contextMenu')
}

export async function removeContextMenu(regPath) {
  return invoke('system:removeContextMenu', regPath)
}

// Export Report
export async function exportSystemReport() {
  return invoke('system:exportReport')
}
