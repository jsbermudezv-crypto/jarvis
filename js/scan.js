/* =========================================================
   JARVIS — Escáner de mercado
   · Fotos de productos: lee el código de barras en el teléfono y busca el producto
     en Open Food Facts (base mundial, gratuita). Lo que no encuentre, lo nombras una vez
     y JARVIS lo recuerda por su código.
   · Productos sin código (frutas, verduras, carnes): foto + nombre con sugerencias.
   · Factura: lee el texto de la foto (beta, necesita internet la primera vez) o la pasas a mano.
   ========================================================= */
'use strict';

const SC = () => (S.pscan = S.pscan || { mode:'products', items:[], receipt:null });
const photoKey = name => 'jarvis-photo:' + BN(name);
function savePhoto(name, dataURL) { if (!dataURL) return; try { localStorage.setItem(photoKey(name), dataURL); } catch { /* sin espacio: se omite la foto */ } }
function getPhoto(name) { try { return localStorage.getItem(photoKey(name)); } catch { return null; } }

/* ---------- utilidades de imagen ---------- */
async function thumbOf(file, max = 220) {
  const img = await (window.createImageBitmap ? createImageBitmap(file).catch(() => null) : null) || await new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { res(i); setTimeout(() => URL.revokeObjectURL(u), 1000); }; i.onerror = rej; i.src = u; });
  const W = img.width || img.naturalWidth, H = img.height || img.naturalHeight, s = Math.min(1, max / Math.max(W, H));
  const c = document.createElement('canvas'); c.width = Math.round(W * s); c.height = Math.round(H * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .72);
}

/* ---------- productos aprendidos y Open Food Facts ---------- */
const OFF_CAT = [[/dair|milk|yogurt|yoghurt|chees|leche|lacte|queso|yogur/, 'Dairy'], [/meat|poultry|chicken|beef|pork|sausage|ham|fish|seafood|tuna|sardin|egg|carne|pollo|atun|huevo|embutid/, 'Proteins'],
  [/beverage|drink|water|soda|juice|bebida|jugo|agua|gaseosa|refresco|coffee|cafe|tea\b|infusion/, 'Drinks'], [/snack|chip|biscuit|cookie|chocolate|candy|confection|galleta|dulce|golosina|crisps|sweet/, 'Snacks'],
  [/cereal|bread|pasta|rice|flour|oat|arroz|harina|avena|pan\b|arepa|grain/, 'Grains'], [/legume|bean|lentil|chickpea|frijol|lenteja|garbanzo/, 'Proteins'],
  [/fruit|fruta/, 'Fruits'], [/vegetable|verdura|hortaliza/, 'Vegetables'], [/frozen|congelad/, 'Frozen'], [/oil|aceite|butter|mantequilla|margarin/, 'Fats'],
  [/condiment|sauce|salsa|spice|especia|sugar|azucar|salt|sal\b|seasoning|mayonnaise|ketchup|vinegar/, 'Condiments']];
