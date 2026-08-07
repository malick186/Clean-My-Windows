import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'

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
const Debloat = lazy(() => import('./pages/Debloat'))
const AppInstaller = lazy(() => import('./pages/AppInstaller'))
const SystemUtils = lazy(() => import('./pages/SystemUtils'))
const NetworkOptimizer = lazy(() => import('./pages/NetworkOptimizer'))
const PowerManager = lazy(() => import('./pages/PowerManager'))
const NetworkDiagnostics = lazy(() => import('./pages/NetworkDiagnostics'))
const ContextMenuManager = lazy(() => import('./pages/ContextMenuManager'))
const SystemInfo = lazy(() => import('./pages/SystemInfo'))
const DuplicateFinder = lazy(() => import('./pages/DuplicateFinder'))
const BrowserCleaner = lazy(() => import('./pages/BrowserCleaner'))

const LoaderFallback = () => (
  <div className="loading-state">
    <div className="loading-spinner" />
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
          <Route path="debloat" element={page(Debloat)} />
          <Route path="appinstaller" element={page(AppInstaller)} />
          <Route path="sysutils" element={page(SystemUtils)} />
          <Route path="network" element={page(NetworkOptimizer)} />
          <Route path="power" element={page(PowerManager)} />
          <Route path="network-diag" element={page(NetworkDiagnostics)} />
          <Route path="context-menu" element={page(ContextMenuManager)} />
          <Route path="system" element={page(SystemInfo)} />
          <Route path="duplicates" element={page(DuplicateFinder)} />
          <Route path="browser" element={page(BrowserCleaner)} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
