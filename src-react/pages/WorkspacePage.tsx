import { useStore } from '../store'

export function WorkspacePage() {
  const currentProjectId = useStore((state) => state.currentProjectId)
  const projects = useStore((state) => state.projects)
  
  const currentProject = projects.find(p => p.id === currentProjectId)
  
  if (!currentProject) {
    return (
      <div className="empty-state">
        <p>プロジェクトを選択してください</p>
      </div>
    )
  }
  
  return (
    <div className="workspace-page">
      <header className="page-header">
        <h2>{currentProject.name} - ワークスペース</h2>
      </header>
      <div className="workspace-content">
        <p>ワークスペースの実装予定</p>
      </div>
    </div>
  )
}