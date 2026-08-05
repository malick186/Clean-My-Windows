import { useState } from 'react'
import { Database, Search, AlertTriangle, CheckCircle, Loader, FileText, Trash2, RefreshCw, FolderOpen } from 'lucide-react'
import { scanRegistry, fixRegistry, openRegistryBackups } from '../lib/api'

export default function RegistryCleaner() {
  const [scanning, setScanning] = useState(false)
  const [sp, setSp] = useState(0)
  const [sd, setSd] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cp, setCp] = useState(0)
  const [cd, setCd] = useState(false)
  const [found, setFound] = useState([])
  const [error, setError] = useState('')
  const [fixedCount, setFixedCount] = useState(0)

  const scan = async () => {
    setScanning(true); setSd(false); setCd(false); setSp(0); setFound([]); setError('')
    try {
      const results = await scanRegistry(({ percent }) => setSp(percent))
      setFound(results); setSd(true); setSp(100)
    } catch (err) { setError(err.message) }
    finally { setScanning(false) }
  }

  const clean = async () => {
    setCleaning(true); setCp(25); setError('')
    try {
      const result = await fixRegistry(found.map(f => f.id || f.key))
      setFixedCount(result.fixed || 0); setCp(100)
      if (result.errors?.length) setError(result.errors.join(' · '))
      if (result.fixed > 0) { setCd(true); setFound([]); setSd(false) }
    } catch (err) { setError(err.message) }
    finally { setCleaning(false) }
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

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'var(--orange-bg)', border: '1px solid rgba(255,149,0,0.15)' }}>
        <AlertTriangle size={18} color="#ff9500" className="shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-sm" style={{ color: 'var(--orange)' }}>Use with caution</div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">Registry changes can affect system stability. Create a restore point before cleaning.</div>
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
            {scanning && `Checking registry hive...`}
            {sd && `${found.length} issues found`}
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
                  {issue.name} <span className={`badge ${sevCls[issue.severity] || 'badge-blue'}`}>{issue.severity}</span>
                  <span className="text-[11px] text-[var(--text-tertiary)]">{issue.cat}</span>
                </div>
                <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{issue.desc}</div>
                <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 font-mono truncate">{issue.path}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sd && found.length === 0 && !cd && (
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--green-bg)' }}>
            <CheckCircle size={28} color="var(--green)" />
          </div>
          <div className="text-xl font-bold mb-1">No Issues Found</div>
          <div className="text-sm text-[var(--text-secondary)] mb-4">Your registry looks clean</div>
          <button onClick={scan} className="btn btn-secondary">
            <RefreshCw size={14} /> Scan Again
          </button>
        </div>
      )}

      {(cleaning || cd) && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {cleaning ? <Loader size={18} className="animate-spin" style={{ color: 'var(--purple)' }} /> : <CheckCircle size={18} color="var(--green)" />}
              <div>
                <div className="font-semibold text-sm">{cleaning ? 'Fixing issues...' : 'Registry cleaned'}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{cleaning ? 'Backing up and removing verified entries' : `${fixedCount} issue${fixedCount === 1 ? '' : 's'} resolved`}</div>
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
        <div className="flex justify-center gap-2">
          <button onClick={openRegistryBackups} className="btn btn-secondary"><FolderOpen size={15} /> Open Backups</button>
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
            Performs a narrow scan for verifiably missing startup and uninstall targets. No guessed or fabricated issues are shown.
          </div>
          <button onClick={scan} className="btn btn-primary btn-lg mt-5">
            <Search size={16} /> Start Scan
          </button>
        </div>
      )}
    </div>
  )
}
