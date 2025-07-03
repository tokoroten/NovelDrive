// DOM要素の取得
const counterDisplay = document.getElementById('counter');
const incrementBtn = document.getElementById('increment-btn');
const statusDisplay = document.getElementById('status');

// カウンターの値を更新
async function updateCounter() {
  try {
    const result = await window.electronAPI.getCounter();
    counterDisplay.textContent = result.value;
    statusDisplay.textContent = 'Loaded from database';
  } catch (error) {
    statusDisplay.textContent = `Error: ${error.message}`;
  }
}

// インクリメントボタンのクリックハンドラー
incrementBtn.addEventListener('click', async () => {
  try {
    statusDisplay.textContent = 'Incrementing...';
    const result = await window.electronAPI.incrementCounter();
    counterDisplay.textContent = result.value;
    statusDisplay.textContent = 'Counter incremented and saved';
  } catch (error) {
    statusDisplay.textContent = `Error: ${error.message}`;
  }
});

// 初期化
updateCounter();