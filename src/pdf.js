import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { strippedBytes } from './text-engine.js';

export const uid = () => crypto.randomUUID();
export const color = (hex) => rgb(...hex.replace('#', '').match(/../g).map((v) => parseInt(v, 16) / 255));

/** Copy original pages and map visual annotations through the PDF.js viewport.
 * This accounts for page rotation and non-zero CropBox origins. */
export async function exportDocument(pages, sources, fontBytes) {
  if (!pages.length) throw new Error('Adicione pelo menos uma página.');
  const { default: fontkit } = await import('@pdf-lib/fontkit');
  const result = await PDFDocument.create();
  result.registerFontkit(fontkit);
  const fonts = new Map();
  async function textFont(item) {
    const style = item.bold ? (item.italic ? 'BoldItalic' : 'Bold') : (item.italic ? 'Italic' : 'Regular');
    if (!fonts.has(style)) fonts.set(style,await result.embedFont(await fontBytes(style),{subset:true}));
    return fonts.get(style);
  }
  for (const page of pages) {
    const source = sources.get(page.source);
    const edited = page.items.some((i) => i.originalKey);
    const input = edited ? await PDFDocument.load(await strippedBytes(page,source)) : source.pdf;
    const [output] = await result.copyPages(input, [page.index]);
    output.setRotation(degrees(page.rotation));
    result.addPage(output);
    const original = await source.viewer.getPage(page.index + 1);
    const view = original.getViewport({ scale: 1, rotation: page.rotation });
    const point = (x, y) => {
      const [px, py] = view.convertToPdfPoint(x, y);
      return { x: px, y: py };
    };
    for (const item of page.items) {
      const ink = color(item.color || '#20314f');
      if (item.type === 'text') {
        if (!item.text) continue;
        const font = await textFont(item);
        const unsupported = [...item.text].find((character) => !font.getCharacterSet().includes(character.codePointAt(0)) && character !== '\n');
        if (unsupported) throw new Error(`A fonte não suporta “${unsupported}”. Remova esse caractere do texto para exportar.`);
        result.getPages().at(-1).drawText(item.text, {
          ...point(item.x, item.y + item.size * 1.07), font, size: item.size,
          lineHeight: item.size * 1.4, color: ink, rotate: degrees(page.rotation - (item.angle || 0)),
        });
        if (item.underline) {
          const angle = (page.rotation-(item.angle || 0))*Math.PI/180;
          const baseline = point(item.x,item.y+item.size*1.07);
          item.text.split('\n').forEach((line,index) => {
            if (!line) return;
            const distance = index*item.size*1.4+item.size*.12;
            const start = { x:baseline.x+Math.sin(angle)*distance,y:baseline.y-Math.cos(angle)*distance };
            const width = font.widthOfTextAtSize(line,item.size);
            output.drawLine({start,end:{x:start.x+Math.cos(angle)*width,y:start.y+Math.sin(angle)*width},thickness:Math.max(.6,item.size*.05),color:ink});
          });
        }
      } else if (item.type === 'draw') {
        for (let i = 1; i < item.points.length; i++) {
          output.drawLine({ start: point(...item.points[i - 1]), end: point(...item.points[i]), thickness: item.size, color: ink });
        }
      } else if (item.type === 'image') {
        const image = item.data.startsWith('data:image/png') ? await result.embedPng(item.data) : await result.embedJpg(item.data);
        output.drawImage(image, { ...point(item.x, item.y + item.h), width: item.w, height: item.h, rotate: degrees(page.rotation) });
      } else {
        output.drawRectangle({
          ...point(item.x, item.y + item.h), width: item.w, height: item.h,
          rotate: degrees(page.rotation), color: ink,
          opacity: item.type === 'highlight' ? 0.32 : 1,
          ...(item.type === 'rectangle' ? { borderColor: ink, borderWidth: item.size, opacity: 0, borderOpacity: 1 } : {}),
        });
      }
    }
  }
  result.setProducer('Folha PDF — pdf-lib');
  result.setCreator('Folha PDF');
  return result.save();
}

