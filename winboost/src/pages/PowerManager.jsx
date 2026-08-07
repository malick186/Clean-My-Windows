import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Loader, RefreshCw, Zap } from 'lucide-react'
import { activateUltimatePerformance, listPowerPlans, setPowerPlan } from '../lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function PowerManager() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)

  const refresh = async () => {
    setLoading(true)
    setNotice(null)
    try {
      const data = await listPowerPlans()
      setPlans(data.plans || [])
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const activate = async (planId) => {
    setBusy(planId)
    setNotice(null)
    try {
      await setPowerPlan(planId)
      await refresh()
      setNotice({ type: 'success', text: 'Power plan activated successfully.' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setBusy(null)
    }
  }

  const enableUltimate = async () => {
    setBusy('ultimate')
    setNotice(null)
    try {
      const result = await activateUltimatePerformance()
      setNotice({ type: 'success', text: result.message || 'Ultimate Performance plan has been unlocked.' })
      await refresh()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-warning/10 text-sparkle-warning">
            <Zap size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.08em] mb-2">
              <Zap size={11} /> Power Management
            </div>
            <h1 className="text-2xl font-bold text-sparkle-text tracking-tight">Power Manager</h1>
            <p className="text-sm text-sparkle-text-secondary mt-1.5">Manage Windows power plans for performance or battery life</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} disabled={loading || Boolean(busy)}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {notice && (
        <div className={`notice-banner ${notice.type}`}>
          {notice.type === 'success' ? <CheckCircle size={17} /> : <AlertTriangle size={17} />}
          {notice.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Power Plans</CardTitle>
            <CardDescription>Select a power plan to apply to your system</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="loading-state"><Loader className="animate-spin" size={20} />Reading power plans...</div>
          ) : plans.length === 0 ? (
            <div className="loading-state text-sparkle-text-muted">
              <Zap size={20} /> No power plans found. Ensure you have the required permissions.
            </div>
          ) : (
            <div className="space-y-2">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`flex items-center gap-4 p-4 rounded-xl bg-sparkle-accent/50 hover:bg-sparkle-accent transition-all duration-200 border ${
                    plan.active ? 'border-sparkle-success/30' : 'border-sparkle-border'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-sparkle-text">{plan.name}</span>
                      {plan.active && <Badge variant="success">Active</Badge>}
                    </div>
                  </div>
                  <Button
                    variant={plan.active ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={plan.active || busy === plan.id}
                    onClick={() => activate(plan.id)}
                  >
                    {busy === plan.id ? <Loader size={13} className="animate-spin" /> : null}
                    {plan.active ? 'Active' : 'Activate'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Ultimate Performance</CardTitle>
            <CardDescription>Unlock the hidden Ultimate Performance power plan for maximum system responsiveness</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Button
              variant="primary"
              onClick={enableUltimate}
              disabled={busy === 'ultimate'}
            >
              {busy === 'ultimate' ? <Loader size={15} className="animate-spin" /> : <Zap size={15} />}
              Activate Ultimate Performance
            </Button>
            <p className="text-xs text-sparkle-warning flex items-center gap-1.5">
              <AlertTriangle size={12} />
              May increase power consumption. Not recommended for laptops on battery.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {[
          { name: 'High Performance', desc: 'Best for gaming and demanding tasks', color: 'sparkle-danger' },
          { name: 'Balanced', desc: '(Recommended) Auto-adjusts for performance and energy', color: 'sparkle-success' },
          { name: 'Power Saver', desc: 'Extends battery life, reduces performance', color: 'sparkle-teal' },
        ].map((preset) => (
          <Card key={preset.name} className="p-5">
            <CardContent className="flex flex-col items-center gap-2 text-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full bg-${preset.color}/10 text-${preset.color}`}>
                <Zap size={20} />
              </div>
              <span className="text-sm font-semibold text-sparkle-text">{preset.name}</span>
              <span className="text-xs text-sparkle-text-muted">{preset.desc}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
