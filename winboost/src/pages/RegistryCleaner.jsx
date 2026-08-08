import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Database, Search, AlertTriangle, CheckCircle, Loader, FileText, Trash2,
  RefreshCw, FolderOpen, Cpu, Link, Command, FileQuestion, Monitor,
  Timer, ListTodo, ChevronDown, ScanSearch,
} from 'lucide-react'
import { scanRegistry, fixRegistry, openRegistryBackups } from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

const SCAN_AREAS = [
  {
    key: 'brokenShortcuts',
    label: 'Broken Shortcuts',
    icon: Link,
    desc: 'Finds .lnk files pointing to missing targets',
    color: 'text-sparkle-warning',
    bg: 'bg-sparkle-warning/10',
  },
  {
    key: 'uninstallEntries',
    label: 'Uninstall Entries',
    icon: Trash2,
    desc: 'Orphaned program entries in Add/Remove Programs',
    color: 'text-sparkle-danger',
    bg: 'bg-sparkle-danger/10',
  },
  {
    key: 'startupItems',
    label: 'Startup Items',
    icon: Cpu,
    desc: 'Missing or invalid auto-start entries',
    color: 'text-sparkle-primary',
    bg: 'bg-sparkle-primary/10',
  },
  {
    key: 'fileAssoc',
    label: 'File Associations',
    icon: FileText,
    desc: 'Broken file type handlers (HKEY_CLASSES_ROOT)',
    color: 'text-sparkle-teal',
    bg: 'bg-sparkle-teal/10',
  },
  {
    key: 'contextMenu',
    label: 'Context Menu',
    icon: Command,
    desc: 'Dead right-click menu entries in shell extensions',
    color: 'text-sparkle-purple',
    bg: 'bg-sparkle-purple/10',
  },
  {
    key: 'sharedDLLs',
    label: 'Shared DLLs',
    icon: Monitor,
    desc: 'Orphaned shared DLL references (HKEY_LOCAL_MACHINE)',
    color: 'text-sparkle-pink',
    bg: 'bg-sparkle-pink/10',
  },
  {
    key: 'appPaths',
    label: 'Application Paths',
    icon: FileQuestion,
    desc: 'Invalid App Paths keys for missing executables',
    color: 'text-sparkle-teal',
    bg: 'bg-sparkle-teal/10',
  },
]

