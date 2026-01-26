import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
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
          // 🔄 Хеширование файлов для обхода кэша Telegram
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'router': ['react-router-dom'],
            'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
            'motion': ['framer-motion'],
            'charts': ['recharts'],
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
    
    define: {
      'process.env': env,
    },
  };
});
