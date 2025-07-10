import { Project } from '../store'

interface ProjectCardProps {
  project: Project
  onOpen: () => void
}

export function ProjectCard({ project, onOpen }: ProjectCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP')
  }
  
  const metadata = project.metadata || {}
  const genre = metadata.genre || 'other'
  const status = metadata.status || 'planning'
  
  const statusLabels: Record<string, string> = {
    planning: '企画中',
    writing: '執筆中',
    editing: '編集中',
    completed: '完成',
    paused: '中断',
  }
  
  const genreLabels: Record<string, string> = {
    fantasy: 'ファンタジー',
    scifi: 'SF',
    mystery: 'ミステリー',
    romance: '恋愛',
    literary: '純文学',
    other: 'その他',
  }
  
  return (
    <div className="project-card" onClick={onOpen}>
      <div className="project-header">
        <h3 className="project-title">{project.name}</h3>
        {genre && (
          <span className={`project-genre genre-${genre}`}>
            {genreLabels[genre] || genre}
          </span>
        )}
      </div>
      
      {project.description && (
        <p className="project-description">{project.description}</p>
      )}
      
      <div className="project-meta">
        <div className="meta-item">
          <span className="meta-label">ステータス:</span>
          <span className={`status-badge status-${status}`}>
            {statusLabels[status] || status}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">更新日:</span>
          <span>{formatDate(project.updated_at)}</span>
        </div>
      </div>
      
      <div className="project-actions">
        <button className="primary-btn" onClick={onOpen}>
          プロジェクトを開く
        </button>
      </div>
    </div>
  )
}