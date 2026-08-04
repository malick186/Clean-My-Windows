import { useState } from 'react'
import { Database, Search, AlertTriangle, CheckCircle, Loader, FileText, Trash2, RefreshCw } from 'lucide-react'

const issues = [
  { key: 'orphan1', name: 'Orphaned Registry Key', path: 'HKCU\\Software\\OldApp', desc: 'Leftover from uninstalled application', severity: 'Low', cat: 'Orphaned' },
  { key: 'broken1', name: 'Broken File Association', path: 'HKLM\\Software\\Classes\\broken_handler', desc: 'Points to non-existent program', severity: 'Medium', cat: 'File Assoc' },
  { key: 'startup1', name: 'Invalid Startup Entry', path: 'HKLM\\...\\Run\\old_startup', desc: 'References deleted executable', severity: 'Medium', cat: 'Startup' },
  { key: 'com1', name: 'Invalid COM Registration', path: 'HKCR\\CLSID\\{BROKEN}', desc: 'Registered DLL no longer exists', severity: 'High', cat: 'COM/ActiveX' },
  { key: 'driver1', name: 'Orphaned Driver Entry', path: 'HKLM\\SYSTEM\\...\\old_driver', desc: 'Driver files were removed', severity: 'High', cat: 'Drivers' },
  { key: 'shell1', name: 'Invalid Shell Extension', path: 'HKCU\\Software\\...\\Shell', desc: 'Context menu handler broken', severity: 'Medium', cat: 'Shell' },
  { key: 'dll1', name: 'Shared DLL Reference', path: 'HKLM\\Software\\...\\Shared Tools', desc: 'References missing DLL', severity: 'Low', cat: 'Shared DLLs' },
  { key: 'uninst1', name: 'Invalid Uninstall Entry', path: 'HKLM\\...\\Uninstall', desc: 'Program files manually deleted', severity: 'Low', cat: 'Uninstall' },
]

export default function RegistryCleaner() {
  const [scanning, setScanning] = useState(false)
  const [sp, setSp] = useState(0)
  const [sd, setSd] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cp, setCp] = useState(0)
  const [cd, setCd] = useState(false)
  const [found, setFound] = useState([])

  const scan = () => {
    setScanning(true); setSd(false); setCd(false); setSp(0); setFound([])
    let p = 0
    const iv = setInterval(() => {
      p += Math.random() * 3 + 1.5
      if (p >= 50 && found.length === 0) setFound(issues.slice(0, 3))
      if (p >= 80 && found.length === 3) setFound(issues)
      if (p >= 100) { p = 100; clearInterval(iv); setScanning(false); setSd(true) }
      setSp(Math.round(p))
    }, 60)
  }

  const clean = () => {
    setCleaning(true); setCp(0)
    let p = 0
    const iv = setInterval(() => { p += 5; if (p >= 100) { p = 100; clearInterval(iv); setCleaning(false); setCd(true); setFound([]); setSd(false) } setCp(Math.round(p)) }, 60)
  }

  const sevCls = { High: 'badge-red', Medium: 'badge-orange', Low: 'badge-blue' }

  return (
    <div className="anim-fade-up space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--purple-bg)' }}>
            <Database size={20} color="#af52de" />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">Registry Cleaner</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] ml-12">Scan and fix Windows registry issues for a smoother system</p>
      </div>

      <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'var(--orange-bg)', border: '1px solid rgba(255,149,0,0.15)' }}>
        <AlertTriangle size={18} color="#ff9500" className="shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-sm" style={{ color: 'var(--orange)' }}>Use with caution</div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">Registry changes can affect system stability. A backup point is created before cleaning.</div>
        </div>
      </div>

      {(scanning || (sd && !cd)) && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {scanning ? <Loader size={18} className="animate-spin" style={{ color: 'var(--purple)' }} /> : <CheckCircle size={18} color="var(--green)" />}
              <div>
                <div className="font-semibold text-sm">{scanning ? 'Scanning registry...' : 'Scan complete'}</div>
                <div className="text-xs text-[var(--text-tertiary)]">Checking entries, keys, and values</div>
              </div>
            </div>
            <span className="text-lg font-bold text-gradient">{sp}%</span>
          </div>
          <div className="progress"><div className="progress-fill" style={{ width: `${sp}%` }} /></div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {scanning && `${Math.floor(sp * 480)} entries scanned`}
            {sd && `${found.length} issues found in 48,000 entries`}
          </div>
        </div>
      )}

      {sd && found.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle size={16} color="var(--orange)" /> {found.length} issues found
            </div>
            <button onClick={clean} disabled={cleaning} className="btn btn-primary btn-sm">
              {cleaning ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Fix All Issues
            </button>
          </div>
          {found.map(issue => (
            <div key={issue.key} className="flex items-center gap-4 px-5 py-3.5 border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-secondary)]">
                <FileText size={15} className="text-[var(--text-tertiary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                  {issue.name} <span className={`badge ${sevCls[issue.severity]}`}>{issue.severity}</span>
                  <span className="text-[11px] text-[var(--text-tertiary)]">{issue.cat}</span>
                </div>
                <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{issue.desc}</div>
                <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 font-mono truncate">{issue.path}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(cleaning || cd) && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {cleaning ? <Loader size={18} className="animate-spin" style={{ color: 'var(--purple)' }} /> : <CheckCircle size={18} color="var(--green)" />}
              <div>
                <div className="font-semibold text-sm">{cleaning ? 'Fixing issues...' : 'Registry cleaned'}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{cleaning ? 'Creating backup before changes' : 'All issues resolved'}</div>
              </div>
            </div>
            {cleaning && <span className="text-lg font-bold text-gradient">{cp}%</span>}
          </div>
          {cleaning && <div className="progress"><div className="progress-fill" style={{ width: `${cp}%` }} /></div>}
          {cd && (
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--green)' }}>
              <CheckCircle size={16} /> Issues fixed successfully
            </div>
          )}
        </div>
      )}

      {cd && (
        <div className="flex justify-center">
          <button onClick={() => { setSd(false); setCd(false); scan() }} className="btn btn-primary">
            <RefreshCw size={15} /> Scan Again
          </button>
        </div>
      )}

      {!scanning && !sd && !cd && (
        <div className="card p-10 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--purple-bg)' }}>
            <Database size={28} color="#af52de" />
          </div>
          <div className="text-xl font-bold mb-1">Registry Scan</div>
          <div className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto">
            Scans for broken references, orphaned entries, and invalid settings in the Windows registry
          </div>
          <button onClick={scan} className="btn btn-primary btn-lg mt-5">
            <Search size={16} /> Start Scan
          </button>
        </div>
      )}
    </div>
  )
}
