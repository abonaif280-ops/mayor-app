// ============ التشغيل والتنقل والبحث ============
const App = (() => {
  let banner, views = {}, hiddenAt = 0, searchQ = '', dismissed = false;
  const NAV = [['home', 'الرئيسية', 'home'], ['map', 'الخريطة', 'map'], ['req', 'الطلبات', 'req'], ['rep', 'المحاضر', 'rep'], ['set', 'الإعدادات', 'set']];
  const VIEWS = NAV.map(x => x[0]).concat('search');

  function updateBanner() {
    if (!banner) return; banner.innerHTML = ''; banner.classList.add('hidden'); if (dismissed) return;
    const n = S.houses.length + S.requests.length + S.reports.length; let msg = '';
    if (S.settings.pin === hashPin(DEFAULT_PIN)) msg = 'تنبيه: ما زلت تستخدم رمز الدخول الافتراضي. غيّره من الإعدادات.';
    else if (n && Settings.backupAge() >= 14) msg = 'مضى ' + Settings.backupAge() + ' يومًا على آخر نسخة احتياطية. خذ نسخة الآن.';
    if (!msg) return;
    banner.classList.remove('hidden');
    banner.append(h('span', {}, msg), h('button', { class: 'btn sm pri', onclick: () => switchTab('set') }, 'الإعدادات'), h('button', { class: 'x', onclick: () => { dismissed = true; updateBanner(); } }, '✕'));
  }
  function updateNavBadge() {
    const late = S.requests.filter(r => r.status !== 'تم الرد' && r.received && (Date.now() - new Date(r.received + 'T00:00:00').getTime()) / 86400000 >= 3).length;
    const b = $('#nb-req'); if (b) { b.textContent = late || ''; b.classList.toggle('hidden', !late); }
  }

  // ---------- البحث الموحد ----------
  function renderSearch() {
    const box = views.search; box.innerHTML = '';
    const res = h('div', { class: 'cards' });
    const inp = h('input', { class: 'in big', type: 'search', placeholder: 'ابحث بالاسم أو الهوية أو الجوال أو العداد', value: searchQ, oninput: e => { searchQ = e.target.value; run(); } });
    box.append(h('div', { class: 'vhead' }, h('h2', {}, 'البحث')), h('div', { class: 'searchbar' }, inp), res);
    function run() {
      res.innerHTML = ''; const t = arDigits(searchQ.trim()).toLowerCase();
      if (!t) { res.append(h('div', { class: 'empty' }, 'اكتب أي جزء من الاسم أو رقم الهوية أو الجوال أو العداد أو رقم الخطاب أو المحضر')); return; }
      const m = v => (arDigits(v || '')).toLowerCase().includes(t);
      const hs = S.houses.filter(x => [x.owner, x.nid, x.phone, x.meter, x.address, x.notes, ...(x.tags || []), ...(x.apts || []).flatMap(a => [a.name, a.phone, a.no])].some(m));
      const rq = S.requests.filter(x => [x.person, x.nid, x.phone, x.letterNo, x.center].some(m));
      const rp = S.reports.filter(x => [x.person, x.nid, x.no, x.subject, x.letterNo].some(m));
      if (!hs.length && !rq.length && !rp.length) { res.append(h('div', { class: 'empty' }, 'لا توجد نتائج')); return; }
      if (hs.length) res.append(h('h4', {}, 'البيوت (' + hs.length + ')'), ...hs.slice(0, 30).map(x => h('button', { class: 'li', onclick: () => MapUI.focusHouse(x.id) }, h('i', { class: 'dot big', style: { background: hasNotes(x) ? '#d92d3a' : '#1f9d55' } }), h('div', { class: 'li-t' }, h('b', {}, houseTitle(x)), h('small', {}, [x.nid, x.phone, x.address].filter(Boolean).join(' • ') || '—')), icon('pin', 20))));
      if (rq.length) res.append(h('h4', {}, 'الطلبات (' + rq.length + ')'), ...rq.slice(0, 30).map(x => h('button', { class: 'li', onclick: () => Requests.open(x.id) }, h('div', { class: 'li-t' }, h('b', {}, x.person || 'بدون اسم'), h('small', {}, [x.status, kindLabel(x.kind), x.letterNo ? 'خطاب ' + x.letterNo : ''].filter(Boolean).join(' • '))))));
      if (rp.length) res.append(h('h4', {}, 'المحاضر (' + rp.length + ')'), ...rp.slice(0, 30).map(x => h('button', { class: 'li', onclick: () => Reports.open(x.id) }, h('div', { class: 'li-t' }, h('b', {}, (x.no || '') + ' — ' + (x.person || '')), h('small', {}, kindLabel(x.kind) + ' • ' + fmtISO(x.date))))));
    }
    run(); setTimeout(() => { if (!searchQ) inp.focus(); }, 120);
  }

  // ---------- الهيكل ----------
  async function start() {
    await loadAll(); applyPrefs(); dismissed = false;
    const app = $('#app'); app.innerHTML = '';
    const cyc = async () => { const o = ['light', 'sun', 'night']; S.settings.theme = o[(o.indexOf(S.settings.theme) + 1) % 3]; applyPrefs(); await saveSettings(); toast({ light: 'الوضع العادي', sun: 'وضع الشمس (تباين عالٍ)', night: 'الوضع الليلي' }[S.settings.theme]); };
    const top = h('header', { class: 'top' }, h('div', { class: 'tt' }, h('b', {}, 'عمدة الحي'), h('small', {}, S.settings.district ? 'حي ' + S.settings.district : '')),
      h('div', { class: 'tact' }, h('button', { class: 'rbtn sm', title: 'وضع الشمس / الليل', onclick: cyc }, '☀'), h('button', { class: 'rbtn sm', title: 'قفل البرنامج', onclick: () => lockScreen() }, '🔒')));
    banner = h('div', { id: 'topbanner', class: 'hidden' });
    const main = h('main', { class: 'views' });
    VIEWS.forEach(k => { views[k] = h('section', { class: 'view hidden', id: 'v-' + k }); main.append(views[k]); });
    const nav = h('nav', { class: 'nav' }, NAV.map(([k, l, ic]) => h('button', { 'data-t': k, onclick: () => switchTab(k) }, icon(ic, 24), h('span', {}, l), k === 'req' ? h('i', { class: 'nbadge hidden', id: 'nb-req' }) : null)));
    app.append(h('div', { class: 'shell' }, top, banner, main, nav));
    Requests.build(views.req); Reports.build(views.rep); Settings.build(views.set); Home.build(views.home);
    switchTab('map'); MapUI.build(views.map); MapUI.show(); switchTab('home');
    updateBanner(); updateNavBadge();
  }
  function go(t) {
    S.tab = t;
    VIEWS.forEach(k => views[k].classList.toggle('hidden', k !== t));
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.t === (t === 'search' ? 'home' : t)));
    if (t === 'home') Home.render(); else if (t === 'map') MapUI.show(); else if (t === 'req') Requests.render(); else if (t === 'rep') Reports.render(); else if (t === 'search') renderSearch(); else if (t === 'set') Settings.render();
    updateNavBadge();
  }
  return { start, go, updateBanner, hiddenAt: v => { if (v !== undefined) hiddenAt = v; return hiddenAt; } };
})();
function switchTab(t) { App.go(t); }

(async function boot() {
  try { await DB.open(); } catch (e) {
    $('#app').append(h('div', { class: 'fatal' }, h('h2', {}, 'تعذر تشغيل البرنامج'), h('p', {}, 'المتصفح الحالي لا يسمح بحفظ البيانات (ربما بسبب التصفح الخاص). افتح البرنامج في نافذة عادية.'))); return;
  }
  await loadSettings(); applyPrefs();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
  if (!S.settings.wizardDone) wizard(() => App.start());
  else lockScreen(() => App.start());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) App.hiddenAt(Date.now());
    else if (App.hiddenAt() && Date.now() - App.hiddenAt() > 120000 && !$('.lock') && !$('.wiz') && S.settings.pin && S.settings.wizardDone) lockScreen();
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
