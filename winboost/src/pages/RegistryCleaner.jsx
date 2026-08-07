import { useState } from 'react'
import { Database, Search, AlertTriangle, CheckCircle, Loader, FileText, Trash2, RefreshCw, FolderOpen } from 'lucide-react'
import { scanRegistry, fixRegistry, openRegistryBackups } from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

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

  const sevCls = { High: 'bg-red-bg text-red', Medium: 'bg-orange-bg text-orange', Low: 'bg-teal-bg text-teal' }

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-bg text-purple shadow-sm">
            <Database size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-[0.15em] mb-2">
              <Search size={11} /> System Maintenance
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">Registry Cleaner</h1>
            <p className="text-[13px] text-text-tertiary mt-1.5 leading-relaxed">Scan and fix Windows registry issues for a smoother system</p>
          </div>
        </div>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="p-4 rounded-xl flex items-start gap-3 bg-orange-bg border border-orange/15">
        <AlertTriangle size={18} className="text-orange shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-sm text-orange">Use with caution</div>
          <div className="text-xs text-text-secondary mt-0.5">Registry changes can affect system stability. Create a restore point before cleaning.</div>
        </div>
      </div>

      {(scanning || (sd && !cd)) && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {scanning ? <Loader size={18} className="animate-spin text-purple" /> : <CheckCircle size={18} className="text-green" />}
                <div>
                  <div className="font-semibold text-sm">{scanning ? 'Scanning registry...' : 'Scan complete'}</div>
                  <div className="text-xs text-text-tertiary">Checking entries, keys, and values</div>
                </div>
              </div>
              <span className="text-lg font-bold text-gradient">{sp}%</span>
            </div>
            <Progress value={sp} />
            <div className="text-xs text-text-tertiary">
              {scanning && `Checking registry hive...`}
              {sd && `${found.length} issues found`}
            </div>
          </CardContent>
        </Card>
      )}

      {sd && found.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.05] bg-surface-secondary/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-orange">
              <AlertTriangle size={16} /> {found.length} issues found
            </div>
            <Button onClick={clean} disabled={cleaning}>
              {cleaning ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Fix All Issues
            </Button>
          </div>
          {found.map(issue => (
            <div key={issue.key} className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface-hover transition-all duration-200 border-b border-white/[0.03] last:border-b-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-secondary">
                <FileText size={15} className="text-text-tertiary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                  {issue.name} <Badge variant={issue.severity === 'High' ? 'danger' : issue.severity === 'Medium' ? 'warning' : 'teal'}>{issue.severity}</Badge>
                  <span className="text-[11px] text-text-tertiary">{issue.cat}</span>
                </div>
                <div className="text-xs text-text-tertiary mt-0.5">{issue.desc}</div>
                <div className="text-[11px] text-text-tertiary mt-0.5 font-mono truncate">{issue.path}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {sd && found.length === 0 && !cd && (
        <Card className="p-8 text-center">
          <CardContent>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-green-bg">
              <CheckCircle size={28} className="text-green" />
            </div>
            <div className="text-xl font-bold mb-1">No Issues Found</div>
            <div className="text-sm text-text-secondary mb-4">Your registry looks clean</div>
            <Button variant="secondary" onClick={scan} className="mx-auto">
              <RefreshCw size={14} /> Scan Again
            </Button>
          </CardContent>
        </Card>
      )}

      {(cleaning || cd) && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {cleaning ? <Loader size={18} className="animate-spin text-purple" /> : <CheckCircle size={18} className="text-green" />}
                <div>
                  <div className="font-semibold text-sm">{cleaning ? 'Fixing issues...' : 'Registry cleaned'}</div>
                  <div className="text-xs text-text-tertiary">{cleaning ? 'Backing up and removing verified entries' : `${fixedCount} issue${fixedCount === 1 ? '' : 's'} resolved`}</div>
                </div>
              </div>
              {cleaning && <span className="text-lg font-bold text-gradient">{cp}%</span>}
            </div>
            {cleaning && <Progress value={cp} />}
            {cd && (
              <div className="flex items-center gap-2 text-sm font-medium text-green">
                <CheckCircle size={16} /> Issues fixed successfully
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {cd && (
        <div className="flex justify-center gap-2">
          <Button variant="secondary" onClick={openRegistryBackups}><FolderOpen size={15} /> Open Backups</Button>
          <Button onClick={() => { setSd(false); setCd(false); scan() }}>
            <RefreshCw size={15} /> Scan Again
          </Button>
        </div>
      )}

      {!scanning && !sd && !cd && (
        <Card className="p-10 text-center">
          <CardContent>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-purple-bg">
              <Database size={28} className="text-purple" />
            </div>
            <div className="text-xl font-bold mb-1">Registry Scan</div>
            <div className="text-sm text-text-secondary max-w-sm mx-auto">
              Performs a narrow scan for verifiably missing startup and uninstall targets. No guessed or fabricated issues are shown.
            </div>
            <Button onClick={scan} className="mx-auto mt-5">
              <Search size={16} /> Start Scan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
