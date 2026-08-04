import { useState } from 'react'
import { Wrench, CheckCircle, Loader, Play, RefreshCw, HardDrive, Globe, Database, Monitor, FileText, Trash2, Zap, Search } from 'lucide-react'

const tasks = [
  { id: 'flushdns', icon: Globe, label: 'Flush DNS Cache', desc: 'Clear DNS resolver cache', cat: 'Network', risk: 'Low' },
  { id: 'chkdsk', icon: HardDrive, label: 'Check Disk Errors', desc: 'Scan & repair file system (CHKDSK)', cat: 'Disk', risk: 'Low' },
  { id: 'sfc', icon: FileText, label: 'System File Checker', desc: 'Restore corrupted system files (SFC)', cat: 'System', risk: 'Low' },
  { id: 'dism', icon: Database, label: 'Repair Windows Image', desc: 'Fix system image (DISM)', cat: 'System', risk: 'Medium' },
  { id: 'reindex', icon: Search, label: 'Rebuild Search Index', desc: 'Rebuild Windows search index', cat: 'System', risk: 'Low' },
  { id: 'winsock', icon: Globe, label: 'Reset Network Stack', desc: 'Reset Winsock & TCP/IP', cat: 'Network', risk: 'Medium' },
  { id: 'wucache', icon: Trash2, label: 'Clean Update Cache', desc: 'Remove old Windows Update files', cat: 'Cleanup', risk: 'Low' },
  { id: 'prefetch', icon: Zap, label: 'Clear Prefetch', desc: 'Clear Windows prefetch cache', cat: 'Performance', risk: 'Low' },
  { id: 'fontcache', icon: Monitor, label: 'Rebuild Font Cache', desc: 'Clear corrupted font cache', cat: 'System', risk: 'Low' },
  { id: 'defrag', icon: HardDrive, label: 'Optimize Drives', desc: 'Defragment disk drives', cat: 'Disk', risk: 'Low' },
  { id: 'thumbcache', icon: Monitor, label: 'Clear Thumbnail Cache', desc: 'Delete thumbnail database', cat: 'Cleanup', risk: 'Low' },
  { id: 'store', icon: Database, label: 'Reset Store Cache', desc: 'Clear Microsoft Store cache', cat: 'Apps', risk: 'Low' },
]

export default function Maintenance() {
  const [running, setRunning] = useState(null)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(new Set())
  const [selected, setSelected] = useState(new Set(tasks.map(t => t.id)))
  const [batch, setBatch] = useState(false)

  const toggle = (id) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n) }
  const toggleAll = () => setSelected(selected.size === tasks.length ? new Set() : new Set(tasks.map(t => t.id)))

  const runOne = (id) => {
    setRunning(id); setProgress(0)
    const t = tasks.find(x => x.id === id)
    let p = 0
    const iv = setInterval(() => { p += Math.random() * 4 + 2; if (p >= 100) { p = 100; clearInterval(iv); setRunning(null); setDone(prev => new Set([...prev, id])) } setProgress(Math.round(p)) }, t.risk === 'Medium' ? 120 : 70)
  }

  const runAll = async () => {
    setBatch(true)
    for (const id of selected) {
      setRunning(id); setProgress(0)
      await new Promise(res => {
        const t = tasks.find(x => x.id === id)
        let p = 0
        const iv = setInterval(() => { p += Math.random() * 4 + 2; if (p >= 100) { p = 100; clearInterval(iv); setDone(prev => new Set([...prev, id])); res() } setProgress(Math.round(p)) }, t.risk === 'Medium' ? 120 : 70)
      })
    }
    setRunning(null); setBatch(false)
  }

  return (
    <div className="anim-fade-up space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--green-bg)' }}>
            <Wrench size={20} color="#34c759" />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">System Maintenance</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] ml-12">Run maintenance scripts to keep your system healthy</p>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input type="checkbox" className="chk" checked={selected.size === tasks.length} onChange={toggleAll} />
          <span className="text-[var(--text-secondary)]">Select All ({selected.size}/{tasks.length})</span>
        </label>
        <div className="flex gap-2">
          <button onClick={() => setDone(new Set())} className="btn btn-secondary btn-sm"><RefreshCw size={13} /> Reset</button>
          <button onClick={runAll} disabled={batch || selected.size === 0} className="btn btn-primary btn-sm">
            {batch ? <Loader size={13} className="animate-spin" /> : <Play size={13} />}
            Run All Selected
          </button>
        </div>
      </div>

      {running && (
        <div className="card p-4 space-y-2" style={{ borderColor: 'rgba(0,113,227,0.2)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <div>
                <div className="text-sm font-semibold">{tasks.find(t => t.id === running)?.label}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{tasks.find(t => t.id === running)?.desc}</div>
              </div>
            </div>
            <span className="text-sm font-bold text-gradient">{progress}%</span>
          </div>
          <div className="progress"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      <div className="card overflow-hidden">
        {tasks.map(t => {
          const isRunning = running === t.id
          const isDone = done.has(t.id)
          const isSel = selected.has(t.id)
          const riskCls = t.risk === 'Medium' ? 'badge-orange' : 'badge-green'

          return (
            <div key={t.id} className={`flex items-center gap-4 px-5 py-3.5 border-b border-[var(--border)] transition-colors ${
              isRunning ? 'bg-[#0071e3]/[0.02]' : isDone ? 'bg-[#34c759]/[0.02]' : 'hover:bg-[var(--bg-secondary)]'
            }`}>
              <input type="checkbox" className="chk" checked={isSel} onChange={() => toggle(t.id)} disabled={isRunning} />
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: isDone ? 'var(--green-bg)' : isRunning ? 'var(--blue-bg)' : 'var(--bg-secondary)' }}>
                {isDone ? <CheckCircle size={17} color="var(--green)" /> : <t.icon size={17} style={{ color: isRunning ? 'var(--blue)' : 'var(--text-tertiary)' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{t.desc}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`badge ${riskCls}`}>{t.risk}</span>
                <span className="text-[11px] text-[var(--text-tertiary)]">{t.cat}</span>
                {isDone ? <span className="badge badge-green">Done</span> :
                 isRunning ? <Loader size={14} className="animate-spin" style={{ color: 'var(--accent)' }} /> :
                 <button onClick={() => runOne(t.id)} className="btn btn-secondary btn-sm"><Play size={11} /> Run</button>}
              </div>
            </div>
          )
        })}
      </div>

      {done.size > 0 && (
        <div className="p-4 rounded-xl text-center" style={{ background: 'var(--green-bg)' }}>
          <CheckCircle size={18} color="var(--green)" className="inline mr-2 -mt-0.5" />
          <span className="text-sm font-medium" style={{ color: 'var(--green)' }}>{done.size} task{done.size > 1 ? 's' : ''} completed</span>
        </div>
      )}
    </div>
  )
}
