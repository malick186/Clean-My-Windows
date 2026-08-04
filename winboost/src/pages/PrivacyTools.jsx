import { Shield, Eye, EyeOff, Radio, Wifi, Monitor, MapPin, Video } from 'lucide-react'

const groups = [
  {
    category: 'Telemetry & Data Collection',
    icon: Radio,
    items: [
      { name: 'Diagnostic Data', desc: 'Send usage data to Microsoft', on: true },
      { name: 'Tailored Experiences', desc: 'Personalized tips and ads', on: true },
      { name: 'Advertising ID', desc: 'Let apps use advertising ID', on: true },
    ]
  },
  {
    category: 'Location & Sensors',
    icon: MapPin,
    items: [
      { name: 'Location Services', desc: 'Allow apps to access location', on: false },
      { name: 'Find My Device', desc: 'Track device location', on: true },
    ]
  },
  {
    category: 'Camera & Microphone',
    icon: Video,
    items: [
      { name: 'Camera Access', desc: 'Allow apps to use camera', on: true },
      { name: 'Microphone Access', desc: 'Allow apps to use microphone', on: true },
    ]
  },
  {
    category: 'Network & Sync',
    icon: Wifi,
    items: [
      { name: 'Wi-Fi Sense', desc: 'Share networks with contacts', on: false },
      { name: 'Cross-device Sync', desc: 'Sync across devices', on: true },
    ]
  },
  {
    category: 'Activity & Input',
    icon: Monitor,
    items: [
      { name: 'Activity History', desc: 'Store activity on device', on: false },
      { name: 'Clipboard Sync', desc: 'Sync clipboard across devices', on: true },
      { name: 'Inking & Typing', desc: 'Send typing data to cloud', on: true },
    ]
  },
]

export default function PrivacyTools() {
  const onCount = groups.reduce((s, g) => s + g.items.filter(i => i.on).length, 0)
  const offCount = groups.reduce((s, g) => s + g.items.filter(i => !i.on).length, 0)
  const score = Math.round((offCount / (onCount + offCount)) * 100)

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

      {groups.map(({ category, icon: Icon, items }) => (
        <div key={category} className="card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
            <Icon size={17} color="#af52de" />
            <h3 className="text-sm font-semibold">{category}</h3>
          </div>
          {items.map(item => (
            <div key={item.name} className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                {item.on ? <Eye size={15} style={{ color: 'var(--orange)' }} /> : <EyeOff size={15} style={{ color: 'var(--green)' }} />}
                <div>
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{item.desc}</div>
                </div>
              </div>
              <span className={`badge ${item.on ? 'badge-orange' : 'badge-green'}`}>
                {item.on ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>
      ))}

      <div className="flex gap-3">
        <button className="btn btn-primary flex-1">Apply Recommended Settings</button>
        <button className="btn btn-secondary">Reset Defaults</button>
      </div>
    </div>
  )
}
