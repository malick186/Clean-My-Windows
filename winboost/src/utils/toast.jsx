import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'

const ToastContext = createContext(null)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((prev) => {
      if (!prev.some((t) => t.id === id)) return prev
      return prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    })
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 300)
  }, [])

  const add = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = ++toastId
      setToasts((prev) => [...prev, { id, message, type, exiting: false }])
      if (duration > 0) {
        timers.current[id] = setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss]
  )

  useEffect(() => {
    const timersRef = timers.current
    return () => Object.values(timersRef).forEach(clearTimeout)
  }, [])

  const value = useMemo(() => ({ add, dismiss }), [add, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

export function ToastContainer() {
  return null
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
}

function ToastItem({ toast, onDismiss }) {
  const Icon = icons[toast.type] || Info
  return (
    <div className={`toast-item ${toast.type} ${toast.exiting ? 'exiting' : ''}`}>
      <Icon size={18} className={`text-sparkle-${toast.type === 'error' ? 'danger' : toast.type === 'info' ? 'primary' : toast.type === 'warning' ? 'warning' : 'success'}`} />
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="flex items-center justify-center w-5 h-5 rounded-md hover:bg-sparkle-accent/50 text-sparkle-text-secondary hover:text-sparkle-text cursor-pointer bg-transparent border-none"
      >
        <X size={12} />
      </button>
    </div>
  )
}
