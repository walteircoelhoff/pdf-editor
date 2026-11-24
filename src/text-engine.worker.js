import { init } from '@embedpdf/pdfium';
import wasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';

let engine;
async function getEngine() {
  return engine ||= fetch(wasmUrl).then((r) => {
    if (!r.ok) throw new Error('Não foi possível carregar o editor de texto.');
    return r.arrayBuffer();
  }).then(async (wasmBinary) => {
    const api = await init({ wasmBinary });
    api.PDFiumExt_Init();
    return api;
  }).catch((error) => { engine = null; throw error; });
}
const identity = [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const transform = (m, x, y) => [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];

async function execute({ bytes, index, action, paths }) {
  const m = await getEngine();
  const runtime = m.pdfium;
  const alloc = (n) => runtime.wasmExports.malloc(n);
  const free = (p) => runtime.wasmExports.free(p);
  const data = alloc(bytes.length);
  runtime.HEAPU8.set(bytes, data);
  let doc = 0, page = 0, textPage = 0;
  const scratch = alloc(80);
  const read = (offset, type = 'float') => runtime.getValue(scratch + offset, type);
  function matrix(object) {
    if (!m.FPDFPageObj_GetMatrix(object, scratch)) return identity;
    return Array.from({ length: 6 }, (_, i) => read(i * 4));
  }
  try {
    doc = m.FPDF_LoadMemDocument(data, bytes.length, '');
    if (!doc) throw new Error('Não foi possível ler o conteúdo deste PDF.');
    page = m.FPDF_LoadPage(doc, index);
    if (!page) throw new Error('Não foi possível abrir a página.');
    textPage = m.FPDFText_LoadPage(page);
    if (action === 'extract') {
      const result = [];
      const objects = new Map();
      function walk(parent, isForm, path = [], ancestor = identity, depth = 0) {
        if (depth > 24) return;
        const count = isForm ? m.FPDFFormObj_CountObjects(parent) : m.FPDFPage_CountObjects(parent);
        for (let i = 0; i < count; i++) {
          const object = isForm ? m.FPDFFormObj_GetObject(parent, i) : m.FPDFPage_GetObject(parent, i);
          const objectPath = [...path, i];
          const type = m.FPDFPageObj_GetType(object);
          if (type === 5) { walk(object, true, objectPath, multiply(ancestor, matrix(object)), depth + 1); continue; }
          if (type !== 1 || m.FPDFTextObj_GetTextRenderMode(object) === 3) continue;
          const length = m.FPDFTextObj_GetText(object, textPage, 0, 0);
          if (length <= 2) continue;
          const buffer = alloc(length);
          let text;
          try { m.FPDFTextObj_GetText(object, textPage, buffer, length); text = runtime.UTF16ToString(buffer); }
          finally { free(buffer); }
          if (!text.trim()) continue;
          const local = multiply(ancestor, matrix(object));
          if (!m.FPDFPageObj_GetBounds(object, scratch, scratch+4, scratch+8, scratch+12)) continue;
          const [left,bottom,right,top] = [read(0),read(4),read(8),read(12)];
          const corners = [[left,bottom],[left,top],[right,bottom],[right,top]].map(([x,y]) => transform(ancestor,x,y));
          m.FPDFTextObj_GetFontSize(object, scratch);
          const size = Math.abs(read(0)) * Math.hypot(local[0], local[1]);
          let color = '#20314f';
          if (m.FPDFPageObj_GetFillColor(object,scratch,scratch+4,scratch+8,scratch+12)) color = '#' + [0,4,8].map((o) => read(o,'i32').toString(16).padStart(2,'0')).join('');
          const block = { key: objectPath.join('.'), path: objectPath, text, size, color, corners, baseline: [local[4],local[5]], direction: [local[0],local[1]], editable: size > 0 && Number.isFinite(size) };
          if (objects.has(object)) {
            block.editable = false;
            objects.get(object).editable = false;
          } else objects.set(object,block);
          result.push(block);
        }
      }
      walk(page,false);
      return result;
    }
    // Resolve every handle before removing anything: indexes shift on removal.
    const targets = paths.map((path) => {
      let parent = page, object;
      for (let i = 0; i < path.length; i++) {
        object = i === 0 ? m.FPDFPage_GetObject(parent,path[i]) : m.FPDFFormObj_GetObject(parent,path[i]);
        if (!object) throw new Error('O trecho original não foi localizado. Reabra o documento.');
        if (i < path.length-1) parent = object;
      }
      if (m.FPDFPageObj_GetType(object) !== 1) throw new Error('O objeto selecionado não é texto.');
      return { parent, object, form: path.length > 1 };
    });
    m.FPDFText_ClosePage(textPage); textPage = 0;
    for (const { parent, object, form } of targets) {
      const removed = form ? m.FPDFFormObj_RemoveObject(parent,object) : m.FPDFPage_RemoveObject(parent,object);
      if (!removed) throw new Error('Não foi possível substituir este trecho.');
      m.FPDFPageObj_Destroy(object);
    }
    if (!m.FPDFPage_GenerateContent(page)) throw new Error('Não foi possível gravar a alteração no conteúdo da página.');
    const writer = m.PDFiumExt_OpenFileWriter();
    if (!writer) throw new Error('Não foi possível salvar a alteração.');
    let output = 0;
    try {
      if (!m.FPDF_SaveAsCopy(doc,writer,2)) throw new Error('Não foi possível gravar o PDF editado.');
      const size = m.PDFiumExt_GetFileWriterSize(writer);
      output = alloc(size);
      m.PDFiumExt_GetFileWriterData(writer,output,size);
      return runtime.HEAPU8.slice(output,output+size);
    } finally { if (output) free(output); m.PDFiumExt_CloseFileWriter(writer); }
  } finally {
    if (textPage) m.FPDFText_ClosePage(textPage);
    if (page) m.FPDF_ClosePage(page);
    if (doc) m.FPDF_CloseDocument(doc);
    free(scratch); free(data);
  }
}
// Keep native operations serialized; all documents and allocations close per request.
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try { self.postMessage({ id: data.id, value: await execute(data) }); }
    catch (error) { self.postMessage({ id: data.id, error: error.message || 'Não foi possível processar o texto.' }); }
  });
};
