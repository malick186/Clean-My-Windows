import { useState, useEffect } from 'react'
import { HardDrive, Folder, Film, Image, File, Archive, Music, AlertTriangle, Loader } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { analyzeDisk } from '../lib/api'

export default function DiskAnalyzer() {
  const [folders, setFolders] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('Preparing scan...')
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    analyzeDisk('home', ({ percent, stage: nextStage }) => {
      setProgress(percent || 0); if (nextStage) setStage(nextStage)
    }).then(data => {
      setFolders(data.folders || [])
      setTypes(data.types || [])
      setMeta(data)
    }).catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [])

  const folderColors = ['#007aff', '#af52de', '#ff9500', '#34c759', '#ffcc00', '#5ac8fa', '#ff3b30', '#5856d6']

  const barData = folders.slice(0, 10).map(f => ({ name: f.name.length > 20 ? f.name.slice(0, 18) + '...' : f.name, size: f.size }))

  if (loading) {
    return (
      <div className="anim-fade-up space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--teal-bg)' }}>
              <HardDrive size={20} color="#5ac8fa" />
            </div>
            <h1 className="text-2xl font-bold tracking-[-0.02em]">Disk Analyzer</h1>
          </div>
        </div>
        <div className="card p-10 text-center text-sm text-[var(--text-tertiary)] space-y-3">
          <Loader size={22} className="animate-spin mx-auto" />
          <div>{stage}</div>
          <div className="progress"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
        </div>
      </div>
    )
  }

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

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}
      {meta && <div className="scan-meta-strip"><span>Analyzed <strong>{meta.root}</strong></span><span>{meta.scannedItems?.toLocaleString()} items</span><span>{meta.totalSize?.toFixed(2)} GB visible</span>{meta.limited && <span className="warning">Safety limit reached</span>}</div>}

      {folders.length > 0 && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-5">Folder Usage Breakdown</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, folders.length * 24)}>
            <BarChart data={barData} layout="vertical" margin={{ left: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6e6e73' }} axisLine={false} tickLine={false} width={100} />
              <Bar dataKey="size" radius={[0, 6, 6, 0]} barSize={18}>
                {barData.map((_, i) => <rect key={i} fill={folderColors[i % folderColors.length]} rx={0} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {folders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
            <div className="col-span-5">Folder</div>
            <div className="col-span-3">Size</div>
            <div className="col-span-2">Items</div>
            <div className="col-span-2">Usage</div>
          </div>
          {folders.map((f, i) => (
            <div key={f.name} className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border)]">
              <div className="col-span-5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${folderColors[i % folderColors.length]}15` }}>
                  <Folder size={15} style={{ color: folderColors[i % folderColors.length] }} />
                </div>
                <span className="text-sm font-medium truncate">{f.name}</span>
              </div>
              <div className="col-span-3 text-sm text-[var(--text-secondary)]">{f.size.toFixed(1)} GB</div>
              <div className="col-span-2 text-xs text-[var(--text-tertiary)]">{f.items.toLocaleString()}</div>
              <div className="col-span-2">
                <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (f.size / (folders[0]?.size || 1)) * 100)}%`, background: folderColors[i % folderColors.length] }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {types.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">File Types</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {types.map(({ type, size, count }) => {
              const iconColors = { Documents: '#007aff', Videos: '#af52de', Images: '#34c759', Archives: '#ff9500', Music: '#ffcc00' }
              const color = iconColors[type] || '#8e8e93'
              const Icon = type === 'Videos' ? Film : type === 'Images' ? Image : type === 'Archives' ? Archive : type === 'Music' ? Music : File
              return (
                <div key={type} className="bg-[var(--bg-secondary)] rounded-xl p-3.5">
                  <Icon size={17} style={{ color }} className="mb-2" />
                  <div className="text-sm font-semibold">{type}</div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">{size.toFixed(1)} GB &middot; {count.toLocaleString()} files</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
