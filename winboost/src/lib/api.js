const hasElectron = typeof window !== 'undefined' && window.electronAPI

function invoke(channel, ...args) {
  if (hasElectron) return window.electronAPI.invoke(channel, ...args)
  return Promise.reject(new Error('Not in Electron'))
}

function on(channel, callback) {
  if (hasElectron) return window.electronAPI.on(channel, callback)
  return () => {}
}

function send(channel, ...args) {
  if (hasElectron) window.electronAPI.send(channel, ...args)
}

/* ───────── Dashboard ───────── */
const MOCK_STATS = {
  cpu: { usage: 24, model: 'Intel Core i7-12700H', cores: 12, speed: 2.7 },
  memory: { used: 5.2, total: 16, percent: 33 },
  disk: [{ fs: 'C:', used: 328, total: 512, percent: 64 }],
  os: { platform: 'Windows 11 Pro', version: '23H2', build: '22631', uptime: 3.4 }
}

export async function getSystemStats() {
  try { return await invoke('system:getStats') }
  catch { return MOCK_STATS }
}

/* ───────── Cleanup ───────── */
const MOCK_CLEANUP = [
  { id: 'temp', name: 'Temporary Files', desc: 'Windows temp folder, app cache, logs', path: 'C:\\Windows\\Temp, %TEMP%', size: 1.2, files: 342 },
  { id: 'browser', name: 'Browser Cache', desc: 'Chrome, Edge, Firefox data', path: 'Browser cache folders', size: 0.856, files: 2840 },
  { id: 'recycle', name: 'Recycle Bin', desc: 'Deleted files waiting to be purged', path: 'All drives recycle bins', size: 0.34, files: 52 },
  { id: 'downloads', name: 'Downloads Folder', desc: 'Old installers and unused files', path: '%USERPROFILE%\\Downloads', size: 2.4, files: 180 },
  { id: 'thumbnails', name: 'Thumbnail Cache', desc: 'Windows explorer thumbnails', path: 'thumbs.db, icon cache', size: 0.18, files: 1240 },
  { id: 'logs', name: 'System Logs', desc: 'Event logs and crash dumps', path: '%WINDIR%\\Logs, Event Viewer', size: 0.52, files: 86 },
]

export async function scanCleanup() {
  try { return await invoke('cleanup:scan') }
  catch { return MOCK_CLEANUP }
}

export async function runCleanup(categoryIds, onProgress) {
  if (hasElectron) {
    on('cleanup:progress', (_, p) => onProgress?.(p))
    try { return await invoke('cleanup:clean', categoryIds) }
    catch { throw new Error('Cleanup failed') }
  }
  await fakeProgress(onProgress, 1500)
  return { freed: 3.2, errors: [] }
}

/* ───────── Malware Scanner ───────── */
const MOCK_THREATS = [
  { name: 'adware.installcore', path: 'C:\\Users\\...\\AppData\\Local\\installer.exe', severity: 'High', type: 'Adware' },
  { name: 'pup.optional.bundle', path: 'C:\\Program Files (x86)\\BundleTool\\updater.dll', severity: 'Medium', type: 'PUP' },
  { name: 'trojan.generic.kd', path: 'C:\\Users\\...\\Downloads\\setup_crack.exe', severity: 'Critical', type: 'Trojan' },
  { name: 'spyware.keylogger.gen', path: 'C:\\Windows\\System32\\suspicious.dll', severity: 'Critical', type: 'Keylogger' },
]

export async function scanMalware(type) {
  try { return await invoke('malware:scan', type) }
  catch { return MOCK_THREATS }
}

export function onMalwareProgress(cb) {
  return on('malware:scan-progress', (_, data) => cb(data))
}

export async function removeMalware(threats) {
  try { return await invoke('malware:remove', threats) }
  catch { return { removed: threats.length } }
}

/* ───────── Uninstaller ───────── */
const MOCK_APPS = [
  { name: 'Adobe Creative Cloud', pub: 'Adobe Inc.', size: 2.4, date: '2024-03-12', leftovers: 340 },
  { name: 'Spotify', pub: 'Spotify AB', size: 0.18, date: '2024-06-22', leftovers: 45 },
  { name: 'Microsoft Teams', pub: 'Microsoft', size: 0.52, date: '2023-11-05', leftovers: 128 },
  { name: 'Discord', pub: 'Discord Inc.', size: 0.21, date: '2024-01-18', leftovers: 62 },
  { name: 'Java Runtime 8', pub: 'Oracle', size: 0.31, date: '2022-09-30', leftovers: 89 },
  { name: 'Node.js v18', pub: 'OpenJS Foundation', size: 0.085, date: '2024-04-10', leftovers: 28 },
  { name: 'Slack', pub: 'Slack Technologies', size: 0.38, date: '2023-08-15', leftovers: 112 },
  { name: 'VS Code', pub: 'Microsoft', size: 0.42, date: '2024-05-02', leftovers: 56 },
]

