import { useState, useEffect, useCallback } from 'react'
import { Download, Loader, AlertTriangle, RefreshCw, CheckCircle2, Package, X, Check } from 'lucide-react'
import { listFeaturedApps, installWingetApp } from '../lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

const CATEGORY_COLORS = {
  Browser: 'purple',
  Media: 'teal',
  Dev: 'default',
  Utility: 'warning',
  Communication: 'success',
  Gaming: 'danger',
  Office: 'purple',
  Security: 'danger',
  Cloud: 'teal',
}

export default function AppInstaller() {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [installing, setInstalling] = useState(null)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [doneApps, setDoneApps] = useState(new Set())

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listFeaturedApps()
      setApps(res.apps || [])
      setDoneApps(new Set())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleInstall = async (app) => {
    setInstalling(app.id)
    setProgress(0)
    setProgressLabel('')
    setError('')
    try {
      await installWingetApp(app.id, (data) => {
        if (data.percent !== undefined) setProgress(data.percent)
        if (data.stage) setProgressLabel(data.stage)
      })
      setProgress(100)
      setProgressLabel('Installation complete')
      setDoneApps(prev => {
        const next = new Set(prev)
        next.add(app.id)
        return next
      })
    } catch (err) {
      setError(err.message)
    }
    setInstalling(null)
  }

  const installedCount = apps.filter(a => a.installed).length

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-success/10 text-sparkle-success shadow-sm">
            <Download size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.15em] mb-2">
              <Package size={11} /> App Installer
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">App Installer</h1>
            <p className="text-[13px] text-sparkle-text-muted mt-1.5 leading-relaxed">Quickly install popular apps using winget package manager</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="notice-banner error">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-sparkle-text-muted hover:text-sparkle-text"><X size={14} /></button>
        </div>
      )}

      {installing && (
        <Card>
          <CardContent className="py-5 space-y-3">
            <div className="flex items-center gap-3">
              <Loader size={18} className="animate-spin text-sparkle-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">
                  Installing {apps.find(a => a.id === installing)?.name || '...'}
                </div>
                <div className="text-xs text-sparkle-text-muted">{progressLabel || 'Starting winget installation...'}</div>
              </div>
              <span className="text-sm font-semibold text-sparkle-primary">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="secondary" size="sm" onClick={refresh} disabled={loading || installing !== null}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
        <Badge variant="teal" className="shrink-0">
          <Download size={11} /> {installedCount} installed
        </Badge>
        <Badge variant="outline">{apps.length} available</Badge>
      </div>

      <Card className="p-0 overflow-hidden">
        <CardHeader className="mb-0 pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package size={18} className="text-sparkle-success" /> Featured Applications
          </CardTitle>
          <CardDescription>Popular apps ready for one-click installation</CardDescription>
        </CardHeader>
        <Separator />
        {loading ? (
          <div className="loading-state">
            <Loader size={20} className="animate-spin" />
            <span>Loading featured applications...</span>
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-12 text-sm text-sparkle-text-muted">
            No featured applications available.
          </div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4">
              {apps.map((app) => {
                const isInstalled = app.installed || doneApps.has(app.id)
                const isInstalling = installing === app.id

                return (
                  <Card key={app.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-sparkle-text truncate">{app.name}</div>
                        {app.category && (
                          <Badge
                            variant={CATEGORY_COLORS[app.category] || 'default'}
                            className="mt-1.5 text-[10px] py-0"
                          >
                            {app.category}
                          </Badge>
                        )}
                      </div>
                      {isInstalled && (
                        <Badge variant="success" className="shrink-0 text-[10px] py-0">
                          <Check size={10} /> Installed
                        </Badge>
                      )}
                    </div>
                    {app.desc && (
                      <p className="text-xs text-sparkle-text-muted leading-relaxed flex-1">{app.desc}</p>
                    )}
                    <div className="mt-auto pt-1">
                      {isInstalled ? (
                        <div className="flex items-center gap-2 text-xs text-sparkle-success">
                          <CheckCircle2 size={13} className="shrink-0" />
                          <span>Installed</span>
                        </div>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full"
                          onClick={() => handleInstall(app)}
                          disabled={isInstalling || installing !== null}
                        >
                          {isInstalling ? (
                            <><Loader size={13} className="animate-spin" /> Installing...</>
                          ) : (
                            <><Download size={13} /> Install</>
                          )}
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
        <CardFooter>
          <div className="flex items-center gap-2 text-xs text-sparkle-text-muted">
            <Package size={12} />
            Powered by winget — requires Windows Package Manager
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
