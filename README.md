<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Risk Dice | 風險骰子

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

一個使用 React Three Fiber 構建的 3D 二十面體風險骰子遊戲。

## 功能特色

- 🎲 完美的正二十面體 3D 骰子
- 🎨 流暢的物理動畫模擬
- 🎯 自動對齊到骰到的面
- 🎪 視覺效果和音效
- 📊 統計追蹤（連勝、總投擲次數）
- 🌍 **全域共享 STREAK**：所有玩家的 STREAK 即時同步累積（需設定 Firebase）

## Firebase 全域 STREAK 功能

本專案支援使用 Firebase Realtime Database 來實現**全域共享的 STREAK 功能**。啟用後，所有使用者的 STREAK 數值會即時同步，真正實現「全球玩家一起累積運氣」的體驗！

### 快速設定

1. 查看 [FIREBASE_SETUP.md](FIREBASE_SETUP.md) 取得完整設定教學
2. 複製 `.env.example` 為 `.env` 並填入你的 Firebase 配置
3. 如果不設定 Firebase，遊戲會自動使用本地 STREAK 模式

詳細的 Firebase 設定步驟、安全性規則、部署配置等資訊，請參考 **[Firebase 設定教學](FIREBASE_SETUP.md)**。

## 本地運行

**前置需求:** Node.js

1. 安裝依賴：
   ```bash
   npm install
   ```

2. 運行開發服務器：
   ```bash
   npm run dev
   ```

3. 在瀏覽器中打開 `http://localhost:3000`

## 部署到 GitHub Pages

### 自動部署（推薦）

項目已配置 GitHub Actions，當您推送代碼到 `main` 或 `master` 分支時，會自動構建並部署。

**步驟：**

1. **確保倉庫名稱正確**
   - 如果您的 GitHub 倉庫名稱不是 `risk-dice-(risky-dice)`，請修改 `vite.config.ts` 中的 `base` 配置

2. **啟用 GitHub Pages**
   - 前往倉庫的 Settings > Pages
   - Source 選擇 "GitHub Actions"
   - 保存設置

3. **推送代碼**
   ```bash
   git add .
   git commit -m "準備部署到 GitHub Pages"
   git push origin main
   ```

4. **查看部署狀態**
   - 前往倉庫的 Actions 標籤頁查看部署進度
   - 部署完成後，網站將在 `https://您的用戶名.github.io/您的倉庫名稱/` 可用

詳細部署說明請參考 [DEPLOY.md](DEPLOY.md)

## 技術棧

- **React 19** - UI 框架
- **React Three Fiber** - 3D 渲染
- **Three.js** - 3D 圖形庫
- **Vite** - 構建工具
- **TypeScript** - 類型安全
- **Tailwind CSS** - 樣式框架

## 構建

```bash
npm run build
```

構建產物將在 `dist` 目錄中。

## 預覽構建

```bash
npm run preview
```

## 許可證

MIT
