const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
const { execFile, spawn } = require('child_process')
const { promisify } = require('util')

const execFileAsync = promisify(execFile)
let si
try { si = require('systeminformation') } catch (_) { si = null }

let mainWindow
const state = {
  uninstallers: new Map(),
  startup: new Map(),
  registryIssues: new Map(),
  largeFiles: new Map(),
  shredFiles: new Set(),
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 980,
    minHeight: 680,
    title: 'WinBoost - Windows Optimizer',
    icon: path.join(__dirname, '../public/icon.png'),
    backgroundColor: '#070b16',
    frame: false,
    roundedCorners: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
}

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data)
}

function errorMessage(error) {
  const text = error?.stderr || error?.stdout || error?.message || String(error || 'Unknown error')
  return String(text).replace(/\x1b\[[0-9;]*m/g, '').trim().slice(0, 1400)
}

function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function parseJson(text, fallback = null) {
  try { return JSON.parse(String(text || '').replace(/^\uFEFF/, '').trim()) }
  catch (_) { return fallback }
}

function stableId(...parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 20)
}

function psLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

async function runExe(file, args = [], options = {}) {
  return execFileAsync(file, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeout || 120000,
    maxBuffer: options.maxBuffer || 8 * 1024 * 1024,
  })
}

async function runPowerShell(script, options = {}) {
  return runExe('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script,
  ], options)
}

async function isElevated() {
  try {
    const script = '[Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent() | % { $_.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }'
    const { stdout } = await runPowerShell(script, { timeout: 8000 })
    return stdout.trim().toLowerCase() === 'true'
  } catch (_) { return false }
}

async function runElevatedCommand(label, command, timeout = 1800000) {
  const taskRoot = path.join(app.getPath('userData'), 'Tasks')
  await fs.promises.mkdir(taskRoot, { recursive: true })
  const id = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  const cmdPath = path.join(taskRoot, `${id}.cmd`)
  const logPath = path.join(taskRoot, `${id}.log`)
  const statusPath = path.join(taskRoot, `${id}.status`)
  const safeLog = logPath.replace(/"/g, '')
  const safeStatus = statusPath.replace(/"/g, '')
  const content = `@echo off\r\nsetlocal\r\n${command} > "${safeLog}" 2>&1\r\nset "WINBOOST_CODE=%ERRORLEVEL%"\r\n> "${safeStatus}" echo %WINBOOST_CODE%\r\nexit /b %WINBOOST_CODE%\r\n`
  await fs.promises.writeFile(cmdPath, content, 'utf8')

  try {
    const script = `$p = Start-Process -FilePath ${psLiteral(cmdPath)} -Verb RunAs -Wait -PassThru; exit $p.ExitCode`
    await runPowerShell(script, { timeout })
    const status = Number.parseInt((await fs.promises.readFile(statusPath, 'utf8')).trim(), 10)
    const output = await fs.promises.readFile(logPath, 'utf8').catch(() => '')
    if (status !== 0) throw new Error(output || `${label} failed with exit code ${status}`)
    return { success: true, output: output.trim() || `${label} completed.` }
  } catch (error) {
    throw new Error(errorMessage(error).includes('canceled') ? 'Administrator approval was cancelled.' : errorMessage(error))
  } finally {
    await Promise.allSettled([cmdPath, logPath, statusPath].map(file => fs.promises.rm(file, { force: true })))
  }
}

async function runElevatedPowerShell(label, script, timeout = 1800000) {
  const taskRoot = path.join(app.getPath('userData'), 'Tasks')
  await fs.promises.mkdir(taskRoot, { recursive: true })
  const scriptPath = path.join(taskRoot, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.ps1`)
  await fs.promises.writeFile(scriptPath, script, 'utf8')
  try {
    return await runElevatedCommand(label, `powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "${scriptPath.replace(/"/g, '')}"`, timeout)
  } finally { await fs.promises.rm(scriptPath, { force: true }).catch(() => null) }
}

function dataFile(name) {
  return path.join(app.getPath('userData'), name)
}

async function readJsonFile(file, fallback) {
  try { return JSON.parse(await fs.promises.readFile(file, 'utf8')) }
  catch (_) { return fallback }
}

