import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Check for GITHUB_PAGES in both process.env and loaded env
    const isGitHubPages = process.env.GITHUB_PAGES === 'true' || env.GITHUB_PAGES === 'true';
    return {
      // 如果您的 GitHub 倉庫名稱不同，請修改此處
      // 例如：如果倉庫名為 'my-dice-app'，則改為 '/my-dice-app/'
      base: isGitHubPages ? '/risk-dice-(risky-dice)/' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
        dedupe: ['react', 'react-dom']
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'react-dom/client']
      }
    };
});
