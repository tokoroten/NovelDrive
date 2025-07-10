# NovelDrive v3

NovelDriveは、マルチエージェント協調による創造的執筆支援システムです。複数のAIエージェントが協力して小説創作を支援し、人間の創作者と自然に対話しながら作品を磨き上げていきます。

## 🌟 v3の新機能

### マルチエージェント会話システム
- 複数のAIエージェント（作家、編集者、批評家）が自然に会話
- OpenAI Responses APIを活用した効率的な会話管理
- ユーザーが特定のエージェントに話しかけることが可能
- 観察モード：AI同士の議論を静かに観察

### モダンな技術スタック
- **フロントエンド**: React + TypeScript + Tailwind CSS
- **ビルドツール**: Vite
- **状態管理**: Zustand（予定）
- **AI API**: OpenAI GPT-4o with Responses API

## 🚀 クイックスタート

### 1. リポジトリのクローン
```bash
git clone https://github.com/yourusername/NovelDrive.git
cd NovelDrive
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. 環境設定
`.env`ファイルを作成し、OpenAI APIキーを設定：
```bash
cp .env.example .env
# .envファイルを編集してOPENAI_API_KEYを設定
```

### 4. 開発サーバーの起動
```bash
npm run dev
```

ブラウザで http://localhost:5173 を開いて使用開始！

## 🎮 使い方

### 基本的な使い方
1. 「会話を開始」ボタンをクリック
2. AIエージェントたちが創作について議論を始めます
3. あなたも会話に参加できます（誰に話しかけるか選択可能）

### 設定オプション
- **AI応答速度**: 即座〜3秒まで調整可能
- **観察モード**: チェックを入れるとAI同士の会話を観察のみ
- **発言先の選択**: 特定のエージェントまたは全員に向けて発言

### エージェントの紹介
- **✍️ 作家**: 創造的な視点と独自のビジョンを持つ
- **📝 編集者**: 構造と読者視点を重視する実務派
- **🎭 批評家**: 作品の深層を分析する鋭い洞察力

## 🏗️ プロジェクト構造

```
NovelDrive/
├── src/
│   ├── App.tsx           # メインアプリケーションコンポーネント
│   ├── agents.ts         # AIエージェントの定義
│   ├── types.ts          # TypeScript型定義
│   ├── openai-client.ts  # OpenAI APIクライアント
│   └── main.tsx          # アプリケーションエントリーポイント
├── docs/
│   └── v3-concept.md     # v3アーキテクチャ設計書
├── index.html            # HTMLエントリーポイント
├── vite.config.ts        # Vite設定
├── tailwind.config.js    # Tailwind CSS設定
└── tsconfig.json         # TypeScript設定
```

## 📝 開発ロードマップ

### ✅ 完了
- マルチエージェント会話システム
- OpenAI Responses API統合
- ユーザー参加機能
- 観察モード
- AI応答速度調整

### 🚧 開発中
- ドキュメント編集機能（ChatGPT Canvas風）
- エージェントごとの編集権限管理

### 📅 今後の予定
- 永続的な会話履歴
- カスタムエージェントの作成
- 小説プロジェクト管理
- エクスポート機能

## 🛠️ 技術詳細

### OpenAI Responses API
効率的な会話管理のため、`previous_response_id`を活用：
- 前回の応答IDを参照することで、文脈を保持
- トークン使用量を削減
- より自然な会話の流れを実現

### 構造化出力
JSON形式での応答を強制し、会話フローを制御：
```json
{
  "speaker": "エージェントID",
  "message": "発言内容",
  "next_speaker": {
    "type": "specific" | "random" | "user",
    "agent": "次の発言者ID"
  }
}
```

## 📖 詳細ドキュメント

- [v3コンセプト](docs/v3-concept.md) - 新アーキテクチャの詳細設計
- [API.md](API.md) - API仕様書（移行中）
- [CLAUDE.md](CLAUDE.md) - Claude Code用の開発ガイドライン

## 🤝 貢献

フィードバックや提案を歓迎します！

## 📄 ライセンス

ISC License

## 🔗 関連リンク

- [プロジェクトのGitHub](https://github.com/tokoroten/NovelDrive)
- [問題報告](https://github.com/tokoroten/NovelDrive/issues)