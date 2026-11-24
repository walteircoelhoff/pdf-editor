import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createIcons, Files, ShieldCheck, CircleHelp, FileText, FolderOpen, Download, MousePointer2, Type, Highlighter, Pencil, Square, ImagePlus, Undo2, Redo2, Layers2, Plus, FilePenLine, Check, Upload, LockKeyhole, SlidersHorizontal, Trash2, RotateCw, Copy, ChevronUp, ChevronDown, Lightbulb, Minus, Scan, HardDrive, X } from 'lucide';
import { exportDocument, uid } from './pdf.js';
import { readOriginalText, strippedBytes } from './text-engine.js';
import './style.css';
import './inline-editor.css';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const icons = { Files, ShieldCheck, CircleHelp, FileText, FolderOpen, Download, MousePointer2, Type, Highlighter, Pencil, Square, ImagePlus, Undo2, Redo2, Layers2, Plus, FilePenLine, Check, Upload, LockKeyhole, SlidersHorizontal, Trash2, RotateCw, Copy, ChevronUp, ChevronDown, Lightbulb, Minus, Scan, HardDrive, X };
const $ = (s) => document.querySelector(s);
const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const button = (id, name, label, cls = '') => `<button id="${id}" class="${cls}" title="${label}" aria-label="${label}">${icon(name)}</button>`;
const tools = [['select', 'mouse-pointer-2', 'Selecionar'], ['edit-text', 'file-pen-line', 'Editar texto'], ['text', 'type', 'Inserir texto'], ['highlight', 'highlighter', 'Marca-texto'], ['draw', 'pencil', 'Desenhar'], ['rectangle', 'square', 'Retângulo'], ['image', 'image-plus', 'Imagem']];

