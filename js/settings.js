// ============ القفل ومعالج أول فتح والإعدادات والنسخ الاحتياطي ============
const DEFAULT_PIN = '123456';

// ---------- شاشة الرمز ----------
function lockScreen(onOk) {
  let v = '';
  const dots = h('div', { class: 'pdots' }, [0, 1, 2, 3, 4, 5].map(() => h('i', {})));
  const msg = h('div', { class: 'pmsg' }, 'أدخل رمز الدخول');
  const draw = () => dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < v.length));
  const ov = h('div', { class: 'lock' });
  const press = k => {
    if (k === 'del') v = v.slice(0, -1); else if (v.length < 6) v += k; draw();
    if (v.length === 6) {
      if (hashPin(v) === S.settings.pin) { document.removeEventListener('keydown', key); ov.remove(); onOk && onOk(); }
      else { dots.classList.add('shake'); msg.textContent = 'الرمز غير صحيح، حاول مرة أخرى'; setTimeout(() => { dots.classList.remove('shake'); v = ''; draw(); }, 450); }
    }
  };
  const key = e => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); };
  document.addEventListener('keydown', key);
  const pad = h('div', { class: 'ppad' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => h('button', { onclick: () => press(String(n)) }, n)), h('span', {}), h('button', { onclick: () => press('0') }, '0'), h('button', { onclick: () => press('del') }, '⌫'));
  ov.append(h('div', { class: 'lockbox' }, h('div', { class: 'lockico' }, icon('pin', 40)), h('h2', {}, 'مساعد العمدةي'), h('p', { class: 'mut' }, S.settings.district ? 'حي ' + S.settings.district : ''), dots, msg, pad,
    h('button', { class: 'lnk', onclick: forgotPin }, 'نسيت الرمز؟')));
  document.body.append(ov);
}
function forgotPin() {
  const sh = openSheet('نسيت الرمز؟');
  sh.body.append(h('p', { class: 'msg' }, 'لا يمكن استرجاع الرمز لأن البيانات محفوظة في هذا الجهاز فقط. الحل الوحيد هو إعادة ضبط البرنامج، وهذا يحذف كل البيانات الموجودة على هذا الجهاز. إن كانت لديك نسخة احتياطية يمكنك استعادتها بعد ذلك.'));
  sh.foot.append(h('button', { class: 'btn ghost', onclick: sh.close }, 'إلغاء'), h('button', { class: 'btn danger', onclick: async () => { sh.close(); await resetAll(); } }, 'إعادة ضبط البرنامج'));
}
async function resetAll() {
  const t = await askText('تأكيد الحذف', 'اكتب كلمة: حذف', '', 'احذف كل شيء');
  if (t !== 'حذف') { if (t !== null) toast('لم تُكتب كلمة التأكيد بشكل صحيح'); return; }
  await DB.wipe(); location.reload();
}

