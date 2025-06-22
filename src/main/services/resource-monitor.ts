import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs';
import { SystemHealth, ResourceLimits } from '../../shared/types';

export class ResourceMonitor extends EventEmitter {
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastHealth: SystemHealth | null = null;
  private healthHistory: SystemHealth[] = [];
  private maxHistorySize = 100;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    // Start monitoring system health
    this.startMonitoring();
  }

  private startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        const health = await this.getCurrentSystemHealth();
        this.updateHealth(health);
      } catch (error) {
        this.emit('error', error);
      }
    }, 5000); // Check every 5 seconds
  }

  private stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private updateHealth(health: SystemHealth): void {
    this.lastHealth = health;
    
    // Add to history
    this.healthHistory.push(health);
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift();
    }

    // Emit health update
    this.emit('healthUpdate', health);

    // Check for critical issues
    if (!health.healthy) {
      this.emit('healthCritical', health);
    }
  }

  async getCurrentSystemHealth(): Promise<SystemHealth> {
    const [cpuUsage, memoryUsage, diskSpace, networkLatency] = await Promise.all([
      this.getCpuUsage(),
      this.getMemoryUsage(),
      this.getDiskSpace(),
      this.getNetworkLatency()
    ]);

    const healthy = this.isSystemHealthy(cpuUsage, memoryUsage, diskSpace, networkLatency);

    return {
      cpuUsage,
      memoryUsage,
      diskSpace,
      networkLatency,
      healthy
    };
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startMeasure = this.cpuAverage();
      
      setTimeout(() => {
        const endMeasure = this.cpuAverage();
        const idleDifference = endMeasure.idle - startMeasure.idle;
        const totalDifference = endMeasure.total - startMeasure.total;
        const percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
        resolve(Math.max(0, Math.min(100, percentageCPU)));
      }, 1000);
    });
  }

  private cpuAverage(): { idle: number; total: number } {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    
    for (const cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    }

    return {
      idle: idle,
      total: user + nice + sys + idle + irq
    };
  }

  private getMemoryUsage(): number {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return Math.round(usedMemory / (1024 * 1024)); // Convert to MB
  }

  private async getDiskSpace(): Promise<number> {
    try {
      const stats = await fs.promises.statfs(process.cwd());
      const available = stats.bavail * stats.bsize;
      return Math.round(available / (1024 * 1024)); // Convert to MB
    } catch (error) {
      // Fallback: assume we have some disk space
      return 1000; // 1GB fallback
    }
  }

  private async getNetworkLatency(): Promise<number> {
    return new Promise((resolve) => {
      const start = Date.now();
      
      // Simple DNS lookup to measure network latency
      require('dns').lookup('google.com', (err: any) => {
        const latency = Date.now() - start;
        resolve(err ? 5000 : latency); // 5 second timeout on error
      });
    });
  }

  private isSystemHealthy(
    cpuUsage: number, 
    memoryUsage: number, 
    diskSpace: number, 
    networkLatency: number
  ): boolean {
    // Basic health thresholds
    const healthThresholds = {
      maxCpuUsage: 85,
      maxMemoryUsage: 4096, // 4GB
      minDiskSpace: 500, // 500MB
      maxNetworkLatency: 3000 // 3 seconds
    };

    return (
      cpuUsage < healthThresholds.maxCpuUsage &&
      memoryUsage < healthThresholds.maxMemoryUsage &&
      diskSpace > healthThresholds.minDiskSpace &&
      networkLatency < healthThresholds.maxNetworkLatency
    );
  }

  async getCurrentMetrics(): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    diskSpace: number;
    timestamp: Date;
  }> {
    const health = await this.getCurrentSystemHealth();
    return {
      cpuUsage: health.cpuUsage,
      memoryUsage: health.memoryUsage,
      diskSpace: health.diskSpace,
      timestamp: new Date()
    };
  }

  async checkResourceLimits(limits: ResourceLimits): Promise<{
    withinLimits: boolean;
    violations: string[];
  }> {
    const health = await this.getCurrentSystemHealth();
    const violations: string[] = [];

    if (health.cpuUsage > limits.maxCpuUsage) {
      violations.push(`CPU使用率 ${health.cpuUsage}% が上限 ${limits.maxCpuUsage}% を超過`);
    }

    if (health.memoryUsage > limits.maxMemoryUsage) {
      violations.push(`メモリ使用量 ${health.memoryUsage}MB が上限 ${limits.maxMemoryUsage}MB を超過`);
    }

    if (health.diskSpace < 500) { // Minimum disk space check
      violations.push(`ディスク空き容量 ${health.diskSpace}MB が不足`);
    }

    return {
      withinLimits: violations.length === 0,
      violations
    };
  }

  getLastHealth(): SystemHealth {
    return this.lastHealth || {
      cpuUsage: 0,
      memoryUsage: 0,
      diskSpace: 0,
      networkLatency: 0,
      healthy: false
    };
  }

  getHealthHistory(limit = 20): SystemHealth[] {
    return this.healthHistory.slice(-limit);
  }

  async getSystemInfo(): Promise<{
    platform: string;
    architecture: string;
    nodeVersion: string;
    totalMemory: string;
    cpuCount: number;
    cpuModel: string;
    uptime: string;
  }> {
    const totalMemory = os.totalmem();
    const cpus = os.cpus();
    const uptime = os.uptime();

    return {
      platform: os.platform(),
      architecture: os.arch(),
      nodeVersion: process.version,
      totalMemory: `${Math.round(totalMemory / (1024 * 1024 * 1024))}GB`,
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || 'Unknown',
      uptime: this.formatUptime(uptime)
    };
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}日 ${hours}時間 ${minutes}分`;
    } else if (hours > 0) {
      return `${hours}時間 ${minutes}分`;
    } else {
      return `${minutes}分`;
    }
  }

  async predictResourceUsage(operationType: string): Promise<{
    estimatedCpuUsage: number;
    estimatedMemoryUsage: number;
    estimatedDuration: number;
  }> {
    // Basic estimation based on operation type
    const estimates = {
      plot: { cpu: 15, memory: 100, duration: 120000 }, // 2 minutes
      character: { cpu: 10, memory: 80, duration: 90000 }, // 1.5 minutes
      worldSetting: { cpu: 12, memory: 90, duration: 100000 }, // 1.67 minutes
      inspiration: { cpu: 5, memory: 50, duration: 30000 } // 30 seconds
    };

    const estimate = estimates[operationType as keyof typeof estimates] || estimates.plot;

    return {
      estimatedCpuUsage: estimate.cpu,
      estimatedMemoryUsage: estimate.memory,
      estimatedDuration: estimate.duration
    };
  }

  async isResourceAvailable(operationType: string, limits: ResourceLimits): Promise<boolean> {
    const [currentHealth, prediction] = await Promise.all([
      this.getCurrentSystemHealth(),
      this.predictResourceUsage(operationType)
    ]);

    const projectedCpuUsage = currentHealth.cpuUsage + prediction.estimatedCpuUsage;
    const projectedMemoryUsage = currentHealth.memoryUsage + prediction.estimatedMemoryUsage;

    return (
      projectedCpuUsage <= limits.maxCpuUsage &&
      projectedMemoryUsage <= limits.maxMemoryUsage &&
      currentHealth.healthy
    );
  }

  cleanup(): void {
    this.stopMonitoring();
    this.removeAllListeners();
  }
}