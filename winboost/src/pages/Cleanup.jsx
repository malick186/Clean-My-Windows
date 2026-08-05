import { useState, useEffect } from 'react'
import { Brush, Globe, FolderOpen, Database, Download, Recycle, FileText, CheckCircle, Loader, Search, Sparkles, AlertTriangle } from 'lucide-react'
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
  const [resultInfo, setResultInfo] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    scanCleanup().then(data => {
      setCategories(data)
      setSelected(new Set(data.filter(item => item.recommended).map(item => item.id)))
    }).catch(err => setError(err.message))
  }, [])

  const iconFor = (id) => {
    const m = { temp: FolderOpen, browser: Globe, recycle: Recycle, downloads: Download, thumbnails: FileText, crashlogs: Database, shaders: Sparkles }
    return m[id] || FolderOpen
  }

  const toggle = (id) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n) }
  const recommended = categories.filter(item => item.recommended)
  const toggleAll = () => setSelected(recommended.every(item => selected.has(item.id)) ? new Set() : new Set(recommended.map(item => item.id)))
  const totalSel = [...selected].reduce((s, id) => s + (categories.find(c => c.id === id)?.size || 0), 0)

  const scan = async () => {
    setScanning(true); setDone(false); setError(''); setProgress(0); setStage('Scanning safe cleanup locations...')
    try {
      const data = await scanCleanup()
      setCategories(data); setProgress(100)
    } catch (err) { setError(err.message) }
    finally { setScanning(false) }
  }

  const clean = async () => {
    setCleaning(true); setProgress(0); setError(''); setResultInfo(null)
    try {
      const result = await runCleanup([...selected], ({ percent, stage: st }) => {
        setProgress(percent); if (st) setStage(st)
      })
      setFreed(result.freed || 0); setResultInfo(result); setDone(true); setSelected(new Set())
      setCategories(await scanCleanup())
    } catch (err) { setError(err.message) }
    finally { setCleaning(false) }
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

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

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
            <CheckCircle size={16} /> Reclaimed {freed >= 1 ? `${freed.toFixed(2)} GB` : `${(freed * 1024).toFixed(0)} MB`} from {resultInfo?.deletedFiles || 0} files
            {resultInfo?.errors?.length > 0 && <span className="ml-2 text-[var(--orange)]">{resultInfo.errors.length} locked or protected items skipped</span>}
          </div>
        )}

        <div className="flex items-center justify-between mb-3 text-xs text-[var(--text-secondary)]">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="chk" checked={recommended.length > 0 && recommended.every(item => selected.has(item.id))} onChange={toggleAll} />
            Select recommended
          </label>
          <span>{selected.size} of {categories.length}</span>
        </div>

        <div className="space-y-1.5">
          {categories.map(({ id, name: label, desc, size, path: detail, files, risk, recommended: isRecommended }) => {
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
                  <div className="text-sm font-semibold flex items-center gap-2">{label}<span className={`badge ${risk === 'Review' ? 'badge-orange' : 'badge-green'}`}>{isRecommended ? 'Recommended' : 'Review'}</span></div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{desc} &middot; {files} files &middot; {detail.slice(0, 60)}</div>
                </div>
                <div className="text-sm font-semibold text-[var(--text-secondary)] shrink-0">{size >= 1 ? `${size.toFixed(2)} GB` : `${(size * 1024).toFixed(0)} MB`}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
