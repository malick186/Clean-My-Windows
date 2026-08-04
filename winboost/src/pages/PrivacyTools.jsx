import { useState, useEffect } from 'react'
import { Shield, Eye, EyeOff, Radio, Wifi, Monitor, MapPin, Video } from 'lucide-react'
import { listPrivacy, setPrivacy, applyRecommendedPrivacy } from '../lib/api'

export default function PrivacyTools() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listPrivacy().then(data => { setGroups(data); setLoading(false) })
  }, [])

  const toggle = async (groupIdx, itemIdx) => {
    const g = groups[groupIdx]
    const item = g.items[itemIdx]
    try { await setPrivacy(item.name, !item.enabled) } catch (_) {}
    const newGroups = [...groups]
    newGroups[groupIdx] = { ...g, items: [...g.items] }
    newGroups[groupIdx].items[itemIdx] = { ...item, enabled: !item.enabled }
    setGroups(newGroups)
  }

  const applyRecommended = async () => {
    const results = await applyRecommendedPrivacy()
    const refreshed = await listPrivacy()
    setGroups(refreshed)
  }

  const onCount = groups.reduce((s, g) => s + g.items.filter(i => i.enabled).length, 0)
  const offCount = groups.reduce((s, g) => s + g.items.filter(i => !i.enabled).length, 0)
  const score = onCount + offCount > 0 ? Math.round((offCount / (onCount + offCount)) * 100) : 0

  if (loading) {
    return (
      <div className="anim-fade-up space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--purple-bg)' }}>
              <Shield size={20} color="#af52de" />
            </div>
            <h1 className="text-2xl font-bold tracking-[-0.02em]">Privacy Tools</h1>
          </div>
        </div>
        <div className="card p-10 text-center text-sm text-[var(--text-tertiary)]">Loading privacy settings...</div>
      </div>
    )
  }

  const groupIcons = { 'Telemetry & Data Collection': Radio, 'Location & Sensors': MapPin, 'Camera & Microphone': Video, 'Network & Sync': Wifi, 'Activity & Input': Monitor }

  return (
    <div className="anim-fade-up space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--purple-bg)' }}>
            <Shield size={20} color="#af52de" />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">Privacy Tools</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] ml-12">Control your Windows privacy settings and manage data sharing</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Shield, val: `${score}/100`, sub: score >= 70 ? 'Well protected' : 'Needs attention', color: score >= 70 ? '#34c759' : '#ff9500' },
          { icon: Eye, val: onCount, sub: 'Active sharing points', color: '#ff9500' },
          { icon: Shield, val: offCount, sub: 'Settings secured', color: '#34c759' },
        ].map(s => (
          <div key={s.sub} className="card p-4">
            <s.icon size={18} style={{ color: s.color }} className="mb-2" />
            <div className="text-xl font-bold">{s.val}</div>
            <div className="text-xs text-[var(--text-tertiary)]">{s.sub}</div>
          </div>
        ))}
      </div>

      {groups.map(({ category, items }, gi) => {
        const Icon = groupIcons[category] || Shield
        return (
          <div key={category} className="card overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
              <Icon size={17} color="#af52de" />
              <h3 className="text-sm font-semibold">{category}</h3>
            </div>
            {items.map((item, ii) => (
              <div key={item.name} className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border)]">
                <div className="flex items-center gap-3">
                  {item.enabled ? <Eye size={15} style={{ color: 'var(--orange)' }} /> : <EyeOff size={15} style={{ color: 'var(--green)' }} />}
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">{item.desc}</div>
                  </div>
                </div>
                <div onClick={() => toggle(gi, ii)} className={`toggle ${item.enabled ? 'on' : ''}`} />
              </div>
            ))}
          </div>
        )
      })}

      <div className="flex gap-3">
        <button onClick={applyRecommended} className="btn btn-primary flex-1">Apply Recommended Settings</button>
        <button onClick={() => listPrivacy().then(setGroups)} className="btn btn-secondary">Refresh</button>
      </div>
    </div>
  )
}
