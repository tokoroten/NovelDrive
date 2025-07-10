import { defineConfig } from 'vite'

export default defineConfig({
  root: './',
  server: {
    port: 3000,
    open: '/vite-debug.html'
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './vite-debug.html',
        index: './src/renderer/index.html',
        projects: './src/renderer/projects.html',
        'writing-editor': './src/renderer/writing-editor.html',
        'agent-meeting': './src/renderer/agent-meeting.html',
        settings: './src/renderer/settings.html',
        analytics: './src/renderer/analytics.html',
        'knowledge-graph': './src/renderer/knowledge-graph.html',
        'knowledge-graph-visual': './src/renderer/knowledge-graph-visual.html',
        'anything-box': './src/renderer/anything-box.html',
        serendipity: './src/renderer/serendipity.html'
      }
    }
  }
})