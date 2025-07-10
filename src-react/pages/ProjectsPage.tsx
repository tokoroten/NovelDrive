import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { api } from '../lib/api'
import { ProjectCard } from '../components/ProjectCard'
import { CreateProjectModal } from '../components/CreateProjectModal'

export function ProjectsPage() {
  const navigate = useNavigate()
  const { projects, setCurrentProject } = useStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  const handleProjectOpen = (projectId: string) => {
    setCurrentProject(projectId)
    navigate('/workspace')
  }
  
  const handleProjectCreate = async (projectData: any) => {
    try {
      const result = await api.project.create(projectData)
      if (result.success) {
        // Refresh projects
        const projectsResult = await api.project.getAll()
        if (projectsResult.success) {
          useStore.getState().setProjects(projectsResult.data)
        }
        
        setShowCreateModal(false)
        
        // Navigate to new project
        setCurrentProject(result.data.id)
        navigate('/workspace')
      }
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }
  
  return (
    <div className="projects-page">
      <header className="page-header">
        <h2>プロジェクト管理</h2>
        <button
          className="primary-btn"
          onClick={() => setShowCreateModal(true)}
        >
          <span className="icon">➕</span>
          新規プロジェクト
        </button>
      </header>
      
      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h3>プロジェクトがありません</h3>
          <p>最初のプロジェクトを作成して、創作を始めましょう。</p>
          <button
            className="primary-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="icon">➕</span>
            プロジェクトを作成
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => handleProjectOpen(project.id)}
            />
          ))}
        </div>
      )}
      
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleProjectCreate}
        />
      )}
    </div>
  )
}