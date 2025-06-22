import { ipcMain } from 'electron';
import * as duckdb from 'duckdb';
import { AutonomousModeService } from './autonomous-mode-service';
import { MultiAgentOrchestrator } from './multi-agent-system';
import { 
  AutonomousConfig, 
  AutonomousStatus, 
  AutonomousLog,
  AutonomousContentType 
} from '../../shared/types';

export class AutonomousHandlers {
  private autonomousService: AutonomousModeService;

  constructor(conn: duckdb.Connection, orchestrator: MultiAgentOrchestrator) {
    this.autonomousService = new AutonomousModeService(conn, orchestrator);
    this.registerHandlers();
  }

  async initialize(): Promise<void> {
    await this.autonomousService.initialize();
  }

  private registerHandlers(): void {
    // Get autonomous configuration
    ipcMain.handle('autonomous:getConfig', async (): Promise<AutonomousConfig> => {
      try {
        return this.autonomousService.getConfiguration();
      } catch (error) {
        console.error('Failed to get autonomous config:', error);
        throw error;
      }
    });

    // Update autonomous configuration
    ipcMain.handle('autonomous:updateConfig', async (_, config: Partial<AutonomousConfig>): Promise<void> => {
      try {
        await this.autonomousService.updateConfiguration(config);
      } catch (error) {
        console.error('Failed to update autonomous config:', error);
        throw error;
      }
    });

    // Get autonomous status
    ipcMain.handle('autonomous:getStatus', async (): Promise<AutonomousStatus> => {
      try {
        return this.autonomousService.getStatus();
      } catch (error) {
        console.error('Failed to get autonomous status:', error);
        throw error;
      }
    });

    // Start autonomous mode
    ipcMain.handle('autonomous:start', async (): Promise<void> => {
      try {
        await this.autonomousService.start();
      } catch (error) {
        console.error('Failed to start autonomous mode:', error);
        throw error;
      }
    });

    // Stop autonomous mode
    ipcMain.handle('autonomous:stop', async (): Promise<void> => {
      try {
        await this.autonomousService.stop();
      } catch (error) {
        console.error('Failed to stop autonomous mode:', error);
        throw error;
      }
    });

    // Get autonomous logs
    ipcMain.handle('autonomous:getLogs', async (_, options?: {
      limit?: number;
      level?: 'info' | 'warn' | 'error' | 'debug';
      category?: 'operation' | 'quality' | 'resource' | 'system';
      operationId?: string;
      since?: Date;
    }): Promise<AutonomousLog[]> => {
      try {
        return await this.autonomousService.getLogs(options || {});
      } catch (error) {
        console.error('Failed to get autonomous logs:', error);
        throw error;
      }
    });

    // Queue autonomous operation
    ipcMain.handle('autonomous:queueOperation', async (_, type: AutonomousContentType, projectId?: string): Promise<string> => {
      try {
        return await this.autonomousService.queueOperation(type, projectId);
      } catch (error) {
        console.error('Failed to queue autonomous operation:', error);
        throw error;
      }
    });

    // Get log summary
    ipcMain.handle('autonomous:getLogSummary', async (_, days = 7) => {
      try {
        return await this.autonomousService.getLogs(); // Simplified for now
      } catch (error) {
        console.error('Failed to get log summary:', error);
        throw error;
      }
    });

    // Search logs
    ipcMain.handle('autonomous:searchLogs', async (_, query: string, options?: {
      limit?: number;
      category?: string;
      level?: string;
    }) => {
      try {
        // Simplified implementation - would need to add search to service
        return await this.autonomousService.getLogs(options?.limit || 50);
      } catch (error) {
        console.error('Failed to search logs:', error);
        throw error;
      }
    });

    // Clear old logs
    ipcMain.handle('autonomous:clearOldLogs', async (_, daysToKeep = 30): Promise<number> => {
      try {
        // Would need to implement in service
        return 0; // Placeholder
      } catch (error) {
        console.error('Failed to clear old logs:', error);
        throw error;
      }
    });
  }

  async cleanup(): Promise<void> {
    await this.autonomousService.cleanup();
  }
}