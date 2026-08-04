import { useState, useEffect } from 'react'
import { Search, HardDrive, Calendar, FileVideo, FileImage, FileArchive, File } from 'lucide-react'
import { scanLargeFiles } from '../lib/api'

const icons = { video: FileVideo, image: FileImage, archive: FileArchive, disk: HardDrive, cache: File, system: File, cloud: File, audio: FileVideo }

export default function LargeFiles() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [minSize, setMinSize] = useState(100)

  const fetchFiles = async (size) => {
    setLoading(true)
    const results = await scanLargeFiles(size)
    setFiles(results)
    setLoading(false)
  }

  useEffect(() => { fetchFiles(minSize) }, [])

  const total = files.reduce((s, f) => s + f.size, 0)

  return (
    <div className="anim-fade-up space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--teal-bg)' }}>
            <Search size={20} color="#5ac8fa" />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">Large Files Finder</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] ml-12">Discover large files consuming valuable disk space</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: HardDrive, val: files.length, sub: 'Large files found', color: '#5ac8fa' },
          { icon: Search, val: `${total.toFixed(1)} GB`, sub: 'Total space', color: '#af52de' },
          { icon: FileArchive, val: `>${minSize} MB`, sub: 'Minimum file size', color: '#ff9500' },
        ].map(s => (
          <div key={s.sub} className="card p-4">
            <s.icon size={18} style={{ color: s.color }} className="mb-2" />
            <div className="text-xl font-bold">{s.val}</div>
            <div className="text-xs text-[var(--text-tertiary)]">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <span className="text-xs text-[var(--text-tertiary)]">Min size (MB):</span>
        {[1, 10, 100, 500, 1000].map(s => (
          <button key={s} onClick={() => { setMinSize(s); fetchFiles(s) }}
            className={`text-xs px-2 py-1 rounded-lg border transition-colors ${minSize === s ? 'border-[#0071e3]/30 bg-[#0071e3]/[0.04] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--border-hover)]'}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
          <div className="col-span-5">File</div>
          <div className="col-span-3">Location</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-2">Modified</div>
        </div>
        {loading ? (
          <div className="text-center py-10 text-sm text-[var(--text-tertiary)]">Scanning filesystem...</div>
        ) : files.length === 0 ? (
          <div className="text-center py-10 text-sm text-[var(--text-tertiary)]">No files larger than {minSize} MB found</div>
        ) : (
          files.map(f => {
            const Icon = icons[f.type] || File
            return (
              <div key={f.name + f.path} className="grid grid-cols-12 gap-4 px-5 py-3 items-center hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border)]">
                <div className="col-span-5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-secondary)]">
                    <Icon size={15} className="text-[var(--text-tertiary)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate max-w-[200px]">{f.name}</div>
                    <span className="text-[11px] text-[var(--text-tertiary)] capitalize">{f.type}</span>
                  </div>
                </div>
                <div className="col-span-3 text-xs text-[var(--text-tertiary)] truncate">{f.path}</div>
                <div className="col-span-2 text-sm font-semibold" style={{ color: 'var(--orange)' }}>{f.size.toFixed(1)} GB</div>
                <div className="col-span-2 text-xs text-[var(--text-tertiary)] flex items-center gap-1.5">
                  <Calendar size={11} />{f.date}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
