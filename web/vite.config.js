import {defineConfig} from 'vite';
export default defineConfig({
  base:process.env.GITHUB_PAGES?'/interactive-pet/':'/',
  build:{rollupOptions:{output:{manualChunks:{three:['three'],loaders:['three/addons/loaders/GLTFLoader.js','three/addons/controls/OrbitControls.js']}}}}
});
