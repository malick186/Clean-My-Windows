import { useState, useEffect, useCallback } from 'react'
import { Trash2, Loader, AlertTriangle, RefreshCw, CheckCircle2, X } from 'lucide-react'
import { listDebloat, removeDebloat, removeAllDebloat } from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

const RISK_COLORS = {
  Low: 'success',
  Medium: 'warning',
  High: 'danger',
}

export default function Debloat() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [installed, setInstalled] = useState(0)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(null)
  const [removingAll, setRemovingAll] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [doneMsg, setDoneMsg] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listDebloat()
      setItems(res.items || [])
      setTotal(res.total || 0)
      setInstalled(res.installed || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    const installedItems = items.filter(i => i.installed)
    if (selectedIds.size === installedItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(installedItems.map(i => i.id)))
    }
  }

  const handleRemove = async (item) => {
    setRemoving(item.id)
    setProgress(0)
    setProgressLabel('')
    setDoneMsg('')
    setError('')
    try {
      const result = await removeDebloat(item.id, (data) => {
        if (data.percent !== undefined) setProgress(data.percent)
        if (data.stage) setProgressLabel(data.stage)
      })
      setProgress(100)
      setProgressLabel(result.item ? `${result.item.name} removed` : 'Removed successfully')
      setDoneMsg(`${item.name} has been removed.`)
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      await refresh()
    } catch (err) {
      setError(err.message)
    }
    setRemoving(null)
  }

  const handleRemoveAll = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setRemovingAll(true)
    setProgress(0)
    setProgressLabel('')
    setDoneMsg('')
    setError('')
    try {
      await removeAllDebloat(ids, (data) => {
        if (data.percent !== undefined) setProgress(data.percent)
        if (data.stage) setProgressLabel(data.stage)
      })
      setProgress(100)
      setProgressLabel('All selected items removed')
      setDoneMsg(`${ids.length} item(s) removed successfully.`)
      setSelectedIds(new Set())
      await refresh()
    } catch (err) {
      setError(err.message)
    }
    setRemovingAll(false)
  }

  const installedItems = items.filter(i => i.installed)
  const allSelected = installedItems.length > 0 && selectedIds.size === installedItems.length

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-bg text-red shadow-sm">
            <Trash2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-[0.15em] mb-2">
              <Trash2 size={11} /> System Debloat
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">Debloat Windows</h1>
            <p className="text-[13px] text-text-tertiary mt-1.5 leading-relaxed">Remove unwanted Windows apps, features, and telemetry</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="notice-banner error">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-text-tertiary hover:text-text"><X size={14} /></button>
        </div>
      )}

      {doneMsg && (
        <div className="flex items-start gap-3 p-5 rounded-2xl bg-green-bg border border-green/15">
          <CheckCircle2 size={18} className="text-green shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-semibold text-sm text-text">Operation complete</div>
            <div className="text-xs text-green mt-0.5">{doneMsg}</div>
          </div>
          <button onClick={() => setDoneMsg('')} className="ml-auto text-text-tertiary hover:text-text"><X size={14} /></button>
        </div>
      )}

      {(removing || removingAll) && (
        <Card>
          <CardContent className="py-5 space-y-3">
            <div className="flex items-center gap-3">
              <Loader size={18} className="animate-spin text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">
                  {removingAll ? `Removing ${selectedIds.size} item(s)...` : 'Removing...'}
                </div>
                <div className="text-xs text-text-tertiary">{progressLabel || 'Please wait...'}</div>
              </div>
              <span className="text-sm font-semibold text-accent">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="gradient"
          size="sm"
          onClick={handleRemoveAll}
          disabled={selectedIds.size === 0 || removingAll || removing !== null}
        >
          <Trash2 size={14} />
          Remove All Selected ({selectedIds.size})
        </Button>
        <Button variant="secondary" size="sm" onClick={refresh} disabled={loading || removing !== null || removingAll}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
        <Badge variant="outline">{installed} of {total} items detected</Badge>
      </div>

      <Card className="p-0 overflow-hidden">
        <CardHeader className="mb-0 pb-0 flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trash2 size={18} className="text-red" /> Installed Bloatware
          </CardTitle>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-text-tertiary">Select all</span>
            <Switch checked={allSelected} onCheckedChange={toggleSelectAll} />
          </label>
        </CardHeader>
        <Separator />
        {loading ? (
          <div className="loading-state">
            <Loader size={20} className="animate-spin" />
            <span>Scanning for bloatware...</span>
          </div>
        ) : installedItems.length === 0 ? (
          <div className="text-center py-12 text-sm text-text-tertiary">
            No installed bloatware detected.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {installedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 rounded-2xl mx-2 my-1 bg-surface-secondary/50 hover:bg-surface-hover transition-all duration-200 border border-white/[0.03]"
              >
                <Switch
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => toggleSelect(item.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">{item.name}</span>
                    {item.category && <Badge variant="purple" className="text-[10px] py-0">{item.category}</Badge>}
                    {item.risk && (
                      <Badge variant={RISK_COLORS[item.risk] || 'default'} className="text-[10px] py-0">
                        {item.risk} risk
                      </Badge>
                    )}
                    {item.status && (
                      <Badge variant={item.status === 'removable' ? 'teal' : 'default'} className="text-[10px] py-0">
                        {item.status}
                      </Badge>
                    )}
                  </div>
                  {item.desc && (
                    <div className="text-xs text-text-tertiary mt-1 leading-relaxed">{item.desc}</div>
                  )}
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleRemove(item)}
                  disabled={removing === item.id || removingAll}
                  className="shrink-0"
                >
                  {removing === item.id ? (
                    <><Loader size={13} className="animate-spin" /> Removing</>
                  ) : (
                    <><Trash2 size={13} /> Remove</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
