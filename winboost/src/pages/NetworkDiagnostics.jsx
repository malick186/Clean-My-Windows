import { useState } from 'react'
import { Activity, AlertTriangle, ArrowDown, ArrowUp, CheckCircle, Clock, Globe, Loader, Navigation, Server, Wifi } from 'lucide-react'
import { pingHost, runSpeedtest, tracerouteHost } from '../lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const TABS = ['Ping Test', 'Traceroute', 'Speed Test']

export default function NetworkDiagnostics() {
  const [tab, setTab] = useState(0)
  const [host, setHost] = useState('')

  const [pingLoading, setPingLoading] = useState(false)
  const [pingResult, setPingResult] = useState(null)
  const [pingError, setPingError] = useState(null)

  const [traceLoading, setTraceLoading] = useState(false)
  const [traceResult, setTraceResult] = useState(null)
  const [traceError, setTraceError] = useState(null)

  const [speedLoading, setSpeedLoading] = useState(false)
  const [speedResult, setSpeedResult] = useState(null)
  const [speedError, setSpeedError] = useState(null)

  const runPing = async () => {
    setPingLoading(true)
    setPingError(null)
    setPingResult(null)
    try {
      const result = await pingHost(host || '8.8.8.8')
      setPingResult(result)
    } catch (error) {
      setPingError(error.message)
    } finally {
      setPingLoading(false)
    }
  }

  const runTrace = async () => {
    setTraceLoading(true)
    setTraceError(null)
    setTraceResult(null)
    try {
      const result = await tracerouteHost(host || '8.8.8.8')
      setTraceResult(result)
    } catch (error) {
      setTraceError(error.message)
    } finally {
      setTraceLoading(false)
    }
  }

  const startSpeedtest = async () => {
    setSpeedLoading(true)
    setSpeedError(null)
    setSpeedResult(null)
    try {
      const result = await runSpeedtest()
      setSpeedResult(result)
    } catch (error) {
      setSpeedError(error.message)
    } finally {
      setSpeedLoading(false)
    }
  }

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-teal/10 text-sparkle-teal">
            <Activity size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.08em] mb-2">
              <Wifi size={11} /> Network
            </div>
            <h1 className="text-2xl font-bold text-sparkle-text tracking-tight">Network Diagnostics</h1>
            <p className="text-sm text-sparkle-text-secondary mt-1.5">Test your network connection with ping, traceroute, and speed tests</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-sparkle-accent/30 w-fit">
        {TABS.map((label, idx) => (
          <button
            key={label}
            onClick={() => setTab(idx)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
              tab === idx
                ? 'bg-sparkle-primary text-white shadow-sm'
                : 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-accent/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Ping Test</CardTitle>
              <CardDescription>Measure latency and packet loss to a remote host</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex items-center gap-2 flex-1 bg-sparkle-accent/30 rounded-lg px-3 py-2 border border-sparkle-border">
                <Globe size={15} className="text-sparkle-text-secondary flex-shrink-0" />
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="8.8.8.8"
                  className="flex-1 bg-transparent text-sm text-sparkle-text outline-none placeholder:text-sparkle-text-muted"
                />
              </div>
              <Button onClick={runPing} disabled={pingLoading}>
                {pingLoading ? <Loader size={15} className="animate-spin" /> : <Activity size={15} />}
                Ping
              </Button>
            </div>

            {pingError && (
              <div className="notice-banner error">
                <AlertTriangle size={17} />{pingError}
              </div>
            )}

            {pingResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { icon: Clock, label: 'Avg', value: pingResult.avg, color: 'sparkle-primary' },
                    { icon: ArrowDown, label: 'Min', value: pingResult.min, color: 'sparkle-success' },
                    { icon: ArrowUp, label: 'Max', value: pingResult.max, color: 'sparkle-warning' },
                    { icon: AlertTriangle, label: 'Packet Loss', value: pingResult.loss, color: 'sparkle-danger' },
                  ].map((stat) => (
                    <div key={stat.label} className={`flex flex-col items-center gap-1 p-3 rounded-xl bg-${stat.color}/5 border border-${stat.color}/10`}>
                      <stat.icon size={16} className={`text-${stat.color}`} />
                      <span className="text-sm font-bold text-sparkle-text">{stat.value}</span>
                      <span className="text-[10px] text-sparkle-text-muted uppercase">{stat.label}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-sparkle-border overflow-hidden">
                  <div className="px-3 py-2 bg-sparkle-accent/20 text-[11px] font-semibold text-sparkle-text-secondary uppercase tracking-wider">
                    Individual Responses ({pingResult.results?.length || 0})
                  </div>
                  <div className="divide-y divide-sparkle-border">
                    {pingResult.results?.map((ms, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs">
                        <span className="text-sparkle-text-muted">#{idx + 1}</span>
                        <span className="text-sparkle-text font-mono">{ms} ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Traceroute</CardTitle>
              <CardDescription>Trace the network path to a remote host</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex items-center gap-2 flex-1 bg-sparkle-accent/30 rounded-lg px-3 py-2 border border-sparkle-border">
                <Globe size={15} className="text-sparkle-text-secondary flex-shrink-0" />
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="8.8.8.8"
                  className="flex-1 bg-transparent text-sm text-sparkle-text outline-none placeholder:text-sparkle-text-muted"
                />
              </div>
              <Button onClick={runTrace} disabled={traceLoading}>
                {traceLoading ? <Loader size={15} className="animate-spin" /> : <Navigation size={15} />}
                Trace Route
              </Button>
            </div>

            {traceError && (
              <div className="notice-banner error">
                <AlertTriangle size={17} />{traceError}
              </div>
            )}

            {traceLoading && (
              <div className="loading-state"><Loader className="animate-spin" size={20} />Tracing route. This may take a moment...</div>
            )}

            {traceResult && traceResult.hops?.length > 0 && (
              <div className="rounded-lg border border-sparkle-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-sparkle-accent/20">
                      <th className="text-left px-3 py-2 text-sparkle-text-secondary font-semibold uppercase tracking-wider">Hop</th>
                      <th className="text-left px-3 py-2 text-sparkle-text-secondary font-semibold uppercase tracking-wider">IP Address</th>
                      <th className="text-right px-3 py-2 text-sparkle-text-secondary font-semibold uppercase tracking-wider">Times (ms)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sparkle-border">
                    {traceResult.hops.map((hop) => (
                      <tr key={hop.hop} className="hover:bg-sparkle-accent/30 transition-colors">
                        <td className="px-3 py-2 text-sparkle-text-muted font-mono">{hop.hop}</td>
                        <td className="px-3 py-2 text-sparkle-text font-mono">{hop.ip || '*'}</td>
                        <td className="px-3 py-2 text-right text-sparkle-text font-mono">
                          {hop.times?.join(', ') || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {traceResult && (!traceResult.hops || traceResult.hops.length === 0) && (
              <div className="loading-state text-sparkle-text-muted">
                <Server size={20} /> No hop data returned. The trace may have been blocked.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Speed Test</CardTitle>
              <CardDescription>Measure your internet connection throughput</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center py-6">
              <Button variant="primary" size="lg" onClick={startSpeedtest} disabled={speedLoading}>
                {speedLoading ? <Loader size={18} className="animate-spin" /> : <Activity size={18} />}
                Start Speed Test
              </Button>
            </div>

            {speedError && (
              <div className="notice-banner error">
                <AlertTriangle size={17} />{speedError}
              </div>
            )}

            {speedLoading && (
              <div className="loading-state"><Loader className="animate-spin" size={20} />Running speed test. This may take a moment...</div>
            )}

            {speedResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center gap-1 p-4 rounded-xl bg-sparkle-primary/5 border border-sparkle-primary/10">
                    <Clock size={20} className="text-sparkle-primary" />
                    <span className="text-lg font-bold text-sparkle-text">{speedResult.ping} ms</span>
                    <span className="text-[10px] text-sparkle-text-muted uppercase">Ping</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-4 rounded-xl bg-sparkle-success/5 border border-sparkle-success/10">
                    <ArrowDown size={20} className="text-sparkle-success" />
                    <span className="text-lg font-bold text-sparkle-text">{speedResult.download}</span>
                    <span className="text-[10px] text-sparkle-text-muted uppercase">Download (Mbps)</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-4 rounded-xl bg-sparkle-warning/5 border border-sparkle-warning/10">
                    <ArrowUp size={20} className="text-sparkle-warning" />
                    <span className="text-lg font-bold text-sparkle-text">{speedResult.upload}</span>
                    <span className="text-[10px] text-sparkle-text-muted uppercase">Upload (Mbps)</span>
                  </div>
                </div>
                <Separator />
                <p className="text-xs text-sparkle-text-muted flex items-center gap-1.5">
                  <CheckCircle size={12} />
                  Speed test downloads a small file to measure throughput
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
