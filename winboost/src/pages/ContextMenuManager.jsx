import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Loader, Menu, RefreshCw, ShieldAlert } from 'lucide-react'
import { listContextMenus, removeContextMenu } from '../lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function ContextMenuManager() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)

  const refresh = async () => {
    setLoading(true)
    setNotice(null)
    try {
      const data = await listContextMenus()
      setEntries(data.entries || [])
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const remove = async (entry) => {
    if (!window.confirm(`Remove context menu entry: ${entry?.name || entry?.path}?`)) return
    setBusy(entry.path)
    setNotice(null)
    try {
      await removeContextMenu(entry.path)
      setEntries((prev) => prev.filter((e) => e.path !== entry.path))
      setNotice({ type: 'success', text: `Removed "${entry.name}" from context menu.` })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setBusy(null)
    }
  }

  const hklmEntries = entries.filter((e) => /^HKLM/i.test(e.hive || e.path || ''))
  const hkcuEntries = entries.filter((e) => !/^HKLM/i.test(e.hive || e.path || ''))

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-purple/10 text-sparkle-purple">
            <Menu size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.08em] mb-2">
              <Menu size={11} /> Tools
            </div>
            <h1 className="text-2xl font-bold text-sparkle-text tracking-tight">Context Menu Manager</h1>
            <p className="text-sm text-sparkle-text-secondary mt-1.5">Clean up your right-click menu by removing unwanted entries</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} disabled={loading || Boolean(busy)}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      <div className="notice-banner warning">
        <ShieldAlert size={17} />
        Requires administrator privileges. Changes affect all users if applied to HKLM.
      </div>

      {notice && (
        <div className={`notice-banner ${notice.type}`}>
          {notice.type === 'success' ? <CheckCircle size={17} /> : <AlertTriangle size={17} />}
          {notice.text}
        </div>
      )}

      {loading ? (
        <div className="loading-state"><Loader className="animate-spin" size={20} />Scanning context menu entries...</div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent>
            <div className="loading-state text-sparkle-text-muted">
              <Menu size={20} /> No context menu entries found or no admin access
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {hkcuEntries.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Current User (HKCU)</CardTitle>
                  <CardDescription>Entries that affect only your user account</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {hkcuEntries.map((entry) => (
                    <div
                      key={entry.path || entry.name}
                      className="flex items-center gap-4 p-4 rounded-xl bg-sparkle-accent/50 hover:bg-sparkle-accent transition-all duration-200 border border-sparkle-border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-sparkle-text">{entry.name}</span>
                          <Badge variant="primary">{entry.hive || 'HKCU'}</Badge>
                        </div>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busy === entry.path}
                        onClick={() => remove(entry)}
                      >
                        {busy === entry.path ? <Loader size={13} className="animate-spin" /> : null}
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {hklmEntries.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>All Users (HKLM)</CardTitle>
                  <CardDescription>System-wide entries that affect every user on this machine</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {hklmEntries.map((entry) => (
                    <div
                      key={entry.path || entry.name}
                      className="flex items-center gap-4 p-4 rounded-xl bg-sparkle-accent/50 hover:bg-sparkle-accent transition-all duration-200 border border-sparkle-border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-sparkle-text">{entry.name}</span>
                          <Badge variant="danger">{entry.hive || 'HKLM'}</Badge>
                        </div>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busy === entry.path}
                        onClick={() => remove(entry)}
                      >
                        {busy === entry.path ? <Loader size={13} className="animate-spin" /> : null}
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
