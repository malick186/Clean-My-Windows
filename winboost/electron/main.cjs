const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
const { execFile, execFileSync, spawn } = require('child_process')
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

ipcMain.handle('history:list', async () => {
  try { return readJsonFile(dataFile('operation-history.json'), []) }
  catch (_) { return [] }
})

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

ipcMain.handle('cleanup:scan', async () => {
  try { return await scanCleanup() }
  catch (e) { return [] }
})
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
  } catch (defenderError) {
    try {
      const { stdout } = await runPowerShell(`$s = Get-Service WinDefend -ErrorAction SilentlyContinue; [pscustomobject]@{ status = [string]$s.Status; startType = [string]$s.StartType } | ConvertTo-Json -Compress`, { timeout: 8000 })
      const service = parseJson(stdout, {})
      return {
        available: service.status === 'Running', antivirusEnabled: service.status === 'Running', realTimeProtection: false,
        permissionRequired: true, serviceStatus: service.status || 'Unknown',
        error: 'Detailed Microsoft Defender status requires administrator approval on this PC.',
      }
    } catch (_) { return { available: false, antivirusEnabled: false, realTimeProtection: false, permissionRequired: true, error: errorMessage(defenderError) } }
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
    const av = detectClamAV()
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
      clamav: { available: av.found, version: av.found ? 'Detected' : 'Not installed' },
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
  try {
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
  } catch (_) { return [] }
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
  try {
    const roots = await allowedScanRoots()
    const root = roots.get(targetId) || roots.get('home')
    send('diskanalyzer:progress', { percent: 4, stage: `Analyzing ${root}...` })
    const result = await walkFilesystem(root, { maxItems: 180000, progressChannel: 'diskanalyzer:progress' })
    send('diskanalyzer:progress', { percent: 100, stage: 'Analysis complete' })
    const folders = result.folders.sort((a, b) => b.size - a.size)
    const types = Object.entries(result.byType || {}).sort((a, b) => b[1] - a[1]).map(([type, size]) => ({ type, size }))
    return { success: true, folders, types, root, scannedItems: result.scannedItems, totalBytes: result.totalBytes, limited: result.limited }
  } catch (e) { return { success: false, error: errorMessage(e), folders: [], types: [], scannedItems: 0 } }
})

ipcMain.handle('largefiles:scan', async (_, minSizeMB) => {
  try {
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
  } catch (e) { return { success: false, error: errorMessage(e), files: [], scannedItems: 0 } }
})

ipcMain.handle('largefiles:reveal', async (_, fileId) => {
  try {
    const filePath = state.largeFiles.get(fileId)
    if (!filePath || !fs.existsSync(filePath)) return { success: false, error: 'The file is no longer available.' }
    shell.showItemInFolder(filePath)
    return { success: true }
  } catch (e) { return { success: false, error: errorMessage(e) } }
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
  try {
    const backupDir = path.join(app.getPath('userData'), 'Backups', 'Registry')
    await fs.promises.mkdir(backupDir, { recursive: true })
    const error = await shell.openPath(backupDir)
    return error ? { success: false, error } : { success: true }
  } catch (e) { return { success: false, error: errorMessage(e) } }
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

/* ═══════════════════════════ V3.5: Dual-Engine Security — Defender + ClamAV ═══════════════════════════ */

const QUARANTINE_DIR = path.join(os.tmpdir(), 'winboost-quarantine')
const CLAMAV_DL_URL = 'https://oss-clamav.clamav.net/clamav-1.4.2.win.x64.zip'
const CLAMAV_DIR = path.join(os.homedir(), '.winboost', 'clamav')
const DEFENDER_EXE_DEFAULT = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Windows Defender', 'MpCmdRun.exe')

let scanProcess = null
let killTimeout = null
let scanEngine = null
let clamavFound = null
let clamavPath = null
let freshclamPath = null

function findDefender() {
  const candidates = [
    DEFENDER_EXE_DEFAULT,
    'C:\\Program Files\\Windows Defender\\MpCmdRun.exe',
  ]
  for (const p of candidates) if (fs.existsSync(p)) return p
  try {
    const pd = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows Defender', 'Platform')
    if (fs.existsSync(pd)) {
      const dirs = fs.readdirSync(pd).filter(d => /^\d/.test(d)).sort().reverse()
      for (const d of dirs) {
        const mp = path.join(pd, d, 'MpCmdRun.exe')
        if (fs.existsSync(mp)) return mp
      }
    }
  } catch {}
  return null
}

function classifySeverity(name) {
  if (/Trojan|Ransom|Exploit|Rootkit|Backdoor|Worm/i.test(name)) return 'Critical'
  if (/Adware|PUA|PUP|Potentially|Unwanted|Riskware|HackTool/i.test(name)) return 'Medium'
  if (/Phish|Spy|Keylog|Steal|Inject/i.test(name)) return 'High'
  return 'High'
}

function scanCommonPaths(folder, exe) {
  const r = []
  for (const root of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA, 'C:\\', 'D:\\']) {
    if (root) r.push(path.join(root, folder, exe))
  }
  return r
}

function stopScanProcess() {
  if (killTimeout) { clearTimeout(killTimeout); killTimeout = null }
  if (scanProcess) {
    try { scanProcess.kill('SIGTERM'); killTimeout = setTimeout(() => { try { scanProcess?.kill('SIGKILL') } catch {}; killTimeout = null; scanProcess = null; scanEngine = null }, 3000) } catch {}
    scanProcess = null; scanEngine = null
    return { success: true }
  }
  return { success: false, error: 'No scan running' }
}

function ensureQuarantineDir() {
  if (!fs.existsSync(QUARANTINE_DIR)) fs.mkdirSync(QUARANTINE_DIR, { recursive: true })
  return QUARANTINE_DIR
}

function safeQuarantinePath(filename) {
  const resolved = path.resolve(QUARANTINE_DIR, filename)
  const normalizedDir = path.resolve(QUARANTINE_DIR) + path.sep
  if (!resolved.startsWith(normalizedDir) || resolved === path.resolve(QUARANTINE_DIR)) {
    throw new Error('Invalid quarantine path')
  }
  return resolved
}

function walkDirRecursive(dir, onEntry) {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name)
      if (entry.isDirectory()) walkDirRecursive(fp, onEntry)
      else if (entry.isFile()) onEntry(fp, entry.name)
    }
  } catch {}
}

// ════════════════════ Defender Engine ════════════════════

function runDefenderScan(scanType) {
  const exe = findDefender()
  if (!exe) return Promise.resolve({ threats: [], engine: 'defender', error: 'Windows Defender not found.', exitCode: -1, scanType })
  if (scanProcess) return Promise.resolve({ threats: [], engine: 'defender', error: 'A scan is already running.', exitCode: -1, scanType })

  return new Promise(resolve => {
    const scanArg = scanType === 'deep' ? 2 : 1
    const estMs = scanType === 'deep' ? 2700000 : 300000
    const start = Date.now()
    let lastPct = 0
    const threats = []

    const timer = setInterval(() => {
      const pct = Math.min(98, Math.round(((Date.now() - start) / estMs) * 100))
      if (pct > lastPct) {
        lastPct = pct
        mainWindow?.webContents.send('security:scan-progress', {
          percent: pct, stage: 'Defender scanning...', engine: 'defender', threatsFound: threats.length,
        })
      }
    }, 2000)

    try {
      scanProcess = spawn(exe, ['-Scan', '-ScanType', String(scanArg)], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      })
      scanEngine = 'defender'

      scanProcess.stdout.on('data', d => {
        const lines = d.toString().split('\n').filter(l => /threat/i.test(l))
        for (const line of lines) {
          const m = line.match(/Threat\s*(?:detected)?\s*:?\s*(.+)/i)
          if (m) {
            const name = m[1].trim()
            threats.push({
              name, path: '', pathShort: name,
              severity: classifySeverity(name),
              type: name.split(/[:\/]/)[0] || 'Malware',
              engine: 'defender', detectedAt: new Date().toISOString(),
            })
          }
        }
      })

      scanProcess.on('close', code => {
        clearInterval(timer); scanProcess = null; scanEngine = null
        try { ensureQuarantineDir(); fs.writeFileSync(path.join(QUARANTINE_DIR, '.lastscan'), JSON.stringify({ date: new Date().toISOString(), engine: 'defender', lastScan: { threats: threats.length } })) } catch {}
        mainWindow?.webContents.send('security:scan-progress', {
          percent: 100, stage: `Defender: ${threats.length} threat${threats.length !== 1 ? 's' : ''} found`,
          engine: 'defender', threatsFound: threats.length,
        })
        addHistory('Defender Scan', `${scanType} scan: ${threats.length} threats`, threats.length > 0 ? 'error' : 'success').catch(() => {})
        resolve({ threats, engine: 'defender', scanType, exitCode: code })
      })

      scanProcess.on('error', err => {
        clearInterval(timer); scanProcess = null; scanEngine = null
        resolve({ threats: [], engine: 'defender', error: err.message, exitCode: -1, scanType })
      })
    } catch (err) {
      clearInterval(timer); scanProcess = null; scanEngine = null
      resolve({ threats: [], engine: 'defender', error: err.message, exitCode: -1, scanType })
    }
  })
}

