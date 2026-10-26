// قاعدة البيانات المحلية داخل المتصفح (IndexedDB)
const DB = (() => {
  let db;
  const stores = ['houses', 'requests', 'reports', 'bounds', 'kv', 'images', 'drafts'];
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open('mayor-app', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      stores.forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: s === 'kv' ? 'k' : 'id' }); });
    };
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = () => rej(r.error);
  });
  const st = (s, m = 'readonly') => db.transaction(s, m).objectStore(s);
  const p = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return {
    open,
    all: s => p(st(s).getAll()),
    get: (s, k) => p(st(s).get(k)),
    put: (s, v) => p(st(s, 'readwrite').put(v)),
    del: (s, k) => p(st(s, 'readwrite').delete(k)),
    clear: s => p(st(s, 'readwrite').clear()),
    getKV: async k => { const r = await p(st('kv').get(k)); return r ? r.v : undefined; },
    setKV: (k, v) => p(st('kv', 'readwrite').put({ k, v })),
    async wipe() { for (const s of stores) await this.clear(s); },
  };
})();
