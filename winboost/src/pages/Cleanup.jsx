import { useState, useEffect } from 'react'
import { Brush, Globe, FolderOpen, Database, Download, Recycle, FileText, CheckCircle, Loader, Search, Sparkles, AlertTriangle } from 'lucide-react'
import { scanCleanup, runCleanup } from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

export default function Cleanup() {
  const [categories, setCategories] = useState([])
  const [scanning, setScanning] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
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
      setInitialLoading(false)
    }).catch(err => { setError(err.message); setInitialLoading(false) })
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
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-teal/10 text-sparkle-teal">
            <Brush size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.15em] mb-2">
              <Sparkles size={11} /> Junk File Cleaner
            </div>
            <h1 className="text-[28px] font-bold leading-[1.1] tracking-tight">System Cleanup</h1>
            <p className="text-[13px] text-sparkle-muted mt-1.5 leading-relaxed">Remove junk files, caches, and temporary data to free up space</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={scan} disabled={scanning || cleaning}>
            <Search size={14} /> Scan
          </Button>
          <Button variant="primary" size="sm" onClick={clean} disabled={selected.size === 0 || cleaning || scanning}>
            <Sparkles size={14} /> Clean ({totalSel.toFixed(1)} GB)
          </Button>
        </div>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      {(scanning || cleaning) && (
        <Card>
          <CardContent className="py-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] text-sparkle-text-secondary">
                <Loader size={16} className="animate-spin text-sparkle-primary" />
                <span>{scanning ? stage : 'Cleaning in progress...'}</span>
              </div>
              <span className="text-lg font-bold text-gradient">{progress}%</span>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>
      )}

      {done && (
        <div className="notice-banner success mb-5">
          <CheckCircle size={17} /> Reclaimed {freed >= 1 ? `${freed.toFixed(2)} GB` : `${(freed * 1024).toFixed(0)} MB`} from {resultInfo?.deletedFiles || 0} files
          {resultInfo?.errors?.length > 0 && <span className="ml-2 text-sparkle-warning">{resultInfo.errors.length} locked or protected items skipped</span>}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brush size={18} className="text-sparkle-teal" /> Cleanup Categories
          </CardTitle>
          <div className="flex items-center ml-auto gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-sparkle-text-secondary">
              <input type="checkbox" className="w-4 h-4 rounded accent-sparkle-teal" checked={recommended.length > 0 && recommended.every(item => selected.has(item.id))} onChange={toggleAll} />
              Select recommended
            </label>
            <Badge variant="teal">{selected.size} of {categories.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {initialLoading && categories.length === 0 ? (
            <div className="loading-state"><div className="loading-spinner" /><span>Scanning for junk...</span></div>
          ) : (
            categories.map(({ id, name: label, desc, size, path: detail, files, risk, recommended: isRecommended }) => {
            const sel = selected.has(id)
            const Icon = iconFor(id)
            return (
              <div key={id} onClick={() => toggle(id)}
                className={`flex items-center gap-4 p-4 rounded-xl bg-sparkle-accent/50 hover:bg-sparkle-accent transition-all duration-200 border border-sparkle-border cursor-pointer ${
                  sel ? 'ring-1 ring-sparkle-teal/25 bg-sparkle-teal/[0.04]' : ''
                }`}>
                <input type="checkbox" className="w-4 h-4 rounded accent-sparkle-teal" checked={sel} readOnly />
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${sel ? 'bg-sparkle-teal/10 text-sparkle-teal' : 'bg-sparkle-accent text-sparkle-muted'}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold flex items-center gap-2">
                    {label}
                    <Badge variant={isRecommended ? 'success' : 'warning'}>{isRecommended ? 'Recommended' : risk}</Badge>
                  </div>
                  <div className="text-[11px] text-sparkle-muted mt-0.5">{desc} &middot; {files} files &middot; {detail.slice(0, 60)}</div>
                </div>
                <div className="text-[13px] font-semibold text-sparkle-text-secondary shrink-0">{size >= 1 ? `${size.toFixed(2)} GB` : `${(size * 1024).toFixed(0)} MB`}</div>
              </div>
            )
          })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
