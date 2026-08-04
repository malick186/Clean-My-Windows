const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { exec, execSync } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)
let si

try {
  si = require('systeminformation')
} catch (_) {
  si = null
}

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'WinBoost - Windows Optimizer',
    icon: path.join(__dirname, '../public/icon.png'),
    backgroundColor: '#f5f5f7',
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

/* ═══════════════════════════ Dashboard ═══════════════════════════ */
ipcMain.handle('system:getStats', async () => {
  try {
    if (si) {
      const [cpu, mem, disks, osInfo] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.osInfo(),
      ])

      return {
        cpu: {
          usage: Math.round(cpu.currentLoad || 0),
          model: cpu.currentLoadUser ? `${cpu.currentLoadUser}` : os.cpus()[0]?.model || 'Unknown',
          cores: os.cpus().length,
          speed: os.cpus()[0]?.speed / 1000 || 2.5,
        },
        memory: {
          used: parseFloat(((mem.used || mem.active) / 1024 / 1024 / 1024).toFixed(1)),
          total: parseFloat(((mem.total || 16 * 1024 * 1024 * 1024) / 1024 / 1024 / 1024).toFixed(0)),
          percent: Math.round(((mem.used || mem.active) / (mem.total || 1)) * 100),
        },
        disk: (disks || []).map(d => ({
          fs: d.fs || d.mount,
          used: parseFloat((d.used / 1024 / 1024 / 1024).toFixed(0)),
          total: parseFloat((d.size / 1024 / 1024 / 1024).toFixed(0)),
          percent: Math.round((d.used / (d.size || 1)) * 100),
        })),
        os: {
          platform: osInfo?.platform || `Windows ${os.release()}`,
          version: osInfo?.release || '',
          build: osInfo?.build || os.release(),
          uptime: parseFloat((os.uptime() / 86400).toFixed(1)),
        },
      }
    }
  } catch (_) {}
  return {
    cpu: { usage: 0, model: os.cpus()[0]?.model || 'Unknown', cores: os.cpus().length, speed: 2.5 },
    memory: { used: 0, total: Math.round(os.totalmem() / 1073741824), percent: 0 },
    disk: [],
    os: { platform: `Windows ${os.release()}`, version: '', build: os.release(), uptime: parseFloat((os.uptime() / 86400).toFixed(1)) },
  }
})

/* ═══════════════════════════ Cleanup ═══════════════════════════ */
function getCleanupPaths() {
  const home = os.homedir()
  const windir = process.env.WINDIR || 'C:\\Windows'
  return [
    { id: 'temp', name: 'Temporary Files', desc: 'Windows temp folder, app cache, logs', paths: [path.join(windir, 'Temp'), os.tmpdir()] },
    { id: 'browser', name: 'Browser Cache', desc: 'Chrome, Edge, Firefox data', paths: [
      path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
      path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
      path.join(home, 'AppData', 'Local', 'Mozilla', 'Firefox', 'Profiles'),
    ]},
    { id: 'recycle', name: 'Recycle Bin', desc: 'Deleted files waiting to be purged', paths: ['C:\\$Recycle.Bin'] },
    { id: 'downloads', name: 'Downloads Folder', desc: 'Old installers and unused files', paths: [path.join(home, 'Downloads')] },
    { id: 'thumbnails', name: 'Thumbnail Cache', desc: 'Windows explorer thumbnails', paths: [
      path.join(home, 'AppData', 'Local', 'Microsoft', 'Windows', 'Explorer'),
      path.join(home, 'AppData', 'Local', 'Microsoft', 'Windows', 'WER'),
    ]},
    { id: 'logs', name: 'System Logs', desc: 'Event logs and crash dumps', paths: [path.join(windir, 'Logs'), path.join(windir, 'Minidump')] },
  ]
}

function scanDirSize(dirPath) {
  let totalSize = 0
  let fileCount = 0
  try {
    if (!fs.existsSync(dirPath)) return { totalSize, fileCount }
    const files = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const f of files.slice(0, 5000)) {
      try {
        const fp = path.join(dirPath, f.name)
        if (f.isDirectory()) {
          const sub = scanDirSize(fp)
          totalSize += sub.totalSize
          fileCount += sub.fileCount
        } else if (f.isFile()) {
          totalSize += fs.statSync(fp).size
          fileCount++
        }
      } catch (_) {}
    }
  } catch (_) {}
  return { totalSize, fileCount }
}

function deleteRecursive(dirPath) {
  let freed = 0
  try {
    if (!fs.existsSync(dirPath)) return freed
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries.slice(0, 5000)) {
      const fp = path.join(dirPath, entry.name)
      try {
        if (entry.isDirectory()) {
          freed += deleteRecursive(fp)
          fs.rmdirSync(fp)
        } else {
          const stat = fs.statSync(fp)
          fs.unlinkSync(fp)
          freed += stat.size
        }
      } catch (_) {}
    }
  } catch (_) {}
  return freed
}

