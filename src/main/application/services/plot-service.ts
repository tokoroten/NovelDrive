/**
 * プロット管理アプリケーションサービス
 */

import { v4 as uuidv4 } from 'uuid';
import { Plot, PlotStructure } from '../../domain/entities';
import { IUnitOfWork } from '../../domain/repositories';
import { PlotVersioningService, PlotAnalysisService } from '../../domain/services';

export class PlotApplicationService {
  private versioningService: PlotVersioningService;
  private analysisService: PlotAnalysisService;

  constructor(private uow: IUnitOfWork) {
    this.versioningService = new PlotVersioningService();
    this.analysisService = new PlotAnalysisService();
  }

  /**
   * 新しいプロットを作成
   */
  async createPlot(data: {
    projectId: string;
    title: string;
    synopsis: string;
    structure: PlotStructure;
    parentVersion?: string;
    createdBy?: string;
  }): Promise<Plot> {
    // バージョン番号を生成
    const existingPlots = await this.uow.plotRepository.findByProjectId(data.projectId);
    const existingVersions = existingPlots.map((p: Plot) => p.version);
    const version = this.versioningService.generateVersion(existingVersions, data.parentVersion);

    const plot = new Plot(
      uuidv4(),
      data.projectId,
      version,
      data.parentVersion || null,
      data.title,
      data.synopsis,
      data.structure,
      'draft',
      new Date(),
      new Date(),
      data.createdBy || 'human'
    );

    await this.uow.plotRepository.save(plot);
    return plot;
  }

  /**
   * プロットを分岐（新バージョン作成）
   */
  async forkPlot(plotId: string, modifications: {
    title?: string;
    synopsis?: string;
    structure?: PlotStructure;
    createdBy?: string;
  }): Promise<Plot> {
    const parentPlot = await this.uow.plotRepository.findById(plotId);
    if (!parentPlot) {
      throw new Error('Parent plot not found');
    }

    return this.createPlot({
      projectId: parentPlot.projectId,
      title: modifications.title || `${parentPlot.title} (改訂版)`,
      synopsis: modifications.synopsis || parentPlot.synopsis,
      structure: modifications.structure || parentPlot.structure,
      parentVersion: parentPlot.version,
      createdBy: modifications.createdBy || 'human'
    });
  }

  /**
   * プロットを更新
   */
  async updatePlot(id: string, updates: {
    title?: string;
    synopsis?: string;
    structure?: PlotStructure;
  }): Promise<Plot> {
    const plot = await this.uow.plotRepository.findById(id);
    if (!plot) {
      throw new Error('Plot not found');
    }

    plot.updateContent(updates);
    await this.uow.plotRepository.save(plot);
    return plot;
  }

  /**
   * プロットのステータスを更新
   */
  async updatePlotStatus(id: string, status: 'draft' | 'reviewing' | 'approved' | 'rejected'): Promise<Plot> {
    const plot = await this.uow.plotRepository.findById(id);
    if (!plot) {
      throw new Error('Plot not found');
    }

    plot.updateStatus(status);
    await this.uow.plotRepository.save(plot);
    return plot;
  }

  /**
   * プロットを分析
   */
  async analyzePlot(plotId: string): Promise<{
    emotionalBalance: ReturnType<PlotAnalysisService['calculateEmotionalBalance']>;
    conflictLevel: number;
    paceScore: number;
  }> {
    const plot = await this.uow.plotRepository.findById(plotId);
    if (!plot) {
      throw new Error('Plot not found');
    }

    return {
      emotionalBalance: this.analysisService.calculateEmotionalBalance(plot.structure),
      conflictLevel: this.analysisService.calculateConflictLevel(plot.structure),
      paceScore: this.analysisService.calculatePaceScore(plot.structure)
    };
  }

  /**
   * プロットを取得
   */
  async getPlot(id: string): Promise<Plot> {
    const plot = await this.uow.plotRepository.findById(id);
    if (!plot) {
      throw new Error('Plot not found');
    }
    return plot;
  }

  /**
   * プロジェクトのプロット履歴を取得
   */
  async getPlotHistory(projectId: string): Promise<Plot[]> {
    return this.uow.plotRepository.findByProjectId(projectId);
  }

  /**
   * プロットのバージョンツリーを取得
   */
  async getPlotVersionTree(projectId: string): Promise<any> {
    const plots = await this.uow.plotRepository.findByProjectId(projectId);
    return this.versioningService.buildVersionTree(plots);
  }

  /**
   * プロットを削除
   */
  async deletePlot(id: string): Promise<void> {
    const exists = await this.uow.plotRepository.exists(id);
    if (!exists) {
      throw new Error('Plot not found');
    }

    // 子バージョンがある場合は削除不可
    const children = await this.uow.plotRepository.findChildren(id);
    if (children.length > 0) {
      throw new Error('Cannot delete plot with child versions');
    }

    await this.uow.plotRepository.delete(id);
  }
}