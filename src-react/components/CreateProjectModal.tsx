import { useState } from 'react'

interface CreateProjectModalProps {
  onClose: () => void
  onCreate: (projectData: any) => void
}

export function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    genre: '',
    targetLength: '',
  })
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      alert('プロジェクト名を入力してください')
      return
    }
    
    onCreate({
      name: formData.name,
      description: formData.description,
      metadata: {
        genre: formData.genre,
        targetLength: formData.targetLength ? parseInt(formData.targetLength) : undefined,
        status: 'planning',
      },
    })
  }
  
  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>新規プロジェクト作成</h3>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="project-name">
              プロジェクト名 <span className="required">*</span>
            </label>
            <input
              type="text"
              id="project-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例: 星降る夜の物語"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="project-description">説明</label>
            <textarea
              id="project-description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="プロジェクトの概要を入力してください"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="project-genre">ジャンル</label>
            <select
              id="project-genre"
              value={formData.genre}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
            >
              <option value="">選択してください</option>
              <option value="fantasy">ファンタジー</option>
              <option value="scifi">SF</option>
              <option value="mystery">ミステリー</option>
              <option value="romance">恋愛</option>
              <option value="literary">純文学</option>
              <option value="other">その他</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="target-length">目標文字数</label>
            <input
              type="number"
              id="target-length"
              value={formData.targetLength}
              onChange={(e) => setFormData({ ...formData, targetLength: e.target.value })}
              placeholder="100000"
              min="0"
              step="1000"
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="primary-btn">
              作成
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}