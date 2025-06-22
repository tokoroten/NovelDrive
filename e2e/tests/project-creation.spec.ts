import { test, expect } from '@playwright/test';
import { ElectronHelpers } from '../utils/electron-helpers';
import { testData } from '../fixtures/test-data';

test.describe('Project Creation Flow', () => {
  let electronHelpers: ElectronHelpers;

  test.beforeEach(async () => {
    electronHelpers = new ElectronHelpers();
    await electronHelpers.launchApp();
  });

  test.afterEach(async () => {
    await electronHelpers.closeApp();
  });

  test('should navigate to plot management for project creation', async () => {
    // Navigate to dashboard first
    await electronHelpers.clickElement('[data-testid="nav-dashboard"]');
    await electronHelpers.waitForElement('[data-testid="dashboard"]');
    
    // Click create project button
    await electronHelpers.clickElement('[data-testid="create-project-button"]');
    
    // Should navigate to plot management page
    const mainWindow = electronHelpers.getMainWindow();
    if (mainWindow) {
      // Wait for plot management page
      await mainWindow.waitForSelector('text="プロット履歴"', { timeout: 10000 });
      
      // Verify we're on the plot management page
      const plotHistoryText = await mainWindow.textContent('text="プロット履歴"');
      expect(plotHistoryText).toBeTruthy();
    }
  });

  test.skip('should validate required fields', async () => {
    // Skip this test for now as UI is not yet implemented
  });

  test.skip('should allow project configuration during creation', async () => {
    const { sampleProject } = testData.project;
    
    await electronHelpers.clickElement('[data-testid="create-project-button"]');
    await electronHelpers.waitForElement('[data-testid="project-creation-form"]');
    
    // Fill basic info
    await electronHelpers.fillInput('[data-testid="project-title-input"]', sampleProject.title);
    
    // Open advanced settings
    await electronHelpers.clickElement('[data-testid="advanced-settings-toggle"]');
    await electronHelpers.waitForElement('[data-testid="advanced-settings-panel"]');
    
    // Configure AI settings
    await electronHelpers.clickElement('[data-testid="ai-creativity-high"]');
    await electronHelpers.clickElement('[data-testid="enable-24h-mode"]');
    
    // Configure writing style
    await electronHelpers.fillInput('[data-testid="writing-style-input"]', '村上春樹風');
    
    // Submit
    await electronHelpers.clickElement('[data-testid="create-project-submit"]');
    await electronHelpers.waitForElement('[data-testid="project-dashboard"]', 30000);
    
    // Verify settings were applied
    await electronHelpers.clickElement('[data-testid="project-settings-button"]');
    await electronHelpers.waitForElement('[data-testid="project-settings-panel"]');
    
    const writingStyle = await electronHelpers.getElementText('[data-testid="current-writing-style"]');
    expect(writingStyle).toContain('村上春樹風');
  });

  test.skip('should import existing knowledge into project', async () => {
    const { sampleProject } = testData.project;
    
    // First, ensure we have some knowledge in the system
    await electronHelpers.clickElement('[data-testid="nav-anything-box"]');
    await electronHelpers.fillInput('[data-testid="anything-box-input"]', testData.anythingBox.sampleNote.content);
    await electronHelpers.clickElement('[data-testid="submit-button"]');
    await electronHelpers.waitForElement('[data-testid="save-to-knowledge-base"]');
    await electronHelpers.clickElement('[data-testid="save-to-knowledge-base"]');
    
    // Create project
    await electronHelpers.clickElement('[data-testid="create-project-button"]');
    await electronHelpers.waitForElement('[data-testid="project-creation-form"]');
    
    await electronHelpers.fillInput('[data-testid="project-title-input"]', sampleProject.title);
    
    // Import knowledge step
    await electronHelpers.clickElement('[data-testid="import-knowledge-toggle"]');
    await electronHelpers.waitForElement('[data-testid="knowledge-import-panel"]');
    
    // Select knowledge to import
    const mainWindow = electronHelpers.getMainWindow();
    if (mainWindow) {
      const knowledgeItems = await mainWindow.$$('[data-testid="knowledge-item-checkbox"]');
      if (knowledgeItems.length > 0) {
        await knowledgeItems[0].click();
      }
    }
    
    // Create project with imported knowledge
    await electronHelpers.clickElement('[data-testid="create-project-submit"]');
    await electronHelpers.waitForElement('[data-testid="project-dashboard"]', 30000);
    
    // Verify knowledge was imported
    await electronHelpers.clickElement('[data-testid="project-knowledge-tab"]');
    await electronHelpers.waitForElement('[data-testid="project-knowledge-list"]');
    
    const knowledgeCount = await electronHelpers.getElementText('[data-testid="knowledge-count"]');
    expect(parseInt(knowledgeCount || '0')).toBeGreaterThan(0);
  });

  test.skip('should start agent discussion after project creation', async () => {
    const { sampleProject } = testData.project;
    const { plotIdea } = testData.agent;
    
    // Create project
    await electronHelpers.clickElement('[data-testid="create-project-button"]');
    await electronHelpers.waitForElement('[data-testid="project-creation-form"]');
    
    await electronHelpers.fillInput('[data-testid="project-title-input"]', sampleProject.title);
    await electronHelpers.fillInput('[data-testid="project-description-input"]', sampleProject.description);
    
    // Enable immediate plot generation
    await electronHelpers.clickElement('[data-testid="generate-plot-on-create"]');
    
    // Add initial plot idea
    await electronHelpers.fillInput('[data-testid="initial-plot-idea"]', plotIdea);
    
    // Create project
    await electronHelpers.clickElement('[data-testid="create-project-submit"]');
    
    // Should redirect to agent meeting room
    await electronHelpers.waitForElement('[data-testid="agent-meeting-room"]', 30000);
    
    // Verify agents are discussing
    await electronHelpers.waitForElement('[data-testid="agent-discussion-active"]');
    
    // Wait for initial messages
    await electronHelpers.waitForElement('[data-testid="agent-message"]', 30000);
    
    const mainWindow = electronHelpers.getMainWindow();
    if (mainWindow) {
      const messages = await mainWindow.$$('[data-testid="agent-message"]');
      expect(messages.length).toBeGreaterThan(0);
    }
  });

  test.skip('should save project and appear in project list', async () => {
    const { sampleProject } = testData.project;
    
    // Create project
    await electronHelpers.clickElement('[data-testid="create-project-button"]');
    await electronHelpers.waitForElement('[data-testid="project-creation-form"]');
    
    await electronHelpers.fillInput('[data-testid="project-title-input"]', sampleProject.title);
    await electronHelpers.clickElement('[data-testid="create-project-submit"]');
    
    await electronHelpers.waitForElement('[data-testid="project-dashboard"]', 30000);
    
    // Go back to main dashboard
    await electronHelpers.clickElement('[data-testid="nav-dashboard"]');
    await electronHelpers.waitForElement('[data-testid="dashboard"]');
    
    // Check recent projects section
    await electronHelpers.waitForElement('[data-testid="recent-projects"]');
    
    const mainWindow = electronHelpers.getMainWindow();
    if (mainWindow) {
      const projectItems = await mainWindow.$$('[data-testid="project-item"]');
      const projectTitles = await Promise.all(
        projectItems.map(item => item.textContent())
      );
      
      const hasCreatedProject = projectTitles.some(title => 
        title?.includes(sampleProject.title)
      );
      expect(hasCreatedProject).toBe(true);
    }
  });

  test.skip('should allow canceling project creation', async () => {
    // Start project creation
    await electronHelpers.clickElement('[data-testid="create-project-button"]');
    await electronHelpers.waitForElement('[data-testid="project-creation-form"]');
    
    // Fill some fields
    await electronHelpers.fillInput('[data-testid="project-title-input"]', 'キャンセルテスト');
    
    // Cancel
    await electronHelpers.clickElement('[data-testid="cancel-project-creation"]');
    
    // Should return to previous page
    const mainWindow = electronHelpers.getMainWindow();
    if (mainWindow) {
      // Verify we're not on project creation form anymore
      const formExists = await mainWindow.$('[data-testid="project-creation-form"]');
      expect(formExists).toBeNull();
    }
  });
});