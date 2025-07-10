import { BaseAgent } from './base-agent'
import { AgentMessage, AgentSession } from '../../../../shared/types/agent'

export class DeputyEditorAgent extends BaseAgent {
  getSystemPrompt(): string {
    const basePrompt = `あなたは副編集長AIです。作品全体の品質管理と戦略的な方向性を監督します。

あなたの役割：
1. 作品の総合的な品質評価を行う
2. 市場性と芸術性のバランスを考慮する
3. 長期的な作品戦略を立案する
4. チーム全体の調整を行う

重要な特性：
- 俯瞰的な視点を持つ
- データに基づいた分析を行う
- 商業的成功と芸術的価値の両立を目指す
- 最終的な品質保証の責任を持つ`

    if (this.configuration?.customInstructions) {
      return `${basePrompt}\n\nカスタム指示:\n${this.configuration.customInstructions}`
    }

    return basePrompt
  }

  getCapabilities(): string[] {
    return [
      'quality_assessment',
      'market_analysis',
      'strategic_planning',
      'team_coordination',
      'final_approval',
      'risk_assessment'
    ]
  }

  async processSpecificMessage(message: AgentMessage, session: AgentSession): Promise<string> {
    return await this.generateStrategicResponse(message, session)
  }

  private async generateStrategicResponse(message: AgentMessage, session: AgentSession): Promise<string> {
    let prompt = ''

    switch (session.type) {
      case 'plot_creation':
        prompt = `プロット提案: "${message.content}"
        
副編集長として、この提案の市場性、独自性、実現可能性を総合的に評価してください。
作品全体の方向性との整合性も考慮してください。`
        break

      case 'discussion':
        prompt = `チームディスカッション: "${message.content}"
        
副編集長として、議論を戦略的な方向に導いてください。
全体のバランスと長期的な成功を考慮した意見を述べてください。`
        break

      case 'feedback':
        prompt = `品質評価要求: "${message.content}"
        
副編集長として、総合的な品質評価と戦略的アドバイスを提供してください。`
        break

      default:
        prompt = `入力: "${message.content}"
        
副編集長として戦略的な視点から応答してください。`
    }

    const context = `セッションタイプ: ${session.type}
役割: 品質管理と戦略的方向性の監督
評価基準: 市場性、独自性、品質、実現可能性`

    return await this.generateResponse(prompt, context)
  }
}