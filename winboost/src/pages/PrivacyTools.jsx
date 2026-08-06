import { useState, useEffect } from 'react'
import { Shield, Eye, EyeOff, Radio, Wifi, Monitor, MapPin, Video, AlertTriangle, Loader, LockKeyhole, CheckCircle } from 'lucide-react'
import { listPrivacy, setPrivacy, applyRecommendedPrivacy } from '../lib/api'

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
      <div className="space-y-5 anim-fade-up">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-bg text-purple">
            <Shield size={23} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
              <Shield size={12} /> Privacy controls
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">Privacy Tools</h1>
          </div>
        </div>
        <div className="rounded-[14px] bg-surface border border-border p-10 text-center text-[13px] text-text-tertiary">Loading privacy settings...</div>
      </div>
    )
  }

  const groupIcons = { 'Telemetry & Data Collection': Radio, 'Location & Sensors': MapPin, 'Camera & Microphone': Video, 'Network & Sync': Wifi, 'Activity & Input': Monitor, Recommendations: Shield }

  return (
    <div className="space-y-5 anim-fade-up">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-bg text-purple">
          <Shield size={23} />
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
            <Shield size={12} /> Privacy controls
          </div>
          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">Privacy Tools</h1>
          <p className="text-[12px] text-text-tertiary mt-1">Control your Windows privacy settings and manage data sharing</p>
        </div>
      </div>

      {notice && <div className={`notice-banner ${notice.type}`}>{notice.type === 'success' ? <CheckCircle size={17} /> : <AlertTriangle size={17} />}{notice.text}</div>}

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Shield, val: `${score}/100`, sub: score >= 70 ? 'Well protected' : 'Needs attention', color: score >= 70 ? '#34c759' : '#ff9500' },
          { icon: Eye, val: onCount, sub: 'Active sharing points', color: '#ff9500' },
          { icon: Shield, val: offCount, sub: 'Settings secured', color: '#34c759' },
        ].map(s => (
          <div key={s.sub} className="rounded-[14px] bg-surface border border-border p-4">
            <s.icon size={18} style={{ color: s.color }} className="mb-2" />
            <div className="text-xl font-bold">{s.val}</div>
            <div className="text-xs text-text-tertiary">{s.sub}</div>
          </div>
        ))}
      </div>

      {groups.map(({ category, items }, gi) => {
        const Icon = groupIcons[category] || Shield
        return (
          <div key={category} className="rounded-[14px] bg-surface border border-border overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-surface-secondary">
              <Icon size={17} className="text-purple" />
              <h3 className="text-[14px] font-semibold">{category}</h3>
            </div>
            {items.map((item, ii) => (
              <div key={item.name} className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-hover transition-colors border-b border-border last:border-b-0">
                <div className="flex items-center gap-3">
                  {item.enabled ? <Eye size={15} className="text-orange" /> : <EyeOff size={15} className="text-green" />}
                  <div>
                    <div className="text-[13px] font-medium flex items-center gap-1.5">{item.name}{item.requiresAdmin && <LockKeyhole size={11} className="text-purple" title="Requires administrator approval" />}</div>
                    <div className="text-[11px] text-text-tertiary">{item.desc}</div>
                  </div>
                </div>
                {busy === item.name ? <Loader size={15} className="animate-spin" /> : <button onClick={() => toggle(gi, ii)} className="toggle-switch" data-on={item.enabled} aria-label={`Toggle ${item.name}`} />}
              </div>
            ))}
          </div>
        )
      })}

      <div className="flex gap-3">
        <button onClick={applyRecommended} disabled={Boolean(busy)} className="flex items-center gap-2 py-2 px-5 rounded-[10px] bg-accent text-black font-semibold text-[13px] hover:opacity-90 disabled:opacity-50 flex-1 justify-center">
          {busy === 'recommended' && <Loader size={14} className="animate-spin" />}Apply Recommended Settings
        </button>
        <button onClick={() => listPrivacy().then(setGroups)} className="flex items-center gap-2 py-2 px-5 rounded-[10px] bg-surface-secondary hover:bg-surface-hover border border-border text-text-secondary text-[13px] font-semibold disabled:opacity-50">Refresh</button>
      </div>
    </div>
  )
}
