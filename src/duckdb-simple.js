// DOM要素の取得
const counterDisplay = document.getElementById('counter');
const incrementBtn = document.getElementById('increment-btn');
const statusDisplay = document.getElementById('status');

let db = null;
let conn = null;
let counterValue = 0;

// シンプルなファイルベースの永続化を使用
async function initializeApp() {
  try {
    statusDisplay.textContent = 'Initializing...';
    
    // ElectronのIPCを使ってカウンター値を読み込む
    const result = await window.electronAPI.getCounter();
    counterValue = result.value;
    counterDisplay.textContent = counterValue;
    
    statusDisplay.textContent = 'Ready (SQLite3 database)';
    
  } catch (error) {
    console.error('Initialization error:', error);
    statusDisplay.textContent = `Error: ${error.message}`;
  }
}

// インクリメントボタンのハンドラー
incrementBtn.addEventListener('click', async () => {
  try {
    statusDisplay.textContent = 'Incrementing...';
    
    // ElectronのIPCを使ってインクリメント
    const result = await window.electronAPI.incrementCounter();
    counterValue = result.value;
    counterDisplay.textContent = counterValue;
    
    statusDisplay.textContent = 'Counter incremented and saved';
    
  } catch (error) {
    console.error('Increment error:', error);
    statusDisplay.textContent = `Error: ${error.message}`;
  }
});

// アプリケーションの初期化
window.addEventListener('DOMContentLoaded', initializeApp);