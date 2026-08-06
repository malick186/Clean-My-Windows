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
      <div className="space-y-5 anim-fade-up">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-bg text-teal">
              <HardDrive size={23} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
                <HardDrive size={12} /> Storage Analysis
              </div>
              <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">Disk Analyzer</h1>
              <p className="text-[12px] text-text-tertiary mt-1">Analyze disk usage and find what's consuming your storage</p>
            </div>
          </div>
        </div>
        <div className="rounded-[14px] bg-surface border border-border p-10 text-center text-sm text-text-tertiary space-y-3">
          <Loader size={22} className="animate-spin mx-auto" />
          <div>{stage}</div>
          <div className="scan-progress"><div className="scan-progress-fill" style={{ width: `${progress}%` }} /></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 anim-fade-up">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-bg text-teal">
            <HardDrive size={23} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
              <HardDrive size={12} /> Storage Analysis
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">Disk Analyzer</h1>
            <p className="text-[12px] text-text-tertiary mt-1">Analyze disk usage and find what's consuming your storage</p>
          </div>
        </div>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}
      {meta && (
        <div className="flex items-center gap-4 text-[11px] text-text-tertiary px-4 py-2 rounded-[10px] bg-surface-secondary">
          <span>Analyzed <strong className="text-text font-semibold">{meta.root}</strong></span>
          <span>{meta.scannedItems?.toLocaleString()} items</span>
          <span>{meta.totalSize?.toFixed(2)} GB visible</span>
          {meta.limited && <span className="text-orange font-semibold">Safety limit reached</span>}
        </div>
      )}

      {folders.length > 0 && (
        <div className="rounded-[14px] bg-surface border border-border p-6">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold mb-3.5 pb-2.5 border-b border-border">Folder Usage Breakdown</h3>
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
        <div className="rounded-[14px] bg-surface border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider border-b border-border bg-surface-secondary/50">
            <div className="col-span-5">Folder</div>
            <div className="col-span-3">Size</div>
            <div className="col-span-2">Items</div>
            <div className="col-span-2">Usage</div>
          </div>
          {folders.map((f, i) => (
            <div key={f.name} className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-surface-hover transition-colors border-b border-border">
              <div className="col-span-5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${folderColors[i % folderColors.length]}15` }}>
                  <Folder size={15} style={{ color: folderColors[i % folderColors.length] }} />
                </div>
                <span className="text-sm font-medium truncate">{f.name}</span>
              </div>
              <div className="col-span-3 text-sm text-text-secondary">{f.size.toFixed(1)} GB</div>
              <div className="col-span-2 text-xs text-text-tertiary">{f.items.toLocaleString()}</div>
              <div className="col-span-2">
                <div className="h-1.5 rounded-full bg-surface-secondary overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (f.size / (folders[0]?.size || 1)) * 100)}%`, background: folderColors[i % folderColors.length] }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {types.length > 0 && (
        <div className="rounded-[14px] bg-surface border border-border p-5">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold mb-3.5 pb-2.5 border-b border-border">File Types</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {types.map(({ type, size, count }) => {
              const iconColors = { Documents: '#007aff', Videos: '#af52de', Images: '#34c759', Archives: '#ff9500', Music: '#ffcc00' }
              const color = iconColors[type] || '#8e8e93'
              const Icon = type === 'Videos' ? Film : type === 'Images' ? Image : type === 'Archives' ? Archive : type === 'Music' ? Music : File
              return (
                <div key={type} className="bg-surface-secondary rounded-xl p-3.5">
                  <Icon size={17} style={{ color }} className="mb-2" />
                  <div className="text-sm font-semibold">{type}</div>
                  <div className="text-[11px] text-text-tertiary">{size.toFixed(1)} GB &middot; {count.toLocaleString()} files</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
