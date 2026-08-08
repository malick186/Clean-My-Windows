import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HardDrive, Folder, Film, Image, File, Archive, Music, AlertTriangle, Loader,
  Search, RotateCcw, Trash2, ExternalLink, Calendar, FileArchive,
  FileImage, FileVideo, BarChart3, ChevronDown, ScanSearch, Timer, ListTodo,
  Zap, PieChart, FolderOpen,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { analyzeDisk, scanLargeFiles, revealLargeFile, trashLargeFile } from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

const folderColors = ['#007aff', '#af52de', '#ff9500', '#34c759', '#ffcc00', '#5ac8fa', '#ff3b30', '#5856d6']
const fileIcons = { videos: FileVideo, images: FileImage, archives: FileArchive, disk: HardDrive, other: File, music: File }

function formatElapsed(seconds) {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

function formatSize(bytes) {
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(1)} TB`
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export default function DiskAnalyzer() {
  const [activeTab, setActiveTab] = useState('usage')
  const [scanning, setScanning] = useState(false)
  const [scanType, setScanType] = useState('')
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)

  const [folders, setFolders] = useState([])
  const [types, setTypes] = useState([])
  const [diskMeta, setDiskMeta] = useState(null)

  const [files, setFiles] = useState([])
  const [minSize, setMinSize] = useState(100)
  const [fileMeta, setFileMeta] = useState({ root: '', scannedItems: 0, limited: false })
  const [busy, setBusy] = useState(null)

  const [error, setError] = useState('')

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const runDiskScan = useCallback(async () => {
    setScanning(true); setScanType('disk'); setProgress(0); setStage('Preparing storage analysis...')
    setElapsed(0); setError(''); setFolders([]); setTypes([]); setDiskMeta(null)
    timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000)
    try {
      const data = await analyzeDisk('home', ({ percent, stage: nextStage }) => {
        setProgress(percent || 0); if (nextStage) setStage(nextStage)
      })
      setFolders(data.folders || [])
      setTypes(data.types || [])
      setDiskMeta(data)
      setProgress(100)
    } catch (err) { setError(err.message) }
    finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setScanning(false)
    }
  }, [])

  const runLargeScan = useCallback(async size => {
    setScanning(true); setScanType('large'); setProgress(0); setStage('Scanning for large files...')
    setElapsed(0); setError(''); setFiles([]); setFileMeta({ root: '', scannedItems: 0, limited: false })
    timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000)
    try {
      const result = await scanLargeFiles(size, data => {
        setProgress(data.percent || 0); if (data.stage) setStage(data.stage)
      })
      setFiles(result.files || []); setFileMeta(result)
      setProgress(100)
    } catch (err) { setError(err.message) }
    finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setScanning(false)
    }
  }, [])

  const trash = async file => {
    setBusy(file.id); setError('')
    try { await trashLargeFile(file.id); setFiles(items => items.filter(item => item.id !== file.id)) }
    catch (err) { setError(err.message) }
    finally { setBusy(null) }
  }

  const barData = folders.slice(0, 10).map(f => ({ name: f.name.length > 20 ? f.name.slice(0, 18) + '...' : f.name, size: f.size }))
  const totalLargeSize = files.reduce((sum, file) => sum + file.size, 0)
  const hasData = activeTab === 'usage' ? folders.length > 0 : files.length > 0

  return (
    <div className="space-y-6 anim-fade-up">
      {/* Hero */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-teal/10 text-sparkle-teal shadow-sm">
            <HardDrive size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.15em] mb-2">
              <HardDrive size={11} /> Storage Analysis
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">Disk Explorer</h1>
            <p className="text-[13px] text-sparkle-text-muted mt-1.5 leading-relaxed">Analyze usage, find large files, and reclaim storage space</p>
          </div>
        </div>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      {/* Tab selector */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-sparkle-accent/50 w-fit">
        {[
          { key: 'usage', label: 'Disk Usage', icon: PieChart, desc: 'Folder & file type analysis' },
          { key: 'large', label: 'Large Files', icon: Search, desc: 'Find space hogs' },
        ].map(({ key, label, icon: Icon, desc }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${
              activeTab === key
                ? 'bg-sparkle-primary text-white shadow-sm'
                : 'text-sparkle-text-muted hover:text-sparkle-text hover:bg-sparkle-accent'
            }`}
            title={desc}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Dashboard stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-stat text-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sparkle-primary/10 text-sparkle-primary mx-auto mb-2">
            <ScanSearch size={18} />
          </div>
          <strong className="text-lg font-bold text-sparkle-text block">
            {scanning ? `${progress}%` : activeTab === 'usage' ? (folders.length || '--') : (files.length || '--')}
          </strong>
          <span className="text-[11px] text-sparkle-text-muted">
            {scanning ? 'Scan Progress' : activeTab === 'usage' ? 'Folders Analyzed' : 'Large Files Found'}
          </span>
        </div>
        <div className="glass-stat text-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sparkle-success/10 text-sparkle-success mx-auto mb-2">
            <Timer size={18} />
          </div>
          <strong className={`text-lg font-bold block ${scanning ? 'anim-elapsed text-sparkle-primary' : 'text-sparkle-text'}`}>
            <span className="elapsed-timer">{formatElapsed(elapsed)}</span>
          </strong>
          <span className="text-[11px] text-sparkle-text-muted">
            {scanning ? 'Time Elapsed' : 'Last Scan Time'}
          </span>
        </div>
        <div className="glass-stat text-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sparkle-purple/10 text-sparkle-purple mx-auto mb-2">
            <ListTodo size={18} />
          </div>
          <strong className="text-lg font-bold text-sparkle-text block">
            {scanning ? `${100 - progress}%` : 'Ready'}
          </strong>
          <span className="text-[11px] text-sparkle-text-muted">
            {scanning ? 'Pending' : 'Status'}
          </span>
        </div>
      </div>

      {/* Scan controls */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-sparkle-text-secondary font-medium shrink-0">Scan control</span>
          {activeTab === 'large' && (
            <div className="flex items-center gap-1.5">
              {[10, 100, 500, 1000, 5000].map(size => (
                <button
                  key={size}
                  disabled={scanning}
                  onClick={() => setMinSize(size)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    minSize === size
                      ? 'bg-sparkle-primary text-white'
                      : 'text-sparkle-text-muted hover:text-sparkle-text hover:bg-sparkle-accent'
                  } disabled:opacity-40`}
                >
                  {size >= 1000 ? `${size / 1000} GB` : `${size} MB`}
                </button>
              ))}
            </div>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => activeTab === 'usage' ? runDiskScan() : runLargeScan(minSize)}
            disabled={scanning}
            className="rounded-xl ml-auto"
          >
            {scanning ? <Loader size={14} className="animate-spin mr-1.5" /> : <ScanSearch size={14} className="mr-1.5" />}
            {hasData ? 'Rescan' : 'Start Scan'}
          </Button>
        </div>

        {/* Fluid scan status */}
        {scanning && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 text-xs text-sparkle-text-secondary">
              <span className="status-dot active" />
              <span>{stage}</span>
              <span className="text-sparkle-text-muted ml-auto">{progress}%</span>
            </div>
            <div className="scan-progress">
              <div className="scan-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Meta info bar */}
      {(diskMeta || (fileMeta.scannedItems > 0)) && (
        <div className="glass-panel px-4 py-2 flex items-center gap-4 text-[11px] text-sparkle-text-muted">
          {activeTab === 'usage' && diskMeta && (
            <>
              <span>Analyzed <strong className="text-sparkle-text font-semibold">{diskMeta.root}</strong></span>
              <span>{diskMeta.scannedItems?.toLocaleString()} items</span>
              <span>{diskMeta.totalSize?.toFixed(2)} GB visible</span>
              {diskMeta.limited && <span className="text-sparkle-warning font-semibold">Safety limit reached</span>}
            </>
          )}
          {activeTab === 'large' && fileMeta.scannedItems > 0 && (
            <>
              <span>Path: <strong className="text-sparkle-text font-semibold">{fileMeta.root}</strong></span>
              <span>{fileMeta.scannedItems?.toLocaleString()} items inspected</span>
              {fileMeta.limited && <span className="text-sparkle-warning font-semibold">Safety limit reached</span>}
            </>
          )}
        </div>
      )}

      {/* Disk Usage Tab Content */}
      {activeTab === 'usage' && folders.length > 0 && (
        <>
          {/* Bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 size={18} className="text-sparkle-teal" />
                Folder Usage Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(180, folders.length * 24)}>
                <BarChart data={barData} layout="vertical" margin={{ left: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6e6e73' }} axisLine={false} tickLine={false} width={100} />
                  <Bar dataKey="size" radius={[0, 6, 6, 0]} barSize={18}>
                    {barData.map((_, i) => <rect key={i} fill={folderColors[i % folderColors.length]} rx={0} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Folder list */}
          <Card className="overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-semibold text-sparkle-text-muted uppercase tracking-wider border-b border-sparkle-border bg-sparkle-accent/50">
              <div className="col-span-5">Folder</div>
              <div className="col-span-3">Size</div>
              <div className="col-span-2">Items</div>
              <div className="col-span-2">Usage</div>
            </div>
            {folders.map((f, i) => (
              <div key={f.name} className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-sparkle-accent transition-all duration-200 border-b border-sparkle-border">
                <div className="col-span-5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${folderColors[i % folderColors.length]}15` }}>
                    <Folder size={15} style={{ color: folderColors[i % folderColors.length] }} />
                  </div>
                  <span className="text-sm font-medium truncate">{f.name}</span>
                </div>
                <div className="col-span-3 text-sm text-sparkle-text-secondary">{f.size.toFixed(1)} GB</div>
                <div className="col-span-2 text-xs text-sparkle-text-muted">{f.items.toLocaleString()}</div>
                <div className="col-span-2">
                  <div className="fluid-meter">
                    <div className="fluid-meter-bg" />
                    <div className="fluid-meter-fill" style={{ width: `${Math.min(100, (f.size / (folders[0]?.size || 1)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </Card>

          {/* File types */}
          {types.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <File size={18} className="text-sparkle-teal" />
                  File Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {types.map(({ type, size, count }) => {
                    const iconColors = { Documents: '#007aff', Videos: '#af52de', Images: '#34c759', Archives: '#ff9500', Music: '#ffcc00' }
                    const color = iconColors[type] || '#8e8e93'
                    const Icon = type === 'Videos' ? Film : type === 'Images' ? Image : type === 'Archives' ? Archive : type === 'Music' ? Music : File
                    return (
                      <div key={type} className="glass-stat">
                        <Icon size={17} style={{ color }} className="mb-2" />
                        <div className="text-sm font-semibold">{type}</div>
                        <div className="text-[11px] text-sparkle-text-muted">{size.toFixed(1)} GB &middot; {count.toLocaleString()} files</div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Large Files Tab Content */}
      {activeTab === 'large' && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-stat text-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sparkle-primary/10 text-sparkle-primary mx-auto mb-2">
                <File size={18} />
              </div>
              <strong className="text-lg font-bold text-sparkle-text block">{files.length}</strong>
              <span className="text-[11px] text-sparkle-text-muted">Large files found</span>
            </div>
            <div className="glass-stat text-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sparkle-warning/10 text-sparkle-warning mx-auto mb-2">
                <HardDrive size={18} />
              </div>
              <strong className="text-lg font-bold text-sparkle-text block">{totalLargeSize.toFixed(2)} GB</strong>
              <span className="text-[11px] text-sparkle-text-muted">Total space</span>
            </div>
            <div className="glass-stat text-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sparkle-purple/10 text-sparkle-purple mx-auto mb-2">
                <Search size={18} />
              </div>
              <strong className="text-lg font-bold text-sparkle-text block">{(fileMeta.scannedItems || 0).toLocaleString()}</strong>
              <span className="text-[11px] text-sparkle-text-muted">Items inspected</span>
            </div>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <Card className="overflow-hidden">
              <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_100px] gap-4 px-5 py-3 text-[11px] font-semibold text-sparkle-text-muted uppercase tracking-wider border-b border-sparkle-border bg-sparkle-accent/50">
                <span>File</span><span>Location</span><span>Size</span><span>Modified</span><span>Actions</span>
              </div>
              {files.map(file => {
                const Icon = fileIcons[file.type] || File
                return (
                  <div key={file.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_100px] gap-4 px-5 py-3.5 items-center border-b border-sparkle-border hover:bg-sparkle-accent transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-sparkle-accent text-sparkle-text-secondary">
                        <Icon size={16} />
                      </span>
                      <div>
                        <strong className="text-sm font-semibold text-sparkle-text block">{file.name}</strong>
                        <small className="text-[11px] text-sparkle-text-muted">{file.type}</small>
                      </div>
                    </div>
                    <span className="truncate text-sm text-sparkle-text-secondary" title={file.path}>{file.path}</span>
                    <strong className="text-sm text-sparkle-text">{file.size >= 1 ? `${file.size.toFixed(2)} GB` : `${(file.size * 1024).toFixed(0)} MB`}</strong>
                    <span className="flex items-center gap-1.5 text-xs text-sparkle-text-muted"><Calendar size={11} />{file.date}</span>
                    <div className="flex items-center gap-1.5">
                      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => revealLargeFile(file.id)} title="Show in Explorer">
                        <ExternalLink size={14} />
                      </Button>
                      <Button variant="danger" size="icon" className="w-8 h-8" onClick={() => trash(file)} disabled={busy === file.id} title="Move to Recycle Bin">
                        {busy === file.id ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </Card>
          )}

          {files.length === 0 && !scanning && (
            <Card className="p-10 text-center">
              <CardContent>
                <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 bg-sparkle-teal/10">
                  <Search size={28} className="text-sparkle-teal" />
                </div>
                <div className="text-xl font-bold mb-1">No Large Files</div>
                <div className="text-sm text-sparkle-text-secondary max-w-sm mx-auto">
                  {fileMeta.scannedItems > 0
                    ? `No files larger than ${minSize >= 1000 ? `${minSize / 1000} GB` : `${minSize} MB`} found. Try lowering the threshold.`
                    : 'Click "Start Scan" to find large files consuming your disk space.'}
                </div>
                {fileMeta.scannedItems === 0 && (
                  <Button onClick={() => runLargeScan(minSize)} className="mx-auto mt-5">
                    <ScanSearch size={16} className="mr-1.5" /> Start Scan
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {fileMeta.limited && <div className="notice-banner warning"><AlertTriangle size={16} />The scan reached its safety limit. Results show the largest files discovered so far.</div>}
        </>
      )}

      {/* Empty state for usage tab */}
      {activeTab === 'usage' && folders.length === 0 && !scanning && (
        <Card className="p-10 text-center">
          <CardContent>
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 bg-sparkle-teal/10">
              <HardDrive size={28} className="text-sparkle-teal" />
            </div>
            <div className="text-xl font-bold mb-1">Disk Usage Analysis</div>
            <div className="text-sm text-sparkle-text-secondary max-w-sm mx-auto">
              Scan your system to discover which folders and file types are using the most storage space.
            </div>
            <Button onClick={runDiskScan} className="mx-auto mt-5">
              <ScanSearch size={16} className="mr-1.5" /> Start Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
