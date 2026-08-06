const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
const { execFile, spawn } = require('child_process')
const { promisify } = require('util')

const execFileAsync = promisify(execFile)
let si
try { si = require('systeminformation') } catch { si = null }

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
  // oxlint-disable-next-line no-control-regex -- strip ANSI terminal color escapes from command output
  return String(text).replace(/\x1b\[[0-9;]*m/g, '').trim().slice(0, 1400)
}

function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function parseJson(text, fallback = null) {
  try { return JSON.parse(String(text || '').replace(/^\uFEFF/, '').trim()) }
  catch { return fallback }
}

function stableId(...parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 20)
}

function psLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function powershellRegistryPath(key) {
  return String(key || '')
    .replace(/^HKLM\\/i, 'Registry::HKEY_LOCAL_MACHINE\\')
    .replace(/^HKCU\\/i, 'Registry::HKEY_CURRENT_USER\\')
    .replace(/^HKCR\\/i, 'Registry::HKEY_CLASSES_ROOT\\')
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
  } catch { return false }
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
  catch { return fallback }
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
  } catch {}
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
  } catch {}
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
  } catch {}
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
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch { continue }
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
      } catch {}
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
    path: category.targets.map(t => t.p×otÒÚ$z{-®éÜj×ä6÷&UÅÅ&Vv—7G'“£¢ö’ÂrrÐ¢–b‚&Vv—7G'•F‚’6öçF–çVPÐ¢6öç7B–BÒ7F&ÆT–B‚wVæ–ç7FÆÂrÂ&Vv—7G'•F‚Â—FVÒææÖRÐ¢6öç7B—77VRÒ°Ð¢–BÂ¶W“¢–BÂæÖS¢t–çfÆ–BVæ–ç7FÆÂVçG'’rÂFƒ¢&Vv—7G'•F‚ÀÐ¢FW63¢G¶—FVÒææÖWÒ&VfW&Væ6W2Ö—76–ærVæ–ç7FÆÆW#¢G¶W†V7WF&ÆWÖÂ6WfW&—G“¢tÆ÷rrÂ6C¢uVæ–ç7FÆÂrÀÐ¢÷W&F–öã¢²¶–æC¢v¶W’rÂ¶W“¢&Vv—7G'•F‚ÒÀÐ¢ÐÐ¢7FFRç&Vv—7G'”—77VW2ç6WB†–BÂ—77VRæ÷W&F–öâÐ¢—77VW2çW6‚†—77VRÐ¢ÐÐ¢6VæB‚w&Vv—7G'“§&öw&W72rÂ²W&6VçC¢Â7FvS¢66â6ö×ÆWFS¢G¶—77VW2æÆVæwF‡ÒfW&–f–VB—77VR‡2–ÒÐ¢&WGW&â—77VW2æÖ‚‡²÷W&F–öã¢ö÷W&F–öâÂââçV&Æ–4—77VRÒ’ÓâV&Æ–4—77VR’ç6Æ–6RƒÂƒÐ§ÐÐ Ð¦—4Ö–âæ†æFÆR‚w&Vv—7G'“§66ârÂ7–æ2‚’Óâ°Ð¢G'’²&WGW&â²7V66W73¢G'VRÂ—77VW3¢v—B66å&Vv—7G'”—77VW2‚’ÒÐÐ¢6F6‚†W'&÷"’²&WGW&â²7V66W73¢fÇ6RÂ—77VW3¢µÒÂW'&÷#¢W'&÷$ÖW76vR†W'&÷"’ÒÐÐ§ÒÐ Ð¦—4Ö–âæ†æFÆR‚w&Vv—7G'“¦f—‚rÂ7–æ2…òÂ—77VT–G2’Óâ°¢6öç7B–G2Ò'&’æ—4'&’†—77VT–G2’ò—77VT–G2¢µÐ¢6öç7B&6·WF—"ÒF‚æ¦ö–â†ævWEF‚‚wW6W$FFr’Ât&6·W2rÂu&Vv—7G'’r¢v—Bg2ç&öÖ—6W2æÖ¶F—"†&6·WF—"Â²&V7W'6—fS¢G'VRÒ¢ÆWBf—†VBÒ ¢6öç7BW'&÷'2ÒµÐ¢6öç7B÷W&F–öç2ÒµÐ¢f÷"†6öç7B–Böb–G2’°¢6öç7B÷W&F–öâÒ7FFRç&Vv—7G'”—77VW2ævWB†–B¢–b‚÷W&F–öâ’W'&÷'2çW6‚‚töæR6VÆV7FVB—77VR—2æòÆöævW"fÆ–C²ÆV6R&W66ââr¢VÇ6R÷W&F–öç2çW6‚‡²–BÂ÷W&F–öâÂ&6·W¢F‚æ¦ö–â†&6·WF—"ÂG´FFRææ÷r‚—ÒÒG¶–GÒç&Vv’Ò¢Ð ¢6öç7BVÆWfFVBÒv—B—4VÆWfFVB‚¢6öç7BÖ6†–æT÷W&F–öç2Ò÷W&F–öç2æf–ÇFW"†—FVÒÓâõâƒó¤„´U•ôÄô4ÅôÔ4„”äWÄ„´ÄÒ’ö’çFW7B†—FVÒæ÷W&F–öâæ¶W’’¢6öç7BF—&V7D÷W&F–öç2Ò÷W&F–öç2æf–ÇFW"†—FVÒÓâVÆWfFVBÇÂõâƒó¤„´U•ôÄô4ÅôÔ4„”äWÄ„´ÄÒ’ö’çFW7B†—FVÒæ÷W&F–öâæ¶W’’ ¢–b†Ö6†–æT÷W&F–öç2æÆVæwF‚bbVÆWfFVB’°¢6öç7B&Æö6·2ÒÖ6†–æT÷W&F–öç2æÖ‚‡²–BÂ÷W&F–öâÂ&6·WÒ’Óâ §G'’°¢b&VræW†RW‡÷'BG·4Æ—FW&Â†÷W&F–öâæ¶W’—ÒG·4Æ—FW&Â†&6·W—Ò÷’Â÷WBÔçVÆÀ¢–b‚DÄ5DU„•D4ôDRÖæR’²F‡&÷ruVæ&ÆRFò7&VFR&Vv—7G'’&6·WârÐ¢G¶÷W&F–öâæ¶–æBÓÓÒwfÇVRp¢ò&VÖ÷fRÔ—FVÕ&÷W'G’ÔÆ—FW&ÅF‚G·4Æ—FW&Â‡÷vW'6†VÆÅ&Vv—7G'•F‚†÷W&F–öâæ¶W’’—ÒÔæÖRG·4Æ—FW&Â†÷W&F–öâçfÇVTæÖR—ÒÔW'&÷$7F–öâ7F÷ ¢¢&VÖ÷fRÔ—FVÒÔÆ—FW&ÅF‚G·4Æ—FW&Â‡÷vW'6†VÆÅ&Vv—7G'•F‚†÷W&F–öâæ¶W’’—ÒÕ&V7W'6RÔW'&÷$7F–öâ7F÷Ð¢G&W7VÇG2³Ò·67W7FöÖö&¦V7EÔ²–BÒG·4Æ—FW&Â†–B—Ó²7V66W72ÒGG'VS²W'&÷"ÒrrÐ§Ò6F6‚°¢G&W7VÇG2³Ò·67W7FöÖö&¦V7EÔ²–BÒG·4Æ—FW&Â†–B—Ó²7V66W72ÒFfÇ6S²W'&÷"Ò·7G&–æuÒEòäW†6WF–öâäÖW76vRÐ§Ö’æ¦ö–â‚uÆâr¢6öç7B67&—BÒDW'&÷$7F–öå&VfW&Væ6RÒu7F÷p¢G&W7VÇG2Ò‚¢G¶&Æö6·7Ð¤‚G&W7VÇG2’Â6öçfW'EFòÔ§6öâÔ6ö×&W72ÔFWF‚6 ¢G'’°¢6öç7B&W7VÇBÒv—B'VäVÆWfFVE÷vW%6†VÆÂ‚u&W—"fW&–f–VB&Vv—7G'’—77VW2rÂ67&—BÂR¢c¢¢f÷"†6öç7B—FVÒöb4'&’‡'6T§6öâ‡&W7VÇBæ÷WGWBÂµÒ’’æf–ÇFW"„&ööÆVâ’’°¢–b†—FVÒç7V66W72’²7FFRç&Vv—7G'”—77VW2æFVÆWFR†—FVÒæ–B“²f—†VB²²Ð¢VÇ6RW'&÷'2çW6‚†G¶—FVÒæ–GÓ¢G¶—FVÒæW'&÷"ÇÂu&Vv—7G'’&W—"f–ÆVBâwÖ¢Ð¢Ò6F6‚†W'&÷"’²W'&÷'2çW6‚†W'&÷$ÖW76vR†W'&÷"’’Ð¢Ð ¢f÷"†6öç7B²–BÂ÷W&F–öâÂ&6·WÒöbF—&V7D÷W&F–öç2’°¢G'’°¢v—B'VäW†R‚w&VræW†RrÂ²vW‡÷'BrÂ÷W&F–öâæ¶W’Â&6·WÂr÷’uÒÂ²F–ÖV÷WC¢#Ò¢6öç7B&w2Ò÷W&F–öâæ¶–æBÓÓÒwfÇVRrò²vFVÆWFRrÂ÷W&F–öâæ¶W’Âr÷brÂ÷W&F–öâçfÇVTæÖRÂröbuÒ¢²vFVÆWFRrÂ÷W&F–öâæ¶W’ÂröbuÐ¢v—B'VäW†R‚w&VræW†RrÂ&w2Â²F–ÖV÷WC¢SÒ¢7FFRç&Vv—7G'”—77VW2æFVÆWFR†–B“²f—†VB²°¢Ò6F6‚†W'&÷"’²W'&÷'2çW6‚†W'&÷$ÖW76vR†W'&÷"’’Ð¢Ð¢v—BFD†—7F÷'’‚u&Vv—7G'’&W—"rÂG¶f—†VGÒfW&–f–VB—77VR‡2’&W—&VC²&6·W6fVFÂW'&÷'2æÆVæwF‚òwv&æ–ærr¢w7V66W72rÐ¢&WGW&â²7V66W73¢W'&÷'2æÆVæwF‚ÓÓÒÂf—†VBÂW'&÷'3¢W'&÷'2ç6Æ–6RƒÂ#’Â&6·WF—"ÐÐ§ÒÐ Ð¦—4Ö–âæ†æFÆR‚w&Vv—7G'“¦÷Vä&6·W2rÂ7–æ2‚’Óâ°Ð¢6öç7B&6·WF—"ÒF‚æ¦ö–â†ævWEF‚‚wW6W$FFr’Ât&6·W2rÂu&Vv—7G'’rÐ¢v—Bg2ç&öÖ—6W2æÖ¶F—"†&6·WF—"Â²&V7W'6—fS¢G'VRÒÐ¢6öç7BW'&÷"Òv—B6†VÆÂæ÷VåF‚†&6·WF—"Ð¢&WGW&âW'&÷"ò²7V66W73¢fÇ6RÂW'&÷"Ò¢²7V66W73¢G'VRÐÐ§ÒÐ Ð¦6öç7B$•d5•õ5T52Ò°Ð¢²w&÷W¢uFVÆVÖWG'’bFF6öÆÆV7F–öârÂæÖS¢tF–væ÷7F–2FFrÂFW63¢tÆ–Ö—B÷F–öæÂF–væ÷7F–2FF6VçBFòÖ–7&÷6ögBrÂ¶W“¢t„´ÄÕÅÅ4ôeEt$UÅÅöÆ–6–W5ÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄFF6öÆÆV7F–öârÂfÇVS¢tÆÆ÷uFVÆVÖWG'’rÂG—S¢u$TuôEtõ$BrÂöã¢s2rÂöfc¢srÂFVfVÇDVæ&ÆVC¢G'VRÂFÖ–ã¢G'VRÒÀÐ¢²w&÷W¢uFVÆVÖWG'’bFF6öÆÆV7F–öârÂæÖS¢uF–Æ÷&VBW‡W&–Væ6W2rÂFW63¢uW6RF–væ÷7F–2FFf÷"W'6öæÆ—¦VBF—2æBG2rÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÅ&—f7’rÂfÇVS¢uF–Æ÷&VDW‡W&–Væ6W5v—F„F–væ÷7F–4FFVæ&ÆVBrÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÂFVfVÇDVæ&ÆVC¢G'VRÒÀÐ¢²w&÷W¢uFVÆVÖWG'’bFF6öÆÆV7F–öârÂæÖS¢tGfW'F—6–ær”BrÂFW63¢tÆWBv–æF÷w22W6R–÷W"GfW'F—6–ær–FVçF–f–W"rÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÄGfW'F—6–æt–æfòrÂfÇVS¢tVæ&ÆVBrÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÂFVfVÇDVæ&ÆVC¢G'VRÒÀÐ¢²w&÷W¢tÆö6F–öâb6Vç6÷'2rÂæÖS¢tÆö6F–öâ6W'f–6W2rÂFW63¢tÆÆ÷rFW6·F÷æB7F÷&R2Fò66W72Æö6F–öârÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÄ6&–Æ—G”66W74ÖævW%ÅÄ6öç6VçE7F÷&UÅÆÆö6F–öârÂfÇVS¢ufÇVRrÂG—S¢u$Tuõ5¢rÂöã¢tÆÆ÷rrÂöfc¢tFVç’rÂFVfVÇDVæ&ÆVC¢G'VRÒÀÐ¢²w&÷W¢t6ÖW&bÖ–7&÷†öæRrÂæÖS¢t6ÖW&66W72rÂFW63¢tÆÆ÷rÆ–6F–öç2FòW6RF†R6ÖW&rÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÄ6&–Æ—G”66W74ÖævW%ÅÄ6öç6VçE7F÷&UÅÇvV&6ÒrÂfÇVS¢ufÇVRrÂG—S¢u$Tuõ5¢rÂöã¢tÆÆ÷rrÂöfc¢tFVç’rÂFVfVÇDVæ&ÆVC¢G'VRÒÀÐ¢²w&÷W¢t6ÖW&bÖ–7&÷†öæRrÂæÖS¢tÖ–7&÷†öæR66W72rÂFW63¢tÆÆ÷rÆ–6F–öç2FòW6RF†RÖ–7&÷†öæRrÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÄ6&–Æ—G”66W74ÖævW%ÅÄ6öç6VçE7F÷&UÅÆÖ–7&÷†öæRrÂfÇVS¢ufÇVRrÂG—S¢u$Tuõ5¢rÂöã¢tÆÆ÷rrÂöfc¢tFVç’rÂFVfVÇDVæ&ÆVC¢G'VRÒÀÐ¢²w&÷W¢t7F—f—G’b–çWBrÂæÖS¢t7F—f—G’†—7F÷'’rÂFW63¢uV&Æ—6‚7F—f—G’†—7F÷'’g&öÒF†—2v–æF÷w266÷VçBrÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÅ&—f7’rÂfÇVS¢uV&Æ—6…W6W$7F—f—F–W2rÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÂFVfVÇDVæ&ÆVC¢G'VRÒÀÐ¢²w&÷W¢t7F—f—G’b–çWBrÂæÖS¢t6Æ—&ö&B7–æ2rÂFW63¢tÆÆ÷r6Æ—&ö&B6öçFVçBFò&öÒ&WGvVVâFWf–6W2rÂ¶W“¢t„´ÄÕÅÅ4ôeEt$UÅÅöÆ–6–W5ÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÅ7—7FVÒrÂfÇVS¢tÆÆ÷t7&÷74FWf–6T6Æ—&ö&BrÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÂFVfVÇDVæ&ÆVC¢G'VRÂFÖ–ã¢G'VRÒÀÐ¢²w&÷W¢t7F—f—G’b–çWBrÂæÖS¢t–æ¶–ærbG—–ærrÂFW63¢tÆÆ÷r–×Æ–6—BG—–ærFF6öÆÆV7F–öârÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÄ–çWEW'6öæÆ—¦F–öârÂfÇVS¢u&W7G&–7D–×Æ–6—EFW‡D6öÆÆV7F–öârÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÂFVfVÇDVæ&ÆVC¢G'VRÒÀÐ¢²w&÷W¢u&V6öÖÖVæFF–öç2rÂæÖS¢u7VvvW7FVB6öçFVçBrÂFW63¢u6†÷r7VvvW7FVB6öçFVçB–ç6–FRv–æF÷w26WGF–æw2rÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÄ6öçFVçDFVÆ—fW'”ÖævW"rÂfÇVS¢u7V'67&–&VD6öçFVçBÓ33ƒ3“4Væ&ÆVBrÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÂFVfVÇDVæ&ÆVC¢G'VRÒÀÐ¢²w&÷W¢u&V6öÖÖVæFF–öç2rÂæÖS¢tÆVæ6‚G&6¶–ærrÂFW63¢uG&6²ÆVæ6†W2Fò–×&÷fR7F'BæB6V&6‚rÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÄW‡Æ÷&W%ÅÄGfæ6VBrÂfÇVS¢u7F'EõG&6µ&öw2rÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÂFVfVÇDVæ&ÆVC¢G'VRÒÀÐ¥ÐÐ Ð¦7–æ2gVæ7F–öâVW'•&VufÇVR‡7V2’°Ð¢G'’°Ð¢6öç7B²7FF÷WBÒÒv—B'VäW†R‚w&VræW†RrÂ²wVW'’rÂ7V2æ¶W’Âr÷brÂ7V2çfÇVUÒÂ²F–ÖV÷WC¢ƒÒÐ¢6öç7BÆ–æRÒ7FF÷WBç7Æ—B‚õÇ#õÆâò’æf–æB‡&÷rÓâ&÷ræ–æ6ÇVFW2‡7V2çfÇVR’bb&÷ræ–æ6ÇVFW2‚u$Tuòr’Ð¢–b‚Æ–æR’&WGW&âçVÆÀÐ¢&WGW&âÆ–æRçG&–Ò‚’ç7Æ—B‚õÇ7³"ÇÒò’ç6Æ–6Rƒ"’æ¦ö–â‚rr’çG&–Ò‚Ð¢Ò6F6‚²&WGW&âçVÆÂÐ§ÐÐ Ð¦7–æ2gVæ7F–öâ6WE&Vv—7G'•7V2‡7V2ÂVæ&ÆVB’°Ð¢6öç7BFFÒVæ&ÆVBò7V2æöâ¢7V2æöf`Ð¢–b‡7V2æFÖ–âbb†v—B—4VÆWfFVB‚’’’°Ð¢6öç7B6öÖÖæBÒ&VræW†RFB"G·7V2æ¶W—Ò"÷b"G·7V2çfÇVWÒ"÷BG·7V2çG—WÒöB"G¶FFÒ"öf Ð¢&WGW&â'VäVÆWfFVD6öÖÖæB‡7V2ææÖRÂ6öÖÖæBÂ#Ð¢ÐÐ¢v—B'VäW†R‚w&VræW†RrÂ²vFBrÂ7V2æ¶W’Âr÷brÂ7V2çfÇVRÂr÷BrÂ7V2çG—RÂröBrÂFFÂröbuÒÂ²F–ÖV÷WC¢#ÒÐ¢&WGW&â²7V66W73¢G'VRÐÐ§ÐÐ Ð¦7–æ2gVæ7F–öâÆ—7E&—f7•6WGF–æw2‚’°Ð¢6öç7Bw&÷W2ÒæWrÖ‚Ð¢f÷"†6öç7B7V2öb$•d5•õ5T52’°Ð¢6öç7BfÇVRÒv—BVW'•&VufÇVR‡7V2Ð¢ÆWBVæ&ÆVBÒ7V2æFVfVÇDVæ&ÆV@Ð¢–b‡fÇVRÓÒçVÆÂ’°Ð¢6öç7Bæ÷&ÖÆ—¦VBÒ7V2çG—RÓÓÒu$TuôEtõ$Brò7G&–ær„çVÖ&W"ç'6T–çB‡fÇVRÂfÇVRç7F'G5v—F‚‚s‚r’òb¢’’¢fÇVPÐ¢Væ&ÆVBÒæ÷&ÖÆ—¦VBçFôÆ÷vW$66R‚’ÓÓÒ7G&–ær‡7V2æöâ’çFôÆ÷vW$66R‚Ð¢ÐÐ¢–b‚w&÷W2æ†2‡7V2æw&÷W’’w&÷W2ç6WB‡7V2æw&÷WÂµÒÐ¢w&÷W2ævWB‡7V2æw&÷W’çW6‚‡²æÖS¢7V2ææÖRÂFW63¢7V2æFW62ÂVæ&ÆVBÂ&WV—&W4FÖ–ã¢&ööÆVâ‡7V2æFÖ–â’ÂÖævVC¢fÇVRÓÒçVÆÂÒÐ¢ÐÐ¢&WGW&â²ââæw&÷W2æVçG&–W2‚•ÒæÖ‚…¶6FVv÷'’Â—FV×5Ò’Óâ‡²6FVv÷'’Â—FV×2Ò’Ð§ÐÐ Ð¦—4Ö–âæ†æFÆR‚w&—f7“¦Æ—7BrÂ7–æ2‚’Óâ°Ð¢G'’²&WGW&â²7V66W73¢G'VRÂw&÷W3¢v—BÆ—7E&—f7•6WGF–æw2‚’ÒÐÐ¢6F6‚†W'&÷"’²&WGW&â²7V66W73¢fÇ6RÂw&÷W3¢µÒÂW'&÷#¢W'&÷$ÖW76vR†W'&÷"’ÒÐÐ§ÒÐ Ð¦—4Ö–âæ†æFÆR‚w&—f7“§6WBrÂ7–æ2…òÂæÖRÂVæ&ÆVB’Óâ°Ð¢6öç7B7V2Ò$•d5•õ5T52æf–æB†—FVÒÓâ—FVÒææÖRÓÓÒæÖRÐ¢–b‚7V2’&WGW&â²7V66W73¢fÇ6RÂW'&÷#¢uVæ¶æ÷vâ&—f7’6WGF–ærârÐÐ¢G'’°Ð¢v—B6WE&Vv—7G'•7V2‡7V2Â&ööÆVâ†Væ&ÆVB’Ð¢v—BFD†—7F÷'’‚u&—f7’6WGF–ærrÂG¶æÖWÓ¢G¶Væ&ÆVBòvVæ&ÆVBr¢vF—6&ÆVBwÖÂw7V66W72rÐ¢&WGW&â²7V66W73¢G'VRÂVæ&ÆVC¢&ööÆVâ†Væ&ÆVB’ÐÐ¢Ò6F6‚†W'&÷"’²&WGW&â²7V66W73¢fÇ6RÂW'&÷#¢W'&÷$ÖW76vR†W'&÷"’ÂFÖ–å&WV—&VC¢&ööÆVâ‡7V2æFÖ–â’ÒÐÐ§ÒÐ Ð¦—4Ö–âæ†æFÆR‚w&—f7“§&V6öÖÖVæFVBrÂ7–æ2‚’Óâ°Ð¢ÆWBÆ–VBÒ Ð¢6öç7BW'&÷'2ÒµÐÐ¢f÷"†6öç7B7V2öb$•d5•õ5T52’°Ð¢G'’²v—B6WE&Vv—7G'•7V2‡7V2ÂfÇ6R“²Æ–VB²²ÐÐ¢6F6‚†W'&÷"’²W'&÷'2çW6‚†G·7V2ææÖWÓ¢G¶W'&÷$ÖW76vR†W'&÷"—Ö’ÐÐ¢ÐÐ¢v—BFD†—7F÷'’‚u&—f7’&öf–ÆRrÂG¶Æ–VGÒ&—f7’6öçG&öÇ2†&FVæVFÂW'&÷'2æÆVæwF‚òwv&æ–ærr¢w7V66W72rÐ¢&WGW&â²7V66W73¢W'&÷'2æÆVæwF‚ÓÓÒÂÆ–VBÂW'&÷'2ÐÐ§ÒÐ Ð¦6öç7BU$dõ$Ôä4Uõ5T52Ò°Ð¢²æÖS¢u&VGV6VBf—7VÂVffV7G2rÂFW63¢tÆWBv–æF÷w2ff÷"&W7öç6—fVæW72÷fW"FV6÷&F—fRVffV7G2rÂ–×7C¢t†–v‚rÂ6C¢uf—7VÂrÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÄW‡Æ÷&W%ÅÅf—7VÄVffV7G2rÂfÇVS¢uf—7VÄe…6WGF–ærrÂG—S¢u$TuôEtõ$BrÂöã¢s"rÂöfc¢srÒÀÐ¢²æÖS¢tvÖRÖöFRrÂFW63¢u&–÷&—F—¦RvÖRv÷&¶ÆöG2v†Vâ7W÷'FVBrÂ–×7C¢t†–v‚rÂ6C¢tvÖ–ærrÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÄvÖT&"rÂfÇVS¢tWFôvÖTÖöFTVæ&ÆVBrÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÒÀÐ¢²æÖS¢tÆ–Ö—B&6¶w&÷VæB2rÂFW63¢u&VGV6R&6¶w&÷VæBW†V7WF–öâf÷"7F÷&RÆ–6F–öç2rÂ–×7C¢t†–v‚rÂ6C¢u7—7FVÒrÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÄ&6¶w&÷VæD66W74Æ–6F–öç2rÂfÇVS¢tvÆö&ÅW6W$F—6&ÆVBrÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÒÀÐ¢²æÖS¢tF—6&ÆRv–æF÷w2F—2rÂFW63¢u7F÷&öÖ÷F–öæÂF—2æB7VvvW7F–öâæ÷F–f–6F–öç2rÂ–×7C¢tÆ÷rrÂ6C¢u7—7FVÒrÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÄ6öçFVçDFVÆ—fW'”ÖævW"rÂfÇVS¢u7V'67&–&VD6öçFVçBÓ33ƒ3ƒ”Væ&ÆVBrÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÒÀÐ¢²æÖS¢u&VÖ÷fR7F'GWFVÆ’rÂFW63¢u&VGV6RF†R'F–f–6–ÂFVÆ’&Vf÷&R7F'GW2'VârÂ–×7C¢tÖVF—VÒrÂ6C¢u7F'GWrÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÄW‡Æ÷&W%ÅÅ6W&–Æ—¦RrÂfÇVS¢u7F'GWFVÆ”–äÕ6V2rÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÒÀÐ¢²æÖS¢tF—6&ÆRG&ç7&Væ7’rÂFW63¢u&VGV6RuRv÷&²W6VB'’7'–Æ–2æBG&ç7&Væ7’VffV7G2rÂ–×7C¢tÖVF—VÒrÂ6C¢uf—7VÂrÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÅF†VÖW5ÅÅW'6öæÆ—¦RrÂfÇVS¢tVæ&ÆUG&ç7&Væ7’rÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÒÀÐ¢²æÖS¢tF—6&ÆRvÖR&V6÷&F–ærrÂFW63¢uGW&âöfb&6¶w&÷VæBvÖREe"6GW&RrÂ–×7C¢tÖVF—VÒrÂ6C¢tvÖ–ærrÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÄvÖTEe"rÂfÇVS¢t6GW&TVæ&ÆVBrÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÒÀÐ¢²æÖS¢tf7FW"ÖVçW2rÂFW63¢u&VGV6RF†Rv–æF÷w2ÖVçRF—7Æ’FVÆ’rÂ–×7C¢tÆ÷rrÂ6C¢uf—7VÂrÂ¶W“¢t„´5UÅÄ6öçG&öÂæVÅÅÄFW6·F÷rÂfÇVS¢tÖVçU6†÷tFVÆ’rÂG—S¢u$Tuõ5¢rÂöã¢srÂöfc¢sCrÒÀÐ¢²æÖS¢u7F÷&vR6Vç6RrÂFW63¢tÆWBv–æF÷w2WFöÖF–6ÆÇ’ÖævRFV×÷&'’7F÷&vRrÂ–×7C¢tÖVF—VÒrÂ6C¢tF—6²rÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÅ7F÷&vU6Vç6UÅÅ&ÖWFW'5ÅÅ7F÷&vUöÆ–7’rÂfÇVS¢srÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÒÀÐ¢²æÖS¢tF—6&ÆR6V&6‚†–v†Æ–v‡G2rÂFW63¢u&VÖ÷fRG–æÖ–2vV"†–v†Æ–v‡G2g&öÒF†R6V&6‚&÷‚rÂ–×7C¢tÆ÷rrÂ6C¢u7—7FVÒrÂ¶W“¢t„´5UÅÅ6ögGv&UÅÄÖ–7&÷6ögEÅÅv–æF÷w5ÅÄ7W'&VçEfW'6–öåÅÅ6V&6…6WGF–æw2rÂfÇVS¢t—4G–æÖ–56V&6„&÷„Væ&ÆVBrÂG—S¢u$TuôEtõ$BrÂöã¢srÂöfc¢srÒÀÐ¥ÐÐ Ð¦7–æ2gVæ7F–öâÆ—7EW&f÷&Öæ6UGvV·2‚’°Ð¢6öç7B&W7VÇBÒµÐÐ¢f÷"†6öç7B7V2öbU$dõ$Ôä4Uõ5T52’°Ð¢6öç7BfÇVRÒv—BVW'•&VufÇVR‡7V2Ð¢6öç7Bæ÷&ÖÆ—¦VBÒfÇVRÓÓÒçVÆÂòçVÆÂ¢7V2çG—RÓÓÒu$TuôEtõ$Brò7G&–ær„çVÖ&W"ç'6T–çB‡fÇVRÂfÇVRç7F'G5v—F‚‚s‚r’òb¢’’¢fÇVPÐ¢&W7VÇBçW6‚‡²æÖS¢7V2ææÖRÂFW63¢7V2æFW62Â–×7C¢7V2æ–×7BÂ6C¢7V2æ6BÂÆ–VC¢æ÷&ÖÆ—¦VBÓÓÒ7V2æöâÂ7W'&VçC¢æ÷&ÖÆ—¦VBÒÐ¢ÐÐ¢&WGW&â&W7VÇ@Ð§ÐÐ Ð¦7–æ2gVæ7F–öâ6WEW&f÷&Öæ6UGvV²†æÖRÂVæ&ÆVB’°Ð¢6öç7B7V2ÒU$dõ$Ôä4Uõ5T52æf–æB†—FVÒÓâ—FVÒææÖRÓÓÒæÖRÐ¢–b‚7V2’&WGW&â²7V66W73¢fÇ6RÂW'&÷#¢uVæ¶æ÷vâW&f÷&Öæ6R6WGF–ærârÐÐ¢G'’°Ð¢v—B6WE&Vv—7G'•7V2‡7V2Â&ööÆVâ†Væ&ÆVB’Ð¢v—BFD†—7F÷'’‚uW&f÷&Öæ6R6WGF–ærrÂG¶æÖWÓ¢G¶Væ&ÆVBòv÷F–Ö—¦VBr¢w&W7F÷&VBwÖÂw7V66W72rÐ¢&WGW&â²7V66W73¢G'VRÂÆ–VC¢&ööÆVâ†Væ&ÆVB’ÐÐ¢Ò6F6‚†W'&÷"’²&WGW&â²7V66W73¢fÇ6RÂW'&÷#¢W'&÷$ÖW76vR†W'&÷"’ÒÐÐ§ÐÐ Ð¦—4Ö–âæ†æFÆR‚wW&f÷&Öæ6S¦Æ—7BrÂ7–æ2‚’Óâ°Ð¢G'’²&WGW&â²7V66W73¢G'VRÂGvV·3¢v—BÆ—7EW&f÷&Öæ6UGvV·2‚’ÒÐÐ¢6F6‚†W'&÷"’²&WGW&â²7V66W73¢fÇ6RÂGvV·3¢µÒÂW'&÷#¢W'&÷$ÖW76vR†W'&÷"’ÒÐÐ§ÒÐ¦—4Ö–âæ†æFÆR‚wW&f÷&Öæ6S§6WBrÂ7–æ2…òÂæÖRÂVæ&ÆVB’Óâ6WEW&f÷&Öæ6UGvV²†æÖRÂVæ&ÆVB’Ð¦—4Ö–âæ†æFÆR‚wW&f÷&Öæ6S¦Ç’rÂ7–æ2…òÂæÖR’Óâ6WEW&f÷&Öæ6UGvV²†æÖRÂG'VR’Ð¦—4Ö–âæ†æFÆR‚wW&f÷&Öæ6S¦Ç”ÆÂrÂ7–æ2‚’Óâ°Ð¢ÆWBÆ–VBÒ Ð¢6öç7BW'&÷'2ÒµÐÐ¢f÷"†6öç7B7V2öbU$dõ$Ôä4Uõ5T52’°Ð¢6öç7B&W7VÇBÒv—B6WEW&f÷&Öæ6UGvV²‡7V2ææÖRÂG'VRÐ¢–b‡&W7VÇBç7V66W72’Æ–VB²°Ð¢VÇ6RW'&÷'2çW6‚†G·7V2ææÖWÓ¢G·&W7VÇBæW'&÷'ÖÐ¢ÐÐ¢&WGW&â²7V66W73¢W'&÷'2æÆVæwF‚ÓÓÒÂÆ–VBÂW'&÷'2ÐÐ§ÒÐ Ð¦—4Ö–âæöâ‚wv–æF÷rÖÖ–æ–Ö—¦RrÂ‚’ÓâÖ–åv–æF÷sòæÖ–æ–Ö—¦R‚’Ð¦—4Ö–âæöâ‚wv–æF÷rÖÖ†–Ö—¦RrÂ‚’Óâ°Ð¢–b†Ö–åv–æF÷sòæ—4Ö†–Ö—¦VB‚’’Ö–åv–æF÷rçVæÖ†–Ö—¦R‚Ð¢VÇ6RÖ–åv–æF÷sòæÖ†–Ö—¦R‚Ð§ÒÐ¦—4Ö–âæöâ‚wv–æF÷rÖ6Æ÷6RrÂ‚’ÓâÖ–åv–æF÷sòæ6Æ÷6R‚’Ð Ð¦çv†Vå&VG’‚’çF†Vâ†7&VFUv–æF÷rÐ¦æöâ‚wv–æF÷rÖÆÂÖ6Æ÷6VBrÂ‚’Óâ²–b‡&ö6W72çÆFf÷&ÒÓÒvF'v–âr’çV—B‚’ÒÐ¦æöâ‚v7F—fFRrÂ‚’Óâ²–b„'&÷w6W%v–æF÷rævWDÆÅv–æF÷w2‚’æÆVæwF‚ÓÓÒ’7&VFUv–æF÷r‚’ÒÐ 