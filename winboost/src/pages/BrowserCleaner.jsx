import { useState, useEffect, useCallback } from 'react'
import {
  Globe, Trash2, Database, Cookie, History, RefreshCw,
  Loader, AlertTriangle, CheckCircle,
} from 'lucide-react'
import { scanBrowsers, cleanBrowser } from '../lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '../utils/toast.jsx'

const DATA_TYPES = [
  { id: 'cache', label: 'Cache', color: 'warning' },
  { id: 'cookies', label: 'Cookies', color: 'teal' },
  { id: 'history', label: 'History', color: 'purple' },
]

const dataTypeIcons = {
  cache: Database,
  cookies: Cookie,
  history: History,
}

const browserColors = {
  chrome: 'sparkle-success',
  firefox: 'sparkle-warning',
  edge: 'sparkle-primary',
  opera: 'sparkle-danger',
  brave: 'sparkle-warning',
  vivaldi: 'sparkle-pink',
}

function formatBytes(bytes) {
  if (bytes == null || bytes === 0) return '0 B'
  if (bytes >= 1099511627776) return `${(bytes / 1099511627776).toFixed(2)} TB`
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export default function BrowserCleaner() {
  const toast = useToast()
  const [browsers, setBrowsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selections, setSelections] = useState({})
  const [cleaning, setCleaning] = useState({})
  const [freedSpace, setFreedSpace] = useState({})

  const fetchBrowsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await scanBrowsers()
      const browserList = data?.browsers || []
      setBrowsers(browserList)
      const defaultSelections = {}
      browserList.forEach((b) => {
        defaultSelections[b.name] = DATA_TYPES.reduce((acc, dt) => {
          acc[dt.id] = true
          return acc
        }, {})
      })
      setSelections(defaultSelections)
    } catch (err) {
      setError(err.message || 'Failed to load browser data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBrowsers()
  }, [fetchBrowsers])

  const toggleDataType = (browserName, dataType) => {
    setSelections((prev) => ({
      ...prev,
      [browserName]: {
        ...(prev[browserName] || {}),
        [dataType]: !(prev[browserName]?.[dataType] ?? true),
      },
    }))
  }

  const handleClean = async (browser) => {
    const sel = selections[browser.name] || {}
    const types = DATA_TYPES.filter((dt) => sel[dt.id]).map((dt) => dt.id)
    if (types.length === 0) {
      toast.add('Please select at least one data type to clean', 'warning')
      return
    }
    setCleaning((prev) => ({ ...prev, [browser.name]: true }))
    try {
      const result = await cleanBrowser(browser.name, types)
      if (result?.success) {
        const freed = result.freed || 0
        setFreedSpace((prev) => ({ ...prev, [browser.name]: (prev[browser.name] || 0) + freed }))
        toast.add(`Cleaned ${formatBytes(freed)} from ${browser.name}`, 'success')
        fetchBrowsers()
      } else {
        toast.add(result?.error || `Failed to clean ${browser.name}`, 'error')
      }
    } catch (err) {
      toast.add(err.message || `Failed to clean ${browser.name}`, 'error')
    } finally {
      setCleaning((prev) => ({ ...prev, [browser.name]: false }))
    }
  }

  const getBrowserColor = (name) => {
    const key = name?.toLowerCase() || ''
    return browserColors[key] || 'sparkle-primary'
  }

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-teal/10 text-sparkle-teal shadow-sm">
            <Globe size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.08em] mb-2">
              <Globe size={11} /> Privacy & Cleanup
            </div>
            <h1 className="text-2xl font-bold text-sparkle-text tracking-tight">Browser Cleaner</h1>
            <p className="text-sm text-sparkle-text-secondary mt-1.5">Clean cache, cookies, and history from installed browsers</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchBrowsers} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="notice-banner error">
          <AlertTriangle size={17} />{error}
          <Button variant="outline" size="sm" onClick={fetchBrowsers}>Retry</Button>
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner" />
          <span>Scanning for browsers...</span>
        </div>
      ) : browsers.length === 0 ? (
        <Card className="p-8">
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-sparkle-teal/10 text-sparkle-teal flex items-center justify-center mx-auto mb-4">
              <Globe size={28} />
            </div>
            <div className="text-xl font-bold mb-1 text-sparkle-text">No Supported Browsers Detected</div>
            <div className="text-sm text-sparkle-text-secondary mb-4 text-center max-w-md">
              We could not find any supported browsers on this system. Supported browsers include Chrome, Firefox, Edge, Opera, Brave, and Vivaldi.
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {browsers.map((browser) => {
            const sel = selections[browser.name] || {}
            const isCleaning = cleaning[browser.name]
            const freed = freedSpace[browser.name] || 0
            const browserColor = getBrowserColor(browser.name)

            return (
              <Card key={browser.name}>
                <CardHeader>
                  <div className={`flex items-center justify-center w-9 h-9 rounded-xl bg-${browserColor}/10 text-${browserColor} shrink-0`}>
                    <Chrome size={18} />
                  </div>
                  <div className="flex-1">
                    <CardTitle>
                      {browser.name} <span className="text-sparkle-text-secondary text-sm font-normal">{browser.profile || ''}</span>
                    </CardTitle>
                    {browser.path && (
                      <CardDescription>{browser.path}</CardDescription>
                    )}
                  </div>
                  {freed > 0 && (
                    <Badge variant="success">{formatBytes(freed)} freed</Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-3">
                    {DATA_TYPES.map((dt) => {
                      const Icon = dataTypeIcons[dt.id]
                      const value = browser[dt.id] != null ? formatBytes(browser[dt.id]) : 'N/A'
                      return (
                        <div
                          key={dt.id}
                          className="p-3 rounded-xl bg-sparkle-accent/50 border border-sparkle-border cursor-pointer select-none"
                          onClick={() => toggleDataType(browser.name, dt.id)}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <Icon size={14} className={`text-sparkle-${dt.color}`} />
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded accent-sparkle-teal"
                              checked={sel[dt.id] ?? true}
                              readOnly
                            />
                          </div>
                          <div className="text-xs text-sparkle-text-muted">{dt.label}</div>
                          <div className="text-sm font-semibold text-sparkle-text mt-0.5">{value}</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Clean Button */}
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleClean(browser)}
                    disabled={isCleaning || Object.values(sel).every((v) => !v)}
                  >
                    {isCleaning ? (
                      <Loader size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    {isCleaning ? 'Cleaning...' : 'Clean Selected'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Clean Result Summary */}
      {Object.values(freedSpace).some((v) => v > 0) && (
        <Card>
          <div className="flex items-center gap-3 p-5">
            <div className="w-10 h-10 rounded-xl bg-sparkle-teal/10 text-sparkle-teal flex items-center justify-center shrink-0">
              <CheckCircle size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold text-sparkle-text">Cleanup Summary</div>
              <div className="text-xs text-sparkle-text-secondary mt-0.5">
                {Object.entries(freedSpace)
                  .filter(([, v]) => v > 0)
                  .map(([name, bytes]) => `${name}: ${formatBytes(bytes)}`)
                  .join('  |  ') || 'No data cleaned yet'}
              </div>
            </div>
            <Badge variant="success" className="ml-auto">
              {formatBytes(Object.values(freedSpace).reduce((a, b) => a + b, 0))} total
            </Badge>
          </div>
        </Card>
      )}
    </div>
  )
}
