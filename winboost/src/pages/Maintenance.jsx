import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Database, Globe, HardDrive, Loader, LockKeyhole, Monitor, Play, RefreshCw, RotateCcw, ShieldCheck, Wrench, Zap } from 'lucide-react'
import { listMaintenanceTasks, runAllMaintenanceTasks, runMaintenanceTask } from '../lib/api'

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
    <div className="space-y-5 anim-fade-up">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-bg text-orange">
            <Wrench size={23} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent uppercase tracking-[0.15em] mb-1.5">
              <ShieldCheck size={12} /> Microsoft system tools
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">Maintenance Lab</h1>
            <p className="text-[12px] text-text-tertiary mt-1">Run genuine Windows diagnostics and repairs with clear elevation, restart and result states.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 py-2 px-5 rounded-[10px] bg-surface-secondary hover:bg-surface-hover border border-border text-text-secondary text-[13px] font-semibold disabled:opacity-50" onClick={() => setResults(new Map())}>
          <RefreshCw size={13} /> Clear results
        </button>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="rounded-[14px] bg-surface border border-border p-5 flex items-center justify-between gap-4">
        <div>
          <strong className="text-[14px] font-semibold">{selected.size} selected</strong>
          <span className="text-[12px] text-text-tertiary ml-2">Recommended cache tools are selected by default. Advanced repairs stay opt-in.</span>
        </div>
        <button className="flex items-center gap-2 py-2 px-5 rounded-[10px] bg-accent text-black font-semibold text-[13px] hover:opacity-90 disabled:opacity-50" onClick={runSelected} disabled={batch || !selected.size}>
          {batch ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}Run Selected
        </button>
      </div>

      {running && (
        <div className="rounded-[14px] bg-surface border border-border p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Loader size={17} className="animate-spin text-accent" />
            <span className="flex-1">
              <strong className="text-[13px] font-semibold">{tasks.find(item => item.id === running)?.label}</strong>
              <small className="text-[11px] text-text-tertiary ml-2">{stage}</small>
            </span>
            <b className="text-[14px] text-accent">{progress}%</b>
          </div>
          <div className="h-1 rounded-sm bg-surface-secondary overflow-hidden">
            <div className="h-full rounded-sm bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tasks.map(task => {
          const Icon = icons[task.cat] || Wrench
          const result = results.get(task.id)
          return (
            <article key={task.id} className={`rounded-[14px] bg-surface border p-5 ${result?.success ? 'border-green' : result ? 'border-red' : 'border-border'}`}>
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
                  {task.admin && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-bg text-purple flex items-center gap-1"><LockKeyhole size={10} /> UAC</span>}
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${task.risk === 'Medium' ? 'bg-orange-bg text-orange' : 'bg-green-bg text-green'}`}>{task.risk}</span>
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
              <button
                className="flex items-center gap-2 py-2 px-5 rounded-[10px] bg-surface-secondary hover:bg-surface-hover border border-border text-text-secondary text-[13px] font-semibold disabled:opacity-50 w-full justify-center"
                onClick={() => runOne(task.id)}
                disabled={Boolean(running)}
              >
                {running === task.id ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}Run
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
