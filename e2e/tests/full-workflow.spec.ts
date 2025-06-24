import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';

let app: ElectronApplication;
let page: Page;

test.describe('Full Workflow E2E Test', () => {
  test.beforeAll(async () => {
    // Electronアプリを起動
    app = await electron.launch({
      args: [path.join(__dirname, '../../dist/main/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // メインウィンドウを取得
    page = await app.firstWindow();
    
    // アプリが完全に読み込まれるのを待つ
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('プロジェクト作成から章の執筆までの完全なワークフロー', async () => {
    // Step 1: プロジェクトを作成
    await test.step('新規プロジェクトの作成', async () => {
      // ダッシュボードから新規プロジェクトボタンをクリック
      await page.click('button:has-text("新規プロジェクト")');
      
      // プロジェクト情報を入力
      await page.fill('input[name="projectName"]', 'E2Eテストプロジェクト');
      await page.fill('textarea[name="description"]', 'これはE2Eテスト用のプロジェクトです');
      await page.selectOption('select[name="genre"]', 'ファンタジー');
      
      // 作成ボタンをクリック
      await page.click('button[type="submit"]');
      
      // 成功メッセージを確認
      await expect(page.locator('text=プロジェクトが作成されました')).toBeVisible();
      
      // プロジェクト画面に遷移したことを確認
      await expect(page).toHaveURL(/.*project\/.*/);
    });

    // Step 2: なんでもボックスに情報を投入
    await test.step('なんでもボックスへの情報投入', async () => {
      // なんでもボックスタブをクリック
      await page.click('button:has-text("なんでもボックス")');
      
      // テキストを入力
      const inspirationText = `
        魔法使いの少年が、失われた古代の魔法書を探す冒険に出る。
        途中で出会う仲間たち：
        - エルフの弓使い（冷静で知的）
        - ドワーフの戦士（豪快で忠実）
        - 謎の吟遊詩人（実は重要な秘密を持つ）
      `;
      
      await page.fill('textarea[placeholder*="アイデア"]', inspirationText);
      
      // 処理ボタンをクリック
      await page.click('button:has-text("処理")');
      
      // 処理完了を確認
      await expect(page.locator('text=処理が完了しました')).toBeVisible();
      
      // ナレッジが作成されたことを確認
      await page.click('button:has-text("ナレッジグラフ")');
      await page.waitForTimeout(1000);
      await expect(page.locator('.knowledge-node')).toHaveCount(3, { timeout: 10000 });
    });

    // Step 3: プロットを生成
    await test.step('AIによるプロット生成', async () => {
      // プロット管理タブをクリック
      await page.click('button:has-text("プロット管理")');
      
      // プロット生成ボタンをクリック
      await page.click('button:has-text("AIでプロット生成")');
      
      // テーマを入力
      await page.fill('input[name="theme"]', '失われた魔法書を巡る冒険');
      
      // 生成開始
      await page.click('button:has-text("生成開始")');
      
      // プロット生成の完了を待つ（モックの場合は即座に完了）
      await expect(page.locator('text=プロットが生成されました')).toBeVisible({ timeout: 30000 });
      
      // 生成されたプロットが表示されることを確認
      await expect(page.locator('.plot-card')).toBeVisible();
    });

    // Step 4: エージェント会議室でプロットを議論
    await test.step('エージェント会議室での議論', async () => {
      // 生成されたプロットを選択
      await page.click('.plot-card:first-child');
      
      // エージェント会議室へ
      await page.click('button:has-text("エージェント会議室で議論")');
      
      // 議論開始
      await page.click('button:has-text("議論開始")');
      
      // エージェントの発言が表示されることを確認
      await expect(page.locator('.agent-message')).toBeVisible({ timeout: 10000 });
      
      // 人間として介入
      await page.fill('textarea[placeholder*="あなたの意見"]', '主人公の動機をもっと明確にしてください');
      await page.click('button:has-text("送信")');
      
      // 議論を終了
      await page.click('button:has-text("議論を終了")');
      
      // プロットが更新されたことを確認
      await expect(page.locator('text=プロットが更新されました')).toBeVisible();
    });

    // Step 5: 章の執筆
    await test.step('章の執筆', async () => {
      // 執筆エディタへ
      await page.click('button:has-text("執筆エディタ")');
      
      // 第1章を作成
      await page.click('button:has-text("新規章")');
      await page.fill('input[name="chapterTitle"]', '第1章：旅の始まり');
      
      // AIによる執筆支援を使用
      await page.click('button:has-text("AIで続きを書く")');
      
      // テキストが生成されることを確認
      await expect(page.locator('.editor-content')).toContainText('魔法使い', { timeout: 20000 });
      
      // 手動で編集
      await page.click('.editor-content');
      await page.keyboard.type('\n\n主人公は深呼吸をして、冒険への第一歩を踏み出した。');
      
      // 保存
      await page.click('button:has-text("保存")');
      await expect(page.locator('text=章が保存されました')).toBeVisible();
    });

    // Step 6: セレンディピティ検索
    await test.step('セレンディピティ検索の活用', async () => {
      // 検索ページへ
      await page.click('button:has-text("セレンディピティ検索")');
      
      // 検索実行
      await page.fill('input[placeholder*="検索"]', '冒険');
      await page.click('button:has-text("セレンディピティ検索")');
      
      // 予期しない関連アイテムが表示されることを確認
      await expect(page.locator('.search-result')).toHaveCount(3, { timeout: 10000 });
      
      // セレンディピティレベルを調整
      await page.fill('input[type="range"]', '0.8');
      await page.click('button:has-text("再検索")');
      
      // より多様な結果が表示されることを確認
      await expect(page.locator('.search-result.unexpected')).toBeVisible();
    });

    // Step 7: 分析ダッシュボードで進捗確認
    await test.step('分析ダッシュボードでの確認', async () => {
      // ダッシュボードへ
      await page.click('button:has-text("分析ダッシュボード")');
      
      // 各種統計が表示されることを確認
      await expect(page.locator('text=総文字数')).toBeVisible();
      await expect(page.locator('text=章の数')).toBeVisible();
      await expect(page.locator('text=ナレッジ数')).toBeVisible();
      
      // グラフが表示されることを確認
      await expect(page.locator('canvas')).toBeVisible();
    });
  });

  test('24時間自律モードの動作確認', async () => {
    await test.step('24時間モードの有効化', async () => {
      // 設定画面へ
      await page.click('button[aria-label="設定"]');
      
      // 24時間モードタブ
      await page.click('text=24時間自律モード');
      
      // モードを有効化
      await page.click('input[type="checkbox"][name="enable24HourMode"]');
      
      // 品質しきい値を設定
      await page.fill('input[name="qualityThreshold"]', '0.7');
      
      // 設定を保存
      await page.click('button:has-text("保存")');
      
      // 確認メッセージ
      await expect(page.locator('text=24時間モードが有効になりました')).toBeVisible();
    });

    await test.step('自律生成の動作確認', async () => {
      // ダッシュボードに戻る
      await page.click('button:has-text("ダッシュボード")');
      
      // 自律モードインジケーターが表示されることを確認
      await expect(page.locator('.autonomous-mode-indicator')).toBeVisible();
      await expect(page.locator('.autonomous-mode-indicator')).toContainText('稼働中');
      
      // しばらく待って新しいコンテンツが生成されることを確認
      // （テスト環境では高速化のため短時間で動作）
      await page.waitForTimeout(5000);
      
      // 新しい通知が表示されることを確認
      await expect(page.locator('.notification:has-text("新しいプロットが生成されました")')).toBeVisible();
    });
  });

  test('エラーハンドリングの確認', async () => {
    await test.step('無効な入力でのエラー表示', async () => {
      // プロジェクト作成画面へ
      await page.click('button:has-text("新規プロジェクト")');
      
      // 空の状態で送信
      await page.click('button[type="submit"]');
      
      // エラーメッセージが表示されることを確認
      await expect(page.locator('text=プロジェクト名は必須です')).toBeVisible();
    });

    await test.step('ネットワークエラーのハンドリング', async () => {
      // オフラインモードをシミュレート
      await page.context().setOffline(true);
      
      // API呼び出しを試みる
      await page.click('button:has-text("AIでプロット生成")');
      
      // エラーメッセージが表示されることを確認
      await expect(page.locator('text=ネットワークエラー')).toBeVisible();
      
      // オンラインに戻す
      await page.context().setOffline(false);
    });
  });
});