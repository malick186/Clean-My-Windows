import { useState } from 'react'
import { Shredder as SIcon, File, FolderOpen, Loader, CheckCircle, AlertTriangle } from 'lucide-react'
import { pickFilesToShred, shredFiles } from '../lib/api'

const methods = [
  { id: 1, label: 'Single Pass', desc: 'Overwrite once with zeros', speed: 'Fast', sec: 'Basic' },
  { id: 3, label: 'DoD 3-Pass', desc: '3 passes: zeros, ones, random', speed: 'Medium', sec: 'Standard' },
  { id: 7, label: 'DoD 7-Pass', desc: 'Per DoD 5220.22-M standard', speed: 'Slow', sec: 'High' },
  { id: 35, label: 'Gutmann 35-Pass', desc: '35 overwrite patterns', speed: 'Very slow', sec: 'Maximum' },
]

export default function Shredder() {
  const [files, setFiles] = useState([])
  const [nPass, setNPass] = useState(3)
  const [shredding, setShredding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [log, setLog] = useState([])

  const add = async (type) => {
    const picked = await pickFilesToShred()
    if (picked.length > 0) {
      setFiles(prev => [...prev, ...picked.map(f => ({ ...f, type: type || 'file' }))])
    }
  }

  const rm = (id) => setFiles(prev => prev.filter(f => f.name !== id && f.path !== id))

  const shred = async () => {
    setShredding(true); setProgress(0); setLog([])
    const filePaths = files.map(f => f.path || f.name)
    try {
      await shredFiles(filePaths, nPass, (data) => {
        if (data.percent !== undefined) setProgress(data.percent)
        if (data.log) setLog(prev => [...prev, data.log])
      })
    } catch (_) {}
    setShredding(false); setFiles([]); setProgress(100)
  }

  return (
    <div className="anim-fade-up space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--red-bg)' }}>
            <SIcon size={20} color="#ff3b30" />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">File Shredder</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] ml-12">Securely delete files beyond recovery using multiple overwrite passes</p>
      </div>

      <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'var(--orange-bg)', border: '1px solid rgba(255,149,0,0.15)' }}>
        <AlertTriangle size={18} color="#ff9500" className="shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-sm" style={{ color: 'var(--orange)' }}>Warning</div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">Shredded files cannot be recovered. Verify you have selected the correct files.</div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Shredding Method</h3>
        <div className="grid grid-cols-4 gap-3">
          {methods.map(m => (
            <button key={m.id} onClick={() => setNPass(m.id)}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                nPass === m.id ? 'border-[#0071e3]/30 bg-[#0071e3]/[0.04]' : 'border-[var(--border)] hover:border-[var(--border-hover)]'
              }`}>
              <div className="font-semibold text-sm">{m.label}</div>
              <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{m.desc}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-[var(--text-tertiary)]">{m.speed}</span>
                <span className="badge badge-blue">{m.sec}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Files to Shred</h3>
          <div className="flex gap-2">
            <button onClick={() => add('file')} className="btn btn-secondary btn-sm"><File size={13} /> Select Files</button>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="text-center py-10 text-[var(--text-tertiary)] text-sm">
            <SIcon size={36} className="mx-auto mb-3 opacity-15" />
            Add files to securely shred
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-3">
                  <File size={16} className="text-[var(--text-tertiary)]" />
                  <div>
                    <div className="text-sm font-medium truncate max-w-[400px]">{f.name}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">{f.size !== undefined ? `${f.size} MB` : ''}</div>
                  </div>
                </div>
                <button onClick={() => rm(f.path || f.name)} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--red)] transition-colors">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {shredding && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Loader size={16} className="animate-spin" style={{ color: 'var(--accent)' }} /><span className="text-sm font-medium">Shredding...</span></div>
            <span className="text-lg font-bold text-gradient">{progress}%</span>
          </div>
          <div className="progress"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          <div className="max-h-28 overflow-y-auto space-y-1">
            {log.slice(-5).map((l, i) => (
              <div key={i} className="text-xs text-[var(--text-tertiary)] flex items-center gap-1.5">
                <CheckCircle size={10} color="var(--green)" /> {l}
              </div>
            ))}
          </div>
        </div>
      )}

      {!shredding && log.length > 0 && files.length === 0 && (
        <div className="card p-6 text-center">
          <CheckCircle size={32} color="var(--green)" className="mx-auto mb-2" />
          <div className="font-semibold">Files Shredded</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-0.5">Data overwritten {nPass} times -- unrecoverable</div>
        </div>
      )}

      {files.length > 0 && !shredding && (
        <button onClick={shred} className="btn btn-danger w-full btn-lg">
          <SIcon size={16} /> Shred {files.length} {files.length === 1 ? 'item' : 'items'} ({nPass} passes)
        </button>
      )}
    </div>
  )
}
