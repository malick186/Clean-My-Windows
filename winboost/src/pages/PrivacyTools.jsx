import { useState, useEffect } from 'react'
import { Shield, Eye, EyeOff, Radio, Wifi, Monitor, MapPin, Video, AlertTriangle, Loader, LockKeyhole, CheckCircle } from 'lucide-react'
import { listPrivacy, setPrivacy, applyRecommendedPrivacy } from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

export default function PrivacyTools() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    listPrivacy().then(setGroups).catch(err => setNotice({ type: 'error', text: err.message })).finally(() => setLoading(false))
  }, [])

  const toggle = async (groupIdx, itemIdx) => {
    const g = groups[groupIdx]
    const item = g.items[itemIdx]
    setBusy(item.name); setNotice(null)
    try {
      await setPrivacy(item.name, !item.enabled)
      const newGroups = [...groups]
      newGroups[groupIdx] = { ...g, items: [...g.items] }
      newGroups[groupIdx].items[itemIdx] = { ...item, enabled: !item.enabled }
      setGroups(newGroups)
    } catch (err) { setNotice({ type: 'error', text: err.message }) }
    finally { setBusy(null) }
  }

  const applyRecommended = async () => {
    setBusy('recommended'); setNotice(null)
    try {
      const results = await applyRecommendedPrivacy()
      setGroups(await listPrivacy())
      setNotice({ type: results.errors?.length ? 'warning' : 'success', text: `${results.applied || 0} privacy controls updated${results.errors?.length ? `; ${results.errors.length} need attention` : ''}.` })
    } catch (err) { setNotice({ type: 'error', text: err.message }) }
    finally { setBusy(null) }
  }

  const onCount = groups.reduce((s, g) => s + g.items.filter(i => i.enabled).length, 0)
  const offCount = groups.reduce((s, g) => s + g.items.filter(i => !i.enabled).length, 0)
  const score = onCount + offCount > 0 ? Math.round((offCount / (onCount + offCount)) * 100) : 0

  if (loading) {
    return (
      <div className="space-y-6 anim-fade-up">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-5">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-purple/10 text-sparkle-purple">
              <Shield size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.15em] mb-2">
                <Shield size={11} /> Privacy controls
              </div>
              <h1 className="text-[28px] font-bold leading-[1.1] tracking-tight">Privacy Tools</h1>
              <p className="text-[13px] text-sparkle-muted mt-1.5 leading-relaxed">Control your Windows privacy settings and manage data sharing</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-sparkle-card border border-sparkle-border p-10 text-center text-[13px] text-sparkle-muted">Loading privacy settings...</div>
      </div>
    )
  }

  const groupIcons = { 'Telemetry & Data Collection': Radio, 'Location & Sensors': MapPin, 'Camera & Microphone': Video, 'Network & Sync': Wifi, 'Activity & Input': Monitor, Recommendations: Shield }

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-purple/10 text-sparkle-purple">
            <Shield size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.15em] mb-2">
              <Shield size={11} /> Privacy controls
            </div>
            <h1 className="text-[28px] font-bold leading-[1.1] tracking-tight">Privacy Tools</h1>
            <p className="text-[13px] text-sparkle-muted mt-1.5 leading-relaxed">Control your Windows privacy settings and manage data sharing</p>
          </div>
        </div>
      </div>

      {notice && <div className={`notice-banner ${notice.type}`}>{notice.type === 'success' ? <CheckCircle size={17} /> : <AlertTriangle size={17} />}{notice.text}</div>}

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Shield, val: `${score}/100`, sub: score >= 70 ? 'Well protected' : 'Needs attention', color: score >= 70 ? '#34c759' : '#ff9500' },
          { icon: Eye, val: onCount, sub: 'Active sharing points', color: '#ff9500' },
          { icon: Shield, val: offCount, sub: 'Settings secured', color: '#34c759' },
        ].map(s => (
          <Card key={s.sub} className="p-4">
            <CardContent>
              <s.icon size={18} style={{ color: s.color }} className="mb-2" />
              <div className="text-xl font-bold">{s.val}</div>
              <div className="text-xs text-sparkle-muted">{s.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {groups.map(({ category, items }, gi) => {
        const Icon = groupIcons[category] || Shield
        return (
          <Card key={category} className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon size={18} className="text-sparkle-purple" />
                {category}
              </CardTitle>
            </CardHeader>
            {items.map((item, ii) => (
              <div key={item.name} className="flex items-center justify-between px-6 py-3.5 hover:bg-sparkle-accent transition-all duration-200 border-b border-sparkle-border last:border-b-0">
                <div className="flex items-center gap-3">
                  {item.enabled ? <Eye size={15} className="text-sparkle-warning" /> : <EyeOff size={15} className="text-sparkle-success" />}
                  <div>
                    <div className="text-[13px] font-medium flex items-center gap-1.5">{item.name}{item.requiresAdmin && <LockKeyhole size={11} className="text-sparkle-purple" title="Requires administrator approval" />}</div>
                    <div className="text-[11px] text-sparkle-muted">{item.desc}</div>
                  </div>
                </div>
                {busy === item.name ? <Loader size={15} className="animate-spin" /> : <Switch checked={item.enabled} onCheckedChange={() => toggle(gi, ii)} />}
              </div>
            ))}
          </Card>
        )
      })}

      <div className="flex gap-3">
        <Button onClick={applyRecommended} disabled={Boolean(busy)} className="flex-1">
          {busy === 'recommended' && <Loader size={14} className="animate-spin" />}Apply Recommended Settings
        </Button>
        <Button variant="secondary" onClick={() => listPrivacy().then(setGroups)}>Refresh</Button>
      </div>
    </div>
  )
}
