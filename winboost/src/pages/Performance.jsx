import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Cpu, Gauge, HardDrive, Loader, Monitor, RefreshCw, SlidersHorizontal, Sparkles, Zap } from 'lucide-react'
import { applyAllTweaks, listTweaks, setTweak } from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

const impactClass = { High: 'bg-red-bg text-red', Medium: 'bg-orange-bg text-orange', Low: 'bg-green-bg text-green' }

const impactBadge = { High: 'danger', Medium: 'warning', Low: 'success' }

export default function Performance() {
  const [tweaks, setTweaks] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)

  const refresh = async () => {
    setLoading(true)
    try { setTweaks(await listTweaks()) }
    catch (error) { setNotice({ type: 'error', text: error.message }) }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  const toggle = async (tweak) => {
    setBusy(tweak.name); setNotice(null)
    try {
      await setTweak(tweak.name, !tweak.applied)
      setTweaks(items => items.map(item => item.name === tweak.name ? { ...item, applied: !item.applied } : item))
    } catch (error) { setNotice({ type: 'error', text: error.message }) }
    finally { setBusy(null) }
  }

  const optimize = async () => {
    setBusy('all'); setNotice(null)
    try {
      const result = await applyAllTweaks()
      setTweaks(await listTweaks())
      setNotice({ type: result.errors?.length ? 'warning' : 'success', text: `${result.applied || 0} settings optimized${result.errors?.length ? `; ${result.errors.length} could not be changed` : ''}.` })
    } catch (error) { setNotice({ type: 'error', text: error.message }) }
    finally { setBusy(null) }
  }

  const applied = tweaks.filter(item => item.applied).length
  const score = tweaks.length ? Math.round((applied / tweaks.length) * 100) : 0
  const categories = new Set(tweaks.map(item => item.cat)).size

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-bg text-teal shadow-sm">
            <Gauge size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-[0.15em] mb-2">
              <Zap size={11} /> Reversible Windows tuning
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">Performance Studio</h1>
            <p className="text-[13px] text-text-tertiary mt-1.5 leading-relaxed">Apply measured, user-level optimizations. Every switch reads and changes the actual Windows setting.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} disabled={loading || Boolean(busy)}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {notice && <div className={`notice-banner ${notice.type}`}>{notice.type === 'success' ? <CheckCircle size={17} /> : <AlertTriangle size={17} />}{notice.text}</div>}

      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: Sparkles, val: `${score}%`, sub: 'Optimization profile', color: '#ffcc00' },
          { icon: Cpu, val: applied, sub: 'Active settings', color: '#45e8ff' },
          { icon: SlidersHorizontal, val: tweaks.length, sub: 'Reversible controls', color: '#bd6cff' },
          { icon: HardDrive, val: categories, sub: 'Windows areas', color: '#4ce6a5' },
        ].map(item => (
          <Card key={item.sub} className="p-5">
            <CardContent className="flex flex-col items-center gap-1">
              <item.icon size={18} style={{ color: item.color }} />
              <strong className="text-lg font-bold">{item.val}</strong>
              <span className="text-[11px] text-text-tertiary">{item.sub}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-bg text-teal">
            <Monitor size={22} />
          </div>
          <div className="flex-1">
            <small className="text-[11px] text-text-tertiary uppercase tracking-wider">Balanced preset</small>
            <strong className="block text-[14px] font-semibold">Responsiveness without disabling core Windows services</strong>
            <p className="text-[11px] text-text-tertiary mt-0.5">Search indexing, SysMain and Prefetch are intentionally left intact.</p>
          </div>
          <Button onClick={optimize} disabled={loading || Boolean(busy)}>
            {busy === 'all' ? <Loader size={15} className="animate-spin" /> : <Sparkles size={15} />}Optimize Safely
          </Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Optimization controls</CardTitle>
            <p className="text-[12px] text-text-tertiary mt-1">Switches can be restored at any time.</p>
          </div>
          <span className="text-[13px] text-text-secondary ml-auto">{applied}/{tweaks.length} active</span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="loading-state"><Loader className="animate-spin" size={20} />Reading Windows settings...</div>
          ) : tweaks.map(tweak => (
            <div key={tweak.name} className={`flex items-center gap-4 p-4 rounded-2xl bg-surface-secondary/50 hover:bg-surface-hover transition-all duration-200 border border-white/[0.03] ${tweak.applied ? 'bg-green-bg/10' : ''}`}>
              <span className="w-5 flex-shrink-0 flex items-center justify-center">
                {tweak.applied ? <CheckCircle size={18} className="text-green" /> : <span className="w-4 h-4 block rounded-full border-2 border-border" />}
              </span>
              <div className="flex-1 min-w-0">
                <strong className="text-[13px] font-semibold block">{tweak.name}</strong>
                <small className="text-[11px] text-text-tertiary block truncate">{tweak.desc}</small>
              </div>
              <Badge variant={impactBadge[tweak.impact] || 'success'} className="text-[10px] uppercase">{tweak.impact}</Badge>
              <Badge variant="outline" className="text-[11px] font-mono">{tweak.cat}</Badge>
              {busy === tweak.name ? <Loader size={16} className="animate-spin flex-shrink-0" /> : <Switch checked={tweak.applied} onCheckedChange={() => toggle(tweak)} />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
