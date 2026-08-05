import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'

export default function Layout() {
  const location = useLocation()
  return (
    <div className="app-shell">
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />
      <div className="ambient-grid" />
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <main className="app-content">
          <div className="content-frame route-stage" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
