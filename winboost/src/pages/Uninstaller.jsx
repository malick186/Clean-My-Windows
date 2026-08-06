import { useState, useEffect } from 'react'
import { Trash2, Package, Search, Loader, CheckCircle, Calendar, HardDrive, RefreshCw, AlertTriangle } from 'lucide-react'
import { listApps, uninstallApp } from '../lib/api'

const COLORS = ['#007aff', '#34c759', '#5856d6', '#af52de', '#ff9500', '#ff3b30']

export default function Uninstaller() {
  const [apps, setApps] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [uninstalling, setUninstalling] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = async () => {
    setLoading(true); setError('')
    try { setApps(await listApps()) } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const filtered = apps.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
  const total = apps.reduce((s, a) => s + (a.size || 0), 0)

  const uninstall = async (app) => {
    setSelected(app); setUninstalling(true); setDone(false); setProgress(20); setError(''); setMessage('')
    try {
      const result = await uninstallApp(app.id)
      setProgress(100); setMessage(result.message); setDone(true)
    } catch (err) {
      setError(err.message)
    }
    setUninstalling(false)
  }

  return (
    <div className="space-y-5 anim-fade-up">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-bg text-orange">
            <Trash2 size={23} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
              <Package size={12} /> App Management
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">App Uninstaller</h1>
            <p className="text-[12px] text-text-tertiary mt-1">Completely remove applications and their leftover files</p>
          </div>
        </div>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Package, val: apps.length, sub: 'Apps detected', colorCls: 'text-orange' },
          { icon: HardDrive, val: `${total.toFixed(1)} GB`, sub: 'Total size', colorCls: 'text-accent' },
          { icon: Search, val: apps.filter(a => a.canUninstall).length, sub: 'Uninstallers available', colorCls: 'text-purple' },
        ].map(s => (
          <div key={s.sub} className="rounded-[14px] bg-surface border border-border p-4">
            <s.icon size={18} className={`mb-2 ${s.colorCls}`} />
            <div className="text-xl font-bold">{s.val}</div>
            <div className="text-xs text-text-tertiary">{s.sub}</div>
          </div>
        ))}
      </div>

      {uninstalling && selected && (
        <div className="rounded-[14px] bg-surface border border-border p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: COLORS[Math.floor(Math.random() * COLORS.length)] }}>
              {selected.name[0]}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">Uninstalling {selected.name}</div>
              <div className="text-xs text-text-tertiary">Please wait...</div>
            </div>
            <Loader size={18} className="animate-spin text-accent" />
          </div>
          <div className="scan-progress"><div className="scan-progress-fill" style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      {done && selected && (
        <div className="rounded-xl bg-green-bg border border-green/20 p-4 flex items-center gap-3">
          <CheckCircle size={18} className="text-green" />
          <div>
            <div className="font-semibold text-sm">{selected.name} removed</div>
            <div className="text-xs text-green">{message || 'Complete the vendor uninstall wizard, then refresh the list.'}</div>
          </div>
        </div>
      )}

      <div className="rounded-[14px] bg-surface border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input type="text" className="w-full bg-input border border-border rounded-[10px] pl-9 pr-3 py-2 text-sm text-text placeholder:text-text-tertiary outline-none focus:border-accent/40 transition-colors" placeholder="Search applications..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-[8px] bg-surface-secondary hover:bg-surface-hover border border-border text-text-secondary text-[12px] font-semibold disabled:opacity-50 transition-colors" onClick={refresh} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        <div className="divide-y divide-border">
          {filtered.map((app, i) => (
            <div key={app.name} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-secondary transition-colors">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }}>
                {app.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{app.name}</div>
                <div className="text-xs text-text-tertiary mt-0.5">{app.pub} &middot; {(app.size || 0).toFixed(1)} GB</div>
                {app.date && (
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-text-tertiary flex items-center gap-1"><Calendar size={10} />{app.date}</span>
                    {app.version && <span className="text-[11px] flex items-center gap-1 text-orange">v{app.version}</span>}
                  </div>
                )}
              </div>
              <button onClick={() => uninstall(app)} disabled={!app.canUninstall || uninstalling} className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-[8px] bg-surface-secondary hover:bg-surface-hover border border-border text-text-secondary text-[12px] font-semibold disabled:opacity-50 transition-colors shrink-0">
                <Trash2 size={13} /> Uninstall
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-sm text-text-tertiary">
              {loading ? 'Scanning registered applications...' : apps.length === 0 ? 'No registered applications found' : 'No apps match your search'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
