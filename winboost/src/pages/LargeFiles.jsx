import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Calendar, ExternalLink, File, FileArchive, FileImage, FileVideo, HardDrive, Loader, RotateCcw, Search, Trash2 } from 'lucide-react'
import { revealLargeFile, scanLargeFiles, trashLargeFile } from '../lib/api'

const icons = { videos: FileVideo, images: FileImage, archives: FileArchive, disk: HardDrive, other: File, music: File }

export default function LargeFiles() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [minSize, setMinSize] = useState(100)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [meta, setMeta] = useState({ root: '', scannedItems: 0, limited: false })
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const fetchFiles = useCallback(async size => {
    setLoading(true); setError(''); setProgress(0)
    try {
      const result = await scanLargeFiles(size, data => { setProgress(data.percent || 0); if (data.stage) setStage(data.stage) })
      setFiles(result.files || []); setMeta(result)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchFiles(100) }, [fetchFiles])

  const trash = async file => {
    setBusy(file.id); setError('')
    try { await trashLargeFile(file.id); setFiles(items => items.filter(item => item.id !== file.id)) }
    catch (err) { setError(err.message) }
    finally { setBusy(null) }
  }

  const total = files.reduce((sum, file) => sum + file.size, 0)

  return (
    <div className="space-y-5 anim-fade-up">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-bg text-orange">
            <Search size={23} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
              <HardDrive size={12} /> Recoverable file management
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">Large Files Explorer</h1>
            <p className="text-[12px] text-text-tertiary mt-1">Find real storage consumers in your user profile, reveal them in Explorer or move them safely to the Recycle Bin.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 py-2 px-5 rounded-[10px] bg-surface-secondary hover:bg-surface-hover border border-border text-text-secondary text-[13px] font-semibold disabled:opacity-50" onClick={() => fetchFiles(minSize)} disabled={loading}>
          <RotateCcw size={13} className={loading ? 'animate-spin' : ''} /> Rescan
        </button>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: HardDrive, val: files.length, sub: 'Large files found', color: '#45e8ff' },
          { icon: Search, val: `${total.toFixed(2)} GB`, sub: 'Visible space', color: '#bd6cff' },
          { icon: FileArchive, val: `${(meta.scannedItems || 0).toLocaleString()}`, sub: 'Items inspected', color: '#ffb45b' },
        ].map(item => (
          <div key={item.sub} className="rounded-[14px] bg-surface border border-border p-4 flex flex-col items-center gap-1.5 text-center">
            <item.icon size={18} style={{ color: item.color }} />
            <strong className="text-lg font-bold text-text">{item.val}</strong>
            <span className="text-[11px] text-text-tertiary">{item.sub}</span>
          </div>
        ))}
      </div>

      <div className="rounded-[14px] bg-surface border border-border p-3 flex items-center gap-3 text-xs">
        <span className="text-text-secondary font-medium">Minimum size</span>
        {[10, 100, 500, 1000, 5000].map(size => (
          <button key={size} onClick={() => { setMinSize(size); fetchFiles(size) }} className={minSize === size ? 'py-1.5 px-3.5 rounded-[8px] bg-accent text-black text-[11px] font-semibold' : 'py-1.5 px-3.5 rounded-[8px] bg-surface-secondary hover:bg-surface-hover text-text-secondary text-[11px] font-medium transition-colors'}>
            {size >= 1000 ? `${size / 1000} GB` : `${size} MB`}
          </button>
        ))}
        <small className="text-text-tertiary ml-auto font-mono">{meta.root}</small>
      </div>

      {loading && (
        <div className="rounded-[14px] bg-surface border border-border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Loader className="animate-spin" size={17} />
            <div className="flex-1">
              <strong className="text-sm text-text">Scanning your files</strong>
              <small className="block text-xs text-text-tertiary">{stage}</small>
            </div>
            <b className="text-sm text-text">{progress}%</b>
          </div>
          <div className="scan-progress"><div className="scan-progress-fill" style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      <div className="rounded-[14px] bg-surface border border-border overflow-hidden">
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_100px] gap-4 px-5 py-3 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider border-b border-border bg-surface-secondary/50">
          <span>File</span><span>Location</span><span>Size</span><span>Modified</span><span>Actions</span>
        </div>
        {!loading && files.length === 0 ? (
          <div className="py-10 text-center text-sm text-text-tertiary">No files larger than {minSize} MB were found.</div>
        ) : files.map(file => {
          const Icon = icons[file.type] || File
          return (
            <div key={file.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_100px] gap-4 px-5 py-3.5 items-center border-b border-border hover:bg-surface-hover transition-colors">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-secondary text-text-secondary">
                  <Icon size={16} />
                </span>
                <div>
                  <strong className="text-sm font-semibold text-text block">{file.name}</strong>
                  <small className="text-[11px] text-text-tertiary">{file.type}</small>
                </div>
              </div>
              <span className="truncate text-sm text-text-secondary" title={file.path}>{file.path}</span>
              <strong className="text-sm text-text">{file.size >= 1 ? `${file.size.toFixed(2)} GB` : `${(file.size * 1024).toFixed(0)} MB`}</strong>
              <span className="flex items-center gap-1.5 text-xs text-text-tertiary"><Calendar size={11} />{file.date}</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => revealLargeFile(file.id)} title="Show in Explorer" className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-secondary hover:bg-surface-hover text-text-secondary hover:text-text transition-colors">
                  <ExternalLink size={14} />
                </button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-bg hover:bg-red-bg text-red transition-colors disabled:opacity-40" onClick={() => trash(file)} disabled={busy === file.id} title="Move to Recycle Bin">
                  {busy === file.id ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {meta.limited && <div className="notice-banner warning"><AlertTriangle size={16} />The scan reached its safety limit. Results show the largest files discovered so far.</div>}
    </div>
  )
}