$('#app').innerHTML = `
  <header class="header">
    <a class="brand" href="./" aria-label="Folha, início"><span class="brand-icon">${icon('files')}</span>folha<span class="brand-tag">Editor de PDF</span></a>
    <div class="header-right"><span class="privacy">${icon('shield-check')} Seus arquivos ficam com você</span><button id="help" class="icon-button" title="Como usar" aria-label="Como usar">${icon('circle-help')}</button></div>
  </header>
  <section class="document-bar" aria-label="Documento">
    <div class="document-name">${icon('file-text')}<div><input id="filename" value="Meu documento" aria-label="Nome do documento" maxlength="100"><span id="file-meta">Seu próximo documento começa aqui</span></div></div>
    <div class="document-actions"><button id="import" class="secondary">${icon('folder-open')}<span>Abrir PDF</span></button><button id="export" class="primary" disabled>${icon('download')}<span>Baixar PDF</span></button></div>
  </section>
  <nav class="toolbar" aria-label="Ferramentas de edição">
    <div class="tool-list">${tools.map(([id, name, label]) => `<button data-tool="${id}" class="tool ${id === 'select' ? 'active' : ''}" aria-pressed="${id === 'select'}" title="${label}">${icon(name)}<span>${label}</span></button>`).join('')}</div>
    <div class="history-actions">${button('undo', 'undo-2', 'Desfazer (Ctrl+Z)')}${button('redo', 'redo-2', 'Refazer (Ctrl+Shift+Z)')}</div>
  </nav>
  <main class="workspace">
    <aside class="sidebar" aria-label="Páginas do documento">
      <div class="sidebar-heading"><h2>Páginas <span id="page-count">0</span></h2>${button('add-pdf', 'files', 'Adicionar outro PDF')}</div>
      <div id="thumbnails"><div class="empty-pages">${icon('layers-2')}<p>Suas páginas<br>aparecem aqui</p></div></div>
      <button id="blank" class="add-page">${icon('plus')} Página em branco</button>
    </aside>
    <section class="desk" aria-label="Área de edição">
      <div id="empty-state" class="empty-state">
        <div class="paper-stack"><div class="paper-back"></div><div class="paper-front">${icon('file-pen-line')}<span></span><span></span><span></span><div class="paper-mark">${icon('check')}</div></div></div>
        <h1>Um novo olhar para<br>seus PDFs.</h1>
        <p>Adicione suas ideias. Organize suas páginas.<br>Deixe o documento do seu jeito.</p>
        <button id="open-empty" class="primary large">${icon('upload')} Escolher um PDF</button>
        <span class="drop-hint">ou arraste seus arquivos para cá · até 50 MB por arquivo</span>
        <button id="demo" class="text-button">Experimentar com um documento de exemplo</button>
        <div class="local-note">${icon('lock-keyhole')} Tudo acontece no seu navegador. Sem cadastro.</div>
      </div>
      <div id="editor" hidden><div class="page-label"><span id="current-label">Página 1</span><span id="page-size"></span></div><div id="page-shell"><canvas id="page-canvas"></canvas><svg id="annotations" xmlns="http://www.w3.org/2000/svg" aria-label="Anotações da página"></svg><form id="inline-editor" hidden aria-label="Editar texto na página"><div class="inline-heading"><label for="text-content" id="inline-title">Inserir texto</label><label class="inline-size" for="inline-font-size">Tamanho <span><input id="inline-font-size" type="number" min="6" max="200" step="any" value="20" inputmode="decimal" required aria-label="Tamanho da letra">pt</span></label></div><textarea id="text-content" rows="2" placeholder="Digite aqui…" spellcheck="true"></textarea><div class="inline-actions"><span>Ctrl+Enter para aplicar</span><button type="button" id="cancel-text">Cancelar</button><button type="submit" id="apply-text" class="primary">Aplicar</button></div></form></div><p class="desk-hint" id="tool-hint">Selecione uma anotação para mover ou excluir.</p></div>
    </section>
    <aside class="inspector" aria-label="Propriedades">
      <div class="inspector-title">${icon('sliders-horizontal')} Ajustes</div>
      <section class="settings"><h2 id="settings-title">Sua ferramenta</h2><p id="settings-description">Abra um PDF para começar a editar.</p>
        <div id="text-settings" hidden><label for="font-size">Tamanho do texto</label><input id="font-size" type="number" min="6" max="200" step="0.5" value="20"><p id="text-reading-status" class="text-reading-status" role="status"></p></div>
        <div id="color-settings"><label for="ink">Cor</label><div class="colors"><button data-color="#20314f" class="swatch selected" style="--swatch:#20314f" aria-label="Azul escuro"></button><button data-color="#234bd7" class="swatch" style="--swatch:#234bd7" aria-label="Azul"></button><button data-color="#e34a4a" class="swatch" style="--swatch:#e34a4a" aria-label="Vermelho"></button><button data-color="#ffce32" class="swatch" style="--swatch:#ffce32" aria-label="Amarelo"></button><input id="ink" type="color" value="#20314f" title="Escolher cor" aria-label="Escolher cor"></div></div>
        <div id="stroke-settings" hidden><label for="stroke">Espessura</label><input id="stroke" type="range" min="1" max="12" value="3"></div>
        <div id="image-settings" hidden><label for="image-width">Largura da imagem <output id="image-width-label"></output></label><input id="image-width" type="range" min="20" max="500" value="200"></div>
        <button id="delete-item" class="danger full" hidden>${icon('trash-2')} Excluir anotação</button>
      </section>
      <section class="page-settings"><h2>Página atual</h2><div class="page-controls"><button id="rotate">${icon('rotate-cw')} Girar</button><button id="duplicate">${icon('copy')} Duplicar</button><button id="move-up">${icon('chevron-up')} Anterior</button><button id="move-down">${icon('chevron-down')} Próxima</button></div><button id="delete-page" class="danger full">${icon('trash-2')} Excluir página</button></section>
      <div class="inspector-note">${icon('lightbulb')}<p>Pequenos ajustes,<br>grandes diferenças.<span>O arquivo original permanece com você.</span></p></div>
    </aside>
  </main>
  <footer class="statusbar"><span id="status">Pronto para suas ideias</span><div class="zoom">${button('zoom-out', 'minus', 'Diminuir zoom')}<output id="zoom-label">100%</output>${button('zoom-in', 'plus', 'Aumentar zoom')}${button('fit', 'scan', 'Ajustar à tela')}</div><span class="footer-local">${icon('hard-drive')} Processamento local</span></footer>
  <input type="file" id="pdf-input" accept="application/pdf,.pdf" multiple hidden>
  <input type="file" id="image-input" accept="image/png,image/jpeg" hidden>
  <div id="toast" role="status" aria-live="polite"></div>
  <div id="drop-overlay" hidden>${icon('upload')} Solte os PDFs para adicionar</div>
  <dialog id="help-dialog"><div class="dialog-heading"><h2>Seu PDF, do seu jeito.</h2>${button('close-help', 'x', 'Fechar ajuda')}</div><p>Abra um ou mais PDFs. Edite diretamente sobre a folha e baixe uma nova cópia.</p><ul><li><strong>Editar texto:</strong> clique em um trecho destacado. A caixa abre no próprio local; altere o texto e clique em Aplicar. O trecho original é substituído no PDF exportado.</li><li><strong>Inserir texto:</strong> clique em um espaço da página e digite na caixa que aparece ali.</li><li><strong>Selecionar:</strong> mova suas anotações; dê dois cliques em um texto para editá-lo. Delete exclui; Ctrl+Z desfaz.</li><li><strong>Marca-texto e retângulo:</strong> arraste para definir a área.</li><li><strong>Desenho e imagem:</strong> desenhe livremente ou insira um PNG/JPEG.</li><li><strong>Páginas:</strong> selecione uma miniatura para girar, duplicar, mover ou excluir.</li></ul><p class="help-note">Textos são editados por trechos, sem reorganizar o parágrafo automaticamente. A fonte dos trechos alterados é substituída por Noto Sans. PDFs digitalizados como imagem precisam de OCR, ainda não disponível. Não há tarja segura nem preservação de assinaturas digitais. Baixe seu trabalho antes de fechar.</p><button id="got-it" class="primary">Entendi, vamos editar</button></dialog>
`;