export async function listApps() {
  try { return await invoke('uninstaller:list') }
  catch { return MOCK_APPS }
}

export async function uninstallApp(appName, onProgress) {
  if (hasElectron) {
    on('uninstaller:progress', (_, p) => onProgress?.(p))
    try { return await invoke('uninstaller:uninstall', appName) }
    catch { throw new Error('Uninstall failed') }
  }
  await fakeProgress(onProgress, 2000)
  return { success: true, freed: Math.random() * 2 + 0.1 }
}

/* ───────── File Shredder ───────── */
export async function pickFilesToShred() {
  try { return await invoke('shredder:pickFiles') }
  catch { return [] }
}

export async function shredFiles(filePaths, passes, onProgress) {
  if (hasElectron) {
    on('shredder:progress', (_, data) => onProgress?.(data))
    on('shredder:log', (_, msg) => onProgress?.({ log: msg }))
    try { return await invoke('shredder:shred', filePaths, passes) }
    catch { throw new Error('Shred failed') }
  }
  for (let i = 0; i <= 100; i += 3) {
    await sleep(80)
    onProgress?.({ percent: i })
  }
  return { success: true }
}

/* ───────── Maintenance ───────── */
export async function runMaintenanceTask(taskId, onProgress) {
  if (hasElectron) {
    on('maintenance:progress', (_, data) => {
      if (data.taskId === taskId) onProgress?.(data)
    })
    try { return await invoke('maintenance:run', taskId) }
    catch { return { success: false, error: 'Command failed' } }
  }
  await fakeProgress(onProgress, 1500)
  return { success: true, output: `Task ${taskId} completed` }
}

export async function runAllMaintenanceTasks(taskIds, onProgress) {
  if (hasElectron) {
    on('maintenance:progress', (_, data) => onProgress?.(data))
    try { return await invoke('maintenance:runAll', taskIds) }
    catch { return { results: [] } }
  }
  for (const id of taskIds) {
    await fakeProgress(onProgress, 1000)
  }
  return { results: taskIds.map(id => ({ taskId: id, success: true })) }
}

/* ───────── Disk Analyzer ───────── */
const MOCK_DISK = {
  folders: [
    { name: 'Program Files', size: 86.2, items: 45230 },
    { name: 'Users', size: 72.8, items: 128400 },
    { name: 'Windows', size: 35.4, items: 210500 },
    { name: 'Games', size: 22.1, items: 2340 },
    { name: 'ProgramData', size: 8.5, items: 18200 },
  ],
  types: [
    { type: 'Documents', size: 45.2, count: 32400 },
    { type: 'Videos', size: 38.7, count: 1250 },
    { type: 'Images', size: 28.1, count: 15800 },
    { type: 'Archives', size: 12.4, count: 3200 },
    { type: 'Music', size: 12.4, count: 4100 },
    { type: 'Other', size: 22.1, count: 45600 },
  ]
}

export async function analyzeDisk(targetPath, onProgress) {
  if (hasElectron) {
    on('diskanalyzer:progress', (_, data) => onProgress?.(data))
    try { return await invoke('diskanalyzer:scan', targetPath) }
    catch { return MOCK_DISK }
  }
  await fakeProgress(onProgress, 2000)
  return MOCK_DISK
}

/* ───────── Large Files ───────── */
const MOCK_LARGE = [
  { name: 'vm_disk_backup.vdi', path: 'C:\\Users\\Admin\\VirtualBox VMs', size: 25.1, date: '2024-02-10', type: 'disk' },
  { name: 'steam_game_backup.tar', path: 'D:\\Backups', size: 45.3, date: '2023-11-30', type: 'archive' },
  { name: 'adobe_cache_files', path: 'C:\\Users\\Admin\\AppData', size: 18.2, date: '2024-04-25', type: 'cache' },
  { name: 'windows_old_backup', path: 'C:\\Windows.old', size: 32.7, date: '2023-09-20', type: 'system' },
  { name: 'vacation_4k_raw.mp4', path: 'C:\\Users\\Admin\\Videos', size: 8.7, date: '2023-06-22', type: 'video' },
  { name: 'project_archive_2024.zip', path: 'C:\\Users\\Admin\\Downloads', size: 12.4, date: '2024-01-15', type: 'archive' },
  { name: 'raw_photo_collection.psd', path: 'C:\\Users\\Admin\\Pictures', size: 6.2, date: '2023-08-14', type: 'image' },
  { name: 'onedrive_sync_data', path: 'C:\\Users\\Admin\\OneDrive', size: 9.4, date: '2024-03-15', type: 'cloud' },
  { name: 'docker_images.tar.gz', path: 'C:\\Users\\Admin\\Docker', size: 4.8, date: '2024-03-05', type: 'archive' },
  { name: 'music_library_backup', path: 'C:\\Users\\Admin\\Music', size: 15.8, date: '2023-05-10', type: 'audio' },
]

