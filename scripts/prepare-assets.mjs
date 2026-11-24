import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Keep PDF.js resources on this origin, including their original licenses.
// Generate from the locked installation rather than checking vendor files in.
const root = fileURLToPath(new URL('..', import.meta.url));
for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  await cp(resolve(root, 'node_modules/pdfjs-dist', folder), resolve(root, 'public/pdfjs', folder), { recursive: true });
}
await mkdir(resolve(root, 'public/licenses'), { recursive: true });
const licenses = {
  'pdfjs-dist': 'LICENSE',
  'pdf-lib': 'LICENSE.md',
  'lucide': 'LICENSE',
  'pako': 'LICENSE',
  'tslib': 'LICENSE.txt',
  '@pdf-lib/upng': 'LICENSE',
  '@pdf-lib/standard-fonts': 'LICENSE.md',
  '@pdf-lib/fontkit': 'README.md',
  '@embedpdf/pdfium': 'LICENSE',
};
for (const [name, license] of Object.entries(licenses)) {
  await cp(resolve(root, 'node_modules', name, license), resolve(root, 'public/licenses', `${name.replaceAll('/', '-')}.txt`));
}
await cp(resolve(root,'node_modules/@embedpdf/pdfium/LICENSE.pdfium'),resolve(root,'public/licenses/pdfium.txt'));
