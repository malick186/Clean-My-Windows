import { HardDrive, Folder, Film, Image, File, Archive } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'

const folders = [
  { name: 'Program Files', size: '86.2 GB', items: '45,230', color: '#007aff' },
  { name: 'Users', size: '72.8 GB', items: '128,400', color: '#af52de' },
  { name: 'Windows', size: '35.4 GB', items: '210,500', color: '#ff9500' },
  { name: 'Games', size: '22.1 GB', items: '2,340', color: '#34c759' },
  { name: 'ProgramData', size: '8.5 GB', items: '18,200', color: '#ffcc00' },
]

const types = [
  { type: 'Documents', icon: File, size: '45.2 GB', count: '32,400', color: '#007aff' },
  { type: 'Videos', icon: Film, size: '38.7 GB', count: '1,250', color: '#af52de' },
  { type: 'Images', icon: Image, size: '28.1 GB', count: '15,800', color: '#34c759' },
  { type: 'Archives', icon: Archive, size: '12.4 GB', count: '3,200', color: '#ff9500' },
  { type: 'Music', icon: File, size: '12.4 GB', count: '4,100', color: '#ffcc00' },
  { type: 'Other', icon: File, size: '22.1 GB', count: '45,600', color: '#8e8e93' },
]

const barData = folders.map(f => ({ name: f.name === 'Program Files' ? 'Prog.Files' : f.name, size: parseFloat(f.size) }))

export default function DiskAnalyzer() {
  return (
    <div className="anim-fade-up space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--teal-bg)' }}>
            <HardDrive size={20} color="#5ac8fa" />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">Disk Analyzer</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] ml-12">Analyze disk usage and find what's consuming your storage</p>
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-5">Folder Usage Breakdown</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={barData} layout="vertical" margin={{ left: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6e6e73' }} axisLine={false} tickLine={false} width={70} />
            <Bar dataKey="size" radius={[0, 6, 6, 0]} barSize={20}>
              {barData.map((_, i) => <rect key={i} fill={folders[i].color} rx={0} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
          <div className="col-span-5">Folder</div>
          <div className="col-span-3">Size</div>
          <div className="col-span-2">Items</div>
          <div className="col-span-2">Usage</div>
        </div>
        {folders.map(f => (
          <div key={f.name} className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border)]">
            <div className="col-span-5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${f.color}15` }}>
                <Folder size={15} style={{ color: f.color }} />
              </div>
              <span className="text-sm font-medium">{f.name}</span>
            </div>
            <div className="col-span-3 text-sm text-[var(--text-secondary)]">{f.size}</div>
            <div className="col-span-2 text-xs text-[var(--text-tertiary)]">{f.items}</div>
            <div className="col-span-2">
              <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(parseFloat(f.size) / 86) * 100}%`, background: f.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">File Types</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {types.map(({ type, icon: Icon, size, count, color }) => (
            <div key={type} className="bg-[var(--bg-secondary)] rounded-xl p-3.5">
              <Icon size={17} style={{ color }} className="mb-2" />
              <div className="text-sm font-semibold">{type}</div>
              <div className="text-[11px] text-[var(--text-tertiary)]">{size} &middot; {count} files</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
