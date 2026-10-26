// ============ الخريطة وبطاقات البيوت وحدود الأحياء ============
const MapUI = (() => {
  const RED = '#d92d3a', GREEN = '#1f9d55';
  const FLOORS = ['الأرضي', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
  const PALETTE = ['#2563eb', '#9333ea', '#ea580c', '#0d9488', '#db2777', '#4b5563'];
  let root, map, markers, boundLayer, streets, sat, curBase = 'streets', meLayer, tempMarker, picking = null, drawing = null, mode = 'split', banner;

  const pinIcon = c => L.divIcon({
    className: 'pin-wrap', iconSize: [34, 44], iconAnchor: [17, 43],
    html: `<svg width="34" height="44" viewBox="0 0 34 44"><path d="M17 43C17 43 3 27 3 16a14 14 0 0 1 28 0c0 11-14 27-14 27z" fill="${c}" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="16" r="5.500" fill="#fff"/></svg>`,
  });

  // ---------- البناء ----------
  function build(r) {
    root = r; root.classList.add('m-split');
    const segs = h('div', { class: 'segs' },
      ['full|خريطة كاملة', 'split|خريطة + قائمة', 'list|قائمة فقط'].map(x => { const [k, l] = x.split('|'); return h('button', { class: 'seg', 'data-m': k, onclick: () => setMode(k) }, l); }));
    banner = h('div', { class: 'mbanner hidden' });
    const ctl = h('div', { class: 'mctl' },
      h('button', { class: 'rbtn', title: 'طبقة الخريطة', onclick: toggleBase }, icon('layers')),
      h('button', { class: 'rbtn', title: 'موقعي', onclick: locateMe }, icon('locate')),
      h('button', { class: 'rbtn', title: 'حدود الأحياء', onclick: boundsManager }, icon('poly')));
    const fab = h('button', { class: 'fab', onclick: () => addHouse() }, icon('plus', 24), ' إضافة بيت');
    root.append(h('div', { class: 'chips', id: 'chips' }), segs,
      h('div', { class: 'mapwrap' }, h('div', { id: 'map' }), banner, ctl, fab),
      h('div', { class: 'maplist', id: 'maplist' }));
    map = L.map('map', { zoomControl: false, attributionControl: true }).setView([24.4672, 39.6111], 14);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri' });
    streets.addTo(map);
    boundLayer = L.layerGroup().addTo(map); markers = L.layerGroup().addTo(map); meLayer = L.layerGroup().addTo(map);
    map.on('click', onMapClick);
    setMode('split'); renderBounds(); refresh();
    // تحريك الخريطة لتشمل البيوت المسجلة
    fitAll();
  }
  function fitAll() {
    const pts = S.houses.map(x => [x.lat, x.lng]);
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 17 });
    else if (pts.length === 1) map.setView(pts[0], 17);
  }
  function show() { setTimeout(() => map && map.invalidateSize(), 60); }
  function setMode(m) {
    mode = m; root.classList.remove('m-full', 'm-split', 'm-list'); root.classList.add('m-' + m);
    root.querySelectorAll('.seg').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    setTimeout(() => map && map.invalidateSize(), 80);
  }
  function toggleBase() {
    if (curBase === 'streets') { map.removeLayer(streets); sat.addTo(map); curBase = 'sat'; toast('عرض الصور الجوية'); }
    else { map.removeLayer(sat); streets.addTo(map); curBase = 'streets'; toast('عرض الشوارع'); }
  }

  // ---------- الدبابيس والقائمة ----------
  const visible = hs => { const f = S.filter; if (f === 'all') return true; if (f === 'notes') return hasNotes(hs); if (f === 'data') return !hasNotes(hs); return (hs.tags || []).includes(f); };
  function refresh() {
    markers.clearLayers();
    S.houses.filter(visible).forEach(hs => {
      const m = L.marker([hs.lat, hs.lng], { icon: pinIcon(hasNotes(hs) ? RED : GREEN), title: houseTitle(hs) });
      m.on('click', () => { if (!picking && !drawing) openHouse(hs.id); });
      markers.addLayer(m);
    });
    renderChips(); renderList();
  }
  function renderChips() {
    const c = $('#chips', root); c.innerHTML = '';
    const mk = (k, label, dot) => c.append(h('button', { class: 'chip' + (S.filter === k ? ' on' : ''), onclick: () => { S.filter = k; refresh(); } }, dot ? h('i', { class: 'dot', style: { background: dot } }) : null, label));
    const nNotes = S.houses.filter(hasNotes).length;
    mk('all', 'الكل (' + S.houses.length + ')');
    mk('notes', 'فيه ملاحظات (' + nNotes + ')', RED);
    mk('data', 'بيانات فقط (' + (S.houses.length - nNotes) + ')', GREEN);
    (S.settings.tags || []).forEach(t => mk(t, t + ' (' + S.houses.filter(x => (x.tags || []).includes(t)).length + ')'));
  }
  function renderList() {
    const box = $('#maplist', root); box.innerHTML = '';
    const arr = S.houses.filter(visible).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    if (!S.houses.length) { box.append(h('div', { class: 'empty' }, h('b', {}, 'لا توجد بيوت مسجلة بعد'), h('p', {}, 'اضغط «إضافة بيت» ثم اضغط على مكان البيت في الخريطة لتعبئة بطاقته.'))); return; }
    if (!arr.length) { box.append(h('div', { class: 'empty' }, 'لا توجد بيوت ضمن هذا التصنيف')); return; }
    arr.forEach(hs => box.append(h('button', { class: 'li', onclick: () => { focusHouse(hs.id); } },
      h('i', { class: 'dot big', style: { background: hasNotes(hs) ? RED : GREEN } }),
      h('div', { class: 'li-t' }, h('b', {}, houseTitle(hs)), h('small', {}, [hs.address, hs.meter ? 'عداد ' + hs.meter : '', (hs.tags || []).join('، ')].filter(Boolean).join(' • ') || '—')))));
  }
  function focusHouse(id) {
    const hs = houseById(id); if (!hs) return;
    switchTab('map'); if (mode === 'list') setMode('split');
    setTimeout(() => { map.invalidateSize(); map.setView([hs.lat, hs.lng], Math.max(map.getZoom(), 18)); }, 100);
    openHouse(id);
  }

  // ---------- التقاط موقع من الخريطة ----------
  function showBanner(text, btns) {
    banner.innerHTML = ''; banner.classList.remove('hidden'); busy(true);
    banner.append(h('div', { class: 'bt' }, text), h('div', { class: 'bb' }, btns));
  }
  const hideBanner = () => { banner.classList.add('hidden'); banner.innerHTML = ''; busy(false); };
  const busy = on => { const w = root && root.querySelector('.mapwrap'); if (w) w.classList.toggle('busy', on); };
  function startPick(cb, text) {
    cancelAll(); switchTab('map'); if (mode === 'list') setMode('split'); else show();
    picking = { cb };
    showBanner(text || 'اضغط على الخريطة في مكان البيت',
      [h('button', { class: 'btn sm pri', onclick: useMyLocation }, 'استخدم موقعي الحالي'), h('button', { class: 'btn sm ghost', onclick: cancelAll }, 'إلغاء')]);
    map.getContainer().classList.add('picking');
  }
  async function useMyLocation() {
    if (!picking) return;
    try { const c = await getPos(); place({ lat: c.latitude, lng: c.longitude }); map.setView([c.latitude, c.longitude], 19); }
    catch (e) { toast(gpsError(e), 6000); }
  }
  function place(ll) {
    if (!picking) return;
    const cb = picking.cb; picking = null; hideBanner(); map.getContainer().classList.remove('picking');
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker([ll.lat, ll.lng], { icon: pinIcon('#2563eb') }).addTo(map);
    cb({ lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) });
  }
  function clearTemp() { if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; } }
  function cancelAll() {
    picking = null; if (drawing) { map.removeLayer(drawing.group); drawing = null; }
    hideBanner(); clearTemp(); map.getContainer().classList.remove('picking');
  }
  function onMapClick(e) {
    if (drawing) { addVertex(e.latlng); return; }
    if (picking) place(e.latlng);
  }

  // ---------- تحديد الموقع (GPS) ----------
  function getPos() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation || !window.isSecureContext) { rej(new Error('insecure')); return; }
      navigator.geolocation.getCurrentPosition(p => res(p.coords), e => rej(e), { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
    });
  }
  function gpsError(e) {
    if (e && e.message === 'insecure') return 'ميزة «موقعي» تعمل بعد رفع البرنامج على رابط آمن (https). الآن حدّد المكان بالضغط على الخريطة.';
    if (e && e.code === 1) return 'لم يُسمح للموقع. فعّله من إعدادات المتصفح ثم أعد المحاولة.';
    return 'تعذّر تحديد موقعك، تأكد من تشغيل GPS وأعد المحاولة.';
  }
  async function locateMe() {
    try {
      toast('جارٍ تحديد موقعك…'); const c = await getPos();
      meLayer.clearLayers();
      L.circle([c.latitude, c.longitude], { radius: c.accuracy, color: '#2563eb', weight: 1, fillOpacity: .12 }).addTo(meLayer);
      L.circleMarker([c.latitude, c.longitude], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(meLayer);
      map.setView([c.latitude, c.longitude], 18);
    } catch (e) { toast(gpsError(e), 6000); }
  }

  // ---------- إضافة بيت ----------
  function addHouse() {
    startPick(ll => openForm({ id: uid(), lat: ll.lat, lng: ll.lng, owner: '', floors: '', nid: '', phone: '', meter: '', address: '', notes: '', tags: [], hasApts: false, apts: [], photos: [], created: Date.now() }, true));
  }

  // ---------- بطاقة البيت (عرض) ----------
  function row(label, val, extra) {
    if (!val) return null;
    return h('div', { class: 'kv' }, h('span', {}, label), h('b', { dir: 'auto' }, val), extra || null);
  }
  function openHouse(id) {
    const hs = houseById(id); if (!hs) return;
    const sh = openSheet(houseTitle(hs), { tall: true });
    const b = sh.body;
    b.append(hasNotes(hs)
      ? h('div', { class: 'note red' }, h('b', {}, '⚠ ملاحظات'), h('p', {}, hs.notes))
      : h('div', { class: 'note green' }, 'بيانات فقط — لا توجد ملاحظات'));
    if ((hs.tags || []).length) b.append(h('div', { class: 'tagrow' }, hs.tags.map(t => h('span', { class: 'tag' }, t))));
    b.append(row('عدد الأدوار', hs.floors), row('رقم الهوية', hs.nid), row('رقم العداد', hs.meter), row('العنوان الوطني', hs.address));
    if (hs.phone) b.append(h('div', { class: 'kv' }, h('span', {}, 'رقم الجوال'), h('b', { dir: 'ltr' }, hs.phone),
      h('div', { class: 'act' }, h('a', { class: 'rbtn sm', href: telLink(hs.phone), title: 'اتصال' }, icon('phone', 20)), h('a', { class: 'rbtn sm wa', href: waLink(hs.phone), target: '_blank', rel: 'noopener', title: 'واتساب' }, icon('wa', 20)))));
    b.append(h('div', { class: 'kv' }, h('span', {}, 'الإحداثيات'), h('b', { dir: 'ltr' }, hs.lat + ', ' + hs.lng),
      h('div', { class: 'act' }, h('button', { class: 'rbtn sm', title: 'نسخ', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(hs.lat + ', ' + hs.lng).then(() => toast('تم نسخ الإحداثيات')); } }, icon('copy', 20)))));
    if (hs.hasApts && (hs.apts || []).length) {
      b.append(h('h4', {}, 'الشقق (' + hs.apts.length + ')'));
      hs.apts.forEach(a => b.append(h('div', { class: 'apt' }, h('b', {}, (FLOORS[+a.floor] || '') + (a.no ? ' — شقة ' + a.no : '')), h('span', {}, a.name || '—'), a.phone ? h('a', { class: 'lnk', href: telLink(a.phone) }, a.phone) : null)));
    }
    if ((hs.photos || []).length) {
      const g = h('div', { class: 'thumbs' }); b.append(h('h4', {}, 'الصور'), g);
      hs.photos.forEach(pid => { const im = h('img', { class: 'thumb', alt: '' }); g.append(im); getImg(pid).then(r => { if (r) { im.src = r.data; im.onclick = () => openDataFile(r); } }); });
    }
    const reps = S.reports.filter(x => x.houseId === hs.id).sort((a, c) => (c.created || 0) - (a.created || 0));
    const reqs = S.requests.filter(x => x.houseId === hs.id);
    b.append(h('h4', {}, 'سجل الإبلاغات (' + reps.length + ')'));
    if (!reps.length) b.append(h('p', { class: 'mut' }, 'لا توجد محاضر مرتبطة بهذا البيت.'));
    reps.forEach(r => b.append(h('button', { class: 'li', onclick: () => { sh.close(); Reports.open(r.id); } },
      h('div', { class: 'li-t' }, h('b', {}, (r.no || '') + ' — ' + Reports.kindLabel(r.kind)), h('small', {}, fmtISO(r.date) + ' • ' + (r.person || ''))))));
    if (reqs.length) b.append(h('p', { class: 'mut' }, 'طلبات مرتبطة: ' + reqs.length));
    b.append(h('div', { class: 'btnrow' },
      h('button', { class: 'btn ghost', onclick: () => { sh.close(); startPick(ll => { hs.lat = ll.lat; hs.lng = ll.lng; hs.updated = Date.now(); putRec('houses', S.houses, hs).then(() => { clearTemp(); refresh(); toast('تم تغيير الموقع'); openHouse(hs.id); }); }, 'اضغط على الخريطة في الموقع الجديد للبيت'); } }, 'تغيير الموقع'),
      h('button', { class: 'btn danger ghost', onclick: async () => { if (await confirmBox('حذف بيانات هذا البيت نهائيًا؟', 'حذف', true)) { for (const p of hs.photos || []) await delImg(p); await delRec('houses', S.houses, hs.id); sh.close(); refresh(); toast('تم الحذف'); } } }, 'حذف')));
    sh.foot.append(h('button', { class: 'btn ghost', onclick: () => { sh.close(); Reports.newFor(hs); } }, 'محضر لهذا البيت'),
      h('button', { class: 'btn pri', onclick: () => { sh.close(); openForm(hs, false); } }, icon('edit', 20), ' تعديل'));
  }

  // ---------- نموذج البيت ----------
  function openForm(src, isNew) {
    const d = JSON.parse(JSON.stringify(src)); d.tags = d.tags || []; d.apts = d.apts || []; d.photos = d.photos || [];
    const sh = openSheet(isNew ? 'بيت جديد' : 'تعديل البيانات', { tall: true, sticky: true, onClose: () => { if (isNew && !saved) clearTemp(); } });
    let saved = false; const newPhotos = [], removedPhotos = [];
    const err = h('div', { class: 'err hidden' });
    const tagBox = h('div', { class: 'tagrow' });
    const drawTags = () => {
      tagBox.innerHTML = '';
      (S.settings.tags || []).forEach(t => tagBox.append(h('button', { type: 'button', class: 'tag sel' + (d.tags.includes(t) ? ' on' : ''), onclick: () => { d.tags = d.tags.includes(t) ? d.tags.filter(x => x !== t) : [...d.tags, t]; drawTags(); } }, t)));
      tagBox.append(h('button', { type: 'button', class: 'tag add', onclick: async () => { const v = await askText('وسم جديد', 'اسم الوسم'); if (v) { if (!S.settings.tags.includes(v)) S.settings.tags.push(v); if (!d.tags.includes(v)) d.tags.push(v); await saveSettings(); drawTags(); } } }, '+ وسم'));
    };
    drawTags();
    const aptBox = h('div', { class: 'aptbox' });
    const drawApts = () => {
      aptBox.innerHTML = ''; if (!d.hasApts) return;
      d.apts.forEach((a, i) => aptBox.append(h('div', { class: 'aptrow' },
        h('select', { class: 'in', value: a.floor, onchange: e => a.floor = e.target.value }, FLOORS.map((f, k) => h('option', { value: k }, f))),
        h('input', { class: 'in', placeholder: 'رقم الشقة', value: a.no || '', oninput: e => a.no = e.target.value, style: { maxWidth: '84px' } }),
        h('input', { class: 'in', placeholder: 'اسم الساكن', value: a.name || '', oninput: e => a.name = e.target.value }),
        h('input', { class: 'in', placeholder: 'جوال (اختياري)', inputmode: 'tel', value: a.phone || '', oninput: e => a.phone = e.target.value }),
        h('button', { type: 'button', class: 'rbtn sm', onclick: () => { d.apts.splice(i, 1); drawApts(); } }, icon('trash', 18))
      )));
      aptBox.append(h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { d.apts.push({ floor: '0', no: '', name: '', phone: '' }); drawApts(); } }, '+ إضافة شقة'));
    };
    const aptToggle = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: d.hasApts, onchange: e => { d.hasApts = e.target.checked; if (d.hasApts && !d.apts.length) d.apts.push({ floor: '0', no: '', name: '', phone: '' }); drawApts(); } }), ' يوجد شقق في هذا البيت');
    drawApts();
    const photoBox = h('div', { class: 'thumbs' });
    const drawPhotos = () => {
      photoBox.innerHTML = '';
      d.photos.forEach(pid => { const im = h('img', { class: 'thumb', alt: '' }); getImg(pid).then(r => { if (r) im.src = r.data; }); photoBox.append(h('div', { class: 'thwrap' }, im, h('button', { type: 'button', class: 'thx', onclick: () => { d.photos = d.photos.filter(x => x !== pid); removedPhotos.push(pid); drawPhotos(); } }, '✕'))); });
      if (d.photos.length < 3) photoBox.append(h('button', { type: 'button', class: 'addph', onclick: async () => {
        const fs = await pickFile('image/*', true); if (!fs.length) return;
        for (const f of fs) { if (d.photos.length >= 3) break; try { const data = await compressImage(f); const pid = await saveImg(data, f.name, 'image/jpeg'); d.photos.push(pid); newPhotos.push(pid); } catch (e) { toast('تعذر قراءة الصورة'); } }
        drawPhotos();
      } }, '+ صورة'));
    };
    drawPhotos();
    const notesHint = h('small', { class: 'hint' }, '');
    const upd = () => { notesHint.textContent = (d.notes || '').trim() ? '🔴 الدبوس سيكون أحمر (توجد ملاحظات)' : '🟢 الدبوس سيكون أخضر (بيانات فقط)'; };
    sh.body.append(
      h('div', { class: 'coord' }, icon('pin', 18), h('span', { dir: 'ltr' }, d.lat + ', ' + d.lng)),
      field('اسم المالك *', tx(d, 'owner', { ph: 'الاسم الكامل' })),
      h('div', { class: 'row2' }, field('عدد الأدوار', tx(d, 'floors', { type: 'number', mode: 'numeric', ph: '2' })), field('رقم العداد', tx(d, 'meter', { mode: 'numeric', ph: 'رقم عداد الكهرباء' }))),
      h('div', { class: 'row2' }, field('رقم الهوية', tx(d, 'nid', { mode: 'numeric', ml: 10, ph: '10 أرقام' })), field('رقم الجوال', tx(d, 'phone', { type: 'tel', mode: 'tel', ml: 10, ph: '05xxxxxxxx' }))),
      field('العنوان الوطني', tx(d, 'address', { ph: 'مثال: ABCD1234' })),
      field('ملاحظات', ta(d, 'notes', { rows: 3, ph: 'اكتب هنا فقط إذا توجد ملاحظة', on: upd }), null), notesHint,
      h('div', { class: 'lbl' }, 'التصنيف'), tagBox,
      aptToggle, aptBox,
      h('div', { class: 'lbl' }, 'صور البيت (اختياري، حتى 3 صور)'), photoBox, err);
    upd();
    sh.foot.append(h('button', { class: 'btn ghost', onclick: async () => { for (const p of newPhotos) await delImg(p); sh.close(); } }, 'إلغاء'),
      h('button', { class: 'btn pri', onclick: async () => {
        const m = [];
        if (!(d.owner || '').trim()) m.push('اكتب اسم المالك');
        const pe = checkPhone(d.phone), ne = checkNid(d.nid); if (pe) m.push(pe); if (ne) m.push(ne);
        if (m.length) { err.textContent = m.join(' • '); err.classList.remove('hidden'); err.scrollIntoView({ block: 'center' }); return; }
        d.owner = d.owner.trim(); d.phone = cleanNum(d.phone); d.nid = cleanNum(d.nid); d.meter = cleanNum(d.meter);
        if (!d.hasApts) d.apts = []; else d.apts = d.apts.filter(a => a.no || a.name);
        d.updated = Date.now();
        for (const p of removedPhotos) await delImg(p);
        await putRec('houses', S.houses, d); saved = true; clearTemp(); refresh(); sh.close();
        toast('تم حفظ بيانات البيت');
        if (!S.settings.tipShown && S.houses.length >= 1) { S.settings.tipShown = true; await saveSettings(); setTimeout(() => toast('تنبيه: انسخ بياناتك احتياطيًا كل أسبوعين من الإعدادات', 6000), 2800); }
      } }, 'حفظ'));
    setTimeout(() => $('input', sh.body) && $('input', sh.body).focus(), 100);
  }

  // ---------- حدود الأحياء ----------
  function renderBounds() {
    boundLayer.clearLayers();
    S.bounds.filter(b => b.visible !== false).forEach(b => {
      const p = L.polygon(b.points, { color: b.color || '#2563eb', weight: b.parent ? 2 : 3, dashArray: b.parent ? '8 6' : null, fillOpacity: .07, interactive: false }).addTo(boundLayer);
      p.bindTooltip(b.name, { permanent: true, direction: 'center', className: 'bound-label' });
    });
  }
  function boundsManager() {
    const sh = openSheet('حدود الأحياء', { tall: true });
    const draw = () => {
      sh.body.innerHTML = '';
      sh.body.append(h('p', { class: 'mut' }, 'ارسم حدود الحي على الخريطة بنقاط متتابعة وسمّها. يمكن إضافة حي تابع داخل حي رئيسي.'));
      if (!S.bounds.length) sh.body.append(h('div', { class: 'empty' }, 'لا توجد حدود مرسومة بعد'));
      S.bounds.forEach(b => sh.body.append(h('div', { class: 'brow' },
        h('button', { class: 'rbtn sm' + (b.visible !== false ? ' on' : ''), title: 'إظهار/إخفاء', onclick: async () => { b.visible = b.visible === false; await putRec('bounds', S.bounds, b); renderBounds(); draw(); } }, b.visible !== false ? '👁' : '—'),
        h('i', { class: 'dot big', style: { background: b.color } }),
        h('div', { class: 'li-t' }, h('b', {}, b.name), h('small', {}, b.parent ? 'تابع لـ ' + ((S.bounds.find(x => x.id === b.parent) || {}).name || '—') : 'حي رئيسي')),
        h('button', { class: 'rbtn sm', title: 'اذهب إليه', onclick: () => { sh.close(); switchTab('map'); setTimeout(() => { map.invalidateSize(); map.fitBounds(b.points, { padding: [30, 30] }); }, 120); } }, icon('pin', 18)),
        h('button', { class: 'rbtn sm', title: 'إعادة تسمية', onclick: async () => { const n = await askText('اسم الحد', 'الاسم', b.name); if (n) { b.name = n; await putRec('bounds', S.bounds, b); renderBounds(); draw(); } } }, icon('edit', 18)),
        h('button', { class: 'rbtn sm', title: 'حذف', onclick: async () => { if (await confirmBox('حذف حد «' + b.name + '»؟', 'حذف', true)) { await delRec('bounds', S.bounds, b.id); S.bounds.forEach(x => { if (x.parent === b.id) x.parent = ''; }); renderBounds(); draw(); } } }, icon('trash', 18)))));
    };
    draw();
    sh.foot.append(h('button', { class: 'btn ghost', onclick: () => importGeo(draw) }, 'استيراد ملف حدود'), h('button', { class: 'btn pri', onclick: () => { sh.close(); startDraw(); } }, 'رسم حد جديد'));
  }
  async function importGeo(after) {
    const fs = await pickFile('.geojson,.json,application/json'); if (!fs.length) return;
    try {
      const j = JSON.parse(await fs[0].text()); const feats = j.type === 'FeatureCollection' ? j.features : j.type === 'Feature' ? [j] : [{ type: 'Feature', geometry: j, properties: {} }];
      let n = 0; const base = fs[0].name.replace(/\.[^.]+$/, '');
      for (const f of feats) {
        const g = f.geometry; if (!g) continue;
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        const pr = f.properties || {}; const nm = pr.name || pr.Name || pr['الاسم'] || pr.NAME || base;
        for (let i = 0; i < polys.length; i++) {
          const pts = polys[i][0].map(c => [c[1], c[0]]); if (pts.length < 3) continue;
          await putRec('bounds', S.bounds, { id: uid(), name: polys.length > 1 ? nm + ' (' + (i + 1) + ')' : nm, parent: '', color: PALETTE[S.bounds.length % PALETTE.length], points: pts, visible: true }); n++;
        }
      }
      if (!n) { toast('الملف لا يحتوي مضلعات حدود'); return; }
      renderBounds(); toast('تم استيراد ' + n + ' حد'); const b = S.bounds[S.bounds.length - 1]; if (b) map.fitBounds(b.points); if (after) after();
    } catch (e) { toast('تعذر قراءة الملف، تأكد أنه بصيغة GeoJSON'); }
  }
  function startDraw() {
    cancelAll(); switchTab('map'); if (mode === 'list') setMode('split'); else show();
    drawing = { pts: [], group: L.layerGroup().addTo(map) };
    drawing.line = L.polyline([], { color: '#e11d48', weight: 3, dashArray: '6 6' }).addTo(drawing.group);
    const info = h('span', {}, 'اضغط على الخريطة لإضافة نقاط الحدود (0)');
    drawing.info = info;
    banner.innerHTML = ''; banner.classList.remove('hidden'); busy(true);
    banner.append(h('div', { class: 'bt' }, info), h('div', { class: 'bb' },
      h('button', { class: 'btn sm ghost', onclick: undoVertex }, 'تراجع'),
      h('button', { class: 'btn sm pri', onclick: finishDraw }, 'إنهاء'),
      h('button', { class: 'btn sm ghost', onclick: cancelAll }, 'إلغاء')));
  }
  function addVertex(ll) {
    drawing.pts.push([+ll.lat.toFixed(6), +ll.lng.toFixed(6)]);
    L.circleMarker(ll, { radius: 6, color: '#fff', weight: 2, fillColor: '#e11d48', fillOpacity: 1, interactive: false }).addTo(drawing.group);
    drawing.line.setLatLngs(drawing.pts); drawing.info.textContent = 'اضغط لإضافة نقاط الحدود (' + drawing.pts.length + ')';
  }
  function undoVertex() {
    if (!drawing || !drawing.pts.length) return; drawing.pts.pop(); drawing.group.clearLayers();
    drawing.line = L.polyline(drawing.pts, { color: '#e11d48', weight: 3, dashArray: '6 6' }).addTo(drawing.group);
    drawing.pts.forEach(p => L.circleMarker(p, { radius: 6, color: '#fff', weight: 2, fillColor: '#e11d48', fillOpacity: 1, interactive: false }).addTo(drawing.group));
    drawing.info.textContent = 'اضغط لإضافة نقاط الحدود (' + drawing.pts.length + ')';
  }
  function finishDraw() {
    if (!drawing || drawing.pts.length < 3) { toast('تحتاج 3 نقاط على الأقل لرسم الحد'); return; }
    const pts = drawing.pts.slice(); const grp = drawing.group;
    const form = { name: '', parent: '', color: PALETTE[S.bounds.length % PALETTE.length] };
    const sh = openSheet('حفظ الحد', { sticky: true, onClose: () => {} });
    const colors = h('div', { class: 'tagrow' });
    const dc = () => { colors.innerHTML = ''; PALETTE.forEach(c => colors.append(h('button', { type: 'button', class: 'swatch' + (form.color === c ? ' on' : ''), style: { background: c }, onclick: () => { form.color = c; dc(); } }))); }; dc();
    sh.body.append(field('اسم الحي أو الحد *', tx(form, 'name', { ph: 'مثال: حي العوالي' })),
      field('تابع لحي رئيسي؟', sel(form, 'parent', [['', 'لا، هذا حي رئيسي'], ...S.bounds.map(b => [b.id, b.name])])), h('div', { class: 'lbl' }, 'اللون'), colors);
    sh.foot.append(h('button', { class: 'btn ghost', onclick: sh.close }, 'رجوع للرسم'),
      h('button', { class: 'btn pri', onclick: async () => {
        if (!form.name.trim()) { toast('اكتب اسم الحد'); return; }
        await putRec('bounds', S.bounds, { id: uid(), name: form.name.trim(), parent: form.parent, color: form.color, points: pts, visible: true });
        map.removeLayer(grp); drawing = null; hideBanner(); renderBounds(); sh.close(); toast('تم حفظ الحد');
      } }, 'حفظ'));
  }

  // ---------- اختيار بيت (للربط) ----------
  function housePicker(cb, title) {
    const sh = openSheet(title || 'اختر بيتًا من السجل', { tall: true });
    const q = h('input', { class: 'in', placeholder: 'ابحث بالاسم أو الهوية أو الجوال أو العداد', type: 'search' });
    const box = h('div', {});
    const draw = () => {
      box.innerHTML = ''; const t = arDigits(q.value.trim());
      const arr = S.houses.filter(hs => !t || [hs.owner, hs.nid, hs.phone, hs.meter, hs.address, ...(hs.apts || []).map(a => a.name)].some(v => (v || '').includes(t))).slice(0, 40);
      if (!arr.length) box.append(h('div', { class: 'empty' }, 'لا توجد نتائج'));
      arr.forEach(hs => box.append(h('button', { class: 'li', onclick: () => { sh.close(); cb(hs); } }, h('i', { class: 'dot big', style: { background: hasNotes(hs) ? RED : GREEN } }), h('div', { class: 'li-t' }, h('b', {}, houseTitle(hs)), h('small', {}, [hs.nid, hs.phone, hs.address].filter(Boolean).join(' • ') || '—')))));
    };
    q.addEventListener('input', draw); sh.body.append(q, box); draw();
  }

  return { build, show, refresh, openHouse, focusHouse, housePicker, renderBounds, fitAll };
})();
