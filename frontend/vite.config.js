import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Загружаем только VITE_ переменные (безопасные для клиента)
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    
    build: {
      outDir: 'build',
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          // Хеширование файлов для обхода кэша Telegram
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          manualChunks(id) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/react-router')) {
              return 'router';
            }
            if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
              return 'i18n';
            }
            if (id.includes('node_modules/framer-motion')) {
              return 'motion';
            }
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
              return 'charts';
            }
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    
    server: {
      port: 3000,
      host: true,
      strictPort: true,
      allowedHosts: true,
    },
    
    preview: {
      port: 3000,
      host: true,
    },
    
    // Поддержка обоих префиксов (VITE_ и REACT_APP_) для import.meta.env
    envPrefix: ['VITE_', 'REACT_APP_'],
    
    define: {
      // Передаём только нужные переменные, не весь process.env
      'process.env.VITE_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL || ''),
      'process.env.REACT_APP_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL || env.REACT_APP_BACKEND_URL || ''),
      'process.env.VITE_ENABLE_VISUAL_EDITS': JSON.stringify(env.VITE_ENABLE_VISUAL_EDITS || 'false'),
      'process.env.REACT_APP_ENABLE_VISUAL_EDITS': JSON.stringify(env.VITE_ENABLE_VISUAL_EDITS || env.REACT_APP_ENABLE_VISUAL_EDITS || 'false'),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
  };
});
