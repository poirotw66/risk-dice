# GitHub Pages 部署指南

## 自動部署（推薦）

項目已配置 GitHub Actions，當您推送代碼到 `main` 或 `master` 分支時，會自動構建並部署到 GitHub Pages。

### 步驟：

1. **確保倉庫名稱正確**
   - 當前 GitHub 倉庫名稱是 `risk-dice`
   - 如果您的 GitHub 倉庫名稱不同，請修改 `vite.config.ts` 中的 `base` 配置：
   ```typescript
   base: process.env.GITHUB_PAGES === 'true' ? '/您的倉庫名稱/' : '/',
   ```
   - **重要**：使用 `git remote -v` 查看實際的倉庫 URL 來確認正確的倉庫名稱

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

1. **構建項目（使用 GitHub Pages 配置）**
   ```bash
   npm install
   npm run build:gh-pages
   ```
   或者使用環境變量：
   ```bash
   # Windows PowerShell
   $env:GITHUB_PAGES='true'; npm run build
   
   # Linux/Mac
   GITHUB_PAGES=true npm run build
   ```

2. **部署到 gh-pages 分支**
   - 使用 GitHub Desktop 或命令行工具
   - 將 `dist` 目錄的內容推送到 `gh-pages` 分支

## 故障排除

### 404 錯誤：資源文件無法加載

如果您看到類似以下的錯誤：
```
Failed to load resource: the server responded with a status of 404
/assets/index-xxx.js:1 Failed to load resource
```

**解決方法：**

1. **確認倉庫名稱正確**
   - 檢查 `vite.config.ts` 中的 `base` 配置是否與您的 GitHub 倉庫名稱完全匹配
   - 倉庫名稱區分大小寫，必須完全一致

2. **確認構建時使用了正確的環境變量**
   - GitHub Actions 會自動設置 `GITHUB_PAGES=true`
   - 如果手動構建，請使用 `npm run build:gh-pages`

3. **檢查構建後的 HTML 文件**
   - 打開 `dist/index.html`
   - 確認資源路徑包含倉庫名稱：`/risk-dice/assets/...`
   - 如果路徑是 `/assets/...`，說明構建時沒有設置 `GITHUB_PAGES=true`
   - 使用 `git remote -v` 查看實際的倉庫 URL 來確認正確的倉庫名稱

4. **清除瀏覽器緩存**
   - 硬刷新頁面（Ctrl+F5 或 Cmd+Shift+R）
   - 或使用無痕模式訪問

5. **檢查 GitHub Pages 設置**
   - 前往倉庫的 Settings > Pages
   - 確認 Source 設置正確
   - 確認 URL 格式為 `https://您的用戶名.github.io/您的倉庫名稱/`

### 本地測試 GitHub Pages 構建

要本地測試 GitHub Pages 構建結果：

```bash
# 構建（使用 GitHub Pages 配置）
npm run build:gh-pages

# 預覽（注意：需要使用支持 base path 的服務器）
npm run preview
```

**注意**：直接打開 `dist/index.html` 文件不會正確工作，因為瀏覽器不支持這種路徑格式。必須使用 HTTP 服務器。

## 注意事項

- 確保 `vite.config.ts` 中的 `base` 路徑與您的倉庫名稱匹配
- 如果使用自定義域名，請將 `base` 設置為 `/`
- 首次部署可能需要幾分鐘時間
- 構建時必須設置 `GITHUB_PAGES=true` 環境變量，否則資源路徑會不正確

