import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useStore } from '../store'

export function Layout() {
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed)
  
  return (
    <div className="app-container">
      <Sidebar />
      <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Outlet />
      </main>
    </div>
  )
}