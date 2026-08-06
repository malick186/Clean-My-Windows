import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { Loader } from 'lucide-react'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Cleanup = lazy(() => import('./pages/Cleanup'))
const StartupManager = lazy(() => import('./pages/StartupManager'))
const DiskAnalyzer = lazy(() => import('./pages/DiskAnalyzer'))
const PrivacyTools = lazy(() => import('./pages/PrivacyTools'))
const Performance = lazy(() => import('./pages/Performance'))
const MalwareScanner = lazy(() => import('./pages/MalwareScanner'))
const Uninstaller = lazy(() => import('./pages/Uninstaller'))
const Shredder = lazy(() => import('./pages/Shredder'))
const Maintenance = lazy(() => import('./pages/Maintenance'))
const LargeFiles = lazy(() => import('./pages/LargeFiles'))
const RegistryCleaner = lazy(() => import('./pages/RegistryCleaner'))
const SafetyCenter = lazy(() => import('./pages/SafetyCenter'))
const Settings = lazy(() => import('./pages/Settings'))
const Security = lazy(() => import('./pages/Security'))

const LoaderFallback = () => (
  <div className="flex flex-col items-center justify-center gap-3 h-[300px] text-text-tertiary text-[13px]">
    <Loader size={22} className="animate-spin" />
    <span>Loading module...</span>
  </div>
)

function page(Component) {
  return <Suspense fallback={<LoaderFallback />}><Component /></Suspense>
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={page(Dashboard)} />
          <Route path="cleanup" element={page(Cleanup)} />
          <Route path="security" element={page(Security)} />
          <Route path="malware" element={page(MalwareScanner)} />
          <Route path="uninstaller" element={page(Uninstaller)} />
          <Route path="startup" element={page(StartupManager)} />
          <Route path="disk" element={page(DiskAnalyzer)} />
          <Route path="largefiles" element={page(LargeFiles)} />
          <Route path="registry" element={page(RegistryCleaner)} />
          <Route path="privacy" element={page(PrivacyTools)} />
          <Route path="shredder" element={page(Shredder)} />
          <Route path="performance" element={page(Performance)} />
          <Route path="maintenance" element={page(Maintenance)} />
          <Route path="safety" element={page(SafetyCenter)} />
          <Route path="settings" element={page(Settings)} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