// ---------- معالج أول فتح ----------
function wizard(done) {
  const d = { mayorName: '', district: '', center: '', logo: '', sig: '', pin: '', pin2: '' };
  let i = 0, pad_;
  const box = h('div', { class: 'wizbox' }), ov = h('div', { class: 'wiz' }, box); document.body.append(ov);
  const steps = [
    { q: 'السلام عليكم، ما اسمك؟', sub: 'سيظهر اسمك في المحاضر', body: () => [field('الاسم الكامل', tx(d, 'mayorName', { ph: 'مثال: محمد بن عبدالله' }))], ok: () => d.mayorName.trim() ? '' : 'اكتب اسمك للمتابعة' },
    { q: 'ما اسم حيّك ومركز الشرطة التابع له؟', sub: 'يظهران في ترويسة المحضر', body: () => [field('اسم الحي', tx(d, 'district', { ph: 'مثال: العوالي' })), field('مركز الشرطة', tx(d, 'center', { ph: 'مثال: مركز شرطة العوالي' }))], ok: () => d.district.trim() && d.center.trim() ? '' : 'اكتب اسم الحي والمركز' },
    { q: 'شعار الأمن العام', sub: 'ارفع صورة الشعار ليظهر في المحاضر (يمكنك تخطيها الآن)', body: () => { const p = h('div', { class: 'logoprev' }); const dr = () => { p.innerHTML = ''; if (d.logo) p.append(h('img', { src: d.logo })); }; dr(); return [p, h('button', { class: 'btn ghost block', onclick: async () => { const f = await pickFile('image/*'); if (f[0]) { try { d.logo = await normalizePng(f[0], 500); dr(); } catch (e) { toast('تعذر قراءة الصورة'); } } } }, 'رفع صورة الشعار')]; }, ok: () => '' },
    { q: 'توقيعك', sub: 'وقّع بإصبعك داخل المربع أو ارفع صورة التوقيع (يمكنك تخطيها الآن)', body: () => { pad_ = sigPad(); return [pad_.el, h('button', { class: 'btn ghost block', onclick: async () => { const f = await pickFile('image/*'); if (f[0]) { try { d.sig = await signatureFromFile(f[0]); toast('تم رفع التوقيع وتلوينه بالأزرق'); } catch (e) { toast('تعذر قراءة الصورة'); } } } }, 'أو ارفع صورة التوقيع')]; }, leave: () => { if (pad_ && !pad_.isEmpty()) d.sig = pad_.data(); }, ok: () => '' },
    { q: 'اختر رمز الدخول', sub: 'ستة أرقام تحمي البرنامج من الفضول. احفظه جيدًا لأنه لا يمكن استرجاعه.', body: () => [field('الرمز (6 أرقام)', tx(d, 'pin', { type: 'password', mode: 'numeric', ml: 6 })), field('أعد كتابة الرمز', tx(d, 'pin2', { type: 'password', mode: 'numeric', ml: 6 })), h('button', { class: 'lnk', onclick: () => { d.pin = d.pin2 = DEFAULT_PIN; finish(); } }, 'استخدم الرمز الافتراضي 123456 الآن (وأغيّره لاحقًا)')], ok: () => !/^\d{6}$/.test(cleanNum(d.pin)) ? 'الرمز لازم يكون 6 أرقام' : cleanNum(d.pin) !== cleanNum(d.pin2) ? 'الرمزان غير متطابقين' : '' },
  ];
  const finish = async () => {
    if (pad_ && !pad_.isEmpty() && !d.sig) d.sig = pad_.data();
    Object.assign(S.settings, { mayorName: d.mayorName.trim(), district: d.district.trim(), center: d.center.trim(), logo: d.logo, sig: d.sig, pin: hashPin(cleanNum(d.pin)), wizardDone: true, firstUse: Date.now() });
    await saveSettings(); ov.remove(); done();
  };
  const draw = () => {
    const s = steps[i]; box.innerHTML = '';
    const err = h('div', { class: 'err hidden' });
    box.append(h('div', { class: 'wprog' }, steps.map((_, k) => h('i', { class: k <= i ? 'on' : '' }))), h('h2', {}, s.q), h('p', { class: 'mut' }, s.sub), ...s.body(), err,
      h('div', { class: 'btnrow' }, i > 0 ? h('button', { class: 'btn ghost', onclick: () => { s.leave && s.leave(); i--; draw(); } }, 'السابق') : null,
        h('button', { class: 'btn pri', onclick: () => { const m = s.ok(); if (m) { err.textContent = m; err.classList.remove('hidden'); return; } s.leave && s.leave(); if (i === steps.length - 1) finish(); else { i++; draw(); } } }, i === steps.length - 1 ? 'ابدأ الاستخدام' : 'التالي')));
  };
  draw();
}

