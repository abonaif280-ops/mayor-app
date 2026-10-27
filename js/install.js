// ============ تثبيت التطبيق على الشاشة الرئيسية ============
const Install = (() => {
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  const standalone = () => window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const NAME = 'مساعد العمدة';

  function sheet() {
    const sh = openSheet('تثبيت ' + NAME + ' على الشاشة الرئيسية');
    const step = (n, t) => h('div', { class: 'istep' }, h('span', { class: 'inum' }, n), h('div', {}, t));
    if (deferred) {
      sh.body.append(h('p', {}, 'اضغط الزر ليُضاف التطبيق إلى شاشتك الرئيسية باسم «' + NAME + '».'));
      sh.foot.append(h('button', { class: 'btn pri', onclick: async () => { try { deferred.prompt(); await deferred.userChoice; } catch (e) { } deferred = null; sh.close(); render(); } }, 'تثبيت الآن'));
    } else if (isIOS()) {
      sh.body.append(
        h('p', { class: 'mut' }, 'يجب أن يكون الرابط مفتوحًا في Safari (وليس داخل تطبيق آخر).'),
        step(1, ['اضغط زر المشاركة ', h('b', {}, '⬆︎'), ' في أسفل Safari (أو بجوار شريط العنوان).']),
        step(2, 'مرّر للأسفل واضغط «إضافة إلى الشاشة الرئيسية».'),
        step(3, 'تأكد أن الاسم «' + NAME + '» ثم اضغط «إضافة».'),
        step(4, 'ستجد الأيقونة في آخر صفحة من شاشتك الرئيسية. اسحب الشاشة يسارًا حتى تصل إليها، أو اكتب الاسم في بحث الجوال.'),
        h('div', { class: 'iwarn' }, h('b', {}, 'مهم: '), 'بيانات الأيقونة منفصلة عن بيانات Safari في iPhone. إن كنت أدخلت بيانات في Safari فاحفظ نسخة احتياطية أولًا، ثم افتح الأيقونة من الشاشة الرئيسية واستعدها من الإعدادات ← «استعادة من ملف». الأفضل التثبيت قبل إدخال البيانات.'));
    } else {
      sh.body.append(
        step(1, 'افتح قائمة المتصفح (⋮) في الأعلى.'),
        step(2, 'اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».'),
        step(3, 'ثبّت وستجد الأيقونة باسم «' + NAME + '».'));
    }
    sh.foot.append(h('button', { class: 'btn', onclick: () => { S.settings.installHide = true; saveSettings(); sh.close(); render(); } }, 'لا تذكّرني'));
    return sh;
  }
  function render() { try { Home.render(); } catch (e) { } }
  function card() {
    if (standalone() || S.settings.installHide) return null;
    return h('div', { class: 'instcard' },
      h('div', { class: 'bkt' }, h('b', {}, 'ثبّت ' + NAME + ' على شاشة جوالك'), h('small', {}, 'يفتح كتطبيق بأيقونة مستقلة وبملء الشاشة')),
      h('button', { class: 'btn pri', onclick: sheet }, 'تثبيت'));
  }
  // يُعرض مرة واحدة تلقائيًا عند أول استخدام داخل المتصفح
  function firstTime() {
    if (navigator.webdriver || standalone() || S.settings.installHide || S.settings.installShown) return;
    S.settings.installShown = true; saveSettings(); setTimeout(sheet, 1200);
  }
  return { card, sheet, firstTime, standalone };
})();