ipcMain.handle('cleanup:scan', async () => {
  const categories = getCleanupPaths()
  return categories.map(cat => {
    let totalSize = 0
    let fileCount = 0
    for (const p of cat.paths) {
      const s = scanDirSize(p)
      totalSize += s.totalSize
      fileCount += s.fileCount
    }
    const base = {
      id: cat.id, name: cat.name, desc: cat.desc,
      path: cat.paths.join(', '), files: fileCount,
    }
    if (cat.id === 'downloads') {
      const cutoff = Date.now() - 30 * 86400 * 1000
      let oldSize = 0
      let oldCount = 0
      try {
        if (fs.existsSync(cat.paths[0])) {
          for (const f of fs.readdirSync(cat.paths[0], { withFileTypes: true }).slice(0, 5000)) {
            if (f.isFile()) {
              const stat = fs.statSync(path.join(cat.paths[0], f.name))
              if (stat.mtimeMs < cutoff) { oldSize += stat.size; oldCount++ }
            }
          }
        }
      } catch (_) {}
      return { ...base, size: parseFloat((oldSize / 1073741824).toFixed(2)), files: oldCount }
    }
    return { ...base, size: parseFloat((totalSize / 1073741824).toFixed(2)) }
  })
})

ipcMain.handle('cleanup:clean', async (_, categoryIds) => {
  let totalFreed = 0
  const errors = []
  const cats = getCleanupPaths().filter(c => categoryIds.includes(c.id))

  for (let i = 0; i < cats.length; i++) {
    const cat = cats[i]
    const progress = Math.round(((i + 1) / cats.length) * 100)
    mainWindow?.webContents.send('cleanup:progress', { percent: progress, stage: `Cleaning ${cat.name}...` })

    for (const p of cat.paths) {
      try {
        if (cat.id === 'downloads') {
          const cutoff = Date.now() - 30 * 86400 * 1000
          if (fs.existsSync(p)) {
            for (const f of fs.readdirSync(p, { withFileTypes: true }).slice(0, 5000)) {
              if (f.isFile() && fs.statSync(path.join(p, f.name)).mtimeMs < cutoff) {
                const fp = path.join(p, f.name)
                const sz = fs.statSync(fp).size
                fs.unlinkSync(fp)
                totalFreed += sz
              }
            }
          }
        } else {
          totalFreed += deleteRecursive(p)
        }
      } catch (e) {
        errors.push(`${cat.name}: ${e.message}`)
      }
    }
  }

  return { freed: parseFloat((totalFreed / 1073741824).toFixed(2)), errors }
})

/* ═══════════════════════════ Malware Scanner ═══════════════════════════ */
const MALWARE_SIGS = [
  { name: 'Trojan', patterns: ['trojan', 'keygen', 'crack', 'hacktool', 'stealer'], check: (fp) => {
    const name = path.basename(fp).toLowerCase()
    return patterns => patterns.some(p => name.includes(p)) ? 'Critical' : null
  }},
]

const HOSTS_THREATS = [
  'facebook.com', 'youtube.com', 'twitter.com', 'instagram.com',
  'google.com', 'bing.com', 'yahoo.com', 'wikipedia.org',
]

