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
    <div className="space-y-5 anim-fade-up">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-bg text-teal">
            <Brush size={23} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
              <Sparkles size={12} /> System Cleanup
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">System Cleanup</h1>
            <p className="text-[12px] text-text-tertiary mt-1">Remove junk files, caches, and temporary data to free up space</p>
          </div>
        </div>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="rounded-[14px] bg-surface border border-border p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-[13px] text-text-secondary">
            {scanning && <Loader size={16} className="animate-spin text-accent" />}
            {done && <CheckCircle size={16} className="text-green" />}
            <span>{scanning ? stage : done ? 'Cleanup complete!' : `${categories.length} categories`}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={scan} disabled={scanning || cleaning} className="flex items-center gap-2 py-2 px-5 rounded-[10px] bg-surface-secondary hover:bg-surface-hover border border-border text-text-secondary text-[13px] font-semibold transition-colors disabled:opacity-50">
              <Search size={14} /> Scan
            </button>
            <button onClick={clean} disabled={selected.size === 0 || cleaning || scanning} className="flex items-center gap-2 py-2 px-5 rounded-[10px] bg-accent text-black font-semibold text-[13px] hover:opacity-90 transition-opacity disabled:opacity-50">
              <Sparkles size={14} /> Clean ({totalSel.toFixed(1)} GB)
            </button>
          </div>
        </div>

        {(scanning || cleaning) && (
          <div className="mb-5 space-y-2">
            <div className="flex justify-between text-[11px] text-text-tertiary">
              <span>{scanning ? 'Analyzing...' : 'Cleaning...'}</span>
              <span className="font-semibold text-accent">{progress}%</span>
            </div>
            <div className="scan-progress"><div className="scan-progress-fill" style={{ width: `${progress}%` }} /></div>
          </div>
        )}

        {done && (
          <div className="notice-banner success mb-5">
            <CheckCircle size={17} /> Reclaimed {freed >= 1 ? `${freed.toFixed(2)} GB` : `${(freed * 1024).toFixed(0)} MB`} from {resultInfo?.deletedFiles || 0} files
            {resultInfo?.errors?.length > 0 && <span className="ml-2 text-orange">{resultInfo.errors.length} locked or protected items skipped</span>}
          </div>
        )}

        <div className="flex items-center justify-between mb-3 text-[12px] text-text-secondary">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 rounded accent-accent" checked={recommended.length > 0 && recommended.every(item => selected.has(item.id))} onChange={toggleAll} />
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
                className={`flex items-center gap-3 p-3 rounded-[10px] cursor-pointer transition-colors border ${
                  sel ? 'border-accent/20 bg-accent/[0.04]' : 'border-transparent bg-surface-secondary hover:bg-surface-hover'
                }`}>
                <input type="checkbox" className="w-4 h-4 rounded accent-accent" checked={sel} readOnly />
                <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${sel ? 'bg-teal-bg text-teal' : 'bg-surface-secondary text-text-tertiary'}`}>
                  <Icon size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold flex items-center gap-2">
                    {label}
                    <span className={`text-[10px] px-2 py-0.5 rounded-[10px] font-bold ${isRecommended ? 'bg-green-bg text-green' : 'bg-orange-bg text-orange'}`}>
                      {isRecommended ? 'Recommended' : risk}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">{desc} &middot; {files} files &middot; {detail.slice(0, 60)}</div>
                </div>
                <div className="text-[13px] font-semibold text-text-secondary shrink-0">{size >= 1 ? `${size.toFixed(2)} GB` : `${(size * 1024).toFixed(0)} MB`}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
