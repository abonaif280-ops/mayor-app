// ============ المحاضر: الإعداد والمعاينة والطباعة وWord والمشاركة ============
const Reports = (() => {
  const RESULTS = [['personal', 'تم إبلاغه شخصيًا'], ['phone', 'تم إبلاغه هاتفيًا'], ['unreached', 'تعذّر الوصول إليه'], ['refused', 'رفض الاستلام'], ['moved', 'غير مقيم بالحي']];
  const TITLES = { review: 'محضر إبلاغ بالمراجعة', case: 'محضر إبلاغ عن حالة' };
  // عنوان المحضر دائمًا: نوع المحضر + بتاريخ اليوم
  const titleOf = r => (TITLES[r.kind === 'attend' ? 'review' : r.kind] || 'محضر') + ' بتاريخ ' + fmtISO(r.date) + calSuffix();
  let root, filter = 'all';
  const calSuffix = () => S.settings.calendar === 'hijri' ? ' هـ' : ' م';

  function build(r) { root = r; }
  function render() {
    root.innerHTML = '';
    root.append(h('div', { class: 'vhead' }, h('div', {}, h('h2', {}, 'المحاضر'), h('small', { class: 'mut' }, 'عدد المحاضر: ' + S.reports.length))));
    const chips = h('div', { class: 'chips' });
    [['all', 'الكل'], ...KINDS].forEach(([k, l]) => chips.append(h('button', { class: 'chip' + (filter === k ? ' on' : ''), onclick: () => { filter = k; render(); } }, l)));
    root.append(chips);
    let arr = S.reports.slice().sort((a, b) => (b.created || 0) - (a.created || 0)); if (filter !== 'all') arr = arr.filter(r => r.kind === filter);
    const list = h('div', { class: 'cards' });
    if (!arr.length) list.append(h('div', { class: 'empty' }, h('b', {}, 'لا توجد محاضر بعد'), h('p', {}, 'اضغط «محضر جديد» وعبّئ البيانات، وسيكون المحضر جاهزًا للطباعة أو التصدير.')));
    arr.forEach(r => list.append(h('button', { class: 'card', onclick: () => open_(r.id) },
      h('div', { class: 'card-top' }, h('b', {}, r.person || r.subject || 'محضر'), h('span', { class: 'badge blue', dir: 'ltr' }, r.no || '')),
      h('div', { class: 'mut' }, kindLabel(r.kind) + ' • ' + fmtISO(r.date)),
      r.houseId && houseById(r.houseId) ? h('div', { class: 'meta' }, h('span', {}, '🏠 ' + houseTitle(houseById(r.houseId)))) : null)));
    root.append(list, h('button', { class: 'fab', onclick: chooser }, icon('plus', 24), ' محضر جديد'));
  }
  function chooser() {
    const sh = openSheet('اختر نوع المحضر');
    KINDS.forEach(([k, l]) => sh.body.append(h('button', { class: 'bigbtn', onclick: () => { sh.close(); open_(null, { kind: k }); } }, h('b', {}, l), h('small', {}, TITLES[k] + ' بتاريخ اليوم'))));
  }

  // ---------- الصياغة التلقائية ----------
  function genSubject(r) {
    const w = r.person || '.....', c = r.center || 'المركز';
    if (r.kind === 'review') return 'إبلاغ المدعو / ' + w + ' بمراجعة ' + c;
    return 'إبلاغ عن حالة' + (r.person ? ' — ' + r.person : '');
  }
  function genBody(r) {
    const s = S.settings, w = r.person || '.....', nid = r.nid ? ' (هوية رقم ' + r.nid + ')' : '', c = r.center || 'المركز';
    const lt = r.letterNo ? 'رقم (' + r.letterNo + ')' : '', ld = r.letterDate ? ' وتاريخ (' + r.letterDate + ')' : '';
    const act = r.kind === 'review' ? 'بمراجعة ' + c : '';
    const p1 = r.kind === 'case'
      ? 'بناءً على خطاب ' + c + ' ' + lt + ld + ' بشأن الحالة الخاصة بالمدعو / ' + w + nid + '،'
      : 'بناءً على خطاب ' + c + ' ' + lt + ld + ' بشأن إبلاغ المدعو / ' + w + nid + ' ' + act + '،';
    const me = 'فقد قمت أنا / ' + (s.mayorName || '.....') + ' عمدة حي ' + (s.district || '.....');
    const dt = fmtISO(r.date) + calSuffix();
    const q = r.requestId && S.requests.find(x => x.id === r.requestId); const at = (q && q.attempts) || [];
    const attTxt = at.length ? ' (تمت ' + at.length + ' محاولة اتصال، آخرها بتاريخ ' + fmtDate(at[at.length - 1].ts) + calSuffix() + ')' : '';
    let p2;
    switch (r.result) {
      case 'phone': p2 = me + ' بالتواصل مع المذكور هاتفيًا' + (r.phone ? ' على الرقم (' + r.phone + ')' : '') + ' بتاريخ ' + dt + '، وتم إبلاغه بمضمون الخطاب، وأفاد بعلمه وتفهمه لما ورد فيه.'; break;
      case 'unreached': p2 = me + ' بمحاولة التواصل مع المذكور' + attTxt + '، وحتى تاريخ ' + dt + ' لم يتم الوصول إليه.'; break;
      case 'refused': p2 = me + ' بالتواصل مع المذكور بتاريخ ' + dt + '، وتم إبلاغه بمضمون الخطاب، إلا أنه رفض الاستلام.'; break;
      case 'moved': p2 = me + ' بالتحري عن المذكور بتاريخ ' + dt + '، وتبين أنه غير مقيم في نطاق الحي.'; break;
      default: p2 = me + ' بالتواصل مع المذكور شخصيًا بتاريخ ' + dt + '، وتم إبلاغه بمضمون الخطاب، وأفاد بعلمه وتفهمه لما ورد فيه.';
    }
    const out = [(p1 + ' ' + p2).replace(/\s{2,}/g, ' ')];
    if ((r.details || '').trim()) out.push(r.details.trim());
    out.push('وهذا ما تم، وبالله التوفيق.');
    return out.join('\n');
  }
  function nextSeq(iso) {
    const y = yearOf(iso); const seqs = S.reports.filter(x => x.year === y).map(x => x.seq || 0);
    return { year: y, seq: seqs.length ? Math.max(...seqs) + 1 : Math.max(1, parseInt(S.settings.startNo, 10) || 1) };
  }
  const noOf = (seq, year) => pad(seq, 3) + '/' + year;

  // ---------- صفحة المحضر (A4) ----------
  function pageEl(r) {
    const s = S.settings;
    const line = (k, v) => h('div', { class: 'hline' }, h('b', {}, k + ': '), h('span', {}, v));
    const sigImg = r.useSig !== false && s.sig ? h('img', { class: 'sigimg', src: s.sig }) : h('div', { class: 'sigspace' });
    return h('div', { class: 'a4 f-' + (s.reportFont || 'tajawal') },
      h('div', { class: 'in' },
        h('div', { class: 'head' },
          h('div', { class: 'hr' }, ['المملكة العربية السعودية', 'وزارة الداخلية', 'الأمن العام', s.region, s.center].filter(Boolean).map(t => h('div', {}, t))),
          h('div', { class: 'hlogo' }, s.logo ? h('img', { src: s.logo }) : h('div', { class: 'nologo noprint' }, 'الشعار')),
          h('div', { class: 'hl' }, line('التاريخ', fmtISO(r.date) + calSuffix()), line('الرقم', r.no || '—'), line('الموضوع', r.subject || ''), line('المشفعات', r.attachments || 'لا يوجد'))),
        h('div', { class: 'ttl' }, titleOf(r)),
        h('div', { class: 'bodytxt' }, r.body || ''),
        h('div', { class: 'spacer' }),
        h('div', { class: 'sigblk' }, h('div', {}, 'عمدة حي ' + (s.district || '.....')), h('div', { class: 'nm' }, s.mayorName || '.....'), sigImg)));
  }
  const fontsReady = async () => { try { await Promise.all([document.fonts.load('16pt Tajawal'), document.fonts.load('bold 16pt Tajawal'), document.fonts.load('16pt Amiri')]); await document.fonts.ready; } catch (e) { } };
  // يكبّر/يصغّر خط المحضر ليبقى في صفحة واحدة
  function fitPage(page) {
    const body = page.querySelector('.bodytxt'), inner = page.querySelector('.in'); const MIN = 11, MAX = 16; let size = MAX;
    for (; size >= MIN; size -= 0.5) { body.style.fontSize = size + 'pt'; if (inner.scrollHeight <= inner.clientHeight + 1) break; }
    if (size < MIN) { size = MIN; body.style.fontSize = MIN + 'pt'; }
    return { size, overflow: inner.scrollHeight > inner.clientHeight + 1 };
  }
  async function mountPreview(box, r, warnEl) {
    box.innerHTML = ''; const page = pageEl(r); const wrap = h('div', { class: 'prevwrap' }, page); box.append(wrap);
    await fontsReady();
    const res = fitPage(page);
    const k = Math.min(1, (box.clientWidth - 4) / 794); page.style.transform = 'translateX(-50%) scale(' + k + ')'; wrap.style.height = Math.ceil(1123 * k) + 'px';
    if (warnEl) { warnEl.classList.toggle('hidden', !res.overflow); warnEl.textContent = res.overflow ? 'النص طويل ولا يتسع في صفحة واحدة بخط مقروء. اختصر نص المحضر.' : ''; }
    return res;
  }

  // ---------- المحرر ----------
  async function open_(id, preset) {
    let r, draftKey;
    if (id) {
      const src = S.reports.find(x => x.id === id); if (!src) return; r = JSON.parse(JSON.stringify(src)); draftKey = 'edit:' + id;
    } else {
      const base = { id: uid(), kind: 'review', date: todayISO(), no: '', seq: 0, year: 0, subject: '', subjectEdited: false, letterNo: '', letterDate: '', center: S.settings.center || '', person: '', nid: '', phone: '', houseId: '', requestId: '', result: 'personal', details: '', body: '', bodyEdited: false, attachments: 'لا يوجد', useSig: true, created: Date.now() };
      r = Object.assign(base, preset || {}); draftKey = 'new:' + (r.requestId || r.houseId || r.kind);
    }
    // استعادة مسودة محفوظة تلقائيًا
    const dr = await DB.get('drafts', draftKey);
    if (dr && dr.data && (id ? dr.ts > (r.created || 0) : true) && JSON.stringify(dr.data) !== JSON.stringify(r)) {
      const meaningful = id || dr.data.person || dr.data.bodyEdited || dr.data.details;
      if (meaningful && await confirmBox('لديك مسودة غير محفوظة لهذا المحضر. هل تريد استعادتها؟', 'استعادة المسودة', false, 'ابدأ من جديد')) r = dr.data;
      else await DB.del('drafts', draftKey);
    }
    if (!r.no) { const n = nextSeq(r.date); r._proj = noOf(n.seq, n.year); }
    const shownNo = () => r.no || r._proj || '';
    const I = {}; const warn = h('div', { class: 'warn hidden' });
    let onPreview = false;
    const pg = openPage(id ? 'تعديل المحضر' : 'محضر جديد', { onBack: close => close() });
    const dataPane = h('div', { class: 'pane' }), prevPane = h('div', { class: 'pane hidden' });
    const prevBox = h('div', { class: 'prevbox' });
    let draftTimer;
    const saveDraft = () => { clearTimeout(draftTimer); draftTimer = setTimeout(() => { const c = { ...r }; DB.put('drafts', { id: draftKey, data: c, ts: Date.now() }); }, 500); };
    const refreshPrev = debounce(() => { if (onPreview) { const t = { ...r, no: shownNo() }; mountPreview(prevBox, t, warn); } }, 200);
    const regen = () => {
      if (!r.subjectEdited) { r.subject = genSubject(r); I.subject.value = r.subject; }
      if (!r.bodyEdited) { r.body = genBody(r); I.body.value = r.body; }
      saveDraft(); refreshPrev();
    };
    const chg = () => regen();
    I.kind = sel(r, 'kind', KINDS, { on: chg });
    I.date = tx(r, 'date', { type: 'date', on: chg });
    I.person = tx(r, 'person', { ph: 'اسم المدعو', list: 'dl-people', on: chg });
    I.person.addEventListener('change', () => { autoFillPerson(r, I); I.refreshHouse(); regen(); });
    I.nid = tx(r, 'nid', { mode: 'numeric', ml: 10, on: chg });
    I.phone = tx(r, 'phone', { type: 'tel', mode: 'tel', ml: 10, on: chg });
    I.subject = tx(r, 'subject', { ph: 'موضوع المحضر', on: () => { r.subjectEdited = true; saveDraft(); refreshPrev(); } });
    I.body = ta(r, 'body', { rows: 9, on: () => { r.bodyEdited = true; saveDraft(); refreshPrev(); } });
    I.details = ta(r, 'details', { rows: 2, ph: r.kind === 'case' ? 'صف الحالة وما تم بشأنها' : 'أي تفاصيل إضافية تريد إضافتها للمحضر', on: chg });
    const houseBox = h('div', { class: 'hlink' });
    I.refreshHouse = () => {
      houseBox.innerHTML = ''; const hs = r.houseId && houseById(r.houseId);
      if (hs) houseBox.append(h('span', {}, '🏠 ' + houseTitle(hs) + ' (يُحفظ المحضر في سجل البيت)'), h('button', { class: 'btn sm ghost', onclick: () => { r.houseId = ''; I.refreshHouse(); saveDraft(); } }, 'فك الربط'));
      else houseBox.append(h('button', { class: 'btn sm ghost', onclick: () => MapUI.housePicker(x => { r.houseId = x.id; if (!r.person) { r.person = x.owner; I.person.value = x.owner; } if (!r.nid && x.nid) { r.nid = x.nid; I.nid.value = x.nid; } if (!r.phone && x.phone) { r.phone = x.phone; I.phone.value = x.phone; } I.refreshHouse(); regen(); }) }, '🏠 ربط المحضر ببيت من السجل (اختياري)'));
    };
    I.refreshHouse(); peopleDatalist();
    dataPane.append(
      field('نوع المحضر', I.kind), field('تاريخ المحضر', I.date),
      h('div', { class: 'row2' }, field('رقم خطاب المركز', tx(r, 'letterNo', { on: chg })), field('تاريخ الخطاب', tx(r, 'letterDate', { ph: '1448/05/12', on: chg }))),
      field('الجهة (مركز الشرطة)', tx(r, 'center', { ph: 'مركز شرطة ...', on: chg })),
      field('اسم المدعو', I.person, 'إن كان مسجلًا في السجل تُعبّأ هويته وجواله تلقائيًا'),
      h('div', { class: 'row2' }, field('رقم الهوية', I.nid), field('رقم الجوال', I.phone)), houseBox,
      field('نتيجة التواصل', sel(r, 'result', RESULTS, { on: chg })),
      field(r.kind === 'case' ? 'وصف الحالة' : 'تفاصيل إضافية (اختياري)', I.details),
      field('الموضوع', I.subject, 'يُكتب تلقائيًا ويمكنك تعديله'),
      field('المشفعات', tx(r, 'attachments', { on: () => { saveDraft(); refreshPrev(); } })),
      h('div', { class: 'lblrow' }, h('span', { class: 'lbl' }, 'نص المحضر'), h('button', { class: 'btn sm ghost', onclick: () => { r.bodyEdited = false; r.subjectEdited = false; regen(); toast('أُعيدت الصياغة التلقائية'); } }, 'إعادة الصياغة التلقائية')), I.body,
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.useSig !== false, onchange: e => { r.useSig = e.target.checked; saveDraft(); refreshPrev(); } }), S.settings.sig ? ' إدراج توقيعي في المحضر' : ' إدراج التوقيع (لم تضف توقيعك بعد، أضفه من الإعدادات)'));
    if (id) dataPane.append(h('button', { class: 'btn danger ghost', onclick: async () => { if (await confirmBox('حذف هذا المحضر نهائيًا؟', 'حذف', true)) { await delRec('reports', S.reports, r.id); await DB.del('drafts', draftKey); pg.close(); render(); toast('تم الحذف'); } } }, 'حذف المحضر'));

    // ---- الحفظ والتصدير ----
    const save = async (quiet) => {
      if (!(r.person || '').trim() && !(r.kind === 'case' && ((r.details || '').trim() || (r.subject || '').trim()))) { toast('اكتب اسم المدعو أولًا'); return false; }
      const pe = checkPhone(r.phone), ne = checkNid(r.nid); if (pe || ne) { toast(pe || ne); return false; }
      r.phone = cleanNum(r.phone); r.nid = cleanNum(r.nid);
      if (!r.no) { const n = nextSeq(r.date); r.year = n.year; r.seq = n.seq; r.no = noOf(n.seq, n.year); }
      delete r._proj; r.updated = Date.now();
      await putRec('reports', S.reports, r);
      if (r.requestId) { const q = S.requests.find(x => x.id === r.requestId); if (q) { q.reportId = r.id; if (q.status !== 'تم الرد') q.status = 'تم الإبلاغ'; await putRec('requests', S.requests, q); } }
      clearTimeout(draftTimer); await DB.del('drafts', draftKey); draftKey = 'edit:' + r.id; render(); Requests.render();
      if (!quiet) toast('تم حفظ المحضر برقم ' + r.no);
      return true;
    };
    const fitSize = async () => { const t = { ...r }; const pgEl = pageEl(t); const pr = $('#printRoot'); pr.innerHTML = ''; pr.append(pgEl); await fontsReady(); const f = fitPage(pgEl); pr.innerHTML = ''; return f; };
    const doPrint = async () => {
      if (!(await save(true))) return; const pr = $('#printRoot'); pr.innerHTML = ''; const page = pageEl(r); pr.append(page); await fontsReady(); const f = fitPage(page);
      if (f.overflow) toast('النص طويل، اختصره ليتسع في صفحة واحدة'); toast('اختر «حفظ كملف PDF» من نافذة الطباعة للحصول على PDF', 4500);
      const clear = () => { pr.innerHTML = ''; window.removeEventListener('afterprint', clear); }; window.addEventListener('afterprint', clear); setTimeout(() => window.print(), 250);
    };
    const mkWord = async () => { if (!(await save(true))) return null; const f = await fitSize(); const blob = await Docx.build(r, S.settings, Math.max(11, Math.floor(f.size) - 1)); return { blob, name: 'محضر-' + r.no.replace('/', '-') + '.docx' }; };
    const doWord = async () => { try { const w = await mkWord(); if (w) { downloadBlob(w.blob, w.name); toast('تم تجهيز ملف Word'); } } catch (e) { console.error(e); toast('تعذر إنشاء ملف Word'); } };
    const doShare = async () => { try { const w = await mkWord(); if (w) await shareFile(w.blob, w.name, 'محضر ' + r.no); } catch (e) { console.error(e); toast('تعذرت المشاركة'); } };

    prevPane.append(warn, prevBox, h('div', { class: 'exp' },
      h('button', { class: 'btn pri', onclick: doPrint }, icon('print', 20), ' طباعة / PDF'),
      h('button', { class: 'btn ghost', onclick: doWord }, icon('rep', 20), ' Word'),
      h('button', { class: 'btn ghost', onclick: doShare }, icon('share', 20), ' مشاركة')));
    const tabs = h('div', { class: 'tabs2' });
    const setTab = p => { onPreview = p; dataPane.classList.toggle('hidden', p); prevPane.classList.toggle('hidden', !p); tabs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', (i === 1) === p)); if (p) { mountPreview(prevBox, { ...r, no: shownNo() }, warn); } };
    tabs.append(h('button', { class: 'on', onclick: () => setTab(false) }, 'البيانات'), h('button', { onclick: () => setTab(true) }, 'المعاينة والتصدير'));
    pg.body.append(tabs, dataPane, prevPane);
    pg.foot.append(h('button', { class: 'btn ghost', onclick: () => setTab(true) }, 'معاينة'), h('button', { class: 'btn pri', onclick: async () => { if (await save()) pg.close(); } }, 'حفظ المحضر'));
    if (!r.bodyEdited && !r.body) regen(); else { saveDraft(); }
  }

  function fromRequest(q) {
    const ex = q.reportId && S.reports.find(x => x.id === q.reportId); if (ex) { open_(ex.id); return; }
    const last = (q.attempts || [])[(q.attempts || []).length - 1];
    open_(null, { kind: q.kind, letterNo: q.letterNo, letterDate: q.letterDate, center: q.center || S.settings.center, person: q.person, nid: q.nid, phone: q.phone, houseId: q.houseId, requestId: q.id, result: last ? (last.result === 'رد وتم إبلاغه' ? 'phone' : 'unreached') : 'personal' });
  }
  function newFor(hs) { open_(null, { kind: 'review', person: hs.owner, nid: hs.nid || '', phone: hs.phone || '', houseId: hs.id }); }

  return { build, render, open: open_, fromRequest, newFor, kindLabel, chooser, titleOf };
})();