function catFromText(t) { const k = BN(t || ''); for (const [rx, c] of OFF_CAT) if (rx.test(k)) return c; const p = CATALOG.find(x => k.includes(BN(x.n))); if (p) return AISLE_CAT[p.aisle] || 'Other'; const f = matchFood(t || ''); return f ? (CAT_APP[f.cat] || 'Other') : 'Other'; }
function qtyFromText(q) {
  const m = String(q || '').toLowerCase().replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|ml|l|lt|cl|oz|un|und|unidades)?\b/);
  if (!m) return { qty:1, unit:'unidad' };
  const n = Number(m[1]), u = m[2] || 'unidad';
  if (u === 'kg') return { qty:n, unit:'kg' }; if (u === 'g' || u === 'gr') return { qty:n, unit:'g' };
  if (u === 'l' || u === 'lt') return { qty:n, unit:'l' }; if (u === 'ml') return { qty:n, unit:'ml' }; if (u === 'cl') return { qty:n * 10, unit:'ml' };
  return { qty:n, unit:'unidad' };
}
async function lookupBarcode(code) {
  const known = (B().barcodes || {})[code];
  if (known) return { ...known, src:'memoria' };
  if (!navigator.onLine) return null;
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_es,generic_name_es,brands,quantity,categories_tags,nutriments,nutriscore_grade`, { signal:ctrl.signal });
    if (!r.ok) return null;
    const j = await r.json(); if (j.status !== 1 || !j.product) return null;
    const p = j.product, base = (p.product_name_es || p.product_name || p.generic_name_es || '').trim();
    if (!base) return null;
    const brand = (p.brands || '').split(',')[0].trim();
    const name = brand && !BN(base).includes(BN(brand)) ? `${base} ${brand}` : base;
    const nu = p.nutriments || {};
    return { name:name.slice(0, 60), brand, size:p.quantity || '', cat:catFromText((p.categories_tags || []).join(' ') + ' ' + base), ...qtyFromText(p.quantity),
      nutri:p.nutriscore_grade && /^[a-e]$/.test(p.nutriscore_grade) ? p.nutriscore_grade : null,
      per100: nu['energy-kcal_100g'] != null ? { kcal:+nu['energy-kcal_100g'] || 0, p:+nu.proteins_100g || 0, c:+nu.carbohydrates_100g || 0, f:+nu.fat_100g || 0, fib:+nu.fiber_100g || 0 } : null, src:'Open Food Facts' };
  } catch { return null; } finally { clearTimeout(t); }
}
// Los productos escaneados con información nutricional se vuelven alimentos que JARVIS entiende al registrar comidas
function registerCustomFoods() {
  const cf = B().customFoods || {};
  Object.entries(cf).forEach(([id, f]) => {
    if (FOOD_BY_ID[id]) return;
    const food = { id, n:f.n, aliases:[f.n], por:'100 g', g:100, kcal:f.kcal, p:f.p, c:f.c, f:f.f, fib:f.fib || 0, cat:'Platos', tags:[] };
    FOODS.push(food); FOOD_BY_ID[id] = food; ALIAS_INDEX.push({ k:BN(f.n), f:food });
  });
  ALIAS_INDEX.sort((a, b) => b.k.length - a.k.length);
}

/* ---------- procesar fotos ---------- */
function newScanItem(extra) {
  const cat = extra.cat || 'Other';
  return { id:uid(), on:true, status:'reading', code:'', name:'', brand:'', size:'', qty:1, unit:'unidad', cat, loc:DEF_LOC[cat] || 'pantry',
    expires:dkey(addDays(new Date(), SHELF[cat] || 30)), expEst:true, photo:null, src:'', ...extra };
}
function applyFound(it, info) {
  Object.assign(it, { name:info.name, brand:info.brand || '', size:info.size || '', cat:info.cat || it.cat, qty:info.qty || 1, unit:info.unit || 'unidad', nutri:info.nutri || null, per100:info.per100 || null, src:info.src, status:'found' });
  it.loc = info.loc || DEF_LOC[it.cat] || 'pantry';
  it.expires = dkey(addDays(new Date(), SHELF[it.cat] || 30)); it.expEst = true;
}
let _scanQueue = Promise.resolve();
addScanPhotos = async function (files) {
  const sc = SC(); S.mtab = 'scan'; if (location.hash !== '#market') location.hash = '#market';
  const list = [...files].slice(0, 12);
  if (sc.mode === 'receipt') return readReceipt(list);
  for (const f of list) {
    const it = newScanItem({}); sc.items.unshift(it);
    try { it.photo = await thumbOf(f); } catch {}
    refreshScan();
    _scanQueue = _scanQueue.then(async () => {
      let code = null; try { code = await JBarcode.decodeBlob(f); } catch {}
      if (!code) { it.status = 'nocode'; refreshScan(true); return; }
      it.code = code; it.status = 'lookup'; refreshScan();
      const info = await lookupBarcode(code);
      if (info) applyFound(it, info); else it.status = 'unknown';
      refreshScan(!info);
    });
  }
};
function addByCode(code) {
  code = String(code || '').replace(/\D/g, '');
  if (code.length === 12) code = '0' + code;
  if (![8, 13].includes(code.length) || !JBarcode.eanCheck(code.split('').map(Number))) return toast('Ese código no es válido. Revisa los números debajo de las barras.', true);
  const sc = SC(), it = newScanItem({ code, status:'lookup' }); sc.items.unshift(it); refreshScan();
  lookupBarcode(code).then(info => { if (info) applyFound(it, info); else it.status = 'unknown'; refreshScan(!info); });
}

/* ---------- factura ---------- */
function loadScript(src) { return new Promise((res, rej) => { if ([...document.scripts].some(s => s.src === src)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('offline')); document.head.appendChild(s); }); }
const STORE_RX = [[/\bd1\b|koba/i, 'D1'], [/\bara\b|jeronimo martins/i, 'Ara'], [/exito|éxito|almacenes exito/i, 'Éxito'], [/olimpica|olímpica|sao\b/i, 'Olímpica'], [/jumbo|cencosud/i, 'Jumbo'], [/carulla/i, 'Carulla'], [/makro/i, 'Makro'], [/metro\b/i, 'Metro'], [/isimo|ísimo/i, 'Ísimo']];
function parseReceipt(text) {
  const lines = String(text || '').split(/\n+/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let store = '', date = '', total = 0; const items = [];
  const SKIP = /(sub ?total|total|iva|impuesto|cambio|efectivo|tarjeta|datafono|nit\b|factura|resoluci|cajer|gracias|direcci|tel[eé]fono|fecha|hora|vuelto|descuento|ahorro|redondeo|base|pago|recibido|devuelta|consecutivo|caja\b)/i;
  lines.forEach(l => {
    if (!store) for (const [rx, s] of STORE_RX) if (rx.test(l)) { store = s; break; }
    const dm = l.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/); if (dm && !date) { const y = dm[3].length === 2 ? '20' + dm[3] : dm[3]; const d = `${y}-${pad(+dm[2])}-${pad(+dm[1])}`; if (!isNaN(parseKey(d))) date = d; }
    const pm = l.match(/^(.*?)[\s$]+(\d{1,3}(?:[.,]\d{3})+|\d{3,7})(?:[.,]\d{2})?\s*[A-Z*]?$/);
    if (!pm) return;
    const price = Number(pm[2].replace(/[.,]/g, ''));
    if (/total/i.test(l) && !/sub/i.test(l)) { total = Math.max(total, price); return; }
    if (SKIP.test(l) || price < 300 || price > 2000000) return;
    let name = pm[1].replace(/^[\d\s]{4,}/, '').replace(/^\d+\s*[xX*]\s*/, '').replace(/\b\d{6,}\b/g, '').replace(/[^\p{L}\d\s.,%/-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (name.length < 3) return;
    name = name.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase());
    items.push({ id:uid(), on:true, name:name.slice(0, 50), cost:price, cat:catFromText(name), qty:1, unit:'unidad' });
  });
  return { store, date, total, items };
}
async function readReceipt(files) {
  const sc = SC(); sc.receipt = { busy:true, prog:0, store:'', date:dkey(), items:[], total:0, err:'', photo:null };
  try { sc.receipt.photo = await thumbOf(files[0], 360); } catch {}
  refreshScan();
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    const worker = await Tesseract.createWorker('spa', 1, { logger:m => { if (m.status === 'recognizing text') { sc.receipt.prog = Math.round(m.progress * 100); const p = $('#rcProg'); if (p) p.textContent = `Leyendo factura… ${sc.receipt.prog}%`; } } });
    let text = '';
    for (const f of files) { const { data } = await worker.recognize(f); text += '\n' + data.text; }
    await worker.terminate();
    const r = parseReceipt(text);
    Object.assign(sc.receipt, { busy:false, store:r.store || myStores()[0], date:r.date && r.date <= dkey() ? r.date : dkey(), items:r.items, total:r.total });
    if (!r.items.length) { sc.receipt.err = 'No pude leer los productos de esa foto. Toma la factura completa, derecha y con buena luz, o escríbelos aquí abajo.'; sc.receipt.items = [{ id:uid(), on:true, name:'', cost:null, cat:'Other', qty:1, unit:'unidad' }]; }
  } catch (e) {
    Object.assign(sc.receipt, { busy:false, store:myStores()[0], items:[{ id:uid(), on:true, name:'', cost:null, cat:'Other', qty:1, unit:'unidad' }], err:navigator.onLine ? 'No pude leer la factura esta vez. Agrega los productos a mano abajo.' : 'Para leer facturas por foto necesitas internet la primera vez. Mientras tanto, agrégalos a mano.' });
  }
  refreshScan(true);
}

/* ---------- interfaz ---------- */
const UNITS = ['unidad', 'g', 'kg', 'ml', 'l', 'libra', 'paquete', 'bolsa', 'lata', 'caja'];
const ST_LABEL = { reading:'Leyendo código…', lookup:'Buscando producto…', found:'', unknown:'Producto nuevo: escribe el nombre', nocode:'Sin código: escribe qué es' };
function nameSuggestions() { return [...new Set([...CATALOG.map(p => p.n), ...FOODS.filter(f => !['Platos'].includes(f.cat)).map(f => f.n), ...pantryItems().map(i => i.name)])]; }
function scanItemCard(it) {
  const busy = it.status === 'reading' || it.status === 'lookup';
  return `<div class="sitem ${it.on ? '' : 'off'}" data-sid="${it.id}">
    <div class="sthumb">${it.photo ? `<img src="${it.photo}" alt="">` : '<span>📦</span>'}${busy ? '<i class="spin-dot"></i>' : ''}</div>
    <div class="sbody">
      <div class="stop">${it.code ? `<span class="tag plain mono" style="font-size:10px">${esc(it.code)}</span>` : ''}${it.src ? `<span class="tag measured" style="font-size:10px">${esc(it.src)}</span>` : ''}${it.nutri ? `<span class="nscore n${it.nutri}">Nutri-Score ${it.nutri.toUpperCase()}</span>` : ''}${ST_LABEL[it.status] ? `<span class="muted" style="font-size:12px">${ST_LABEL[it.status]}</span>` : ''}</div>
      <input class="input" data-sf="name" list="scanNames" value="${esc(it.name)}" placeholder="${it.status === 'nocode' ? 'Ej.: Tomate, Pechuga, Queso…' : 'Nombre del producto'}" maxlength="60" ${busy ? 'disabled' : ''}>
      <div class="srow2"><input class="input mono" data-sf="qty" inputmode="decimal" value="${it.qty}" aria-label="Cantidad"><select class="input" data-sf="unit" aria-label="Unidad">${UNITS.map(u => `<option ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
        <select class="input" data-sf="loc" aria-label="Dónde">${LOCS.map(([v, l]) => `<option value="${v}" ${it.loc === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="srow2"><select class="input" data-sf="cat" aria-label="Categoría">${CATS.map(c => `<option value="${c}" ${it.cat === c ? 'selected' : ''}>${catL(c)}</option>`).join('')}</select><input class="input mono" type="date" data-sf="expires" value="${it.expires}" aria-label="Usar antes de"></div>
    </div>
    <button class="icon-btn sm" data-sdel="${it.id}" aria-label="Quitar">×</button></div>`;
}
function receiptView(R) {
  const on = R.items.filter(i => i.on), tot = on.reduce((s, i) => s + (+i.cost || 0), 0);
  return `<section class="card" style="margin-top:14px">
    ${R.photo ? `<img src="${R.photo}" alt="Factura" style="max-height:140px;border-radius:12px;float:right;margin:0 0 8px 12px">` : ''}
    <div class="card-head"><h2>Factura</h2>${R.busy ? '' : `<span class="sub mono">${cop(tot)}${R.total ? ` / ${cop(R.total)}` : ''}</span>`}</div>
    ${R.busy ? `<div class="analyzing"><svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="#263447" stroke-width="2"/><g class="spin" style="transform-origin:16px 16px"><circle cx="16" cy="16" r="13" fill="none" stroke="#35D6F2" stroke-width="2" stroke-dasharray="18 64" stroke-linecap="round"/></g></svg><span id="rcProg">Preparando el lector de facturas… (la primera vez tarda un poco)</span></div>` : `
    ${R.err ? `<div class="banner" style="margin-bottom:12px;clear:both">${ic('info')}<div>${esc(R.err)}</div></div>` : ''}
    <div class="two" style="clear:both"><div class="field"><label for="rcStore">Tienda</label><select class="input" id="rcStore">${[...new Set([R.store, ...myStores(), ...STORES].filter(Boolean))].map(s => `<option ${R.store === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
      <div class="field"><label for="rcDate">Fecha</label><input class="input mono" type="date" id="rcDate" value="${R.date}" max="${dkey()}"></div></div>
    <div>${R.items.map(i => `<div class="srow ${i.on ? '' : 'done'}" data-rid="${i.id}" style="padding:8px 0"><input type="checkbox" data-rf="on" ${i.on ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--cyan)"><input class="input" data-rf="name" value="${esc(i.name)}" list="scanNames" style="flex:1;min-width:0"><input class="input mono" data-rf="cost" inputmode="numeric" value="${i.cost ?? ''}" placeholder="$" style="width:96px;text-align:right"></div>`).join('')}</div>
    <button class="btn sm" id="rcAddLine" style="margin-top:10px">${ic('plus')}Agregar renglón</button>
    <label class="check" style="margin-top:12px"><input type="checkbox" id="rcPantry" ${R.toPantry !== false ? 'checked' : ''} style="accent-color:var(--cyan);width:18px;height:18px"> Agregar también a la despensa</label>
    <div class="rv-actions"><button class="btn ghost" id="rcDiscard">Descartar</button><span style="flex:1"></span><button class="btn primary" id="rcSave" ${on.length ? '' : 'disabled'}>${ic('check')}Registrar compra (${on.length})</button></div>`}
  </section>`;
}
mScan = function () {
  const sc = SC(), ready = sc.items.filter(i => i.on && i.name.trim() && i.status !== 'reading' && i.status !== 'lookup');
  return `<datalist id="scanNames">${nameSuggestions().map(n => `<option value="${esc(n)}">`).join('')}</datalist>
  <section class="card tg-hero">
    <div class="seg" role="tablist" style="margin-bottom:14px;width:max-content"><button role="tab" aria-checked="${sc.mode === 'products'}" data-smode="products">📦 Productos</button><button role="tab" aria-checked="${sc.mode === 'receipt'}" data-smode="receipt">🧾 Factura</button></div>
    ${sc.mode === 'products' ? `
      <p class="muted" style="margin:0 0 14px;font-size:14px">Una foto por producto, con el <b style="color:var(--text)">código de barras</b> visible y de cerca. JARVIS lo lee aquí mismo y busca el producto. Para frutas, verduras o carnes sin código, toma la foto y escribe qué es.</p>
      <div class="scan-btns"><button class="scan-big primary" data-act="mk-camera">${ic('camera')}<b>Tomar foto</b><small>Un producto a la vez</small></button><button class="scan-big" data-act="mk-upload"><span style="font-size:22px">🖼️</span><b>Subir fotos</b><small>Varias de la galería</small></button></div>
      <div style="display:flex;gap:8px;margin-top:12px"><input class="input mono" id="codeIn" inputmode="numeric" maxlength="14" placeholder="o escribe el código"><button class="btn" id="codeGo">Buscar</button></div>`
    : `<p class="muted" style="margin:0 0 14px;font-size:14px">Toma la foto de la factura completa, derecha y con buena luz. JARVIS lee productos y precios para que sepas en qué se va tu plata. (Beta: la primera vez necesita internet para preparar el lector.)</p>
      <div class="scan-btns"><button class="scan-big primary" data-act="mk-camera">${ic('camera')}<b>Foto de la factura</b><small>Cámara</small></button><button class="scan-big" id="rcManual"><span style="font-size:22px">✍️</span><b>Pasarla a mano</b><small>Producto y precio</small></button></div>`}
  </section>
  ${sc.mode === 'receipt' && sc.receipt ? receiptView(sc.receipt) : ''}
  ${sc.mode === 'products' && sc.items.length ? `<section class="card" style="margin-top:14px" id="scanList"><div class="card-head"><h2>${sc.items.length} ${sc.items.length === 1 ? 'producto' : 'productos'}</h2><button class="btn sm ghost" id="scanClear">Borrar todo</button></div>
    ${sc.items.map(scanItemCard).join('')}
    <div class="rv-actions"><span style="flex:1"></span><button class="btn primary" id="scanSave2" ${ready.length ? '' : 'disabled'}>${ic('check')}Agregar ${ready.length} a la despensa</button></div></section>` : ''}
  ${sc.mode === 'products' ? `<section class="card" style="margin-top:14px"><div class="card-head"><h2>Agregar rápido</h2><span class="sub">Sin foto</span></div>
    <input class="input" id="mkq" placeholder="Busca: pollo, arroz, huevos…" autocomplete="off">
    <div id="mkRes" class="qgrid"></div></section>` : ''}`;
};
function quickResults(q) {
  const k = BN(q || '');
  const pool = k ? CATALOG.filter(p => BN(p.n + ' ' + p.aisle).includes(k)).slice(0, 16) : CATALOG.filter(p => ['huevos30','pechuga','arroz','frijol','lenteja','atun','arepa','papa-pastusa','tomate','cebolla-cab','banano','leche-desc','avena','queso-campesino','platano-verde','aguacate'].includes(p.id));
  return pool.map(p => `<button class="qbtn" data-mkadd2="${p.id}"><i class="hdot ${p.health}"></i><span><b>${esc(p.n)}</b><small>${esc(p.pres)}</small></span><em>+</em></button>`).join('') || `<p class="muted" style="font-size:13px;margin:0">No está en el catálogo. Toma una foto o usa Agregar en Despensa.</p>`;
}
function bindQuick() {
  const box = $('#mkRes'); if (!box) return;
  const draw = q => { box.innerHTML = quickResults(q);
    $$('[data-mkadd2]', box).forEach(b => b.addEventListener('click', async () => { const p = CATALOG_BY_ID[b.dataset.mkadd2], cat = AISLE_CAT[p.aisle] || 'Other', q2 = qtyFromText(p.pres);
      const unit = /libra/.test(p.pres) ? 'libra' : q2.unit, qty = /cubeta x 30/.test(p.pres) ? 30 : /x 12/.test(p.pres) ? 12 : /libra/.test(p.pres) ? 1 : q2.qty;
      await addToPantry([{ name:p.n, cat, qty, unit:/cubeta|bandeja x/.test(p.pres) ? 'unidad' : unit, loc:DEF_LOC[cat] || 'pantry', expires:dkey(addDays(new Date(), SHELF[cat] || 30)), expEst:true, opened:false, cost:null }], 'manual');
      b.classList.add('done'); b.querySelector('em').textContent = '✓'; toast(`${p.n} agregado a la despensa.`); })); };
  let t; $('#mkq').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => draw(e.target.value), 120); });
  draw('');
}
let _refT = null;
function refreshScan(focusEmpty) {
  if (currentView !== 'market' || S.mtab !== 'scan') return;
  clearTimeout(_refT);
  _refT = setTimeout(() => {
    const y = window.scrollY; render(); window.scrollTo(0, y);
    if (focusEmpty) { const e = $$('.sitem [data-sf="name"]').find(i => !i.value && !i.disabled); if (e) e.focus(); }
  }, 60);
}
bindMScan = function () {
  const sc = SC();
  $$('[data-smode]').forEach(b => b.addEventListener('click', () => { sc.mode = b.dataset.smode; render(); }));
  $('#codeGo')?.addEventListener('click', () => { addByCode($('#codeIn').value); });
  $('#codeIn')?.addEventListener('keydown', e => { if (e.key === 'Enter') addByCode(e.target.value); });
  $('#scanClear')?.addEventListener('click', () => { sc.items = []; render(); });
  $$('[data-sdel]').forEach(b => b.addEventListener('click', () => { sc.items = sc.items.filter(i => i.id !== b.dataset.sdel); render(); }));
  $$('.sitem').forEach(card => { const it = sc.items.find(i => i.id === card.dataset.sid); if (!it) return;
    $$('[data-sf]', card).forEach(inp => {
      const f = inp.dataset.sf;
      inp.addEventListener(f === 'name' ? 'input' : 'change', () => {
        if (f === 'qty') it.qty = num(inp.value) || 1; else it[f] = inp.value;
        if (f === 'expires') it.expEst = false;
        if (f === 'cat') { it.loc = DEF_LOC[it.cat] || 'pantry'; it.expires = dkey(addDays(new Date(), SHELF[it.cat] || 30)); it.expEst = true; render(); }
        if (f === 'name') { const btn = $('#scanSave2'); const n = sc.items.filter(i => i.on && i.name.trim() && !['reading', 'lookup'].includes(i.status)).length; if (btn) { btn.disabled = !n; btn.lastChild.textContent = `Agregar ${n} a la despensa`; } }
      });
      if (f === 'name') inp.addEventListener('change', () => { // al elegir un nombre conocido, se ajusta categoría y vencimiento
        const p = CATALOG.find(x => BN(x.n) === BN(it.name)); if (p && it.status !== 'found') { it.cat = AISLE_CAT[p.aisle] || it.cat; it.loc = DEF_LOC[it.cat] || 'pantry'; it.expires = dkey(addDays(new Date(), SHELF[it.cat] || 30)); const q = qtyFromText(p.pres); if (/libra/.test(p.pres)) { it.qty = 1; it.unit = 'libra'; } else { it.qty = q.qty; it.unit = q.unit; } render(); } });
    }); });
  $('#scanSave2')?.addEventListener('click', async () => {
    const ok = sc.items.filter(i => i.on && i.name.trim() && !['reading', 'lookup'].includes(i.status));
    B().barcodes = B().barcodes || {}; B().customFoods = B().customFoods || {};
    ok.forEach(i => {
      if (i.code) B().barcodes[i.code] = { name:i.name.trim(), cat:i.cat, qty:i.qty, unit:i.unit, loc:i.loc, size:i.size, nutri:i.nutri || null, per100:i.per100 || null };
      if (i.code && i.per100 && i.per100.kcal) B().customFoods['bc-' + i.code] = { n:i.name.trim(), ...i.per100 };
      savePhoto(i.name.trim(), i.photo);
    });
    await addToPantry(ok.map(i => ({ name:i.name.trim(), cat:i.cat, qty:i.qty || 1, unit:i.unit, loc:i.loc, expires:i.expires, expEst:i.expEst, opened:false, cost:null })), 'scan');
    await saveDoc('brain'); registerCustomFoods();
    sc.items = sc.items.filter(i => !ok.includes(i)); S.mtab = 'pantry';
    toast(`${ok.length} ${ok.length === 1 ? 'producto agregado' : 'productos agregados'} a tu despensa. JARVIS recordará sus códigos.`); render();
  });
  // factura
  const R = sc.receipt;
  $('#rcManual')?.addEventListener('click', () => { sc.receipt = { busy:false, store:myStores()[0], date:dkey(), items:[{ id:uid(), on:true, name:'', cost:null, cat:'Other', qty:1, unit:'unidad' }], total:0, err:'', photo:null }; render(); setTimeout(() => $('[data-rf="name"]')?.focus(), 50); });
  if (R && !R.busy) {
    $('#rcStore')?.addEventListener('change', e => R.store = e.target.value);
    $('#rcDate')?.addEventListener('change', e => R.date = e.target.value);
    $('#rcPantry')?.addEventListener('change', e => R.toPantry = e.target.checked);
    $$('[data-rid]').forEach(row => { const it = R.items.find(i => i.id === row.dataset.rid);
      $$('[data-rf]', row).forEach(inp => inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', () => { const f = inp.dataset.rf; if (f === 'on') { it.on = inp.checked; render(); } else if (f === 'cost') it.cost = num(String(inp.value).replace(/[.\s$]/g, '')); else { it.name = inp.value; it.cat = catFromText(inp.value); } })); });
    $('#rcAddLine')?.addEventListener('click', () => { R.items.push({ id:uid(), on:true, name:'', cost:null, cat:'Other', qty:1, unit:'unidad' }); render(); setTimeout(() => { const all = $$('[data-rf="name"]'); all[all.length - 1]?.focus(); }, 50); });
    $('#rcDiscard')?.addEventListener('click', () => { sc.receipt = null; render(); });
    $('#rcSave')?.addEventListener('click', async () => {
      const chosen = R.items.filter(i => i.on && i.name.trim());
      const store = R.store || myStores()[0], date = R.date || dkey(), total = chosen.reduce((s, i) => s + (+i.cost || 0), 0) || R.total || 0;
      S.market.purchases = [{ id:uid(), date, store, total, items:chosen.map(i => ({ name:i.name.trim(), qty:'', price:i.cost })), src:'receipt' }, ...(S.market.purchases || [])].slice(0, 150);
      S.market.prices = S.market.prices || {};
      chosen.filter(i => i.cost).forEach(i => S.market.prices[BN(i.name)] = { name:i.name.trim(), price:i.cost, qty:'', store, date });
      const ps = [saveDoc('market')];
      if (R.toPantry !== false) ps.push(addToPantry(chosen.map(i => ({ name:i.name.trim(), cat:i.cat, qty:1, unit:'unidad', loc:DEF_LOC[i.cat] || 'pantry', expires:dkey(addDays(new Date(), SHELF[i.cat] || 30)), expEst:true, opened:false, cost:i.cost || null })), 'receipt'));
      await Promise.all(ps); sc.receipt = null; S.mtab = 'spend';
      toast(`Compra de ${cop(total)} en ${store} registrada.`); render();
    });
  }
  bindQuick();
};

/* ---------- fotos en la despensa y textos ---------- */
const _mPantry2 = mPantry;
mPantry = function () {
  return _mPantry2().replace('Photograph your fridge, pantry or the bags from the market, or a receipt from D1, Ara or Éxito. JARVIS will list everything with estimated expiry dates.', 'Toma fotos de tus productos (JARVIS lee el código de barras), sube la factura o agrégalos rápido desde el catálogo.');
};
const _bindMPantry2 = bindMPantry;
bindMPantry = function () {
  _bindMPantry2();
  $$('.prow').forEach(row => { const pn = $('.pname', row), b = pn && $('b', pn); if (!b || $('.pthumb', row)) return; const ph = getPhoto(b.textContent); if (!ph) return;
    const img = document.createElement('img'); img.className = 'pthumb'; img.src = ph; img.alt = ''; const txt = document.createElement('div'); txt.style.minWidth = '0'; while (pn.firstChild) txt.appendChild(pn.firstChild); pn.classList.add('has-thumb'); pn.appendChild(img); pn.appendChild(txt); });
};
// pestaña Escanear visible en Mercado
const _viewMarket3 = viewMarket;
viewMarket = function () {
  return _viewMarket3().replace(`data-mtab="pantry">`, `data-mtab="pantry">`).replace(/(<button role="tab" aria-selected="[^"]*" data-mtab="week">)/, `<button role="tab" aria-selected="${S.mtab === 'scan'}" data-mtab="scan">Escanear</button>$1`).replace(`aria-selected="true" data-mtab="pantry">`, S.mtab === 'scan' ? `aria-selected="false" data-mtab="pantry">` : `aria-selected="true" data-mtab="pantry">`);
};

/* ---------- arranque ---------- */
setTimeout(function waitBrain() { if (S.mode === 'cloud') registerCustomFoods(); else setTimeout(waitBrain, 400); }, 400);
boot();
