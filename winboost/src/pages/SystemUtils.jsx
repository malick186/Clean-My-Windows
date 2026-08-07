import { useState, useEffect, useCallback } from 'react'
import { Wrench, Play, Shield, HardDrive, Server, RefreshCw, CheckCircle2, AlertTriangle, Loader } from 'lucide-react'
import { runSFC, runDISMCheck, runDISMRestore, runCHKDSK, cleanWinUpdate, listDrives } from '../lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

const COLORS = {
  purple: { hero: 'bg-sparkle-purple/10 text-sparkle-purple', border: 'ring-sparkle-purple/25 bg-sparkle-purple/10', badge: 'purple' },
}

function OutputArea({ output }) {
  if (!output) return null
  return (
    <div className="mt-3 p-3 rounded-xl bg-sparkle-accent/60 border border-sparkle-border max-h-40 overflow-y-auto">
      <pre className="text-[11px] text-sparkle-text-muted font-mono whitespace-pre-wrap leading-relaxed">{output}</pre>
    </div>
  )
}

export default function SystemUtils() {
  const [drives, setDrives] = useState([])
  const [selectedDrive, setSelectedDrive] = useState('C:')

  const [sfcLoading, setSfcLoading] = useState(false)
  const [sfcProgress, setSfcProgress] = useState(0)
  const [sfcResult, setSfcResult] = useState(null)
  const [sfcError, setSfcError] = useState('')

  const [dismLoading, setDismLoading] = useState(false)
  const [dismMode, setDismMode] = useState(null)
  const [dismProgress, setDismProgress] = useState(0)
  const [dismResult, setDismResult] = useState(null)
  const [dismError, setDismError] = useState('')

  const [chkdskLoading, setChkdskLoading] = useState(false)
  const [chkdskProgress, setChkdskProgress] = useState(0)
  const [chkdskResult, setChkdskResult] = useState(null)
  const [chkdskError, setChkdskError] = useState('')

  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState(null)
  const [cleanupError, setCleanupError] = useState('')

  useEffect(() => {
    listDrives().then(data => {
      const d = data.filter(d => d.id && /^[A-Z]:\\?$/i.test(d.id)).map(d => d.id.replace(/\\$/, ''))
      setDrives(d.length ? d : ['C:'])
      if (!d.includes('C:')) setSelectedDrive(d[0] || 'C:')
    }).catch(() => setDrives(['C:']))
  }, [])

  const handleSFC = useCallback(async () => {
    setSfcLoading(true); setSfcProgress(0); setSfcResult(null); setSfcError('')
    try {
      const result = await runSFC(data => setSfcProgress(data.percent || 0))
      setSfcResult(result)
    } catch (err) { setSfcError(err.message) }
    finally { setSfcLoading(false) }
  }, [])

  const handleDISMCheck = useCallback(async () => {
    setDismLoading(true); setDismMode('check'); setDismProgress(0); setDismResult(null); setDismError('')
    try {
      const result = await runDISMCheck(data => setDismProgress(data.percent || 0))
      setDismResult(result)
    } catch (err) { setDismError(err.message) }
    finally { setDismLoading(false); setDismMode(null) }
  }, [])

  const handleDISMRestore = useCallback(async () => {
    setDismLoading(true); setDismMode('restore'); setDismProgress(0); setDismResult(null); setDismError('')
    try {
      const result = await runDISMRestore(data => setDismProgress(data.percent || 0))
      setDismResult(result)
    } catch (err) { setDismError(err.message) }
    finally { setDismLoading(false); setDismMode(null) }
  }, [])

  const handleCHKDSK = useCallback(async () => {
    setChkdskLoading(true); setChkdskProgress(0); setChkdskResult(null); setChkdskError('')
    try {
      const result = await runCHKDSK(data => setChkdskProgress(data.percent || 0))
      setChkdskResult(result)
    } catch (err) { setChkdskError(err.message) }
    finally { setChkdskLoading(false) }
  }, [])

  const handleCleanup = useCallback(async () => {
    setCleanupLoading(true); setCleanupResult(null); setCleanupError('')
    try {
      const result = await cleanWinUpdate()
      setCleanupResult(result)
    } catch (err) { setCleanupError(err.message) }
    finally { setCleanupLoading(false) }
  }, [])

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-purple/10 text-sparkle-purple shadow-sm">
            <Wrench size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.15em] mb-2">
              <Shield size={11} /> System Repair
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">System Utilities</h1>
            <p className="text-[13px] text-sparkle-text-muted mt-1.5 leading-relaxed">Repair and optimize Windows system files and components</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* SFC Scan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sparkle-purple/10 text-sparkle-purple shrink-0">
              <Shield size={18} />
            </div>
            <div className="flex-1">
              <CardTitle>SFC Scan</CardTitle>
              <CardDescription>System File Checker — scans and repairs corrupted system files</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {sfcError && (
              <div className="notice-banner error mb-4"><AlertTriangle size={15} />{sfcError}</div>
            )}
            {sfcResult && (
              <div className="notice-banner success mb-4">
                <CheckCircle2 size={15} />
                {sfcResult.success ? 'SFC scan completed successfully' : sfcResult.output || 'SFC scan finished'}
              </div>
            )}
            {(sfcLoading || sfcProgress > 0) && sfcLoading && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-sparkle-text-secondary">
                  <span className="flex items-center gap-1.5"><Loader size={12} className="animate-spin text-sparkle-primary" /> Scanning system files...</span>
                  <span className="font-semibold">{sfcProgress}%</span>
                </div>
                <Progress value={sfcProgress} />
              </div>
            )}
            {(sfcResult?.output || sfcResult?.status) && (
              <div className="p-3 rounded-xl bg-sparkle-accent/60 border border-sparkle-border max-h-32 overflow-y-auto mb-4">
                <pre className="text-[11px] text-sparkle-text-muted font-mono whitespace-pre-wrap leading-relaxed">{sfcResult.output || sfcResult.status}</pre>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="secondary" className="w-full" onClick={handleSFC} disabled={sfcLoading}>
              {sfcLoading ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
              {sfcLoading ? 'Scanning...' : 'Run SFC Scan'}
            </Button>
          </CardFooter>
        </Card>

        {/* DISM Cleanup */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sparkle-purple/10 text-sparkle-purple shrink-0">
              <Server size={18} />
            </div>
            <div className="flex-1">
              <CardTitle>DISM Cleanup</CardTitle>
              <CardDescription>Deployment Image Servicing — checks and repairs the Windows image</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {dismError && (
              <div className="notice-banner error mb-4"><AlertTriangle size={15} />{dismError}</div>
            )}
            {dismResult && (
              <div className="notice-banner success mb-4">
                <CheckCircle2 size={15} />
                {dismResult.success ? 'DISM operation completed successfully' : dismResult.output || 'DISM operation finished'}
              </div>
            )}
            {(dismLoading || dismProgress > 0) && dismLoading && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-sparkle-text-secondary">
                  <span className="flex items-center gap-1.5"><Loader size={12} className="animate-spin text-sparkle-primary" />{dismMode === 'check' ? 'Checking health...' : 'Restoring health...'}</span>
                  <span className="font-semibold">{dismProgress}%</span>
                </div>
                <Progress value={dismProgress} />
              </div>
            )}
            {(dismResult?.output || dismResult?.status) && (
              <div className="p-3 rounded-xl bg-sparkle-accent/60 border border-sparkle-border max-h-32 overflow-y-auto mb-4">
                <pre className="text-[11px] text-sparkle-text-muted font-mono whitespace-pre-wrap leading-relaxed">{dismResult.output || dismResult.status}</pre>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <div className="flex gap-2 w-full">
              <Button variant="secondary" className="flex-1" onClick={handleDISMCheck} disabled={dismLoading}>
                {dismLoading && dismMode === 'check' ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
                Check Health
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleDISMRestore} disabled={dismLoading}>
                {dismLoading && dismMode === 'restore' ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Restore Health
              </Button>
            </div>
          </CardFooter>
        </Card>

        {/* Check Disk */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sparkle-purple/10 text-sparkle-purple shrink-0">
              <HardDrive size={18} />
            </div>
            <div className="flex-1">
              <CardTitle>Check Disk</CardTitle>
              <CardDescription>Checks the file system and file system metadata for errors</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {chkdskError && (
              <div className="notice-banner error mb-4"><AlertTriangle size={15} />{chkdskError}</div>
            )}
            {chkdskResult && (
              <div className="notice-banner success mb-4">
                <CheckCircle2 size={15} />
                {chkdskResult.success ? 'Disk check completed successfully' : chkdskResult.output || 'Disk check finished'}
              </div>
            )}
            {(chkdskLoading || chkdskProgress > 0) && chkdskLoading && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-sparkle-text-secondary">
                  <span className="flex items-center gap-1.5"><Loader size={12} className="animate-spin text-sparkle-primary" /> Checking {selectedDrive}...</span>
                  <span className="font-semibold">{chkdskProgress}%</span>
                </div>
                <Progress value={chkdskProgress} />
              </div>
            )}
            {(chkdskResult?.output || chkdskResult?.status) && (
              <div className="p-3 rounded-xl bg-sparkle-accent/60 border border-sparkle-border max-h-32 overflow-y-auto mb-4">
                <pre className="text-[11px] text-sparkle-text-muted font-mono whitespace-pre-wrap leading-relaxed">{chkdskResult.output || chkdskResult.status}</pre>
              </div>
            )}
            {drives.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-sparkle-text-muted">Drive:</span>
                <select
                  value={selectedDrive}
                  onChange={e => setSelectedDrive(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-sparkle-accent border border-sparkle-border text-xs text-sparkle-text-secondary focus:outline-none focus:ring-1 focus:ring-sparkle-purple/30"
                >
                  {drives.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <Badge variant="purple">Elevated</Badge>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="secondary" className="w-full" onClick={handleCHKDSK} disabled={chkdskLoading}>
              {chkdskLoading ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
              {chkdskLoading ? 'Scanning...' : `Scan ${selectedDrive}`}
            </Button>
          </CardFooter>
        </Card>

        {/* Clean Windows Update */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sparkle-purple/10 text-sparkle-purple shrink-0">
              <RefreshCw size={18} />
            </div>
            <div className="flex-1">
              <CardTitle>Clean Windows Update</CardTitle>
              <CardDescription>Clean up old Windows Update files to free disk space</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {cleanupError && (
              <div className="notice-banner error mb-4"><AlertTriangle size={15} />{cleanupError}</div>
            )}
            {cleanupResult && (
              <div className="notice-banner success mb-4">
                <CheckCircle2 size={15} />
                {cleanupResult.success
                  ? `Freed ${cleanupResult.freedMB >= 1024 ? `${(cleanupResult.freedMB / 1024).toFixed(1)} GB` : `${cleanupResult.freedMB} MB`} of disk space`
                  : cleanupResult.error || 'Cleanup finished'}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="secondary" className="w-full" onClick={handleCleanup} disabled={cleanupLoading}>
              {cleanupLoading ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {cleanupLoading ? 'Cleaning...' : 'Clean Update Cache'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
