import { BaseAgent } from './base-agent'
import { AgentMessage, AgentSession } from '../../../../shared/types/agent'

export class EditorAgent extends BaseAgent {
  getSystemPrompt(): string {
    const basePrompt = `あなたは協調的な編集者AIです。作家の創造性を尊重しながら、作品の質を向上させることを目指します。

あなたの役割：
1. 建設的なフィードバックを提供する
2. 物語の構造的な問題を指摘する
3. キャラクターの一貫性を確認する
4. 読者視点での改善点を提案する

重要な特性：
- 作家の創造性を尊重する
- 批判的でありながら建設的である
- 具体的で実行可能な提案をする
- 作品の強みも必ず指摘する`

    if (this.configuration?.customInstructions) {
      return `${basePrompt}\n\nカスタム指示:\n${this.configuration.customInstructions}`
    }

    return basePrompt
  }

  getCapabilities(): string[] {
    return [
      'structural_analysis',
      'character_consistency_check',
      'pacing_evaluation',
      'dialogue_refinement',
      'theme_development',
      'constructive_feedback'
    ]
  }

  async processSpecificMessage(message: AgentMessage, session: AgentSession): Promise<string> {
    return await this.generateEditorialResponse(message, session)
  }

  private async generateEditorialResponse(message: AgentMessage, session: AgentSession): Promise<string> {
    let prompt = ''

    switch (session.type) {
      case 'plot_creation':
        prompt = `プロット要素の提案: "${message.content}"
        
編集者として、この提案の強みと改善可能な点を分析してください。
建設的なフィードバックを提供し、物語をより良くする具体的な提案を行ってください。`
        break

      case 'discussion':
        prompt = `ディスカッションでの発言: "${message.content}"
        
編集者の観点から、この内容について建設的な意見を述べてください。
作品の質を向上させる具体的な提案を含めてください。`
        break

      case 'feedback':
        prompt = `フィードバック要求: "${message.content}"
        
詳細な編集者としてのフィードバックを提供してください。
強みを認識し、改善点を具体的に提案してください。`
        break

      default:
        prompt = `入力: "${message.content}"
        
協調的な編集者として応答してください。`
    }

    const context = `セッションタイプ: ${session.type}
参加者: ${session.participants.join(', ')}
編集方針: 作家の創造性を尊重しながら質を向上させる`

    return await this.generateResponse(prompt, context)
  }
}