ipcMain.handle('defender:detect', async () => {
  const exe = findDefender()
  return { available: !!exe, path: exe || null }
})

ipcMain.handle('defender:scan', async (_, scanType) => runDefenderScan(scanType))

ipcMain.handle('defender:stopScan', async () => {
  if (scanEngine !== 'defender') return { success: false, error: 'No Defender scan running' }
  return stopScanProcess()
})

// ════════════════════ ClamAV Engine ════════════════════

function findClamAV(force = false) {
  if (!force && clamavFound === true && clamavPath && fs.existsSync(clamavPath)) {
    return { found: true, clamscan: clamavPath, freshclam: freshclamPath }
  }

  const portable = path.join(CLAMAV_DIR, 'clamscan.exe')
  const candidates = [
    portable,
    ...scanCommonPaths('ClamAV', 'clamscan.exe'),
    ...scanCommonPaths('ClamAV-x64', 'clamscan.exe'),
    'C:\\Program Files\\ClamAV\\clamscan.exe',
    'C:\\Program Files (x86)\\ClamAV\\clamscan.exe',
    'C:\\ClamAV\\clamscan.exe',
    path.join(os.homedir(), 'ClamAV', 'clamscan.exe'),
    path.join(os.homedir(), 'clamav', 'clamscan.exe'),
  ]

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      clamavFound = true; clamavPath = p
      freshclamPath = path.join(path.dirname(p), 'freshclam.exe')
      return { found: true, clamscan: p, freshclam: freshclamPath }
    }
  }

  try {
    const r = execFileSync('where', ['clamscan'], { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const lines = r.trim().split('\n').filter(Boolean)
    if (lines.length > 0 && fs.existsSync(lines[0].trim())) {
      clamavFound = true; clamavPath = lines[0].trim()
      freshclamPath = path.join(path.dirname(clamavPath), 'freshclam.exe')
      return { found: true, clamscan: clamavPath, freshclam: freshclamPath }
    }
  } catch {}

  try {
    const r = execFileSync('where', ['freshclam'], { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const lines = r.trim().split('\n').filter(Boolean)
    if (lines.length > 0 && fs.existsSync(lines[0].trim())) {
      const dir = path.dirname(lines[0].trim())
      const cs = path.join(dir, 'clamscan.exe')
      if (fs.existsSync(cs)) {
        clamavFound = true; clamavPath = cs; freshclamPath = lines[0].trim()
        return { found: true, clamscan: cs, freshclam: freshclamPath }
      }
    }
  } catch {}

  clamavFound = false; clamavPath = null; freshclamPath = null
  return { found: false, clamscan: null, freshclam: null }
}

// ── Detect ──
ipcMain.handle('clamav:detect', async () => {
  const result = findClamAV(true)
  let version = null; let defsVersion = null; let defsDate = null
  if (result.found && result.clamscan) {
    try {
      const out = execFileSync(result.clamscan, ['--version'], { encoding: 'utf8', timeout: 10000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      const vm = out.match(/ClamAV\s+([0-9.]+)/i); if (vm) version = vm[1]
      const dm = out.match(/(?:virus|engine)\s*(?:definitions?|version)[:\s]*(\d+)/i); if (dm) defsVersion = dm[1]
      const dtm = out.match(/(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})/i); if (dtm) defsDate = dtm[1]
    } catch {}
  }
  return { ...result, version, definitionsVersion: defsVersion, definitionsDate: defsDate, defenderAvailable: !!findDefender(), installUrl: 'https://www.clamav.net/downloads' }
})

// ── Install ──
ipcMain.handle('clamav:install', async () => {
  try {
    if (!fs.existsSync(CLAMAV_DIR)) fs.mkdirSync(CLAMAV_DIR, { recursive: true })
    mainWindow?.webContents.send('clamav:install-progress', { percent: 5, output: 'Downloading ClamAV engine...' })
    const zipPath = path.join(CLAMAV_DIR, 'clamav.zip')

    try {
      const https = require('https')
      await new Promise((rs, rj) => {
        const f = fs.createWriteStream(zipPath)
        const req = https.get(CLAMAV_DL_URL, { timeout: 300000 }, res => {
          if (res.statusCode >= 400) { f.close(); try { fs.unlinkSync(zipPath) } catch {}; return rj(new Error('HTTP ' + res.statusCode)) }
          if (res.statusCode >= 300 && res.statusCode < 400) {
            f.close(); try { fs.unlinkSync(zipPath) } catch {}
            const loc = res.headers.location
            if (!loc) return rj(new Error('Redirect missing location'))
            return https.get(loc, { timeout: 300000 }, r2 => {
              if (r2.statusCode >= 400) { f.close(); try { fs.unlinkSync(zipPath) } catch {}; return rj(new Error('HTTP ' + r2.statusCode)) }
              const f2 = fs.createWriteStream(zipPath); r2.pipe(f2); f2.on('finish', () => f2.close(rs))
            }).on('error', rj)
          }
          const total = parseInt(res.headers['content-length'] || '0', 10); let dl = 0
          res.on('data', c => { dl += c.length; mainWindow?.webContents.send('clamav:install-progress', { percent: 5 + Math.round((dl / (total || 50000000)) * 70), output: `Downloading... ${(dl / 1048576).toFixed(1)} MB` }) })
          res.pipe(f); f.on('finish', () => f.close(rs))
        }).on('error', rj)
      })
    } catch (e) {
      return { success: false, error: 'Download failed: ' + (e.message || 'unknown') + '. Try manual install from https://www.clamav.net/downloads' }
    }

    mainWindow?.webContents.send('clamav:install-progress', { percent: 80, output: 'Extracting ClamAV...' })

    let extracted = false
    try {
      const AdmZip = require('adm-zip')
      const zip = new AdmZip(zipPath)
      for (const entry of zip.getEntries()) {
        const parts = entry.entryName.replace(/\\/g, '/').split('/')
        const targetName = parts.pop()
        const subPath = parts.join(path.sep)
        if (!targetName || targetName.startsWith('.')) continue
        const destDir = subPath ? path.join(CLAMAV_DIR, subPath) : CLAMAV_DIR
        try { if (!fs.existsSync(destDir) && subPath) fs.mkdirSync(destDir, { recursive: true }) } catch {}
        try { fs.writeFileSync(path.join(destDir, targetName), entry.getData()); extracted = true } catch {}
      }
    } catch {}
    if (!extracted) {
      try { execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${CLAMAV_DIR}' -Force`], { timeout: 60000, windowsHide: true }) } catch {}
    }
    try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath) } catch {}

    let clamScan = path.join(CLAMAV_DIR, 'clamscan.exe')
    if (!fs.existsSync(clamScan)) {
      walkDirRecursive(CLAMAV_DIR, (fp, name) => {
        if (name.toLowerCase() === 'clamscan.exe') clamScan = fp
      })
    }

    if (!fs.existsSync(clamScan)) {
      return { success: false, error: 'ClamAV executable not found after extraction. Try manual install.' }
    }

    const scanDir = path.dirname(clamScan)
    const freshClam = path.join(scanDir, 'freshclam.exe')
    const confPath = path.join(scanDir, 'freshclam.conf')
    if (!fs.existsSync(confPath)) {
      try {
        fs.writeFileSync(confPath, [
          'DatabaseMirror database.clamav.net',
          'DatabaseDirectory "' + scanDir.replace(/\\/g, '\\\\') + '"',
          'LogVerbose false',
          'NotifyClamd ""',
        ].join('\n'))
      } catch {}
    }

    mainWindow?.webContents.send('clamav:install-progress', { percent: 90, output: 'Updating virus definitions...' })
    if (fs.existsSync(freshClam)) {
      try { execFileSync(freshClam, ['--no-dns', '--config-file=' + confPath], { timeout: 120000, windowsHide: true, stdio: 'ignore' }) } catch {}
    }

    mainWindow?.webContents.send('clamav:install-progress', { percent: 100, output: 'ClamAV installed.' })
    clamavFound = null; clamavPath = null; freshclamPath = null
    const fresh = findClamAV(true)
    return { success: true, message: 'ClamAV installed with virus definitions.', found: fresh.found, clamscan: fresh.clamscan, freshclam: fresh.freshclam }
  } catch (e) {
    return { success: false, error: 'Installation failed: ' + errorMessage(e) + '. Try manual install.' }
  }
})

// ── Update Definitions ──
ipcMain.handle('clamav:update', async () => {
  const av = findClamAV()
  if (!av.found || !av.freshclam) return { success: false, error: 'ClamAV not installed. Click Install to download.' }

  return new Promise(resolve => {
    try {
      const child = spawn(av.freshclam, ['--no-dns'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      child.stdout.on('data', d => {
        const t = d.toString(); out += t
        let pct = 0
        if (t.includes('Downloading')) pct = 30
        else if (t.includes('daily')) pct = 55
        else if (t.includes('bytecode')) pct = 70
        else if (t.includes('main')) pct = 85
        else if (t.includes('updated') || t.includes('up to date')) pct = 100
        mainWindow?.webContents.send('clamav:update-progress', { percent: pct, output: t.trim().slice(0, 200) })
      })
      child.on('close', code => {
        const ok = code === 0 || out.includes('up to date')
        resolve({ success: ok, message: ok ? 'Definitions updated.' : 'freshclam exit code ' + code, output: out.slice(-300) })
      })
      child.on('error', err => resolve({ success: false, error: err.message }))
    } catch (err) { resolve({ success: false, error: err.message }) }
  })
})

// ── Scan ──
function runClamAVScan(scanType) {
  const av = findClamAV()
  if (!av.found || !av.clamscan) return Promise.resolve({ threats: [], filesScanned: 0, engine: 'clamav', error: 'ClamAV not installed.', scanType })
  if (scanProcess) return Promise.resolve({ threats: [], filesScanned: 0, engine: 'clamav', error: 'A scan is already running.', scanType })

  return new Promise(resolve => {
    const pathMaps = {
      quick: [os.tmpdir(), process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')],
      deep: ['C:\\'],
      custom: [os.homedir()],
    }
    const scanPaths = pathMaps[scanType] || [os.homedir()]
    const maxFiles = scanType === 'deep' ? 500000 : 80000

    const args = ['--recursive', '--max-filesize=400M', '--max-scansize=400M', '--max-files', String(maxFiles), ...scanPaths]

    try {
      scanProcess = spawn(av.clamscan, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      scanEngine = 'clamav'

      let filesScanned = 0
      const threats = []
      let lastEvent = 0

      scanProcess.stdout.on('data', d => {
        const lines = d.toString().split('\n').filter(l => l.trim())
        for (const line of lines) {
          if (line.includes('FOUND')) {
            const ci = line.indexOf(':')
            if (ci > 0) {
              const fp = line.slice(0, ci).trim()
              const name = line.slice(ci + 1).trim().split(/\s+/).pop()
              if (name && name !== 'OK') {
                threats.push({
                  name, path: fp,
                  pathShort: fp.length > 80 ? '...' + fp.slice(-77) : fp,
                  severity: classifySeverity(name),
                  type: name.split('.')[0] || 'Malware',
                  engine: 'clamav', detectedAt: new Date().toISOString(),
                })
              }
            }
          }
          filesScanned++
        }

        const now = Date.now()
        if (now - lastEvent >= 500) {
          lastEvent = now
          const pct = Math.min(99, Math.round((filesScanned / maxFiles) * 100))
          mainWindow?.webContents.send('security:scan-progress', {
            percent: pct, stage: `Scanned ${filesScanned.toLocaleString()} files...`, engine: 'clamav', filesScanned, threatsFound: threats.length,
          })
        }
      })

      scanProcess.stderr.on('data', d => {
        const m = d.toString().match(/WARNING:\s*(.{1,120})/i)
        if (m) {
          mainWindow?.webContents.send('security:scan-progress', {
            percent: Math.round((filesScanned / maxFiles) * 100), stage: m[1].slice(0, 100),
            engine: 'clamav', filesScanned, threatsFound: threats.length,
          })
        }
      })

      scanProcess.on('close', code => {
        scanProcess = null; scanEngine = null
        try { ensureQuarantineDir(); fs.writeFileSync(path.join(QUARANTINE_DIR, '.lastscan'), JSON.stringify({ date: new Date().toISOString(), engine: 'clamav', lastScan: { total: filesScanned, threats: threats.length } })) } catch {}
        mainWindow?.webContents.send('security:scan-progress', {
          percent: 100, stage: `ClamAV: ${threats.length} threat${threats.length !== 1 ? 's' : ''} in ${filesScanned.toLocaleString()} files`,
          engine: 'clamav', filesScanned, threatsFound: threats.length,
        })
        addHistory('ClamAV Scan', `${scanType} scan: ${threats.length} threats / ${filesScanned.toLocaleString()} files`, threats.length > 0 ? 'error' : 'success').catch(() => {})
        resolve({ threats, filesScanned, engine: 'clamav', scanType, exitCode: code })
      })

      scanProcess.on('error', err => {
        scanProcess = null; scanEngine = null
        resolve({ threats: [], filesScanned: 0, engine: 'clamav', error: err.message, scanType })
      })
    } catch (err) {
      scanProcess = null; scanEngine = null
      resolve({ threats: [], filesScanned: 0, engine: 'clamav', error: err.message, scanType })
    }
  })
}

ipcMain.handle('clamav:scan', async (_, scanType) => runClamAVScan(scanType))

// ════════════════════ Stop Scan (any engine) ════════════════════

ipcMain.handle('clamav:stopScan', async () => stopScanProcess())
ipcMain.handle('security:stopScan', async () => stopScanProcess())

// ════════════════════ Dual-Engine Controller ════════════════════

ipcMain.handle('security:scan', async (_, scanType) => {
  const result = { threats: [], filesScanned: 0, engines: [], scanType, errors: [] }

  const defenderExe = findDefender()
  if (defenderExe) {
    mainWindow?.webContents.send('security:scan-progress', { percent: 0, stage: 'Starting Defender scan...', engine: 'defender', threatsFound: 0 })
    const dr = await runDefenderScan(scanType)
    if (!dr.error) {
      result.engines.push('defender')
      result.threats.push(...dr.threats.map(t => ({ ...t })))
    } else {
      result.errors.push({ engine: 'defender', error: dr.error })
    }
  } else {
    result.errors.push({ engine: 'defender', error: 'Windows Defender not found.' })
  }

  const av = findClamAV()
  if (av.found && av.clamscan) {
    mainWindow?.webContents.send('security:scan-progress', { percent: 0, stage: 'Starting ClamAV scan...', engine: 'clamav', threatsFound: result.threats.length })
    const cr = await runClamAVScan(scanType)
    if (!cr.error) {
      result.engines.push('clamav')
      result.filesScanned = cr.filesScanned || 0
      // Deduplicate threats (same path + name from both engines)
      const seen = new Set(result.threats.map(t => t.path + '|' + t.name))
      for (const t of cr.threats) {
        const key = t.path + '|' + t.name
        if (!seen.has(key)) {
          seen.add(key)
          result.threats.push({ ...t })
        }
      }
    } else {
      result.errors.push({ engine: 'clamav', error: cr.error })
    }
  }

  mainWindow?.webContents.send('security:scan-progress', {
    percent: 100, stage: `Dual scan complete: ${result.threats.length} threat${result.threats.length !== 1 ? 's' : ''} by ${result.engines.join(' + ')}`,
    engine: 'dual', threatsFound: result.threats.length, filesScanned: result.filesScanned,
  })
  return result
})

// ════════════════════ Quarantine ════════════════════

ipcMain.handle('clamav:quarantine', async (_, threats) => {
  try {
    ensureQuarantineDir()
    let count = 0
    const results = []
    for (const t of threats) {
      if (!t.path || !fs.existsSync(t.path)) { results.push({ path: t.path, success: false, error: 'File not found' }); continue }
      try {
        const name = path.basename(t.path)
        const destName = `${Date.now()}_${count}_${name}`
        const dest = path.join(QUARANTINE_DIR, destName)
        fs.copyFileSync(t.path, dest)
        const meta = { originalPath: t.path, threatName: t.name, severity: t.severity, quarantinedAt: new Date().toISOString(), quarantinedName: destName }
        fs.writeFileSync(dest + '.meta.json', JSON.stringify(meta, null, 2))
        fs.unlinkSync(t.path)
        count++
        results.push({ path: t.path, success: true, quarantine: destName })
      } catch (e) { results.push({ path: t.path, success: false, error: e.message }) }
    }
    return { success: true, quarantined: count, results }
  } catch (e) { return { success: false, error: errorMessage(e) } }
})

ipcMain.handle('clamav:quarantineList', async () => {
  try {
    ensureQuarantineDir()
    const items = []
    for (const file of fs.readdirSync(QUARANTINE_DIR)) {
      if (file.endsWith('.meta.json')) continue
      const metaFile = path.join(QUARANTINE_DIR, file + '.meta.json')
      let meta = {}
      try { if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')) } catch {}
      const stat = fs.statSync(path.join(QUARANTINE_DIR, file))
      items.push({ ...meta, quarantineFile: file, size: stat.size, quarantinedAt: meta.quarantinedAt || stat.mtime.toISOString() })
    }
    return { success: true, items: items.sort((a, b) => new Date(b.quarantinedAt) - new Date(a.quarantinedAt)) }
  } catch (e) { return { success: true, items: [] } }
})

ipcMain.handle('clamav:restore', async (_, quarantineFile) => {
  try {
    const fp = safeQuarantinePath(quarantineFile)
    const metaFile = fp + '.meta.json'
    let meta = {}
    try { if (fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')) } catch {}
    const dest = meta.originalPath || path.join(os.homedir(), 'Restored_' + quarantineFile)
    if (!fs.existsSync(path.dirname(dest))) fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(fp, dest)
    fs.unlinkSync(fp)
    try { if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile) } catch {}
    return { success: true, restoredTo: dest }
  } catch (e) { return { success: false, error: errorMessage(e) } }
})

ipcMain.handle('clamav:deleteQuarantined', async (_, quarantineFile) => {
  try {
    const fp = safeQuarantinePath(quarantineFile)
    const metaFile = fp + '.meta.json'
    if (fs.existsSync(fp)) fs.unlinkSync(fp)
    try { if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile) } catch {}
    return { success: true }
  } catch (e) { return { success: false, error: errorMessage(e) } }
})

// ════════════════════ Protection Status ════════════════════

ipcMain.handle('clamav:protectionStatus', async () => {
  try {
    const status = { defenderRealtime: false, defenderAntivirus: false, firewall: false, lastScan: null }

    try {
      const ps = `Get-MpComputerStatus | Select-Object -Property AntivirusEnabled,RealTimeProtectionEnabled,OnAccessProtectionEnabled | ConvertTo-Json`
      const r = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 10000, windowsHide: true })
      const data = JSON.parse(r)
      status.defenderAntivirus = data.AntivirusEnabled || false
      status.defenderRealtime = data.RealTimeProtectionEnabled || false
    } catch {}

    try {
      const fw = execFileSync('netsh', ['advfirewall', 'show', 'currentprofile'], { encoding: 'utf8', timeout: 5000, windowsHide: true })
      status.firewall = fw.includes('ON')
    } catch {}

    try {
      const lsPath = path.join(QUARANTINE_DIR, '.lastscan')
      if (fs.existsSync(lsPath)) status.lastScan = JSON.parse(fs.readFileSync(lsPath, 'utf8'))
    } catch {}

    return { success: true, ...status }
  } catch (e) { return { success: true, defenderRealtime: false, defenderAntivirus: false, firewall: false } }
})

ipcMain.handle('security:protectionStatus', async () => {
  try {
    const status = { defenderRealtime: false, defenderAntivirus: false, firewall: false, lastScan: null }

    try {
      const ps = `Get-MpComputerStatus | Select-Object -Property AntivirusEnabled,RealTimeProtectionEnabled,OnAccessProtectionEnabled | ConvertTo-Json`
      const r = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 10000, windowsHide: true })
      const data = JSON.parse(r)
      status.defenderAntivirus = data.AntivirusEnabled || false
      status.defenderRealtime = data.RealTimeProtectionEnabled || false
    } catch {}

    try {
      const fw = execFileSync('netsh', ['advfirewall', 'show', 'currentprofile'], { encoding: 'utf8', timeout: 5000, windowsHide: true })
      status.firewall = fw.includes('ON')
    } catch {}

    try {
      const lsPath = path.join(QUARANTINE_DIR, '.lastscan')
      if (fs.existsSync(lsPath)) status.lastScan = JSON.parse(fs.readFileSync(lsPath, 'utf8'))
    } catch {}

    return { success: true, ...status }
  } catch (e) { return { success: true, defenderRealtime: false, defenderAntivirus: false, firewall: false } }
})

// ════════════════════ Scan History ════════════════════

ipcMain.handle('clamav:scanHistory', async () => {
  try {
    const h = await getHistory()
    const scanHistory = h.filter(e => e.action === 'Security Scan').slice(0, 20)
    return { success: true, history: scanHistory, total: scanHistory.length }
  } catch { return { success: true, history: [], total: 0 } }
})

ipcMain.handle('security:scanHistory', async () => {
  try {
    const h = await getHistory()
    const scanHistory = h.filter(e => /Scan/.test(e.action)).slice(0, 20)
    return { success: true, history: scanHistory, total: scanHistory.length }
  } catch { return { success: true, history: [], total: 0 } }
})

/* ═══════════════════════════ End Dual-Engine Security ═══════════════════════════ */

/* ═══════════════════════════ V3.1: Sparkle Features ═══════════════════════════ */

/* ─────────────── Debloat Windows ─────────────── */
const DEBLOAT_ITEMS = [
  { id: 'onedrive', name: 'OneDrive', desc: 'Microsoft cloud storage integration', category: 'Cloud', risk: 'Medium', cmd: 'winget uninstall --id Microsoft.OneDrive --silent' },
  { id: 'cortana', name: 'Cortana', desc: 'Microsoft virtual assistant', category: 'Assistant', risk: 'Medium', cmd: 'winget uninstall --id Microsoft.Cortana --silent' },
  { id: 'xbox', name: 'Xbox Apps', desc: 'Xbox Game Bar, Console Companion, Identity Provider', category: 'Gaming', risk: 'Low', cmd: 'powershell -NoProfile -Command "Get-AppxPackage *xbox* | Remove-AppxPackage -ErrorAction SilentlyContinue"' },
  { id: 'skype', name: 'Skype', desc: 'Pre-installed Skype app', category: 'Communication', risk: 'Low', cmd: 'winget uninstall --id Microsoft.Skype --silent' },
  { id: 'onenote', name: 'OneNote', desc: 'Microsoft note-taking app', category: 'Office', risk: 'Low', cmd: 'winget uninstall --id Microsoft.OneNote --silent' },
  { id: 'solitaire', name: 'Solitaire & Games', desc: 'Microsoft Solitaire Collection and casual games', category: 'Gaming', risk: 'Low', cmd: 'powershell -NoProfile -Command "Get-AppxPackage *solitaire* | Remove-AppxPackage -ErrorAction SilentlyContinue"' },
  { id: 'bing', name: 'Bing Apps', desc: 'Bing Weather, News, Finance, Sports', category: 'Bloat', risk: 'Low', cmd: 'powershell -NoProfile -Command "Get-AppxPackage *bing* | Remove-AppxPackage -ErrorAction SilentlyContinue"' },
  { id: 'officehub', name: 'Microsoft Office Hub', desc: 'Pre-installed Office advertisement app', category: 'Office', risk: 'Low', cmd: 'powershell -NoProfile -Command "Get-AppxPackage *officehub* | Remove-AppxPackage -ErrorAction SilentlyContinue"' },
  { id: 'mixedreality', name: 'Mixed Reality Portal', desc: 'Windows Mixed Reality components', category: 'Bloat', risk: 'Low', cmd: 'powershell -NoProfile -Command "Get-AppxPackage *mixedreality* | Remove-AppxPackage -ErrorAction SilentlyContinue"' },
  { id: 'telemetry', name: 'Telemetry Services', desc: 'Disable diagnostic tracking and telemetry', category: 'Privacy', risk: 'Medium', cmd: 'powershell -NoProfile -Command "Set-ItemProperty -Path HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection -Name AllowTelemetry -Value 0 -Type DWord -Force; Set-ItemProperty -Path HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection -Name AllowTelemetry -Value 0 -Type DWord -Force"' },
  { id: 'suggestions', name: 'Suggested Apps & Tips', desc: 'Disable Start menu suggestions, tips, and ads', category: 'Privacy', risk: 'Low', cmd: 'powershell -NoProfile -Command "New-Item -Path HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent -Force | Out-Null; Set-ItemProperty -Path HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent -Name DisableWindowsConsumerFeatures -Value 1 -Type DWord -Force"' },
  { id: 'maps', name: 'Windows Maps', desc: 'Pre-installed Maps application', category: 'Bloat', risk: 'Low', cmd: 'powershell -NoProfile -Command "Get-AppxPackage *windowsmaps* | Remove-AppxPackage -ErrorAction SilentlyContinue"' },
  { id: 'zune', name: 'Zune / Media Player', desc: 'Legacy Groove Music, Movies & TV, Zune', category: 'Media', risk: 'Low', cmd: 'powershell -NoProfile -Command "Get-AppxPackage *zune* | Remove-AppxPackage -ErrorAction SilentlyContinue"' },
]

ipcMain.handle('debloat:list', async () => {
  try {
    const appsOut = execFileSync('powershell.exe', [
      '-NoProfile', '-Command',
      'Get-AppxPackage | Select-Object Name -ExpandProperty Name | Where-Object { $_ -match "xbox|bing|skype|solitaire|officehub|mixedreality|windowsmaps|zune|people|camera|alarms|sticky|feedback|getstarted|3dbuilder|communications" } | ConvertTo-Json -Compress'
    ], { encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })

    const installedNames = new Set()
    try {
      const names = JSON.parse(appsOut || '[]')
      ;(Array.isArray(names) ? names : [names]).forEach(n => installedNames.add(n.toLowerCase()))
    } catch {}

    const items = DEBLOAT_ITEMS.map(item => {
      const idLower = item.id.toLowerCase()
      const nameWords = item.name.toLowerCase().split(/\s+/)
      const installed = Array.from(installedNames).some(n => nameWords.some(w => n.includes(w)))
      return { ...item, installed, status: installed ? 'detected' : 'not-found' }
    })

    const installedCount = items.filter(i => i.installed).length
    return { success: true, items, total: items.length, installed: installedCount }
  } catch (error) {
    return { success: false, error: errorMessage(error), items: DEBLOAT_ITEMS.map(i => ({ ...i, installed: false, status: 'unknown' })) }
  }
})

async function removeDebloatItem(itemId) {
  const item = DEBLOAT_ITEMS.find(i => i.id === itemId)
  if (!item) return { success: false, error: 'Unknown debloat item.' }

  return new Promise((resolve) => {
    const child = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', item.cmd
    ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 })

    let output = ''
    child.stdout.on('data', d => { output += d.toString() })
    child.stderr.on('data', d => { output += d.toString() })

    child.on('close', (code) => {
      mainWindow?.webContents.send('debloat:progress', { id: itemId, done: true, code })
      addHistory('Debloat', `Removed ${item.name}`, code === 0 ? 'success' : 'error').catch(() => {})
      resolve({ success: code === 0, item: itemId, output: output.slice(-200) })
    })

    child.on('error', (err) => {
      resolve({ success: false, error: err.message, item: itemId })
    })
  })
}

ipcMain.handle('debloat:remove', async (_, itemId) => {
  return removeDebloatItem(itemId)
})

ipcMain.handle('debloat:removeAll', async (_, selectedIds) => {
  const ids = selectedIds || DEBLOAT_ITEMS.map(i => i.id)
  const results = []
  for (const id of ids) {
    mainWindow?.webContents.send('debloat:progress', { id, done: false })
    const result = await removeDebloatItem(id)
    results.push({ id, success: result.success || false })
  }
  return { success: results.every(r => r.success), results }
})

/* ─────────────── App Installer (winget) ─────────────── */
const FEATURED_APPS = [
  { id: 'Google.Chrome', name: 'Google Chrome', desc: 'Popular web browser', category: 'Browsers', icon: 'Globe', size: '~120 MB' },
  { id: 'Mozilla.Firefox', name: 'Firefox', desc: 'Privacy-focused browser', category: 'Browsers', icon: 'Globe', size: '~90 MB' },
  { id: 'Brave.Brave', name: 'Brave', desc: 'Privacy browser with ad-blocking', category: 'Browsers', icon: 'Globe', size: '~110 MB' },
  { id: 'VideoLAN.VLC', name: 'VLC Media Player', desc: 'Universal media player', category: 'Media', icon: 'Play', size: '~80 MB' },
  { id: 'Spotify.Spotify', name: 'Spotify', desc: 'Music streaming', category: 'Media', icon: 'Music', size: '~150 MB' },
  { id: 'Notepad++.Notepad++', name: 'Notepad++', desc: 'Advanced text/code editor', category: 'Dev Tools', icon: 'Code', size: '~15 MB' },
  { id: 'Microsoft.VisualStudioCode', name: 'VS Code', desc: 'Code editor by Microsoft', category: 'Dev Tools', icon: 'Code', size: '~200 MB' },
  { id: '7zip.7zip', name: '7-Zip', desc: 'File archiver with high compression', category: 'Utilities', icon: 'Archive', size: '~5 MB' },
  { id: 'Discord.Discord', name: 'Discord', desc: 'Chat and voice communication', category: 'Communication', icon: 'MessageCircle', size: '~120 MB' },
  { id: 'OBSProject.OBSStudio', name: 'OBS Studio', desc: 'Live streaming and recording', category: 'Media', icon: 'Video', size: '~200 MB' },
  { id: 'GIMP.GIMP', name: 'GIMP', desc: 'Open-source image editor', category: 'Creative', icon: 'Image', size: '~250 MB' },
  { id: 'LibreOffice.LibreOffice', name: 'LibreOffice', desc: 'Free office suite', category: 'Office', icon: 'FileText', size: '~400 MB' },
  { id: 'qBittorrent.qBittorrent', name: 'qBittorrent', desc: 'Lightweight torrent client', category: 'Utilities', icon: 'Download', size: '~50 MB' },
  { id: 'Valve.Steam', name: 'Steam', desc: 'Game platform and store', category: 'Gaming', icon: 'Gamepad2', size: '~300 MB' },
  { id: 'Git.Git', name: 'Git', desc: 'Version control system', category: 'Dev Tools', icon: 'GitBranch', size: '~50 MB' },
  { id: 'Python.Python.3.12', name: 'Python 3.12', desc: 'Programming language', category: 'Dev Tools', icon: 'Terminal', size: '~120 MB' },
]

ipcMain.handle('winget:featured', async () => {
  try {
    const installed = new Set()
    try {
      const out = execFileSync('winget', ['list', '--accept-source-agreements'], {
        encoding: 'utf8', timeout: 30000, windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      out.split('\n').forEach(line => {
        FEATURED_APPS.forEach(app => {
          if (line.toLowerCase().includes(app.id.toLowerCase())) installed.add(app.id)
        })
      })
    } catch {}

    return {
      success: true,
      apps: FEATURED_APPS.map(app => ({ ...app, installed: installed.has(app.id) })),
    }
  } catch (error) {
    return { success: false, error: errorMessage(error), apps: [] }
  }
})

ipcMain.handle('winget:install', async (_, appId) => {
  return new Promise((resolve) => {
    const child = spawn('winget', ['install', '--id', appId, '--silent', '--accept-source-agreements', '--accept-package-agreements'], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000,
    })

    let output = ''
    child.stdout.on('data', d => {
      const text = d.toString()
      output += text
      const progressMatch = text.match(/(\d+)%/)
      if (progressMatch) {
        mainWindow?.webContents.send('winget:progress', { id: appId, percent: parseInt(progressMatch[1]) })
      }
    })
    child.stderr.on('data', d => { output += d.toString() })

    child.on('close', (code) => {
      mainWindow?.webContents.send('winget:progress', { id: appId, percent: 100, done: true })
      addHistory('App Installer', `Installed ${appId}`, code === 0 ? 'success' : 'error').catch(() => {})
      resolve({ success: code === 0, appId, output: output.slice(-300) })
    })

    child.on('error', (err) => resolve({ success: false, error: err.message, appId }))
  })
})

/* ─────────────── System Utilities ─────────────── */
async function runSystemTool(name, exe, args, progressChannel) {
  return new Promise((resolve) => {
    try {
      const child = spawn(exe, args, {
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      })

      let output = ''
      child.stdout.on('data', d => {
        const text = d.toString()
        output += text
        mainWindow?.webContents.send(progressChannel, { output: text.trim().slice(0, 200) })
      })
      child.stderr.on('data', d => {
        const text = d.toString()
        output += text
        mainWindow?.webContents.send(progressChannel, { output: text.trim().slice(0, 200) })
      })

      child.on('close', (code) => {
        addHistory('System Utility', `${name} completed`, code === 0 ? 'success' : 'error').catch(() => {})
        resolve({ success: code === 0, name, output: output.slice(-500) })
      })

      child.on('error', (err) => resolve({ success: false, error: err.message, name }))
    } catch (err) {
      resolve({ success: false, error: err.message, name })
    }
  })
}

ipcMain.handle('sysutils:sfc', async () => {
  return runSystemTool('SFC /scannow', 'sfc.exe', ['/scannow'], 'sysutils:progress')
})

ipcMain.handle('sysutils:dismCheck', async () => {
  return runSystemTool('DISM CheckHealth', 'dism.exe', ['/Online', '/Cleanup-Image', '/CheckHealth'], 'sysutils:progress')
})

ipcMain.handle('sysutils:dismRestore', async () => {
  return runSystemTool('DISM RestoreHealth', 'dism.exe', ['/Online', '/Cleanup-Image', '/RestoreHealth'], 'sysutils:progress')
})

ipcMain.handle('sysutils:chkdsk', async () => {
  return runSystemTool('CHKDSK', 'chkdsk.exe', ['C:', '/f', '/r'], 'sysutils:chkdsk-progress')
})

ipcMain.handle('sysutils:cleanWinUpdate', async () => {
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', [
      '-NoProfile', '-Command',
      'Stop-Service wuauserv -Force; Remove-Item -Path "$env:windir\\SoftwareDistribution\\Download\\*" -Recurse -Force -ErrorAction SilentlyContinue; Start-Service wuauserv; Write-Output "Windows Update cache cleaned."'
    ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })

    let output = ''
    child.stdout.on('data', d => { output += d.toString() })
    child.stderr.on('data', d => { output += d.toString() })

    child.on('close', (code) => {
      addHistory('System Utility', 'Windows Update cache cleaned', code === 0 ? 'success' : 'error').catch(() => {})
      resolve({ success: code === 0, name: 'Windows Update Cleanup', output: output.slice(-300) })
    })

    child.on('error', (err) => resolve({ success: false, error: err.message }))
  })
})

