import { useState, useEffect } from 'react'
import { Power, Zap, Timer, Info, AlertTriangle, Loader, LockKeyhole } from 'lucide-react'
import { listStartup, toggleStartup } from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'

const impactVariant = {
  High: 'danger',
  Medium: 'warning',
  Low: 'success'
}

export default function StartupManager() {
  const [progs, setProgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listStartup().then(data => setProgs(data)).catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [])

  const toggle = async (i) => {
    const p = progs[i]
    setBusy(p.id); setError('')
    try {
      await toggleStartup(p.id, !p.enabled)
      const n = [...progs]; n[i] = { ...n[i], enabled: !n[i].enabled }; setProgs(n)
    } catch (err) { setError(err.message) }
    finally { setBusy(null) }
  }

  const on = progs.filter(p => p.enabled)
  const score = on.reduce((a, p) => a + (p.impact === 'High' ? 3 : p.impact === 'Medium' ? 2 : 1), 0)
  const boot = (8 + score * 1.2).toFixed(1)

  if (loading) {
    return (
      <div className="space-y-6 anim-fade-up">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-5">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-green-bg text-green shadow-sm">
              <Power size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-[0.15em] mb-2">
                <Timer size={11} /> Boot Optimization
              </div>
              <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">Startup Manager</h1>
            </div>
          </div>
        </div>
        <div className="loading-state">Scanning startup entries...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-green-bg text-green shadow-sm">
            <Power size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-[0.15em] mb-2">
              <Timer size={11} /> Startup Manager
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">Startup Manager</h1>
            <p className="text-[13px] text-text-tertiary mt-1.5 leading-relaxed">Control which programs launch at startup to reduce boot time</p>
          </div>
        </div>
        <Button variant="ghost" size="sm"><Info size={14} /></Button>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: Timer, val: `${boot}s`, sub: 'Est. boot time', color: '#5ac8fa' },
          { icon: Zap, val: on.length, sub: `of ${progs.length} enabled`, color: '#ff9500' },
          { icon: Power, val: score <= 5 ? 'Low' : score <= 10 ? 'Medium' : 'High', sub: 'Overall impact', color: score <= 5 ? '#34c759' : score <= 10 ? '#ff9500' : '#ff3b30' },
        ].map(s => (
          <Card key={s.sub} className="p-4">
            <s.icon size={18} style={{ color: s.color }} className="mb-2" />
            <div className="text-xl font-bold text-text">{s.val}</div>
            <div className="text-xs text-text-tertiary">{s.sub}</div>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <CardHeader className="mb-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Power size={18} className="text-green" /> Startup Programs
          </CardTitle>
          <Badge variant="teal" className="ml-auto">{progs.length} entries</Badge>
        </CardHeader>
        <div className="grid grid-cols-12 gap-4 px-6 py-2.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider bg-surface-secondary/50">
          <div className="col-span-5">Program</div>
          <div className="col-span-3">Publisher</div>
          <div className="col-span-2">Impact</div>
          <div className="col-span-2">Status</div>
        </div>
        <Separator />
        {progs.length === 0 ? (
          <div className="text-center py-10 text-sm text-text-tertiary">No startup entries found</div>
        ) : (
          progs.map((p, i) => (
            <div key={p.name}>
              <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-surface-secondary/50 transition-all duration-200">
                <div className={`col-span-5 text-sm font-medium ${p.enabled ? 'text-text' : 'text-text-tertiary'}`}>
                  <div className="truncate max-w-[200px] flex items-center gap-1.5">{p.name}{p.requiresAdmin && <LockKeyhole size={11} title="Machine-wide entry" />}</div>
                  {p.path && <div className="text-[11px] text-text-tertiary truncate max-w-[200px] mt-0.5">{p.path}</div>}
                </div>
                <div className="col-span-3 text-xs text-text-tertiary">{p.pub}</div>
                <div className="col-span-2">
                  <Badge variant={impactVariant[p.impact] || 'teal'}>{p.impact}</Badge>
                </div>
                <div className="col-span-2 flex items-center">
                  {busy === p.id ? (
                    <Loader size={15} className="animate-spin text-accent" />
                  ) : (
                    <Switch checked={p.enabled} onCheckedChange={() => toggle(i)} />
                  )}
                </div>
              </div>
              {i < progs.length - 1 && <Separator />}
            </div>
          ))
        )}
      </Card>

      <div className="flex items-start gap-3 p-5 rounded-2xl bg-green-bg border border-green/15">
        <Info size={17} className="text-green shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="font-semibold text-sm text-text">Pro Tip</div>
          <div className="text-xs text-text-secondary mt-0.5 leading-relaxed">Disabling unnecessary startup programs can reduce boot time by 30-60%. Low impact items are usually safe to disable.</div>
        </div>
      </div>
    </div>
  )
}