createIcons({ icons });
$('#text-content').insertAdjacentHTML('beforebegin', `<div class="inline-formatting" role="group" aria-label="Formatação do texto"><button type="button" data-text-style="bold" aria-label="Negrito" title="Negrito" aria-pressed="false"><strong>B</strong></button><button type="button" data-text-style="italic" aria-label="Itálico" title="Itálico" aria-pressed="false"><em>I</em></button><button type="button" data-text-style="underline" aria-label="Sublinhado" title="Sublinhado" aria-pressed="false"><span class="underline-label">U</span></button></div>`);
$('#text-content').wrap = 'off';
const state = { pages: [], current: 0, sources: new Map(), tool: 'select', color: '#20314f', size: 20, stroke: 3, selected: null, zoom: 1, past: [], future: [], dirty: false, busy: false };
let renderVersion = 0;
let thumbnailVersion = 0;
let toastTimer;
let pendingImage = null;
let gesture = null;
let lastTextPress = null;
let draft = null;
let originalBlocks = [];
let originalBlocksPage = null;
const current = () => state.pages[state.current];
function toast(message, error = false) {
  $('#toast').textContent = message;
  $('#toast').className = `visible ${error ? 'error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').className = '', error ? 7000 : 3500);
}
function snapshot() { return { pages: structuredClone(state.pages), current: state.current }; }
function remember() {
  state.past.push(snapshot());
  if (state.past.length > 40) state.past.shift();
  state.future = [];
  state.dirty = true;
}
function restore(from, to) {
  if (!from.length || state.busy) return;
  closeTextEditor(false);
  to.push(snapshot());
  Object.assign(state, from.pop(), { selected: null, dirty: true });
  refresh();
}
function setBusy(value, message = '') {
  state.busy = value;
  $('#app').classList.toggle('busy', value);
  $('#app').inert = value;
  document.body.style.cursor = value ? 'progress' : '';
  $('#status').textContent = message || (state.pages.length ? 'Alterações somente nesta sessão' : 'Pronto para suas ideias');
}
function syncControls() {
  const exists = !!current();
  for (const id of ['export', 'rotate', 'duplicate', 'move-up', 'move-down', 'delete-page', 'zoom-in', 'zoom-out', 'fit']) $(`#${id}`).disabled = !exists || state.busy;
  $('#move-up').disabled ||= state.current === 0;
  $('#move-down').disabled ||= state.current === state.pages.length - 1;
  $('#undo').disabled = !state.past.length;
  $('#redo').disabled = !state.future.length;
  $('#page-count').textContent = state.pages.length;
  $('#file-meta').textContent = exists ? `${state.pages.length} ${state.pages.length === 1 ? 'página' : 'páginas'} · Edição local` : 'Seu próximo documento começa aqui';
  $('#zoom-label').textContent = `${Math.round(state.zoom * 100)}%`;
  $('#empty-state').hidden = exists;
  $('#editor').hidden = !exists;
}
function changeTool(tool) {
  if (!closeTextEditor(true)) return;
  state.tool = tool;
  state.selected = null;
  if (tool === 'highlight') setColor('#ffce32');
  if (tool === 'text' && state.color === '#ffce32') setColor('#20314f');
  document.querySelectorAll('[data-tool]').forEach((el) => {
    el.classList.toggle('active', el.dataset.tool === tool);
    el.setAttribute('aria-pressed', el.dataset.tool === tool);
  });
  const hints = { select: 'Selecione para mover. Dê dois cliques em um texto para editar.', 'edit-text': 'Clique em um trecho do PDF e edite diretamente na página.', text: 'Clique na página. A caixa de digitação abre onde você clicar.', highlight: 'Arraste sobre a área que deseja destacar.', draw: 'Desenhe livremente sobre a página.', rectangle: 'Arraste para desenhar um retângulo.', image: 'Escolha uma imagem e clique na página para inserir.' };
  $('#settings-title').textContent = tools.find(([id]) => id === tool)[2];
  $('#settings-description').textContent = hints[tool];
  $('#tool-hint').textContent = hints[tool];
  $('#text-settings').hidden = !['text','edit-text'].includes(tool);
  $('#stroke-settings').hidden = !['draw', 'rectangle'].includes(tool);
  $('#color-settings').hidden = tool === 'image';
  $('#delete-item').hidden = true;
  $('#image-settings').hidden = true;
  $('#annotations').dataset.tool = tool;
  drawAnnotations();
  if (tool === 'image') $('#image-input').click();
}
function setColor(value) {
  state.color = value;
  $('#ink').value = value;
  document.querySelectorAll('.swatch').forEach((el) => el.classList.toggle('selected', el.dataset.color === value));
}

