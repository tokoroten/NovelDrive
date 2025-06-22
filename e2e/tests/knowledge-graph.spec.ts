import { test, expect } from '@playwright/test';
import { ElectronHelpers } from '../utils/electron-helpers';
import { testData } from '../fixtures/test-data';

test.describe('Knowledge Graph Feature', () => {
  let electronHelpers: ElectronHelpers;

  test.beforeEach(async () => {
    electronHelpers = new ElectronHelpers();
    const { mainWindow } = await electronHelpers.launchApp();
    
    // First, add some data via AnythingBox
    await electronHelpers.clickElement('[data-testid="nav-anything-box"]');
    await electronHelpers.waitForElement('[data-testid="anything-box-page"]');
    
    // Add test content
    await electronHelpers.fillInput('[data-testid="anything-box-input"]', testData.anythingBox.sampleNote.content);
    await electronHelpers.clickElement('[data-testid="submit-button"]');
    await electronHelpers.waitForElement('[data-testid="inspiration-results"]', 30000);
    await electronHelpers.clickElement('[data-testid="save-to-knowledge-base"]');
    await electronHelpers.waitForElement('[data-testid="save-success-message"]');
    
    // Navigate to Knowledge Graph
    await electronHelpers.clickElement('[data-testid="nav-knowledge-graph"]');
    await electronHelpers.waitForElement('[data-testid="knowledge-graph-page"]');
  });

  test.afterEach(async () => {
    await electronHelpers.closeApp();
  });

  test('should display knowledge graph interface', async () => {
    // Check for main components
    await electronHelpers.waitForElement('[data-testid="graph-canvas"]');
    await electronHelpers.waitForElement('[data-testid="graph-controls"]');
    await electronHelpers.waitForElement('[data-testid="search-input"]');
    
    // Check page title
    const title = await electronHelpers.getElementText('[data-testid="page-title"]');
    expect(title).toContain('知識グラフ');
  });

  test('should display nodes in the graph', async () => {
    // Wait for graph to render
    await electronHelpers.waitForElement('[data-testid="graph-node"]', 10000);
    
    const mainWindow = electronHelpers.getMainWindow();
    if (mainWindow) {
      // Check that nodes are present
      const nodes = await mainWindow.$$('[data-testid="graph-node"]');
      expect(nodes.length).toBeGreaterThan(0);
      
      // Check for edges/connections
      const edges = await mainWindow.$$('[data-testid="graph-edge"]');
      expect(edges.length).toBeGreaterThanOrEqual(0); // May or may not have connections initially
    }
  });

  test('should allow searching for nodes', async () => {
    const { searchQuery } = testData.knowledgeGraph;
    
    // Enter search query
    await electronHelpers.fillInput('[data-testid="search-input"]', searchQuery);
    
    // Submit search (Enter key or button)
    const mainWindow = electronHelpers.getMainWindow();
    if (mainWindow) {
      await mainWindow.press('[data-testid="search-input"]', 'Enter');
    }
    
    // Wait for search results
    await electronHelpers.waitForElement('[data-testid="search-results"]');
    
    // Check that results contain the search term
    const results = await electronHelpers.getElementText('[data-testid="search-results"]');
    expect(results?.toLowerCase()).toContain(searchQuery.toLowerCase());
  });

  test('should allow zooming and panning', async () => {
    const mainWindow = electronHelpers.getMainWindow();
    if (!mainWindow) return;
    
    // Test zoom in
    await electronHelpers.clickElement('[data-testid="zoom-in-button"]');
    await mainWindow.waitForTimeout(500);
    
    // Test zoom out
    await electronHelpers.clickElement('[data-testid="zoom-out-button"]');
    await mainWindow.waitForTimeout(500);
    
    // Test fit to screen
    await electronHelpers.clickElement('[data-testid="fit-screen-button"]');
    await mainWindow.waitForTimeout(500);
    
    // Verify controls are working (no errors)
    const zoomLevel = await electronHelpers.getElementText('[data-testid="zoom-level"]');
    expect(zoomLevel).toBeTruthy();
  });

  test('should show node details on click', async () => {
    // Wait for nodes to load
    await electronHelpers.waitForElement('[data-testid="graph-node"]', 10000);
    
    // Click on a node
    await electronHelpers.clickElement('[data-testid="graph-node"]');
    
    // Wait for node details panel
    await electronHelpers.waitForElement('[data-testid="node-details-panel"]');
    
    // Check node details content
    const nodeTitle = await electronHelpers.getElementText('[data-testid="node-title"]');
    expect(nodeTitle).toBeTruthy();
    
    const nodeContent = await electronHelpers.getElementText('[data-testid="node-content"]');
    expect(nodeContent).toBeTruthy();
    
    // Check for metadata
    await electronHelpers.waitForElement('[data-testid="node-created-date"]');
    await electronHelpers.waitForElement('[data-testid="node-connections-count"]');
  });

  test('should filter nodes by type', async () => {
    const mainWindow = electronHelpers.getMainWindow();
    if (!mainWindow) return;
    
    // Open filter menu
    await electronHelpers.clickElement('[data-testid="filter-button"]');
    await electronHelpers.waitForElement('[data-testid="filter-menu"]');
    
    // Select a filter option (e.g., "Inspiration" type)
    await electronHelpers.clickElement('[data-testid="filter-inspiration"]');
    
    // Wait for graph to update
    await mainWindow.waitForTimeout(1000);
    
    // Verify filtered results
    const nodes = await mainWindow.$$('[data-testid="graph-node"]');
    for (const node of nodes) {
      const nodeType = await node.getAttribute('data-node-type');
      expect(nodeType).toBe('inspiration');
    }
  });

  test('should export graph visualization', async () => {
    // Wait for graph to load
    await electronHelpers.waitForElement('[data-testid="graph-node"]', 10000);
    
    // Click export button
    await electronHelpers.clickElement('[data-testid="export-graph-button"]');
    
    // Wait for export menu
    await electronHelpers.waitForElement('[data-testid="export-menu"]');
    
    // Select export format
    await electronHelpers.clickElement('[data-testid="export-png"]');
    
    // Wait for export success message
    await electronHelpers.waitForElement('[data-testid="export-success-message"]');
    
    const successMessage = await electronHelpers.getElementText('[data-testid="export-success-message"]');
    expect(successMessage).toContain('エクスポート');
  });

  test('should handle graph layout options', async () => {
    const mainWindow = electronHelpers.getMainWindow();
    if (!mainWindow) return;
    
    // Open layout options
    await electronHelpers.clickElement('[data-testid="layout-button"]');
    await electronHelpers.waitForElement('[data-testid="layout-menu"]');
    
    // Try different layouts
    const layouts = ['force', 'hierarchical', 'circular'];
    
    for (const layout of layouts) {
      await electronHelpers.clickElement(`[data-testid="layout-${layout}"]`);
      await mainWindow.waitForTimeout(1500); // Wait for animation
      
      // Verify layout changed
      const currentLayout = await mainWindow.getAttribute('[data-testid="graph-canvas"]', 'data-layout');
      expect(currentLayout).toBe(layout);
    }
  });
});