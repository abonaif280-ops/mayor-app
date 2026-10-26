// ============ الطلبات الواردة من مراكز الشرطة ============
const KINDS = [['review', 'إبلاغ بالمراجعة'], ['attend', 'إبلاغ بالحضور'], ['case', 'إبلاغ عن حالة']];
const kindLabel = k => (KINDS.find(x => x[0] === k) || KINDS[0])[1];

// فهرس الأشخاص من سجل البيوت (للتعبئة السريعة)
function peopleIndex() {
  const out = [];
  S.houses.forEach(hs => {
    if (hs.owner) out.push({ name: hs.owner, nid: hs.nid || '', phone: hs.phone || '', houseId: hs.id });
    (hs.apts || []).forEach(a => { if (a.name) out.push({ name: a.name, nid: '', phone: a.phone || '', houseId: hs.id }); });
  });
  return out;
}
function peopleDatalist() {
  let dl = $('#dl-people'); if (!dl) { dl = h('datalist', { id: 'dl-people' }); document.body.append(dl); }
  dl.innerHTML = ''; const seen = new Set();
  peopleIndex().forEach(p => { if (!seen.has(p.name)) { seen.add(p.name); dl.append(h('option', { value: p.name })); } });
}
// يعبّي الهوية والجوال والبيت إذا كان الاسم مطابقًا لشخص في السجل
function autoFillPerson(obj, inputs) {
  const name = (obj.person || '').trim(); if (!name) return false;
  const m = peopleIndex().find(p => p.name === name); if (!m) return false;
  let filled = false;
  if (!obj.nid && m.nid) { obj.nid = m.nid; if (inputs.nid) inputs.nid.value = m.nid; filled = true; }
  if (!obj.phone && m.phone) { obj.phone = m.phone; if (inputs.phone) inputs.phone.value = m.phone; filled = true; }
  if (!obj.houseId) { obj.houseId = m.houseId; filled = true; if (inputs.refreshHouse) inputs.refreshHouse(); }
  if (filled) toast('تمت التعبئة من سجل البيوت');
  return filled;
}

