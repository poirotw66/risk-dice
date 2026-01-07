# 🎯 下一步：設定 Firebase

Firebase Realtime Database 已經整合完成！現在你需要設定 Firebase 專案來啟用全域共享 STREAK 功能。

## 📋 設定檢查清單

### ✅ 已完成
- [x] 安裝 Firebase SDK
- [x] 建立 Firebase 配置檔案 ([src/firebase.ts](src/firebase.ts))
- [x] 整合到 App.tsx
- [x] 建立環境變數範本 ([.env.example](.env.example))
- [x] 更新 .gitignore（保護你的 Firebase 金鑰）
- [x] 建立 TypeScript 類型定義

### ⏳ 需要你完成

#### 1. 建立 Firebase 專案（10 分鐘）

跟著 [FIREBASE_SETUP.md](FIREBASE_SETUP.md) 的詳細步驟：

1. 前往 https://console.firebase.google.com/
2. 建立新專案
3. 啟用 Realtime Database
4. 複製配置資訊

#### 2. 設定本地環境變數（2 分鐘）

```bash
# 複製範本檔案
cp .env.example .env

# 編輯 .env 檔案，填入你的 Firebase 配置
# (使用任何文字編輯器開啟 .env)
```

#### 3. 測試本地運行（1 分鐘）

```bash
# 啟動開發伺服器
npm run dev

# 打開多個瀏覽器分頁測試 STREAK 同步
```

#### 4. 部署到 GitHub Pages（5 分鐘）

如果要在 GitHub Pages 啟用全域 STREAK：

1. 前往你的 GitHub 倉庫 Settings → Secrets and variables → Actions
2. 新增以下 secrets（從你的 .env 複製值）：
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

3. 更新 GitHub Actions workflow（如果還沒更新）

詳細步驟請參考 [FIREBASE_SETUP.md](FIREBASE_SETUP.md) 的「部署到 GitHub Pages」章節。

## 🎮 功能說明

### 啟用 Firebase 後：
- ✨ 所有玩家看到相同的 STREAK 值
- 🔄 任何人抽到「大吉」，全球 STREAK +1
- 💥 任何人抽到「大凶」，全球 STREAK 歸零
- ⚡ 即時同步，不需要重新整理頁面

### 沒有設定 Firebase：
- 📱 自動使用本地模式
- 🏠 STREAK 只在你的裝置上記錄
- ✅ 遊戲正常運作，不會有任何錯誤

## 🔍 如何確認 Firebase 是否正常運作？

打開瀏覽器開發者工具（按 F12），在 Console 中應該會看到：

```
Firebase initialized successfully
Firebase configured, using global streak
```

如果看到 `Firebase not configured, using local streak`，表示環境變數未正確設定。

## 📚 文件索引

- **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)** - 完整的 Firebase 設定教學
- **[README.md](README.md)** - 專案說明
- **[DEPLOY.md](DEPLOY.md)** - 部署指南
- **[.env.example](.env.example)** - 環境變數範本

## ❓ 需要幫助？

如果遇到問題，查看 [FIREBASE_SETUP.md](FIREBASE_SETUP.md) 的「故障排除」章節。

---

**提示：** 如果你只想在本地測試，不需要立即設定 Firebase。遊戲會自動以本地模式運行。
