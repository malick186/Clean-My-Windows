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
    <div className="anim-fade-up space-y-6">
      <div className="page-hero compact-hero">
        <div className="page-hero-icon green"><Wrench size={23} /></div>
        <div><span className="eyebrow"><ShieldCheck size={12} /> Microsoft system tools</span><h1>Maintenance Lab</h1><p>Run genuine Windows diagnostics and repairs with clear elevation, restart and result states.</p></div>
        <button className="btn btn-secondary btn-sm hero-action" onClick={() => setResults(new Map())}><RefreshCw size={13} /> Clear results</button>
      </div>

      {error && <div className="notice-banner error"><AlertTriangle size={17} />{error}</div>}

      <div className="maintenance-toolbar card">
        <div><strong>{selected.size} selected</strong><span>Recommended cache tools are selected by default. Advanced repairs stay opt-in.</span></div>
        <button className="btn btn-primary" onClick={runSelected} disabled={batch || !selected.size}>{batch ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}Run Selected</button>
      </div>

      {running && <div className="task-progress-card"><div><Loader size={17} className="animate-spin" /><span><strong>{tasks.find(item => item.id === running)?.label}</strong><small>{stage}</small></span><b>{progress}%</b></div><div className="progress"><div className="progress-fill" style={{ width: `${progress}%` }} /></div></div>}

      <div className="maintenance-grid">
        {tasks.map(task => {
          const Icon = icons[task.cat] || Wrench
          const result = results.get(task.id)
          return (
            <article key={task.id} className={`maintenance-card ${result?.success ? 'complete' : result ? 'failed' : ''}`}>
              <div className="maintenance-card-top">
                <button className={`check-orb ${selected.has(task.id) ? 'checked' : ''}`} onClick={() => toggle(task.id)} aria-label={`Select ${task.label}`}>{selected.has(task.id) && <CheckCircle size={15} />}</button>
                <span className="tool-icon"><Icon size={19} /></span>
                <div className="task-badges">{task.admin && <span className="badge badge-purple"><LockKeyhole size={10} /> UAC</span>}<span className={`badge ${task.risk === 'Medium' ? 'badge-orange' : 'badge-green'}`}>{task.risk}</span></div>
              </div>
              <h3>{task.label}</h3><p>{task.desc}</p>
              {task.restart && <small className="restart-note"><RotateCcw size={11} /> Restart required</small>}
              {result && <div className={`task-result ${result.success ? 'success' : 'error'}`}>{result.success ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}<span>{result.success ? (result.output || 'Completed').slice(0, 120) : result.error}</span></div>}
              <button className="btn btn-secondary btn-sm" onClick={() => runOne(task.id)} disabled={Boolean(running)}>{running === task.id ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}Run</button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
