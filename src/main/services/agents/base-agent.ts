/**
 * ベースエージェントクラス
 * 全てのエージェントが継承する基底クラス
 */

import { AgentRole, AgentMessage, DiscussionContext } from './agent-types';
import { ICompletionService } from '../interfaces';

export abstract class BaseAgent {
  protected abstract role: AgentRole;
  protected abstract name: string;
  protected abstract personality: string;
  protected abstract temperature: number;

  constructor(protected completionService: ICompletionService) {}

  /**
   * エージェントの名前を取得
   */
  getName(): string {
    return this.name;
  }

  /**
   * エージェントの役割を取得
   */
  getRole(): AgentRole {
    return this.role;
  }

  /**
   * ディスカッションに応答
   */
  async respond(
    topic: string,
    previousMessages: AgentMessage[],
    context: DiscussionContext
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(topic, previousMessages, context);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.completionService.complete(messages, {
      temperature: this.temperature,
      maxTokens: 1000
    });

    return response;
  }

  /**
   * システムプロンプトを構築
   */
  protected buildSystemPrompt(): string {
    return `あなたは${this.name}という名前の${this.getJapaneseRole()}です。
${this.personality}

あなたの役割：
${this.getRoleDescription()}

議論する際の注意点：
- 簡潔で的確な意見を述べてください
- 他のエージェントの意見も尊重しつつ、自分の視点を明確に示してください
- 建設的な提案を心がけてください`;
  }

  /**
   * ユーザープロンプトを構築
   */
  protected buildUserPrompt(
    topic: string,
    previousMessages: AgentMessage[],
    context: DiscussionContext
  ): string {
    let prompt = `議題: ${topic}\n\n`;

    if (context.projectContext) {
      prompt += `プロジェクト情報:\n${JSON.stringify(context.projectContext, null, 2)}\n\n`;
    }

    if (previousMessages.length > 0) {
      prompt += `これまでの議論:\n`;
      previousMessages.forEach(msg => {
        prompt += `[${msg.agentName} (${this.getJapaneseRole(msg.agentRole as AgentRole)})]: ${msg.content}\n\n`;
      });
    }

    prompt += `上記を踏まえて、あなたの意見を述べてください。`;
    return prompt;
  }

  /**
   * 役割の日本語表記を取得
   */
  protected getJapaneseRole(role?: AgentRole): string {
    const roleToUse = role || this.role;
    const roleMap: Record<AgentRole, string> = {
      writer: '作家AI',
      editor: '編集者AI',
      proofreader: '校正者AI',
      deputy_editor: '副編集長AI',
      human: '人間'
    };
    return roleMap[roleToUse] || roleToUse;
  }

  /**
   * 役割の説明を取得（サブクラスで実装）
   */
  protected abstract getRoleDescription(): string;
}