import { _electron as electron, ElectronApplication, Page } from 'playwright';
import path from 'path';

export class ElectronHelpers {
  private app: ElectronApplication | null = null;
  private mainWindow: Page | null = null;

  async launchApp(): Promise<{ app: ElectronApplication; mainWindow: Page }> {
    // Build the Electron app path
    const electronPath = path.join(__dirname, '../../node_modules/.bin/electron');
    const appPath = path.join(__dirname, '../../');

    // Launch Electron app
    this.app = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    // Wait for the first window to open
    this.mainWindow = await this.app.firstWindow();
    
    // Wait for the app to be ready
    await this.mainWindow.waitForLoadState('domcontentloaded');

    return { app: this.app, mainWindow: this.mainWindow };
  }

  async closeApp(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.app = null;
      this.mainWindow = null;
    }
  }

  async waitForElement(selector: string, timeout = 30000): Promise<void> {
    if (!this.mainWindow) {
      throw new Error('Main window is not initialized');
    }
    await this.mainWindow.waitForSelector(selector, { timeout });
  }

  async clickElement(selector: string): Promise<void> {
    if (!this.mainWindow) {
      throw new Error('Main window is not initialized');
    }
    await this.mainWindow.click(selector);
  }

  async fillInput(selector: string, value: string): Promise<void> {
    if (!this.mainWindow) {
      throw new Error('Main window is not initialized');
    }
    await this.mainWindow.fill(selector, value);
  }

  async getElementText(selector: string): Promise<string | null> {
    if (!this.mainWindow) {
      throw new Error('Main window is not initialized');
    }
    return await this.mainWindow.textContent(selector);
  }

  async takeScreenshot(name: string): Promise<void> {
    if (!this.mainWindow) {
      throw new Error('Main window is not initialized');
    }
    await this.mainWindow.screenshot({ 
      path: path.join(__dirname, `../../screenshots/${name}.png`),
      fullPage: true 
    });
  }

  async waitForNavigation(path: string): Promise<void> {
    if (!this.mainWindow) {
      throw new Error('Main window is not initialized');
    }
    await this.mainWindow.waitForURL(`**/index.html#${path}`);
  }

  getMainWindow(): Page | null {
    return this.mainWindow;
  }

  getApp(): ElectronApplication | null {
    return this.app;
  }
}