async function makeSource(bytes) {
  const pdf = await PDFDocument.load(bytes); // rejects encrypted input rather than bypassing encryption
  const assets = new URL(`${import.meta.env.BASE_URL}pdfjs/`, document.baseURI).href;
  const viewer = await pdfjs.getDocument({
    data: bytes.slice(), isEvalSupported: false,
    cMapUrl: `${assets}cmaps/`, cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`,
    wasmUrl: `${assets}wasm/`, iccUrl: `${assets}iccs/`,
  }).promise;
  const id = uid();
  state.sources.set(id, { pdf, viewer, bytes: bytes.slice() });
  const pages = [];
  for (let i = 0; i < viewer.numPages; i++) {
    const page = await viewer.getPage(i + 1);
    const view = page.getViewport({ scale: 1 });
    pages.push({ id: uid(), source: id, index: i, rotation: page.rotate, width: view.width, height: view.height, items: [] });
  }
  return pages;
}
async function importFiles(files) {
  if (state.busy || !files.length) return;
  if (!closeTextEditor(true)) return;
  setBusy(true, 'Abrindo seus documentos…');
  const added = [];
  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) { toast(`${file.name}: o limite é de 50 MB por arquivo.`, true); continue; }
    try { added.push(...await makeSource(new Uint8Array(await file.arrayBuffer()))); }
    catch { toast(`Não foi possível abrir ${file.name}. Use um PDF válido e sem senha.`, true); }
  }
  if (added.length) {
    remember();
    if (!state.pages.length) $('#filename').value = files[0].name.replace(/\.pdf$/i, '');
    state.current = state.pages.length;
    state.pages.push(...added);
    state.selected = null;
    changeTool('edit-text');
  }
  setBusy(false);
  await refresh();
  if (added.length) fit();
}
async function blankPage() {
  if (state.busy) return;
  if (!closeTextEditor(true)) return;
  setBusy(true, 'Criando página…');
  try {
    const pdf = await PDFDocument.create();
    pdf.addPage([595.28, 841.89]);
    const pages = await makeSource(await pdf.save());
    remember();
    const position = state.pages.length ? state.current + 1 : 0;
    state.pages.splice(position, 0, ...pages);
    state.current = position;
    state.selected = null;
  } catch { toast('Não foi possível criar a página.', true); }
  finally { setBusy(false); await refresh(); fit(); }
}
async function demo() {
  if (state.busy) return;
  if (!closeTextEditor(true)) return;
  setBusy(true, 'Preparando exemplo…');
  try {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    for (let i = 0; i < 2; i++) {
      const page = pdf.addPage([595.28, 841.89]);
      const text = (s, x, y, size, strong = false, color = rgb(.13, .19, .3)) => page.drawText(s, { x, y, size, font: strong ? bold : font, color });
      page.drawRectangle({ x: 46, y: 754, width: 36, height: 36, color: rgb(.14, .29, .84) });
      text('f', 58, 764, 22, true, rgb(1, 1, 1)); text('folha / documento de exemplo', 96, 767, 12);
      text(i ? 'Espaco para novas ideias.' : 'Boas ideias merecem papel.', 46, 682, 29, true);
      text(i ? 'Organize. Anote. Compartilhe.' : 'Um documento para experimentar.', 46, 650, 16);
      page.drawLine({ start: { x: 46, y: 620 }, end: { x: 548, y: 620 }, color: rgb(.83, .86, .91), thickness: 1 });
      const lines = i ? ['Esta e a segunda pagina do seu documento.', 'Use o painel de paginas para mudar a ordem,', 'duplicar uma folha ou girar o documento.', '', 'Tudo acontece no seu navegador.', 'Quando terminar, clique em Baixar PDF.'] : ['Este e o seu espaco para testar o editor.', 'Adicione um texto, destaque uma frase ou desenhe', 'uma ideia. Voce tambem pode inserir uma imagem.', '', 'Experimente marcar esta frase com o marca-texto.', '', 'Seus arquivos continuam no seu dispositivo.', 'Nenhum documento e enviado para um servidor.'];
      lines.forEach((line, n) => text(line, 46, 575 - n * 27, 14));
      page.drawRectangle({ x: 46, y: 148, width: 502, height: 125, color: rgb(.94, .96, 1) });
      text('Uma ideia para comecar', 65, 241, 16, true);
      text('Adicione seu nome ou deixe uma anotacao aqui.', 65, 210, 12);
      text('Feito para experimentar. Edite como quiser.', 46, 65, 10);
      text(`${i + 1} / 2`, 522, 65, 10);
    }
    const pages = await makeSource(await pdf.save());
    remember();
    state.current = state.pages.length;
    state.pages.push(...pages);
    $('#filename').value = 'Documento de exemplo';
    changeTool('edit-text');
  } catch { toast('Não foi possível carregar o exemplo.', true); }
  finally { setBusy(false); await refresh(); fit(); }
}

async function refresh() {
  syncControls();
  await Promise.all([renderPage(), renderThumbnails()]);
}
async function visualPage(page) {
  const source = state.sources.get(page.source);
  const keys = [...new Set(page.items.filter((i) => i.originalKey).map((i) => i.originalKey))].sort();
  if (!keys.length) return source.viewer.getPage(page.index+1);
  source.visualCache ||= new Map();
  const key = `${page.index}:${keys.join(',')}`;
  if (!source.visualCache.has(key)) source.visualCache.set(key,(async () => {
    const assets = new URL(`${import.meta.env.BASE_URL}pdfjs/`,document.baseURI).href;
    return pdfjs.getDocument({ data:(await strippedBytes(page,source)).slice(), isEvalSupported:false, cMapUrl:`${assets}cmaps/`, cMapPacked:true, standardFontDataUrl:`${assets}standard_fonts/`, wasmUrl:`${assets}wasm/`, iccUrl:`${assets}iccs/` }).promise;
  })().catch((error) => { source.visualCache.delete(key); throw error; }));
  return (await source.visualCache.get(key)).getPage(page.index+1);
}
async function loadOriginalBlocks(page,view,version) {
  $('#text-reading-status').textContent = 'Lendo os trechos de texto…';
  try {
    const blocks = await readOriginalText(state.sources.get(page.source),page.index);
    if (version !== renderVersion) return;
    originalBlocks = blocks.map((block) => {
      const points = block.corners.map(([x,y]) => view.convertToViewportPoint(x,y));
      const xs = points.map(([x]) => x), ys = points.map(([,y]) => y);
      const [bx,by] = view.convertToViewportPoint(...block.baseline);
      const [dx,dy] = view.convertToViewportPoint(block.baseline[0]+block.direction[0],block.baseline[1]+block.direction[1]);
      return { ...block, x:Math.min(...xs), y:Math.min(...ys), w:Math.max(...xs)-Math.min(...xs), h:Math.max(...ys)-Math.min(...ys), editX:bx, editY:by-block.size*1.07, angle:Math.atan2(dy-by,dx-bx)*180/Math.PI };
    }).filter((b) => b.x+b.w >= 0 && b.y+b.h >= 0 && b.x < page.width && b.y < page.height);
    originalBlocksPage = page.id;
    const editable = originalBlocks.filter((b) => b.editable).length;
    $('#text-reading-status').textContent = editable ? `${editable} ${editable === 1 ? 'trecho de texto reconhecido. Clique nele' : 'trechos de texto reconhecidos. Clique em um deles'} para editar.` : 'Sem texto editável nesta página. Se for uma digitalização ou texto convertido em curvas, será necessário OCR.';
  } catch (error) {
    if (version !== renderVersion) return;
    originalBlocks = []; originalBlocksPage = page.id;
    $('#text-reading-status').textContent = error.message;
  }
}
async function renderPage() {
  const version = ++renderVersion;
  const page = current();
  if (!page) return;
  const pdfPage = await visualPage(page);
  if (version !== renderVersion) return;
  const viewport = pdfPage.getViewport({ scale: state.zoom, rotation: page.rotation });
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width * dpr);
  canvas.height = Math.ceil(viewport.height * dpr);
  await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [dpr, 0, 0, dpr, 0, 0] }).promise;
  if (version !== renderVersion) return;
  const target = $('#page-canvas');
  target.width = canvas.width;
  target.height = canvas.height;
  target.getContext('2d').drawImage(canvas, 0, 0);
  $('#page-shell').style.width = `${viewport.width}px`;
  $('#page-shell').style.height = `${viewport.height}px`;
  $('#annotations').setAttribute('viewBox', `0 0 ${page.width} ${page.height}`);
  $('#current-label').textContent = `Página ${state.current + 1} de ${state.pages.length}`;
  $('#page-size').textContent = `${Math.round(page.width * 25.4 / 72)} × ${Math.round(page.height * 25.4 / 72)} mm`;
  drawAnnotations();
  await loadOriginalBlocks(page,pdfPage.getViewport({ scale:1,rotation:page.rotation }),version);
  if (version === renderVersion) drawAnnotations();
}
async function renderThumbnails() {
  const version = ++thumbnailVersion;
  const holder = $('#thumbnails');
  holder.replaceChildren();
  if (!state.pages.length) { holder.innerHTML = `<div class="empty-pages">${icon('layers-2')}<p>Suas páginas<br>aparecem aqui</p></div>`; createIcons({ icons }); return; }
  for (const [index, page] of state.pages.entries()) {
    if (version !== thumbnailVersion) return;
    const el = document.createElement('button');
    el.className = `thumbnail ${index === state.current ? 'selected' : ''}`;
    el.setAttribute('aria-label', `Página ${index + 1}`);
    el.setAttribute('aria-current', index === state.current ? 'page' : 'false');
    const canvas = document.createElement('canvas');
    const label = document.createElement('span');
    label.textContent = `${index + 1}${page.items.length ? ' · editada' : ''}`;
    el.append(canvas, label);
    el.onclick = () => { if (!closeTextEditor(true)) return; state.current = index; state.selected = null; refresh(); };
    holder.append(el);
    const pdfPage = await visualPage(page);
    const view = pdfPage.getViewport({ scale: 124 / page.width, rotation: page.rotation });
    canvas.width = Math.ceil(view.width * 1.5);
    canvas.height = Math.ceil(view.height * 1.5);
    await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport: view, transform: [1.5, 0, 0, 1.5, 0, 0] }).promise;
  }
}
const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}
function bounds(item) {
  if (item.type !== 'draw') return { x: item.x, y: item.y, w: item.w, h: item.h };
  const xs = item.points.map(([x]) => x), ys = item.points.map(([, y]) => y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
function drawAnnotations() {
  const layer = $('#annotations');
  layer.replaceChildren();
  if (!current()) return;
  const modified = new Set(current().items.map((i) => i.originalKey));
  if (originalBlocksPage === current().id) for (const block of originalBlocks) {
    if (modified.has(block.key) || !block.editable) continue;
    const hit = svgEl('rect',{ x:block.x-1,y:block.y-2,width:Math.max(block.w+2,6),height:Math.max(block.h+4,8),fill:'transparent',class:'original-text-hit','data-original':block.key });
    const title = svgEl('title'); title.textContent = 'Editar: '+block.text;
    hit.append(title); layer.append(hit);
  }
  for (const item of current().items) {
    const group = svgEl('g', { 'data-id': item.id, class: 'annotation' });
    let el;
    if (item.type === 'text') {
      if (!item.text) continue;
      el = svgEl('text', { x: item.x, y: item.y + item.size * 1.07, fill: item.color, 'font-size': item.size, 'font-family': 'Noto Sans Document', 'font-weight':item.bold ? 700 : 400, 'font-style':item.italic ? 'italic' : 'normal', 'text-decoration':item.underline ? 'underline' : 'none', 'xml:space': 'preserve', transform:`rotate(${item.angle || 0} ${item.x} ${item.y+item.size*1.07})` });
      item.text.split('\n').forEach((line, index) => {
        const span = svgEl('tspan', { x: item.x, dy: index ? item.size * 1.4 : 0 });
        span.textContent = line || ' ';
        el.append(span);
      });
    } else if (item.type === 'draw') {
      el = svgEl('polyline', { points: item.points.map((p) => p.join(',')).join(' '), fill: 'none', stroke: item.color, 'stroke-width': item.size, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'pointer-events': 'stroke' });
    } else if (item.type === 'image') {
      el = svgEl('image', { x: item.x, y: item.y, width: item.w, height: item.h, href: item.data });
    } else {
      el = svgEl('rect', { x: item.x, y: item.y, width: item.w, height: item.h, fill: item.type === 'highlight' ? item.color : 'transparent', 'fill-opacity': item.type === 'highlight' ? .32 : 1, stroke: item.type === 'rectangle' ? item.color : 'none', 'stroke-width': item.size || 0 });
    }
    group.append(el);
    if (item.id === state.selected) {
      const b = bounds(item);
      group.append(svgEl('rect', { x: b.x - 3, y: b.y - 3, width: b.w + 6, height: b.h + 6, fill: 'none', stroke: '#234bd7', 'stroke-width': 1.2 / state.zoom, 'stroke-dasharray': `${4 / state.zoom} ${3 / state.zoom}`, 'pointer-events': 'none' }));
    }
    layer.append(group);
  }
  $('#delete-item').hidden = !state.selected;
}
function coords(event) {
  const rect = $('#annotations').getBoundingClientRect();
  return { x: Math.max(0, Math.min(current().width, (event.clientX - rect.left) / rect.width * current().width)), y: Math.max(0, Math.min(current().height, (event.clientY - rect.top) / rect.height * current().height)) };
}
function measureText(item) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${item.italic ? 'italic ' : ''}${item.bold ? 700 : 400} ${item.size}px "Noto Sans Document"`;
  item.w = Math.max(8, ...item.text.split('\n').map((line) => ctx.measureText(line).width));
  item.h = item.text.split('\n').length * item.size * 1.4;
}
function selectItem(item) {
  state.selected = item?.id || null;
  $('#text-settings').hidden = item?.type !== 'text' && !['text','edit-text'].includes(state.tool);
  if (item?.type === 'text') $('#font-size').value = item.size;
  if (item?.color) setColor(item.color);
  $('#image-settings').hidden = item?.type !== 'image';
  if (item?.type === 'image') {
    $('#image-width').max = Math.floor(current().width - item.x);
    $('#image-width').value = item.w;
    $('#image-width-label').textContent = `${Math.round(item.w)} pt`;
  }
  drawAnnotations();
}
function textSize() {
  const size = +$('#font-size').value;
  return Number.isFinite(size) && size >= 6 && size <= 200 ? size : 20;
}
function positionTextEditor() {
  if (!draft || !current()) return;
  const el = $('#inline-editor'), item = draft.item;
  const width = Math.min(Math.max(280,(item.w || 180)*state.zoom+28),Math.max(180,current().width*state.zoom-12));
  el.style.width = `${width}px`;
  el.style.left = `${Math.max(0,Math.min(item.x*state.zoom,current().width*state.zoom-width))}px`;
  el.style.top = `${Math.max(0,Math.min(item.y*state.zoom,current().height*state.zoom-125))}px`;
  $('#text-content').style.fontSize = `${Math.max(14,item.size*state.zoom)}px`;
  $('#text-content').style.color = item.color;
  $('#text-content').style.fontWeight = item.bold ? '700' : '400';
  $('#text-content').style.fontStyle = item.italic ? 'italic' : 'normal';
  $('#text-content').style.textDecoration = item.underline ? 'underline' : 'none';
  document.querySelectorAll('[data-text-style]').forEach((button) => button.setAttribute('aria-pressed',!!item[button.dataset.textStyle]));
}
function openTextEditor({ position, item, block } = {}) {
  if (!closeTextEditor(true)) return;
  let value;
  if (item) value = structuredClone(item);
  else if (block) value = { id:uid(),type:'text',originalKey:block.key,x:block.editX,y:block.editY,text:block.text,size:block.size,color:block.color,w:block.w,h:block.h,angle:block.angle };
  else value = { id:uid(),type:'text',...position,text:'',size:textSize(),color:state.color,w:180,h:textSize()*1.4 };
  draft = { pageId:current().id,existing:!!item,original:structuredClone(value),item:value };
  state.selected = item?.id || null;
  $('#font-size').value = value.size;
  $('#inline-font-size').value = value.size;
  setColor(value.color);
  $('#text-settings').hidden = false;
  $('#inline-title').textContent = block || item?.originalKey ? 'Editar texto do PDF' : item ? 'Editar texto' : 'Inserir texto';
  $('#text-content').value = value.text;
  $('#inline-editor').hidden = false;
  positionTextEditor(); drawAnnotations();
  $('#text-content').focus();
  if (value.text) $('#text-content').select();
}
function closeTextEditor(save) {
  if (!draft) return true;
  const active = draft;
  if (save && current()?.id === active.pageId) {
    const size = +$('#font-size').value;
    if (!Number.isFinite(size) || size < 6 || size > 200) { toast('Escolha um tamanho entre 6 e 200 pontos.',true); $('#inline-font-size').focus(); return false; }
    const value = { ...active.item,text:$('#text-content').value,size };
    const changed = value.text !== active.original.text || value.size !== active.original.size || value.color !== active.original.color || ['bold','italic','underline'].some((style) => !!value[style] !== !!active.original[style]);
    if (changed && (value.text.trim() || value.originalKey || active.existing)) {
      remember(); measureText(value);
      const index = current().items.findIndex((i) => i.id === value.id);
      if (index >= 0) current().items[index] = value;
      else current().items.push(value);
      state.selected = value.text ? value.id : null;
      renderPage().catch((error) => toast(error.message,true));
      renderThumbnails().catch((error) => toast(error.message,true));
    }
  }
  draft = null; $('#inline-editor').hidden = true;
  drawAnnotations(); syncControls();
  return true;
}
$('#inline-editor').onsubmit = (event) => { event.preventDefault(); closeTextEditor(true); };
$('#cancel-text').onclick = () => closeTextEditor(false);
document.querySelectorAll('[data-text-style]').forEach((button) => {
  button.onclick = () => {
    if (!draft) return;
    const style = button.dataset.textStyle;
    draft.item[style] = !draft.item[style];
    positionTextEditor();
    document.fonts.load(`${draft.item.italic ? 'italic ' : ''}${draft.item.bold ? 700 : 400} ${draft.item.size}px "Noto Sans Document"`).catch(() => {});
  };
});
$('#text-content').addEventListener('keydown',(event) => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeTextEditor(false); }
  else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); closeTextEditor(true); }
});
$('#text-content').addEventListener('input',() => { if (draft) state.dirty = true; });
$('#annotations').addEventListener('pointerdown', (event) => {
  if (!current() || state.busy || event.button !== 0) return;
  event.preventDefault();
  const position = coords(event);
  const originalKey = event.target.closest('[data-original]')?.dataset.original;
  const hitItem = current().items.find((i) => i.id === event.target.closest('[data-id]')?.dataset.id);
  if (state.tool === 'edit-text') {
    if (hitItem?.type === 'text') openTextEditor({ item:hitItem });
    else if (originalKey) openTextEditor({ block:originalBlocks.find((b) => b.key === originalKey) });
    else { closeTextEditor(true); toast('Clique em um trecho destacado. Para criar um novo texto, escolha Inserir texto.'); }
    return;
  }
  if (state.tool === 'select') {
    if (!closeTextEditor(true)) return;
    const key = hitItem?.type === 'text' ? hitItem.id : originalKey ? `${current().id}:${originalKey}` : null;
    if (key && lastTextPress?.key === key && performance.now()-lastTextPress.time < 450 && Math.hypot(position.x-lastTextPress.x,position.y-lastTextPress.y) < 5) {
      lastTextPress = null; gesture = null;
      openTextEditor(hitItem ? { item:hitItem } : { block:originalBlocks.find((b) => b.key === originalKey) });
      return;
    }
    lastTextPress = key ? { key,time:performance.now(),...position } : null;
    const item = current().items.find((i) => i.id === event.target.closest('[data-id]')?.dataset.id);
    selectItem(item);
    if (item) gesture = { type: 'move', start: position, original: structuredClone(item), saved: false };
  } else if (state.tool === 'text') {
    openTextEditor(hitItem?.type === 'text' ? { item:hitItem } : { position });
    return;
  } else if (state.tool === 'image') {
    if (!pendingImage) { $('#image-input').click(); return; }
    remember();
    const width = Math.min(200, current().width - position.x);
    const item = { id: uid(), type: 'image', ...position, w: width, h: width / pendingImage.ratio, data: pendingImage.data };
    current().items.push(item); selectItem(item); syncControls(); renderThumbnails();
  } else {
    remember();
    const item = { id: uid(), type: state.tool, ...position, w: 0, h: 0, color: state.color, size: state.stroke, ...(state.tool === 'draw' ? { points: [[position.x, position.y]] } : {}) };
    current().items.push(item);
    state.selected = item.id;
    gesture = { type: state.tool, start: position, item };
  }
  if (gesture) $('#annotations').setPointerCapture(event.pointerId);
  drawAnnotations();
});
$('#annotations').addEventListener('pointermove', (event) => {
  if (!gesture || !current()) return;
  const p = coords(event);
  if (gesture.type === 'move') {
    if (!gesture.saved && Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) < 2) return;
    if (!gesture.saved) { remember(); gesture.saved = true; }
    const item = current().items.find((i) => i.id === state.selected);
    const original = gesture.original;
    const b = bounds(original);
    const dx = Math.max(-b.x, Math.min(current().width - b.x - b.w, p.x - gesture.start.x));
    const dy = Math.max(-b.y, Math.min(current().height - b.y - b.h, p.y - gesture.start.y));
    if (item.type === 'draw') item.points = original.points.map(([x, y]) => [x + dx, y + dy]);
    else { item.x = original.x + dx; item.y = original.y + dy; }
  } else if (gesture.type === 'draw') gesture.item.points.push([p.x, p.y]);
  else Object.assign(gesture.item, { x: Math.min(p.x, gesture.start.x), y: Math.min(p.y, gesture.start.y), w: Math.abs(p.x - gesture.start.x), h: Math.abs(p.y - gesture.start.y) });
  drawAnnotations();
});
function endGesture() {
  if (!gesture) return;
  if (gesture.item && ((gesture.type === 'draw' && gesture.item.points.length < 2) || (gesture.type !== 'draw' && (gesture.item.w < 2 || gesture.item.h < 2)))) {
    current().items = current().items.filter((i) => i.id !== gesture.item.id);
    state.selected = null;
  }
  gesture = null;
  drawAnnotations(); syncControls(); renderThumbnails();
}
$('#annotations').addEventListener('pointerup', endGesture);
$('#annotations').addEventListener('pointercancel', endGesture);
$('#annotations').addEventListener('dblclick', (event) => {
  const item = current()?.items.find((i) => i.id === event.target.closest('[data-id]')?.dataset.id);
  if (item?.type === 'text') openTextEditor({ item });
  else {
    const key = event.target.closest('[data-original]')?.dataset.original;
    const block = originalBlocks.find((b) => b.key === key);
    if (block) openTextEditor({ block });
  }
});
function deleteItem() {
  if (!state.selected || !current()) return;
  remember();
  const item = current().items.find((i) => i.id === state.selected);
  if (item?.originalKey) item.text = '';
  else current().items = current().items.filter((i) => i.id !== state.selected);
  state.selected = null;
  drawAnnotations(); syncControls(); renderThumbnails();
}
function updateText() {
  if (draft) {
    $('#inline-font-size').value = $('#font-size').value;
    const size = +$('#font-size').value;
    if (Number.isFinite(size) && size >= 6 && size <= 200) { draft.item.size = size; positionTextEditor(); }
    return;
  }
  const item = current()?.items.find((i) => i.id === state.selected);
  if (item?.type !== 'text') return;
  if (item.size === textSize()) return;
  remember(); item.size = textSize();
  measureText(item); drawAnnotations(); syncControls();
}
$('#font-size').addEventListener('change', updateText);
$('#font-size').addEventListener('input',() => { if (draft) updateText(); });
$('#inline-font-size').addEventListener('input',() => {
  $('#font-size').value = $('#inline-font-size').value;
  updateText();
});
function updateColor(value) {
  setColor(value);
  if (draft) { draft.item.color = value; positionTextEditor(); return; }
  const item = current()?.items.find((i) => i.id === state.selected);
  if (item && item.type !== 'image') { remember(); item.color = value; drawAnnotations(); syncControls(); }
}
document.querySelectorAll('[data-color]').forEach((el) => el.onclick = () => updateColor(el.dataset.color));
$('#ink').onchange = (event) => updateColor(event.target.value);
$('#stroke').oninput = (event) => state.stroke = +event.target.value;
$('#image-width').onchange = (event) => {
  const item = current()?.items.find((i) => i.id === state.selected);
  if (item?.type !== 'image') return;
  remember();
  const ratio = item.w / item.h;
  item.w = +event.target.value; item.h = item.w / ratio;
  $('#image-width-label').textContent = `${Math.round(item.w)} pt`;
  drawAnnotations(); syncControls();
};
document.querySelectorAll('[data-tool]').forEach((el) => el.onclick = () => changeTool(el.dataset.tool));
for (const id of ['import', 'open-empty', 'add-pdf']) $(`#${id}`).onclick = () => $('#pdf-input').click();
$('#pdf-input').onchange = async (event) => { const files = [...event.target.files]; event.target.value = ''; await importFiles(files); };
$('#image-input').onchange = async (event) => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 10 * 1024 * 1024) { toast('Escolha uma imagem PNG ou JPEG de até 10 MB.', true); return; }
  try {
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    const image = new Image(); image.src = data; await image.decode();
    pendingImage = { data, ratio: image.naturalWidth / image.naturalHeight };
    toast('Imagem pronta. Clique na página para inserir.');
  } catch { toast('Não foi possível abrir essa imagem.', true); }
};
$('#blank').onclick = blankPage;
$('#demo').onclick = demo;
$('#undo').onclick = () => restore(state.past, state.future);
$('#redo').onclick = () => restore(state.future, state.past);
$('#delete-item').onclick = deleteItem;
$('#duplicate').onclick = () => {
  if (!current()) return;
  if (!closeTextEditor(true)) return;
  remember();
  const copy = structuredClone(current()); copy.id = uid(); copy.items.forEach((i) => i.id = uid());
  state.pages.splice(state.current + 1, 0, copy); state.current++; state.selected = null; refresh();
};
$('#delete-page').onclick = () => {
  if (!current()) return;
  closeTextEditor(false);
  remember(); state.pages.splice(state.current, 1); state.current = Math.max(0, Math.min(state.current, state.pages.length - 1)); state.selected = null; refresh();
};
function movePage(direction) {
  const position = state.current + direction;
  if (!current() || position < 0 || position >= state.pages.length) return;
  if (!closeTextEditor(true)) return;
  remember(); [state.pages[state.current], state.pages[position]] = [state.pages[position], state.pages[state.current]]; state.current = position; refresh();
}
$('#move-up').onclick = () => movePage(-1);
$('#move-down').onclick = () => movePage(1);
// Rotate the sheet and all its annotations by materializing only the current page.
// This preserves the visual relationship, including text and image orientation.
$('#rotate').onclick = async () => {
  if (!current() || state.busy) return;
  if (!closeTextEditor(true)) return;
  setBusy(true, 'Girando página…');
  try {
    const bytes = await exportDocument([current()], state.sources, fontBytes);
    const pages = await makeSource(bytes);
    const replacement = pages[0];
    replacement.rotation = (replacement.rotation + 90) % 360;
    [replacement.width, replacement.height] = [replacement.height, replacement.width];
    remember(); state.pages[state.current] = replacement; state.selected = null;
  } catch (error) { toast(error.message || 'Não foi possível girar a página.', true); }
  finally { setBusy(false); await refresh(); }
};
const fontPromises = new Map();
function fontBytes(style = 'Regular') {
  if (!fontPromises.has(style)) fontPromises.set(style,fetch(`${import.meta.env.BASE_URL}fonts/NotoSans-${style}.ttf`).then((res) => {
    if (!res.ok) throw new Error('Não foi possível carregar a fonte. Recarregue a página.');
    return res.arrayBuffer();
  }).catch((error) => { fontPromises.delete(style); throw error; }));
  return fontPromises.get(style);
}
$('#export').onclick = async () => {
  if (!current() || state.busy) return;
  if (!closeTextEditor(true)) return;
  setBusy(true, 'Preparando seu PDF…');
  try {
    const bytes = await exportDocument(state.pages, state.sources, fontBytes);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url;
    a.download = `${($('#filename').value.trim() || 'Meu documento').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\.pdf$/i, '')}-editado.pdf`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    state.dirty = false; toast('PDF pronto. Confira o download no seu navegador.');
  } catch (error) { toast(error.message || 'Não foi possível exportar. Tente novamente.', true); }
  finally { setBusy(false); syncControls(); }
};
function zoom(value) {
  if (!current()) return;
  state.zoom = Math.min(2, Math.max(.25, value)); syncControls(); renderPage();
  positionTextEditor();
}
function fit() {
  if (!current()) return;
  zoom(Math.min(1.25, ($('.desk').clientWidth - 56) / current().width));
}
$('#zoom-in').onclick = () => zoom(state.zoom + .15);
$('#zoom-out').onclick = () => zoom(state.zoom - .15);
$('#fit').onclick = fit;
$('#help').onclick = () => $('#help-dialog').showModal();
$('#close-help').onclick = $('#got-it').onclick = () => $('#help-dialog').close();
$('#help-dialog').addEventListener('click', (event) => { if (event.target === $('#help-dialog')) { const b = event.target.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) event.target.close(); } });
document.addEventListener('keydown', (event) => {
  if (state.busy || $('#help-dialog').open || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? restore(state.future, state.past) : restore(state.past, state.future); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteItem(); }
  if (event.key === 'Escape') { state.selected = null; changeTool('select'); }
});
let dropDepth = 0;
document.addEventListener('dragenter', (event) => { if (![...event.dataTransfer.types].includes('Files')) return; event.preventDefault(); dropDepth++; $('#drop-overlay').hidden = false; });
document.addEventListener('dragover', (event) => { if ([...event.dataTransfer.types].includes('Files')) event.preventDefault(); });
document.addEventListener('dragleave', (event) => { event.preventDefault(); if (--dropDepth <= 0) { dropDepth = 0; $('#drop-overlay').hidden = true; } });
document.addEventListener('drop', (event) => { event.preventDefault(); dropDepth = 0; $('#drop-overlay').hidden = true; importFiles([...event.dataTransfer.files]); });
window.addEventListener('beforeunload', (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('resize', () => { if (current() && window.innerWidth < 760) fit(); });
await document.fonts.ready;
syncControls();
