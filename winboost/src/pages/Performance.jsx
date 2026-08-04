import { Gauge, Cpu, Monitor, MousePointer, HardDrive, Sparkles, CheckCircle } from 'lucide-react'

const tweaks = [
  { name: 'Disable Visual Effects', desc: 'Turn off animations, transparency', impact: 'High', cat: 'Visual' },
  { name: 'Game Mode', desc: 'Optimize resources for gaming', impact: 'High', cat: 'Gaming' },
  { name: 'Disable Background Apps', desc: 'Prevent background execution', impact: 'High', cat: 'System' },
  { name: 'Ultimate Performance Plan', desc: 'Unlock hidden power plan', impact: 'High', cat: 'Power' },
  { name: 'Disable Cortana', desc: 'Turn off Cortana assistant', impact: 'Medium', cat: 'System' },
  { name: 'Disable Windows Tips', desc: 'Turn off tips & suggestions', impact: 'Low', cat: 'System' },
  { name: 'Best Performance Scheduling', desc: 'Optimize processor scheduling', impact: 'High', cat: 'System' },
  { name: 'Disable Transparency Effects', desc: 'Turn off acrylic & blur', impact: 'Medium', cat: 'Visual' },
  { name: 'Disable Notifications', desc: 'Reduce notification popups', impact: 'Low', cat: 'System' },
  { name: 'Disable Xbox Game Bar', desc: 'Turn off game recording overlay', impact: 'Medium', cat: 'Gaming' },
  { name: 'Disable Search Indexing', desc: 'Reduce disk I/O from indexing', impact: 'Medium', cat: 'Disk' },
  { name: 'Disable Superfetch', desc: 'Reduce RAM usage on SSDs', impact: 'Medium', cat: 'Memory' },
]

const benchmarks = [
  { label: 'Boot Time', before: '24.5s', after: '12.8s', imp: '48%' },
  { label: 'App Launch', before: '3.2s', after: '1.8s', imp: '44%' },
  { label: 'Memory Idle', before: '4.2 GB', after: '2.8 GB', imp: '33%' },
  { label: 'CPU Idle', before: '8%', after: '3%', imp: '62%' },
  { label: 'Disk Response', before: '12ms', after: '5ms', imp: '58%' },
]

const impCls = { High: 'badge-red', Medium: 'badge-orange', Low: 'badge-green' }

export default function Performance() {
  return (
    <div className="anim-fade-up space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--green-bg)' }}>
            <Gauge size={20} color="#34c759" />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">Performance Optimizer</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] ml-12">Fine-tune Windows for maximum speed and responsiveness</p>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {[
          { icon: Sparkles, val: 68, sub: 'Score', color: '#ffcc00' },
          { icon: Cpu, val: 5, sub: 'Active Tweaks', color: '#007aff' },
          { icon: Monitor, val: '144', sub: 'FPS Boost', color: '#af52de' },
          { icon: MousePointer, val: '12ms', sub: 'Latency', color: '#34c759' },
          { icon: HardDrive, val: 'NVMe', sub: 'Disk Type', color: '#5ac8fa' },
        ].map(s => (
          <div key={s.sub} className="card p-3 text-center">
            <s.icon size={17} style={{ color: s.color }} className="mx-auto mb-1" />
            <div className="text-lg font-bold">{s.val}</div>
            <div className="text-[10px] text-[var(--text-tertiary)]">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} style={{ color: '#ffcc00' }} />
          <h3 className="text-sm font-semibold">Before & After</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border)]">
              <th className="text-left py-2 font-semibold">Metric</th>
              <th className="text-left py-2 font-semibold">Before</th>
              <th className="text-left py-2 font-semibold">After</th>
              <th className="text-right py-2 font-semibold">Improvement</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map(b => (
              <tr key={b.label} className="border-b border-[var(--border)]/50">
                <td className="py-2.5 font-medium">{b.label}</td>
                <td className="py-2.5 text-[var(--text-secondary)]">{b.before}</td>
                <td className="py-2.5" style={{ color: 'var(--green)' }}>{b.after}</td>
                <td className="py-2.5 text-right"><span className="badge badge-green">{b.imp}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
          <h3 className="text-sm font-semibold">Performance Tweaks</h3>
          <button className="btn btn-primary btn-sm">Apply All</button>
        </div>
        {tweaks.map(t => (
          <div key={t.name} className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className={t.name.startsWith('Game Mode') || t.name.startsWith('Ultimate') || t.name.startsWith('Disable Cortana') || t.name.startsWith('Disable Windows Tips') || t.name.startsWith('Disable Xbox') ? '' : 'w-[18px] h-[18px] rounded-full border-2 border-[#d2d2d7]'} />
              {(t.name.startsWith('Game Mode') || t.name.startsWith('Ultimate') || t.name.startsWith('Disable Cortana') || t.name.startsWith('Disable Windows Tips') || t.name.startsWith('Disable Xbox')) && <CheckCircle size={18} color="var(--green)" />}
              <div>
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{t.desc}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${impCls[t.impact]}`}>{t.impact}</span>
              <span className="text-[11px] text-[var(--text-tertiary)]">{t.cat}</span>
              <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                (t.name.startsWith('Game Mode') || t.name.startsWith('Ultimate') || t.name.startsWith('Disable Cortana') || t.name.startsWith('Disable Windows Tips') || t.name.startsWith('Disable Xbox'))
                  ? 'bg-[var(--green-bg)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
              }`} style={(t.name.startsWith('Game Mode') || t.name.startsWith('Ultimate') || t.name.startsWith('Disable Cortana') || t.name.startsWith('Disable Windows Tips') || t.name.startsWith('Disable Xbox')) ? { color: 'var(--green)' } : {}}>
                {(t.name.startsWith('Game Mode') || t.name.startsWith('Ultimate') || t.name.startsWith('Disable Cortana') || t.name.startsWith('Disable Windows Tips') || t.name.startsWith('Disable Xbox')) ? 'Applied' : 'Apply'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
