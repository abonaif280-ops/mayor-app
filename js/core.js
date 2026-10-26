// ============ الحالة العامة والأدوات المشتركة ============
const DEFAULT_TAGS = ['مؤجر', 'مهجور', 'تحت الإنشاء', 'محل تجاري'];
const DEFAULTS = {
  mayorName: '', district: '', center: '', region: 'شرطة منطقة المدينة المنورة',
  logo: '', sig: '', pin: '', calendar: 'gregorian', startNo: 1, fontScale: 1, theme: 'light',
  reportFont: 'tajawal', tags: DEFAULT_TAGS.slice(), lastBackup: 0, firstUse: 0, wizardDone: false, tipShown: false,
};
const S = { settings: { ...DEFAULTS }, houses: [], requests: [], reports: [], bounds: [], tab: 'map', filter: 'all' };

// ---------- بناء عناصر الواجهة ----------
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag); let val;
  for (const k in (attrs || {})) {
    const v = attrs[k]; if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'value') val = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') e[k] = !!v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  if (val !== undefined) e.value = val;
  return e;
}
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n, w = 3) => String(n).padStart(w, '0');
const debounce = (fn, ms = 500) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const ICONS = {
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
  req: '<path d="M4 5h16v14H4zM4 13h5l1 2h4l1-2h5"/>',
  rep: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  set: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  wa: '<path d="M4 20l1.3-4.2A8 8 0 1 1 8.3 18.8zM9 9c0 3 3 6 6 6l1-1.5-2-1-1 .8c-1-.5-2-1.500-2.500-2.500l.8-1-1-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M12 21s-7-6.500-7-12a7 7 0 0 1 14 0c0 5.500-7 12-7 12z"/><circle cx="12" cy="9" r="2.500"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  poly: '<path d="M5 7l8-3 6 6-3 9-10-2z"/>',
  locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  share: '<circle cx="6" cy="12" r="2.500"/><circle cx="17" cy="6" r="2.500"/><circle cx="17" cy="18" r="2.500"/><path d="m8.200 11 6.600-3.500M8.200 13l6.600 3.500"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  back: '<path d="m9 5 7 7-7 7"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  edit: '<path d="m4 20 4-1 11-11-3-3L5 16zM14 6l3 3"/>',
};
const icon = (n, s = 22) => h('span', { class: 'ico', html: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>` });

// ---------- رسائل وتنبيهات ----------
let toastT;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

// ---------- النوافذ ----------
function openSheet(title, opts = {}) {
  const ov = h('div', { class: 'ov' });
  const body = h('div', { class: 'sh-body' }), foot = h('div', { class: 'sh-foot' });
  const close = () => { ov.remove(); opts.onClose && opts.onClose(); };
  const box = h('div', { class: 'sheet' + (opts.tall ? ' tall' : '') },
    h('div', { class: 'sh-head' }, h('b', {}, title), h('button', { class: 'x', onclick: close, 'aria-label': 'إغلاق' }, '✕')), body, foot);
  ov.append(box);
  if (!opts.sticky) ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.body.append(ov);
  return { close, body, foot, ov };
}
function openPage(title, opts = {}) {
  const ov = h('div', { class: 'page-ov' });
  const body = h('div', { class: 'pg-body' }), foot = h('div', { class: 'pg-foot' });
  const close = () => { ov.remove(); opts.onClose && opts.onClose(); };
  const head = h('div', { class: 'pg-head' }, h('button', { class: 'back', onclick: () => (opts.onBack ? opts.onBack(close) : close()), 'aria-label': 'رجوع' }, icon('back', 24)), h('b', {}, title));
  ov.append(head, body, foot); document.body.append(ov);
  return { close, body, foot, head, ov };
}
function confirmBox(msg, ok = 'تأكيد', danger = false, cancel = 'إلغاء') {
  return new Promise(res => {
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    const sh = openSheet('تأكيد', { sticky: false, onClose: () => fin(false) });
    sh.body.append(h('p', { class: 'msg' }, msg));
    sh.foot.append(h('button', { class: 'btn ghost', onclick: () => { sh.close(); } }, cancel),
      h('button', { class: 'btn ' + (danger ? 'danger' : 'pri'), onclick: () => { fin(true); sh.close(); } }, ok));
  });
}
function askText(title, label, value = '', ok = 'حفظ') {
  return new Promise(res => {
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    const sh = openSheet(title, { onClose: () => fin(null) });
    const i = h('input', { class: 'in', value, placeholder: label });
    sh.body.append(h('label', { class: 'field' }, h('span', {}, label), i));
    const go = () => { const v = i.value.trim(); if (!v) { toast('اكتب القيمة أولًا'); return; } fin(v); sh.close(); };
    i.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    sh.foot.append(h('button', { class: 'btn ghost', onclick: sh.close }, 'إلغاء'), h('button', { class: 'btn pri', onclick: go }, ok));
    setTimeout(() => i.focus(), 80);
  });
}

// ---------- حقول النماذج ----------
const field = (label, input, hint) => h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', {}, hint) : null);
const tx = (o, k, p = {}) => h('input', { type: p.type || 'text', class: 'in', placeholder: p.ph, value: o[k] ?? '', maxlength: p.ml, inputmode: p.mode, autocomplete: 'off', list: p.list, oninput: e => { o[k] = e.target.value; p.on && p.on(e); } });
const ta = (o, k, p = {}) => h('textarea', { class: 'in', rows: p.rows || 3, placeholder: p.ph, value: o[k] ?? '', oninput: e => { o[k] = e.target.value; p.on && p.on(e); } });
const sel = (o, k, opts, p = {}) => h('select', { class: 'in', value: o[k] ?? opts[0][0], onchange: e => { o[k] = e.target.value; p.on && p.on(e); } }, opts.map(([v, l]) => h('option', { value: v }, l)));

// ---------- جوال وهوية ----------
const digits = s => String(s || '').replace(/[^\d]/g, '').replace(/[٠-٩]/g, '');
function arDigits(s) { return String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); }
const cleanNum = s => arDigits(s).replace(/[^\d]/g, '');
function waLink(p, text) {
  let d = cleanNum(p); if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('05')) d = '966' + d.slice(1); else if (d.length === 9 && d.startsWith('5')) d = '966' + d;
  return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '');
}
const telLink = p => 'tel:' + cleanNum(p);
function checkPhone(p) { if (!p) return ''; const d = cleanNum(p); return /^05\d{8}$/.test(d) ? '' : 'رقم الجوال لازم يكون 10 أرقام ويبدأ بـ 05'; }
function checkNid(n) { if (!n) return ''; return /^\d{10}$/.test(cleanNum(n)) ? '' : 'رقم الهوية لازم يكون 10 أرقام'; }

// ---------- التواريخ ----------
const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function fmtDate(d, cal) {
  cal = cal || S.settings.calendar; d = d instanceof Date ? d : new Date(d);
  if (isNaN(d)) return '';
  const loc = cal === 'hijri' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-CA-u-nu-latn';
  try {
    const p = new Intl.DateTimeFormat(loc, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const g = t => p.find(x => x.type === t).value.replace(/\D/g, '');
    return g('year') + '/' + g('month').padStart(2, '0') + '/' + g('day').padStart(2, '0');
  } catch (e) { return d.toISOString().slice(0, 10).replace(/-/g, '/'); }
}
const fmtISO = (iso, cal) => iso ? fmtDate(new Date(iso + 'T12:00:00'), cal) : '';
const yearOf = (iso, cal) => parseInt(fmtISO(iso, cal).split('/')[0], 10);
const fmtTime = ts => { const d = new Date(ts); return fmtDate(d) + ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2); };
const daysSince = ts => Math.floor((Date.now() - ts) / 86400000);

// ---------- الصور والملفات ----------
function readDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
async function compressImage(file, max = 1280, q = 0.7) {
  const src = await readDataURL(file);
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * k)), hh = Math.max(1, Math.round(img.height * k));
      const c = document.createElement('canvas'); c.width = w; c.height = hh;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, hh); x.drawImage(img, 0, 0, w, hh);
      res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => rej(new Error('تعذر قراءة الصورة'));
    img.src = src;
  });
}
// يحوّل أي صورة (شعار/توقيع) إلى PNG بحجم معقول للطباعة ولملف Word
async function normalizePng(file, max = 600) {
  const src = await readDataURL(file);
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width || max, img.height || max));
      const w = Math.max(1, Math.round((img.width || max) * k)), hh = Math.max(1, Math.round((img.height || max) * k));
      const c = document.createElement('canvas'); c.width = w; c.height = hh; c.getContext('2d').drawImage(img, 0, 0, w, hh);
      res(c.toDataURL('image/png'));
    };
    img.onerror = () => rej(new Error('تعذر قراءة الصورة'));
    img.src = src;
  });
}
async function saveImg(data, name, type) { const id = uid(); await DB.put('images', { id, data, name: name || '', type: type || '' }); return id; }
const getImg = id => DB.get('images', id);
const delImg = id => DB.del('images', id);
function pickFile(accept, multiple) {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, multiple: multiple ? true : null, style: { display: 'none' } });
    i.addEventListener('change', () => { res([...i.files]); i.remove(); });
    document.body.append(i); i.click();
  });
}
function openDataFile(rec) {
  if (!rec) { toast('الملف غير موجود (ربما استُعيدت نسخة بدون صور)'); return; }
  if ((rec.type || '').startsWith('image/') || /^data:image/.test(rec.data)) {
    const sh = openSheet(rec.name || 'صورة', { tall: true });
    sh.body.append(h('img', { src: rec.data, class: 'fullimg' }));
  } else {
    const b = dataToBlob(rec.data); const u = URL.createObjectURL(b);
    const w = window.open(u, '_blank'); if (!w) downloadBlob(b, rec.name || 'ملف');
  }
}
function dataToBlob(dataUrl) {
  const [m, b] = dataUrl.split(','); const mime = (m.match(/:(.*?);/) || [])[1] || 'application/octet-stream';
  const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime });
}
function downloadBlob(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
}
async function shareFile(blob, name, title) {
  try {
    const f = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return true; }
  downloadBlob(blob, name); toast('جهازك لا يدعم المشاركة المباشرة، تم تحميل الملف'); return false;
}

// ---------- التوقيع بالإصبع ----------
function sigPad() {
  const c = h('canvas', { class: 'sigcanvas', width: 700, height: 260 });
  const x = c.getContext('2d'); x.lineWidth = 4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#111';
  let drawing = false, dirty = false;
  const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.addEventListener('pointerdown', e => { drawing = true; dirty = true; c.setPointerCapture(e.pointerId); const [a, b] = pos(e); x.beginPath(); x.moveTo(a, b); x.lineTo(a + 0.1, b + 0.1); x.stroke(); e.preventDefault(); });
  c.addEventListener('pointermove', e => { if (!drawing) return; const [a, b] = pos(e); x.lineTo(a, b); x.stroke(); e.preventDefault(); });
  const end = () => { drawing = false; };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  const el = h('div', { class: 'sigbox' }, c, h('div', { class: 'sigtools' }, h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { x.clearRect(0, 0, c.width, c.height); dirty = false; } }, 'مسح')));
  return { el, isEmpty: () => !dirty, data: () => c.toDataURL('image/png') };
}

// ---------- الإعدادات والبيانات ----------
function hashPin(p) { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0; i < p.length; i++) { const ch = p.charCodeAt(i); a = Math.imul(a ^ ch, 2654435761); b = Math.imul(b ^ ch, 1597334677); } a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36) + ':mayor'; }
async function loadSettings() { const s = await DB.getKV('settings'); S.settings = { ...DEFAULTS, tags: DEFAULT_TAGS.slice(), ...(s || {}) }; }
const saveSettings = () => DB.setKV('settings', S.settings);
async function loadAll() { S.houses = await DB.all('houses'); S.requests = await DB.all('requests'); S.reports = await DB.all('reports'); S.bounds = await DB.all('bounds'); }
async function putRec(store, arr, rec) { await DB.put(store, rec); const i = arr.findIndex(x => x.id === rec.id); if (i >= 0) arr[i] = rec; else arr.push(rec); }
async function delRec(store, arr, id) { await DB.del(store, id); const i = arr.findIndex(x => x.id === id); if (i >= 0) arr.splice(i, 1); }
function applyPrefs() {
  document.documentElement.dataset.theme = S.settings.theme || 'light';
  document.documentElement.style.fontSize = (16 * (S.settings.fontScale || 1)) + 'px';
}
function houseTitle(hs) { return hs.owner || 'بيت بدون اسم'; }
const hasNotes = hs => !!(hs.notes && hs.notes.trim());
function houseById(id) { return S.houses.find(x => x.id === id); }
