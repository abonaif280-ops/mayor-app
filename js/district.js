// ============ تحديد الحي من الحدود + تقرير الحي (خريطة مرقمة وجدول، PDF وWord) ============
const District = (() => {
  const RED = '#d92d3a', GREEN = '#1f9d55';
  const MM = 96 / 25.4; // بكسل لكل ملم
  const PAGE_LIMIT = 281 * MM; // أقصى ارتفاع مفيد في الصفحة (قبل التذييل)

  // ---------- أي حي تقع فيه النقطة؟ ----------
  function inPoly(lat, lng, pts) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const yi = pts[i][0], xi = pts[i][1], yj = pts[j][0], xj = pts[j][1];
      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }
  const area = pts => { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][1] + pts[i][1]) * (pts[j][0] - pts[i][0]); return Math.abs(a / 2); };
  // الأصغر مساحةً هو الأدق (الحي التابع قبل الرئيسي)
  function of(hs) {
    const hit = (S.bounds || []).filter(b => b.points && b.points.length > 2 && inPoly(hs.lat, hs.lng, b.points));
    if (!hit.length) return null;
    hit.sort((a, b) => area(a.points) - area(b.points));
    const b = hit[0], par = b.parent && S.bounds.find(x => x.id === b.parent);
    return par ? { name: par.name, sub: b.name, id: b.id } : { name: b.name, sub: '', id: b.id };
  }
  const label = hs => { const d = of(hs); return d ? (d.sub ? d.name + ' — ' + d.sub : d.name) : ''; };

  // ---------- صورة الخريطة المرقمة (تُرسم على canvas من بلاطات الخريطة) ----------
  const TILES = {
    streets: { u: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`, at: 'Map data © OpenStreetMap contributors' },
    sat: { u: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`, at: 'Imagery © Esri' },
  };
  const wx = (lng, z) => (lng + 180) / 360 * 256 * 2 ** z;
  const wy = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** z; };
  const loadTile = url => new Promise(res => {
    const im = new Image(); im.crossOrigin = 'anonymous'; let t = setTimeout(() => res(null), 12000);
    im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); res(null); }; im.src = url;
  });
  async function renderMap(rows, bnds, base) {
    const W = 1400, H = 760, PAD = 80;
    const pts = rows.map(r => [r.hs.lat, r.hs.lng]); bnds.forEach(b => b.points.forEach(p => pts.push(p)));
    if (!pts.length) pts.push([24.4672, 39.6111]);
    const la = pts.map(p => p[0]), lo = pts.map(p => p[1]);
    const la0 = Math.min(...la), la1 = Math.max(...la), lo0 = Math.min(...lo), lo1 = Math.max(...lo);
    let z = 19;
    for (; z > 8; z--) { if (wx(lo1, z) - wx(lo0, z) <= W - 2 * PAD && wy(la0, z) - wy(la1, z) <= H - 2 * PAD) break; }
    if (la1 - la0 < 1e-5 && lo1 - lo0 < 1e-5) z = Math.min(z, 17);
    z = Math.min(z, 19);
    const cx = (wx(lo0, z) + wx(lo1, z)) / 2, cy = (wy(la0, z) + wy(la1, z)) / 2, ox = cx - W / 2, oy = cy - H / 2;
    const T = TILES[base] || TILES.streets, n = 2 ** z;
    const jobs = [];
    for (let tx = Math.floor(ox / 256); tx <= Math.floor((ox + W) / 256); tx++) for (let ty = Math.floor(oy / 256); ty <= Math.floor((oy + H) / 256); ty++) {
      if (ty < 0 || ty >= n) continue;
      jobs.push(loadTile(T.u(z, ((tx % n) + n) % n, ty)).then(im => ({ im, px: tx * 256 - ox, py: ty * 256 - oy })));
    }
    const tiles = await Promise.all(jobs); let tilesOk = tiles.some(t => t.im);
    const px = (lat, lng) => [wx(lng, z) - ox, wy(lat, z) - oy];
    function draw(useTiles) {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
      x.fillStyle = '#e9edea'; x.fillRect(0, 0, W, H);
      if (useTiles) tiles.forEach(t => { if (t.im) x.drawImage(t.im, t.px, t.py, 256, 256); });
      else { x.strokeStyle = '#d3d9d5'; x.lineWidth = 1; for (let i = 0; i < W; i += 70) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let i = 0; i < H; i += 70) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); } }
      x.lineJoin = 'round'; x.textAlign = 'center'; x.textBaseline = 'middle';
      bnds.forEach(b => {
        const q = b.points.map(p => px(p[0], p[1])); x.beginPath(); q.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath();
        x.globalAlpha = .1; x.fillStyle = b.color || '#2563eb'; x.fill(); x.globalAlpha = 1;
        x.setLineDash(b.parent ? [14, 10] : []); x.lineWidth = b.parent ? 4 : 5.5; x.strokeStyle = b.color || '#2563eb'; x.stroke(); x.setLineDash([]);
        const mx = q.reduce((s, p) => s + p[0], 0) / q.length, my = q.reduce((s, p) => s + p[1], 0) / q.length;
        x.font = '700 30px Tajawal, Arial, sans-serif'; x.lineWidth = 7; x.strokeStyle = 'rgba(255,255,255,.92)'; x.strokeText(b.name, mx, my); x.fillStyle = b.color || '#2563eb'; x.fillText(b.name, mx, my);
      });
      const order = rows.slice().sort((a, b) => (a.notes ? 1 : 0) - (b.notes ? 1 : 0)); // الأحمر فوق الأخضر
      order.forEach(r => {
        const [a, b] = px(r.hs.lat, r.hs.lng), R = r.n > 99 ? 22 : 19;
        x.beginPath(); x.arc(a, b, R, 0, 7); x.fillStyle = r.notes ? RED : GREEN; x.fill(); x.lineWidth = 3.5; x.strokeStyle = '#fff'; x.stroke();
        x.fillStyle = '#fff'; x.font = '700 ' + (r.n > 99 ? 16 : 20) + 'px Arial, sans-serif'; x.fillText(String(r.n), a, b + 1);
      });
      const txt = useTiles ? T.at : 'تعذر تحميل خلفية الخريطة (لا يوجد اتصال بالإنترنت)'; x.font = '15px Arial, Tajawal, sans-serif'; x.textAlign = 'right';
      const tw = x.measureText(txt).width + 14; x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(W - tw, H - 26, tw, 26); x.fillStyle = '#333'; x.fillText(txt, W - 7, H - 12);
      return cv;
    }
    let cv = draw(tilesOk), url;
    try { url = cv.toDataURL('image/jpeg', 0.88); } catch (e) { tilesOk = false; cv = draw(false); url = cv.toDataURL('image/jpeg', 0.88); }
    return { url, w: W, h: H, tilesOk };
  }

  // ---------- تجهيز البيانات ----------
  const clip = (t, n = 450) => { t = String(t || '').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
  async function prepare(o) {
    let list = S.houses.slice(), bnd = null, bnds;
    if (o.scope !== 'all') {
      bnd = S.bounds.find(b => b.id === o.scope);
      if (bnd) { list = list.filter(x => inPoly(x.lat, x.lng, bnd.points)); bnds = [bnd, ...S.bounds.filter(b => b.parent === bnd.id)]; }
    }
    if (!bnds) bnds = S.bounds.filter(b => b.visible !== false && b.points && b.points.length > 2);
    if (o.filter === 'notes') list = list.filter(hasNotes); else if (o.filter === 'data') list = list.filter(x => !hasNotes(x)); else if (o.filter !== 'all') list = list.filter(x => (x.tags || []).includes(o.filter));
    list.sort((a, b) => (hasNotes(b) ? 1 : 0) - (hasNotes(a) ? 1 : 0) || (a.created || 0) - (b.created || 0));
    const rows = list.map((hs, i) => ({ n: i + 1, hs, notes: hasNotes(hs) }));
    const name = bnd ? bnd.name : (S.settings.district || 'الحي');
    const tagCount = {}; rows.forEach(r => (r.hs.tags || []).forEach(t => tagCount[t] = (tagCount[t] || 0) + 1));
    const nN = rows.filter(r => r.notes).length;
    const map = rows.length ? await renderMap(rows, bnds, o.base) : null;
    return {
      name, subject: (o.subject || '').trim() || 'تقرير عن وضع حي ' + name, to: (o.to || '').trim(), dateStr: fmtISO(todayISO()) + (S.settings.calendar === 'hijri' ? ' هـ' : ' م'),
      personal: !!o.personal, summary: { total: rows.length, notes: nN, data: rows.length - nN, tags: Object.entries(tagCount) },
      map, rows: rows.map(r => ({
        n: r.n, notes: r.notes, addr: r.hs.address || '', coords: r.hs.lat.toFixed(5) + ', ' + r.hs.lng.toFixed(5), district: label(r.hs), tags: (r.hs.tags || []).join('، '),
        note: r.notes ? clip(r.hs.notes) : '', owner: r.hs.owner || '', nid: r.hs.nid || '', phone: r.hs.phone || '', floors: r.hs.floors || ''
      })),
    };
  }

  // ---------- صفحات A4 ----------
  const fontsReady = async () => { try { await Promise.all([document.fonts.load('16pt Tajawal'), document.fonts.load('bold 16pt Tajawal'), document.fonts.load('16pt Amiri')]); await document.fonts.ready; } catch (e) { } };
  function headerEl(d) {
    const s = S.settings, line = (k, v) => h('div', { class: 'hline' }, h('b', {}, k + ': '), h('span', {}, v));
    return h('div', { class: 'head' },
      h('div', { class: 'hr' }, ['المملكة العربية السعودية', 'وزارة الداخلية', 'الأمن العام', s.region, s.center].filter(Boolean).map(t => h('div', {}, t))),
      h('div', { class: 'hlogo' }, s.logo ? h('img', { src: s.logo }) : h('div', { class: 'nologo noprint' }, 'الشعار')),
      h('div', { class: 'hl' }, line('التاريخ', d.dateStr), line('الموضوع', d.subject), d.to ? line('إلى', d.to) : null, line('المشفعات', 'خريطة وجدول بيانات')));
  }
  const cols = d => d.personal
    ? [['م', 'c n'], ['الموقع', 'loc'], ['المالك والتواصل', 'own'], ['الحي', 'dst'], ['الوسوم', 'tg'], ['الملاحظات', 'nt']]
    : [['م', 'c n'], ['الموقع', 'loc'], ['الحي', 'dst'], ['الوسوم', 'tg'], ['الملاحظات', 'nt']];
  function rowEl(d, r) {
    const td = (cls, ...k) => h('td', { class: cls }, ...k), out = [];
    out.push(td('c n', h('span', { class: 'nb ' + (r.notes ? 'r' : 'g') }, r.n)));
    out.push(td('loc', h('div', {}, r.addr || '—'), h('div', { class: 'crd', dir: 'ltr' }, r.coords)));
    if (d.personal) out.push(td('own', h('div', {}, r.owner || '—'), r.nid ? h('div', { class: 'crd', dir: 'ltr' }, r.nid) : null, r.phone ? h('div', { class: 'crd', dir: 'ltr' }, r.phone) : null));
    out.push(td('dst', r.district || '—'), td('tg', r.tags || '—'), td('nt', r.notes ? r.note : h('span', { class: 'okt' }, 'بيانات فقط')));
    return h('tr', { class: r.notes ? 'hasn' : '' }, out);
  }
  const tableEl = d => h('table', { class: 'dtab' }, h('thead', {}, h('tr', {}, cols(d).map(([t, c]) => h('th', { class: c }, t)))), h('tbody'));
  function newPage(first, d) {
    const s = S.settings, inn = h('div', { class: 'in' });
    const pg = h('div', { class: 'a4 drep f-' + (s.reportFont || 'tajawal') }, inn);
    if (first) {
      const sm = d.summary, tg = sm.tags.length ? 'الوسوم: ' + sm.tags.map(([t, c]) => t + ' (' + c + ')').join(' • ') : '';
      inn.append(headerEl(d), h('div', { class: 'ttl' }, 'تقرير عن وضع حي ' + d.name),
        h('div', { class: 'sumrow' },
          h('div', { class: 'sbox' }, h('b', {}, sm.total), h('span', {}, 'إجمالي البيوت')),
          h('div', { class: 'sbox r' }, h('b', {}, sm.notes), h('span', {}, 'عليها ملاحظات')),
          h('div', { class: 'sbox g' }, h('b', {}, sm.data), h('span', {}, 'بيانات فقط'))),
        tg ? h('div', { class: 'tgline' }, tg) : null,
        d.map ? h('div', { class: 'mapfig' }, h('img', { src: d.map.url, style: { aspectRatio: d.map.w + ' / ' + d.map.h } }), h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'lg r' }), 'عليها ملاحظات'), h('span', {}, h('i', { class: 'lg g' }), 'بيانات فقط'), h('span', {}, 'أرقام الدبابيس تطابق أرقام الجدول'))) : null);
    } else inn.append(h('div', { class: 'cont' }, 'تقرير عن وضع حي ' + d.name + ' — تابع'));
    return pg;
  }
  const imgsReady = el => Promise.all([...el.querySelectorAll('img')].map(i => (i.decode ? i.decode().catch(() => { }) : null)));
  async function buildPages(d) {
    await fontsReady();
    const pr = $('#printRoot'); const host = h('div'); pr.append(host);
    const pages = []; let pg = newPage(true, d), tb = null;
    host.append(pg); pages.push(pg); await imgsReady(pg);
    const over = el => el.getBoundingClientRect().bottom - pg.getBoundingClientRect().top > PAGE_LIMIT;
    const addTable = () => { const t = tableEl(d); pg.querySelector('.in').append(t); tb = t.querySelector('tbody'); return t; };
    let tbl = addTable();
    if (over(tbl)) { /* رأس الجدول لا يتسع: انقله لصفحة جديدة */ tbl.remove(); pg = newPage(false, d); host.append(pg); pages.push(pg); tbl = addTable(); }
    for (const r of d.rows) {
      const tr = rowEl(d, r); tb.append(tr);
      if (over(tr) && tb.children.length > 1) {
        tr.remove(); pg = newPage(false, d); host.append(pg); pages.push(pg); addTable(); tb.append(tr);
      }
    }
    const s = S.settings;
    const sig = h('div', { class: 'sigblk dsig' }, h('div', {}, 'عمدة حي ' + (s.district || d.name || '.....')), h('div', { class: 'nm' }, s.mayorName || '.....'), s.sig ? h('img', { class: 'sigimg', src: s.sig }) : h('div', { class: 'sigspace' }));
    pg.querySelector('.in').append(sig); await imgsReady(sig);
    if (over(sig)) { sig.remove(); pg = newPage(false, d); host.append(pg); pages.push(pg); pg.querySelector('.in').append(sig); }
    pages.forEach((p, i) => p.append(h('div', { class: 'pfoot' }, h('span', {}, 'صفحة ' + (i + 1) + ' من ' + pages.length), h('span', {}, 'عمدة الحي — ' + d.dateStr))));
    pages.forEach(p => p.remove()); host.remove();
    return pages;
  }

  // ---------- النافذة: الخيارات ثم المعاينة والتصدير ----------
  function open() {
    if (!S.houses.length) { toast('سجّل بيتًا واحدًا على الأقل لإنشاء التقرير'); return; }
    const mains = S.bounds.filter(b => !b.parent && b.points && b.points.length > 2), subs = S.bounds.filter(b => b.parent && b.points && b.points.length > 2);
    const countIn = b => S.houses.filter(x => inPoly(x.lat, x.lng, b.points)).length;
    const o = { scope: mains.length ? mains[0].id : 'all', filter: 'all', base: 'streets', subject: '', to: '', personal: false };
    const scopes = [...mains, ...subs].map(b => [b.id, (b.parent ? '↳ ' : '') + b.name + ' (' + countIn(b) + ' بيت)']); scopes.push(['all', 'كل البيوت المسجلة (' + S.houses.length + ')']);
    const sh = openSheet('تقرير الحي', { tall: true });
    sh.body.append(
      !scopes.length || !S.bounds.length ? h('div', { class: 'note green' }, 'لم ترسم حدود الحي بعد. ارسمها من الخريطة (زر الحدود) ليظهر اسم الحي تلقائيًا في التقرير.') : null,
      field('نطاق التقرير', sel(o, 'scope', scopes)),
      field('البيوت المطلوب إدراجها', sel(o, 'filter', [['all', 'كل البيوت (الأحمر أولًا)'], ['notes', 'التي عليها ملاحظات فقط'], ['data', 'التي فيها بيانات فقط'], ...(S.settings.tags || []).map(t => [t, 'وسم: ' + t])])),
      field('خلفية الخريطة', sel(o, 'base', [['streets', 'شوارع'], ['sat', 'صور جوية']]), 'تحتاج اتصالًا بالإنترنت لحظة الإنشاء'),
      field('عنوان التقرير (اختياري)', tx(o, 'subject', { ph: 'مثال: تقرير عن وضع حي العوالي' })),
      field('الجهة المرفوع لها (اختياري)', tx(o, 'to', { ph: 'مثال: أمانة منطقة المدينة المنورة' })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: e => { o.personal = e.target.checked; } }), ' إظهار أسماء الملاك والهويات وأرقام الجوال'),
      h('small', { class: 'hint' }, 'مخفية افتراضيًا عند رفع التقرير لجهة خارجية. تظهر الإحداثيات والعنوان الوطني لتحديد الموقع.'));
    sh.foot.append(h('button', { class: 'btn ghost', onclick: sh.close }, 'إلغاء'), h('button', { class: 'btn pri', onclick: () => { sh.close(); show(o); } }, 'إنشاء التقرير'));
  }
  async function show(o) {
    const pg = openPage('تقرير الحي', { onBack: close => close() });
    const info = h('p', { class: 'mut' }, 'جارٍ تجهيز الخريطة والتقرير…'); pg.body.append(info);
    let d, pages;
    try { d = await prepare(o); pages = await buildPages(d); } catch (e) { console.error(e); info.textContent = 'تعذر إنشاء التقرير'; return; }
    if (!d.rows.length) { info.textContent = 'لا توجد بيوت ضمن هذا النطاق أو التصنيف. غيّر الخيارات.'; return; }
    pg.body.innerHTML = '';
    const warn = h('div', { class: 'warn' + (d.map && d.map.tilesOk ? ' hidden' : '') }, 'تعذر تحميل خلفية الخريطة (لا يوجد اتصال). رُسمت الحدود والدبابيس على خلفية بيضاء. اتصل بالإنترنت وأعد الإنشاء للحصول على الخلفية.');
    const box = h('div', { class: 'prevbox' }); pg.body.append(warn, h('p', { class: 'mut' }, pages.length + ' صفحة • ' + d.summary.total + ' بيت'), box);
    const mount = () => {
      box.innerHTML = ''; const k = Math.min(1, (box.clientWidth - 4) / 794);
      pages.forEach(p => { const w = h('div', { class: 'prevwrap dprev' }, p); box.append(w); p.style.transform = 'translateX(-50%) scale(' + k + ')'; w.style.height = Math.ceil(1123 * k) + 'px'; });
    }; mount();
    const doPrint = () => {
      const pr = $('#printRoot'); pr.innerHTML = ''; pages.forEach(p => { const c = p.cloneNode(true); c.style.transform = ''; pr.append(c); });
      toast('اختر «حفظ كملف PDF» من نافذة الطباعة للحصول على PDF', 4500);
      const clear = () => { pr.innerHTML = ''; window.removeEventListener('afterprint', clear); }; window.addEventListener('afterprint', clear); setTimeout(() => window.print(), 300);
    };
    const mkWord = async () => ({ blob: await Docx.buildDistrict(d, S.settings), name: 'تقرير-حي-' + d.name.replace(/\s+/g, '-') + '.docx' });
    const doWord = async () => { try { const w = await mkWord(); downloadBlob(w.blob, w.name); toast('تم تجهيز ملف Word'); } catch (e) { console.error(e); toast('تعذر إنشاء ملف Word'); } };
    const doShare = async () => { try { const w = await mkWord(); await shareFile(w.blob, w.name, 'تقرير حي ' + d.name); } catch (e) { console.error(e); toast('تعذرت المشاركة'); } };
    pg.foot.append(h('button', { class: 'btn pri', onclick: doPrint }, icon('print', 20), ' طباعة / PDF'), h('button', { class: 'btn ghost', onclick: doWord }, 'Word'), h('button', { class: 'btn ghost', onclick: doShare }, icon('share', 20)));
  }
  return { of, label, open, inPoly, prepare, buildPages };
})();
