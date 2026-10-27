// ============ المزامنة السحابية الاختيارية مع Google Drive (مشفّرة داخل الجوال) ============
// تُحفظ نسخة واحدة مشفّرة (AES-256) في مجلد التطبيق المخفي داخل Drive الخاص بالعمدة.
// كلمة السر لا تُحفظ ولا تُرسل، وتُطلب مرة في كل جلسة.
const Cloud = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata', FILE = 'mayor-sync.enc';
  const cfg = () => S.settings.cloud || (S.settings.cloud = { on: false, withImages: false, lastSync: 0, fileId: '' });
  const clientId = () => String(S.settings.googleClientId || (window.CLOUD_CONFIG || {}).googleClientId || '').trim();
  const available = () => !!clientId();
  let token = null, tokenExp = 0, pass = '', syncing = false, timer = null, gsiP = null, stale = false, lastErr = '';

  // ---- تشفير ----
  const toB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = b => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  async function key(pw, salt) {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const pipe = async (u8, S_) => { const w = S_.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(S_.readable).arrayBuffer()); };
  async function seal(pw, obj) {
    let raw = new TextEncoder().encode(JSON.stringify(obj)), z = 0;
    try { if (window.CompressionStream) { raw = await pipe(raw, new CompressionStream('gzip')); z = 1; } } catch (e) { z = 0; raw = new TextEncoder().encode(JSON.stringify(obj)); }
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), k = await key(pw, salt);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, raw));
    return JSON.stringify({ v: 1, z, s: toB64(salt), i: toB64(iv), d: toB64(ct) });
  }
  async function unseal(pw, text) {
    const o = JSON.parse(text), k = await key(pw, fromB64(o.s)); let raw;
    try { raw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(o.i) }, k, fromB64(o.d))); } catch (e) { throw new Error('badpass'); }
    if (o.z) raw = await pipe(raw, new DecompressionStream('gzip'));
    return JSON.parse(new TextDecoder().decode(raw));
  }

  // ---- تسجيل الدخول (Google Identity Services) ----
  function loadGsi() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gsiP) return gsiP;
    gsiP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => res(); s.onerror = () => { gsiP = null; rej(new Error('offline')); }; document.head.append(s); });
    return gsiP;
  }
  async function getToken() {
    if (token && Date.now() < tokenExp) return token;
    await loadGsi();
    return new Promise((res, rej) => {
      const cl = google.accounts.oauth2.initTokenClient({ client_id: clientId(), scope: SCOPE,
        callback: r => { if (r.error) { rej(new Error(r.error)); return; } token = r.access_token; tokenExp = Date.now() + ((r.expires_in || 3600) - 120) * 1000; res(token); },
        error_callback: e => rej(new Error((e && e.type) || 'popup')) });
      cl.requestAccessToken({ prompt: cfg().on ? '' : 'consent' });
    });
  }

  // ---- Drive ----
  async function drive(path, opt, tk) {
    const r = await fetch('https://www.googleapis.com' + path, { ...(opt || {}), headers: { Authorization: 'Bearer ' + tk, ...((opt && opt.headers) || {}) } });
    if (r.status === 401) { token = null; throw new Error('auth'); }
    if (!r.ok) throw new Error('http' + r.status);
    return r;
  }
  async function find(tk) { const j = await (await drive('/drive/v3/files?spaces=appDataFolder&fields=files(id,modifiedTime)&q=' + encodeURIComponent("name='" + FILE + "'"), {}, tk)).json(); return (j.files || [])[0] || null; }
  const download = async (id, tk) => (await drive('/drive/v3/files/' + id + '?alt=media', {}, tk)).text();
  async function upload(text, id, tk) {
    if (id) { await drive('/upload/drive/v3/files/' + id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text }, tk); return id; }
    const bd = 'mayorbd' + Date.now();
    const body = '--' + bd + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: FILE, parents: ['appDataFolder'] }) + '\r\n--' + bd + '\r\nContent-Type: application/json\r\n\r\n' + text + '\r\n--' + bd + '--';
    const r = await drive('/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + bd }, body }, tk);
    return (await r.json()).id;
  }

  // ---- المزامنة: نزّل ← ادمج ← ارفع ----
  async function sync(manual) {
    if (syncing) return false; syncing = true;
    try {
      const c = cfg(); if (!pass) throw new Error('nopass');
      const tk = await getToken();
      const f = await find(tk); let r = { added: 0, updated: 0, removed: 0 };
      if (f) { const remote = await unseal(pass, await download(f.id, tk)); r = await Backup.merge(remote); }
      const changed = r.added + r.updated + r.removed > 0;
      if (!f || changed || Backup.pending(c.lastSync) > 0 || manual === 'force') c.fileId = await upload(await seal(pass, await Backup.snapshot(c.withImages)), f && f.id, tk);
      c.lastSync = Date.now(); await saveSettings(); stale = false; lastErr = '';
      if (changed) Backup.refreshViews();
      if (manual) toast('تمت المزامنة' + (changed ? ': ' + (r.added + r.updated) + ' جديد/محدّث' + (r.removed ? '، ' + r.removed + ' محذوف' : '') : ''));
      return true;
    } catch (e) {
      lastErr = e.message; stale = true;
      if (manual) toast(e.message === 'badpass' ? 'كلمة السر غير صحيحة' : e.message === 'offline' ? 'لا يوجد اتصال بالإنترنت' : e.message === 'nopass' ? 'أدخل كلمة السر أولًا' : 'تعذرت المزامنة (' + e.message + ')', 5000);
      return false;
    } finally { syncing = false; }
  }
  // تُستدعى عند أي تعديل: مزامنة هادئة بعد 25 ثانية إن كانت الجلسة مفعّلة
  function touch() {
    const c = S.settings.cloud; if (!c || !c.on || syncing) return;
    clearTimeout(timer); timer = setTimeout(() => { if (token && Date.now() < tokenExp && pass) sync(false); else stale = true; }, 25000);
  }

  // ---- الواجهة ----
  function connectSheet(after) {
    const c = cfg(), o = { pw: '', pw2: '', withImages: !!c.withImages }, err = h('div', { class: 'err hidden' });
    const sh = openSheet(c.on ? 'استئناف المزامنة' : 'ربط Google Drive', { tall: true });
    loadGsi().catch(() => { });
    const fail = m => { err.textContent = m; err.classList.remove('hidden'); };
    sh.body.append(
      h('p', { class: 'mut' }, 'تُحفظ نسخة مشفّرة من بياناتك في مجلد مخفي داخل حساب Google الخاص بك، ولا يستطيع Google ولا غيره قراءتها. لا يرى البرنامج ملفات Drive الأخرى.'),
      field('كلمة سر التشفير (6 أحرف فأكثر)', tx(o, 'pw', { type: 'password' }), 'اكتبها في ورقة. إن نسيتها ضاعت النسخة السحابية، وتبقى النسخة الاحتياطية بالملف.'),
      c.on ? null : field('أعد كتابة كلمة السر', tx(o, 'pw2', { type: 'password' }), 'إن كانت لديك نسخة سحابية سابقة فاكتب كلمة سرها نفسها في الخانتين'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o.withImages, onchange: e => { o.withImages = e.target.checked; } }), ' مزامنة الصور أيضًا (أثقل وتحتاج إنترنتًا أقوى)'), err);
    sh.foot.append(h('button', { class: 'btn ghost', onclick: sh.close }, 'إلغاء'), h('button', { class: 'btn pri', onclick: async (ev) => {
      err.classList.add('hidden');
      if ((o.pw || '').length < 6) { fail('كلمة السر 6 أحرف على الأقل'); return; }
      if (!c.on && o.pw !== o.pw2) { fail('كلمتا السر غير متطابقتين'); return; }
      const b = ev.currentTarget; b.disabled = true; b.textContent = 'جارٍ الاتصال…';
      try {
        pass = o.pw; c.withImages = o.withImages;
        const tk = await getToken(); const f = await find(tk);
        if (f) { try { await unseal(pass, await download(f.id, tk)); } catch (e) { pass = ''; if (e.message === 'badpass') { fail('كلمة السر لا تطابق النسخة السحابية الموجودة'); b.disabled = false; b.textContent = 'ربط'; return; } throw e; } }
        c.on = true; await saveSettings();
        const ok = await sync('force'); if (ok) { sh.close(); after && after(); } else { b.disabled = false; b.textContent = 'ربط'; fail(lastErr === 'offline' ? 'لا يوجد اتصال' : 'تعذرت المزامنة، أعد المحاولة'); }
      } catch (e) { pass = ''; b.disabled = false; b.textContent = 'ربط'; fail(e.message === 'offline' ? 'لا يوجد اتصال بالإنترنت' : e.message === 'access_denied' ? 'لم تمنح الإذن في نافذة Google' : e.message === 'popup_closed' || e.message === 'popup' ? 'أُغلقت نافذة Google قبل إكمال الربط' : 'تعذر الربط (' + e.message + ')'); }
    } }, c.on ? 'استئناف' : 'ربط'));
  }
  async function disconnect(after) {
    if (!(await confirmBox('إيقاف المزامنة على هذا الجهاز؟ تبقى النسخة السحابية في حسابك ولا تُحذف.', 'إيقاف', true))) return;
    const c = cfg(); c.on = false; token = null; pass = ''; await saveSettings(); after && after(); toast('أُوقفت المزامنة');
  }
  async function deleteRemote(after) {
    if (!(await confirmBox('حذف النسخة السحابية نهائيًا من حسابك؟ بيانات الجوال لا تتأثر.', 'حذف', true))) return;
    try { const tk = await getToken(), f = await find(tk); if (f) await drive('/drive/v3/files/' + f.id, { method: 'DELETE' }, tk); const c = cfg(); c.on = false; c.fileId = ''; pass = ''; await saveSettings(); after && after(); toast('حُذفت النسخة السحابية'); }
    catch (e) { toast('تعذر الحذف (' + e.message + ')'); }
  }
  const active = () => !!(S.settings.cloud && S.settings.cloud.on);
  const ready = () => !!(pass && token && Date.now() < tokenExp);
  function statusText() {
    const c = S.settings.cloud; if (!c || !c.on) return '';
    if (!ready()) return 'المزامنة السحابية متوقفة مؤقتًا. اضغط لاستئنافها';
    return 'مزامنة Google Drive: ' + (c.lastSync ? 'آخر مزامنة ' + fmtTime(c.lastSync) : 'لم تتم بعد') + (stale ? ' (معلّقة)' : '');
  }
  return { available, active, ready, touch, sync, connectSheet, disconnect, deleteRemote, statusText, clientId, _seal: seal, _unseal: unseal };
})();
