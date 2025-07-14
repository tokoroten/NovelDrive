# NovelDrive v3

NovelDriveは、マルチエージェント協調による創造的執筆支援システムです。複数のAIエージェントが協力して小説創作を支援し、人間の創作者と自然に対話しながら作品を磨き上げていきます。

🌐 **[オンライン版を試す](https://tokoroten.github.io/NovelDrive/)**

## 🌟 主な機能

### マルチエージェント会話システム
- 複数のAIエージェント（作家、編集者、批評家など）が自然に会話
- OpenAI/Claude APIを活用した効率的な会話管理
- ユーザーが特定のエージェントに話しかけることが可能
- 観察モード：AI同士の議論を静かに観察

### ドキュメント協働編集
- リアルタイムで複数のエージェントがドキュメントを編集
- 高度なdiffアルゴリズムによる正確なテキスト置換
- 編集履歴の完全なトレーサビリティ
- 編集権限の管理システム

### 高度な会話管理
- 自動会話要約機能（設定可能な閾値）
- 複数回の要約にも対応する履歴管理
- セッション単位での会話保存
- 会話履歴のタイムライン表示

## 🚀 クイックスタート

### 1. リポジトリのクローン
```bash
git clone https://github.com/tokoroten/NovelDrive.git
cd NovelDrive
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. APIキーの設定
アプリケーション内の設定画面から、以下のいずれかのAPIキーを設定：
- OpenAI API Key
- Claude API Key

### 4. 開発サーバーの起動
```bash
npm run dev
```

ブラウザで http://localhost:5173 を開いて使用開始！

## 🎮 使い方

### 基本的な使い方
1. 設定画面でAPIキーを入力
2. エージェントを選択（複数選択可能）
3. 「会話を開始」ボタンをクリック
4. AIエージェントたちが創作について議論を始めます
5. あなたも会話に参加できます（誰に話しかけるか選択可能）

### 設定オプション
- **LLMプロバイダー**: OpenAI/Claudeから選択
- **モデル選択**: GPT-4o-mini、Claude 3.5 Sonnetなど
- **AI応答速度**: 即座〜3秒まで調整可能
- **観察モード**: チェックを入れるとAI同士の会話を観察のみ
- **自動要約**: 会話が指定ターン数を超えたら自動的に要約

### エージェントの紹介
- **✍️ 作家「夢織」**: 創造的な視点と独自のビジョンを持つ
- **📝 編集者「赤羽」**: 構造と読者視点を重視する実務派
- **🎭 批評家「辛島」**: 作品の深層を分析する鋭い洞察力
- **👩‍🔬 言語学者「紡」**: 言葉と文体にこだわる専門家
- **🎯 ターゲット分析官「狙」**: 読者層と市場を分析
- **🌏 世界構築師「創界」**: 設定と世界観を構築
- **💫 プロット構成師「筋書」**: 物語の流れを設計
- その他、多様な専門性を持つエージェント

## 🏗️ プロジェクト構造

```
NovelDrive/
├── src/
│   ├── App.tsx              # メインアプリケーションコンポーネント
│   ├── agents.ts            # AIエージェントの定義
│   ├── types.ts             # TypeScript型定義
│   ├── store.ts             # Zustand状態管理
│   ├── llm/                 # LLMプロバイダー統合
│   │   ├── openai.ts        # OpenAI API実装
│   │   └── claude.ts        # Claude API実装
│   ├── components/          # UIコンポーネント
│   │   ├── Settings.tsx     # 設定画面
│   │   ├── AgentManager.tsx # エージェント管理
│   │   └── Help.tsx         # ヘルプダイアログ
│   ├── utils/               # ユーティリティ
│   │   ├── diffWorkerHelper.ts    # diff処理ヘルパー
│   │   ├── conversationManager.ts # 会話履歴管理
│   │   └── conversationSummarizer.ts # 会話要約
│   └── db/                  # IndexedDB永続化
├── public/
│   └── diffWorkerV2.js      # Web Worker for diff計算
├── docs/
│   └── v3-concept.md        # v3アーキテクチャ設計書
├── dev_diary/               # 開発日誌
├── index.html               # HTMLエントリーポイント
├── vite.config.ts           # Vite設定
├── tailwind.config.js       # Tailwind CSS設定
└── tsconfig.json            # TypeScript設定
```

## 💻 技術スタック

- **フロントエンド**: React 18 + TypeScript 5
- **ビルドツール**: Vite 5
- **状態管理**: Zustand 4
- **スタイリング**: Tailwind CSS 3
- **データ永続化**: IndexedDB (Dexie)
- **AI API**: OpenAI GPT-4o / Anthropic Claude 3.5
- **差分アルゴリズム**: カスタムBitapアルゴリズム（ファジーマッチング対応）

## 🛠️ 技術詳細

### 高度なdiff処理
- Bitapアルゴリズムによるファジーマッチング
- 全角・半角文字の自動正規化
- 3段階のマッチング戦略（exact → normalized → fuzzy）
- Web Workerによる非同期処理でUIをブロックしない

### 会話履歴管理
- ConversationManagerによる複数回要約の適切な処理
- 要約の要約（summary-of-summaries）を防ぐ仕組み
- メモリ効率を考慮した古い会話の自動削除

### マルチLLMサポート
- 統一されたインターフェースで複数のLLMプロバイダーに対応
- プロバイダー間の切り替えが容易
- Function Callingによる構造化された応答

## 📝 開発ロードマップ

### ✅ 完了
- マルチエージェント会話システム
- ドキュメント協働編集機能
- 高度なdiff処理アルゴリズム
- 会話の自動要約機能
- セッション管理とタイムライン
- マルチLLMプロバイダー対応
- エージェント管理UI
- ヘルプシステム

### 🚧 開発中
- より高度なエージェントカスタマイズ
- プロジェクト管理機能

### 📅 今後の予定
- エクスポート機能の拡充
- プラグインシステム
- チーム協働機能
- 音声対話機能

## 🤝 貢献

フィードバックや提案を歓迎します！
[Issues](https://github.com/tokoroten/NovelDrive/issues)でバグ報告や機能リクエストをお寄せください。

## 📄 ライセンス

ISC License

## 🔗 関連リンク

- [オンライン版](https://tokoroten.github.io/NovelDrive/)
- [プロジェクトのGitHub](https://github.com/tokoroten/NovelDrive)
- [問題報告](https://github.com/tokoroten/NovelDrive/issues)