// ---------- الإعدادات ----------
const Settings = (() => {
  let root;
  const persist = debounce(() => saveSettings(), 400);
  function build(r) { root = r; }
  const card = (title, ...kids) => h('section', { class: 'scard' }, h('h3', {}, title), ...kids);
  const imgBox = (src, empty) => src ? h('img', { class: 'previmg', src }) : h('div', { class: 'mut' }, empty);

  function render() {
    root.innerHTML = ''; const s = S.settings;
    root.append(h('div', { class: 'vhead' }, h('h2', {}, 'الإعدادات')));
    root.append(card('بياناتي', field('الاسم', tx(s, 'mayorName', { on: persist })), field('اسم الحي', tx(s, 'district', { on: persist })), field('مركز الشرطة', tx(s, 'center', { on: persist })), field('شرطة المنطقة', tx(s, 'region', { on: persist }))));
    root.append(card('الشعار', imgBox(s.logo, 'لم يُرفع شعار بعد'), h('div', { class: 'btnrow' },
      h('button', { class: 'btn ghost', onclick: async () => { const f = await pickFile('image/*'); if (f[0]) { try { s.logo = await normalizePng(f[0], 500); await saveSettings(); render(); } catch (e) { toast('تعذر قراءة الصورة'); } } } }, 'رفع شعار'),
      s.logo ? h('button', { class: 'btn ghost', onclick: async () => { s.logo = ''; await saveSettings(); render(); } }, 'إزالة') : null)));
    root.append(card('التوقيع', imgBox(s.sig, 'لم تضف توقيعًا بعد'), h('div', { class: 'btnrow' },
      h('button', { class: 'btn ghost', onclick: signSheet }, 'التوقيع بالإصبع'),
      h('button', { class: 'btn ghost', onclick: async () => { const f = await pickFile('image/*'); if (f[0]) { try { s.sig = await signatureFromFile(f[0]); await saveSettings(); render(); toast('تم رفع التوقيع وتلوينه بالأزرق'); } catch (e) { toast('تعذر قراءة الصورة'); } } } }, 'رفع صورة'),
      s.sig ? h('button', { class: 'btn ghost', onclick: async () => { try { s.sig = await recolorBlue(s.sig); await saveSettings(); render(); toast('تم تلوين التوقيع بالأزرق'); } catch (e) { toast('تعذر تلوين التوقيع'); } } }, 'تلوين بالأزرق') : null,
      s.sig ? h('button', { class: 'btn ghost', onclick: async () => { s.sig = ''; await saveSettings(); render(); } }, 'إزالة') : null)));
    root.append(card('الأمان', s.pin === hashPin(DEFAULT_PIN) ? h('div', { class: 'warn' }, 'أنت تستخدم الرمز الافتراضي 123456. غيّره الآن.') : null, h('button', { class: 'btn ghost block', onclick: pinSheet }, 'تغيير رمز الدخول')));
    const themes = [['light', 'عادي'], ['sun', 'وضع الشمس'], ['night', 'ليلي']], scales = [[1, 'عادي'], [1.15, 'كبير'], [1.3, 'كبير جدًا']];
    root.append(card('المظهر',
      h('div', { class: 'lbl' }, 'الألوان'), h('div', { class: 'segs2' }, themes.map(([k, l]) => h('button', { class: s.theme === k ? 'on' : '', onclick: async () => { s.theme = k; applyPrefs(); await saveSettings(); render(); } }, l))),
      h('div', { class: 'lbl' }, 'حجم الخط في البرنامج'), h('div', { class: 'segs2' }, scales.map(([k, l]) => h('button', { class: s.fontScale === k ? 'on' : '', onclick: async () => { s.fontScale = k; applyPrefs(); await saveSettings(); render(); } }, l))),
      field('خط المحضر', sel(s, 'reportFont', [['tajawal', 'واضح (تجوال)'], ['amiri', 'رسمي (أميري)']], { on: persist }))));
    root.append(card('ترقيم المحاضر والتاريخ',
      field('نوع التقويم', sel(s, 'calendar', [['gregorian', 'ميلادي'], ['hijri', 'هجري']], { on: () => { persist(); } })),
      field('رقم أول محضر في السنة', tx(s, 'startNo', { type: 'number', mode: 'numeric', on: persist }), 'مثال: ابدأ من 1 فيصبح الرقم 001/' + (S.settings.calendar === 'hijri' ? '1448' : new Date().getFullYear()))));
    const pend = Backup.pending(), lb = S.settings.lastBackup;
    root.append(card('النسخ الاحتياطي',
      h('p', { class: 'mut' }, 'بياناتك محفوظة في هذا الجهاز وفي هذا المتصفح فقط. ' + (lb ? 'آخر نسخة: ' + fmtDate(lb) + ' (قبل ' + Backup.age() + ' يومًا).' : 'لم تأخذ نسخة بعد.') + (pend ? ' لديك ' + pend + ' تعديل لم يُحفظ بعد.' : '')),
      Backup.due() ? h('div', { class: 'warn' }, 'حان وقت نسخة احتياطية جديدة.') : null,
      h('button', { class: 'btn pri block', onclick: async () => { await Backup.quickSave(true); render(); } }, icon('share', 18), ' حفظ نسخة احتياطية الآن'),
      h('small', { class: 'bhint' }, 'تظهر نافذة المشاركة: اختر «حفظ في الملفات» ثم iCloud Drive، فتبقى النسخة عندك ولو تغيّر المتصفح أو الجوال. وللنقل إلى متصفح آخر افتح البرنامج فيه واختر «استعادة من ملف».'),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn ghost', onclick: () => Backup.quickSave(false) }, 'نسخة بدون صور'), h('button', { class: 'btn ghost', onclick: async () => { await Backup.restoreFile(); render(); } }, 'استعادة من ملف'))));
    const cl = S.settings.cloud || {};
    root.append(card('المزامنة السحابية (اختيارية)',
      !Cloud.available()
        ? [h('p', { class: 'mut' }, 'غير مفعّلة حاليًا. تحتاج معرّف عميل Google يضعه مسؤول البرنامج مرة واحدة، فتظهر عندها أزرار الربط.'), field('معرّف عميل Google (للمسؤول)', tx(s, 'googleClientId', { ph: 'xxxx.apps.googleusercontent.com', on: persist }))]
        : !Cloud.active()
          ? [h('p', { class: 'mut' }, 'تنقل بياناتك بين الجوالات والمتصفحات عبر نسخة مشفّرة في حسابك على Google Drive. اختيارية، والبرنامج يعمل بدونها.'), h('button', { class: 'btn pri block', onclick: () => Cloud.connectSheet(render) }, 'ربط Google Drive')]
          : [h('p', { class: 'mut' }, Cloud.statusText() || 'مفعّلة'),
             h('div', { class: 'btnrow' }, h('button', { class: 'btn pri', onclick: async () => { if (Cloud.ready()) { await Cloud.sync(true); render(); } else Cloud.connectSheet(render); } }, Cloud.ready() ? 'مزامنة الآن' : 'استئناف'), h('button', { class: 'btn ghost', onclick: () => Cloud.disconnect(render) }, 'إيقاف')),
             h('button', { class: 'btn danger ghost block', onclick: () => Cloud.deleteRemote(render) }, 'حذف النسخة السحابية')]));
    root.append(card('عن البرنامج', h('p', { class: 'mut' }, 'مساعد العمدة — الإصدار التجريبي 1.0'), h('button', { class: 'btn danger ghost block', onclick: resetAll }, 'إعادة ضبط البرنامج (حذف كل البيانات)')));
  }
  function signSheet() {
    const sh = openSheet('وقّع بإصبعك'); const p = sigPad(); sh.body.append(p.el);
    sh.foot.append(h('button', { class: 'btn ghost', onclick: sh.close }, 'إلغاء'), h('button', { class: 'btn pri', onclick: async () => { if (p.isEmpty()) { toast('وقّع داخل المربع أولًا'); return; } S.settings.sig = p.data(); await saveSettings(); sh.close(); render(); toast('تم حفظ التوقيع'); } }, 'حفظ التوقيع'));
  }
  function pinSheet() {
    const o = { cur: '', n1: '', n2: '' }, sh = openSheet('تغيير رمز الدخول'), err = h('div', { class: 'err hidden' });
    sh.body.append(field('الرمز الحالي', tx(o, 'cur', { type: 'password', mode: 'numeric', ml: 6 })), field('الرمز الجديد (6 أرقام)', tx(o, 'n1', { type: 'password', mode: 'numeric', ml: 6 })), field('أعد كتابة الرمز الجديد', tx(o, 'n2', { type: 'password', mode: 'numeric', ml: 6 })), err);
    sh.foot.append(h('button', { class: 'btn ghost', onclick: sh.close }, 'إلغاء'), h('button', { class: 'btn pri', onclick: async () => {
      const m = hashPin(cleanNum(o.cur)) !== S.settings.pin ? 'الرمز الحالي غير صحيح' : !/^\d{6}$/.test(cleanNum(o.n1)) ? 'الرمز الجديد لازم يكون 6 أرقام' : cleanNum(o.n1) !== cleanNum(o.n2) ? 'الرمزان الجديدان غير متطابقين' : '';
      if (m) { err.textContent = m; err.classList.remove('hidden'); return; }
      S.settings.pin = hashPin(cleanNum(o.n1)); await saveSettings(); sh.close(); render(); toast('تم تغيير الرمز'); } }, 'حفظ'));
  }

  return { build, render };
})();
