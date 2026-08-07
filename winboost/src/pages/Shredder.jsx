import { useState } from 'react'
import { Shredder as SIcon, File, Loader, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { pickFilesToShred, shredFiles } from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

const methods = [
  { id: 1, label: 'Single Pass', desc: 'Overwrite once with zeros', speed: 'Fast', sec: 'Basic' },
  { id: 3, label: 'DoD 3-Pass', desc: '3 passes: zeros, ones, random', speed: 'Medium', sec: 'Standard' },
  { id: 7, label: 'Legacy 7-Pass', desc: 'Multiple overwrite passes for magnetic disks', speed: 'Slow', sec: 'Legacy' },
  { id: 35, label: 'Legacy 35-Pass', desc: 'Historic magnetic-disk overwrite method', speed: 'Very slow', sec: 'Legacy' },
]

export default function Shredder() {
  const [files, setFiles] = useState([])
  const [nPass, setNPass] = useState(3)
  const [shredding, setShredding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [log, setLog] = useState([])
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(false)

  const add = async (type) => {
    const picked = await pickFilesToShred()
    if (picked.length > 0) {
      setFiles(prev => [...prev, ...picked.map(f => ({ ...f, type: type || 'file' }))])
    }
  }

  const rm = (id) => setFiles(prev => prev.filter(f => f.name !== id && f.path !== id))

  const shred = async () => {
    setShredding(true); setProgress(0); setLog([]); setError(''); setCompleted(false)
    const filePaths = files.map(f => f.path || f.name)
    try {
      const result = await shredFiles(filePaths, nPass, (data) => {
        if (data.percent !== undefined) setProgress(data.percent)
        if (data.log) setLog(prev => [...prev, data.log])
      })
      if (result.errors?.length) setError(result.errors.join(' · '))
      if (result.deleted > 0) { setFiles([]); setCompleted(true) }
    } catch (err) { setError(err.message) }
    finally { setShredding(false); setProgress(100) }
  }

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-danger/10 text-sparkle-danger shadow-sm">
            <SIcon size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.15em] mb-2">
              <AlertTriangle size={11} /> Secure Deletion
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">File Shredder</h1>
            <p className="text-[13px] text-sparkle-text-muted mt-1.5 leading-relaxed">Securely delete files beyond recovery using multiple overwrite passes</p>
          </div>
        </div>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="flex items-start gap-3 p-5 rounded-xl bg-sparkle-warning/10 border border-sparkle-warning/15">
        <AlertTriangle size={18} className="text-sparkle-warning shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="font-semibold text-sm text-sparkle-warning">Warning</div>
          <div className="text-xs text-sparkle-text-secondary mt-0.5 leading-relaxed">Verify every selected file. Overwriting is best suited to magnetic disks; SSD wear-leveling can prevent software from guaranteeing every physical copy was overwritten.</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info size={18} className="text-sparkle-danger" /> Shredding Method
          </CardTitle>
          <Badge variant="danger" className="ml-auto">{nPass} passes</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {methods.map(m => (
              <button key={m.id} onClick={() => setNPass(m.id)}
                className={`p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                  nPass === m.id ? 'border-sparkle-primary/30 bg-sparkle-primary/5 ring-1 ring-sparkle-primary/20' : 'border-sparkle-border bg-sparkle-accent/50 hover:bg-sparkle-accent hover:border-sparkle-border'
                }`}>
                <div className="font-semibold text-sm text-sparkle-text">{m.label}</div>
                <div className="text-xs text-sparkle-text-muted mt-0.5">{m.desc}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-sparkle-text-muted">{m.speed}</span>
                  <Badge variant="teal">{m.sec}</Badge>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <File size={18} className="text-sparkle-danger" /> Files to Shred
          </CardTitle>
          <Badge variant="outline" className="ml-auto">{files.length} {files.length === 1 ? 'item' : 'items'}</Badge>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-12 text-sparkle-text-muted text-sm">
              <SIcon size={36} className="mx-auto mb-3 opacity-15" />
              Add files to securely shred
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-sparkle-accent/50 hover:bg-sparkle-accent transition-all duration-200 border border-sparkle-border">
                  <File size={16} className="text-sparkle-text-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-sparkle-text truncate max-w-[400px]">{f.name}</div>
                    <div className="text-xs text-sparkle-text-muted">{f.size !== undefined ? `${f.size} MB` : ''}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => rm(f.path || f.name)} className="text-sparkle-text-muted hover:text-sparkle-danger">Remove</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {shredding && (
        <Card>
          <CardContent className="py-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] text-sparkle-text-secondary">
                <Loader size={16} className="animate-spin text-sparkle-primary" />
                <span>Shredding...</span>
              </div>
              <span className="text-lg font-bold text-gradient">{progress}%</span>
            </div>
            <Progress value={progress} />
            <div className="max-h-28 overflow-y-auto space-y-1">
              {log.slice(-5).map((l, i) => (
                <div key={i} className="text-xs text-sparkle-text-muted flex items-center gap-1.5">
                  <CheckCircle size={10} className="text-sparkle-success shrink-0" /> {l}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!shredding && completed && files.length === 0 && (
        <Card className="text-center">
          <CardContent className="py-6 flex flex-col items-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-sparkle-success/10 text-sparkle-success mb-3">
              <CheckCircle size={28} />
            </div>
            <div className="font-semibold text-sparkle-text">Files Shredded</div>
            <div className="text-xs text-sparkle-text-muted mt-1">File content overwritten {nPass} time{nPass === 1 ? '' : 's'} and the filesystem entry removed</div>
          </CardContent>
        </Card>
      )}

      {files.length > 0 && !shredding && (
        <Button variant="danger" size="lg" onClick={shred} className="w-full" disabled={shredding}>
          <SIcon size={16} /> Shred {files.length} {files.length === 1 ? 'item' : 'items'} ({nPass} passes)
        </Button>
      )}
    </div>
  )
}
