import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AppearanceProvider } from './context/AppearanceContext.jsx'
import { ToastProvider } from './utils/toast.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppearanceProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AppearanceProvider>
  </StrictMode>,
)
