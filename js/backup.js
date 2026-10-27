// ============ النسخ الاحتياطي بالملف + الدمج (مشترك مع المزامنة السحابية) ============
const Backup = (() => {
  const STORES = ['houses', 'requests', 'reports', 'bounds'];
  const ver = r => (r && (r.updated || r.created)) || 0;
  const hasData = () => STORES.some(k => S[k].length);
  const age = () => { const t = S.settings.lastBackup || S.settings.firstUse; return t ? daysSince(t) : 0; };
  // عدد السجلات المتغيّرة بعد آخر نسخة
  function pending(since) {
    const lb = since === undefined ? (S.settings.lastBackup || 0) : since; let n = 0;
    STORES.forEach(k => S[k].forEach(r => { if (ver(r) > lb) n++; }));
    Object.values(S.tomb || {}).forEach(t => { if (t > lb) n++; });
    return n;
  }
  const due = () => { if (!hasData()) return false; const p = pending(); return p >= 10 || (age() >= 7 && (p > 0 || !S.settings.lastBackup)); };

  async function snapshot(withImages) {
    const st = { ...S.settings }; delete st.pin; delete st.cloud; delete st.googleClientId;
    return { app: 'mayor-app', version: 2, exportedAt: new Date().toISOString(), withImages: !!withImages, settings: st, houses: S.houses, requests: S.requests, reports: S.reports, bounds: S.bounds, tomb: S.tomb || {}, images: withImages ? await DB.all('images') : [] };
  }
  const mark = async () => { S.settings.lastBackup = Date.now(); await saveSettings(); App.updateBanner(); };

  // حفظ بلمسة واحدة: نافذة المشاركة ← «حفظ في الملفات» / iCloud / واتساب
  async function quickSave(withImages = true) {
    try {
      const data = await snapshot(withImages), blob = new Blob([JSON.stringify(data)], { type: 'application/json' }), name = 'mayor-backup-' + todayISO() + '.json';
      const f = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        try { await navigator.share({ files: [f], title: 'نسخة احتياطية - عمدة الحي' }); await mark(); toast('تم حفظ النسخة. اختر «حفظ في الملفات» لتبقى عندك'); return true; }
        catch (e) { if (e && e.name === 'AbortError') { toast('أُلغي حفظ النسخة'); return false; } }
      }
      downloadBlob(blob, name); await mark(); toast('تم تنزيل ملف النسخة الاحتياطية'); return true;
    } catch (e) { console.error(e); toast('تعذر إنشاء النسخة الاحتياطية'); return false; }
  }
  async function downloadOnly(withImages) {
    try { const data = await snapshot(withImages); downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'mayor-backup-' + todayISO() + '.json'); await mark(); toast('تم تجهيز النسخة الاحتياطية'); } catch (e) { console.error(e); toast('تعذر إنشاء النسخة الاحتياطية'); }
  }

  // دمج نسخة: الأحدث تعديلًا يفوز، والحذف ينتقل بين الأجهزة
  async function merge(j, o = {}) {
    const r = { added: 0, updated: 0, removed: 0 };
    S.tomb = S.tomb || {};
    for (const [k, ts] of Object.entries(j.tomb || {})) if (!(S.tomb[k] >= ts)) S.tomb[k] = ts;
    for (const store of STORES) {
      const arr = S[store];
      for (const rec of j[store] || []) {
        const t = S.tomb[store + ':' + rec.id]; if (t && t >= ver(rec)) continue;
        const i = arr.findIndex(x => x.id === rec.id);
        if (i < 0) { await DB.put(store, rec); arr.push(rec); r.added++; }
        else if (ver(rec) > ver(arr[i]) || (o.force && ver(rec) >= ver(arr[i]))) { await DB.put(store, rec); arr[i] = rec; r.updated++; }
      }
      for (const loc of arr.slice()) { const t = S.tomb[store + ':' + loc.id]; if (t && t >= ver(loc)) { await DB.del(store, loc.id); arr.splice(arr.indexOf(loc), 1); r.removed++; } }
    }
    await DB.setKV('tomb', S.tomb);
    for (const im of j.images || []) { if (!(await DB.get('images', im.id))) await DB.put('images', im); }
    const st = j.settings || {};
    if (o.fullSettings || !S.settings.wizardDone) { const keep = S.settings.pin, cl = S.settings.cloud, gid = S.settings.googleClientId; Object.assign(S.settings, st, { pin: keep, cloud: cl, googleClientId: gid, wizardDone: true }); }
    else {
      ['mayorName', 'district', 'center', 'region', 'logo', 'sig'].forEach(k => { if (!S.settings[k] && st[k]) S.settings[k] = st[k]; });
      S.settings.tags = [...new Set([...(S.settings.tags || []), ...(st.tags || [])])];
    }
    await saveSettings(); return r;
  }
  function refreshViews() { applyPrefs(); MapUI.refresh(); MapUI.renderBounds(); App.go(S.tab); App.updateBanner(); }

  async function restoreFile() {
    const f = await pickFile('.json,application/json'); if (!f[0]) return;
    try {
      const j = JSON.parse(await f[0].text()); if (j.app !== 'mayor-app') { toast('هذا الملف ليس نسخة احتياطية من البرنامج'); return; }
      const cnt = (j.houses || []).length + ' بيت، ' + (j.requests || []).length + ' طلب، ' + (j.reports || []).length + ' محضر';
      if (!(await confirmBox('سيتم دمج النسخة (' + cnt + ') مع بياناتك الحالية، ويُعتمد الأحدث تعديلًا لكل سجل. المتابعة؟', 'استعادة'))) return;
      const r = await merge(j, { fullSettings: true, force: true }); S.settings.lastBackup = Date.now(); await saveSettings();
      refreshViews(); MapUI.fitAll(); toast('تمت الاستعادة: ' + r.added + ' جديد، ' + r.updated + ' محدّث');
    } catch (e) { console.error(e); toast('تعذر قراءة الملف. تأكد أنه نسخة احتياطية سليمة'); }
  }
  return { snapshot, quickSave, downloadOnly, merge, restoreFile, refreshViews, pending, due, age, hasData, ver };
})();