export async function scanLargeFiles(minSizeMB, onProgress) {
  if (hasElectron) {
    on('largefiles:progress', (_, data) => onProgress?.(data))
    try { return await invoke('largefiles:scan', minSizeMB) }
    catch { return MOCK_LARGE }
  }
  await fakeProgress(onProgress, 2000)
  return MOCK_LARGE
}

/* ───────── Registry Cleaner ───────── */
const MOCK_REGISTRY = [
  { key: 'orphan1', name: 'Orphaned Registry Key', path: 'HKCU\\Software\\OldApp', desc: 'Leftover from uninstalled application', severity: 'Low', cat: 'Orphaned' },
  { key: 'broken1', name: 'Broken File Association', path: 'HKLM\\Software\\Classes\\broken_handler', desc: 'Points to non-existent program', severity: 'Medium', cat: 'File Assoc' },
  { key: 'startup1', name: 'Invalid Startup Entry', path: 'HKLM\\...\\Run\\old_startup', desc: 'References deleted executable', severity: 'Medium', cat: 'Startup' },
  { key: 'com1', name: 'Invalid COM Registration', path: 'HKCR\\CLSID\\{BROKEN}', desc: 'Registered DLL no longer exists', severity: 'High', cat: 'COM/ActiveX' },
  { key: 'driver1', name: 'Orphaned Driver Entry', path: 'HKLM\\SYSTEM\\...\\old_driver', desc: 'Driver files were removed', severity: 'High', cat: 'Drivers' },
  { key: 'shell1', name: 'Invalid Shell Extension', path: 'HKCU\\Software\\...\\Shell', desc: 'Context menu handler broken', severity: 'Medium', cat: 'Shell' },
  { key: 'dll1', name: 'Shared DLL Reference', path: 'HKLM\\Software\\...\\Shared Tools', desc: 'References missing DLL', severity: 'Low', cat: 'Shared DLLs' },
  { key: 'uninst1', name: 'Invalid Uninstall Entry', path: 'HKLM\\...\\Uninstall', desc: 'Program files manually deleted', severity: 'Low', cat: 'Uninstall' },
]

export async function scanRegistry(onProgress) {
  if (hasElectron) {
    on('registry:progress', (_, data) => onProgress?.(data))
    try { return await invoke('registry:scan') }
    catch { return MOCK_REGISTRY }
  }
  await fakeProgress(onProgress, 2500)
  return MOCK_REGISTRY
}

export async function fixRegistry(issueKeys) {
  try { return await invoke('registry:fix', issueKeys) }
  catch { return { fixed: issueKeys.length } }
}

/* ───────── Startup Manager ───────── */
const MOCK_STARTUP = [
  { name: 'Microsoft OneDrive', pub: 'Microsoft', impact: 'High', enabled: true, path: '' },
  { name: 'Spotify', pub: 'Spotify AB', impact: 'Medium', enabled: true, path: '' },
  { name: 'Discord', pub: 'Discord Inc.', impact: 'Medium', enabled: false, path: '' },
  { name: 'Adobe Creative Cloud', pub: 'Adobe Inc.', impact: 'High', enabled: true, path: '' },
  { name: 'Steam Client', pub: 'Valve Corp.', impact: 'Low', enabled: false, path: '' },
  { name: 'Java Update Scheduler', pub: 'Oracle', impact: 'Low', enabled: true, path: '' },
  { name: 'Microsoft Teams', pub: 'Microsoft', impact: 'High', enabled: true, path: '' },
  { name: 'Dropbox', pub: 'Dropbox Inc.', impact: 'Medium', enabled: false, path: '' },
  { name: 'Google Drive', pub: 'Google LLC', impact: 'Medium', enabled: true, path: '' },
  { name: 'Cortana', pub: 'Microsoft', impact: 'Low', enabled: false, path: '' },
]

export async function listStartup() {
  try { return await invoke('startup:list') }
  catch { return MOCK_STARTUP }
}

export async function toggleStartup(name, enabled) {
  try { return await invoke('startup:toggle', name, enabled) }
  catch { return { success: true } }
}

