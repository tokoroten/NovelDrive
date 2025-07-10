import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { api } from '../lib/api'
import { Chapter, Plot, WritingStatistics, EditorState } from '../../shared/types/chapter'
import '../styles/writing-editor.css'

export function WritingEditorPage() {
  const { currentProjectId } = useStore()
  const [plots, setPlots] = useState<Plot[]>([])
  const [currentPlot, setCurrentPlot] = useState<Plot | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null)
  const [content, setContent] = useState('')
  const [statistics, setStatistics] = useState<WritingStatistics | null>(null)
  const [editorState, setEditorState] = useState<EditorState>({
    cursorPosition: { line: 1, column: 1 },
    scrollPosition: 0,
    isAutoSaveEnabled: true
  })
  const [isSaving, setIsSaving] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load plots when project changes
  useEffect(() => {
    if (currentProjectId) {
      loadPlots()
      loadStatistics()
    }
  }, [currentProjectId])

  // Load chapters when plot changes
  useEffect(() => {
    if (currentPlot) {
      loadChapters(currentPlot.id)
    }
  }, [currentPlot])

  // Auto-save functionality
  useEffect(() => {
    if (editorState.isAutoSaveEnabled && currentChapter && content !== currentChapter.content) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
      autoSaveTimerRef.current = setTimeout(() => {
        saveChapter()
      }, 30000) // 30 seconds
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [content, currentChapter, editorState.isAutoSaveEnabled])

  // Update word count
  useEffect(() => {
    setWordCount(countWords(content))
  }, [content])

  const loadPlots = async () => {
    if (!currentProjectId) return
    
    const response = await api.plot.getByProject(currentProjectId.toString())
    if (response.success && response.data) {
      setPlots(response.data)
      if (response.data.length > 0 && !currentPlot) {
        setCurrentPlot(response.data[0])
      }
    }
  }

  const loadChapters = async (plotId: string) => {
    const response = await api.chapter.getByPlot(plotId)
    if (response.success && response.data) {
      setChapters(response.data)
      if (response.data.length > 0 && !currentChapter) {
        await selectChapter(response.data[0])
      }
    }
  }

  const loadStatistics = async () => {
    if (!currentProjectId) return
    
    const response = await api.statistics.getWriting(currentProjectId.toString())
    if (response.success && response.data) {
      setStatistics(response.data)
    }
  }

  const selectChapter = async (chapter: Chapter) => {
    // Save current chapter before switching
    if (currentChapter && content !== currentChapter.content) {
      await saveChapter()
    }

    // Load new chapter content
    const response = await api.chapter.getById(chapter.id, true)
    if (response.success && response.data) {
      setCurrentChapter(response.data)
      setContent(response.data.content || '')
      setEditorState(prev => ({
        ...prev,
        currentChapterId: chapter.id,
        cursorPosition: { line: 1, column: 1 }
      }))
    }
  }

  const saveChapter = async () => {
    if (!currentChapter || isSaving) return

    setIsSaving(true)
    try {
      const response = await api.chapter.update(currentChapter.id, { content })
      if (response.success) {
        setEditorState(prev => ({
          ...prev,
          lastSavedAt: new Date()
        }))
        // Reload statistics
        loadStatistics()
      }
    } catch (error) {
      console.error('Failed to save chapter:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const countWords = (text: string): number => {
    const japaneseChars = text.match(/[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]/g) || []
    const englishWords = text.match(/\b[a-zA-Z]+\b/g) || []
    return japaneseChars.length + englishWords.length
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    updateCursorPosition()
  }

  const updateCursorPosition = useCallback(() => {
    if (!editorRef.current) return

    const position = editorRef.current.selectionStart
    const textBefore = content.substring(0, position)
    const lines = textBefore.split('\n')
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    setEditorState(prev => ({
      ...prev,
      cursorPosition: { line, column }
    }))
  }, [content])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Save shortcut
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      saveChapter()
    }
  }

  const navigateChapter = (direction: 'prev' | 'next') => {
    if (!currentChapter) return

    const currentIndex = chapters.findIndex(ch => ch.id === currentChapter.id)
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1

    if (newIndex >= 0 && newIndex < chapters.length) {
      selectChapter(chapters[newIndex])
    }
  }

  const createNewChapter = async () => {
    if (!currentPlot) return

    const title = prompt('新しい章のタイトルを入力してください')
    if (!title) return

    const response = await api.chapter.create({
      plotId: currentPlot.id,
      title,
      order: chapters.length,
      wordCount: 0,
      status: 'draft'
    })

    if (response.success && response.data) {
      await loadChapters(currentPlot.id)
      await selectChapter(response.data)
    }
  }

  const createNewPlot = async () => {
    if (!currentProjectId) return

    const title = prompt('新しいプロットのタイトルを入力してください')
    if (!title) return

    const response = await api.plot.create({
      projectId: currentProjectId,
      title,
      order: plots.length
    })

    if (response.success && response.data) {
      await loadPlots()
      setCurrentPlot(response.data)
    }
  }

  if (!currentProjectId) {
    return (
      <div className="writing-editor-page">
        <div className="no-project-message">
          プロジェクトを選択してください
        </div>
      </div>
    )
  }

  return (
    <div className="writing-editor-page">
      <div className="editor-container">
        {/* Left Panel - Chapter List */}
        <div className="chapters-panel">
          <div className="panel-header">
            <select
              value={currentPlot?.id || ''}
              onChange={(e) => {
                const plot = plots.find(p => p.id === e.target.value)
                if (plot) setCurrentPlot(plot)
              }}
              className="plot-select"
            >
              {plots.map(plot => (
                <option key={plot.id} value={plot.id}>
                  {plot.title}
                </option>
              ))}
            </select>
            <button onClick={createNewPlot} className="new-plot-btn" title="新しいプロット">
              +
            </button>
          </div>

          <div className="chapters-list">
            {chapters.map(chapter => (
              <div
                key={chapter.id}
                className={`chapter-item ${currentChapter?.id === chapter.id ? 'active' : ''}`}
                onClick={() => selectChapter(chapter)}
              >
                <div className="chapter-title">{chapter.title}</div>
                <div className="chapter-meta">
                  <span className="word-count">{chapter.wordCount}文字</span>
                  <span className={`status ${chapter.status}`}>
                    {chapter.status === 'draft' && '下書き'}
                    {chapter.status === 'writing' && '執筆中'}
                    {chapter.status === 'reviewing' && 'レビュー中'}
                    {chapter.status === 'completed' && '完成'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button onClick={createNewChapter} className="new-chapter-btn">
            新しい章を追加
          </button>

          {statistics && (
            <div className="writing-stats">
              <h4>執筆統計</h4>
              <div className="stat-item">
                <span>総文字数:</span>
                <span>{statistics.totalWords.toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <span>今日の文字数:</span>
                <span>{statistics.todayWords.toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <span>平均文字数/日:</span>
                <span>{Math.round(statistics.averageWordsPerDay).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Center - Editor */}
        <div className="editor-main">
          {currentChapter ? (
            <>
              <div className="editor-header">
                <button
                  onClick={() => navigateChapter('prev')}
                  disabled={chapters.findIndex(ch => ch.id === currentChapter.id) === 0}
                  className="nav-btn"
                >
                  ← 前の章
                </button>
                <h2 className="chapter-title">{currentChapter.title}</h2>
                <button
                  onClick={() => navigateChapter('next')}
                  disabled={chapters.findIndex(ch => ch.id === currentChapter.id) === chapters.length - 1}
                  className="nav-btn"
                >
                  次の章 →
                </button>
              </div>

              <div className="editor-toolbar">
                <button onClick={saveChapter} disabled={isSaving} className="save-btn">
                  {isSaving ? '保存中...' : '保存 (Ctrl+S)'}
                </button>
                <label className="auto-save-toggle">
                  <input
                    type="checkbox"
                    checked={editorState.isAutoSaveEnabled}
                    onChange={(e) => setEditorState(prev => ({
                      ...prev,
                      isAutoSaveEnabled: e.target.checked
                    }))}
                  />
                  自動保存
                </label>
                {editorState.lastSavedAt && (
                  <span className="last-saved">
                    最終保存: {editorState.lastSavedAt.toLocaleTimeString()}
                  </span>
                )}
              </div>

              <textarea
                ref={editorRef}
                value={content}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onSelect={updateCursorPosition}
                className="editor-textarea"
                placeholder="ここに文章を入力..."
              />

              <div className="editor-footer">
                <span className="cursor-position">
                  {editorState.cursorPosition.line}:{editorState.cursorPosition.column}
                </span>
                <span className="word-count">
                  {wordCount}文字
                </span>
              </div>
            </>
          ) : (
            <div className="no-chapter-message">
              章を選択するか、新しい章を作成してください
            </div>
          )}
        </div>

        {/* Right Panel - Tools */}
        <div className="tools-panel">
          <div className="panel-tabs">
            <button className="tab-btn active">アウトライン</button>
            <button className="tab-btn">知識</button>
            <button className="tab-btn">メモ</button>
            <button className="tab-btn">AI</button>
          </div>

          <div className="panel-content">
            {currentChapter && (
              <div className="chapter-outline">
                <h4>章の概要</h4>
                <textarea
                  value={currentChapter.summary || ''}
                  onChange={async (e) => {
                    const newSummary = e.target.value
                    const response = await api.chapter.update(currentChapter.id, { summary: newSummary })
                    if (response.success && response.data) {
                      setCurrentChapter(response.data)
                    }
                  }}
                  placeholder="章の概要を入力..."
                  className="outline-textarea"
                  rows={5}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}