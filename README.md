# 🎲 Risk Dice (Risky Dice)

一個具有視覺震撼的 3D 互動式骰子遊戲，使用 React、Three.js 和 Firebase 打造。挑戰你的運氣，避開骷髏面，看看你能維持多長的連勝紀錄！

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/react-19.2.3-61dafb.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.8.2-blue.svg)

## ✨ 特色功能

- 🎮 **3D 互動式骰子** - 使用 Three.js 和 React Three Fiber 渲染的逼真骰子動畫
- 💀 **風險與獎勵** - 20面骰子中有5面是骷髏，1/4 的機率遊戲結束
- 📊 **統計追蹤** - 記錄你的連勝紀錄、總投擲次數和最高紀錄
- 🌍 **全域 STREAK 系統** - 使用 Firebase Realtime Database 實現跨用戶的即時連勝紀錄同步
- 💾 **本地存儲** - 使用 localStorage 持久化個人遊戲數據
- 📱 **響應式設計** - 使用 Tailwind CSS 打造的美觀介面，支援各種設備
- 🎨 **視覺效果** - 包含粒子爆炸效果和流暢的動畫
- 🚀 **高性能** - 使用 Vite 構建，快速開發和部署

## 🎯 遊戲規則

1. 點擊骰子開始投擲
2. 如果骰子停在安全面（非骷髏），你的連勝紀錄 +1
3. 如果骰子停在骷髏面 💀，遊戲結束，連勝紀錄歸零
4. 挑戰自己和全球玩家，創造最高連勝紀錄！

**獲勝機率：** 75% (15/20 安全面)
**失敗機率：** 25% (5/20 骷髏面)

## 🛠️ 技術棧

- **前端框架**: React 19
- **3D 渲染**: Three.js + React Three Fiber + Drei
- **語言**: TypeScript
- **樣式**: Tailwind CSS
- **圖標**: Lucide React
- **後端服務**: Firebase Realtime Database
- **構建工具**: Vite
- **部署**: GitHub Pages

## 📦 快速開始

### 前置需求

- Node.js 16+ 
- npm 或 yarn

### 安裝

```bash
# 克隆專案
git clone https://github.com/poirotw66/risk-dice.git
cd risk-dice

# 安裝依賴
npm install
```

### 本地開發

```bash
# 啟動開發伺服器
npm run dev

# 瀏覽器訪問 http://localhost:5173
```

### Firebase 配置（可選）

如果你想啟用全域 STREAK 功能，需要配置 Firebase：

1. 創建 Firebase 專案 (參考 [FIREBASE_SETUP.md](FIREBASE_SETUP.md))
2. 複製 `.env.example` 為 `.env`
3. 填入你的 Firebase 配置：

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=your_database_url
```

> **注意**: 不配置 Firebase 的話，應用將自動使用本地模式，所有功能仍然可用。

詳細配置步驟請參考：
- [FIREBASE_SETUP.md](FIREBASE_SETUP.md) - Firebase 完整設定教學
- [NEXT_STEPS.md](NEXT_STEPS.md) - 下一步指南

### 建置與部署

```bash
# 建置生產版本
npm run build

# 建置 GitHub Pages 版本
npm run build:gh-pages

# 預覽生產版本
npm run preview

# 預覽 GitHub Pages 版本
npm run preview:gh-pages
```

部署到 GitHub Pages 的詳細步驟請參考 [DEPLOY.md](DEPLOY.md)。

## 📂 專案結構

```
risk-dice/
├── components/
│   └── RiskDice.tsx          # 3D 骰子組件
├── src/
│   └── firebase.ts           # Firebase 配置和 API
├── App.tsx                   # 主應用組件
├── types.ts                  # TypeScript 類型定義
├── index.tsx                 # 應用入口
├── index.html                # HTML 模板
├── vite.config.ts            # Vite 配置
├── tailwind.config.js        # Tailwind CSS 配置
├── tsconfig.json             # TypeScript 配置
├── package.json              # 專案依賴
├── .env.example              # 環境變數範本
├── FIREBASE_SETUP.md         # Firebase 設定教學
├── DEPLOY.md                 # 部署指南
└── NEXT_STEPS.md             # 下一步指南
```

## 🎮 功能詳解

### 本地功能
- ✅ 個人連勝紀錄追蹤
- ✅ 總投擲次數統計
- ✅ 個人最高紀錄
- ✅ 遊戲歷史記錄
- ✅ 數據持久化（localStorage）

### 全域功能（需要 Firebase）
- ✅ 即時全域連勝紀錄同步
- ✅ 全球最高紀錄
- ✅ 跨設備數據共享
- ✅ 多用戶協作體驗

### 視覺效果
- ✅ 3D 骰子物理動畫
- ✅ 粒子爆炸效果
- ✅ 骷髏面特殊動畫
- ✅ 流暢的過渡效果
- ✅ 響應式佈局

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

1. Fork 本專案
2. 創建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 📝 開發文件

- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - 實作總結
- [UI_OPTIMIZATION.md](UI_OPTIMIZATION.md) - UI 優化說明
- [FIREBASE_SETUP.md](FIREBASE_SETUP.md) - Firebase 設定教學
- [DEPLOY.md](DEPLOY.md) - 部署指南
- [NEXT_STEPS.md](NEXT_STEPS.md) - 下一步指南

## 📄 許可證

本專案採用 MIT 許可證 - 詳見 [LICENSE](LICENSE) 文件

## 🙏 致謝

- [Three.js](https://threejs.org/) - 3D 圖形庫
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) - React 的 Three.js 渲染器
- [Lucide](https://lucide.dev/) - 美麗的圖標集
- [Firebase](https://firebase.google.com/) - 後端即服務平台
- [Vite](https://vitejs.dev/) - 下一代前端構建工具
- [Tailwind CSS](https://tailwindcss.com/) - 實用優先的 CSS 框架

## 🔗 相關連結

- [線上演示](https://poirotw66.github.io/risk-dice/) 
- [問題回報](https://github.com/poirotw66/risk-dice/issues)
- [專案首頁](https://github.com/poirotw66/risk-dice)

---

⭐ 如果你喜歡這個專案，請給它一顆星星！
