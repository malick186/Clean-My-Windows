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
    <div className="anim-fade-up space-y-6">
      <div className="page-hero compact-hero">
        <div className="page-hero-icon cyan"><Search size={23} /></div>
        <div><span className="eyebrow"><HardDrive size={12} /> Recoverable file management</span><h1>Large Files Explorer</h1><p>Find real storage consumers in your user profile, reveal them in Explorer or move them safely to the Recycle Bin.</p></div>
        <button className="btn btn-secondary btn-sm hero-action" onClick={() => fetchFiles(minSize)} disabled={loading}><RotateCcw size={13} className={loading ? 'animate-spin' : ''} /> Rescan</button>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="grid grid-cols-3 gap-4 stat-card-grid">
        {[
          { icon: HardDrive, val: files.length, sub: 'Large files found', color: '#45e8ff' },
          { icon: Search, val: `${total.toFixed(2)} GB`, sub: 'Visible space', color: '#bd6cff' },
          { icon: FileArchive, val: `${(meta.scannedItems || 0).toLocaleString()}`, sub: 'Items inspected', color: '#ffb45b' },
        ].map(item => <div key={item.sub} className="card metric-card"><item.icon size={18} style={{ color: item.color }} /><strong>{item.val}</strong><span>{item.sub}</span></div>)}
      </div>

      <div className="filter-strip card"><span>Minimum size</span>{[10, 100, 500, 1000, 5000].map(size => <button key={size} onClick={() => { setMinSize(size); fetchFiles(size) }} className={minSize === size ? 'active' : ''}>{size >= 1000 ? `${size / 1000} GB` : `${size} MB`}</button>)}<small>{meta.root}</small></div>

      {loading && <div className="task-progress-card"><div><Loader className="animate-spin" size={17} /><span><strong>Scanning your files</strong><small>{stage}</small></span><b>{progress}%</b></div><div className="progress"><div className="progress-fill" style={{ width: `${progress}%` }} /></div></div>}

      <div className="card overflow-hidden file-table">
        <div className="file-table-head"><span>File</span><span>Location</span><span>Size</span><span>Modified</span><span>Actions</span></div>
        {!loading && files.length === 0 ? <div className="empty-compact">No files larger than {minSize} MB were found.</div> : files.map(file => {
          const Icon = icons[file.type] || File
          return <div key={file.id} className="file-table-row">
            <div><span className="file-type-icon"><Icon size={16} /></span><p><strong>{file.name}</strong><small>{file.type}</small></p></div>
            <span className="truncate" title={file.path}>{file.path}</span>
            <strong>{file.size >= 1 ? `${file.size.toFixed(2)} GB` : `${(file.size * 1024).toFixed(0)} MB`}</strong>
            <span><Calendar size={11} />{file.date}</span>
            <div className="row-actions"><button onClick={() => revealLargeFile(file.id)} title="Show in Explorer"><ExternalLink size={14} /></button><button className="danger" onClick={() => trash(file)} disabled={busy === file.id} title="Move to Recycle Bin">{busy === file.id ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}</button></div>
          </div>
        })}
      </div>
      {meta.limited && <div className="notice-banner warning"><AlertTriangle size={16} />The scan reached its safety limit. Results show the largest files discovered so far.</div>}
    </div>
  )
}