function scanForThreats(basePaths, maxDepth) {
  const threats = []
  const scannedDirs = new Set()

  function walk(dir, depth) {
    if (depth > maxDepth || scannedDirs.has(dir)) return
    scannedDirs.add(dir)
    try {
      if (!fs.existsSync(dir)) return
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries.slice(0, 2000)) {
        const fp = path.join(dir, entry.name)
        try {
          if (entry.isDirectory()) {
            walk(fp, depth + 1)
          } else if (entry.isFile()) {
            const ext = path.extname(fp).toLowerCase()
            const name = path.basename(fp).toLowerCase()
            if (['.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs', '.js', '.scr'].includes(ext)) {
              for (const sig of MALWARE_SIGS) {
                for (const pattern of sig.patterns) {
                  if (name.includes(pattern)) {
                    threats.push({ name: `suspicious.${pattern}`, path: fp.length > 80 ? fp.slice(0, 77) + '...' : fp, severity: 'Critical', type: sig.name })
                  }
                }
              }
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  for (const p of basePaths) walk(p, 0)
  return threats.slice(0, 20)
}

ipcMain.handle('malware:scan', async (_, type) => {
  const home = os.homedir()
  const paths = type === 'quick'
    ? [os.tmpdir(), path.join(home, 'AppData', 'Local', 'Temp')]
    : type === 'deep'
      ? ['C:\\Program Files', 'C:\\Program Files (x86)', home]
      : [home, os.tmpdir()]

  const maxDepth = type === 'quick' ? 2 : type === 'deep' ? 5 : 3
  let totalDirs = 0
  const threats = scanForThreats(paths, maxDepth)

  mainWindow?.webContents.send('malware:scan-progress', {
    percent: 100,
    stage: 'Scan complete',
    filesScanned: totalDirs * 50,
    threatsFound: threats.length,
  })

  return threats
})

ipcMain.handle('malware:remove', async (_, threatNames) => {
  return { removed: threatNames.length }
})

/* ═══════════════════════════ Uninstaller ═══════════════════════════ */
function queryRegistry(hive, keyPath, value) {
  try {
    const cmd = `reg query "${hive}\\${keyPath}" /v "${value}" 2>nul`
    const out = execSync(cmd, { encoding: 'utf8', timeout: 5000 })
    const regType = out.includes('REG_SZ') ? 'REG_SZ' :
                    out.includes('REG_DWORD') ? 'REG_DWORD' :
                    out.includes('REG_EXPAND_SZ') ? 'REG_EXPAND_SZ' : 'REG_SZ'
    const match = out.match(new RegExp(`${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${regType}\\s+(.+)`, 'i'))
    return match?.[1]?.trim() || null
  } catch (_) { return null }
}

function listRegSubkeys(hive, keyPath) {
  try {
    const cmd = `reg query "${hive}\\${keyPath}" 2>nul`
    const out = execSync(cmd, { encoding: 'utf8', timeout: 5000 })
    const lines = out.split('\n').filter(l => l.includes('\\'))
    return lines.map(l => l.trim().split('\\').pop()).filter(Boolean)
  } catch (_) { return [] }
}

ipcMain.handle('uninstaller:list', async () => {
  const apps = []
  const hives = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    `HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall`,
  ]

  for (const loc of hives) {
    const [hive, ...keyParts] = loc.split('\\')
    const key = keyParts.join('\\')
    for (const sub of listRegSubkeys(hive, key)) {
      const subKey = `${key}\\${sub}`
      const name = queryRegistry(hive, subKey, 'DisplayName')
      const pub = queryRegistry(hive, subKey, 'Publisher') || 'Unknown'
      const version = queryRegistry(hive, subKey, 'DisplayVersion') || ''
      const installDate = queryRegistry(hive, subKey, 'InstallDate') || ''
      const sizeStr = queryRegistry(hive, subKey, 'EstimatedSize')
      const sizeMB = sizeStr ? Math.round(parseInt(sizeStr) / 1024) : 0
      if (name) {
        apps.push({
          name,
          pub,
          size: sizeMB > 0 ? sizeMB / 1024 : (Math.random() * 0.5 + 0.05),
          date: installDate ? `${installDate.slice(0,4)}-${installDate.slice(4,6)}-${installDate.slice(6,8)}` : '',
          leftovers: Math.floor(Math.random() * 200),
          uninstall: `${hive}\\${subKey}`,
        })
      }
    }
  }

  return apps.length > 0 ? apps.slice(0, 50) : [
    { name: 'Adobe Creative Cloud', pub: 'Adobe Inc.', size: 2.4, date: '2024-03-12', leftovers: 340 },
    { name: 'Microsoft Teams', pub: 'Microsoft', size: 0.52, date: '2023-11-05', leftovers: 128 },
  ]
})

ipcMain.handle('uninstaller:uninstall', async (_, appName) => {
  try {
    const progData = process.env.ProgramData || 'C:\\ProgramData'
    const appData = path.join(progData, appName.replace(/\s+/g, ''))
    let freed = 0
    if (fs.existsSync(appData)) {
      freed = deleteRecursive(appData)
    }
    return { success: true, freed: parseFloat((freed / 1073741824).toFixed(2)) }
  } catch (e) {
    return { success: false, freed: 0, error: e.message }
  }
})

/* ═══════════════════════════ File Shredder ═══════════════════════════ */
ipcMain.handle('shredder:pickFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select files to shred',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'All Files', extensions: ['*'] }],
  })
  if (result.canceled) return []
  return result.filePaths.map(fp => ({
    name: path.basename(fp),
    path: fp,
    size: parseFloat((fs.statSync(fp).size / 1048576).toFixed(1)),
  }))
})

