import { useState, useEffect, useCallback } from 'react'
import { Wifi, Play, Globe, RefreshCw, CheckCircle2, AlertTriangle, Loader, Zap } from 'lucide-react'
import { getNetworkStatus, setDNS, optimizeNetwork, resetNetwork } from '../lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const DNS_PROVIDERS = [
  {
    id: 'google',
    name: 'Google',
    primary: '8.8.8.8',
    secondary: '8.8.4.4',
    color: 'default',
    desc: 'Reliable global DNS with strong uptime',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    primary: '1.1.1.1',
    secondary: '1.0.0.1',
    color: 'teal',
    desc: 'Focus on speed and privacy, no query logging',
  },
  {
    id: 'opendns',
    name: 'OpenDNS',
    primary: '208.67.222.222',
    secondary: '208.67.220.220',
    color: 'purple',
    desc: 'Cisco-owned with phishing protection and content filtering',
  },
  {
    id: 'quad9',
    name: 'Quad9',
    primary: '9.9.9.9',
    secondary: '149.112.112.112',
    color: 'success',
    desc: 'Security-focused, blocks known malicious domains',
  },
  {
    id: 'adguard',
    name: 'AdGuard',
    primary: '94.140.14.14',
    secondary: '94.140.15.15',
    color: 'warning',
    desc: 'Blocks ads, trackers, and phishing at DNS level',
  },
]

const badgedColor = (color) => {
  const map = { default: 'default', teal: 'teal', purple: 'purple', success: 'success', warning: 'warning' }
  return map[color] || 'default'
}

