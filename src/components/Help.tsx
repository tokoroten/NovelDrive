import React from 'react';

interface HelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Help: React.FC<HelpProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">📖 NovelDrive v3 ヘルプ</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-2">🚀 NovelDriveとは</h3>
            <p className="text-gray-700">
              NovelDriveは、複数のAIエージェントが協働して小説を執筆するWebアプリケーションです。
              作家、編集者、批評家、校正者など、異なる視点を持つエージェントが議論しながら物語を創り上げます。
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2">📝 使い方</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li><strong>APIキーの設定</strong>: 設定画面でOpenAIまたはClaudeのAPIキーを入力してください</li>
              <li><strong>エージェントの選択</strong>: エージェント管理で使用するエージェントを選択・カスタマイズできます</li>
              <li><strong>会議の開始</strong>: 「▶ 会議開始」ボタンでエージェントたちの議論を開始します</li>
              <li><strong>ユーザー参加</strong>: チャット欄にメッセージを入力して議論に参加できます</li>
              <li><strong>直接編集</strong>: 右側のエディタで直接ドキュメントを編集することも可能です</li>
            </ol>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2">🎯 主な機能</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>マルチエージェントによる協働執筆</li>
              <li>リアルタイムでのドキュメント編集</li>
              <li>エージェントのカスタマイズ（プロンプト、権限設定）</li>
              <li>作品の自動保存とバージョン管理</li>
              <li>複数作品の管理</li>
              <li>OpenAI/Claude APIの切り替え</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2">⚙️ エージェントの種類</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li><strong>作家（神谷恵）</strong>: 創造的な視点で物語を紡ぎます</li>
              <li><strong>編集者（中村健太）</strong>: 構造と読者視点を重視します</li>
              <li><strong>批評家（山田美咲）</strong>: 深い洞察と分析を提供します</li>
              <li><strong>編集長（三木一馬）</strong>: 議論をまとめ、方向性を示します</li>
              <li><strong>校正者（岩淵悦太郎）</strong>: 日本語の正確性をチェックします</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2">🔗 リンク</h3>
            <div className="space-y-2">
              <p>
                <a 
                  href="https://github.com/tokoroten/NovelDrive" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline flex items-center gap-1"
                >
                  <span>📦</span> GitHubリポジトリ
                </a>
              </p>
              <p>
                <a 
                  href="https://github.com/tokoroten/NovelDrive/issues" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline flex items-center gap-1"
                >
                  <span>🐛</span> バグ報告・機能要望
                </a>
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2">💡 トラブルシューティング</h3>
            <div className="space-y-2 text-gray-700 text-sm">
              <div>
                <strong>エージェントの編集が失敗する場合:</strong>
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>エージェントは小さな部分を編集するよう設計されています</li>
                  <li>大きな変更は複数回に分けて行われます</li>
                  <li>改行を含む編集は特に注意が必要です</li>
                  <li>編集に失敗した場合、エージェントは別の方法を試みます</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">⚠️ 注意事項</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
              <li>APIキーは各自で取得し、安全に管理してください</li>
              <li>AIの生成には料金が発生する場合があります</li>
              <li>長時間の会議は大量のトークンを消費する可能性があります</li>
              <li>作品はブラウザのローカルストレージに保存されます</li>
            </ul>
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};