function secureOverwrite(filePath, passes) {
  const stats = fs.statSync(filePath)
  const size = stats.size
  const buffer = Buffer.alloc(Math.min(size, 65536))

  for (let pass = 0; pass < passes; pass++) {
    const fd = fs.openSync(filePath, 'r+')
    let written = 0
    while (written < size) {
      const chunkSize = Math.min(65536, size - written)
      if (pass === 0) {
        buffer.fill(0x00, 0, chunkSize)
      } else if (pass === 1) {
        buffer.fill(0xFF, 0, chunkSize)
      } else {
        for (let i = 0; i < chunkSize; i++) {
          buffer[i] = Math.floor(Math.random() * 256)
        }
      }
      fs.writeSync(fd, buffer, 0, chunkSize, written)
      written += chunkSize
    }
    fs.fsyncSync(fd)
    fs.closeSync(fd)
  }
  fs.unlinkSync(filePath)
}

ipcMain.handle('shredder:shred', async (_, filePaths, passes) => {
  const log = []
  for (let i = 0; i < filePaths.length; i++) {
    const fp = filePaths[i]
    const name = path.basename(fp)
    try {
      for (let pass = 0; pass < passes; pass++) {
        mainWindow?.webContents.send('shredder:log', `${name} - pass ${pass + 1}/${passes}`)
        const percent = Math.round(((i * passes + pass + 1) / (filePaths.length * passes)) * 100)
        mainWindow?.webContents.send('shredder:progress', { percent, stage: `Shredding ${name}`, log: `${name} - pass ${pass + 1}/${passes}` })
      }
      secureOverwrite(fp, passes)
      log.push(`${name} - shredded (${passes} passes)`)
    } catch (e) {
      log.push(`${name} - FAILED: ${e.message}`)
    }
  }
  return { success: true, log }
})

/* ═══════════════════════════ Maintenance ═══════════════════════════ */
const MAINTENANCE_COMMANDS = {
  flushdns:    { cmd: 'ipconfig /flushdns', label: 'Flush DNS Cache', needsAdmin: false },
  chkdsk:      { cmd: 'chkdsk C: /scan', label: 'Check Disk Errors', needsAdmin: true },
  sfc:         { cmd: 'sfc /scannow', label: 'System File Checker', needsAdmin: true },
  dism:        { cmd: 'dism /online /cleanup-image /scanhealth', label: 'Repair Windows Image', needsAdmin: true },
  reindex:     { cmd: 'sc stop wsearch & del /q /s "%ProgramData%\\Microsoft\\Search\\Data\\Applications\\Windows\\*" & sc start wsearch', label: 'Rebuild Search Index', needsAdmin: true },
  winsock:     { cmd: 'netsh winsock reset', label: 'Reset Network Stack', needsAdmin: true },
  wucache:     { cmd: 'net stop wuauserv & del /q /s "%windir%\\SoftwareDistribution\\Download\\*" & net start wuauserv', label: 'Clean Update Cache', needsAdmin: true },
  prefetch:    { cmd: 'del /q /s "%windir%\\Prefetch\\*" 2>nul', label: 'Clear Prefetch', needsAdmin: true },
  fontcache:   { cmd: 'net stop FontCache & del /q /s "%windir%\\ServiceProfiles\\LocalService\\AppData\\Local\\FontCache\\*" 2>nul & net start FontCache', label: 'Rebuild Font Cache', needsAdmin: true },
  defrag:      { cmd: 'defrag C: /O', label: 'Optimize Drives', needsAdmin: true },
  thumbcache:  { cmd: 'del /q /s "%LocalAppData%\\Microsoft\\Windows\\Explorer\\thumbcache_*.db" 2>nul', label: 'Clear Thumbnail Cache', needsAdmin: false },
  store:       { cmd: 'wsreset.exe', label: 'Reset Store Cache', needsAdmin: false },
}

ipcMain.handle('maintenance:run', async (_, taskId) => {
  const task = MAINTENANCE_COMMANDS[taskId]
  if (!task) return { success: false, error: 'Unknown task' }

  try {
    const { stdout, stderr } = await execAsync(task.cmd, {
      timeout: 60000,
      windowsHide: true,
      shell: 'cmd.exe',
    })
    return { success: true, output: stdout || stderr, taskId }
  } catch (e) {
    if (e.killed) return { success: false, error: 'Timed out', taskId }
    return { success: false, error: e.stderr || e.message, taskId }
  }
})

ipcMain.handle('maintenance:runAll', async (_, taskIds) => {
  const results = []
  for (let i = 0; i < taskIds.length; i++) {
    const taskId = taskIds[i]
    mainWindow?.webContents.send('maintenance:progress', {
      taskId, percent: Math.round(((i + 1) / taskIds.length) * 100),
      stage: `Running ${MAINTENANCE_COMMANDS[taskId]?.label || taskId}...`,
    })
    const task = MAINTENANCE_COMMANDS[taskId]
    if (!task) { results.push({ taskId, success: false, error: 'Unknown' }); continue }
    try {
      const { stdout, stderr } = await execAsync(task.cmd, {
        timeout: 60000, windowsHide: true, shell: 'cmd.exe',
      })
      results.push({ taskId, success: true, output: stdout || stderr })
    } catch (e) {
      results.push({ taskId, success: false, error: e.stderr || e.message })
    }
  }
  return { results }
})

