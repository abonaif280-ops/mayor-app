// ============ الشاشة الرئيسية المبسطة ============
const Home = (() => {
  let root;
  const lateCount = () => S.requests.filter(r => r.status !== 'تم الرد' && r.received && (Date.now() - new Date(r.received + 'T00:00:00').getTime()) / 86400000 >= 3).length;
  function backupCard() {
    const pend = Backup.pending(), lb = S.settings.lastBackup, cloud = Cloud.active() ? Cloud.statusText() : '';
    return h('div', { class: 'bkcard' + (Backup.due() ? ' due' : '') },
      h('div', { class: 'bkt' }, h('b', {}, lb ? 'آخر نسخة احتياطية: ' + fmtDate(lb) : 'لم تُحفظ نسخة احتياطية بعد'), h('small', {}, S.houses.length + S.requests.length + S.reports.length === 0 ? 'ابدأ بإضافة بيانات ثم احفظ نسخة' : (pend ? pend + ' تعديل لم يُحفظ بعد' : 'كل بياناتك في نسخة احتياطية')), cloud ? h('small', { class: 'cl', onclick: () => { if (!Cloud.ready()) Cloud.connectSheet(render); } }, cloud) : null),
      h('button', { class: 'btn pri', onclick: async () => { await Backup.quickSave(true); render(); } }, icon('share', 18), ' احفظ نسخة'));
  }
  function build(r) { root = r; }
  function render() {
    const s = S.settings, nNotes = S.houses.filter(hasNotes).length, late = lateCount();
    const open = S.requests.filter(r => r.status !== 'تم الرد').length;
    root.innerHTML = '';
    const stat = (n, label, cls, go) => h('button', { class: 'stat ' + (cls || ''), onclick: go }, h('b', {}, n), h('span', {}, label));
    const tile = (ic, title, sub, go, badge, cls) => h('button', { class: 'tile ' + (cls || ''), onclick: go }, h('span', { class: 'tico' }, icon(ic, 34)), h('b', {}, title), h('small', {}, sub), badge ? h('i', { class: 'tbadge' }, badge) : null);
    root.append(
      h('div', { class: 'hello' }, h('b', {}, s.mayorName ? 'أهلًا ' + s.mayorName : 'أهلًا بك'), h('small', {}, s.district ? 'عمدة حي ' + s.district : 'مساعد العمدة')),
      Install.card(),
      h('div', { class: 'stats' },
        stat(S.houses.length, 'بيت مسجل', '', () => switchTab('map')),
        stat(nNotes, 'فيه ملاحظات', nNotes ? 'red' : '', () => { S.filter = 'notes'; switchTab('map'); MapUI.refresh(); }),
        stat(open, 'طلب مفتوح', '', () => switchTab('req')),
        stat(late, 'طلب متأخر', late ? 'amber' : '', () => switchTab('req'))),
      backupCard(),
      h('div', { class: 'tiles' },
        tile('map', 'خريطة الحي', 'البيوت والحدود وموقعي', () => switchTab('map')),
        tile('plus', 'إضافة بيت', 'سجّل بيتًا جديدًا', () => { switchTab('map'); MapUI.addHouse(); }, '', 'pri'),
        tile('req', 'الطلبات الواردة', open ? open + ' مفتوح' : 'لا توجد طلبات مفتوحة', () => switchTab('req'), late ? late + ' متأخر' : ''),
        tile('rep', 'محضر جديد', 'مراجعة، حضور، حالة', () => Reports.chooser()),
        tile('chart', 'تقرير الحي', 'خريطة وجدول للطباعة', () => District.open()),
        tile('search', 'بحث', 'بالاسم أو الهوية أو الجوال', () => switchTab('search'))),
      h('p', { class: 'mut homehint' }, 'بياناتك محفوظة في هذا الجوال فقط. خذ نسخة احتياطية من «الإعدادات» كل أسبوعين.'));
  }
  return { build, render };
})();
