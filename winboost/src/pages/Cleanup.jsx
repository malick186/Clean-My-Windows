import { useState, useEffect } from 'react'
import { Brush, Globe, FolderOpen, Database, Download, Recycle, FileText, CheckCircle, Loader, Search, Sparkles } from 'lucide-react'
import { scanCleanup, runCleanup } from '../lib/api'

export default function Cleanup() {
  const [categories, setCategories] = useState([])
  const [scanning, setScanning] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [done, setDone] = useState(false)
  const [freed, setFreed] = useState(0)

  useEffect(() => {
    scanCleanup().then(data => setCategories(data))
  }, [])

  const catMap = Object.fromEntries(categories.map(c => [c.id, { icon: Globe, size: c.size }]))
  const iconFor = (id) => {
    const m = { temp: FolderOpen, browser: Globe, recycle: Recycle, downloads: Download, thumbnails: FileText, logs: Database }
    return m[id] || FolderOpen
  }

  const toggle = (id) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n) }
  const toggleAll = () => setSelected(selected.size === categories.length ? new Set() : new Set(categories.map(c => c.id)))
  const totalSel = [...selected].reduce((s, id) => s + (categories.find(c => c.id === id)?.size || 0), 0)

  const scan = async () => {
    setScanning(true); setDone(false); setProgress(0); setStage('Scanning temp folders...')
    const data = await scanCleanup()
    setCategories(data)
    setScanning(false); setProgress(100)
  }

  const clean = async () => {
    setCleaning(true); setProgress(0)
    const result = await runCleanup([...selected], ({ percent, stage: st }) => {
      setProgress(percent); if (st) setStage(st)
    })
    setFreed(result.freed)
    setCleaning(false); setDone(true); setSelected(new Set())
    const updated = await scanCleanup()
    setCategories(updated)
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
            <span>{scanning ? stage : done ? 'Cleanup complete!' : `${categories.length} categories`}</span>
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
            <CheckCircle size={16} /> Freed {freed.toFixed(1)} GB of disk space
          </div>
        )}

        <div className="flex items-center justify-between mb-3 text-xs text-[var(--text-secondary)]">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="chk" checked={selected.size === categories.length && categories.length > 0} onChange={toggleAll} />
            Select All
          </label>
          <span>{selected.size} of {categories.length}</span>
        </div>

        <div className="space-y-1.5">
          {categories.map(({ id, name: label, desc, size, path: detail, files }) => {
            const sel = selected.has(id)
            const Icon = iconFor(id)
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
                  <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{desc} &middot; {files} files &middot; {detail.slice(0, 60)}</div>
                </div>
                <div className="text-sm font-semibold text-[var(--text-secondary)] shrink-0">{size.toFixed(1)} GB</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
