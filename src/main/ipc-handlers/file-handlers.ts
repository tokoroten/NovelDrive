/**
 * ファイル操作関連のIPCハンドラー
 */

import { ipcMain, dialog } from 'electron';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { DIContainer } from '../core/di-container';

export function setupFileHandlers(container: DIContainer): void {
  // ファイルの保存ダイアログ
  ipcMain.handle('file:save', async (_, options: { title?: string; defaultPath?: string; filters?: Electron.FileFilter[] }) => {
    const result = await dialog.showSaveDialog({
      title: options.title || 'ファイルを保存',
      defaultPath: options.defaultPath,
      filters: options.filters || [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      return { success: true, data: { filePath: result.filePath } };
    }
    return { success: false, error: 'キャンセルされました' };
  });

  // ファイルの選択ダイアログ
  ipcMain.handle('file:open', async (_, options: { title?: string; filters?: Electron.FileFilter[]; properties?: Electron.OpenDialogOptions['properties'] }) => {
    const result = await dialog.showOpenDialog({
      title: options.title || 'ファイルを選択',
      filters: options.filters || [
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: options.properties || ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, data: { filePaths: result.filePaths } };
    }
    return { success: false, error: 'キャンセルされました' };
  });

  // ファイルの書き込み
  ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
    try {
      writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'ファイルの書き込みに失敗しました' 
      };
    }
  });

  // エクスポート
  ipcMain.handle('export:text', async (_, documentIds: string[], format: 'txt' | 'md') => {
    // モック実装
    const result = await dialog.showSaveDialog({
      title: 'エクスポート先を選択',
      defaultPath: `export_${new Date().toISOString().split('T')[0]}.${format}`,
      filters: format === 'md' 
        ? [{ name: 'Markdown Files', extensions: ['md'] }]
        : [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (!result.canceled && result.filePath) {
      // モックデータをエクスポート
      const content = documentIds.map(id => `Document ${id} content`).join('\n\n');
      writeFileSync(result.filePath, content, 'utf-8');
      return { success: true, data: { filePath: result.filePath } };
    }
    return { success: false, error: 'エクスポートがキャンセルされました' };
  });
}