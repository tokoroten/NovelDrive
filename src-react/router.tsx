import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProjectsPage } from './pages/ProjectsPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { WritingEditorPage } from './pages/WritingEditorPage'
import { AnythingBoxPage } from './pages/AnythingBoxPage'
import { SerendipityPage } from './pages/SerendipityPage'
import { KnowledgeGraphPage } from './pages/KnowledgeGraphPage'
import { AgentMeetingPage } from './pages/AgentMeetingPage'
import { SettingsPage } from './pages/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to="/projects" replace />,
      },
      {
        path: 'projects',
        element: <ProjectsPage />,
      },
      {
        path: 'workspace',
        element: <WorkspacePage />,
      },
      {
        path: 'editor',
        element: <WritingEditorPage />,
      },
      {
        path: 'anything-box',
        element: <AnythingBoxPage />,
      },
      {
        path: 'serendipity',
        element: <SerendipityPage />,
      },
      {
        path: 'knowledge-graph',
        element: <KnowledgeGraphPage />,
      },
      {
        path: 'agent-meeting',
        element: <AgentMeetingPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
])