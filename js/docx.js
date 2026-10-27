// ============ توليد ملف Word (docx) حقيقي من المحضر ============
const Docx = (() => {
  const esc = t => String(t == null ? '' : t).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
  const FONTS = { tajawal: 'Arial', amiri: 'Traditional Arabic' };
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

  const run = (text, o) => {
    const sz = o.sz, f = o.font;
    return `<w:r><w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/>${o.b ? '<w:b/><w:bCs/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${o.ltr ? '' : '<w:rtl/>'}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  };
  // jc في الفقرات العربية: بدون قيمة = يمين، right = يسار (سلوك Word في الاتجاه من اليمين لليسار)
  const para = (inner, o = {}) => `<w:p><w:pPr><w:bidi/><w:spacing w:before="${o.before || 0}" w:after="${o.after == null ? 0 : o.after}"${o.line ? ` w:line="${o.line}" w:lineRule="auto"` : ''}/>${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}</w:pPr>${inner}</w:p>`;

  async function imgInfo(dataUrl) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height;
        c.getContext('2d').drawImage(im, 0, 0);
        const b64 = c.toDataURL('image/png').split(',')[1]; const bin = atob(b64); const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        res({ bytes: u, w: c.width, h: c.height });
      };
      im.onerror = () => rej(new Error('img'));
      im.src = dataUrl;
    });
  }
  const drawing = (rid, w, h, id) => {
    const cx = Math.round(w * 9525), cy = Math.round(h * 9525);
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="img${id}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  };
  const fit = (w, h, maxW, maxH) => { const k = Math.min(maxW / w, maxH / h, 1); return [Math.round(w * k), Math.round(h * k)]; };
  const cell = (w, inner) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${inner || '<w:p/>'}</w:tc>`;

  function pack(doc, font, sz, media, rels) {
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="ar-SA" w:bidi="ar-SA"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
    const relXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSt" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${media.map((m, i) => `<Relationship Id="${rels[i]}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join('')}</Relationships>`;
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
    const root = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

    const zip = new JSZip();
    zip.file('[Content_Types].xml', ct); zip.file('_rels/.rels', root); zip.file('word/document.xml', doc); zip.file('word/styles.xml', styles); zip.file('word/_rels/document.xml.rels', relXml);
    media.forEach(m => zip.file('word/media/' + m.name, m.bytes));
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  async function build(r, s, pt) {
    const font = FONTS[s.reportFont] || 'Arial';
    const sz = Math.round(pt * 2), szH = 24, szT = Math.round(pt * 2) + 4;
    const suffix = s.calendar === 'hijri' ? ' هـ' : ' م';
    const rels = []; const media = [];
    let logoXml = '';
    if (s.logo) { try { const i = await imgInfo(s.logo); const [w, hh] = fit(i.w, i.h, 110, 100); media.push({ name: 'logo.png', bytes: i.bytes }); rels.push('rIdLogo'); logoXml = para(drawing('rIdLogo', w, hh, 1), { jc: 'center' }); } catch (e) { } }
    let sigXml = '';
    if (r.useSig !== false && s.sig) { try { const i = await imgInfo(s.sig); const [w, hh] = fit(i.w, i.h, 170, 70); media.push({ name: 'sig.png', bytes: i.bytes }); rels.push('rIdSig'); sigXml = para(drawing('rIdSig', w, hh, 2), { jc: 'right', before: 60 }); } catch (e) { } }

    const rightLines = ['المملكة العربية السعودية', 'وزارة الداخلية', 'الأمن العام', s.region, s.center].filter(Boolean)
      .map(t => para(run(t, { sz: szH, font, b: true }), { jc: 'center', after: 20 })).join('');
    const kv = (k, v) => para(run(k + ': ', { sz: szH, font, b: true }) + run(v, { sz: szH, font }), { after: 40 });
    const leftLines = kv('التاريخ', fmtISO(r.date, s.calendar) + suffix) + kv('الرقم', r.no || '') + kv('الموضوع', r.subject || '') + kv('المشفعات', r.attachments || 'لا يوجد');
    const header = `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="9906" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="3300"/><w:gridCol w:w="3306"/><w:gridCol w:w="3300"/></w:tblGrid><w:tr>${cell(3300, rightLines)}${cell(3306, logoXml)}${cell(3300, leftLines)}</w:tr></w:tbl>`;
    const title = para(run(Reports.titleOf(r), { sz: szT, font, b: true }), { jc: 'center', before: 240, after: 200 });
    const body = String(r.body || '').split('\n').filter(x => x.trim()).map(t => para(run(t, { sz, font }), { jc: 'both', after: 120, line: 360 })).join('');
    const sigBlock = para(run('عمدة حي ' + (s.district || '.....'), { sz, font, b: true }), { jc: 'right', before: 240 }) + para(run(s.mayorName || '.....', { sz, font }), { jc: 'right' }) + sigXml;

    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${header}${title}${body}${sigBlock}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="1000" w:bottom="850" w:left="1000" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="708"/><w:bidi/></w:sectPr></w:body></w:document>`;
    return pack(doc, font, sz, media, rels);
  }

  // ---------- تقرير الحي (خريطة + جدول) ----------
  async function buildDistrict(d, s) {
    const font = FONTS[s.reportFont] || 'Arial', sz = 22, szS = 18, szH = 24, szT = 32;
    const rels = [], media = [];
    let logoXml = '';
    if (s.logo) { try { const i = await imgInfo(s.logo); const [w, hh] = fit(i.w, i.h, 110, 100); media.push({ name: 'logo.png', bytes: i.bytes }); rels.push('rIdLogo'); logoXml = para(drawing('rIdLogo', w, hh, 1), { jc: 'center' }); } catch (e) { } }
    let sigXml = '';
    if (s.sig) { try { const i = await imgInfo(s.sig); const [w, hh] = fit(i.w, i.h, 170, 70); media.push({ name: 'sig.png', bytes: i.bytes }); rels.push('rIdSig'); sigXml = para(drawing('rIdSig', w, hh, 2), { jc: 'right', before: 60 }); } catch (e) { } }
    let mapXml = '';
    if (d.map) {
      const bin = atob(d.map.url.split(',')[1]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const [w, hh] = fit(d.map.w, d.map.h, 650, 400); media.push({ name: 'map.jpg', bytes: u }); rels.push('rIdMap'); mapXml = para(drawing('rIdMap', w, hh, 3), { jc: 'center', before: 80 });
    }
    const rightLines = ['المملكة العربية السعودية', 'وزارة الداخلية', 'الأمن العام', s.region, s.center].filter(Boolean).map(t => para(run(t, { sz: szH, font, b: true }), { jc: 'center', after: 20 })).join('');
    const kv = (k, v) => para(run(k + ': ', { sz: szH, font, b: true }) + run(v, { sz: szH, font }), { after: 40 });
    const leftLines = kv('التاريخ', d.dateStr) + kv('الموضوع', d.subject) + (d.to ? kv('إلى', d.to) : '') + kv('المشفعات', 'خريطة وجدول بيانات');
    const header = `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="9906" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="3300"/><w:gridCol w:w="3306"/><w:gridCol w:w="3300"/></w:tblGrid><w:tr>${cell(3300, rightLines)}${cell(3306, logoXml)}${cell(3300, leftLines)}</w:tr></w:tbl>`;
    const sm = d.summary;
    const title = para(run('تقرير عن وضع حي ' + d.name, { sz: szT, font, b: true }), { jc: 'center', before: 200, after: 120 });
    const sumP = para(run('إجمالي البيوت: ' + sm.total, { sz, font, b: true }) + run('   •   ', { sz, font }) + run('عليها ملاحظات: ' + sm.notes, { sz, font, b: true, color: 'D92D3A' }) + run('   •   ', { sz, font }) + run('بيانات فقط: ' + sm.data, { sz, font, b: true, color: '1F9D55' }), { jc: 'center', after: 40 });
    const tagP = sm.tags.length ? para(run('الوسوم: ' + sm.tags.map(([t, c]) => t + ' (' + c + ')').join(' • '), { sz: szS, font }), { jc: 'center', after: 40 }) : '';
    const legend = d.map ? para(run('أرقام الدبابيس في الخريطة تطابق أرقام الجدول. الأحمر: عليها ملاحظات، الأخضر: بيانات فقط.', { sz: szS, font }), { jc: 'center', after: 120 }) : '';
    const W = d.personal ? [500, 2000, 1900, 1100, 1100, 3306] : [500, 2300, 1300, 1300, 4506];
    const heads = d.personal ? ['م', 'الموقع', 'المالك والتواصل', 'الحي', 'الوسوم', 'الملاحظات'] : ['م', 'الموقع', 'الحي', 'الوسوم', 'الملاحظات'];
    const tc = (w, inner, shade) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ''}<w:vAlign w:val="top"/></w:tcPr>${inner || '<w:p/>'}</w:tc>`;
    const P = (t, o = {}) => para(run(t, { sz: szS, font, b: o.b, color: o.color, ltr: o.ltr }), { jc: o.jc, after: 20 });
    const bd = '<w:top w:val="single" w:sz="4" w:space="0" w:color="555555"/><w:left w:val="single" w:sz="4" w:space="0" w:color="555555"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="555555"/><w:right w:val="single" w:sz="4" w:space="0" w:color="555555"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="555555"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="555555"/>';
    const trs = [`<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${heads.map((t, i) => tc(W[i], P(t, { b: true, jc: 'center' }), 'E5E7EB')).join('')}</w:tr>`];
    d.rows.forEach(r => {
      const c = [tc(W[0], P(String(r.n), { b: true, jc: 'center', color: r.notes ? 'D92D3A' : '1F9D55' })), tc(W[1], P(r.addr || '—') + P(r.coords, { color: '555555', ltr: true }))];
      let k = 2; if (d.personal) { c.push(tc(W[k++], P(r.owner || '—') + (r.nid ? P(r.nid, { color: '555555', ltr: true }) : '') + (r.phone ? P(r.phone, { color: '555555', ltr: true }) : ''))); }
      c.push(tc(W[k++], P(r.district || '—')), tc(W[k++], P(r.tags || '—')), tc(W[k++], P(r.notes ? r.note : 'بيانات فقط', { color: r.notes ? null : '1F9D55' })));
      trs.push(`<w:tr><w:trPr><w:cantSplit/></w:trPr>${c.join('')}</w:tr>`);
    });
    const table = `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="9906" w:type="dxa"/><w:tblBorders>${bd}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${W.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${trs.join('')}</w:tbl>`;
    const sigBlock = para(run('عمدة حي ' + (s.district || d.name || '.....'), { sz, font, b: true }), { jc: 'right', before: 320 }) + para(run(s.mayorName || '.....', { sz, font }), { jc: 'right' }) + sigXml;
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${header}${title}${sumP}${tagP}${mapXml}${legend}${table}${sigBlock}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="1000" w:bottom="850" w:left="1000" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="708"/><w:bidi/></w:sectPr></w:body></w:document>`;
    return pack(doc, font, sz, media, rels);
  }
  return { build, buildDistrict };
})();
