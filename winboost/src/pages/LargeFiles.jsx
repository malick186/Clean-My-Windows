import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Calendar, ExternalLink, File, FileArchive, FileImage, FileVideo, HardDrive, Loader, RotateCcw, Search, Trash2 } from 'lucide-react'
import { revealLargeFile, scanLargeFiles, trashLargeFile } from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

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
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl sparkle-warning/10 sparkle-warning shadow-sm">
            <Search size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold sparkle-primary uppercase tracking-[0.15em] mb-2">
              <HardDrive size={11} /> Recoverable file management
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">Large Files Explorer</h1>
            <p className="text-[13px] sparkle-text-muted mt-1.5 leading-relaxed">Find real storage consumers in your user profile, reveal them in Explorer or move them safely to the Recycle Bin.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => fetchFiles(minSize)} disabled={loading}>
          <RotateCcw size={13} className={loading ? 'animate-spin' : ''} /> Rescan
        </Button>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: HardDrive, val: files.length, sub: 'Large files found', color: '#45e8ff' },
          { icon: Search, val: `${total.toFixed(2)} GB`, sub: 'Visible space', color: '#bd6cff' },
          { icon: FileArchive, val: `${(meta.scannedItems || 0).toLocaleString()}`, sub: 'Items inspected', color: '#ffb45b' },
        ].map(item => (
          <Card key={item.sub} className="p-4">
            <CardContent className="flex flex-col items-center gap-1.5 text-center">
              <item.icon size={18} style={{ color: item.color }} />
              <strong className="text-lg font-bold sparkle-text">{item.val}</strong>
              <span className="text-[11px] sparkle-text-muted">{item.sub}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="p-3">
        <CardContent className="flex items-center gap-3 text-xs">
          <span className="sparkle-text-secondary font-medium">Minimum size</span>
          {[10, 100, 500, 1000, 5000].map(size => (
            <Button
              key={size}
              variant={minSize === size ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => { setMinSize(size); fetchFiles(size) }}
            >
              {size >= 1000 ? `${size / 1000} GB` : `${size} MB`}
            </Button>
          ))}
          <small className="sparkle-text-muted ml-auto font-mono">{meta.root}</small>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Loader className="animate-spin" size={17} />
              <div className="flex-1">
                <strong className="text-sm sparkle-text">Scanning your files</strong>
                <small className="block text-xs sparkle-text-muted">{stage}</small>
              </div>
              <b className="text-sm sparkle-text">{progress}%</b>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_100px] gap-4 px-5 py-3 text-[11px] font-semibold sparkle-text-muted uppercase tracking-wider border-b border-sparkle-border sparkle-accent/50">
          <span>File</span><span>Location</span><span>Size</span><span>Modified</span><span>Actions</span>
        </div>
        {!loading && files.length === 0 ? (
          <div className="py-10 text-center text-sm sparkle-text-muted">No files larger than {minSize} MB were found.</div>
        ) : files.map(file => {
          const Icon = icons[file.type] || File
          return (
            <div key={file.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_100px] gap-4 px-5 py-3.5 items-center border-b border-sparkle-border hover:sparkle-accent transition-all duration-200">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center sparkle-accent sparkle-text-secondary">
                  <Icon size={16} />
                </span>
                <div>
                  <strong className="text-sm font-semibold sparkle-text block">{file.name}</strong>
                  <small className="text-[11px] sparkle-text-muted">{file.type}</small>
                </div>
              </div>
              <span className="truncate text-sm sparkle-text-secondary" title={file.path}>{file.path}</span>
              <strong className="text-sm sparkle-text">{file.size >= 1 ? `${file.size.toFixed(2)} GB` : `${(file.size * 1024).toFixed(0)} MB`}</strong>
              <span className="flex items-center gap-1.5 text-xs sparkle-text-muted"><Calendar size={11} />{file.date}</span>
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
      {meta.limited && <div className="notice-banner warning"><AlertTriangle size={16} />The scan reached its safety limit. Results show the largest files discovered so far.</div>}
    </div>
  )
}
