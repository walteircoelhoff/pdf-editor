let worker;
const pending = new Map();
function request(payload) {
  if (!worker) {
    worker = new Worker(new URL('./text-engine.worker.js',import.meta.url),{ type: 'module' });
    worker.onmessage = ({ data }) => {
      const item = pending.get(data.id);
      if (!item) return;
      pending.delete(data.id);
      data.error ? item.reject(new Error(data.error)) : item.resolve(data.value);
    };
    worker.onerror = () => {
      for (const item of pending.values()) item.reject(new Error('O editor de texto não pôde iniciar. Recarregue a página.'));
      pending.clear(); worker.terminate(); worker = null;
    };
  }
  return new Promise((resolve,reject) => {
    const id = crypto.randomUUID();
    pending.set(id,{ resolve,reject });
    worker.postMessage({ ...payload,id });
  });
}
export function readOriginalText(source,index) {
  source.textCache ||= new Map();
  if (!source.textCache.has(index)) source.textCache.set(index,request({ action:'extract',bytes:source.bytes,index }).catch((error) => { source.textCache.delete(index); throw error; }));
  return source.textCache.get(index);
}
export function strippedBytes(page,source) {
  const keys = [...new Set(page.items.filter((i) => i.originalKey).map((i) => i.originalKey))].sort();
  if (!keys.length) return Promise.resolve(source.bytes);
  source.stripCache ||= new Map();
  const key = `${page.index}:${keys.join(',')}`;
  if (!source.stripCache.has(key)) source.stripCache.set(key,request({ action:'remove',bytes:source.bytes,index:page.index,paths:keys.map((key) => key.split('.').map(Number)) }).catch((error) => { source.stripCache.delete(key); throw error; }));
  return source.stripCache.get(key);
}
