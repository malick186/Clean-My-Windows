import { useState, useEffect } from 'react'
import { Trash2, Package, Search, Loader, CheckCircle, Calendar, HardDrive, RefreshCw, AlertTriangle } from 'lucide-react'
import { listApps, uninstallApp } from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

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
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-orange-bg text-orange shadow-sm">
            <Trash2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-[0.15em] mb-2">
              <Package size={11} /> App Uninstaller
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">App Uninstaller</h1>
            <p className="text-[13px] text-text-tertiary mt-1.5 leading-relaxed">Completely remove applications and their leftover files</p>
          </div>
        </div>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: Package, val: apps.length, sub: 'Apps detected', variant: 'warning' },
          { icon: HardDrive, val: `${total.toFixed(1)} GB`, sub: 'Total size', variant: 'default' },
          { icon: Search, val: apps.filter(a => a.canUninstall).length, sub: 'Uninstallers available', variant: 'purple' },
        ].map((s, idx) => (
          <Card key={s.sub} className="p-4">
            <s.icon size={18} className="mb-2" style={{ color: ['#fdba74', '#8b9cf7', '#c4b5fd'][idx] }} />
            <div className="text-xl font-bold text-text">{s.val}</div>
            <div className="text-xs text-text-tertiary">{s.sub}</div>
          </Card>
        ))}
      </div>

      {uninstalling && selected && (
        <Card>
          <CardContent className="py-5 space-y-3">
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
            <Progress value={progress} />
          </CardContent>
        </Card>
      )}

      {done && selected && (
        <div className="flex items-start gap-3 p-5 rounded-2xl bg-green-bg border border-green/15">
          <CheckCircle size={18} className="text-green shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-semibold text-sm text-text">{selected.name} removed</div>
            <div className="text-xs text-green mt-0.5">{message || 'Complete the vendor uninstall wizard, then refresh the list.'}</div>
          </div>
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <CardHeader className="mb-0 pb-0 flex-row flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package size={18} className="text-orange" /> Installed Apps
          </CardTitle>
          <div className="flex items-center gap-2 ml-auto flex-1 justify-end">
            <div className="relative flex-1 max-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input type="text" className="w-full bg-input border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-text placeholder:text-text-tertiary outline-none focus:border-accent/40 transition-colors" placeholder="Search applications..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>
            <Badge variant="teal" className="shrink-0">{filtered.length} apps</Badge>
          </div>
        </CardHeader>
        <Separator />
        <div className="divide-y divide-border">
          {filtered.map((app, i) => (
            <div key={app.name} className="flex items-center gap-4 p-4 rounded-2xl mx-2 my-1 bg-surface-secondary/50 hover:bg-surface-hover transition-all duration-200 border border-white/[0.03]">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }}>
                {app.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text">{app.name}</div>
                <div className="text-xs text-text-tertiary mt-0.5">{app.pub} &middot; {(app.size || 0).toFixed(1)} GB</div>
                {app.date && (
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-text-tertiary flex items-center gap-1"><Calendar size={10} />{app.date}</span>
                    {app.version && <Badge variant="danger" className="text-[10px] py-0">v{app.version}</Badge>}
                  </div>
                )}
              </div>
              <Button variant="danger" size="sm" onClick={() => uninstall(app)} disabled={!app.canUninstall || uninstalling} className="shrink-0">
                <Trash2 size={13} /> Uninstall
              </Button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-text-tertiary">
              {loading ? 'Scanning registered applications...' : apps.length === 0 ? 'No registered applications found' : 'No apps match your search'}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
