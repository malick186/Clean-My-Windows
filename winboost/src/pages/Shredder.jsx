import { useState } from 'react'
import { Shredder as SIcon, File, Loader, CheckCircle, AlertTriangle } from 'lucide-react'
import { pickFilesToShred, shredFiles } from '../lib/api'

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
    <div className="space-y-5 anim-fade-up">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-bg text-red">
            <SIcon size={23} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
              <AlertTriangle size={12} /> Secure Deletion
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">File Shredder</h1>
            <p className="text-[12px] text-text-tertiary mt-1">Securely delete files beyond recovery using multiple overwrite passes</p>
          </div>
        </div>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="flex items-start gap-3 p-4 rounded-[12px] bg-orange-bg border border-orange/15">
        <AlertTriangle size={18} className="text-orange shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-sm text-orange">Warning</div>
          <div className="text-xs text-text-secondary mt-0.5">Verify every selected file. Overwriting is best suited to magnetic disks; SSD wear-leveling can prevent software from guaranteeing every physical copy was overwritten.</div>
        </div>
      </div>

      <div className="rounded-[14px] bg-surface border border-border p-5">
        <h3 className="text-[14px] font-semibold text-text-secondary mb-3">Shredding Method</h3>
        <div className="grid grid-cols-4 gap-3">
          {methods.map(m => (
            <button key={m.id} onClick={() => setNPass(m.id)}
              className={`p-4 rounded-[12px] border text-left transition-all cursor-pointer ${
                nPass === m.id ? 'border-accent/30 bg-accent/[0.05]' : 'border-border hover:border-border-hover'
              }`}>
              <div className="font-semibold text-sm text-text">{m.label}</div>
              <div className="text-xs text-text-tertiary mt-0.5">{m.desc}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-text-tertiary">{m.speed}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-[10px] font-bold bg-teal-bg text-teal">{m.sec}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[14px] bg-surface border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-text">Files to Shred</h3>
          <div className="flex gap-2">
            <button onClick={() => add('file')} className="flex items-center gap-2 py-2 px-5 rounded-[10px] bg-surface-secondary hover:bg-surface-hover border border-border text-text-secondary text-[13px] font-semibold transition-colors disabled:opacity-50">
              <File size={13} /> Select Files
            </button>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="text-center py-10 text-text-tertiary text-sm">
            <SIcon size={36} className="mx-auto mb-3 opacity-15" />
            Add files to securely shred
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-[10px] bg-surface-secondary">
                <div className="flex items-center gap-3">
                  <File size={16} className="text-text-tertiary" />
                  <div>
                    <div className="text-sm font-medium text-text truncate max-w-[400px]">{f.name}</div>
                    <div className="text-xs text-text-tertiary">{f.size !== undefined ? `${f.size} MB` : ''}</div>
                  </div>
                </div>
                <button onClick={() => rm(f.path || f.name)} className="text-xs text-text-tertiary hover:text-red transition-colors">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {shredding && (
        <div className="rounded-[14px] bg-surface border border-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Loader size={16} className="animate-spin text-accent" /><span className="text-sm font-medium text-text">Shredding...</span></div>
            <span className="text-lg font-bold text-gradient">{progress}%</span>
          </div>
          <div className="scan-progress"><div className="scan-progress-fill" style={{ width: `${progress}%` }} /></div>
          <div className="max-h-28 overflow-y-auto space-y-1">
            {log.slice(-5).map((l, i) => (
              <div key={i} className="text-xs text-text-tertiary flex items-center gap-1.5">
                <CheckCircle size={10} className="text-green" /> {l}
              </div>
            ))}
          </div>
        </div>
      )}

      {!shredding && completed && files.length === 0 && (
        <div className="rounded-[14px] bg-surface border border-border p-6 text-center">
          <CheckCircle size={32} className="text-green mx-auto mb-2" />
          <div className="font-semibold text-text">Files Shredded</div>
          <div className="text-xs text-text-tertiary mt-0.5">File content overwritten {nPass} time{nPass === 1 ? '' : 's'} and the filesystem entry removed</div>
        </div>
      )}

      {files.length > 0 && !shredding && (
        <button onClick={shred} className="flex items-center justify-center gap-2 py-3 px-5 rounded-[10px] bg-red text-white font-semibold text-[13px] hover:opacity-90 transition-opacity disabled:opacity-50 w-full">
          <SIcon size={16} /> Shred {files.length} {files.length === 1 ? 'item' : 'items'} ({nPass} passes)
        </button>
      )}
    </div>
  )
}