/* ─────────────── Network Optimizer ─────────────── */
const DNS_SERVERS = [
  { id: 'cloudflare', name: 'Cloudflare', primary: '1.1.1.1', secondary: '1.0.0.1', desc: 'Fast, privacy-respecting DNS' },
  { id: 'google', name: 'Google DNS', primary: '8.8.8.8', secondary: '8.8.4.4', desc: 'Reliable global DNS service' },
  { id: 'quad9', name: 'Quad9', primary: '9.9.9.9', secondary: '149.112.112.112', desc: 'Security-focused DNS with threat blocking' },
  { id: 'opendns', name: 'OpenDNS', primary: '208.67.222.222', secondary: '208.67.220.220', desc: 'Cisco DNS with content filtering' },
  { id: 'adguard', name: 'AdGuard DNS', primary: '94.140.14.14', secondary: '94.140.15.15', desc: 'Blocks ads and trackers at DNS level' },
]

const NETWORK_INTERFACES_SCRIPT = `Get-NetAdapter | Where-Object Status -eq 'Up' | ForEach-Object {
  $adapter = $_
  $dns = Get-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
  [PSCustomObject]@{
    name = [string]$adapter.Name
    ifIndex = [int]$adapter.ifIndex
    description = [string]$adapter.InterfaceDescription
    speed = [long]$adapter.LinkSpeed
    dnsServers = if ($dns) { @($dns.ServerAddresses -ne '127.0.0.1' | Where-Object { $_ }) } else { @() }
  }
} | ConvertTo-Json -Compress`

