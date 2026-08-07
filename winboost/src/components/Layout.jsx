import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'

export default function Layout() {
  const location = useLocation()
  return (
    <div className="relative flex flex-col h-screen min-w-[960px] overflow-hidden bg-bg">
      <div className="ambient-bg">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
      </div>
      <TitleBar />
      <div className="flex flex-1 min-h-0 relative z-10">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1160px] mx-auto px-8 py-8" key={location.pathname}>
            <div className="anim-fade-up">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
