import { defineConfig } from 'vite';

export default defineConfig({ base: './', optimizeDeps: { include: ['@embedpdf/pdfium','@pdf-lib/fontkit'] } });
