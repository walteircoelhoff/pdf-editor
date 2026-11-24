import { test, expect } from '@playwright/test';
import { PDFDocument, degrees, StandardFonts } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

async function fixture({ count = 2, rotation = 0, crop = false } = {}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < count; i++) {
    const page = pdf.addPage([595, 842]);
    page.setRotation(degrees(rotation));
    if (crop) page.setCropBox(30, 50, 500, 700);
    page.drawText(`Original page ${i + 1}`, { x: 70, y: 700, size: 20, font });
  }
  return Buffer.from(await pdf.save());
}
async function upload(page, payload = {}) {
  await page.locator('#pdf-input').setInputFiles({ name: 'teste.pdf', mimeType: 'application/pdf', buffer: await fixture(payload) });
  await expect(page.locator('#export')).toBeEnabled();
  await expect(page.locator('#page-canvas')).toBeVisible();
  await expect.poll(() => page.locator('#page-canvas').evaluate((el) => el.width)).toBeGreaterThan(0);
}
async function drag(page, from, to) {
  const box = await page.locator('#annotations').boundingBox();
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 10 });
  await page.mouse.up();
}
async function download(page) {
  const pending = page.waitForEvent('download');
  await page.locator('#export').click();
  const file = await pending;
  const data = await readFile(await file.path());
  return { file, data, pdf: await PDFDocument.load(data) };
}
async function extract(page, bytes) {
  return page.evaluate(async (data) => {
    const pdfjs = await import('/node_modules/pdfjs-dist/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: Uint8Array.from(data), isEvalSupported: false }).promise;
    const result = [];
    for (let i = 1; i <= doc.numPages; i++) result.push((await (await doc.getPage(i)).getTextContent()).items.map((t) => t.str).join(' '));
    return result;
  }, [...bytes]);
}

test('texto com acentos, marcação, desenho, imagem, histórico e exportação', async ({ page }) => {
  const errors = [];
  const uploads = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (r.method() === 'POST') uploads.push(r.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Um novo olhar/ })).toBeVisible();
  await upload(page);
  await page.getByRole('button', { name: 'Texto', exact: true }).click();
  await page.locator('#text-content').fill('Revisão: João — ação e café');
  await page.locator('#annotations').click({ position: { x: 60, y: 100 } });
  await expect(page.locator('#annotations text')).toContainText('Revisão: João');
  await page.getByRole('button', { name: 'Marca-texto', exact: true }).click();
  await drag(page, [.1, .25], [.6, .29]);
  await expect(page.locator('#annotations .annotation')).toHaveCount(2);
  await page.getByRole('button', { name: 'Desenhar', exact: true }).click();
  await drag(page, [.15, .4], [.4, .47]);
  await expect(page.locator('#annotations polyline')).toHaveCount(1);
  await page.locator('#undo').click();
  await expect(page.locator('#annotations polyline')).toHaveCount(0);
  await page.locator('#redo').click();
  await expect(page.locator('#annotations polyline')).toHaveCount(1);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Imagem', exact: true }).click();
  const image = await chooser;
  await image.setFiles({ name: 'imagem.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
  await expect(page.locator('#toast')).toContainText('Imagem pronta');
  await page.locator('#annotations').click({ position: { x: 100, y: 400 } });
  await expect(page.locator('#annotations image')).toHaveCount(1);
  await page.locator('#image-width').fill('90');
  await page.locator('#image-width').dispatchEvent('change');
  const { file, data, pdf } = await download(page);
  expect(file.suggestedFilename()).toBe('teste-editado.pdf');
  expect(pdf.getPageCount()).toBe(2);
  const text = await extract(page, data);
  expect(text[0]).toContain('Original page 1');
  expect(text[0]).toContain('Revisão: João — ação e café');
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/editor-desktop.png', fullPage: true });
});

test('organiza, une, duplica, gira, exclui e desfaz páginas', async ({ page }) => {
  await page.goto('/');
  await upload(page);
  await page.locator('#duplicate').click();
  await expect(page.locator('#page-count')).toHaveText('3');
  await page.locator('#move-down').click();
  await expect(page.locator('#current-label')).toHaveText('Página 3 de 3');
  await page.locator('#rotate').click();
  await expect(page.locator('#page-size')).toHaveText('297 × 210 mm');
  await page.locator('#delete-page').click();
  await expect(page.locator('#page-count')).toHaveText('2');
  await page.locator('#undo').click();
  await expect(page.locator('#page-count')).toHaveText('3');
  await upload(page, { count: 1 });
  await expect(page.locator('#page-count')).toHaveText('4');
  await page.locator('#blank').click();
  await expect(page.locator('#page-count')).toHaveText('5');
  const { data, pdf } = await download(page);
  expect(pdf.getPageCount()).toBe(5);
  expect(pdf.getPages().map((p) => p.getRotation().angle)).toEqual([0, 0, 90, 0, 0]);
  expect((await extract(page, data)).map((t) => t.includes('Original page 1'))).toEqual([true, false, true, true, false]);
});

for (const rotation of [0, 90, 180, 270]) test(`anotações exportadas mantêm a posição com rotação ${rotation} e CropBox`, async ({ page }) => {
  await page.goto('/');
  await upload(page, { rotation, crop: true, count: 1 });
  await page.getByRole('button', { name: 'Texto', exact: true }).click();
  await page.locator('#text-content').fill('Posição correta');
  const layer = page.locator('#annotations');
  const box = await layer.boundingBox();
  await layer.click({ position: { x: box.width * .2, y: box.height * .3 } });
  const before = await layer.locator('text').evaluate((el) => ({ x: +el.getAttribute('x'), y: +el.getAttribute('y') }));
  const { data } = await download(page);
  const mapped = await page.evaluate(async (bytes) => {
    const pdfjs = await import('/node_modules/pdfjs-dist/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: Uint8Array.from(bytes), isEvalSupported: false }).promise;
    const p = await doc.getPage(1), text = await p.getTextContent();
    const item = text.items.find((t) => t.str === 'Posição correta');
    const view = p.getViewport({ scale: 1 });
    return view.convertToViewportPoint(item.transform[4], item.transform[5]);
  }, [...data]);
  expect(mapped[0]).toBeCloseTo(before.x, 0);
  expect(mapped[1]).toBeCloseTo(before.y, 0);
});

test('seleciona, move, edita e exclui anotações com teclado', async ({ page }) => {
  await page.goto('/');
  await upload(page, { count: 1 });
  await page.getByRole('button', { name: 'Texto', exact: true }).click();
  await page.locator('#text-content').fill('Mover');
  await page.locator('#annotations').click({ position: { x: 80, y: 90 } });
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
  const text = page.locator('#annotations text');
  const b = await text.boundingBox();
  const old = await text.getAttribute('x');
  await page.mouse.move(b.x + 8, b.y + 8); await page.mouse.down();
  await page.mouse.move(b.x + 60, b.y + 40, { steps: 5 }); await page.mouse.up();
  expect(await text.getAttribute('x')).not.toBe(old);
  await page.locator('#text-content').fill('Atualizado');
  await page.locator('#text-content').blur();
  await expect(text).toContainText('Atualizado');
  await page.locator('#annotations').click({ position: { x: 5, y: 5 } });
  await text.click();
  await page.keyboard.press('Delete');
  await expect(text).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(text).toContainText('Atualizado');
});

test('arquivo inválido e texto não suportado apresentam erro sem perder documento', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pdf-input').setInputFiles({ name: 'invalido.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
  await expect(page.locator('#toast')).toContainText('Não foi possível abrir');
  await expect(page.locator('#export')).toBeDisabled();
  await upload(page, { count: 1 });
  await page.getByRole('button', { name: 'Texto', exact: true }).click();
  await page.locator('#text-content').fill('Teste 🦄');
  await page.locator('#annotations').click({ position: { x: 50, y: 100 } });
  await page.locator('#export').click();
  await expect(page.locator('#toast')).toContainText('não suporta');
  await expect(page.locator('#annotations text')).toContainText('Teste');
  await expect(page.locator('#export')).toBeEnabled();
});

test('tela de entrada e edição no celular sem overflow horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path: 'test-results/inicio-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#demo').click();
  await expect(page.locator('#page-count')).toHaveText('2');
  await expect(page.locator('#export')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Texto', exact: true }).click();
  await page.locator('#text-content').fill('Celular');
  await page.locator('#annotations').click({ position: { x: 45, y: 80 } });
  await expect(page.locator('#annotations text')).toContainText('Celular');
  await page.screenshot({ path: 'test-results/editor-mobile.png', fullPage: true });
});

test('build funciona sob o caminho de um repositório no GitHub Pages', async ({ page, context }) => {
  const root = resolve('dist');
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
  await context.route('**/folha-pdf-editor/**', async (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname.replace('/folha-pdf-editor/', '')) || 'index.html';
    const file = resolve(root, path);
    if (!file.startsWith(root + sep)) return route.fulfill({ status: 403 });
    try { await route.fulfill({ body: await readFile(file), contentType: mime[extname(file)] || 'application/octet-stream' }); }
    catch { await route.fulfill({ status: 404 }); }
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/folha-pdf-editor/');
  await page.screenshot({ path: 'test-results/inicio-desktop.png', fullPage: true });
  await page.locator('#demo').click();
  await expect(page.locator('#page-count')).toHaveText('2');
  await page.getByRole('button', { name: 'Texto', exact: true }).click();
  await page.locator('#text-content').fill('Produção com acentos');
  await page.locator('#annotations').click({ position: { x: 50, y: 100 } });
  const { pdf } = await download(page);
  expect(pdf.getPageCount()).toBe(2);
  expect(errors).toEqual([]);
});
