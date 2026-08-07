import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Database, Globe, HardDrive, Loader, LockKeyhole, Monitor, Play, RefreshCw, RotateCcw, ShieldCheck, Wrench, Zap } from 'lucide-react'
import { listMaintenanceTasks, runAllMaintenanceTasks, runMaintenanceTask } from '../lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

const icons = { Network: Globe, Disk: HardDrive, System: Database, Cleanup: Zap, Apps: Monitor }

export default function Maintenance() {
  const [tasks, setTasks] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [running, setRunning] = useState(null)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [results, setResults] = useState(new Map())
  const [batch, setBatch] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listMaintenanceTasks().then(items => {
      setTasks(items); setSelected(new Set(items.filter(item => item.recommended).map(item => item.id)))
    }).catch(err => setError(err.message))
  }, [])

  const toggle = id => setSelected(previous => {
    const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next
  })

  const runOne = async id => {
    setRunning(id); setProgress(0); setError('')
    try {
      const result = await runMaintenanceTask(id, data => { setProgress(data.percent || 0); if (data.stage) setStage(data.stage) })
      setResults(previous => new Map(previous).set(id, result))
      if (!result.success) setError(result.error || 'The maintenance task failed.')
    } catch (err) { setError(err.message) }
    finally { setRunning(null) }
  }

  const runSelected = async () => {
    setBatch(true); setError('')
    try {
      const response = await runAllMaintenanceTasks([...selected], data => {
        setRunning(data.taskId); setProgress(data.percent || 0); if (data.stage) setStage(data.stage)
      })
      const next = new Map(results)
      for (const result of response.results || []) next.set(result.taskId, result)
      setResults(next)
      const failures = (response.results || []).filter(result => !result.success)
      if (failures.length) setError(`${failures.length} selected task${failures.length === 1 ? '' : 's'} could not complete. Open each result for details.`)
    } catch (err) { setError(err.message) }
    finally { setRunning(null); setBatch(false) }
  }

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-orange-bg text-orange shadow-sm">
            <Wrench size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-[0.15em] mb-2">
              <ShieldCheck size={11} /> Microsoft system tools
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">Maintenance Lab</h1>
            <p className="text-[13px] text-text-tertiary mt-1.5 leading-relaxed">Run genuine Windows diagnostics and repairs with clear elevation, restart and result states.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setResults(new Map())}>
          <RefreshCw size={13} /> Clear results
        </Button>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <strong className="text-[14px] font-semibold">{selected.size} selected</strong>
            <span className="text-[12px] text-text-tertiary ml-2">Recommended cache tools are selected by default. Advanced repairs stay opt-in.</span>
          </div>
          <Button onClick={runSelected} disabled={batch || !selected.size}>
            {batch ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}Run Selected
          </Button>
        </CardContent>
      </Card>

      {running && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-3 mb-3">
              <Loader size={17} className="animate-spin text-accent" />
              <span className="flex-1">
                <strong className="text-[13px] font-semibold">{tasks.find(item => item.id === running)?.label}</strong>
                <small className="text-[11px] text-text-tertiary ml-2">{stage}</small>
              </span>
              <b className="text-[14px] text-accent">{progress}%</b>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tasks.map(task => {
          const Icon = icons[task.cat] || Wrench
          const result = results.get(task.id)
          return (
            <Card key={task.id} className={result?.success ? 'border-green' : result ? 'border-red' : ''}>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <button
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selected.has(task.id) ? 'border-accent bg-accent text-black' : 'border-border bg-surface-secondary'}`}
                    onClick={() => toggle(task.id)}
                    aria-label={`Select ${task.label}`}
                  >
                    {selected.has(task.id) && <CheckCircle size={15} />}
                  </button>
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-bg text-orange">
                    <Icon size={19} />
                  </span>
                  <div className="flex items-center gap-1.5">
                    {task.admin && <Badge variant="purple"><LockKeyhole size={10} /> UAC</Badge>}
                    <Badge variant={task.risk === 'Medium' ? 'warning' : 'success'} className="uppercase text-[10px]">{task.risk}</Badge>
                  </div>
                </div>
                <h3 className="text-[14px] font-semibold mb-1">{task.label}</h3>
                <p className="text-[12px] text-text-tertiary mb-3">{task.desc}</p>
                {task.restart && (
                  <small className="flex items-center gap-1 text-[11px] text-orange mb-3">
                    <RotateCcw size={11} /> Restart required
                  </small>
                )}
                {result && (
                  <div className={`flex items-start gap-2 p-3 rounded-[8px] text-[12px] mb-3 ${result.success ? 'bg-green-bg text-green border border-green/20' : 'bg-red-bg text-red border border-red/20'}`}>
                    {result.success ? <CheckCircle size={13} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />}
                    <span>{result.success ? (result.output || 'Completed').slice(0, 120) : result.error}</span>
                  </div>
                )}
                <Button variant="secondary" size="sm" className="w-full" onClick={() => runOne(task.id)} disabled={Boolean(running)}>
                  {running === task.id ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}Run
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
