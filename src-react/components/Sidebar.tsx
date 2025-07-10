import { NavLink } from 'react-router-dom'
import { useStore } from '../store'
import { useEffect } from 'react'
import { api } from '../lib/api'

const navItems = [
  { path: '/agent-meeting', icon: '🤝', label: 'エージェント会議室' },
  { path: '/projects', icon: '📁', label: 'プロジェクト' },
  { path: '/workspace', icon: '💼', label: 'ワークスペース' },
  { path: '/editor', icon: '✍️', label: '執筆エディタ' },
  { path: '/anything-box', icon: '📥', label: 'なんでもボックス' },
  { path: '/serendipity', icon: '✨', label: 'セレンディピティ' },
  { path: '/knowledge-graph', icon: '🕸️', label: 'ナレッジグラフ' },
  { path: '/settings', icon: '⚙️', label: '設定' },
]

export function Sidebar() {
  const { currentProjectId, projects, setCurrentProject, setProjects } = useStore()
  
  useEffect(() => {
    // Load projects on mount
    api.project.getAll().then((result) => {
      if (result.success) {
        setProjects(result.data)
      }
    })
  }, [setProjects])
  
  return (
    <nav className="sidebar">
      <div className="app-title">
        <h1>NovelDrive</h1>
      </div>
      
      <div className="project-selector-wrapper">
        <select
          className="project-selector"
          value={currentProjectId || ''}
          onChange={(e) => setCurrentProject(e.target.value || null)}
        >
          <option value="">プロジェクトを選択...</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
      
      <ul className="nav-menu">
        {navItems.map((item) => (
          <li key={item.path} className="nav-item">
            <NavLink
              to={item.path}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}