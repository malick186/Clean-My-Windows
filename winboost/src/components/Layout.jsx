import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import { ToastContainer } from '../utils/toast.jsx'

export default function Layout() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-sparkle-bg overflow-hidden">
      <TitleBar onToggleSidebar={() => setIsCollapsed((v) => !v)} />
      <div className="flex flex-1 min-h-0">
        <Sidebar isCollapsed={isCollapsed} />
        <main className="flex-1 overflow-y-auto content-scroll">
          <div className="p-6 max-w-[1800px] mx-auto">
            <div className="anim-fade-up">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
