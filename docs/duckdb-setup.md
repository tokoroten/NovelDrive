# DuckDB Setup Guide

## 概要

NovelDriveはDuckDBをメインデータベースとして使用しています。DuckDBはネイティブモジュールであるため、Electronで使用する際には適切なビルド設定が必要です。

## 問題と解決方法

### よくある問題

1. **"Cannot find module '../build/Release/duckdb.node'"エラー**
   - 原因: DuckDBのネイティブモジュールがElectron用に正しくビルドされていない
   - 解決: `npm run setup:duckdb`を実行

2. **ビルドツールが見つからないエラー**
   - 原因: C++コンパイラやPythonなどのビルドツールがインストールされていない
   - 解決: 下記の「必要なビルドツール」を参照

### 必要なビルドツール

#### Windows
1. Visual Studio Build Tools 2022
   - [ダウンロード](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
   - "Desktop development with C++"ワークロードを選択
2. Python 3.x
   - [ダウンロード](https://www.python.org/downloads/)

#### macOS
1. Xcode Command Line Tools
   ```bash
   xcode-select --install
   ```
2. Python (通常はプリインストール済み)

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install build-essential python3
```

### セットアップ手順

1. **初回セットアップ**
   ```bash
   # 依存関係のインストール
   npm install
   
   # DuckDBのセットアップ
   npm run setup:duckdb
   ```

2. **問題が発生した場合**
   ```bash
   # クリーンインストール
   npm run clean:install
   
   # または手動で
   rm -rf node_modules package-lock.json
   npm cache clean --force
   npm install
   npm run rebuild
   ```

3. **デバッグモード**
   ```bash
   # 詳細なログを表示
   export ELECTRON_REBUILD_DEBUG=true
   export DEBUG=electron-rebuild
   npm run rebuild
   ```

## トラブルシューティング

### 1. ビルドは成功するが実行時にエラーが発生する

**症状**: アプリケーション起動時に"Module version mismatch"エラー

**解決方法**:
```bash
# Electronのバージョンを確認
npx electron --version

# Node.jsのバージョンを確認
node --version

# 正しいElectronバージョンでリビルド
npm run rebuild
```

### 2. WSL環境での問題

**症状**: WSL2でビルドエラーが発生

**解決方法**:
```bash
# Windows側のパスではなくWSL内のパスを使用
cd /home/username/projects/NovelDrive

# ビルドツールのインストール
sudo apt-get update
sudo apt-get install build-essential

# セットアップ実行
npm run setup:duckdb
```

### 3. M1/M2 Macでの問題

**症状**: ARM64アーキテクチャでのビルドエラー

**解決方法**:
```bash
# Rosettaを使用してx64モードで実行
arch -x86_64 npm install
arch -x86_64 npm run rebuild
```

## フォールバック戦略

DuckDBのネイティブモジュールが使用できない場合、アプリケーションは以下のフォールバック戦略を実装しています：

1. **VSS（Vector Similarity Search）の無効化**
   - ベクトル検索機能は使用できませんが、基本的なデータベース機能は動作します

2. **インメモリデータベースの使用**
   - ファイルベースのデータベースの代わりにメモリ内データベースを使用

3. **開発モードでの警告表示**
   - ネイティブモジュールが正しくロードされていない場合、コンソールに警告を表示

## 開発者向けの推奨事項

1. **定期的なリビルド**
   - Electronやnode_modulesを更新した後は必ず`npm run rebuild`を実行

2. **CI/CD環境での考慮事項**
   - GitHub Actionsなどでは、ビルドツールのインストールステップを追加
   - プリビルトバイナリの使用を検討

3. **プロダクションビルド**
   - 各プラットフォーム用のビルドを別々に作成
   - ネイティブモジュールを含むパスが正しいことを確認

## 参考リンク

- [DuckDB公式ドキュメント](https://duckdb.org/docs/)
- [Electron Native Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
- [node-gyp Installation](https://github.com/nodejs/node-gyp#installation)