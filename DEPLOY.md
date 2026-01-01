# GitHub Pages 部署指南

## 自動部署（推薦）

項目已配置 GitHub Actions，當您推送代碼到 `main` 或 `master` 分支時，會自動構建並部署到 GitHub Pages。

### 步驟：

1. **確保倉庫名稱正確**
   - 如果您的 GitHub 倉庫名稱不是 `risk-dice-(risky-dice)`，請修改 `vite.config.ts` 中的 `base` 配置：
   ```typescript
   base: process.env.GITHUB_PAGES === 'true' ? '/您的倉庫名稱/' : '/',
   ```

2. **啟用 GitHub Pages（兩種方法）**

   **方法 A：使用簡單部署（推薦，無需手動設置）**
   - 使用 `deploy-simple.yml` workflow（已自動啟用）
   - 直接推送代碼即可，無需手動設置

   **方法 B：使用 GitHub Pages Actions**
   - 前往倉庫的 Settings > Pages
   - Source 選擇 "GitHub Actions"
   - 保存設置
   - 如果遇到錯誤，請使用方法 A

3. **推送代碼**
   ```bash
   git add .
   git commit -m "準備部署到 GitHub Pages"
   git push origin main
   ```

4. **查看部署狀態**
   - 前往倉庫的 Actions 標籤頁
   - 查看 "Deploy to GitHub Pages (Simple Method)" workflow 的執行狀態
   - 部署完成後，前往 Settings > Pages 查看您的網站 URL
   - 網站將在 `https://您的用戶名.github.io/您的倉庫名稱/` 可用

### 如果遇到 "Get Pages site failed" 錯誤

如果使用 `deploy.yml` 遇到錯誤，請：

1. **刪除或禁用 `deploy.yml`**（如果存在）
2. **使用 `deploy-simple.yml`**（已配置，無需手動設置）
3. **或者手動啟用 GitHub Pages**：
   - 前往 Settings > Pages
   - Source 選擇 "Deploy from a branch"
   - Branch 選擇 `gh-pages`，folder 選擇 `/ (root)`
   - 保存設置

## 手動部署

如果需要手動部署：

1. **構建項目**
   ```bash
   npm install
   GITHUB_PAGES=true npm run build
   ```

2. **部署到 gh-pages 分支**
   - 使用 GitHub Desktop 或命令行工具
   - 將 `dist` 目錄的內容推送到 `gh-pages` 分支

## 注意事項

- 確保 `vite.config.ts` 中的 `base` 路徑與您的倉庫名稱匹配
- 如果使用自定義域名，請將 `base` 設置為 `/`
- 首次部署可能需要幾分鐘時間

