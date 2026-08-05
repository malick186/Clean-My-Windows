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
