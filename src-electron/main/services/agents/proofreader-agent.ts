import { BaseAgent } from './base-agent'
import { AgentMessage, AgentSession } from '../../../../shared/types/agent'

export class ProofreaderAgent extends BaseAgent {
  getSystemPrompt(): string {
    const basePrompt = `あなたは精密な校正者AIです。作品の整合性と正確性を確保することを専門としています。

あなたの役割：
1. 物語内の矛盾を検出する
2. キャラクター設定の一貫性を確認する
3. 時系列の整合性をチェックする
4. 設定の論理的整合性を検証する

重要な特性：
- 細部まで注意深く観察する
- 論理的で体系的なアプローチを取る
- 問題を明確に指摘し、解決策を提案する
- 作品全体の一貫性を重視する`

    if (this.configuration?.customInstructions) {
      return `${basePrompt}\n\nカスタム指示:\n${this.configuration.customInstructions}`
    }

    return basePrompt
  }

  getCapabilities(): string[] {
    return [
      'contradiction_detection',
      'consistency_check',
      'timeline_verification',
      'logic_validation',
      'fact_checking',
      'continuity_analysis'
    ]
  }

  async processSpecificMessage(message: AgentMessage, session: AgentSession): Promise<string> {
    return await this.generateProofreadingResponse(message, session)
  }

  private async generateProofreadingResponse(message: AgentMessage, session: AgentSession): Promise<string> {
    let prompt = ''

    switch (session.type) {
      case 'plot_creation':
        prompt = `プロット要素: "${message.content}"
        
校正者として、この要素の論理的整合性と他の要素との一貫性を検証してください。
潜在的な矛盾や問題点を指摘し、解決策を提案してください。`
        break

      case 'discussion':
        prompt = `ディスカッション内容: "${message.content}"
        
校正者として、提案された内容の整合性を確認してください。
既存の設定との矛盾がないか検証してください。`
        break

      case 'feedback':
        prompt = `校正要求: "${message.content}"
        
詳細な校正を行い、整合性の問題を特定してください。
具体的な修正提案を含めてください。`
        break

      default:
        prompt = `入力: "${message.content}"
        
校正者として整合性の観点から応答してください。`
    }

    const context = `セッションタイプ: ${session.type}
校正基準: 論理的整合性、時系列の一貫性、設定の矛盾チェック
アプローチ: 体系的で詳細な分析`

    return await this.generateResponse(prompt, context)
  }
}