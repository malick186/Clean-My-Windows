import { Search, HardDrive, Calendar, FileVideo, FileImage, FileArchive, File } from 'lucide-react'

const files = [
  { name: 'vm_disk_backup.vdi', path: 'C:\\Users\\Admin\\VirtualBox VMs', size: '25.1 GB', date: '2024-02-10', type: 'disk' },
  { name: 'steam_game_backup.tar', path: 'D:\\Backups', size: '45.3 GB', date: '2023-11-30', type: 'archive' },
  { name: 'adobe_cache_files', path: 'C:\\Users\\Admin\\AppData', size: '18.2 GB', date: '2024-04-25', type: 'cache' },
  { name: 'windows_old_backup', path: 'C:\\Windows.old', size: '32.7 GB', date: '2023-09-20', type: 'system' },
  { name: 'vacation_4k_raw.mp4', path: 'C:\\Users\\Admin\\Videos', size: '8.7 GB', date: '2023-06-22', type: 'video' },
  { name: 'project_archive_2024.zip', path: 'C:\\Users\\Admin\\Downloads', size: '12.4 GB', date: '2024-01-15', type: 'archive' },
  { name: 'raw_photo_collection.psd', path: 'C:\\Users\\Admin\\Pictures', size: '6.2 GB', date: '2023-08-14', type: 'image' },
  { name: 'onedrive_sync_data', path: 'C:\\Users\\Admin\\OneDrive', size: '9.4 GB', date: '2024-03-15', type: 'cloud' },
  { name: 'docker_images.tar.gz', path: 'C:\\Users\\Admin\\Docker', size: '4.8 GB', date: '2024-03-05', type: 'archive' },
  { name: 'music_library_backup', path: 'C:\\Users\\Admin\\Music', size: '15.8 GB', date: '2023-05-10', type: 'audio' },
]

const icons = { video: FileVideo, image: FileImage, archive: FileArchive, disk: HardDrive, cache: File, system: File, cloud: File, audio: FileVideo }

export default function LargeFiles() {
  const total = files.reduce((s, f) => s + parseFloat(f.size), 0)

  return (
    <div className="anim-fade-up space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--teal-bg)' }}>
            <Search size={20} color="#5ac8fa" />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">Large Files Finder</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] ml-12">Discover large and old files consuming valuable disk space</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: HardDrive, val: files.length, sub: 'Large files found', color: '#5ac8fa' },
          { icon: Search, val: `${total.toFixed(1)} GB`, sub: 'Total wasted space', color: '#af52de' },
          { icon: FileArchive, val: '+1 GB', sub: 'Minimum file size', color: '#ff9500' },
        ].map(s => (
          <div key={s.sub} className="card p-4">
            <s.icon size={18} style={{ color: s.color }} className="mb-2" />
            <div className="text-xl font-bold">{s.val}</div>
            <div className="text-xs text-[var(--text-tertiary)]">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
          <div className="col-span-5">File</div>
          <div className="col-span-3">Location</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-2">Modified</div>
        </div>
        {files.map(f => {
          const Icon = icons[f.type] || File
          return (
            <div key={f.name} className="grid grid-cols-12 gap-4 px-5 py-3 items-center hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border)]">
              <div className="col-span-5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-secondary)]">
                  <Icon size={15} className="text-[var(--text-tertiary)]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <span className="text-[11px] text-[var(--text-tertiary)] capitalize">{f.type}</span>
                </div>
              </div>
              <div className="col-span-3 text-xs text-[var(--text-tertiary)] truncate">{f.path}</div>
              <div className="col-span-2 text-sm font-semibold" style={{ color: 'var(--orange)' }}>{f.size}</div>
              <div className="col-span-2 text-xs text-[var(--text-tertiary)] flex items-center gap-1.5">
                <Calendar size={11} />{f.date}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