/* ───────── Privacy Tools ───────── */
const MOCK_PRIVACY = [
  { category: 'Telemetry & Data Collection', items: [
    { name: 'Diagnostic Data', desc: 'Send usage data to Microsoft', enabled: true, key: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection\\AllowTelemetry' },
    { name: 'Tailored Experiences', desc: 'Personalized tips and ads', enabled: true, key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy\\TailoredExperiences' },
    { name: 'Advertising ID', desc: 'Let apps use advertising ID', enabled: true, key: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\AdvertisingInfo\\DisabledByGroupPolicy' },
  ]},
  { category: 'Location & Sensors', items: [
    { name: 'Location Services', desc: 'Allow apps to access location', enabled: false, key: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location' },
    { name: 'Find My Device', desc: 'Track device location', enabled: true, key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\FindMyDevice' },
  ]},
  { category: 'Camera & Microphone', items: [
    { name: 'Camera Access', desc: 'Allow apps to use camera', enabled: true, key: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam' },
    { name: 'Microphone Access', desc: 'Allow apps to use microphone', enabled: true, key: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone' },
  ]},
  { category: 'Network & Sync', items: [
    { name: 'Wi-Fi Sense', desc: 'Share networks with contacts', enabled: false, key: 'HKLM\\SOFTWARE\\Microsoft\\PolicyManager\\default\\WiFi\\AllowWiFiHotSpotReporting' },
    { name: 'Cross-device Sync', desc: 'Sync across devices', enabled: true, key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\SettingSync\\SyncPolicy' },
  ]},
  { category: 'Activity & Input', items: [
    { name: 'Activity History', desc: 'Store activity on device', enabled: false, key: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System\\EnableActivityFeed' },
    { name: 'Clipboard Sync', desc: 'Sync clipboard across devices', enabled: true, key: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System\\AllowCrossDeviceClipboard' },
    { name: 'Inking & Typing', desc: 'Send typing data to cloud', enabled: true, key: 'HKCU\\Software\\Microsoft\\InputPersonalization\\RestrictImplicitTextCollection' },
  ]},
]

export async function listPrivacy() {
  try { return await invoke('privacy:list') }
  catch { return MOCK_PRIVACY }
}

export async function setPrivacy(name, enabled) {
  try { return await invoke('privacy:set', name, enabled) }
  catch { return { success: true } }
}

export async function applyRecommendedPrivacy() {
  try { return await invoke('privacy:recommended') }
  catch { return { applied: 8 } }
}

/* ───────── Performance Optimizer ───────── */
const MOCK_TWEAKS = [
  { name: 'Disable Visual Effects', desc: 'Turn off animations, transparency', impact: 'High', cat: 'Visual', applied: false },
  { name: 'Game Mode', desc: 'Optimize resources for gaming', impact: 'High', cat: 'Gaming', applied: false },
  { name: 'Disable Background Apps', desc: 'Prevent background execution', impact: 'High', cat: 'System', applied: false },
  { name: 'Ultimate Performance Plan', desc: 'Unlock hidden power plan', impact: 'High', cat: 'Power', applied: false },
  { name: 'Disable Cortana', desc: 'Turn off Cortana assistant', impact: 'Medium', cat: 'System', applied: false },
  { name: 'Disable Windows Tips', desc: 'Turn off tips & suggestions', impact: 'Low', cat: 'System', applied: false },
  { name: 'Best Performance Scheduling', desc: 'Optimize processor scheduling', impact: 'High', cat: 'System', applied: false },
  { name: 'Disable Transparency Effects', desc: 'Turn off acrylic & blur', impact: 'Medium', cat: 'Visual', applied: false },
  { name: 'Disable Notifications', desc: 'Reduce notification popups', impact: 'Low', cat: 'System', applied: false },
  { name: 'Disable Xbox Game Bar', desc: 'Turn off game recording overlay', impact: 'Medium', cat: 'Gaming', applied: false },
  { name: 'Disable Search Indexing', desc: 'Reduce disk I/O from indexing', impact: 'Medium', cat: 'Disk', applied: false },
  { name: 'Disable Superfetch', desc: 'Reduce RAM usage on SSDs', impact: 'Medium', cat: 'Memory', applied: false },
]

export async function listTweaks() {
  try { return await invoke('performance:list') }
  catch { return MOCK_TWEAKS }
}

export async function applyTweak(name) {
  try { return await invoke('performance:apply', name) }
  catch { return { success: true } }
}

export async function applyAllTweaks() {
  try { return await invoke('performance:applyAll') }
  catch { return { applied: 5 } }
}

/* ───────── Helpers ───────── */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fakeProgress(onProgress, duration) {
  const steps = 20
  for (let i = 0; i <= steps; i++) {
    onProgress?.({ percent: Math.round((i / steps) * 100), stage: 'Processing...' })
    await sleep(duration / steps)
  }
}