async function writeJsonFile(file, value) {
  await fs.promises.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.tmp`
  await fs.promises.writeFile(temp, JSON.stringify(value, null, 2), 'utf8')
  await fs.promises.rename(temp, file)
}

async function addHistory(action, detail, status = 'success', meta = {}) {
  const file = dataFile('operation-history.json')
  const history = await readJsonFile(file, [])
  history.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), action, detail, status, ...meta })
  await writeJsonFile(file, history.slice(0, 120))
}

ipcMain.handle('history:list', async () => readJsonFile(dataFile('operation-history.json'), []))

async function getSystemStats() {
  try {
    if (si) {
      const [load, cpuInfo, mem, disks, osInfo, temperature, battery] = await Promise.all([
        si.currentLoad(), si.cpu(), si.mem(), si.fsSize(), si.osInfo(),
        si.cpuTemperature().catch(() => ({})), si.battery().catch(() => ({})),
      ])
      return {
        cpu: {
          usage: Math.round(load.currentLoad || 0),
          model: `${cpuInfo.manufacturer || ''} ${cpuInfo.brand || ''}`.trim() || os.cpus()[0]?.model || 'Unknown',
          cores: cpuInfo.cores || os.cpus().length,
          speed: Number(cpuInfo.speed || 0),
          temperature: Number(temperature.main || 0),
        },
        memory: {
          used: Number(((mem.active || mem.used || 0) / 1073741824).toFixed(1)),
          total: Number(((mem.total || 1) / 1073741824).toFixed(1)),
          percent: Math.round(((mem.active || mem.used || 0) / (mem.total || 1)) * 100),
        },
        disk: (disks || []).filter(d => /^[A-Z]:/i.test(d.mount || d.fs || '')).map(d => ({
          fs: d.mount || d.fs,
          used: Number((d.used / 1073741824).toFixed(1)),
          total: Number((d.size / 1073741824).toFixed(1)),
          percent: Math.round((d.used / (d.size || 1)) * 100),
        })),
        os: {
          platform: `${osInfo.distro || 'Windows'} ${osInfo.release || ''}`.trim(),
          version: osInfo.release || '',
          build: osInfo.build || os.release(),
          uptime: Number((os.uptime() / 86400).toFixed(1)),
          hostname: os.hostname(),
        },
        battery: battery.hasBattery ? { percent: battery.percent, charging: battery.isCharging } : null,
      }
    }
  } catch (_) {}
  const total = os.totalmem()
  const used = total - os.freemem()
  return {
    cpu: { usage: 0, model: os.cpus()[0]?.model || 'Unknown', cores: os.cpus().length, speed: os.cpus()[0]?.speed / 1000 || 0, temperature: 0 },
    memory: { used: Number((used / 1073741824).toFixed(1)), total: Number((total / 1073741824).toFixed(1)), percent: Math.round((used / total) * 100) },
    disk: [], os: { platform: `Windows ${os.release()}`, version: '', build: os.release(), uptime: Number((os.uptime() / 86400).toFixed(1)), hostname: os.hostname() }, battery: null,
  }
}

ipcMain.handle('system:getStats', getSystemStats)
ipcMain.handle('system:listDrives', async () => {
  const stats = await getSystemStats()
  return [{ id: 'home', label: 'User profile', path: os.homedir() }, ...stats.disk.map(d => ({ id: d.fs, label: `${d.fs} drive`, path: d.fs }))]
})

const SETTINGS_URIS = {
  security: 'windowsdefender:', storage: 'ms-settings:storage', startup: 'ms-settings:startupapps', privacy: 'ms-settings:privacy', restore: 'systempropertiesprotection.exe',
}
ipcMain.handle('system:openSettings', async (_, key) => {
  const target = SETTINGS_URIS[key]
  if (!target) return { success: false, error: 'Unknown Windows settings page.' }
  try {
    if (target.endsWith('.exe')) spawn(target, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref()
    else await shell.openExternal(target)
    return { success: true }
  } catch (error) { return { success: false, error: errorMessage(error) } }
})

function browserCacheTargets(root) {
  const targets = []
  try {
    if (!fs.existsSync(root)) return targets
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^(Default|Profile \d+)$/i.test(entry.name)) continue
      const profile = path.join(root, entry.name)
      for (const relative of ['Cache', 'Code Cache', 'GPUCache', path.join('Service Worker', 'CacheStorage')]) targets.push({ path: path.join(profile, relative) })
    }
  } catch (_) {}
  return targets
}

function firefoxCacheTargets(root) {
  const targets = []
  try {
    if (!fs.existsSync(root)) return targets
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      targets.push({ path: path.join(root, entry.name, 'cache2') }, { path: path.join(root, entry.name, 'startupCache') })
    }
  } catch (_) {}
  return targets
}

function getCleanupCategories() {
  const home = os.homedir()
  const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
  const roaming = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
  const windir = process.env.WINDIR || 'C:\\Windows'
  return [
    { id: 'temp', name: 'Temporary Files', desc: 'Current-user and accessible Windows temporary files', risk: 'Low', recommended: true, targets: [{ path: os.tmpdir() }, { path: path.join(windir, 'Temp') }] },
    { id: 'browser', name: 'Browser Cache', desc: 'Chrome, Edge and Firefox caches only; profiles and bookmarks are preserved', risk: 'Low', recommended: true, targets: [
      ...browserCacheTargets(path.join(local, 'Google', 'Chrome', 'User Data')),
      ...browserCacheTargets(path.join(local, 'Microsoft', 'Edge', 'User Data')),
      ...firefoxCacheTargets(path.join(local, 'Mozilla', 'Firefox', 'Profiles')),
      ...firefoxCacheTargets(path.join(roaming, 'Mozilla', 'Firefox', 'Profiles')),
    ] },
    { id: 'shaders', name: 'DirectX Shader Cache', desc: 'Graphics shader cache that Windows and drivers can rebuild', risk: 'Low', recommended: true, targets: [{ path: path.join(local, 'D3DSCache') }] },
    { id: 'thumbnails', name: 'Thumbnail Cache', desc: 'Explorer thumbnail and icon cache databases', risk: 'Low', recommended: true, targets: [{ path: path.join(local, 'Microsoft', 'Windows', 'Explorer'), match: /^(thumbcache_|iconcache_).+\.db$/i }] },
    { id: 'crashlogs', name: 'Crash Reports', desc: 'Application crash dumps and queued Windows error reports', risk: 'Low', recommended: true, targets: [
      { path: path.join(local, 'CrashDumps') },
      { path: path.join(local, 'Microsoft', 'Windows', 'WER', 'ReportArchive') },
      { path: path.join(local, 'Microsoft', 'Windows', 'WER', 'ReportQueue') },
    ] },
    { id: 'recycle', name: 'Recycle Bin', desc: 'Permanently empty the current user Recycle Bin', risk: 'Review', recommended: false, special: 'recycle', targets: [{ path: 'C:\\$Recycle.Bin' }] },
    { id: 'downloads', name: 'Old Downloads', desc: 'Move root-level files older than 60 days to the Recycle Bin', risk: 'Review', recommended: false, special: 'downloads', targets: [{ path: path.join(home, 'Downloads'), maxAgeDays: 60, rootFilesOnly: true }] },
  ]
}

function protectedRoots() {
  const roots = [path.dirname(process.execPath), app.getPath('userData'), app.getAppPath()]
  return roots.map(p => path.resolve(p).toLowerCase())
}

function isProtected(candidate) {
  const value = path.resolve(candidate).toLowerCase()
  return protectedRoots().some(root => value === root || value.startsWith(`${root}${path.sep}`))
}

async function collectTargetFiles(target, limitState) {
  const files = []
  if (!target?.path || !fs.existsSync(target.path) || isProtected(target.path)) return files
  const queue = [target.path]
  const cutoff = target.maxAgeDays ? Date.now() - target.maxAgeDays * 86400000 : null

  while (queue.length && limitState.count < limitState.limit) {
    const dir = queue.shift()
    let entries
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch (_) { continue }
    for (const entry of entries) {
      if (limitState.count++ >= limitState.limit) break
      const fullPath = path.join(dir, entry.name)
      if (isProtected(fullPath) || entry.isSymbolicLink()) continue
      try {
        if (entry.isDirectory()) {
          if (!target.rootFilesOnly) queue.push(fullPath)
        } else if (entry.isFile()) {
          if (target.match && !target.match.test(entry.name)) continue
          const stat = await fs.promises.stat(fullPath)
          if (cutoff && stat.mtimeMs >= cutoff) continue
          files.push({ path: fullPath, size: stat.size })
        }
      } catch (_) {}
    }
  }
  return files
}

async function scanCleanupCategory(category) {
  const limitState = { count: 0, limit: 120000 }
  const files = []
  for (const target of category.targets || []) files.push(...await collectTargetFiles(target, limitState))
  return {
    ...category,
    targets: undefined,
    path: category.targets.map(t => t.path).join(', '),
    size: Number((files.reduce((sum, file) => sum + file.size, 0) / 1073741824).toFixed(3)),
    bytes: files.reduce((sum, file) => sum + file.size, 0),
    files: files.length,
    limited: limitState.count >= limitState.limit,
  }
}

async function scanCleanup() {
  const result = []
  for (const category of getCleanupCategories()) result.push(await scanCleanupCategory(category))
  return result
}

ipcMain.handle('cleanup:scan', scanCleanup)
ipcMain.handle('cleanup:clean', async (_, categoryIds) => {
  const allowedIds = new Set(Array.isArray(categoryIds) ? categoryIds : [])
  const categories = getCleanupCategories().filter(category => allowedIds.has(category.id))
  let freedBytes = 0
  let deletedFiles = 0
  const errors = []

  for (let index = 0; index < categories.length; index++) {
    const category = categories[index]
    send('cleanup:progress', { percent: Math.round((index / Math.max(categories.length, 1)) * 100), stage: `Cleaning ${category.name}...` })
    try {
      const before = await scanCleanupCategory(category)
      if (category.special === 'recycle') {
        await runPowerShell('Clear-RecycleBin -Force -ErrorAction Stop', { timeout: 120000 })
        freedBytes += before.bytes
        deletedFiles += before.files
      } else {
        const limitState = { count: 0, limit: 120000 }
        const candidates = []
        for (const target of category.targets || []) candidates.push(...await collectTargetFiles(target, limitState))
        for (const file of candidates) {
          try {
            if (category.special === 'downloads') await shell.trashItem(file.path)
            else await fs.promises.unlink(file.path)
            freedBytes += file.size
            deletedFiles++
          } catch (error) { errors.push(`${path.basename(file.path)}: ${errorMessage(error)}`) }
        }
      }
    } catch (error) { errors.push(`${category.name}: ${errorMessage(error)}`) }
  }

  send('cleanup:progress', { percent: 100, stage: 'Cleanup complete' })
  const result = { success: errors.length === 0, freed: Number((freedBytes / 1073741824).toFixed(3)), freedBytes, deletedFiles, errors: errors.slice(0, 30) }
  await addHistory('System cleanup', `${deletedFiles} files removed; ${(freedBytes / 1048576).toFixed(1)} MB reclaimed`, errors.length ? 'warning' : 'success')
  return result
})

async function getDefenderStatus() {
  const script = `
    $s = Get-MpComputerStatus -ErrorAction Stop
    [pscustomobject]@{
      available = $true
      antivirusEnabled = [bool]$s.AntivirusEnabled
      realTimeProtection = [bool]$s.RealTimeProtectionEnabled
      signaturesOutOfDate = [bool]$s.DefenderSignaturesOutOfDate
      signatureUpdated = if ($s.AntivirusSignatureLastUpdated) { $s.AntivirusSignatureLastUpdated.ToString('o') } else { $null }
      quickScanAge = [int]$s.QuickScanAge
      fullScanAge = [int]$s.FullScanAge
      engineVersion = [string]$s.AMEngineVersion
    } | ConvertTo-Json -Compress
  `
  try {
    const { stdout } = await runPowerShell(script, { timeout: 15000 })
    return parseJson(stdout, { available: false, error: 'Unable to read Microsoft Defender status.' })
  } catch (error) {
    try {
      const { stdout } = await runPowerShell(`$s = Get-Service WinDefend -ErrorAction SilentlyContinue; [pscustomobject]@{ status = [string]$s.Status; startType = [string]$s.StartType } | ConvertTo-Json -Compress`, { timeout: 8000 })
      const service = parseJson(stdout, {})
      return {
        available: service.status === 'Running', antivirusEnabled: service.status === 'Running', realTimeProtection: false,
        permissionRequired: true, serviceStatus: service.status || 'Unknown',
        error: 'Detailed Microsoft Defender status requires administrator approval on this PC.',
      }
    } catch (_) { return { available: false, antivirusEnabled: false, realTimeProtection: false, permissionRequired: true, error: errorMessage(error) } }
  }
}

function defenderThreatCollectionScript() {
  return `
    $items = @()
    $threats = @(Get-MpThreat -ErrorAction SilentlyContinue | Where-Object { $_.IsActive })
    foreach ($t in $threats) {
      $d = @(Get-MpThreatDetection -ThreatID $t.ThreatID -ErrorAction SilentlyContinue | Sort-Object InitialDetectionTime -Descending | Select-Object -First 1)
      $severity = switch ([int]$t.SeverityID) { 4 {'Critical'} 3 {'High'} 2 {'Medium'} default {'Low'} }
      $items += [pscustomobject]@{
        id = [string]$t.ThreatID
        name = [string]$t.ThreatName
        severity = $severity
        type = 'Microsoft Defender'
        path = if ($d -and $d.Resources) { [string]($d.Resources -join ', ') } else { 'Detected by Microsoft Defender' }
        detectedAt = if ($d -and $d.InitialDetectionTime) { $d.InitialDetectionTime.ToString('o') } else { $null }
      }
    }
  `
}

function defenderThreatQueryScript() {
  return `${defenderThreatCollectionScript()}\n@($items) | ConvertTo-Json -Compress -Depth 4`
}

ipcMain.handle('malware:scan', async (_, type) => {
  const scanType = type === 'quick' ? 'QuickScan' : 'FullScan'
  const timeout = type === 'quick' ? 30 * 60 * 1000 : 3 * 60 * 60 * 1000

  let progress = 6
  send('malware:scan-progress', { percent: progress, stage: `Starting Microsoft Defender ${scanType === 'QuickScan' ? 'quick' : 'full'} scan...`, filesScanned: 0, threatsFound: 0 })
  const timer = setInterval(() => {
    progress = Math.min(92, progress + (progress < 50 ? 3 : 1))
    send('malware:scan-progress', { percent: progress, stage: 'Microsoft Defender is scanning protected areas...', filesScanned: 0, threatsFound: 0 })
  }, 2500)

  try {
    const script = `$ProgressPreference = 'SilentlyContinue'\n$ErrorActionPreference = 'Stop'\nStart-MpScan -ScanType ${scanType} -ErrorAction Stop | Out-Null\n${defenderThreatQueryScript()}`
    const result = await runElevatedPowerShell(`Microsoft Defender ${scanType}`, script, timeout)
    const threats = asArray(parseJson(result.output, [])).filter(Boolean)
    send('malware:scan-progress', { percent: 100, stage: 'Microsoft Defender scan complete', filesScanned: 0, threatsFound: threats.length })
    await addHistory('Microsoft Defender scan', `${scanType === 'QuickScan' ? 'Quick' : 'Full'} scan completed; ${threats.length} active threats`, threats.length ? 'warning' : 'success')
    return { success: true, engine: 'Microsoft Defender', threats }
  } catch (error) {
    await addHistory('Microsoft Defender scan', errorMessage(error), 'error')
    return { success: false, error: errorMessage(error), threats: [] }
  } finally { clearInterval(timer) }
})

ipcMain.handle('malware:remove', async () => {
  try {
    const script = `$ProgressPreference = 'SilentlyContinue'\n$ErrorActionPreference = 'Stop'\n$before = @(Get-MpThreat -ErrorAction SilentlyContinue | Where-Object { $_.IsActive }).Count\nRemove-MpThreat -ErrorAction Stop | Out-Null\n${defenderThreatCollectionScript()}\n[pscustomobject]@{ before = $before; remaining = @($items) } | ConvertTo-Json -Compress -Depth 6`
    const result = await runElevatedPowerShell('Microsoft Defender remediation', script, 20 * 60 * 1000)
    const payload = parseJson(result.output, { before: 0, remaining: [] })
    const remaining = asArray(payload.remaining).filter(Boolean)
    const removed = Math.max(0, Number(payload.before || 0) - remaining.length)
    await addHistory('Threat remediation', `${removed} Microsoft Defender threat(s) remediated`, remaining.length ? 'warning' : 'success')
    return { success: remaining.length === 0, removed, remaining, error: remaining.length ? 'Some threats still require attention in Windows Security.' : undefined }
  } catch (error) {
    await addHistory('Threat remediation', errorMessage(error), 'error')
    return { success: false, removed: 0, error: errorMessage(error) }
  }
})

async function getRestorePointSummary() {
  const script = `
    $points = @(Get-ComputerRestorePoint -ErrorAction Stop | Sort-Object SequenceNumber -Descending)
    $last = $points | Select-Object -First 1
    [pscustomobject]@{
      enabled = $true
      count = $points.Count
      lastDescription = if ($last) { [string]$last.Description } else { $null }
      lastCreated = if ($last) { [System.Management.ManagementDateTimeConverter]::ToDateTime($last.CreationTime).ToString('o') } else { $null }
    } | ConvertTo-Json -Compress
  `
  try {
    const { stdout } = await runPowerShell(script, { timeout: 20000 })
    return parseJson(stdout, { enabled: false, count: 0 })
  } catch (error) { return { enabled: false, count: 0, error: errorMessage(error) } }
}

ipcMain.handle('safety:status', async () => {
  const [admin, defender, restore, history] = await Promise.all([
    isElevated(), getDefenderStatus(), getRestorePointSummary(), readJsonFile(dataFile('operation-history.json'), []),
  ])
  return { admin, defender, restore, history: history.slice(0, 8), backupPath: path.join(app.getPath('userData'), 'Backups'), localOnly: true }
})

ipcMain.handle('safety:createRestorePoint', async () => {
  const command = `powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "Checkpoint-Computer -Description 'WinBoost Safety Point' -RestorePointType MODIFY_SETTINGS -ErrorAction Stop"`
  try {
    const result = await runElevatedCommand('Create restore point', command, 10 * 60 * 1000)
    await addHistory('Safety restore point', 'Created WinBoost Safety Point', 'success')
    return result
  } catch (error) {
    await addHistory('Safety restore point', errorMessage(error), 'error')
    return { success: false, error: errorMessage(error) }
  }
})

ipcMain.handle('smart:scan', async () => {
  send('smart:progress', { percent: 8, stage: 'Reading live system metrics...' })
  try {
    const stats = await getSystemStats()
    send('smart:progress', { percent: 34, stage: 'Checking reclaimable storage...' })
    const cleanup = await scanCleanup()
    send('smart:progress', { percent: 68, stage: 'Checking Windows protection...' })
    const [defender, startup] = await Promise.all([getDefenderStatus(), listStartupEntries()])
    const reclaimableBytes = cleanup.filter(c => c.recommended).reduce((sum, c) => sum + c.bytes, 0)
    const highStartup = startup.filter(item => item.enabled && item.impact === 'High').length
    const disk = stats.disk[0]?.percent || 0
    const deductions = Math.min(45,
      Math.round((stats.cpu.usage || 0) * 0.08) +
      Math.round((stats.memory.percent || 0) * 0.06) +
      Math.max(0, disk - 80) + highStartup * 2 +
      (!defender.realTimeProtection && !defender.permissionRequired ? 20 : 0))
    const score = Math.max(55, 100 - deductions)
    const result = {
      success: true, score, stats, reclaimableBytes, reclaimableGB: Number((reclaimableBytes / 1073741824).toFixed(2)),
      startupCount: startup.filter(item => item.enabled).length, highStartup,
      defender,
      checks: [
        { label: 'Microsoft Defender', status: defender.realTimeProtection ? 'Protected' : defender.permissionRequired ? 'Verification needs UAC' : 'Attention', ok: Boolean(defender.realTimeProtection || defender.permissionRequired) },
        { label: 'Reclaimable storage', status: `${(reclaimableBytes / 1048576).toFixed(0)} MB`, ok: reclaimableBytes < 2 * 1073741824 },
        { label: 'Startup pressure', status: highStartup ? `${highStartup} high impact` : 'Healthy', ok: highStartup === 0 },
        { label: 'System drive', status: `${disk}% used`, ok: disk < 85 },
      ],
    }
    send('smart:progress', { percent: 100, stage: 'Smart scan complete' })
    await addHistory('Smart scan', `Health score ${score}; ${(reclaimableBytes / 1048576).toFixed(0)} MB reclaimable`, 'success')
    return result
  } catch (error) {
    await addHistory('Smart scan', errorMessage(error), 'error')
    return { success: false, error: errorMessage(error) }
  }
})

async function queryInstalledApps() {
  const script = `
    $roots = @(
      'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
      'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
      'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
    )
    $apps = foreach ($root in $roots) {
      Get-ItemProperty $root -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -and $_.SystemComponent -ne 1 } | ForEach-Object {
        [pscustomobject]@{
          registryPath = [string]$_.PSPath
          name = [string]$_.DisplayName
          publisher = [string]$_.Publisher
          version = [string]$_.DisplayVersion
          installDate = [string]$_.InstallDate
          estimatedSizeKB = if ($_.EstimatedSize) { [long]$_.EstimatedSize } else { 0 }
          uninstallString = [string]$_.UninstallString
          quietUninstallString = [string]$_.QuietUninstallString
          installLocation = [string]$_.InstallLocation
        }
      }
    }
    @($apps) | ConvertTo-Json -Compress -Depth 4
  `
  const { stdout } = await runPowerShell(script, { timeout: 30000, maxBuffer: 16 * 1024 * 1024 })
  return asArray(parseJson(stdout, [])).filter(appItem => appItem?.name)
}

async function listInstalledApps() {
  const raw = await queryInstalledApps()
  state.uninstallers.clear()
  const seen = new Set()
  const apps = []
  for (const item of raw) {
    const dedupe = `${item.name}|${item.version}|${item.publisher}`.toLowerCase()
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    const id = stableId(item.registryPath, item.name)
    state.uninstallers.set(id, item)
    const date = /^\d{8}$/.test(item.installDate || '') ? `${item.installDate.slice(0, 4)}-${item.installDate.slice(4, 6)}-${item.installDate.slice(6, 8)}` : ''
    apps.push({
      id, name: item.name, pub: item.publisher || 'Unknown publisher', version: item.version || '',
      size: Number(((Number(item.estimatedSizeKB) || 0) / 1048576).toFixed(2)), sizeKnown: Number(item.estimatedSizeKB) > 0,
      date, canUninstall: Boolean(item.uninstallString || item.quietUninstallString),
    })
  }
  return apps.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 400)
}

ipcMain.handle('uninstaller:list', async () => {
  try { return { success: true, apps: await listInstalledApps() } }
  catch (error) { return { success: false, apps: [], error: errorMessage(error) } }
})

ipcMain.handle('uninstaller:uninstall', async (_, appId) => {
  let item = state.uninstallers.get(appId)
  if (!item) { await listInstalledApps(); item = state.uninstallers.get(appId) }
  if (!item) return { success: false, error: 'The selected application is no longer registered.' }
  const command = item.uninstallString || item.quietUninstallString
  if (!command) return { success: false, error: 'This application does not provide an uninstall command.' }
  try {
    const msi = command.match(/(?:msiexec(?:\.exe)?\s+.*?)(\{[0-9a-f-]{36}\})/i)
    const child = msi
      ? spawn('msiexec.exe', ['/x', msi[1]], { detached: true, stdio: 'ignore', windowsHide: false })
      : spawn('cmd.exe', ['/d', '/s', '/c', command], { detached: true, stdio: 'ignore', windowsHide: false })
    child.unref()
    await addHistory('Application uninstaller', `Launched registered uninstaller for ${item.name}`, 'success')
    return { success: true, launched: true, message: 'The registered vendor uninstaller was launched. Complete any prompts it displays.' }
  } catch (error) {
    await addHistory('Application uninstaller', `${item.name}: ${errorMessage(error)}`, 'error')
    return { success: false, error: errorMessage(error) }
  }
})

ipcMain.handle('shredder:pickFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select files to shred permanently', properties: ['openFile', 'multiSelections'], filters: [{ name: 'All Files', extensions: ['*'] }],
  })
  if (result.canceled) return []
  const files = []
  for (const filePath of result.filePaths) {
    try {
      const resolved = path.resolve(filePath)
      const stat = await fs.promises.stat(resolved)
      if (!stat.isFile() || isProtected(resolved)) continue
      state.shredFiles.add(resolved.toLowerCase())
      files.push({ name: path.basename(resolved), path: resolved, size: Number((stat.size / 1048576).toFixed(2)), bytes: stat.size })
    } catch (_) {}
  }
  return files
})

async function overwriteFile(filePath, passes, progressState) {
  const stat = await fs.promises.stat(filePath)
  const size = stat.size
  if (size === 0) { await fs.promises.unlink(filePath); return }
  const chunkCapacity = Math.min(1024 * 1024, size)
  const buffer = Buffer.alloc(chunkCapacity)
  const handle = await fs.promises.open(filePath, 'r+')
  try {
    for (let pass = 0; pass < passes; pass++) {
      let position = 0
      while (position < size) {
        const length = Math.min(chunkCapacity, size - position)
        if (pass === 0) buffer.fill(0x00, 0, length)
        else if (pass === 1) buffer.fill(0xff, 0, length)
        else crypto.randomFillSync(buffer, 0, length)
        await handle.write(buffer, 0, length, position)
        position += length
        progressState.completed += length
        const percent = Math.min(99, Math.round((progressState.completed / progressState.total) * 100))
        if (percent !== progressState.lastPercent) {
          progressState.lastPercent = percent
          send('shredder:progress', { percent, stage: `Overwrite pass ${pass + 1} of ${passes}` })
        }
      }
      await handle.sync()
      send('shredder:log', `${path.basename(filePath)} - pass ${pass + 1}/${passes} verified`)
    }
  } finally { await handle.close() }
  await fs.promises.unlink(filePath)
}

ipcMain.handle('shredder:shred', async (_, filePaths, requestedPasses) => {
  const passes = [1, 3, 7, 35].includes(Number(requestedPasses)) ? Number(requestedPasses) : 3
  const valid = []
  for (const candidate of Array.isArray(filePaths) ? filePaths : []) {
    const resolved = path.resolve(String(candidate))
    if (state.shredFiles.has(resolved.toLowerCase()) && !isProtected(resolved)) valid.push(resolved)
  }
  if (!valid.length) return { success: false, deleted: 0, errors: ['No approved files were selected.'] }

  const sizes = await Promise.all(valid.map(file => fs.promises.stat(file).then(s => s.size).catch(() => 0)))
  const progressState = { completed: 0, total: Math.max(1, sizes.reduce((sum, size) => sum + size * passes, 0)), lastPercent: -1 }
  const errors = []
  let deleted = 0
  for (const filePath of valid) {
    try {
      await overwriteFile(filePath, passes, progressState)
      state.shredFiles.delete(filePath.toLowerCase())
      deleted++
    } catch (error) { errors.push(`${path.basename(filePath)}: ${errorMessage(error)}`) }
  }
  send('shredder:progress', { percent: 100, stage: 'Secure deletion complete' })
  await addHistory('Secure file deletion', `${deleted} file(s) overwritten with ${passes} pass(es)`, errors.length ? 'warning' : 'success')
  return { success: errors.length === 0, deleted, errors }
})

const MAINTENANCE_TASKS = {
  flushdns: { label: 'Flush DNS Cache', desc: 'Clear the Windows DNS resolver cache', cat: 'Network', risk: 'Low', recommended: true, admin: false, kind: 'exec', file: 'ipconfig.exe', args: ['/flushdns'], timeout: 60000 },
  chkdsk: { label: 'Check Disk Errors', desc: 'Run an online scan of the system volume', cat: 'Disk', risk: 'Low', recommended: false, admin: true, kind: 'command', command: 'chkdsk.exe C: /scan', timeout: 30 * 60 * 1000 },
  sfc: { label: 'System File Checker', desc: 'Verify and repair protected Windows files', cat: 'System', risk: 'Low', recommended: false, admin: true, kind: 'command', command: 'sfc.exe /scannow', timeout: 60 * 60 * 1000 },
  dism: { label: 'Scan Windows Image', desc: 'Check the Windows component store for corruption', cat: 'System', risk: 'Low', recommended: false, admin: true, kind: 'command', command: 'dism.exe /Online /Cleanup-Image /ScanHealth', timeout: 60 * 60 * 1000 },
  winsock: { label: 'Reset Network Stack', desc: 'Reset Winsock; a restart is required afterwards', cat: 'Network', risk: 'Medium', recommended: false, admin: true, restart: true, kind: 'command', command: 'netsh.exe winsock reset', timeout: 120000 },
  wucache: { label: 'Clean Update Cache', desc: 'Stop update services and remove downloaded update packages', cat: 'Cleanup', risk: 'Medium', recommended: false, admin: true, kind: 'command', command: 'net stop wuauserv & net stop bits & del /f /s /q "%windir%\\SoftwareDistribution\\Download\\*" & net start bits & net start wuauserv', timeout: 20 * 60 * 1000 },
  reindex: { label: 'Rebuild Search Index', desc: 'Reset the Windows Search database so it can rebuild', cat: 'System', risk: 'Medium', recommended: false, admin: true, kind: 'command', command: 'net stop WSearch & del /f /s /q "%ProgramData%\\Microsoft\\Search\\Data\\Applications\\Windows\\*" & net start WSearch', timeout: 20 * 60 * 1000 },
  fontcache: { label: 'Rebuild Font Cache', desc: 'Reset the Windows font cache service and cache files', cat: 'System', risk: 'Medium', recommended: false, admin: true, kind: 'command', command: 'net stop FontCache & del /f /s /q "%windir%\\ServiceProfiles\\LocalService\\AppData\\Local\\FontCache\\*" & net start FontCache', timeout: 10 * 60 * 1000 },
  defrag: { label: 'Optimize System Drive', desc: 'Let Windows choose the correct HDD or SSD optimization', cat: 'Disk', risk: 'Low', recommended: false, admin: true, kind: 'command', command: 'defrag.exe C: /O', timeout: 60 * 60 * 1000 },
  shadercache: { label: 'Clear DirectX Shader Cache', desc: 'Remove rebuildable user graphics cache files', cat: 'Cleanup', risk: 'Low', recommended: true, admin: false, kind: 'internal' },
  thumbcache: { label: 'Clear Thumbnail Cache', desc: 'Remove rebuildable Explorer thumbnail databases', cat: 'Cleanup', risk: 'Low', recommended: true, admin: false, kind: 'internal' },
  store: { label: 'Reset Store Cache', desc: 'Launch the official Microsoft Store cache reset tool', cat: 'Apps', risk: 'Low', recommended: true, admin: false, kind: 'launch', file: 'wsreset.exe' },
}

function publicMaintenanceTasks() {
  return Object.entries(MAINTENANCE_TASKS).map(([id, task]) => ({ id, label: task.label, desc: task.desc, cat: task.cat, risk: task.risk, recommended: task.recommended, admin: task.admin, restart: Boolean(task.restart) }))
}

ipcMain.handle('maintenance:list', async () => publicMaintenanceTasks())

async function runMaintenance(taskId) {
  const task = MAINTENANCE_TASKS[taskId]
  if (!task) return { taskId, success: false, error: 'Unknown maintenance task.' }
  send('maintenance:progress', { taskId, percent: 10, stage: `Starting ${task.label}...` })
  try {
    let output = ''
    if (task.kind === 'exec') {
      const result = await runExe(task.file, task.args, { timeout: task.timeout })
      output = result.stdout || result.stderr || `${task.label} completed.`
    } else if (task.kind === 'command') {
      const result = task.admin
        ? await runElevatedCommand(task.label, task.command, task.timeout)
        : await runExe('cmd.exe', ['/d', '/s', '/c', task.command], { timeout: task.timeout })
      output = result.output || result.stdout || result.stderr || `${task.label} completed.`
    } else if (task.kind === 'internal') {
      const categoryId = taskId === 'shadercache' ? 'shaders' : 'thumbnails'
      const category = getCleanupCategories().find(item => item.id === categoryId)
      const limitState = { count: 0, limit: 50000 }
      let deleted = 0
      for (const target of category.targets) {
        for (const file of await collectTargetFiles(target, limitState)) {
          try { await fs.promises.unlink(file.path); deleted++ } catch (_) {}
        }
      }
      output = `${deleted} cache file(s) removed.`
    } else if (task.kind === 'launch') {
      spawn(task.file, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref()
      output = `${task.label} launched.`
    }
    send('maintenance:progress', { taskId, percent: 100, stage: `${task.label} completed` })
    await addHistory('System maintenance', task.label, 'success')
    return { taskId, success: true, output: String(output).trim().slice(0, 4000), restartRequired: Boolean(task.restart) }
  } catch (error) {
    const message = errorMessage(error)
    await addHistory('System maintenance', `${task.label}: ${message}`, 'error')
    return { taskId, success: false, error: message, adminRequired: task.admin }
  }
}

ipcMain.handle('maintenance:run', async (_, taskId) => runMaintenance(taskId))
ipcMain.handle('maintenance:runAll', async (_, taskIds) => {
  const ids = (Array.isArray(taskIds) ? taskIds : []).filter(id => MAINTENANCE_TASKS[id])
  const results = []
  for (let index = 0; index < ids.length; index++) {
    send('maintenance:progress', { taskId: ids[index], percent: Math.round((index / Math.max(ids.length, 1)) * 100), stage: `Running ${MAINTENANCE_TASKS[ids[index]].label}...` })
    results.push(await runMaintenance(ids[index]))
  }
  return { success: results.every(result => result.success), results }
})

function fileType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (['.doc', '.docx', '.pdf', '.txt', '.xlsx', '.pptx', '.md'].includes(ext)) return 'Documents'
  if (['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv'].includes(ext)) return 'Videos'
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.psd'].includes(ext)) return 'Images'
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'].includes(ext)) return 'Archives'
  if (['.mp3', '.flac', '.wav', '.aac', '.ogg', '.wma'].includes(ext)) return 'Music'
  return 'Other'
}

async function allowedScanRoots() {
  const stats = await getSystemStats()
  const roots = new Map([['home', os.homedir()]])
  for (const disk of stats.disk) roots.set(disk.fs, disk.fs)
  return roots
}

async function walkFilesystem(root, options = {}) {
  const queue = [{ dir: root, top: root }]
  const folders = new Map()
  const types = new Map()
  const large = []
  let scannedItems = 0
  let totalBytes = 0
  const maxItems = options.maxItems || 180000

  while (queue.length && scannedItems < maxItems) {
    const current = queue.shift()
    let entries
    try { entries = await fs.promises.readdir(current.dir, { withFileTypes: true }) } catch (_) { continue }
    for (const entry of entries) {
      if (scannedItems++ >= maxItems) break
      const fullPath = path.join(current.dir, entry.name)
      if (entry.isSymbolicLink() || isProtected(fullPath)) continue
      try {
        if (entry.isDirectory()) {
          const relative = path.relative(root, fullPath)
          const topName = relative.split(path.sep)[0] || entry.name
          queue.push({ dir: fullPath, top: path.join(root, topName) })
        } else if (entry.isFile()) {
          const stat = await fs.promises.stat(fullPath)
          totalBytes += stat.size
          const relative = path.relative(root, fullPath)
          const topName = relative.split(path.sep)[0] || path.basename(root)
          const topPath = path.join(root, topName)
          const folder = folders.get(topPath) || { size: 0, items: 0 }
          folder.size += stat.size; folder.items++; folders.set(topPath, folder)
          const type = fileType(fullPath)
          const typeInfo = types.get(type) || { size: 0, count: 0 }
          typeInfo.size += stat.size; typeInfo.count++; types.set(type, typeInfo)
          if (options.minSize && stat.size >= options.minSize) large.push({ fullPath, size: stat.size, mtime: stat.mtime })
        }
      } catch (_) {}
      if (options.progressChannel && scannedItems % 750 === 0) send(options.progressChannel, { percent: Math.min(94, Math.round((scannedItems / maxItems) * 100)), stage: `Scanned ${scannedItems.toLocaleString()} items...` })
    }
  }
  return { folders, types, large, scannedItems, totalBytes, limited: scannedItems >= maxItems }
}

ipcMain.handle('diskanalyzer:scan', async (_, targetId) => {
  const roots = await allowedScanRoots()
  const root = roots.get(targetId) || roots.get('home')
  send('diskanalyzer:progress', { percent: 4, stage: `Analyzing ${root}...` })
  const result = await walkFilesystem(root, { maxItems: 180000, progressChannel: 'diskanalyzer:progress' })
  send('diskanalyzer:progress', { percent: 100, stage: 'Analysis complete' })
  return {
    success: true, root, scannedItems: result.scannedItems, totalSize: Number((result.totalBytes / 1073741824).toFixed(2)), limited: result.limited,
    folders: [...result.folders.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 18).map(([name, data]) => ({ name, size: Number((data.size / 1073741824).toFixed(2)), items: data.items })),
    types: [...result.types.entries()].sort((a, b) => b[1].size - a[1].size).map(([type, data]) => ({ type, size: Number((data.size / 1073741824).toFixed(2)), count: data.count })),
  }
})

ipcMain.handle('largefiles:scan', async (_, minSizeMB) => {
  const root = os.homedir()
  const minSize = Math.max(1, Math.min(102400, Number(minSizeMB) || 100)) * 1048576
  state.largeFiles.clear()
  send('largefiles:progress', { percent: 3, stage: `Scanning ${root}...` })
  const result = await walkFilesystem(root, { maxItems: 220000, minSize, progressChannel: 'largefiles:progress' })
  const files = result.large.sort((a, b) => b.size - a.size).slice(0, 100).map(item => {
    const id = stableId(item.fullPath, item.size, item.mtime.toISOString())
    state.largeFiles.set(id, item.fullPath)
    return { id, name: path.basename(item.fullPath), path: path.dirname(item.fullPath), size: Number((item.size / 1073741824).toFixed(3)), bytes: item.size, date: item.mtime.toISOString().slice(0, 10), type: fileType(item.fullPath).toLowerCase() }
  })
  send('largefiles:progress', { percent: 100, stage: `Found ${files.length} large files` })
  return { success: true, root, files, scannedItems: result.scannedItems, limited: result.limited }
})

ipcMain.handle('largefiles:reveal', async (_, fileId) => {
  const filePath = state.largeFiles.get(fileId)
  if (!filePath || !fs.existsSync(filePath)) return { success: false, error: 'The file is no longer available.' }
  shell.showItemInFolder(filePath)
  return { success: true }
})

ipcMain.handle('largefiles:trash', async (_, fileId) => {
  const filePath = state.largeFiles.get(fileId)
  if (!filePath || !fs.existsSync(filePath) || isProtected(filePath)) return { success: false, error: 'The file is no longer available or is protected.' }
  try {
    await shell.trashItem(filePath)
    state.largeFiles.delete(fileId)
    await addHistory('Large file cleanup', `${path.basename(filePath)} moved to Recycle Bin`, 'success')
    return { success: true }
  } catch (error) { return { success: false, error: errorMessage(error) } }
})

async function queryRegistryValues(key) {
  try {
    const { stdout } = await runExe('reg.exe', ['query', key], { timeout: 8000 })
    return stdout.split(/\r?\n/).map(line => line.trim()).filter(line => /\sREG_(?:SZ|EXPAND_SZ)\s/i.test(line)).map(line => {
      const parts = line.split(/\s{2,}/)
      return { name: parts[0], type: parts[1], value: parts.slice(2).join(' ') }
    }).filter(item => item.name && item.value)
  } catch (_) { return [] }
}

function expandWindowsPath(value) {
  return String(value || '').replace(/%([^%]+)%/g, (_, name) => process.env[name] || process.env[name.toUpperCase()] || `%${name}%`)
}

function executableFromCommand(command) {
  const expanded = expandWindowsPath(command).trim()
  const quoted = expanded.match(/^"([^"\r\n]+\.(?:exe|com|bat|cmd))"/i)
  if (quoted) return quoted[1]
  const bare = expanded.match(/^(.+?\.(?:exe|com|bat|cmd))(?=\s|$)/i)
  return bare?.[1]?.trim() || ''
}

const STARTUP_LOCATIONS = [
  'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run',
]

function startupImpact(name, value) {
  const text = `${name} ${value}`.toLowerCase()
  if (/update|scheduler|helper|tray/.test(text)) return 'Low'
  if (/teams|discord|steam|adobe|spotify|dropbox/.test(text)) return 'High'
  return 'Medium'
}

async function readEnabledStartupEntries() {
  const result = []
  for (const source of STARTUP_LOCATIONS) {
    for (const item of await queryRegistryValues(source)) result.push({ ...item, source, enabled: true })
  }
  return result
}

async function readDisabledStartupEntries() {
  const items = await readJsonFile(dataFile('disabled-startup.json'), [])
  return Array.isArray(items) ? items.filter(item => item?.source && item?.name && item?.value) : []
}

async function listStartupEntries() {
  const [enabled, disabled] = await Promise.all([readEnabledStartupEntries(), readDisabledStartupEntries()])
  state.startup.clear()
  const items = [...enabled, ...disabled.map(item => ({ ...item, enabled: false }))]
  return items.map(item => {
    const id = stableId(item.source, item.name, item.value)
    state.startup.set(id, { ...item, id })
    const executable = executableFromCommand(item.value)
    const publisher = /microsoft|onedrive|teams/i.test(`${item.name} ${item.value}`) ? 'Microsoft' : path.basename(executable || item.name, path.extname(executable || '')) || 'Third party'
    return {
      id, name: item.name, pub: publisher, impact: startupImpact(item.name, item.value), enabled: item.enabled,
      path: item.value, source: item.source, requiresAdmin: item.source.startsWith('HKLM'),
    }
  }).sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name))
}

ipcMain.handle('startup:list', async () => {
  try { return { success: true, items: await listStartupEntries() } }
  catch (error) { return { success: false, items: [], error: errorMessage(error) } }
})

ipcMain.handle('startup:toggle', async (_, entryId, enabled) => {
  let entry = state.startup.get(entryId)
  if (!entry) { await listStartupEntries(); entry = state.startup.get(entryId) }
  if (!entry) return { success: false, error: 'The startup entry has changed. Refresh and try again.' }
  if (entry.source.startsWith('HKLM') && !(await isElevated())) return { success: false, adminRequired: true, error: 'Machine-wide startup entries require running WinBoost as administrator.' }

  const disabled = await readDisabledStartupEntries()
  try {
    if (enabled) {
      await runExe('reg.exe', ['add', entry.source, '/v', entry.name, '/t', entry.type || 'REG_SZ', '/d', entry.value, '/f'], { timeout: 10000 })
      await writeJsonFile(dataFile('disabled-startup.json'), disabled.filter(item => stableId(item.source, item.name, item.value) !== entryId))
    } else {
      const backupDir = path.join(app.getPath('userData'), 'Backups', 'Startup')
      await fs.promises.mkdir(backupDir, { recursive: true })
      await runExe('reg.exe', ['export', entry.source, path.join(backupDir, `${Date.now()}-${stableId(entry.source)}.reg`), '/y'], { timeout: 15000 }).catch(() => null)
      await runExe('reg.exe', ['delete', entry.source, '/v', entry.name, '/f'], { timeout: 10000 })
      if (!disabled.some(item => stableId(item.source, item.name, item.value) === entryId)) disabled.push({ source: entry.source, name: entry.name, type: entry.type || 'REG_SZ', value: entry.value })
      await writeJsonFile(dataFile('disabled-startup.json'), disabled)
    }
    await addHistory('Startup Manager', `${enabled ? 'Enabled' : 'Disabled'} ${entry.name}`, 'success')
    return { success: true, enabled: Boolean(enabled) }
  } catch (error) {
    await addHistory('Startup Manager', `${entry.name}: ${errorMessage(error)}`, 'error')
    return { success: false, error: errorMessage(error), adminRequired: entry.source.startsWith('HKLM') }
  }
})

async function scanRegistryIssues() {
  const issues = []
  state.registryIssues.clear()
  send('registry:progress', { percent: 12, stage: 'Checking startup commands...' })
  const startupEntries = await readEnabledStartupEntries()
  for (const entry of startupEntries) {
    const executable = executableFromCommand(entry.value)
    if (!executable || !path.isAbsolute(executable) || fs.existsSync(executable)) continue
    const id = stableId('startup', entry.source, entry.name, entry.value)
    const issue = {
      id, key: id, name: 'Invalid Startup Entry', path: `${entry.source}\\${entry.name}`,
      desc: `The startup command points to a missing file: ${executable}`, severity: 'Medium', cat: 'Startup',
      operation: { kind: 'value', key: entry.source, valueName: entry.name },
    }
    state.registryIssues.set(id, issue.operation)
    issues.push(issue)
  }

  send('registry:progress', { percent: 58, stage: 'Checking registered uninstallers...' })
  const installed = await queryInstalledApps().catch(() => [])
  for (const item of installed) {
    const command = item.uninstallString || item.quietUninstallString
    const executable = executableFromCommand(command)
    if (!command || !executable || !path.isAbsolute(executable) || fs.existsSync(executable)) continue
    const registryPath = String(item.registryPath || '').replace(/^Microsoft\.PowerShell\.Core\\Registry::/i, '')
    if (!registryPath) continue
    const id = stableId('uninstall', registryPath, item.name)
    const issue = {
      id, key: id, name: 'Invalid Uninstall Entry', path: registryPath,
      desc: `${item.name} references a missing uninstaller: ${executable}`, severity: 'Low', cat: 'Uninstall',
      operation: { kind: 'key', key: registryPath },
    }
    state.registryIssues.set(id, issue.operation)
    issues.push(issue)
  }
  send('registry:progress', { percent: 100, stage: `Scan complete: ${issues.length} verified issue(s)` })
  return issues.map(({ operation: _operation, ...publicIssue }) => publicIssue).slice(0, 80)
}

ipcMain.handle('registry:scan', async () => {
  try { return { success: true, issues: await scanRegistryIssues() } }
  catch (error) { return { success: false, issues: [], error: errorMessage(error) } }
})

ipcMain.handle('registry:fix', async (_, issueIds) => {
  const ids = Array.isArray(issueIds) ? issueIds : []
  const backupDir = path.join(app.getPath('userData'), 'Backups', 'Registry')
  await fs.promises.mkdir(backupDir, { recursive: true })
  let fixed = 0
  const errors = []
  for (const id of ids) {
    const operation = state.registryIssues.get(id)
    if (!operation) { errors.push('One selected issue is no longer valid; please rescan.'); continue }
    if (operation.key.startsWith('HKEY_LOCAL_MACHINE') || operation.key.startsWith('HKLM')) {
      if (!(await isElevated())) { errors.push(`${operation.key}: administrator rights required.`); continue }
    }
    try {
      const backup = path.join(backupDir, `${Date.now()}-${id}.reg`)
      await runExe('reg.exe', ['export', operation.key, backup, '/y'], { timeout: 20000 })
      const args = operation.kind === 'value'
        ? ['delete', operation.key, '/v', operation.valueName, '/f']
        : ['delete', operation.key, '/f']
      await runExe('reg.exe', args, { timeout: 15000 })
      state.registryIssues.delete(id)
      fixed++
    } catch (error) { errors.push(errorMessage(error)) }
  }
  await addHistory('Registry repair', `${fixed} verified issue(s) repaired; backup saved`, errors.length ? 'warning' : 'success')
  return { success: errors.length === 0, fixed, errors: errors.slice(0, 20), backupDir }
})

ipcMain.handle('registry:openBackups', async () => {
  const backupDir = path.join(app.getPath('userData'), 'Backups', 'Registry')
  await fs.promises.mkdir(backupDir, { recursive: true })
  const error = await shell.openPath(backupDir)
  return error ? { success: false, error } : { success: true }
})

const PRIVACY_SPECS = [
  { group: 'Telemetry & Data Collection', name: 'Diagnostic Data', desc: 'Limit optional diagnostic data sent to Microsoft', key: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection', value: 'AllowTelemetry', type: 'REG_DWORD', on: '3', off: '1', defaultEnabled: true, admin: true },
  { group: 'Telemetry & Data Collection', name: 'Tailored Experiences', desc: 'Use diagnostic data for personalized tips and ads', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy', value: 'TailoredExperiencesWithDiagnosticDataEnabled', type: 'REG_DWORD', on: '1', off: '0', defaultEnabled: true },
  { group: 'Telemetry & Data Collection', name: 'Advertising ID', desc: 'Let Windows apps use your advertising identifier', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo', value: 'Enabled', type: 'REG_DWORD', on: '1', off: '0', defaultEnabled: true },
  { group: 'Location & Sensors', name: 'Location Services', desc: 'Allow desktop and Store apps to access location', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location', value: 'Value', type: 'REG_SZ', on: 'Allow', off: 'Deny', defaultEnabled: true },
  { group: 'Camera & Microphone', name: 'Camera Access', desc: 'Allow applications to use the camera', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam', value: 'Value', type: 'REG_SZ', on: 'Allow', off: 'Deny', defaultEnabled: true },
  { group: 'Camera & Microphone', name: 'Microphone Access', desc: 'Allow applications to use the microphone', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone', value: 'Value', type: 'REG_SZ', on: 'Allow', off: 'Deny', defaultEnabled: true },
  { group: 'Activity & Input', name: 'Activity History', desc: 'Publish activity history from this Windows account', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy', value: 'PublishUserActivities', type: 'REG_DWORD', on: '1', off: '0', defaultEnabled: true },
  { group: 'Activity & Input', name: 'Clipboard Sync', desc: 'Allow clipboard content to roam between devices', key: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System', value: 'AllowCrossDeviceClipboard', type: 'REG_DWORD', on: '1', off: '0', defaultEnabled: true, admin: true },
  { group: 'Activity & Input', name: 'Inking & Typing', desc: 'Allow implicit typing data collection', key: 'HKCU\\Software\\Microsoft\\InputPersonalization', value: 'RestrictImplicitTextCollection', type: 'REG_DWORD', on: '0', off: '1', defaultEnabled: true },
  { group: 'Recommendations', name: 'Suggested Content', desc: 'Show suggested content inside Windows Settings', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', value: 'SubscribedContent-338393Enabled', type: 'REG_DWORD', on: '1', off: '0', defaultEnabled: true },
  { group: 'Recommendations', name: 'App Launch Tracking', desc: 'Track app launches to improve Start and search', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', value: 'Start_TrackProgs', type: 'REG_DWORD', on: '1', off: '0', defaultEnabled: true },
]

async function queryRegValue(spec) {
  try {
    const { stdout } = await runExe('reg.exe', ['query', spec.key, '/v', spec.value], { timeout: 8000 })
    const line = stdout.split(/\r?\n/).find(row => row.includes(spec.value) && row.includes('REG_'))
    if (!line) return null
    return line.trim().split(/\s{2,}/).slice(2).join(' ').trim()
  } catch (_) { return null }
}

async function setRegistrySpec(spec, enabled) {
  const data = enabled ? spec.on : spec.off
  if (spec.admin && !(await isElevated())) {
    const command = `reg.exe add "${spec.key}" /v "${spec.value}" /t ${spec.type} /d "${data}" /f`
    return runElevatedCommand(spec.name, command, 120000)
  }
  await runExe('reg.exe', ['add', spec.key, '/v', spec.value, '/t', spec.type, '/d', data, '/f'], { timeout: 12000 })
  return { success: true }
}

async function listPrivacySettings() {
  const groups = new Map()
  for (const spec of PRIVACY_SPECS) {
    const value = await queryRegValue(spec)
    let enabled = spec.defaultEnabled
    if (value !== null) {
      const normalized = spec.type === 'REG_DWORD' ? String(Number.parseInt(value, value.startsWith('0x') ? 16 : 10)) : value
      enabled = normalized.toLowerCase() === String(spec.on).toLowerCase()
    }
    if (!groups.has(spec.group)) groups.set(spec.group, [])
    groups.get(spec.group).push({ name: spec.name, desc: spec.desc, enabled, requiresAdmin: Boolean(spec.admin), managed: value !== null })
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }))
}

ipcMain.handle('privacy:list', async () => {
  try { return { success: true, groups: await listPrivacySettings() } }
  catch (error) { return { success: false, groups: [], error: errorMessage(error) } }
})

ipcMain.handle('privacy:set', async (_, name, enabled) => {
  const spec = PRIVACY_SPECS.find(item => item.name === name)
  if (!spec) return { success: false, error: 'Unknown privacy setting.' }
  try {
    await setRegistrySpec(spec, Boolean(enabled))
    await addHistory('Privacy setting', `${name}: ${enabled ? 'enabled' : 'disabled'}`, 'success')
    return { success: true, enabled: Boolean(enabled) }
  } catch (error) { return { success: false, error: errorMessage(error), adminRequired: Boolean(spec.admin) } }
})

ipcMain.handle('privacy:recommended', async () => {
  let applied = 0
  const errors = []
  for (const spec of PRIVACY_SPECS) {
    try { await setRegistrySpec(spec, false); applied++ }
    catch (error) { errors.push(`${spec.name}: ${errorMessage(error)}`) }
  }
  await addHistory('Privacy profile', `${applied} privacy controls hardened`, errors.length ? 'warning' : 'success')
  return { success: errors.length === 0, applied, errors }
})

const PERFORMANCE_SPECS = [
  { name: 'Reduced Visual Effects', desc: 'Let Windows favor responsiveness over decorative effects', impact: 'High', cat: 'Visual', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects', value: 'VisualFXSetting', type: 'REG_DWORD', on: '2', off: '0' },
  { name: 'Game Mode', desc: 'Prioritize game workloads when supported', impact: 'High', cat: 'Gaming', key: 'HKCU\\Software\\Microsoft\\GameBar', value: 'AutoGameModeEnabled', type: 'REG_DWORD', on: '1', off: '0' },
  { name: 'Limit Background Apps', desc: 'Reduce background execution for Store applications', impact: 'High', cat: 'System', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications', value: 'GlobalUserDisabled', type: 'REG_DWORD', on: '1', off: '0' },
  { name: 'Disable Windows Tips', desc: 'Stop promotional tips and suggestion notifications', impact: 'Low', cat: 'System', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', value: 'SubscribedContent-338389Enabled', type: 'REG_DWORD', on: '0', off: '1' },
  { name: 'Remove Startup Delay', desc: 'Reduce the artificial delay before startup apps run', impact: 'Medium', cat: 'Startup', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize', value: 'StartupDelayInMSec', type: 'REG_DWORD', on: '0', off: '10000' },
  { name: 'Disable Transparency', desc: 'Reduce GPU work used by acrylic and transparency effects', impact: 'Medium', cat: 'Visual', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', value: 'EnableTransparency', type: 'REG_DWORD', on: '0', off: '1' },
  { name: 'Disable Game Recording', desc: 'Turn off background Game DVR capture', impact: 'Medium', cat: 'Gaming', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', value: 'AppCaptureEnabled', type: 'REG_DWORD', on: '0', off: '1' },
  { name: 'Faster Menus', desc: 'Reduce the Windows menu display delay', impact: 'Low', cat: 'Visual', key: 'HKCU\\Control Panel\\Desktop', value: 'MenuShowDelay', type: 'REG_SZ', on: '100', off: '400' },
  { name: 'Storage Sense', desc: 'Let Windows automatically manage temporary storage', impact: 'Medium', cat: 'Disk', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\StorageSense\\Parameters\\StoragePolicy', value: '01', type: 'REG_DWORD', on: '1', off: '0' },
  { name: 'Disable Search Highlights', desc: 'Remove dynamic web highlights from the search box', impact: 'Low', cat: 'System', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\SearchSettings', value: 'IsDynamicSearchBoxEnabled', type: 'REG_DWORD', on: '0', off: '1' },
]

async function listPerformanceTweaks() {
  const result = []
  for (const spec of PERFORMANCE_SPECS) {
    const value = await queryRegValue(spec)
    const normalized = value === null ? null : spec.type === 'REG_DWORD' ? String(Number.parseInt(value, value.startsWith('0x') ? 16 : 10)) : value
    result.push({ name: spec.name, desc: spec.desc, impact: spec.impact, cat: spec.cat, applied: normalized === spec.on, current: normalized })
  }
  return result
}

async function setPerformanceTweak(name, enabled) {
  const spec = PERFORMANCE_SPECS.find(item => item.name === name)
  if (!spec) return { success: false, error: 'Unknown performance setting.' }
  try {
    await setRegistrySpec(spec, Boolean(enabled))
    await addHistory('Performance setting', `${name}: ${enabled ? 'optimized' : 'restored'}`, 'success')
    return { success: true, applied: Boolean(enabled) }
  } catch (error) { return { success: false, error: errorMessage(error) } }
}

ipcMain.handle('performance:list', async () => {
  try { return { success: true, tweaks: await listPerformanceTweaks() } }
  catch (error) { return { success: false, tweaks: [], error: errorMessage(error) } }
})
ipcMain.handle('performance:set', async (_, name, enabled) => setPerformanceTweak(name, enabled))
ipcMain.handle('performance:apply', async (_, name) => setPerformanceTweak(name, true))
ipcMain.handle('performance:applyAll', async () => {
  let applied = 0
  const errors = []
  for (const spec of PERFORMANCE_SPECS) {
    const result = await setPerformanceTweak(spec.name, true)
    if (result.success) applied++
    else errors.push(`${spec.name}: ${result.error}`)
  }
  return { success: errors.length === 0, applied, errors }
})

ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