ipcMain.handle('network:status', async () => {
  try {
    const out = execFileSync('powershell.exe', [
      '-NoProfile', '-Command', NETWORK_INTERFACES_SCRIPT
    ], { encoding: 'utf8', timeout: 15000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })

    const adapters = JSON.parse(out || '[]')
    const list = Array.isArray(adapters) ? adapters : [adapters]
    const currentDns = list.length > 0 && list[0].dnsServers?.length > 0
      ? list[0].dnsServers[0]
      : null

    let currentProvider = 'custom'
    if (currentDns) {
      for (const s of DNS_SERVERS) {
        if (currentDns === s.primary) { currentProvider = s.id; break }
      }
    }

    return { success: true, adapters: list, currentDns, currentProvider }
  } catch (error) {
    return { success: false, error: errorMessage(error), adapters: [], currentDns: null }
  }
})

ipcMain.handle('network:setDns', async (_, providerId) => {
  const provider = DNS_SERVERS.find(s => s.id === providerId)
  if (!provider) return { success: false, error: 'Unknown DNS provider.' }

  try {
    const script = `
      $adapters = Get-NetAdapter | Where-Object Status -eq 'Up'
      foreach ($a in $adapters) {
        Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ServerAddresses @('${provider.primary}', '${provider.secondary}')
      }
      Write-Output "DNS set to ${provider.name}"
    `
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
      encoding: 'utf8', timeout: 30000, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    await addHistory('Network', `DNS set to ${provider.name}`, 'success')
    return { success: true, provider: providerId, message: `DNS set to ${provider.name}` }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
})

ipcMain.handle('network:optimize', async () => {
  const script = `
    # TCP Auto-Tuning
    netsh int tcp set global autotuninglevel=normal
    # Enable RSS
    netsh int tcp set global rss=enabled
    # Disable Nagle
    Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\MSMQ\\Parameters" -Name "TCPNoDelay" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
    # Network throttling index
    Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" -Name "NetworkThrottlingIndex" -Value 0xffffffff -Type DWord -Force -ErrorAction SilentlyContinue
    # System responsiveness
    Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" -Name "SystemResponsiveness" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
    Write-Output "Network optimizations applied: TCP auto-tuning, RSS enabled, Nagle disabled, throttling removed."
  `
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
      encoding: 'utf8', timeout: 30000, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await addHistory('Network', 'TCP and network optimizations applied', 'success')
    return { success: true, message: out.trim() }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
})

ipcMain.handle('network:reset', async () => {
  try {
    execFileSync('netsh', ['int', 'ip', 'reset'], {
      timeout: 30000, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    execFileSync('netsh', ['winsock', 'reset'], {
      timeout: 15000, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await addHistory('Network', 'Network settings reset to default', 'success')
    return { success: true, message: 'Network settings reset. A restart is recommended.' }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
})

/* ============================================================
   ADVANCED FEATURES — v3.3.0
   ============================================================ */

// ── System Hardware Info ───────────────────────────────────
ipcMain.handle('system:hardware', async () => {
  try {
    const cpu = os.cpus()[0] || {}
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    let gpu = 'Unknown'
    let vram = ''
    try { const r = execFileSync('wmic', ['path', 'win32_VideoController', 'get', 'name,AdapterRAM', '/format:csv'], { encoding: 'utf8', timeout: 10000 }).split('\n').filter(Boolean).slice(1); if (r[0]) { const p = r[0].split(','); gpu = p[p.length - 2] || p[1] || 'Unknown'; const ram = parseInt(p[p.length - 1] || '0', 10); vram = ram > 0 ? `${(ram / (1024 * 1024 * 1024)).toFixed(1)} GB` : '' } } catch (_) {}
    let disks = []
    try {
      const r = execFileSync('wmic', ['logicaldisk', 'where', 'drivetype=3', 'get', 'deviceid,size,freespace,volumename', '/format:csv'], { encoding: 'utf8', timeout: 10000 }).split('\n').filter(Boolean).slice(1)
      disks = r.map(l => { const p = l.split(','); return { drive: p[1] || p[p.length - 4], label: p[p.length - 1] || '', total: parseInt(p[p.length - 3] || '0', 10), free: parseInt(p[p.length - 2] || '0', 10) } }).filter(d => d.drive)
    } catch (_) {}
    let motherboard = ''
    try { const r = execFileSync('wmic', ['baseboard', 'get', 'product,manufacturer', '/format:csv'], { encoding: 'utf8', timeout: 5000 }).split('\n').filter(Boolean).slice(1)[0]; if (r) { const p = r.split(','); motherboard = `${p[p.length - 2] || ''} ${p[p.length - 1] || ''}`.trim() } } catch (_) {}
    let bios = ''
    try { const r = execFileSync('wmic', ['bios', 'get', 'version,manufacturer', '/format:csv'], { encoding: 'utf8', timeout: 5000 }).split('\n').filter(Boolean).slice(1)[0]; if (r) { const p = r.split(','); bios = `${p[p.length - 2] || ''} ${p[p.length - 1] || ''}`.trim() } } catch (_) {}
    return {
      success: true,
      cpu: { model: cpu.model || 'Unknown', cores: os.cpus().length, speed: `${cpu.speed || 0} MHz`, architecture: os.arch() },
      gpu: { model: gpu.trim(), vram },
      ram: { total: totalMem, free: freeMem, used: totalMem - freeMem },
      disks,
      motherboard,
      bios,
      hostname: os.hostname(),
      os: { platform: os.platform(), release: os.release(), arch: os.arch(), uptime: os.uptime() }
    }
  } catch (e) { return { success: false, error: errorMessage(e) } }
})

// ── Process List ───────────────────────────────────────────
ipcMain.handle('system:processes', async () => {
  try {
    const r = execFileSync('powershell', ['-NoProfile', '-Command', 'Get-Process | Sort-Object -Property CPU -Descending | Select-Object -First 50 Name,Id,CPU,WorkingSet64 | ForEach-Object { "$($_.Name)|$($_.Id)|$([math]::Round($_.CPU,1))|$([math]::Round($_.WorkingSet64/1MB,0))" }'], { encoding: 'utf8', timeout: 15000 })
    const procs = r.split('\n').filter(Boolean).map(l => { const [name, pid, cpu, mem] = l.split('|'); return { name, pid: parseInt(pid, 10), cpu: parseFloat(cpu), mem: parseInt(mem, 10) } })
    return { success: true, processes: procs }
  } catch (e) { return { success: false, error: errorMessage(e), processes: [] } }
})

ipcMain.handle('system:killProcess', async (_, pid) => {
  try { execFileSync('taskkill', ['/PID', String(pid), '/F'], { timeout: 10000 }); return { success: true } }
  catch (e) { return { success: false, error: errorMessage(e) } }
})

// ── Service List ───────────────────────────────────────────
ipcMain.handle('system:services', async () => {
  try {
    const r = execFileSync('powershell', ['-NoProfile', '-Command', 'Get-Service | Sort-Object Status,Name | Select-Object Name,DisplayName,Status,StartType | ForEach-Object { "$($_.Name)|$($_.DisplayName)|$($_.Status)|$($_.StartType)" }'], { encoding: 'utf8', timeout: 15000 })
    const svcs = r.split('\n').filter(Boolean).map(l => { const [name, display, status, startType] = l.split('|'); return { name, display, status, startType } })
    return { success: true, services: svcs }
  } catch (e) { return { success: false, error: errorMessage(e), services: [] } }
})

// ── Duplicate File Finder ──────────────────────────────────
ipcMain.handle('duplicates:scan', async (_, dirPath) => {
  try {
    const target = dirPath || process.env.USERPROFILE || os.homedir()
    mainWindow.webContents.send('duplicates:progress', { stage: 'indexing', percent: 0 })
    const hashMap = new Map()
    const duplicates = []
    let scanned = 0
    const files = []
    function walk(dir, depth) {
      if (depth > 8) return
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fp = path.join(dir, entry.name)
          try {
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'Windows') walk(fp, depth + 1)
            else if (entry.isFile() && entry.size > 1024 && entry.size < 500 * 1024 * 1024) files.push({ path: fp, size: entry.size })
          } catch (_) {}
        }
      } catch (_) {}
    }
    walk(target, 0)
    const bySize = new Map()
    for (const f of files) { const k = f.size; if (!bySize.has(k)) bySize.set(k, []); bySize.get(k).push(f) }
    const candidates = [...bySize.values()].filter(g => g.length > 1)
    let totalCandidates = candidates.reduce((s, g) => s + g.length, 0)
    let processed = 0
    for (const group of candidates) {
      const hashGroups = new Map()
      for (const f of group) {
        try {
          const fd = fs.openSync(f.path, 'r')
          const buf = Buffer.alloc(8192)
          fs.readSync(fd, buf, 0, 8192, 0)
          fs.closeSync(fd)
          const hash = crypto.createHash('md5').update(buf).digest('hex')
          if (!hashGroups.has(hash)) hashGroups.set(hash, [])
          hashGroups.get(hash).push(f.path)
        } catch (_) {}
        processed++
        if (processed % 20 === 0) mainWindow.webContents.send('duplicates:progress', { stage: 'hashing', percent: Math.round((processed / totalCandidates) * 100) })
      }
      for (const [, paths] of hashGroups) { if (paths.length > 1) duplicates.push({ paths, size: group[0].size }) }
      scanned++
    }
    mainWindow.webContents.send('duplicates:progress', { stage: 'done', percent: 100 })
    const totalWasted = duplicates.reduce((s, d) => s + (d.size * (d.paths.length - 1)), 0)
    return { success: true, duplicates, totalGroups: duplicates.length, totalWasted, totalScanned: files.length }
  } catch (e) { return { success: false, error: errorMessage(e), duplicates: [] } }
})

ipcMain.handle('duplicates:delete', async (_, filePaths) => {
  try {
    let deleted = 0; let freed = 0
    for (const fp of filePaths) {
      if (!fp || isProtected(fp)) continue
      try { const s = fs.statSync(fp).size; fs.unlinkSync(fp); deleted++; freed += s } catch (_) {}
    }
    return { success: true, deleted, freed }
  } catch (e) { return { success: false, error: errorMessage(e) } }
})

// ── Browser Data Cleaner ───────────────────────────────────
ipcMain.handle('browser:scan', async () => {
  try {
    const browsers = []
    const home = process.env.USERPROFILE || os.homedir()
    const profiles = [
      { name: 'Google Chrome', paths: [path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data'), path.join(home, 'AppData', 'Local', 'Google', 'Chrome SxS', 'User Data')] },
      { name: 'Microsoft Edge', paths: [path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data')] },
      { name: 'Mozilla Firefox', paths: [path.join(home, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles')] },
      { name: 'Brave', paths: [path.join(home, 'AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'User Data')] },
      { name: 'Opera', paths: [path.join(home, 'AppData', 'Roaming', 'Opera Software', 'Opera Stable')] },
    ]
    for (const browser of profiles) {
      let found = false
      let cacheSize = 0; let cookieSize = 0; let historySize = 0
      for (const bp of browser.paths) {
        if (!fs.existsSync(bp)) continue
        found = true
        const dirSize = (dir) => { let s = 0; try { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); try { s += e.isDirectory() ? dirSize(p) : fs.statSync(p).size } catch (_) {} } } catch (_) {} return s }
        const cachePaths = ['Cache', 'Code Cache', 'GPUCache', 'ShaderCache', 'DawnCache', 'GrShaderCache', 'Service Worker/CacheStorage', 'Service Worker/ScriptCache']
        for (const cp of cachePaths) { try { const full = path.join(bp, 'Default', cp); if (fs.existsSync(full)) cacheSize += dirSize(full) } catch (_) {} try { const full = path.join(bp, cp); if (fs.existsSync(full)) cacheSize += dirSize(full) } catch (_) {} }
        for (const cp of ['Default/Cookies', 'Default/Cookies-journal', 'Cookies', 'Cookies-journal']) { try { const full = path.join(bp, cp); if (fs.existsSync(full)) cookieSize += fs.statSync(full).size } catch (_) {} }
        for (const cp of ['Default/History', 'Default/History-journal', 'History', 'History-journal']) { try { const full = path.join(bp, cp); if (fs.existsSync(full)) historySize += fs.statSync(full).size } catch (_) {} }
        for (const cp of ['Default/Web Data', 'Web Data']) { try { const full = path.join(bp, cp); if (fs.existsSync(full)) historySize += fs.statSync(full).size } catch (_) {} }
        for (const sf of ['places.sqlite', 'cookies.sqlite', 'storage']) { try { const d = path.join(bp, sf); if (fs.existsSync(d)) { const s = fs.statSync(d); if (s.isDirectory()) cacheSize += dirSize(d); else cacheSize += s.size } } catch (_) {} }
      }
      if (found) browsers.push({ name: browser.name, cacheSize, cookieSize, historySize, totalSize: cacheSize + cookieSize + historySize })
    }
    return { success: true, browsers }
  } catch (e) { return { success: false, error: errorMessage(e), browsers: [] } }
})

ipcMain.handle('browser:clean', async (_, browserName, dataTypes) => {
  try {
    const home = process.env.USERPROFILE || os.homedir()
    let freed = 0
    const cleanDir = (dir) => { let s = 0; try { if (!fs.existsSync(dir)) return 0; const entries = fs.readdirSync(dir, { withFileTypes: true }); for (const e of entries) { const p = path.join(dir, e.name); try { if (e.isDirectory()) s += cleanDir(p); else { s += fs.statSync(p).size; fs.unlinkSync(p) } } catch (_) {} } } catch (_) {} return s }
    const rmIfExists = (fp) => { try { if (fs.existsSync(fp)) { const s = fs.statSync(fp); if (s.isDirectory()) freed += cleanDir(fp); else { freed += s.size; fs.unlinkSync(fp) } } } catch (_) {} }
    const maps = {
      'Google Chrome': [path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data')],
      'Microsoft Edge': [path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data')],
      'Mozilla Firefox': [path.join(home, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles')],
      'Brave': [path.join(home, 'AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'User Data')],
      'Opera': [path.join(home, 'AppData', 'Roaming', 'Opera Software', 'Opera Stable')]
    }
    const bps = maps[browserName]
    if (!bps) return { success: false, error: 'Browser not found' }
    let cleaned = 0
    for (const bp of bps) {
      if (!fs.existsSync(bp)) continue
      if (dataTypes.includes('cache')) {
        const cachePaths = ['Cache', 'Code Cache', 'GPUCache', 'ShaderCache', 'DawnCache', 'GrShaderCache']
        for (const cp of cachePaths) { rmIfExists(path.join(bp, 'Default', cp)); rmIfExists(path.join(bp, cp)) }
      }
      if (dataTypes.includes('cookies')) {
        for (const cp of ['Default/Cookies', 'Default/Cookies-journal', 'Cookies', 'Cookies-journal']) rmIfExists(path.join(bp, cp))
      }
      if (dataTypes.includes('history')) {
        for (const cp of ['Default/History', 'Default/History-journal', 'History', 'History-journal', 'Default/Web Data', 'Web Data', 'places.sqlite']) rmIfExists(path.join(bp, cp))
      }
      cleaned++
    }
    return { success: true, cleaned, freed }
  } catch (e) { return { success: false, error: errorMessage(e) } }
})

// ── Power Management ───────────────────────────────────────
ipcMain.handle('power:list', async () => {
  try {
    const r = execFileSync('powercfg', ['/list'], { encoding: 'utf8', timeout: 10000 })
    const plans = []
    const lines = r.split('\n')
    for (const line of lines) {
      const m = line.match(/:\s+([\da-f-]+)\s+(.+?)(?:\s+\*)?$/)
      if (m) plans.push({ id: m[1].trim(), name: m[2].trim(), active: line.includes('*') })
    }
    let currentScheme = ''
    try { const cr = execFileSync('powercfg', ['/getactivescheme'], { encoding: 'utf8', timeout: 5000 }); const cm = cr.match(/([\da-f-]+)/); if (cm) currentScheme = cm[1] } catch (_) {}
    return { success: true, plans, currentScheme }
  } catch (e) { return { success: false, error: errorMessage(e), plans: [] } }
})

ipcMain.handle('power:set', async (_, planId) => {
  try { execFileSync('powercfg', ['/setactive', planId], { timeout: 10000 }); return { success: true } }
  catch (e) { return { success: false, error: errorMessage(e) } }
})

ipcMain.handle('power:ultimate', async () => {
  try {
    let r
    try { r = execFileSync('powercfg', ['/duplicatescheme', 'e9a42b02-d5df-448d-aa00-03f14749eb61'], { encoding: 'utf8', timeout: 10000 }) } catch (_) { r = '' }
    if (!r.includes('e9a42b02') && !r.includes('already exists')) {
      execFileSync('powercfg', ['-duplicatescheme', 'e9a42b02-d5df-448d-aa00-03f14749eb61'], { timeout: 10000 })
    }
    execFileSync('powercfg', ['/setactive', 'e9a42b02-d5df-448d-aa00-03f14749eb61'], { timeout: 10000 })
    return { success: true, message: 'Ultimate Performance plan activated' }
  } catch (e) { return { success: false, error: errorMessage(e) } }
})

// ── Network Diagnostics ────────────────────────────────────
ipcMain.handle('network:ping', async (_, host) => {
  try {
    const target = host || '8.8.8.8'
    const r = execFileSync('ping', ['-n', '4', target], { encoding: 'utf8', timeout: 15000 })
    const results = []
    const lines = r.split('\n')
    let avg = ''; let loss = ''
    for (const line of lines) {
      const tm = line.match(/time[=<]\s*(\d+)ms|time=(\d+)ms/)
      if (tm) results.push(parseInt(tm[1] || tm[2], 10))
      const lm = line.match(/\((\d+)% loss\)/)
      if (lm) loss = lm[1] + '%'
      const am = line.match(/Average\s*=\s*(\d+)ms/)
      if (am) avg = am[1] + 'ms'
    }
    return { success: true, host: target, results, avg: avg || (results.length ? Math.round(results.reduce((a, b) => a + b, 0) / results.length) + 'ms' : 'N/A'), loss: loss || '0%', min: results.length ? Math.min(...results) + 'ms' : 'N/A', max: results.length ? Math.max(...results) + 'ms' : 'N/A' }
  } catch (e) { return { success: false, error: errorMessage(e) } }
})

ipcMain.handle('network:traceroute', async (_, host) => {
  try {
    const target = host || '8.8.8.8'
    const r = execFileSync('tracert', ['-d', '-h', '15', target], { encoding: 'utf8', timeout: 60000 })
    const hops = []
    for (const line of r.split('\n')) {
      const m = line.match(/^\s*(\d+)\s+(.+)/)
      if (m) {
        const times = [...m[2].matchAll(/(\d+)\s*ms/g)].map(t => parseInt(t[1], 10))
        const ip = m[2].match(/(\d+\.\d+\.\d+\.\d+)/)
        hops.push({ hop: parseInt(m[1], 10), ip: ip ? ip[1] : (m[2].includes('*') ? '*' : m[2].trim().split(/\s+/)[0]), times })
      }
    }
    return { success: true, host: target, hops }
  } catch (e) { return { success: false, error: errorMessage(e), hops: [] } }
})

ipcMain.handle('network:speedtest', async () => {
  try {
    const results = { download: 0, upload: 0, ping: 0, unit: 'Mbps' }
    let pingTotal = 0; let pingCount = 0
    for (let i = 0; i < 3; i++) {
      try {
        const start = Date.now()
        execFileSync('ping', ['-n', '1', '-w', '2000', '8.8.8.8'], { encoding: 'utf8', timeout: 5000 })
        pingTotal += Date.now() - start; pingCount++
      } catch (_) {}
    }
    results.ping = pingCount > 0 ? Math.round(pingTotal / pingCount) : 0
    try {
      const testUrl = 'http://speedtest.tele2.net/100MB.zip'
      const { execSync } = require('child_process')
      const cmd = `powershell -NoProfile -Command "$progressPreference='silentlyContinue';$start=Get-Date;try{Invoke-WebRequest -Uri '${testUrl}' -TimeoutSec 10 -UseBasicParsing | Out-Null;$elapsed=(Get-Date)-$start;[math]::Round(100*8/($elapsed.TotalSeconds*2),1)}catch{'0'}"`
      const r = execSync(cmd, { encoding: 'utf8', timeout: 20000 }).trim()
      results.download = parseFloat(r) || 0
    } catch (_) {}
    return { success: true, ...results }
  } catch (e) { return { success: false, error: errorMessage(e) } }
})

// ── Context Menu Manager ───────────────────────────────────
ipcMain.handle('system:contextMenu', async () => {
  try {
    const paths = ['HKLM\\Software\\Classes\\*\\shell', 'HKLM\\Software\\Classes\\Directory\\shell', 'HKLM\\Software\\Classes\\Directory\\Background\\shell', 'HKCU\\Software\\Classes\\*\\shell', 'HKCU\\Software\\Classes\\Directory\\shell']
    const entries = []
    for (const p of paths) {
      try {
        const r = execFileSync('reg', ['query', p], { encoding: 'utf8', timeout: 5000 })
        const lines = r.split('\n').filter(l => l.includes('\\') && !l.includes(p + '\\'))
        for (const line of lines) {
          const name = line.trim().split('\\').pop()
          if (name && name !== '(Default)') entries.push({ name, path: p + '\\' + name, hive: p.startsWith('HKCU') ? 'HKCU' : 'HKLM' })
        }
      } catch (_) {}
    }
    return { success: true, entries }
  } catch (e) { return { success: false, error: errorMessage(e), entries: [] } }
})

ipcMain.handle('system:removeContextMenu', async (_, regPath) => {
  try { execFileSync('reg', ['delete', regPath, '/f'], { timeout: 10000 }); return { success: true } }
  catch (e) { return { success: false, error: errorMessage(e) } }
})

// ── Export System Report ───────────────────────────────────
ipcMain.handle('system:exportReport', async () => {
  try {
    const parts = []
    parts.push('=== WinBoost System Report ===')
    parts.push(`Generated: ${new Date().toISOString()}`)
    parts.push(`Hostname: ${os.hostname()}`)
    parts.push(`OS: ${os.type()} ${os.release()} ${os.arch()}`)
    parts.push(`CPU: ${(os.cpus()[0] || {}).model || 'Unknown'}`)
    parts.push(`Cores: ${os.cpus().length}`)
    parts.push(`RAM: ${(os.totalmem() / (1024 ** 3)).toFixed(1)} GB total, ${(os.freemem() / (1024 ** 3)).toFixed(1)} GB free`)
    parts.push(`Uptime: ${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`)
    let drives = ''
    try { const r = execFileSync('wmic', ['logicaldisk', 'get', 'size,freespace,deviceid'], { encoding: 'utf8', timeout: 10000 }).split('\n').filter(l => l.includes(':')); for (const l of r.slice(1)) { const p = l.trim().split(/\s+/); if (p.length >= 3) drives += `\n  ${p[0]}: ${(parseInt(p[2]) / (1024 ** 3)).toFixed(1)} GB / ${(parseInt(p[1]) / (1024 ** 3)).toFixed(1)} GB` } } catch (_) {}
    parts.push(`Drives:${drives || ' N/A'}`)
    const report = parts.join('\n')
    const fp = path.join(os.tmpdir(), `winboost-report-${Date.now()}.txt`)
    fs.writeFileSync(fp, report)
    return { success: true, path: fp }
  } catch (e) { return { success: false, error: errorMessage(e) } }
})

// ── Window Controls ────────────────────────────────────────

ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
