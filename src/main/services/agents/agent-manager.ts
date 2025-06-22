/**
 * エージェントマネージャー
 * 複数のエージェントの管理と調整を行う
 */

import { BaseAgent } from './base-agent';
import { WriterAgent } from './writer-agent';
import { EditorAgent } from './editor-agent';
import { ProofreaderAgent } from './proofreader-agent';
import { DeputyEditorAgent } from './deputy-editor-agent';
import { AgentRole, AgentMessage, DiscussionContext } from './agent-types';

export class AgentManager {
  private agents: Map<AgentRole, BaseAgent> = new Map();
  private discussionHistory: AgentMessage[] = [];

  constructor() {
    // Agents will be registered externally
  }

  /**
   * エージェントを登録
   */
  registerAgent(role: AgentRole, agent: BaseAgent): void {
    this.agents.set(role, agent);
  }

  /**
   * エージェントを取得
   */
  getAgent(role: AgentRole): BaseAgent | undefined {
    return this.agents.get(role);
  }

  /**
   * ディスカッションを開始
   */
  async startDiscussion(
    topic: string,
    context: DiscussionContext,
    participants: AgentRole[]
  ): Promise<AgentMessage[]> {
    this.discussionHistory = [];
    const messages: AgentMessage[] = [];

    // 各ラウンドで参加者が順番に発言
    for (let round = 0; round < context.maxRounds; round++) {
      for (const role of participants) {
        const agent = this.agents.get(role);
        if (!agent) continue;

        const previousMessages = [...this.discussionHistory];
        const response = await agent.respond(topic, previousMessages, context);
        
        const message: AgentMessage = {
          id: `${Date.now()}-${role}`,
          agentId: role,
          agentName: agent.getName(),
          agentRole: role,
          content: response,
          timestamp: new Date()
        };

        messages.push(message);
        this.discussionHistory.push(message);
      }
    }

    return messages;
  }

  /**
   * 人間の介入を追加
   */
  addHumanIntervention(content: string): void {
    const message: AgentMessage = {
      id: `${Date.now()}-human`,
      agentId: 'human',
      agentName: 'Human Editor',
      agentRole: 'human',
      content,
      timestamp: new Date()
    };
    this.discussionHistory.push(message);
  }

  /**
   * ディスカッション履歴を取得
   */
  getDiscussionHistory(): AgentMessage[] {
    return [...this.discussionHistory];
  }

  /**
   * ディスカッション履歴をクリア
   */
  clearDiscussionHistory(): void {
    this.discussionHistory = [];
  }
}