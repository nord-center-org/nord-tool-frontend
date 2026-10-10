import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * CSP do app publicado: só scripts próprios e chamadas para a própria origem e a API. Entra apenas no build
 * (no modo dev bloquearia o HMR do Vite). O token fica em sessionStorage, então limitar scripts é a defesa contra XSS.
 */
function cspDoBuild(origemApi: string): Plugin {
  const politica = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://static.getmocha.com",
    "font-src 'self' data:",
    `connect-src 'self' ${origemApi}`.trim(),
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'nord-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${politica}" />`);
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiBase = env.VITE_API_BASE_URL ?? '';
  let origemApi = '';
  if (command === 'build') {
    if (!apiBase) {
      throw new Error('Defina VITE_API_BASE_URL (ex.: https://<backend>/api/v1/nord-tool) para gerar o build.');
    }
    origemApi = /^https?:\/\//.test(apiBase) ? new URL(apiBase).origin : '';
  }

  return {
    plugins: [react(), cspDoBuild(origemApi)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8081',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
