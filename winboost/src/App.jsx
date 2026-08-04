import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Cleanup from './pages/Cleanup'
import StartupManager from './pages/StartupManager'
import DiskAnalyzer from './pages/DiskAnalyzer'
import PrivacyTools from './pages/PrivacyTools'
import Performance from './pages/Performance'
import MalwareScanner from './pages/MalwareScanner'
import Uninstaller from './pages/Uninstaller'
import Shredder from './pages/Shredder'
import Maintenance from './pages/Maintenance'
import LargeFiles from './pages/LargeFiles'
import RegistryCleaner from './pages/RegistryCleaner'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="cleanup" element={<Cleanup />} />
          <Route path="malware" element={<MalwareScanner />} />
          <Route path="uninstaller" element={<Uninstaller />} />
          <Route path="startup" element={<StartupManager />} />
          <Route path="disk" element={<DiskAnalyzer />} />
          <Route path="largefiles" element={<LargeFiles />} />
          <Route path="registry" element={<RegistryCleaner />} />
          <Route path="privacy" element={<PrivacyTools />} />
          <Route path="shredder" element={<Shredder />} />
          <Route path="performance" element={<Performance />} />
          <Route path="maintenance" element={<Maintenance />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
