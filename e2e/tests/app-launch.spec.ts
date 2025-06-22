import { test, expect } from '@playwright/test';
import { ElectronHelpers } from '../utils/electron-helpers';

test.describe('Application Launch', () => {
  let electronHelpers: ElectronHelpers;

  test.beforeEach(async () => {
    electronHelpers = new ElectronHelpers();
  });

  test.afterEach(async () => {
    await electronHelpers.closeApp();
  });

  test('should launch the Electron app successfully', async () => {
    const { app, mainWindow } = await electronHelpers.launchApp();
    
    // Check that the app and window are created
    expect(app).toBeTruthy();
    expect(mainWindow).toBeTruthy();
    
    // Check window title
    const title = await mainWindow.title();
    expect(title).toContain('NovelDrive');
  });

  test('should display the main dashboard on launch', async () => {
    const { mainWindow } = await electronHelpers.launchApp();
    
    // Wait for dashboard to load
    await electronHelpers.waitForElement('[data-testid="dashboard"]');
    
    // Check for main dashboard elements
    const dashboardTitle = await electronHelpers.getElementText('[data-testid="dashboard-title"]');
    expect(dashboardTitle).toContain('ダッシュボード');
    
    // Check for navigation menu
    await electronHelpers.waitForElement('[data-testid="nav-menu"]');
    
    // Check for key dashboard sections
    await electronHelpers.waitForElement('[data-testid="recent-projects"]');
    await electronHelpers.waitForElement('[data-testid="recent-inspirations"]');
  });

  test('should have working navigation menu', async () => {
    const { mainWindow } = await electronHelpers.launchApp();
    
    // Wait for navigation menu
    await electronHelpers.waitForElement('[data-testid="nav-menu"]');
    
    // Test navigation to AnythingBox
    await electronHelpers.clickElement('[data-testid="nav-anything-box"]');
    await electronHelpers.waitForElement('[data-testid="anything-box-page"]');
    
    // Test navigation to Knowledge Graph
    await electronHelpers.clickElement('[data-testid="nav-knowledge-graph"]');
    await electronHelpers.waitForElement('[data-testid="knowledge-graph-page"]');
    
    // Test navigation back to Dashboard
    await electronHelpers.clickElement('[data-testid="nav-dashboard"]');
    await electronHelpers.waitForElement('[data-testid="dashboard"]');
  });

  test('should handle window controls properly', async () => {
    const { app, mainWindow } = await electronHelpers.launchApp();
    
    // Get initial window state
    const isMaximized = await mainWindow.evaluate(() => {
      return window.outerHeight === window.screen.availHeight && 
             window.outerWidth === window.screen.availWidth;
    });
    
    // Test minimize
    await mainWindow.evaluate(() => {
      (window as any).electronAPI?.minimizeWindow();
    });
    
    // Wait a bit for the operation
    await mainWindow.waitForTimeout(500);
    
    // Test maximize/restore
    await mainWindow.evaluate(() => {
      (window as any).electronAPI?.maximizeWindow();
    });
    
    await mainWindow.waitForTimeout(500);
    
    // Verify app is still running
    const isRunning = !app.process().killed;
    expect(isRunning).toBe(true);
  });

  test('should load with correct initial state', async () => {
    const { mainWindow } = await electronHelpers.launchApp();
    
    // Check that the app loads without errors
    const consoleErrors: string[] = [];
    mainWindow.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Wait for app to stabilize
    await mainWindow.waitForTimeout(2000);
    
    // Check for critical errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('DevTools') && // Ignore DevTools warnings
      !error.includes('Extension') && // Ignore extension warnings
      !error.includes('favicon') // Ignore favicon 404s
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});