export default function NetworkOptimizer() {
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState('')
  const [selectedDns, setSelectedDns] = useState(null)
  const [dnsLoading, setDnsLoading] = useState(false)
  const [dnsResult, setDnsResult] = useState(null)
  const [dnsError, setDnsError] = useState('')

  const [optLoading, setOptLoading] = useState(false)
  const [optResult, setOptResult] = useState(null)
  const [optError, setOptError] = useState('')

  const [resetLoading, setResetLoading] = useState(false)
  const [resetResult, setResetResult] = useState(null)
  const [resetError, setResetError] = useState('')

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true); setStatusError('')
    try {
      const data = await getNetworkStatus()
      setStatus(data)
      setSelectedDns(data.currentProvider || null)
    } catch (err) { setStatusError(err.message) }
    finally { setStatusLoading(false) }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleSetDns = useCallback(async () => {
    if (!selectedDns) return
    setDnsLoading(true); setDnsResult(null); setDnsError('')
    try {
      const result = await setDNS(selectedDns)
      setDnsResult(result)
    } catch (err) { setDnsError(err.message) }
    finally { setDnsLoading(false) }
  }, [selectedDns])

  const handleOptimize = useCallback(async () => {
    setOptLoading(true); setOptResult(null); setOptError('')
    try {
      const result = await optimizeNetwork()
      setOptResult(result)
    } catch (err) { setOptError(err.message) }
    finally { setOptLoading(false) }
  }, [])

  const handleReset = useCallback(async () => {
    setResetLoading(true); setResetResult(null); setResetError('')
    try {
      const result = await resetNetwork()
      setResetResult(result)
    } catch (err) { setResetError(err.message) }
    finally { setResetLoading(false) }
  }, [])

  const currentProviderLabel = DNS_PROVIDERS.find(p => p.id === status?.currentProvider)?.name || 'Unknown'
  const currentProviderDns = status?.currentDns || []

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-bg text-teal shadow-sm">
            <Wifi size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-[0.15em] mb-2">
              <Globe size={11} /> Internet & DNS
            </div>
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em]">Network Optimizer</h1>
            <p className="text-[13px] text-text-tertiary mt-1.5 leading-relaxed">Improve internet speed and configure DNS settings</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchStatus} disabled={statusLoading}>
          <RefreshCw size={13} className={statusLoading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {statusError && <div className="notice-banner error"><AlertTriangle size={17} />{statusError}</div>}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal-bg text-teal shrink-0">
            <Globe size={18} />
          </div>
          <div className="flex-1">
            <CardTitle>DNS Configuration</CardTitle>
            <CardDescription>
              {statusLoading
                ? 'Loading network status...'
                : `Current: ${currentProviderLabel}${currentProviderDns.length ? ` (${currentProviderDns.join(', ')})` : ''}`}
            </CardDescription>
          </div>
          {status?.currentProvider && (
            <Badge variant="teal">{status.currentProvider}</Badge>
          )}
        </CardHeader>
        <CardContent>
          {dnsError && <div className="notice-banner error mb-4"><AlertTriangle size={15} />{dnsError}</div>}
          {dnsResult && (
            <div className="notice-banner success mb-4">
              <CheckCircle2 size={15} /> DNS set to {dnsResult?.provider || selectedDns} successfully
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DNS_PROVIDERS.map(provider => {
              const isCurrent = status?.currentProvider === provider.id
              const isSelected = selectedDns === provider.id
              return (
                <button
                  key={provider.id}
                  onClick={() => setSelectedDns(provider.id)}
                  className={`text-left p-4 rounded-2xl transition-all duration-200 border cursor-pointer ${
                    isCurrent
                      ? 'ring-1 ring-teal/30 bg-teal/[0.04] border-teal/20'
                      : isSelected
                        ? 'ring-1 ring-accent/20 bg-surface-hover border-white/[0.08]'
                        : 'border-white/[0.04] bg-surface-secondary/50 hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-semibold">{provider.name}</span>
                    <Badge variant={badgedColor(provider.color)}>
                      {isCurrent ? 'Active' : isSelected ? 'Selected' : ''}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-text-tertiary font-mono mb-1.5">
                    <div>{provider.primary}</div>
                    <div>{provider.secondary}</div>
                  </div>
                  <div className="text-[10px] text-text-tertiary leading-relaxed">{provider.desc}</div>
                </button>
              )
            })}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="gradient"
            className="w-full"
            onClick={handleSetDns}
            disabled={dnsLoading || !selectedDns || selectedDns === status?.currentProvider}
          >
            {dnsLoading ? <Loader size={14} className="animate-spin" /> : <Globe size={14} />}
            {dnsLoading ? 'Applying...' : 'Apply DNS'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal-bg text-teal shrink-0">
            <Zap size={18} />
          </div>
          <div className="flex-1">
            <CardTitle>Network Optimization</CardTitle>
            <CardDescription>Fine-tune TCP/IP stack settings for better performance</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {optError && <div className="notice-banner error"><AlertTriangle size={15} />{optError}</div>}
          {optResult && (
            <div className="notice-banner success">
              <CheckCircle2 size={15} /> {optResult.message || 'Network optimized successfully'}
            </div>
          )}
          {resetError && <div className="notice-banner error"><AlertTriangle size={15} />{resetError}</div>}
          {resetResult && (
            <div className="notice-banner success">
              <CheckCircle2 size={15} /> {resetResult.message || 'Network reset successfully'}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-surface-secondary/50 border border-white/[0.04]">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-teal" />
                <span className="text-[13px] font-semibold">Optimize Network</span>
              </div>
              <p className="text-[11px] text-text-tertiary mb-4 leading-relaxed">
                Applies TCP auto-tuning, RSS, window scaling, and other performance tweaks to maximize throughput.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={handleOptimize}
                disabled={optLoading || resetLoading}
              >
                {optLoading ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
                {optLoading ? 'Optimizing...' : 'Optimize Network'}
              </Button>
            </div>

            <div className="p-4 rounded-2xl bg-surface-secondary/50 border border-white/[0.04]">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw size={16} className="text-orange" />
                <span className="text-[13px] font-semibold">Reset Network</span>
              </div>
              <p className="text-[11px] text-text-tertiary mb-4 leading-relaxed">
                Flushes DNS cache, resets Winsock catalog, and resets the TCP/IP stack to default settings.
              </p>
              <Button
                variant="danger"
                size="sm"
                className="w-full"
                onClick={handleReset}
                disabled={resetLoading || optLoading}
              >
                {resetLoading ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {resetLoading ? 'Resetting...' : 'Reset Network'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
