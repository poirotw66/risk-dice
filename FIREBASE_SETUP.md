# Firebase 設定教學

本專案使用 Firebase Realtime Database 來實現全域共享的 STREAK 功能。所有使用者的 STREAK 數值會即時同步。

## 設定步驟

### 1. 建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 點擊「新增專案」或「Add project」
3. 輸入專案名稱（例如：`risk-dice`）
4. 選擇是否啟用 Google Analytics（可選）
5. 點擊「建立專案」

### 2. 啟用 Realtime Database

1. 在 Firebase Console 左側選單，點擊「建構」→「Realtime Database」
2. 點擊「建立資料庫」
3. 選擇資料庫位置（建議選擇離你的使用者最近的地區）
4. 選擇安全性規則：
   - 開發測試時可選「測試模式」（任何人都可讀寫）
   - 正式上線前請修改為更嚴格的規則

### 3. 設定資料庫安全性規則

在 Realtime Database 的「規則」頁籤中，設定以下規則：

#### 開發測試用（公開讀寫）：
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

#### 正式環境建議（限制寫入頻率）：
```json
{
  "rules": {
    "globalStreak": {
      ".read": true,
      ".write": true,
      ".validate": "newData.isNumber()"
    }
  }
}
```

### 4. 取得 Firebase 配置

1. 在 Firebase Console 點擊專案設定（齒輪圖示）
2. 在「一般」頁籤往下捲動到「你的應用程式」
3. 點擊「網頁」圖示（`</>`）新增網頁應用程式
4. 輸入應用程式暱稱（例如：`Risk Dice Web`）
5. 不需要勾選「設定 Firebase Hosting」
6. 點擊「註冊應用程式」
7. 複製 `firebaseConfig` 物件中的值

### 5. 設定環境變數

1. 複製 `.env.example` 為 `.env`：
   ```bash
   cp .env.example .env
   ```

2. 編輯 `.env` 檔案，填入你的 Firebase 配置：
   ```env
   VITE_FIREBASE_API_KEY=你的_API_KEY
   VITE_FIREBASE_AUTH_DOMAIN=你的專案.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://你的專案.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=你的專案ID
   VITE_FIREBASE_STORAGE_BUCKET=你的專案.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=你的_SENDER_ID
   VITE_FIREBASE_APP_ID=你的_APP_ID
   ```

   **重要：** `VITE_FIREBASE_DATABASE_URL` 的格式為：
   - 美國地區：`https://PROJECT_ID.firebaseio.com`
   - 其他地區：`https://PROJECT_ID.REGION.firebasedatabase.app`

### 6. 部署到 GitHub Pages 時的設定

如果要在 GitHub Pages 上使用 Firebase，需要設定 GitHub Secrets：

1. 前往 GitHub 倉庫的 Settings → Secrets and variables → Actions
2. 點擊「New repository secret」
3. 新增以下 secrets（名稱要完全相同）：
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

### 7. 修改 GitHub Actions Workflow

編輯 `.github/workflows/deploy.yml`，在 build 步驟前加入環境變數：

```yaml
- name: Build
  env:
    VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
    VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
    VITE_FIREBASE_DATABASE_URL: ${{ secrets.VITE_FIREBASE_DATABASE_URL }}
    VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
    VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
    VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
    VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
  run: npm run build:gh-pages
```

## 運作原理

### 全域 STREAK 功能

- **共享狀態**：所有使用者看到的 STREAK 值是相同的
- **即時同步**：當任何人抽到「大吉」時，所有連線的使用者會立即看到 STREAK +1
- **原子操作**：使用 Firebase Transaction 確保多人同時操作時數據一致性
- **自動重置**：當任何人抽到「大凶」時，全域 STREAK 重置為 0

### 本地 vs 全域模式

應用程式會自動檢測 Firebase 是否已配置：

- **已配置 Firebase**：使用全域共享的 STREAK（所有使用者共同累積）
- **未配置 Firebase**：使用本地 STREAK（僅自己的裝置記錄）

你可以在瀏覽器的開發者工具 Console 中看到相關訊息。

## 測試

### 本地開發測試
```bash
npm run dev
```

打開多個瀏覽器分頁，測試 STREAK 是否同步。

### 檢查 Firebase 連線狀態

打開瀏覽器開發者工具（F12），在 Console 中應該會看到：
- `Firebase initialized successfully` - Firebase 初始化成功
- `Firebase configured, using global streak` - 使用全域 STREAK
- `Global streak updated: X` - STREAK 值更新

## 故障排除

### 1. STREAK 沒有同步

- 檢查 `.env` 檔案是否正確填寫
- 檢查 Firebase Console 中 Realtime Database 是否已建立
- 檢查瀏覽器 Console 是否有錯誤訊息
- 確認 `VITE_FIREBASE_DATABASE_URL` 格式正確

### 2. 無法寫入數據

- 檢查 Firebase Realtime Database 的安全性規則
- 確認規則允許寫入 `globalStreak`

### 3. GitHub Pages 部署後無法連線

- 確認 GitHub Secrets 已正確設定
- 檢查 GitHub Actions 的 build log
- 確認環境變數在 workflow 中正確傳遞

### 4. 環境變數未載入

Vite 要求環境變數必須以 `VITE_` 開頭才能在前端存取。確保所有變數名稱都有 `VITE_` 前綴。

## 安全性注意事項

1. **API Key 洩露**：Firebase Web API Key 可以公開，但建議設定應用程式限制
2. **資料庫規則**：正式環境務必設定適當的安全性規則
3. **配額限制**：Firebase 免費方案有使用限制，注意監控用量
4. **惡意寫入**：考慮加入寫入頻率限制或驗證機制

## 成本

Firebase Realtime Database Spark（免費）方案：
- 同時連線：100 個
- 儲存空間：1 GB
- 下載流量：10 GB/月

對於小型專案完全足夠使用。

## 進階功能（可選）

### 加入使用者統計

可以擴充資料庫結構，記錄：
- 總遊玩次數
- 最高 STREAK 記錄
- 各面出現次數統計

### 排行榜功能

可以記錄不同使用者的最高 STREAK，建立全球排行榜。

### 加入 Authentication

使用 Firebase Authentication 來識別不同使用者，提供個人化體驗。
