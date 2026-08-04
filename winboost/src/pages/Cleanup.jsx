import { useState } from 'react'
import { Brush, Globe, FolderOpen, Database, Download, Recycle, FileText, CheckCircle, Loader, Search, Sparkles } from 'lucide-react'

const categories = [
  { id: 'temp', icon: FolderOpen, label: 'Temporary Files', desc: 'Windows temp folder, app cache, logs', size: '1.2 GB', detail: 'C:\\Windows\\Temp, %TEMP%' },
  { id: 'browser', icon: Globe, label: 'Browser Cache', desc: 'Chrome, Edge, Firefox data', size: '856 MB', detail: 'History, cookies, cache' },
  { id: 'recycle', icon: Recycle, label: 'Recycle Bin', desc: 'Deleted files waiting to be purged', size: '340 MB', detail: 'All drives recycle bins' },
  { id: 'downloads', icon: Download, label: 'Downloads Folder', desc: 'Old installers and unused files', size: '2.4 GB', detail: 'Files older than 30 days' },
  { id: 'thumbnails', icon: FileText, label: 'Thumbnail Cache', desc: 'Windows explorer thumbnails', size: '180 MB', detail: 'thumbs.db, icon cache' },
  { id: 'logs', icon: Database, label: 'System Logs', desc: 'Event logs and crash dumps', size: '520 MB', detail: 'Event Viewer, .dmp files' },
]

export default function Cleanup() {
  const [scanning, setScanning] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [done, setDone] = useState(false)

  const toggle = (id) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n) }
  const toggleAll = () => setSelected(selected.size === categories.length ? new Set() : new Set(categories.map(c => c.id)))
  const totalSel = [...selected].reduce((s, id) => s + parseFloat(categories.find(c => c.id === id).size), 0)

  const scan = () => {
    setScanning(true); setDone(false); setProgress(0)
    const stages = ['Scanning temp folders...', 'Checking browser caches...', 'Analyzing downloads...', 'Inspecting system logs...']
    let p = 0, si = 0
    const iv = setInterval(() => {
      p += 3.5; const ni = Math.floor(p / 25)
      if (ni > si) { si = ni; setStage(stages[Math.min(si, stages.length - 1)]) }
      if (p >= 100) { p = 100; clearInterval(iv); setScanning(false) }
      setProgress(Math.round(p))
    }, 50)
  }

  const clean = () => {
    setCleaning(true); setProgress(0)
    let p = 0
    const iv = setInterval(() => {
      p += 3; if (p >= 100) { p = 100; clearInterval(iv); setCleaning(false); setDone(true); setSelected(new Set()) }
      setProgress(Math.round(p))
    }, 50)
  }

  return (
    <div className="anim-fade-up space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--blue-bg)' }}>
            <Brush size={20} color="#007aff" />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">System Cleanup</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] ml-12">Remove junk files, caches, and temporary data to free up space</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            {scanning && <Loader size={16} className="animate-spin text-blue-500" />}
            {done && <CheckCircle size={16} className="text-[var(--green)]" />}
            <span>{scanning ? stage : done ? 'Cleanup complete!' : `${categories.length} categories found`}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={scan} disabled={scanning || cleaning} className="btn btn-secondary btn-sm">
              <Search size={14} /> Scan
            </button>
            <button onClick={clean} disabled={selected.size === 0 || cleaning || scanning} className="btn btn-primary btn-sm">
              <Sparkles size={14} /> Clean ({totalSel.toFixed(1)} GB)
            </button>
          </div>
        </div>

        {(scanning || cleaning) && (
          <div className="mb-5 space-y-2">
            <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
              <span>{scanning ? 'Analyzing...' : 'Cleaning...'}</span>
              <span className="font-semibold text-[var(--accent)]">{progress}%</span>
            </div>
            <div className="progress"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          </div>
        )}

        {done && (
          <div className="mb-5 p-3 rounded-xl flex items-center gap-2 text-sm font-medium"
            style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
            <CheckCircle size={16} /> Freed {totalSel.toFixed(1)} GB of disk space
          </div>
        )}

        <div className="flex items-center justify-between mb-3 text-xs text-[var(--text-secondary)]">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="chk" checked={selected.size === categories.length} onChange={toggleAll} />
            Select All
          </label>
          <span>{selected.size} of {categories.length}</span>
        </div>

        <div className="space-y-1.5">
          {categories.map(({ id, icon: Icon, label, desc, size, detail }) => {
            const sel = selected.has(id)
            return (
              <div key={id} onClick={() => toggle(id)}
                className={`flex items-center gap-4 p-3.5 rounded-xl cursor-pointer transition-all border ${
                  sel ? 'border-[#0071e3]/20 bg-[#0071e3]/[0.03]' : 'border-transparent hover:bg-[var(--bg-secondary)]'
                }`}>
                <input type="checkbox" className="chk" checked={sel} readOnly />
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: sel ? 'var(--blue-bg)' : 'var(--bg-secondary)', color: sel ? 'var(--blue)' : 'var(--text-tertiary)' }}>
                  <Icon size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{desc} &middot; {detail}</div>
                </div>
                <div className="text-sm font-semibold text-[var(--text-secondary)] shrink-0">{size}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
