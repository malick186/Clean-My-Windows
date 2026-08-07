import { useState, useCallback } from 'react'
import {
  Files, FolderOpen, Trash2, Search, FileCheck, FolderSearch,
  Loader, AlertTriangle, CheckCircle, ChevronRight,
} from 'lucide-react'
import { scanDuplicates, deleteDuplicates } from '../lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '../utils/toast.jsx'

function formatBytes(bytes) {
  if (bytes == null) return 'N/A'
  if (bytes >= 1099511627776) return `${(bytes / 1099511627776).toFixed(2)} TB`
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export default function DuplicateFinder() {
  const toast = useToast()
  const [path, setPath] = useState('')
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSelectFolder = useCallback(async () => {
    try {
      if (window.electronAPI?.invoke) {
        const dirPath = await window.electronAPI.invoke('system:pickDirectory')
        if (dirPath) setPath(dirPath)
      } else {
        setPath('C:\\Users\\You\\Documents')
      }
    } catch {
      setPath('C:\\Users\\You\\Documents')
    }
  }, [])

  const handleScan = useCallback(async () => {
    if (!path) {
      toast.add('Please select a folder first', 'warning')
      return
    }
    setScanning(true)
    setProgress(0)
    setStage('Scanning for duplicates...')
    setError('')
    setResult(null)
    setSelectedFiles(new Set())
    try {
      const data = await scanDuplicates(path, ({ percent, stage: st }) => {
        setProgress(percent || 0)
        if (st) setStage(st)
      })
      setResult(data)
      setProgress(100)
    } catch (err) {
      setError(err.message || 'Scan failed')
    } finally {
      setScanning(false)
    }
  }, [path, toast])

  const toggleFile = (filePath) => {
    const next = new Set(selectedFiles)
    if (next.has(filePath)) {
      next.delete(filePath)
    } else {
      next.add(filePath)
    }
    setSelectedFiles(next)
  }

  const toggleGroup = (groupIndex, filePaths) => {
    const next = new Set(selectedFiles)
    const allSelected = filePaths.every((fp) => next.has(fp))
    if (allSelected) {
      filePaths.forEach((fp) => next.delete(fp))
    } else {
      filePaths.forEach((fp) => next.add(fp))
    }
    setSelectedFiles(next)
  }

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return
    setDeleting(true)
    try {
      const filesToDelete = [...selectedFiles]
      const delResult = await deleteDuplicates(filesToDelete)
      if (delResult?.success) {
        toast.add(`Deleted ${filesToDelete.length} file(s)`, 'success')
        setResult((prev) => {
          if (!prev) return prev
          const newGroups = prev.duplicates
            .map((group) => ({
              ...group,
              files: group.files.filter((f) => !filesToDelete.includes(f.path || f)),
            }))
            .filter((group) => group.files.length > 1)
          const remaining = prev.duplicates.reduce((sum, g) => {
            const remainingFiles = g.files.filter((f) => !filesToDelete.includes(f.path || f))
            return sum + remainingFiles.length
          }, 0)
          const newWasted = newGroups.reduce((sum, g) => sum + (g.size || 0) * (g.files.length - 1), 0)
          return {
            ...prev,
            duplicates: newGroups,
            totalGroups: newGroups.length,
            totalWasted: newWasted,
          }
        })
        setSelectedFiles(new Set())
      } else {
        toast.add(delResult?.error || 'Failed to delete files', 'error')
      }
    } catch (err) {
      toast.add(err.message || 'Failed to delete files', 'error')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const duplicates = result?.duplicates || []
  const totalWasted = result?.totalWasted || 0

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sparkle-warning/10 text-sparkle-warning shadow-sm">
            <Files size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-sparkle-primary uppercase tracking-[0.08em] mb-2">
              <Files size={11} /> File Tools
            </div>
            <h1 className="text-2xl font-bold text-sparkle-text tracking-tight">Duplicate Finder</h1>
            <p className="text-sm text-sparkle-text-secondary mt-1.5">Find and remove duplicate files wasting disk space</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="notice-banner error">
          <AlertTriangle size={17} />{error}
        </div>
      )}

      {/* Scan Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sparkle-warning/10 text-sparkle-warning shrink-0">
            <FolderSearch size={18} />
          </div>
          <div className="flex-1">
            <CardTitle>Scan for Duplicates</CardTitle>
            <CardDescription>Select a folder and scan for duplicate files</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handleSelectFolder} disabled={scanning}>
              <FolderOpen size={14} />
              Select Folder
            </Button>
            <div className={`flex-1 text-sm ${path ? 'text-sparkle-text font-medium' : 'text-sparkle-text-muted'} truncate`}>
              {path || 'No folder selected'}
            </div>
          </div>

          {scanning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px] text-sparkle-text-secondary">
                  <Loader size={16} className="animate-spin text-sparkle-primary" />
                  <span>{stage || 'Scanning...'}</span>
                </div>
                <span className="text-lg font-bold text-gradient">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {result && !scanning && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-sparkle-accent/50 border border-sparkle-border">
              <div className="w-10 h-10 rounded-xl bg-sparkle-success/10 text-sparkle-success flex items-center justify-center shrink-0">
                <FileCheck size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-sparkle-text">
                  {duplicates.length} duplicate group{duplicates.length !== 1 ? 's' : ''} found
                </div>
                <div className="text-xs text-sparkle-text-secondary">
                  {totalWasted > 0 ? `${formatBytes(totalWasted)} wasted` : 'No space wasted'}
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            variant="primary"
            className="w-full"
            onClick={handleScan}
            disabled={scanning || !path}
          >
            {scanning ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
            {scanning ? 'Scanning...' : 'Start Scan'}
          </Button>
        </CardFooter>
      </Card>

      {/* Duplicate Groups */}
      {duplicates.length > 0 && !scanning && (
        <Card className="p-0 overflow-hidden">
          <CardHeader className="mb-0 pb-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sparkle-warning/10 text-sparkle-warning shrink-0">
              <Files size={18} />
            </div>
            <div className="flex-1">
              <CardTitle>Duplicate Groups</CardTitle>
            </div>
            {selectedFiles.size > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
              >
                <Trash2 size={14} />
                {deleting ? 'Deleting...' : `Delete Selected (${selectedFiles.size})`}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {confirmDelete && (
              <div className="notice-banner warning mb-2">
                <AlertTriangle size={17} />
                <span>Are you sure you want to delete {selectedFiles.size} selected file(s)? This action cannot be undone.</span>
                <div className="flex gap-2 ml-auto">
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  <Button variant="danger" size="sm" onClick={handleDeleteSelected} disabled={deleting}>
                    {deleting ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Confirm Delete
                  </Button>
                </div>
              </div>
            )}
            {duplicates.map((group, gi) => {
              const filePaths = group.files.map((f) => (typeof f === 'string' ? f : f.path))
              const allInGroupSelected = filePaths.every((fp) => selectedFiles.has(fp))
              return (
                <div key={gi} className="rounded-xl border border-sparkle-border bg-sparkle-accent/30 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-sparkle-accent/50 border-b border-sparkle-border">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-sparkle-text-secondary">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-sparkle-warning"
                        checked={allInGroupSelected}
                        onChange={() => toggleGroup(gi, filePaths)}
                      />
                    </label>
                    <div className="flex-1 text-[13px] font-semibold text-sparkle-text">
                      {formatBytes(group.size)} each
                    </div>
                    <Badge variant="warning">{filePaths.length} copies</Badge>
                  </div>
                  <div className="divide-y divide-sparkle-border-secondary">
                    {group.files.map((file, fi) => {
                      const fp = typeof file === 'string' ? file : file.path
                      const isChecked = selectedFiles.has(fp)
                      return (
                        <div
                          key={fi}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-all duration-200 ${
                            isChecked ? 'bg-sparkle-warning/[0.04]' : 'hover:bg-sparkle-accent/30'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded accent-sparkle-warning shrink-0"
                            checked={isChecked}
                            onChange={() => toggleFile(fp)}
                          />
                          <ChevronRight size={12} className="text-sparkle-text-muted shrink-0" />
                          <div className="flex-1 min-w-0 text-xs text-sparkle-text-secondary font-mono truncate">
                            {fp}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (window.electronAPI?.invoke) {
                                window.electronAPI.invoke('system:reveal', fp)
                              }
                            }}
                          >
                            <FolderOpen size={12} />
                            Open
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* No duplicates found */}
      {result && duplicates.length === 0 && !scanning && (
        <Card className="p-8">
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-sparkle-success/10 text-sparkle-success flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} />
            </div>
            <div className="text-xl font-bold mb-1 text-sparkle-text">No Duplicates Found</div>
            <div className="text-sm text-sparkle-text-secondary mb-4">Your files are clean with no duplicates detected</div>
            <Button variant="secondary" size="sm" onClick={() => setResult(null)}>Scan Another Folder</Button>
          </div>
        </Card>
      )}

      {/* Getting Started */}
      {!result && !scanning && !error && (
        <Card className="p-8">
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-sparkle-warning/10 text-sparkle-warning flex items-center justify-center mx-auto mb-4">
              <FolderSearch size={28} />
            </div>
            <div className="text-xl font-bold mb-1 text-sparkle-text">Getting Started</div>
            <div className="text-sm text-sparkle-text-secondary mb-4 text-center max-w-md">
              Select a folder above and start a scan to find duplicate files. WinBoost will identify identical files by their content hash, not just filename.
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
