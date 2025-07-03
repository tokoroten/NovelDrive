// DOM要素の取得
const counterDisplay = document.getElementById('counter');
const incrementBtn = document.getElementById('increment-btn');
const statusDisplay = document.getElementById('status');

// IndexedDBを使った永続化レイヤー
class PersistentCounter {
  constructor() {
    this.dbName = 'NovelDriveDB';
    this.storeName = 'counter';
    this.db = null;
  }

  // IndexedDBの初期化
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          // 初期値を設定
          store.add({ id: 1, value: 0 });
        }
      };
    });
  }

  // カウンター値の取得
  async getValue() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(1);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : 0);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // カウンター値の更新
  async setValue(value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({ id: 1, value: value });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // インクリメント
  async increment() {
    const currentValue = await this.getValue();
    const newValue = currentValue + 1;
    await this.setValue(newValue);
    return newValue;
  }
}

// アプリケーションの初期化
let counter = null;

async function initializeApp() {
  try {
    statusDisplay.textContent = 'Initializing persistent storage...';
    
    // IndexedDBベースのカウンターを初期化
    counter = new PersistentCounter();
    await counter.init();
    
    // 初期値を表示
    const value = await counter.getValue();
    counterDisplay.textContent = value;
    
    statusDisplay.textContent = 'Ready (data persisted in IndexedDB)';
    
  } catch (error) {
    console.error('Initialization error:', error);
    statusDisplay.textContent = `Error: ${error.message}`;
  }
}

// インクリメントボタンのハンドラー
incrementBtn.addEventListener('click', async () => {
  if (!counter) {
    statusDisplay.textContent = 'Not initialized';
    return;
  }
  
  try {
    statusDisplay.textContent = 'Incrementing...';
    
    // カウンターをインクリメント
    const newValue = await counter.increment();
    counterDisplay.textContent = newValue;
    
    statusDisplay.textContent = 'Counter incremented and saved';
    
  } catch (error) {
    console.error('Increment error:', error);
    statusDisplay.textContent = `Error: ${error.message}`;
  }
});

// DOMロード完了時に初期化
window.addEventListener('DOMContentLoaded', initializeApp);