const Requests = (() => {
  const STATUS = ['واردة', 'جارٍ التواصل', 'تم الإبلاغ', 'تم الرد'];
  const RESULTS = ['لم يرد', 'الهاتف مغلق', 'رد وتم إبلاغه', 'رقم غير صحيح', 'طلب مهلة'];
  const SCOL = { 'واردة': 'blue', 'جارٍ التواصل': 'amber', 'تم الإبلاغ': 'green', 'تم الرد': 'gray' };
  let root, filter = 'all';
  const isOverdue = r => r.status !== 'تم الرد' && r.received && (Date.now() - new Date(r.received + 'T00:00:00').getTime()) / 86400000 >= 3;

  function build(r) { root = r; }
  function render() {
    root.innerHTML = '';
    const open = S.requests.filter(r => r.status !== 'تم الرد').length, late = S.requests.filter(isOverdue).length;
    root.append(h('div', { class: 'vhead' }, h('div', {}, h('h2', {}, 'الطلبات الواردة'), h('small', { class: 'mut' }, 'مفتوحة: ' + open + (late ? ' • متأخرة: ' + late : '')))));
    const chips = h('div', { class: 'chips' });
    [['all', 'الكل'], ['late', 'متأخرة'], ...STATUS.map(s => [s, s])].forEach(([k, l]) => chips.append(h('button', { class: 'chip' + (filter === k ? ' on' : ''), onclick: () => { filter = k; render(); } }, l)));
    root.append(chips);
    let arr = S.requests.slice().sort((a, b) => (b.created || 0) - (a.created || 0));
    if (filter === 'late') arr = arr.filter(isOverdue); else if (filter !== 'all') arr = arr.filter(r => r.status === filter);
    const list = h('div', { class: 'cards' });
    if (!arr.length) list.append(h('div', { class: 'empty' }, h('b', {}, S.requests.length ? 'لا توجد طلبات ضمن هذا التصنيف' : 'لا توجد طلبات بعد'), h('p', {}, 'عندما يصلك طلب من مركز الشرطة على الواتساب اضغط «طلب جديد» وأرفق صورة الخطاب لتوثيقه ومتابعته.')));
    arr.forEach(r => list.append(h('button', { class: 'card req', onclick: () => open_(r.id) },
      h('div', { class: 'card-top' }, h('b', {}, r.person || 'بدون اسم'), h('span', { class: 'badge ' + SCOL[r.status] }, r.status)),
      h('div', { class: 'mut' }, [kindLabel(r.kind), r.center, r.letterNo ? 'خطاب ' + r.letterNo : ''].filter(Boolean).join(' • ')),
      h('div', { class: 'meta' }, h('span', {}, 'وصل: ' + fmtISO(r.received)),
        (r.attempts || []).length ? h('span', {}, '📞 ' + r.attempts.length + ' محاولة') : null,
        (r.files || []).length ? h('span', {}, '📎 ' + r.files.length) : null,
        r.reportId ? h('span', {}, '📄 محضر') : null,
        isOverdue(r) ? h('span', { class: 'badge red' }, 'متأخر') : null))));
    root.append(list, h('button', { class: 'fab', onclick: () => open_() }, icon('plus', 24), ' طلب جديد'));
  }

  function open_(id) {
    const isNew = !id;
    const src = id ? S.requests.find(x => x.id === id) : { id: uid(), kind: 'review', letterNo: '', letterDate: '', center: S.settings.center || '', person: '', nid: '', phone: '', houseId: '', received: todayISO(), status: 'واردة', attempts: [], files: [], notes: '', reportId: '', created: Date.now() };
    if (!src) return;
    const d = JSON.parse(JSON.stringify(src)); d.attempts = d.attempts || []; d.files = d.files || [];
    const newFiles = [], removed = [];
    const pg = openPage(isNew ? 'طلب جديد' : 'متابعة الطلب', { onBack: close => { newFiles.forEach(delImg); close(); } });
    peopleDatalist();
    const I = {};
    const err = h('div', { class: 'err hidden' });
    const stepper = h('div', { class: 'stepper' });
    const drawStep = () => { stepper.innerHTML = ''; STATUS.forEach((s, i) => stepper.append(h('button', { class: 'step ' + SCOL[s] + (d.status === s ? ' on' : ''), onclick: () => { d.status = s; drawStep(); } }, h('i', {}, i + 1), s))); };
    drawStep();
    // ربط بيت
    const houseBox = h('div', { class: 'hlink' });
    I.refreshHouse = () => {
      houseBox.innerHTML = ''; const hs = d.houseId && houseById(d.houseId);
      if (hs) houseBox.append(h('span', {}, '🏠 ' + houseTitle(hs) + (hs.address ? ' — ' + hs.address : '')), h('button', { class: 'btn sm ghost', onclick: () => { d.houseId = ''; I.refreshHouse(); } }, 'فك الربط'));
      else houseBox.append(h('button', { class: 'btn sm ghost', onclick: () => MapUI.housePicker(x => { d.houseId = x.id; if (!d.person) { d.person = x.owner; I.person.value = x.owner; } if (!d.nid && x.nid) { d.nid = x.nid; I.nid.value = x.nid; } if (!d.phone && x.phone) { d.phone = x.phone; I.phone.value = x.phone; } I.refreshHouse(); }) }, '🏠 ربط ببيت من السجل (اختياري)'));
    };
    I.person = tx(d, 'person', { ph: 'اسم المطلوب إبلاغه', list: 'dl-people', on: () => { } });
    I.person.addEventListener('change', () => { autoFillPerson(d, I); I.refreshHouse(); });
    I.nid = tx(d, 'nid', { mode: 'numeric', ml: 10, ph: '10 أرقام' });
    I.phone = tx(d, 'phone', { type: 'tel', mode: 'tel', ml: 10, ph: '05xxxxxxxx' });
    I.refreshHouse();
    // محاولات الاتصال
    const attBox = h('div', {}), att = { result: RESULTS[0], note: '' };
    const drawAtt = () => {
      attBox.innerHTML = '';
      if (!d.attempts.length) attBox.append(h('p', { class: 'mut' }, 'لم تُسجَّل محاولات اتصال بعد.'));
      d.attempts.forEach((a, i) => attBox.append(h('div', { class: 'att' }, h('div', {}, h('b', {}, a.result), h('small', {}, ' • ' + fmtTime(a.ts)), a.note ? h('div', { class: 'mut' }, a.note) : null),
        h('button', { class: 'rbtn sm', onclick: () => { d.attempts.splice(i, 1); drawAtt(); } }, icon('trash', 16)))));
      const nt = h('input', { class: 'in', placeholder: 'ملاحظة (اختياري)', value: att.note, oninput: e => att.note = e.target.value });
      attBox.append(h('div', { class: 'attform' }, sel(att, 'result', RESULTS.map(r => [r, r])), nt,
        h('button', { class: 'btn pri sm', onclick: () => {
          d.attempts.push({ ts: Date.now(), result: att.result, note: att.note.trim() }); const done = att.result === 'رد وتم إبلاغه';
          if (done) d.status = 'تم الإبلاغ'; else if (d.status === 'واردة') d.status = 'جارٍ التواصل';
          att.note = ''; drawStep(); drawAtt(); toast(done ? 'سُجّلت المحاولة وتحولت الحالة إلى «تم الإبلاغ»' : 'سُجّلت المحاولة');
        } }, 'تسجيل محاولة')));
    };
    drawAtt();
    // المرفقات
    const fileBox = h('div', { class: 'files' });
    const drawFiles = () => {
      fileBox.innerHTML = '';
      d.files.forEach(fid => { const row = h('div', { class: 'frow' }, h('span', {}, '📎 ...')); fileBox.append(row);
        getImg(fid).then(r => { row.innerHTML = ''; if (!r) { row.append(h('span', { class: 'mut' }, 'مرفق غير موجود في هذا الجهاز')); } else row.append(h('button', { class: 'lnk', onclick: () => openDataFile(r) }, '📎 ' + (r.name || 'مرفق')));
          row.append(h('button', { class: 'rbtn sm', onclick: () => { d.files = d.files.filter(x => x !== fid); removed.push(fid); drawFiles(); } }, icon('trash', 16))); }); });
      fileBox.append(h('button', { class: 'btn ghost sm', onclick: async () => {
        const fs = await pickFile('image/*,application/pdf', true);
        for (const f of fs) {
          try {
            if (f.type.startsWith('image/')) { const data = await compressImage(f, 1600, 0.75); const id = await saveImg(data, f.name, 'image/jpeg'); d.files.push(id); newFiles.push(id); }
            else { if (f.size > 4 * 1024 * 1024) { toast('الملف كبير (أكثر من 4 ميغا). صوّر الخطاب كصورة بدلًا منه'); continue; } const id = await saveImg(await readDataURL(f), f.name, f.type); d.files.push(id); newFiles.push(id); }
          } catch (e) { toast('تعذر إضافة الملف'); }
        }
        drawFiles();
      } }, '+ إرفاق صورة الخطاب أو ملف'));
    };
    drawFiles();

    pg.body.append(
      h('div', { class: 'lbl' }, 'حالة الطلب'), stepper,
      field('نوع الطلب', sel(d, 'kind', KINDS)),
      h('div', { class: 'row2' }, field('رقم الخطاب', tx(d, 'letterNo', { ph: 'رقم خطاب المركز' })), field('تاريخ الخطاب', tx(d, 'letterDate', { ph: 'مثال: 1448/05/12' }))),
      field('الجهة (مركز الشرطة)', tx(d, 'center', { ph: 'مركز شرطة ...' })),
      field('تاريخ وصول الطلب', tx(d, 'received', { type: 'date' })),
      field('المطلوب إبلاغه *', I.person, 'ابدأ بكتابة الاسم، وإن كان مسجلًا عندك تُعبّأ بياناته تلقائيًا'),
      h('div', { class: 'row2' }, field('رقم الهوية', I.nid), field('رقم الجوال', I.phone)),
      h('div', { class: 'row-act' }, h('button', { class: 'btn ghost sm', onclick: () => { if (!d.phone) { toast('اكتب رقم الجوال أولًا'); return; } location.href = telLink(d.phone); } }, icon('phone', 18), ' اتصال'),
        h('button', { class: 'btn ghost sm', onclick: () => { if (!d.phone) { toast('اكتب رقم الجوال أولًا'); return; } window.open(waLink(d.phone), '_blank'); } }, icon('wa', 18), ' واتساب للمطلوب')),
      houseBox,
      h('h4', {}, 'محاولات الاتصال'), attBox,
      h('h4', {}, 'المرفقات (مجلد الطلب)'), fileBox,
      field('ملاحظات', ta(d, 'notes', { rows: 2 })), err,
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn ghost', onclick: () => sendWhatsApp(d) }, icon('wa', 18), ' إرسال/تحويل الطلب عبر واتساب'),
        isNew ? null : h('button', { class: 'btn danger ghost', onclick: async () => { if (await confirmBox('حذف هذا الطلب ومرفقاته؟', 'حذف', true)) { for (const f of d.files) await delImg(f); await delRec('requests', S.requests, d.id); pg.close(); render(); toast('تم الحذف'); } } }, 'حذف الطلب')));

    const save = async () => {
      const m = []; if (!d.person.trim()) m.push('اكتب اسم المطلوب إبلاغه'); const pe = checkPhone(d.phone), ne = checkNid(d.nid); if (pe) m.push(pe); if (ne) m.push(ne);
      if (m.length) { err.textContent = m.join(' • '); err.classList.remove('hidden'); err.scrollIntoView({ block: 'center' }); return false; }
      d.person = d.person.trim(); d.phone = cleanNum(d.phone); d.nid = cleanNum(d.nid);
      if (d.attempts.length && d.status === 'واردة') d.status = 'جارٍ التواصل';
      for (const f of removed) await delImg(f);
      await putRec('requests', S.requests, d); render(); return true;
    };
    pg.foot.append(h('button', { class: 'btn ghost', onclick: async () => { if (await save()) { pg.close(); Reports.fromRequest(d); } } }, icon('rep', 18), ' إعداد المحضر'),
      h('button', { class: 'btn pri', onclick: async () => { if (await save()) { pg.close(); toast('تم حفظ الطلب'); } } }, 'حفظ'));
  }

  async function sendWhatsApp(d) {
    const text = ['طلب إبلاغ', 'نوع الطلب: ' + kindLabel(d.kind), d.center ? 'الجهة: ' + d.center : '', d.letterNo ? 'رقم الخطاب: ' + d.letterNo : '', d.letterDate ? 'تاريخ الخطاب: ' + d.letterDate : '',
      'المطلوب: ' + (d.person || ''), d.nid ? 'الهوية: ' + d.nid : '', d.phone ? 'الجوال: ' + d.phone : '', 'الحالة: ' + d.status].filter(Boolean).join('\n');
    try {
      const files = [];
      for (const fid of d.files || []) { const r = await getImg(fid); if (r) files.push(new File([dataToBlob(r.data)], r.name || 'مرفق', { type: (r.data.match(/:(.*?);/) || [])[1] })); }
      if (files.length && navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }

  return { build, render, open: open_, STATUS };
})();