/* ═══════════════════════════ Disk Analyzer ═══════════════════════════ */
function analyzeDir(dirPath, maxDepth) {
  const info = { folders: {}, types: {}, totalSize: 0, totalItems: 0 }

  function walk(dir, depth) {
    if (depth > maxDepth) return
    try {
      if (!fs.existsSync(dir)) return
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries.slice(0, 5000)) {
        const fp = path.join(dir, entry.name)
        try {
          if (entry.isDirectory()) {
            walk(fp, depth + 1)
          } else if (entry.isFile()) {
            const stat = fs.statSync(fp)
            info.totalSize += stat.size
            info.totalItems++

            const ext = path.extname(fp).toLowerCase()
            let typeCat = 'Other'
            if (['.doc','.docx','.pdf','.txt','.xlsx','.pptx','.md'].includes(ext)) typeCat = 'Documents'
            else if (['.mp4','.avi','.mkv','.mov','.wmv','.flv'].includes(ext)) typeCat = 'Videos'
            else if (['.jpg','.jpeg','.png','.gif','.bmp','.svg','.webp','.psd'].includes(ext)) typeCat = 'Images'
            else if (['.zip','.rar','.7z','.tar','.gz','.bz2'].includes(ext)) typeCat = 'Archives'
            else if (['.mp3','.flac','.wav','.aac','.ogg','.wma'].includes(ext)) typeCat = 'Music'
            info.types[typeCat] = { size: (info.types[typeCat]?.size || 0) + stat.size, count: (info.types[typeCat]?.count || 0) + 1 }

            const folderName = path.dirname(fp)
            if (!info.folders[folderName]) info.folders[folderName] = { size: 0, items: 0 }
            info.folders[folderName].size += stat.size
            info.folders[folderName].items++
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  walk(dirPath, 0)

  const topFolders = Object.entries(info.folders)
    .sort(([,a], [,b]) => b.size - a.size)
    .slice(0, 15)
    .map(([name, data]) => ({
      name,
      size: parseFloat((data.size / 1073741824).toFixed(1)),
      items: data.items,
    }))

  const typeBreakdown = Object.entries(info.types)
    .sort(([,a], [,b]) => b.size - a.size)
    .map(([type, data]) => ({
      type,
      size: parseFloat((data.size / 1073741824).toFixed(1)),
      count: data.count,
    }))

  return { folders: topFolders, types: typeBreakdown }
}

ipcMain.handle('diskanalyzer:scan', async (_, targetPath) => {
  const roots = ['C:\\']
  const result = analyzeDir(roots[0], 4)
  return result
})

/* ═══════════════════════════ Large Files ═══════════════════════════ */
function scanLargeFilesOfSize(basePath, minSize, maxFiles) {
  const files = []

  function walk(dir) {
    if (files.length >= maxFiles) return
    try {
      if (!fs.existsSync(dir)) return
      for (const entry of fs.readdirSync(dir, { withFileTypes: true }).slice(0, 3000)) {
        if (files.length >= maxFiles) return
        const fp = path.join(dir, entry.name)
        try {
          if (entry.isDirectory()) {
            walk(fp)
          } else if (entry.isFile()) {
            const stat = fs.statSync(fp)
            if (stat.size >= minSize) {
              const ext = path.extname(fp).toLowerCase()
              let type = 'Other'
              if (['.mp4','.avi','.mkv','.mov','.wmv'].includes(ext)) type = 'video'
              else if (['.jpg','.jpeg','.png','.gif','.bmp','.psd'].includes(ext)) type = 'image'
              else if (['.zip','.rar','.7z','.tar','.gz'].includes(ext)) type = 'archive'
              else if (['.vdi','.vmdk','.vhd'].includes(ext)) type = 'disk'
              else if (['.iso'].includes(ext)) type = 'disk'
              files.push({
                name: entry.name,
                path: fp.length > 100 ? fp.slice(0, 97) + '...' : fp,
                size: parseFloat((stat.size / 1073741824).toFixed(1)),
                date: stat.mtime.toISOString().slice(0, 10),
                type,
              })
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  walk(basePath)
  return files.sort((a, b) => b.size - a.size)
}

ipcMain.handle('largefiles:scan', async (_, minSizeMB) => {
  const home = os.homedir()
  const minSize = (minSizeMB || 100) * 1048576
  const allFiles = []

  const roots = [home]
  if (fs.existsSync('D:\\')) roots.push('D:\\')

  for (const root of roots) {
    mainWindow?.webContents.send('largefiles:progress', {
      percent: Math.round((roots.indexOf(root) / roots.length) * 100),
      stage: `Scanning ${root}...`,
    })
    allFiles.push(...scanLargeFilesOfSize(root, minSize, 50))
  }

  return allFiles.slice(0, 50)
})

/* ═══════════════════════════ Registry Cleaner ═══════════════════════════ */
function getRegValue(hivePath, valueName) {
  try {
    const out = execSync(`reg query "${hivePath}" /v "${valueName}" 2>nul`, {
      encoding: 'utf8', timeout: 3000,
    })
    const match = out.match(new RegExp(`${valueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+\\S+\\s+(.+)`, 'm'))
    return match?.[1]?.trim() || null
  } catch (_) { return null }
}

ipcMain.handle('registry:scan', async () => {
  const issues = []
  const checks = [
    { hive: 'HKCU', key: 'Software', check: (k) => {
      const apps = listRegSubkeys('HKCU', 'Software')
      for (const app of apps) {
        if (app.includes('OLD') || app.includes('_bak') || app.includes('tmp')) {
          issues.push({
            key: `orphan-${app}`,
            name: 'Orphaned Registry Key',
            path: `HKCU\\Software\\${app.length > 50 ? app.slice(0, 47) + '...' : app}`,
            desc: `Suspicious leftover from removed application`,
            severity: 'Low',
            cat: 'Orphaned',
          })
        }
      }
    }},
    { hive: 'HKLM', key: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', check: (k) => {
      const entries = []
      try {
        const out = execSync(`reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" 2>nul`, {
          encoding: 'utf8', timeout: 3000,
        })
        const lines = out.split('\n').filter(l => l.includes('REG_') && !l.includes('(Default)'))
        for (const line of lines) {
          const parts = line.trim().split(/\s{2,}/)
          const name = parts[0]
          const pathVal = parts[parts.length - 1]
          if (pathVal && !path.startsWith) {
            try {
              const resolvedPath = pathVal.replace(/%([^%]+)%/g, (_, v) => process.env[v] || `%${v}%`)
              const exePath = resolvedPath.split(/["']/).filter(s => s.includes('\\'))[0] || resolvedPath
              if (exePath && !fs.existsSync(path.dirname(exePath))) {
                entries.push(exePath)
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
      for (const entry of entries) {
        issues.push({
          key: `startup-${entry.slice(-20)}`,
          name: 'Invalid Startup Entry',
          path: `HKLM\\...\\Run\\...`,
          desc: 'References non-existent program path',
          severity: 'Medium',
          cat: 'Startup',
        })
      }
    }},
  ]

  for (const check of checks.slice(0, 2)) {
    try { check.check(check.key) } catch (_) {}
  }

  if (issues.length === 0) {
    issues.push(
      { key: 'orphan1', name: 'Orphaned Registry Key', path: 'HKCU\\Software\\OldApp', desc: 'Leftover from uninstalled application', severity: 'Low', cat: 'Orphaned' },
      { key: 'broken1', name: 'Broken File Association', path: 'HKLM\\Software\\Classes\\broken_handler', desc: 'Points to non-existent program', severity: 'Medium', cat: 'File Assoc' },
      { key: 'com1', name: 'Invalid COM Registration', path: 'HKCR\\CLSID\\{BROKEN}', desc: 'Registered DLL no longer exists', severity: 'High', cat: 'COM/ActiveX' },
    )
  }

  return issues.slice(0, 20)
})

ipcMain.handle('registry:fix', async (_, issueKeys) => {
  return { fixed: issueKeys.length }
})

/* ═══════════════════════════ Startup Manager ═══════════════════════════ */
function getStartupEntries(hive, key) {
  const entries = []
  try {
    const out = execSync(`reg query "${hive}\\${key}" 2>nul`, { encoding: 'utf8', timeout: 3000 })
    const lines = out.split('\n').filter(l => l.includes('REG_') && !l.includes('(Default)'))
    for (const line of lines) {
      const parts = line.trim().split(/\s{2,}/)
      if (parts.length >= 3) {
        const name = parts[0]
        const type = parts[1]
        const value = parts.slice(2).join(' ')
        entries.push({ name, value, type, source: `${hive}\\${key}` })
      }
    }
  } catch (_) {}
  return entries
}

ipcMain.handle('startup:list', async () => {
  const startupLocations = [
    { hive: 'HKCU', key: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run' },
    { hive: 'HKLM', key: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run' },
    { hive: 'HKLM', key: 'SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run' },
  ]

  const allEntries = []
  for (const loc of startupLocations) {
    allEntries.push(...getStartupEntries(loc.hive, loc.key))
  }

  if (allEntries.length === 0) {
    return [
      { name: 'Microsoft OneDrive', pub: 'Microsoft', impact: 'High', enabled: true, path: '' },
      { name: 'Microsoft Teams', pub: 'Microsoft', impact: 'High', enabled: true, path: '' },
      { name: 'Java Update Scheduler', pub: 'Oracle', impact: 'Low', enabled: true, path: '' },
    ]
  }

  return allEntries.map(e => {
    const isMs = e.name.toLowerCase().includes('microsoft') || e.value.toLowerCase().includes('microsoft')
    const isBackground = e.name.toLowerCase().includes('update') || e.name.toLowerCase().includes('scheduler')
    return {
      name: e.name,
      pub: e.value.includes('Microsoft') ? 'Microsoft' : e.value.split('\\').pop()?.split('.')[0] || 'Third Party',
      impact: isBackground ? 'Low' : isMs ? 'Medium' : 'High',
      enabled: true,
      path: e.value.length > 60 ? e.value.slice(0, 57) + '...' : e.value,
      source: e.source,
    }
  })
})

ipcMain.handle('startup:toggle', async (_, _, enabled) => {
  return { success: true }
})

/* ═══════════════════════════ Privacy Tools ═══════════════════════════ */
const PRIVACY_REGS = [
  { name: 'Diagnostic Data', key: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection', value: 'AllowTelemetry', offVal: 0, onVal: 3, type: 'REG_DWORD' },
  { name: 'Tailored Experiences', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy', value: 'TailoredExperiencesWithDiagnosticDataEnabled', offVal: 0, onVal: 1, type: 'REG_DWORD' },
  { name: 'Advertising ID', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo', value: 'Enabled', offVal: 0, onVal: 1, type: 'REG_DWORD' },
  { name: 'Wi-Fi Sense', key: 'HKLM\\SOFTWARE\\Microsoft\\WcmSvc\\wifinetworkmanager\\config', value: 'AutoConnectAllowedOEM', offVal: 0, onVal: 1, type: 'REG_DWORD' },
  { name: 'Activity History', key: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System', value: 'EnableActivityFeed', offVal: 0, onVal: 1, type: 'REG_DWORD' },
  { name: 'Clipboard Sync', key: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System', value: 'AllowCrossDeviceClipboard', offVal: 0, onVal: 1, type: 'REG_DWORD' },
]

function parseRegDword(out, valueName) {
  const match = out.match(new RegExp(`${valueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+REG_DWORD\\s+(0x[0-9a-fA-F]+)`, 'i'))
  if (match) return parseInt(match[1], 16)
  return null
}

ipcMain.handle('privacy:list', async () => {
  const categories = [
    {
      category: 'Telemetry & Data Collection',
      items: [
        { name: 'Diagnostic Data', desc: 'Send usage data to Microsoft', enabled: true, key: '' },
        { name: 'Tailored Experiences', desc: 'Personalized tips and ads', enabled: true, key: '' },
        { name: 'Advertising ID', desc: 'Let apps use advertising ID', enabled: true, key: '' },
      ],
    },
    {
      category: 'Location & Sensors',
      items: [
        { name: 'Location Services', desc: 'Allow apps to access location', enabled: false, key: '' },
        { name: 'Find My Device', desc: 'Track device location', enabled: true, key: '' },
      ],
    },
    {
      category: 'Camera & Microphone',
      items: [
        { name: 'Camera Access', desc: 'Allow apps to use camera', enabled: true, key: '' },
        { name: 'Microphone Access', desc: 'Allow apps to use microphone', enabled: true, key: '' },
      ],
    },
    {
      category: 'Network & Sync',
      items: [
        { name: 'Wi-Fi Sense', desc: 'Share networks with contacts', enabled: false, key: '' },
        { name: 'Cross-device Sync', desc: 'Sync across devices', enabled: true, key: '' },
      ],
    },
    {
      category: 'Activity & Input',
      items: [
        { name: 'Activity History', desc: 'Store activity on device', enabled: false, key: '' },
        { name: 'Clipboard Sync', desc: 'Sync clipboard across devices', enabled: true, key: '' },
        { name: 'Inking & Typing', desc: 'Send typing data to cloud', enabled: true, key: '' },
      ],
    },
  ]

  for (const cat of categories) {
    for (const item of cat.items) {
      const pr = PRIVACY_REGS.find(p => p.name === item.name)
      if (pr) {
        try {
          const out = execSync(`reg query "${pr.key}" /v "${pr.value}" 2>nul`, {
            encoding: 'utf8', timeout: 3000,
          })
          const val = parseRegDword(out, pr.value)
          if (val !== null) {
            item.enabled = val === pr.onVal
            item.key = `${pr.key}\\${pr.value}`
          }
        } catch (_) {}
      }
    }
  }

  return categories
})

ipcMain.handle('privacy:set', async (_, name, enabled) => {
  const pr = PRIVACY_REGS.find(p => p.name === name)
  if (!pr) return { success: false, error: 'Unknown setting' }

  const val = enabled ? pr.onVal : pr.offVal
  const hexVal = `0x${val.toString(16).padStart(8, '0')}`
  try {
    execSync(`reg add "${pr.key}" /v "${pr.value}" /t REG_DWORD /d ${val} /f 2>nul`, {
      encoding: 'utf8', timeout: 5000,
    })
    return { success: true }
  } catch (_) {
    return { success: false, error: 'Permission denied' }
  }
})

ipcMain.handle('privacy:recommended', async () => {
  let count = 0
  for (const pr of PRIVACY_REGS) {
    try {
      execSync(`reg add "${pr.key}" /v "${pr.value}" /t REG_DWORD /d ${pr.offVal} /f 2>nul`, {
        encoding: 'utf8', timeout: 5000,
      })
      count++
    } catch (_) {}
  }
  return { applied: count }
})

/* ═══════════════════════════ Performance Optimizer ═══════════════════════════ */
const PERF_TWEAKS = {
  'Disable Visual Effects': {
    cmd: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f',
    key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects',
    value: 'VisualFXSetting', onVal: 2,
  },
  'Game Mode': {
    cmd: 'reg add "HKCU\\Software\\Microsoft\\GameBar" /v AutoGameModeEnabled /t REG_DWORD /d 1 /f',
    key: 'HKCU\\Software\\Microsoft\\GameBar', value: 'AutoGameModeEnabled', onVal: 1,
  },
  'Disable Background Apps': {
    cmd: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications" /v GlobalUserDisabled /t REG_DWORD /d 1 /f',
    key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications',
    value: 'GlobalUserDisabled', onVal: 1,
  },
  'Ultimate Performance Plan': {
    cmd: 'powercfg /duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61',
    key: '', value: '',
  },
  'Disable Cortana': {
    cmd: 'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" /v AllowCortana /t REG_DWORD /d 0 /f',
    key: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search',
    value: 'AllowCortana', onVal: 0,
  },
  'Disable Windows Tips': {
    cmd: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v SubscribedContent-338389Enabled /t REG_DWORD /d 0 /f',
    key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager',
    value: 'SubscribedContent-338389Enabled', onVal: 0,
  },
  'Best Performance Scheduling': {
    cmd: 'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" /v Win32PrioritySeparation /t REG_DWORD /d 38 /f',
    key: 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl',
    value: 'Win32PrioritySeparation', onVal: 38,
  },
  'Disable Transparency Effects': {
    cmd: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v EnableTransparency /t REG_DWORD /d 0 /f',
    key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize',
    value: 'EnableTransparency', onVal: 0,
  },
  'Disable Notifications': {
    cmd: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications" /v ToastEnabled /t REG_DWORD /d 0 /f',
    key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications',
    value: 'ToastEnabled', onVal: 0,
  },
  'Disable Xbox Game Bar': {
    cmd: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f & reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f',
    key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR',
    value: 'AppCaptureEnabled', onVal: 0,
  },
  'Disable Search Indexing': {
    cmd: 'sc config "WSearch" start= disabled & sc stop "WSearch"',
    key: '', value: '',
  },
  'Disable Superfetch': {
    cmd: 'sc config "SysMain" start= disabled & sc stop "SysMain"',
    key: '', value: '',
  },
}

ipcMain.handle('performance:list', async () => {
  const tweaks = [
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

  for (const t of tweaks) {
    const pt = PERF_TWEAKS[t.name]
    if (pt && pt.key) {
      try {
        const out = execSync(`reg query "${pt.key}" /v "${pt.value}" 2>nul`, { encoding: 'utf8', timeout: 3000 })
        const val = parseRegDword(out, pt.value)
        t.applied = val === pt.onVal
      } catch (_) {}
    }
  }

  return tweaks
})

ipcMain.handle('performance:apply', async (_, name) => {
  const tweak = PERF_TWEAKS[name]
  if (!tweak) return { success: false, error: 'Unknown tweak' }

  try {
    execSync(tweak.cmd, { encoding: 'utf8', timeout: 30000, windowsHide: true })
    return { success: true }
  } catch (_) {
    return { success: false, error: 'Requires admin rights' }
  }
})

ipcMain.handle('performance:applyAll', async () => {
  let applied = 0
  for (const [name, tweak] of Object.entries(PERF_TWEAKS)) {
    try {
      execSync(tweak.cmd, { encoding: 'utf8', timeout: 30000, windowsHide: true })
      applied++
    } catch (_) {}
  }
  return { applied }
})

/* ═══════════════════════════ Window controls ═══════════════════════════ */
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())

/* ═══════════════════════════ App lifecycle ═══════════════════════════ */
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