function formatElapsed(seconds) {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export default function RegistryCleaner() {
  const [selectedAreas, setSelectedAreas] = useState(['brokenShortcuts', 'uninstallEntries', 'startupItems'])
  const [scanning, setScanning] = useState(false)
  const [sp, setSp] = useState(0)
  const [sd, setSd] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cp, setCp] = useState(0)
  const [cd, setCd] = useState(false)
  const [found, setFound] = useState([])
  const [error, setError] = useState('')
  const [fixedCount, setFixedCount] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const toggleArea = useCallback(key => {
    setSelectedAreas(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }, [])

  const scan = async () => {
    setScanning(true); setSd(false); setCd(false); setSp(0); setFound([]); setError('')
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000)
    try {
      const results = await scanRegistry(({ percent }) => setSp(percent))
      setFound(results); setSd(true); setSp(100)
    } catch (err) { setError(err.message) }
    finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setScanning(false)
    }
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

  const sevCls = { High: 'bg-sparkle-danger/10 text-sparkle-danger', Medium: 'bg-sparkle-warning/10 text-sparkle-warning', Low: 'bg-sparkle-teal/10 text-sparkle-teal' }

  return (
    <div className="space-y-6 anim-fade-up">
      {/* Hero */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-purple/10 text-sparkle-purple shadow-sm">
            <Database size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.15em] mb-2">
              <Search size={11} /> System Maintenance
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">Registry Cleaner</h1>
            <p className="text-[13px] text-sparkle-text-muted mt-1.5 leading-relaxed">Scan and fix Windows registry issues for a smoother system</p>
          </div>
        </div>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      {/* Warning */}
      <div className="glass-panel p-4 flex items-start gap-3">
        <AlertTriangle size={18} className="text-sparkle-warning shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-sm text-sparkle-warning">Use with caution</div>
          <div className="text-xs text-sparkle-text-secondary mt-0.5">Registry changes can affect system stability. Create a restore point before cleaning.</div>
        </div>
      </div>

      {/* Scan area selection */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Search size={15} className="text-sparkle-primary" />
          <span className="text-sm font-semibold">Scan Areas</span>
          <span className="text-[11px] text-sparkle-text-muted ml-auto">{selectedAreas.length} / {SCAN_AREAS.length} selected</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SCAN_AREAS.map(area => {
            const isSelected = selectedAreas.includes(area.key)
            const Icon = area.icon
            return (
              <button
                key={area.key}
                onClick={() => toggleArea(area.key)}
                disabled={scanning || cleaning}
                className={`flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-200 ${
                  isSelected
                    ? 'bg-sparkle-primary/10 border border-sparkle-primary/30'
                    : 'bg-sparkle-accent/30 border border-sparkle-border hover:border-sparkle-primary/20 hover:bg-sparkle-accent/50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? area.bg + ' ' + area.color : 'bg-sparkle-accent text-sparkle-text-muted'}`}>
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-sparkle-text">{area.label}</div>
                  <div className="text-[10px] text-sparkle-text-muted mt-0.5">{area.desc}</div>
                </div>
                {isSelected && (
                  <div className="w-3 h-3 rounded-full bg-sparkle-primary mt-1 flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Scan controls + progress */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={scan}
            disabled={scanning || cleaning || selectedAreas.length === 0}
            className="rounded-xl"
          >
            {scanning ? <Loader size={14} className="animate-spin mr-1.5" /> : <ScanSearch size={14} className="mr-1.5" />}
            {(!sd && !cd) ? 'Start Scan' : 'Scan Again'}
          </Button>
          {selectedAreas.length === 0 && (
            <span className="text-[10px] text-sparkle-warning">Select at least one area to scan</span>
          )}
        </div>

        {(scanning || sd) && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`status-dot ${scanning ? 'active' : 'idle'}`} />
                <span className="text-sparkle-text-secondary">{scanning ? 'Scanning registry hives...' : `${found.length} issues found`}</span>
              </div>
              <span className="text-lg font-bold text-gradient">{sp}%</span>
            </div>
            <div className="scan-progress">
              <div className="scan-progress-fill" style={{ width: `${sp}%` }} />
            </div>
            <div className="flex items-center gap-4 text-[10px] text-sparkle-text-muted">
              {scanning && (
                <>
                  <span className="flex items-center gap-1"><Timer size={10} /><span className="elapsed-timer anim-elapsed">{formatElapsed(elapsed)}</span></span>
                  <span className="flex items-center gap-1"><ListTodo size={10} />Pending: {100 - sp}%</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Issues found */}
      {sd && found.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-sparkle-border bg-sparkle-accent/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-sparkle-warning">
              <AlertTriangle size={16} /> {found.length} issues found
            </div>
            <Button onClick={clean} disabled={cleaning}>
              {cleaning ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Fix All Issues
            </Button>
          </div>
          {found.map(issue => (
            <div key={issue.key} className="flex items-center gap-4 px-6 py-3.5 hover:bg-sparkle-accent transition-all duration-200 border-b border-sparkle-border last:border-b-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sparkle-accent">
                <FileText size={15} className="text-sparkle-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                  {issue.name}
                  <Badge variant={issue.severity === 'High' ? 'danger' : issue.severity === 'Medium' ? 'warning' : 'teal'}>{issue.severity}</Badge>
                  <span className="text-[11px] text-sparkle-text-muted">{issue.cat}</span>
                </div>
                <div className="text-xs text-sparkle-text-muted mt-0.5">{issue.desc}</div>
                <div className="text-[11px] text-sparkle-text-muted mt-0.5 font-mono truncate">{issue.path}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Clean result */}
      {sd && found.length === 0 && !cd && (
        <Card className="p-8 text-center">
          <CardContent>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 bg-sparkle-success/10">
              <CheckCircle size={28} className="text-sparkle-success" />
            </div>
            <div className="text-xl font-bold mb-1">No Issues Found</div>
            <div className="text-sm text-sparkle-text-secondary mb-4">Your registry looks clean in the selected areas</div>
            <Button variant="secondary" onClick={scan} className="mx-auto">
              <RefreshCw size={14} /> Scan Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cleaning progress */}
      {(cleaning || cd) && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {cleaning ? <Loader size={18} className="animate-spin text-sparkle-purple" /> : <CheckCircle size={18} className="text-sparkle-success" />}
                <div>
                  <div className="font-semibold text-sm">{cleaning ? 'Fixing issues...' : 'Registry cleaned'}</div>
                  <div className="text-xs text-sparkle-text-muted">{cleaning ? 'Backing up and removing verified entries' : `${fixedCount} issue${fixedCount === 1 ? '' : 's'} resolved`}</div>
                </div>
              </div>
              {cleaning && <span className="text-lg font-bold text-gradient">{cp}%</span>}
            </div>
            {cleaning && (
              <div className="scan-progress">
                <div className="scan-progress-fill" style={{ width: `${cp}%` }} />
              </div>
            )}
            {cd && (
              <div className="flex items-center gap-2 text-sm font-medium text-sparkle-success">
                <CheckCircle size={16} /> Issues fixed successfully
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions after clean */}
      {cd && (
        <div className="flex justify-center gap-2">
          <Button variant="secondary" onClick={openRegistryBackups}><FolderOpen size={15} /> Open Backups</Button>
          <Button onClick={() => { setSd(false); setCd(false); scan() }}>
            <RefreshCw size={15} /> Scan Again
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!scanning && !sd && !cd && (
        <Card className="p-10 text-center">
          <CardContent>
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 bg-sparkle-purple/10">
              <Database size={28} className="text-sparkle-purple" />
            </div>
            <div className="text-xl font-bold mb-1">Registry Scan</div>
            <div className="text-sm text-sparkle-text-secondary max-w-sm mx-auto">
              Select which areas to scan above, then click Start Scan. Scans for broken shortcuts, orphaned uninstall entries, invalid startup items, and more.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
