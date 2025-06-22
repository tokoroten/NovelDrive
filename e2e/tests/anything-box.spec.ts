import { test, expect } from '@playwright/test';
import { ElectronHelpers } from '../utils/electron-helpers';
import { testData } from '../fixtures/test-data';

test.describe('AnythingBox Feature', () => {
  let electronHelpers: ElectronHelpers;

  test.beforeEach(async () => {
    electronHelpers = new ElectronHelpers();
    const { mainWindow } = await electronHelpers.launchApp();
    
    // Navigate to AnythingBox
    await electronHelpers.clickElement('[data-testid="nav-anything-box"]');
    await electronHelpers.waitForElement('[data-testid="anything-box-page"]');
  });

  test.afterEach(async () => {
    await electronHelpers.closeApp();
  });

  test('should display AnythingBox interface correctly', async () => {
    // Check for main elements
    await electronHelpers.waitForElement('[data-testid="content-textarea"]');
    await electronHelpers.waitForElement('[data-testid="submit-button"]');
    
    // Check for title
    const title = await electronHelpers.getElementText('[data-testid="anything-box-title"]');
    expect(title).toContain('Anything Box');
    
    // Check for placeholder text
    const mainWindow = electronHelpers.getMainWindow();
    if (mainWindow) {
      const placeholder = await mainWindow.getAttribute('[data-testid="content-textarea"]', 'placeholder');
      expect(placeholder).toBeTruthy();
    }
  });

  test.skip('should process text input and generate inspirations', async () => {
    const { sampleNote } = testData.anythingBox;
    
    // Input text
    await electronHelpers.fillInput('[data-testid="content-textarea"]', sampleNote.content);
    
    // Submit
    await electronHelpers.clickElement('[data-testid="submit-button"]');
    
    // Wait for processing
    await electronHelpers.waitForElement('[data-testid="processing-indicator"]');
    
    // Wait for results
    await electronHelpers.waitForElement('[data-testid="inspiration-results"]', 30000);
    
    // Check that inspirations were generated
    const mainWindow = electronHelpers.getMainWindow();
    if (mainWindow) {
      const inspirations = await mainWindow.$$('[data-testid="inspiration-item"]');
      expect(inspirations.length).toBeGreaterThan(0);
      
      // Verify at least one expected inspiration keyword appears
      const inspirationTexts = await Promise.all(
        inspirations.map(el => el.textContent())
      );
      
      const hasExpectedKeyword = sampleNote.expectedInspirations.some(keyword =>
        inspirationTexts.some(text => text?.includes(keyword))
      );
      expect(hasExpectedKeyword).toBe(true);
    }
  });

  test.skip('should handle URL input', async () => {
    const { sampleUrl } = testData.anythingBox;
    
    // Input URL
    await electronHelpers.fillInput('[data-testid="content-textarea"]', sampleUrl.content);
    
    // Submit
    await electronHelpers.clickElement('[data-testid="submit-button"]');
    
    // Wait for processing
    await electronHelpers.waitForElement('[data-testid="processing-indicator"]');
    
    // Check that URL is detected
    const mainWindow = electronHelpers.getMainWindow();
    if (mainWindow) {
      const typeIndicator = await electronHelpers.getElementText('[data-testid="content-type-indicator"]');
      expect(typeIndicator?.toLowerCase()).toContain(sampleUrl.expectedType);
    }
  });

  test.skip('should save content to knowledge base', async () => {
    const { sampleNote } = testData.anythingBox;
    
    // Input and submit content
    await electronHelpers.fillInput('[data-testid="content-textarea"]', sampleNote.content);
    await electronHelpers.clickElement('[data-testid="submit-button"]');
    
    // Wait for processing
    await electronHelpers.waitForElement('[data-testid="inspiration-results"]', 30000);
    
    // Click save button
    await electronHelpers.clickElement('[data-testid="save-to-knowledge-base"]');
    
    // Wait for save confirmation
    await electronHelpers.waitForElement('[data-testid="save-success-message"]');
    
    // Verify success message
    const successMessage = await electronHelpers.getElementText('[data-testid="save-success-message"]');
    expect(successMessage).toContain('保存されました');
  });

  test('should accept text input and have submit button', async () => {
    const { sampleNote } = testData.anythingBox;
    
    // Input text
    await electronHelpers.fillInput('[data-testid="content-textarea"]', sampleNote.content);
    
    // Check that input was accepted
    const mainWindow = electronHelpers.getMainWindow();
    if (mainWindow) {
      const inputValue = await mainWindow.inputValue('[data-testid="content-textarea"]');
      expect(inputValue).toBe(sampleNote.content);
      
      // Verify submit button is enabled
      const submitButton = await mainWindow.$('[data-testid="submit-button"]');
      const isDisabled = await submitButton?.getAttribute('disabled');
      expect(isDisabled).toBeNull();
    }
  });

  test.skip('should display processing history', async () => {
    const { sampleNote } = testData.anythingBox;
    
    // Submit multiple items
    for (let i = 0; i < 3; i++) {
      await electronHelpers.fillInput('[data-testid="content-textarea"]', `${sampleNote.content} ${i + 1}`);
      await electronHelpers.clickElement('[data-testid="submit-button"]');
      await electronHelpers.waitForElement('[data-testid="inspiration-results"]', 30000);
      
      // Small delay between submissions
      const mainWindow = electronHelpers.getMainWindow();
      if (mainWindow) {
        await mainWindow.waitForTimeout(1000);
      }
    }
    
    // Check history section
    await electronHelpers.clickElement('[data-testid="view-history-button"]');
    await electronHelpers.waitForElement('[data-testid="history-list"]');
    
    // Verify history items
    const mainWindow = electronHelpers.getMainWindow();
    if (mainWindow) {
      const historyItems = await mainWindow.$$('[data-testid="history-item"]');
      expect(historyItems.length).toBe(3);
    }
  });

  test.skip('should handle empty input gracefully', async () => {
    // Try to submit empty input
    await electronHelpers.clickElement('[data-testid="submit-button"]');
    
    // Check for validation message
    await electronHelpers.waitForElement('[data-testid="validation-error"]');
    
    const errorMessage = await electronHelpers.getElementText('[data-testid="validation-error"]');
    expect(errorMessage).toContain('入力してください');
  });
});