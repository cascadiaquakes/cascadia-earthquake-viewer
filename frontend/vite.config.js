import { defineConfig } from 'vite';
import { resolve } from 'path';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  base: "/",
  plugins: [cesium()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        viewer3d: resolve(__dirname, 'viewer3d.html')
      }
    }
  },
  server: { 
    port: 5173,
    host: '0.0.0.0'
  }
});