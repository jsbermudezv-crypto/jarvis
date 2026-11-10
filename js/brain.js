/* =========================================================
   JARVIS — Cerebro local
   Todo lo que antes pedía a una IA en línea ahora se resuelve aquí,
   en el teléfono, con la base de alimentos, el recetario, las guías,
   tus datos y lo que JARVIS aprende de tus registros.
   ========================================================= */
'use strict';

/* ---------- utilidades ---------- */
const BN = s => normName(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const q4 = v => Math.round(v * 4) / 4;
const fmtQty = v => { const w = Math.floor(v), f = v - w; const fr = f === .5 ? '½' : f === .25 ? '¼' : f === .75 ? '¾' : ''; return (w ? w : '') + fr || '0'; };
const CAT_APP = { 'Proteínas':'Proteins', 'Lácteos':'Dairy', 'Verduras':'Vegetables', 'Frutas':'Fruits', 'Carbohidratos':'Carbohydrates', 'Grasas':'Fats', 'Bebidas':'Drinks', 'Condimentos':'Condiments', 'Mecato':'Snacks', 'Platos':'Other' };
const TYPE_LABEL = { breakfast:'desayuno', lunch:'almuerzo', dinner:'cena', snack:'algo' };
const B = () => { S.brain = S.brain || {}; S.brain.ratings = S.brain.ratings || {}; S.brain.portions = S.brain.portions || {}; return S.brain; };

/* ---------- 1. Buscador de alimentos ---------- */
const ALIAS_INDEX = (() => {
  const out = [];
  FOODS.forEach(f => [f.n, ...f.aliases].forEach(a => { const k = BN(a); if (k.length >= 2) out.push({ k, f }); }));
  return out.sort((a, b) => b.k.length - a.k.length);
})();
function findFoods(q, n = 12) {
  const k = BN(q); if (!k) return [];
  const words = k.split(' ');
  const scored = FOODS.map(f => {
    const hay = BN(f.n + ' ' + f.aliases.join(' '));
    let s = 0;
    if (BN(f.n) === k || f.aliases.some(a => BN(a) === k)) s += 100;
    if (BN(f.n).startsWith(k)) s += 40;
    if (hay.includes(k)) s += 25;
    s += words.filter(w => w.length > 1 && hay.includes(w)).length * 10;
    s += Math.min(10, (learnedFreq()[f.id] || 0));
    return { f, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  return scored.slice(0, n).map(x => x.f);
}
function matchFood(name) {
  const k = ' ' + BN(name) + ' ';
  for (const a of ALIAS_INDEX) if (k.includes(' ' + a.k + ' ')) return a.f;
  return findFoods(name, 1)[0] || null;
}
function portionCount(f) { const m = String(f.por).match(/^(\d+)\s/); return m ? Number(m[1]) : 1; }
function unitGrams(f) { const learned = B().portions[f.id]; return learned || f.g / portionCount(f); }
function foodItem(f, grams, qty, unit, conf = 'medium') {
  const k = grams / 100;
  return { id:uid(), foodId:f.id, name:f.n, qty:qty ?? 1, unit:unit || f.por.replace(/^\d+\s*\/?\d*\s*/, '') || 'porción', grams:Math.round(grams), prep:'',
    kcal:Math.round(f.kcal*k), p:r1(f.p*k), c:r1(f.c*k), f:r1(f.f*k), fib:r1(f.fib*k), conf };
}

/* ---------- 2. Entender lo que comiste (texto libre) ---------- */
const NUMW = { un:1, una:1, uno:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9, diez:10, media:.5, medio:.5, mitad:.5, par:2 };
const UNITW = /^(g|gr|grs|gramos?|kg|kilos?|ml|mililitros?|l|litros?|tazas?|vasos?|pocillos?|porcion(?:es)?|platos?|cucharadas?|cucharaditas?|cdas?|cdtas?|unidad(?:es)?|tajadas?|presas?|filetes?|latas?|puñados?|punados?|rebanadas?|bolas?|paquetes?|botellas?|copas?|libras?|lb)$/;
function parseQty(before) {
  const t = BN(before).split(' ').filter(Boolean);
  let qty = null, unit = null, grams = null;
  for (let i = 0; i < t.length; i++) {
    const w = t[i];
    if (/^\d+([.,]\d+)?$/.test(w)) qty = Number(w.replace(',', '.'));
    else if (/^\d+\/\d+$/.test(w)) { const [a, b] = w.split('/').map(Number); qty = a / b; }
    else if (w === 'cuarto' && (t[i-1] === 'un' || t[i-1] === 'medio')) qty = .25;
    else if (NUMW[w] != null && qty == null) qty = NUMW[w];
    else if (UNITW.test(w)) unit = w;
  }
  if (qty != null && unit && /^(g|gr|grs|gramo|gramos)$/.test(unit)) { grams = qty; }
  else if (qty != null && unit && /^(kg|kilo|kilos)$/.test(unit)) { grams = qty * 1000; }
  else if (qty != null && unit && /^(ml|mililitro|mililitros)$/.test(unit)) { grams = qty; }
  else if (qty != null && unit && /^(l|litro|litros)$/.test(unit)) { grams = qty * 1000; }
  else if (qty != null && unit && /^(libra|libras|lb)$/.test(unit)) { grams = qty * 500; }
  return { qty, unit, grams };
}
function parseMealText(text) {
  const items = [], unknown = [];
  const chunks = String(text || '').replace(/\n/g, ',').split(/,|;|\+|\s+y\s+|\s+más\s+|\s+mas\s+|\s+tambien\s+|\s+también\s+/i).map(s => s.trim()).filter(Boolean);
  chunks.forEach(chunk => {
    const k = ' ' + BN(chunk) + ' ';
    const spans = [];
    for (const a of ALIAS_INDEX) {
      let from = 0, idx;
      while ((idx = k.indexOf(' ' + a.k + ' ', from)) >= 0) {
        const s = idx + 1, e = s + a.k.length;
        if (!spans.some(x => s < x.e && e > x.s)) spans.push({ s, e, f:a.f });
        from = e;
      }
    }
    if (!spans.length) { const clean = chunk.replace(/^(me\s+)?(comi|comí|desayune|desayuné|almorce|almorcé|cene|cené|tome|tomé|bebi|bebí)\s+/i, '').trim(); if (clean.length > 1) unknown.push(clean); return; }
    spans.sort((a, b) => a.s - b.s);
    spans.forEach((sp, i) => {
      const before = k.slice(i ? spans[i-1].e : 0, sp.s);
      const { qty, unit, grams } = parseQty(before);
      const f = sp.f, ug = unitGrams(f);
      let g, conf;
      if (grams) { g = grams; conf = 'high'; }
      else if (qty != null) { g = qty * (portionCount(f) > 1 ? ug : (B().portions[f.id] || f.g)); conf = 'medium'; }
      else { g = B().portions[f.id] ? B().portions[f.id] * (portionCount(f) > 1 ? portionCount(f) : 1) : f.g; conf = 'low'; }
      const it = foodItem(f, g, qty ?? (portionCount(f) > 1 ? portionCount(f) : 1), unit || (portionCount(f) > 1 ? f.por.replace(/^\d+\s*/, '') : f.por), conf);
      items.push(it);
    });
  });
  return { items, unknown };
}

/* ---------- 3. Recetas: búsqueda, escalado y formatos ---------- */
function dislikeTokens() {
  const src = [P().prefs?.dislikes, P().prefs?.allergies, P().medical?.intolerances, ...(S.memory.items || []).filter(m => /no me gusta|no como|alerg|intoleran|me cae mal|odio|evito/i.test(m.text)).map(m => m.text)].filter(Boolean).join(' , ');
  const stop = new Set(['no','me','gusta','gustan','como','comer','soy','alergico','alergica','alergia','intolerante','intolerancia','cae','mal','odio','evito','el','la','los','las','de','del','y','a','al','que','con','nada','ninguna','ninguno','usuario','sebas']);
  return [...new Set(BN(src).split(/[ ,]+/).filter(w => w.length >= 4 && !stop.has(w)))];
}
const FOOD_GROUP = { 'atun-agua':'pescado mariscos', 'atun-aceite':'pescado mariscos', salmon:'pescado mariscos', tilapia:'pescado mariscos', 'pescado-frito':'pescado mariscos', camaron:'mariscos camarones', cerdo:'cerdo marrano', chicharron:'cerdo marrano', chorizo:'cerdo embutidos', salchicha:'embutidos', jamon:'cerdo embutidos', 'carne-magra':'res carnes rojas', 'carne-molida':'res carnes rojas', leche:'lacteos', 'leche-desc':'lacteos lactosa', yogur:'lacteos lactosa', 'yogur-griego':'lacteos lactosa', kumis:'lacteos lactosa', 'queso-campesino':'lacteos queso', 'queso-costeno':'lacteos queso', cuajada:'lacteos queso', mozzarella:'lacteos queso', huevo:'huevos', clara:'huevos', pericos:'huevos', revueltos:'huevos', mani:'frutos secos nueces', almendra:'frutos secos nueces', 'mantequilla-mani':'frutos secos', pan:'gluten trigo harinas', 'pan-integral':'gluten trigo', tortilla:'gluten trigo', pasta:'gluten trigo', 'pasta-integral':'gluten trigo', 'galleta-soda':'gluten trigo', avena:'gluten' };
function recipeBlocked(r, toks = dislikeTokens()) {
  if (!toks.length) return false;
  const hay = BN(r.n + ' ' + r.ing.map(i => i.food ? i.food.n + ' ' + i.food.aliases.join(' ') + ' ' + (FOOD_GROUP[i.id] || '') : i.id).join(' '));
  return toks.some(t => hay.includes(t));
}
function recipeScore(r) { return (B().ratings[r.id] || 0); }
function searchRecipes(q, filters = []) {
  const k = BN(q || ''), words = k.split(' ').filter(w => w.length > 2), toks = dislikeTokens();
  return RECIPES.filter(r => {
    if (filters.includes('pantry') && pantryCover(r) < .6) return false;
    for (const f of filters) { if (['breakfast','lunch','dinner','snack'].includes(f) && r.type !== f) return false; if (['proteina','bajo-grasa','rugby','suave','economico','rapido','fibra','vegetariano'].includes(f) && !r.tags.includes(f)) return false; }
    if (!words.length) return true;
    const hay = BN(r.n + ' ' + r.tags.join(' ') + ' ' + r.ing.map(i => i.food?.n || '').join(' ') + ' ' + TYPE_LABEL[r.type]);
    return words.every(w => hay.includes(w));
  }).map(r => ({ r, blocked:recipeBlocked(r, toks) })).sort((a, b) => (a.blocked - b.blocked) || (recipeScore(b.r) - recipeScore(a.r)));
}
function pantryCover(r) { const main = r.ing.filter(i => i.food && !['aceite','azucar','miel'].includes(i.id)); if (!main.length) return 0; return main.filter(i => { const m = pantryMatch(i.food.n); return m && !m.staple; }).length / main.length; }
function scaledIngredients(r, x = 1) { return r.ing.map(i => ({ name:i.food ? i.food.n : i.id, quantity:`${i.label}${x !== 1 ? ` ×${fmtQty(x)}` : ''} (~${Math.round(i.g * x)} g)`, g:i.g * x, food:i.food })); }
function recipeToApp(r, x = 1) {
  const e = r.est;
  return { id:uid(), libId:r.id, createdAt:new Date().toISOString(), name:r.n, emoji:r.e, servings:1, prep_minutes:r.t, cook_minutes:0, difficulty:'easy',
    ingredients:scaledIngredients(r, x).map(i => ({ name:i.name, quantity:i.quantity })), steps:r.steps,
    estimate_per_serving:{ kcal:Math.round(e.kcal*x), protein_g:r1(e.p*x), carbs_g:r1(e.c*x), fat_g:r1(e.f*x), fiber_g:r1(e.fib*x) },
    storage:'Refrigerado en recipiente cerrado hasta 3 días.', substitutions:[], allergens:[], tips:r.tags.includes('rugby') ? ['Ideal para días de rugby.'] : [] };
}
function recipeToPlanMeal(r, x, why, type) {
  const uses = r.ing.filter(i => i.food).map(i => i.food.n).filter(n => { const m = pantryMatch(n); return m && !m.staple; });
  return { type:type || r.type, name:r.n, description:r.ing.slice(0, 4).map(i => i.food?.n.toLowerCase()).join(', '), ingredients:scaledIngredients(r, x).map(i => ({ name:i.name, quantity:i.quantity })),
    prep_minutes:r.t, estimate:{ kcal:Math.round(r.est.kcal*x), protein_g:Math.round(r.est.p*x), carbs_g:Math.round(r.est.c*x), fat_g:Math.round(r.est.f*x) }, why, uses, libId:r.id, x };
}
function logRecipe(r, x = 1, type) {
  const items = r.ing.filter(i => i.food).map(i => ({ ...foodItem(i.food, i.g * x, null, i.label, 'medium'), qty:1, unit:i.label }));
  const meal = { id:uid(), type:type || guessType(), name:r.n, time:`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`, source:'recipe', items:items.map(({foodId, ...it}) => it), notes:['Del recetario de JARVIS.'], createdAt:new Date().toISOString() };
  return setMealsOn(dkey(), [...mealsOn(dkey()), meal].sort((a, b) => (a.time||'').localeCompare(b.time||'')));
}

/* ---------- 4. Planificador de menús ---------- */
const SPLIT = { breakfast:.25, lunch:.35, snack:.12, dinner:.28 };
function refKcal() { const t = calcTargets({ sex:'male', age:num(P().profile?.age) || 28, weight:curWeight() || 120, height:num(P().profile?.height) || 180, activity:suggestedActivity(), rate:'standard' }); return t ? t.kcal : 2300; }
const FOCUS_TAG = { 'Suave para la digestión':'suave', 'Económico':'economico', 'Combustible para días de rugby':'rugby' };
function pickRecipe(type, target, ctx) {
  const toks = ctx.toks;
  let cands = RECIPES.filter(r => r.type === type || (type === 'dinner' && r.type === 'lunch' && r.est.kcal < 560));
  cands = cands.filter(r => !recipeBlocked(r, toks));
  const freq = learnedFreq();
  const scored = cands.map(r => {
    const x = clamp(q4(target / r.est.kcal), .75, 1.75);
    let s = -Math.abs(r.est.kcal * x - target) / target * 3;
    s += (r.est.p / Math.max(1, r.est.kcal) * 100) * .12;
    if (ctx.dt === 'rugby' && r.tags.includes('rugby')) s += 1.2;
    if (ctx.digest && r.tags.includes('suave')) s += 1;
    ctx.focus.forEach(fc => { const tg = FOCUS_TAG[fc]; if (tg && r.tags.includes(tg)) s += .9; if (fc === 'Rápido (menos de 20 min)' && r.t <= 20) s += .9; if (fc === 'Más verduras' && r.ing.some(i => i.food?.cat === 'Verduras' && i.g >= 80)) s += .8; if (fc === 'Que llene bastante' && (r.tags.includes('fibra') || r.ing.some(i => i.id === 'ensalada'))) s += .7; if (fc === 'Lo que suelo comer') s += r.ing.reduce((t, i) => t + Math.min(2, freq[i.id] || 0), 0) * .15; });
    s += recipeScore(r) * 1.5;
    s += pantryCover(r) * (ctx.pantryFirst ? 2.2 : .8);
    r.ing.forEach(i => { const ex = i.food && expiring(3).find(p => { const m = pantryMatch(i.food.n); return m && m.id === p.id; }); if (ex) s += .8; });
    const last = ctx.used.lastIndexOf(r.id); if (last >= 0) s -= (ctx.used.length - last <= 8 ? 2.5 : 1);
    s += rnd(0, .6);
    return { r, x, s };
  }).sort((a, b) => b.s - a.s);
  return scored[0];
}
function buildPlan(days, opts = {}) {
  const start = new Date(), used = [], toks = dislikeTokens(), focus = opts.focus || [];
  const digest = (P().medical?.digestive || []).some(d => d && d !== 'None') || today().checkin?.digest === 'some' || today().checkin?.digest === 'significant';
  const outDays = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i), k = dkey(d), tg = targetsFor(k), total = (tg ? tg.kcal : refKcal()) , dt = tg ? tg.dt : dayTypeOf(k);
    const meals = ['breakfast','lunch','snack','dinner'].map(type => {
      const pick = pickRecipe(type, total * SPLIT[type], { dt, focus, used, toks, digest, pantryFirst:opts.pantryFirst });
      used.push(pick.r.id);
      const why = [dt === 'rugby' && pick.r.tags.includes('rugby') ? 'Combustible para el rugby' : '', pantryCover(pick.r) >= .5 ? 'usa lo que tienes' : '', pick.r.tags.includes('bajo-grasa') ? 'bajo en grasa' : '', pick.r.est.p * pick.x >= 30 ? 'alto en proteína' : '', recipeScore(pick.r) > 0 ? 'te gustó antes' : ''].filter(Boolean).join(', ');
      return recipeToPlanMeal(pick.r, pick.x, why ? why.charAt(0).toUpperCase() + why.slice(1) + '.' : '', type);
    });
    outDays.push({ date:k, label:d.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'short' }), meals });
  }
  const shopping = shoppingFor(outDays, opts.people || 1);
  return { generatedAt:new Date().toISOString(), title:`Menú de ${days} ${days === 1 ? 'día' : 'días'}${TG() ? ' a tu meta' : ''}`, days:outDays,
    prep_tips:prepTips(outDays), shopping_list:shopping.map(s => ({ item:s.item, quantity:s.qty })), shoppingRaw:shopping,
    assumptions:[TG() ? 'Las porciones se ajustaron a tus calorías de cada día (más en días de rugby).' : 'Sin metas activas: porciones calculadas con un estimado de tu gasto diario. Activa Mi plan para afinarlas.', 'Cocinas con poco aceite: medido con cuchara.'],
    safety_notes:['Estimados de referencia. Por tu resección de duodeno, valida porciones y metas con tu nutricionista.'] };
}
function shoppingFor(days, people = 1) {
  const agg = {};
  days.forEach(d => d.meals.forEach(m => { const r = RECIPE_BY_ID[m.libId]; if (!r) return; r.ing.forEach(i => { if (!i.food) return; agg[i.id] = (agg[i.id] || 0) + i.g * m.x * people; }); }));
  return Object.entries(agg).map(([id, g]) => {
    const f = FOOD_BY_ID[id], have = pantryMatch(f.n);
    if (have && !have.staple) return null;
    if (['agua','tinto'].includes(id)) return null;
    let qty;
    if (/unidad|huevo|clara|arepa|tajada|lata|filete/.test(f.por) && !/taza/.test(f.por)) { const u = Math.ceil(g / (f.g / portionCount(f))); qty = id === 'huevo' && u > 12 ? `${Math.ceil(u/30)} cubeta${u > 30 ? 's' : ''}` : `${u} ${u === 1 ? 'unidad' : 'unidades'}`; }
    else if (f.cat === 'Bebidas' || /leche/.test(id)) qty = `${Math.ceil(g / 1000 * 2) / 2} L`;
    else qty = g >= 450 ? `${Math.ceil(g / 250) / 2} lb` : `${Math.ceil(g / 50) * 50} g`;
    return { item:shopName(f), qty, cat:CAT_APP[f.cat] || 'Other', foodId:id };
  }).filter(Boolean).sort((a, b) => a.cat.localeCompare(b.cat));
}
function shopName(f) {
  const special = { arepa:'Arepas de maíz', ensalada:'Lechuga, tomate y pepino', 'crema-ahuyama':'Ahuyama', pechuga:'Pechuga de pollo', 'carne-magra':'Carne de res magra', 'patacon-horno':'Plátano verde', maduro:'Plátano maduro', 'platano-verde':'Plátano verde', 'atun-agua':'Atún en agua (latas)', tilapia:'Filete de tilapia o mojarra', hogao:'Tomate y cebolla para hogao' };
  return special[f.id] || f.n.replace(/\s+(cocid[oa]s?|asad[oa]s?( o cocido)?|a la plancha|al horno.*|en airfryer.*|guisad[oa]s?.*|natural descremado)$/i, '').replace(/^Fríjol rojo$/, 'Fríjol rojo (seco)');
}
function prepTips(days) {
  const c = {}; days.forEach(d => d.meals.forEach(m => (RECIPE_BY_ID[m.libId]?.ing || []).forEach(i => c[i.id] = (c[i.id] || 0) + 1)));
  const tips = [];
  if ((c.arroz || 0) + (c['arroz-integral'] || 0) >= 3) tips.push('Cocina arroz para 3 días de una vez y guárdalo refrigerado.');
  if ((c.pechuga || 0) >= 3) tips.push('Asa o cocina toda la pechuga de la semana el domingo; desmecha una parte para cremas y wraps.');
  if ((c.frijol || 0) + (c.lenteja || 0) >= 2) tips.push('Deja los fríjoles en remojo la noche anterior y cocina doble porción para congelar.');
  if ((c.ensalada || 0) + (c.lechuga || 0) >= 3) tips.push('Lava y pica la ensalada en un recipiente con toalla de papel: dura 4 días.');
  tips.push('Mide el aceite con cuchara: es la grasa que más se escapa.');
  return tips.slice(0, 5);
}

/* ---------- 5. Aprendizaje ---------- */
let _freqCache = null, _freqAt = 0;
function allMeals() { const out = []; Object.keys(S).filter(k => k.startsWith('meals-')).forEach(k => Object.entries(S[k]?.days || {}).forEach(([d, v]) => (v.meals || []).forEach(m => out.push({ ...m, date:d })))); return out; }
function learnedFreq() {
  if (_freqCache && Date.now() - _freqAt < 3000) return _freqCache;
  const f = {}; allMeals().forEach(m => (m.items || []).forEach(i => { const fd = matchFood(i.name); if (fd) f[fd.id] = (f[fd.id] || 0) + 1; }));
  _freqCache = f; _freqAt = Date.now(); return f;
}
function learnStats() {
  const meals = allMeals(), byType = {};
  meals.forEach(m => {
    const t = m.type || 'snack'; const b = byType[t] = byType[t] || { n:0, mins:[], kcal:0, foods:{} };
    b.n++; b.kcal += itemTotals(m.items).kcal;
    if (m.time) { const [h, mi] = m.time.split(':').map(Number); b.mins.push(h * 60 + mi); }
    (m.items || []).forEach(i => { const fd = matchFood(i.name); const key = fd ? fd.id : '~' + i.name; b.foods[key] = (b.foods[key] || 0) + 1; });
  });
  Object.values(byType).forEach(b => { b.avgKcal = b.n ? Math.round(b.kcal / b.n) : 0; b.time = b.mins.length ? (a => `${pad(Math.floor(a / 60))}:${pad(a % 60)}`)(Math.round(b.mins.reduce((s, x) => s + x, 0) / b.mins.length)) : null; b.top = Object.entries(b.foods).sort((a, c) => c[1] - a[1]).slice(0, 5).map(([k, n]) => ({ name:k.startsWith('~') ? k.slice(1) : FOOD_BY_ID[k].n, id:k, n })); });
  const days = [...new Set(meals.map(m => m.date))];
  const dayK = days.map(d => dayTotals(d));
  const avg = f => dayK.length ? Math.round(dayK.reduce((s, x) => s + x[f], 0) / dayK.length) : 0;
  const wd = {}; Object.entries(S.log.days || {}).forEach(([d, v]) => { const w = DOW[parseKey(d).getDay()]; wd[w] = wd[w] || { n:0, done:0 }; wd[w].n++; if (v.mission?.done) wd[w].done++; });
  const sess = allSessions().filter(s => s.kind === 'workout'); const smins = sess.map(s => { const [h, m] = (s.start || '0:0').split(':').map(Number); return h * 60 + m; });
  return { meals:meals.length, days:days.length, byType, avgKcal:avg('kcal'), avgP:avg('p'), weekdays:wd, workouts:sess.length,
    trainTime: smins.length ? (a => `${pad(Math.floor(a / 60))}:${pad(a % 60)}`)(Math.round(smins.reduce((s, x) => s + x, 0) / smins.length)) : null };
}
const DEFAULT_SUGG = { breakfast:['huevo','arepa','pericos','avena','tinto','papaya'], lunch:['pechuga','arroz','frijol','ensalada','maduro','sopa-verduras'], dinner:['huevo','arepa','pechuga','ensalada','crema-ahuyama','tilapia'], snack:['banano','yogur','manzana','mani','tinto','cuajada'] };
function suggestionsFor(type) {
  const st = learnStats(), b = st.byType[type];
  const learned = b ? b.top.filter(x => !x.id.startsWith('~')).map(x => x.id) : [];
  return [...new Set([...learned, ...DEFAULT_SUGG[type]])].slice(0, 8).map(id => FOOD_BY_ID[id]).filter(Boolean);
}
function learnFromItems(items) {
  let changed = false;
  (items || []).forEach(i => {
    const f = i.foodId ? FOOD_BY_ID[i.foodId] : matchFood(i.name); if (!f || !(i.grams > 0)) return;
    const per = portionCount(f) > 1 ? i.grams / Math.max(1, Number(i.qty) || portionCount(f)) : i.grams / Math.max(.25, Number(i.qty) || 1);
    if (Math.abs(per - unitGrams(f)) / unitGrams(f) < .08) return;
    const prev = B().portions[f.id]; B().portions[f.id] = Math.round(prev ? prev * .6 + per * .4 : per); changed = true;
  });
  if (changed) saveDoc('brain');
}

/* ---------- 6. Conversación ---------- */
function lines(...a) { return a.filter(Boolean).join('\n'); }
function remainingNow() { const tg = targetsFor(dkey()), t = dayTotals(dkey()); return tg ? { tg, t, kcal:tg.kcal - r0(t.kcal), p:tg.p - r0(t.p) } : { tg:null, t }; }
function suggestMeals(type, n = 3) {
  const rem = remainingNow(); const share = { breakfast:.25, lunch:.4, snack:.15, dinner:.35 }[type] || .3;
  const target = rem.tg ? clamp(rem.kcal * (type === 'dinner' ? .9 : share * 1.6), 150, 900) : refKcal() * SPLIT[type];
  const toks = dislikeTokens();
  return RECIPES.filter(r => (r.type === type || (type === 'dinner' && r.type === 'lunch')) && !recipeBlocked(r, toks))
    .map(r => { const x = clamp(q4(target / r.est.kcal), .75, 1.5); return { r, x, s: -Math.abs(r.est.kcal * x - target) / target * 2 + pantryCover(r) * 1.5 + recipeScore(r) + rnd(0, .5) }; })
    .sort((a, b) => b.s - a.s).slice(0, n);
}
function guideFor(text) {
  const k = BN(text); let best = null, bs = 0;
  GUIDES.forEach(g => { const s = g.k.split(',').filter(w => k.includes(BN(w))).length; if (s > bs) { bs = s; best = g; } });
  return bs ? best : null;
}
function styleLine(sit) { try { return motMessage(0).text; } catch { return ''; } }
function workoutSummary(k = dkey()) {
  const dp = dayPlan(k);
  if (dp.kind === 'match') return `Hoy es día de partido. Nada de entreno extra: buen desayuno, almuerzo 3 horas antes, agua y un calentamiento completo.`;
  if (dp.kind === 'rugby') return `Hoy tu sesión principal es el entreno de rugby. Si quieres, al terminar haz 15 minutos de movilidad post-rugby desde Entreno.`;
  if (!dp.code) return dp.title;
  const w = buildProgramWO(dp.code, k), ex = [...new Set(w.blocks.flatMap(b => b.ex.map(x => EXM[x.id].n)))];
  return lines(`Hoy toca **${w.title}** (semana ${w.programDay.week} de 4), unos ${w.est} minutos.`, ex.slice(0, 6).map(n => `• ${n}`).join('\n'), dp.sub || '', 'Está listo en Entreno: solo toca Empezar.');
}
function reply(text) {
  const t = String(text || '').trim(), n = BN(t), out = { text:'', logs:[], mems:[] };
  const name = P().profile?.name;
  // Recordar datos
  const memM = t.match(/^(?:recuerda que|recuerda|anota que|ten en cuenta que)\s+(.{3,180})/i);
  if (memM) { out.mems.push(memM[1].replace(/\.$/, '')); out.text = 'Entendido. Toca **Guardar en memoria** abajo y lo tendré en cuenta en tus menús y recomendaciones.'; return out; }
  if (/(no me gusta|no como|soy alergic|soy intolerante|me cae mal|me caen mal|odio el|odio la|odio los)/.test(n)) {
    out.mems.push(t.replace(/\.$/, '')); out.text = 'Anotado. Si lo guardas en memoria, no te lo volveré a sugerir en recetas ni menús.'; return out;
  }
  // Calorías de un alimento
  const calM = n.match(/(?:cuantas calorias|cuanta proteina|cuantos carbohidratos|cuanta grasa|calorias de|calorias tiene|que tiene|aporta)\s+(?:tiene\s+|hay en\s+|de\s+|un\s+|una\s+|el\s+|la\s+)*(.+)/);
  if (calM && !/me quedan|llevo|hoy/.test(n)) {
    const { items, unknown } = parseMealText(calM[1]);
    if (items.length) { const tt = itemTotals(items); out.text = lines(items.map(i => `• ${i.name} (${i.grams} g): ~${i.kcal} kcal, P ${r0(i.p)} g, C ${r0(i.c)} g, G ${r0(i.f)} g`).join('\n'), items.length > 1 ? `Total: ~${r0(tt.kcal)} kcal y ${r0(tt.p)} g de proteína.` : '', 'Son estimados de la base de alimentos de JARVIS.'); return out; }
    if (unknown.length) { out.text = `No tengo "${unknown[0]}" en mi base de alimentos. Búscalo en Nutrición → Biblioteca → Alimentos, o regístralo a mano con sus valores.`; return out; }
  }
  // Registrar lo que comió
  if (/^(me comi|comi|desayune|almorce|cene|me tome|tome|bebi|registra|anota|apunta)\b/.test(n) || /\b(me comi|desayune|almorce|cene)\b/.test(n)) {
    const { items, unknown } = parseMealText(t.replace(/^.*?(?:comí|comi|desayuné|desayune|almorcé|almorce|cené|cene|tomé|tome|bebí|bebi|registra(?:\s+mi\s+\w+)?|anota|apunta)\s*:?\s*/i, ''));
    if (items.length) {
      const tt = itemTotals(items);
      out.text = lines(`Esto entendí: ${items.map(i => i.name.toLowerCase()).join(', ')}. Son unas **${r0(tt.kcal)} kcal** y ${r0(tt.p)} g de proteína.`, unknown.length ? `No reconocí: ${unknown.join(', ')}. Lo puedes agregar en la revisión.` : '', (() => { const rem = remainingNow(); return rem.tg ? `Con esto te quedarían unas ${rem.kcal - r0(tt.kcal)} kcal para hoy.` : ''; })(), 'Toca **Analizar y registrar** abajo para revisarlo y guardarlo.');
      out.logs.push(t); return out;
    }
  }
  // Calorías restantes
  if (/(cuanto me queda|cuantas me quedan|calorias restantes|me quedan|cuanto llevo|como voy hoy|como voy con la comida)/.test(n)) {
    const r = remainingNow();
    out.text = r.tg ? lines(`Hoy llevas unas **${r0(r.t.kcal)} kcal** de ${r.tg.kcal} (${DT_L[r.tg.dt]}).`, r.kcal >= 0 ? `Te quedan **${r.kcal} kcal** y ${Math.max(0, r.p)} g de proteína.` : `Vas ${-r.kcal} kcal por encima: la próxima comida que sea liviana, con verduras y proteína.`, r.p > 30 ? 'Prioriza proteína en la próxima comida: pollo, pescado, huevo o atún.' : '')
      : `Llevas unas ${r0(r.t.kcal)} kcal y ${r0(r.t.p)} g de proteína hoy. Activa tu plan en Nutrición → Mi plan y te digo cuánto te queda.`;
    return out;
  }
  // Entreno
  if (/(que entreno|entreno de hoy|que toca|rutina de hoy|que hago hoy|ejercicio de hoy|entrenamiento de hoy)/.test(n)) { out.text = workoutSummary(); return out; }
  if (/(20 minutos|veinte minutos|poco tiempo|solo tengo|15 minutos|10 minutos|media hora)/.test(n)) {
    const mins = Number((n.match(/(\d+)\s*min/) || [])[1]) || (/veinte/.test(n) ? 20 : /media hora/.test(n) ? 30 : 20);
    const ok = allowedExercises(); const legs = ok.filter(e => e.type === 'strength' && /Sentadilla|Unilateral|Bisagra/.test(e.pat)).slice(0, 2), core = ok.filter(e => e.pat === 'Core').slice(0, 1), cond = ok.filter(e => e.type === 'cond').slice(0, 1);
    out.text = lines(`Con ${mins} minutos, lo más útil hoy:`, `• 3 minutos de calentamiento: ${EXM['march-high'] ? 'marcha con rodillas altas' : 'caminata'} y balanceos de pierna.`, `• Circuito de ${Math.max(2, Math.round((mins - 6) / 5))} rondas: ${[...legs, ...core, ...cond].map(e => e.n.toLowerCase()).join(', ')}. 40 s de trabajo y 20 s de descanso.`, '• 2 minutos de respiración y estiramiento al final.', 'Todo esto respeta tu hombro. En Entreno → Personalizar puedes generarlo con temporizador.');
    return out;
  }
  if (/(rugby ayer|jugue ayer|partido ayer|entrene ayer|estoy adolorido|estoy cansado|ajusta hoy)/.test(n)) {
    out.text = lines('Después de rugby el cuerpo necesita recuperar, no más carga.', '• Hoy: movilidad y caminata suave (Entreno → Recuperación y movilidad).', '• Come carbohidrato y proteína en cada comida, y toma más agua.', '• Duerme temprano: es la mejor recuperación.', 'Mañana retomamos fuerza si el dolor está por debajo de 4/10.');
    return out;
  }
  // Motivación
  if (/(no tengo ganas|sin ganas|no estoy motivado|no me siento motivado|desmotivado|pereza|no quiero entrenar|motivacion|motivame)/.test(n)) {
    const ci = today().checkin;
    out.text = lines('Está bien no tener ganas todos los días. No hace falta motivación para hacer algo pequeño.', ci && num(ci.energy) <= 2 ? 'Con tu energía baja hoy, la meta es mínima:' : 'Hagamos la versión mínima de hoy:', '• 10 minutos: una caminata o la movilidad de Entreno.', '• Un vaso de agua ahora mismo.', '• Registra tu próxima comida con una foto o una frase.', styleLine('low'), 'Cuando termines, cuéntame y lo marcamos como misión cumplida.');
    return out;
  }
  // Qué comer / cocinar
  const typeAsk = /desayun/.test(n) ? 'breakfast' : /almuerz|almorz/.test(n) ? 'lunch' : /cena|comida de la noche|ceno/.test(n) ? 'dinner' : /(algo|onces|merienda|snack|mecato)/.test(n) ? 'snack' : null;
  if (/(que como|que cocino|que hago de comer|que puedo comer|que preparo|ideas para|que desayuno|que almuerzo|que ceno|con lo que tengo|que hay en la nevera)/.test(n) || (typeAsk && /(que|ideas|sugiere|recomienda)/.test(n))) {
    const type = typeAsk || guessType(); const sug = suggestMeals(type, 3), rem = remainingNow();
    out.text = lines(`Para tu ${TYPE_LABEL[type]}${rem.tg ? ` (te quedan ${Math.max(0, rem.kcal)} kcal hoy)` : ''}:`, sug.map(({ r, x }) => `• ${r.e} **${r.n}**${x !== 1 ? ` ×${fmtQty(x)}` : ''}: ~${Math.round(r.est.kcal * x)} kcal, ${Math.round(r.est.p * x)} g proteína, ${r.t} min${pantryCover(r) >= .6 ? ' (tienes casi todo)' : ''}`).join('\n'), 'Las encuentras con ingredientes y pasos en Nutrición → Biblioteca.');
    return out;
  }
  // Receta específica
  const recM = n.match(/(?:receta de|receta|como (?:hago|preparo|se hace|se prepara))\s+(?:un |una |el |la |unos |unas )?(.+)/);
  if (recM) {
    const res = searchRecipes(recM[1]).filter(x => !x.blocked);
    if (res.length) { const r = res[0].r; out.text = lines(`${r.e} **${r.n}** (1 porción, ~${r.est.kcal} kcal, ${Math.round(r.est.p)} g proteína, ${r.t} min)`, 'Ingredientes:', r.ing.map(i => `• ${i.food?.n || i.id}: ${i.label}`).join('\n'), 'Preparación:', r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')); return out; }
    out.text = `No tengo una receta de "${recM[1]}" en el recetario. Mira las ${RECIPES.length} que hay en Nutrición → Biblioteca, o pídeme ideas para desayuno, almuerzo, cena o algo.`; return out;
  }
  // Progreso
  if (/(progreso|como voy|como he ido|este mes|esta semana|resumen|avance|como vamos)/.test(n)) {
    const st = weekStats(), tr = weightTrend(), lw = lastOf('weight');
    out.text = lines('Tu última semana:', `• Entrenos: ${st.workouts} de ${st.planned} del programa; rugby: ${st.rugby}.`, `• Misiones cumplidas: ${st.missions} de 7.`, `• Días con comidas registradas: ${st.mealDays} de 7${st.kcal ? `, promedio ~${st.kcal} kcal${st.tgt ? ` (meta ~${st.tgt})` : ''}` : ''}.`, st.prot ? `• Proteína promedio: ${st.prot} g${st.protTgt ? ` de ${st.protTgt} g` : ''}.` : '', lw ? `• Peso: ${Number(lw.weight).toFixed(1)} kg${tr ? `, ${tr.delta <= 0 ? 'bajando' : 'subiendo'} ${Math.abs(tr.delta).toFixed(1)} kg (${tr.basis})` : ''}.` : '• Aún no hay registros de peso: pésate 2 veces por semana.', st.mealDays < 4 ? 'Lo que más te ayudaría ahora: registrar más días de comida, aunque sea con una frase.' : 'Vas construyendo constancia. Sigue así.');
    return out;
  }
  if (/\b(peso|peso actual|cuanto peso|kilos)\b/.test(n) && !/(pese|me pese)/.test(n)) { const lw = lastOf('weight'), tr = weightTrend(); out.text = lw ? `Tu último peso registrado es ${Number(lw.weight).toFixed(1)} kg (${fmtDate(lw.date)})${tr ? `; ${tr.delta <= 0 ? 'bajaste' : 'subiste'} ${Math.abs(tr.delta).toFixed(1)} kg (${tr.basis})` : ''}. El peso varía día a día por agua: mira la tendencia semanal.` : 'Aún no tienes peso registrado. Toca Registrar peso en Inicio, idealmente en ayunas.'; return out; }
  if (/(proteina)/.test(n)) { const r = remainingNow(); out.text = lines(r.tg ? `Hoy llevas ${r0(r.t.p)} g de proteína de ${r.tg.p} g.` : `Hoy llevas ${r0(r.t.p)} g de proteína.`, GUIDES.find(g => g.id === 'proteina').b.slice(0, 3).map(x => `• ${x}`).join('\n')); return out; }
  if (/\b(agua|hidrat)/.test(n)) { const ml = waterOn(dkey()), tg = targetsFor(dkey()); out.text = `Hoy llevas ${(ml / 1000).toFixed(1)} L${tg ? ` de ${(tg.water / 1000).toFixed(1)} L` : ''}. ${ml < 1000 ? 'Tómate un vaso ahora y otro con cada comida.' : 'Vas bien; sigue con un vaso cada hora o dos.'}`; return out; }
  if (/(hombro|dolor|duele|lesion)/.test(n)) { out.text = lines('Con dolor no se entrena. Si el hombro está en 4/10 o más hoy, nada de carga en el tren superior: piernas suaves, caminata o movilidad.', 'Registra el dolor en el Chequeo diario y JARVIS ajusta el entreno solo.', 'Si el dolor es nuevo, fuerte o no baja en unos días, consulta a tu fisioterapeuta o médico.'); return out; }
  // Saludo
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que mas|quiubo|jarvis)\b/.test(n)) {
    const r = remainingNow(), dp = dayPlan(dkey());
    out.text = lines(greeting(), `Hoy: ${dp.title.toLowerCase()}${dp.code && dp.kind === 'train' ? ', listo en Entreno' : ''}.`, r.tg ? `Comida: llevas ${r0(r.t.kcal)} de ${r.tg.kcal} kcal.` : '', `Misión: ${currentMission().title}.`, '¿Te ayudo con qué comer, tu entreno o registrar una comida?');
    return out;
  }
  // Guías de nutrición
  const g = guideFor(t);
  if (g) { out.text = lines(`${g.e} **${g.t}**`, g.s, g.b.map(x => `• ${x}`).join('\n')); return out; }
  // Último intento: ¿mencionó alimentos?
  const pm = parseMealText(t); if (pm.items.length) { const tt = itemTotals(pm.items); out.text = lines(`${pm.items.map(i => i.name).join(', ')}: unas ${r0(tt.kcal)} kcal y ${r0(tt.p)} g de proteína.`, '¿Lo comiste? Escríbeme "comí ..." y te lo registro.'); return out; }
  out.text = lines('Puedo ayudarte con esto, sin conexión:', '• "¿Qué entreno hoy?" o "Solo tengo 20 minutos"', '• "¿Qué almuerzo?" o "¿Qué cocino con lo que tengo?"', '• "Comí arroz con pollo y ensalada" para registrar', '• "¿Cuántas calorías tiene una arepa con queso?"', '• "¿Cuánto me queda hoy?" o "¿Cómo voy esta semana?"', '• "Receta de ajiaco", "porciones", "comer para el rugby"', '• "No me gusta el pescado" para que lo recuerde');
  return out;
}

/* ---------- 7. Reemplazos de las funciones de IA ---------- */
window.JARVIS_SAMPLE = async (input, opts = {}) => {
  const txt = typeof input === 'string' ? input : (input[input.length - 1] || {}).content || '';
  let text;
  if (/spend less/i.test(txt)) text = lines('Ideas para gastar menos en esta lista:', '• Compra pollo entero y despréscalo: rinde más que la pechuga sola.', '• Fríjol, lenteja y huevo son la proteína más barata; úsalos 3 veces por semana.', '• Frutas y verduras de temporada en la plaza o la frutería, por libra.', '• Arroz, avena, atún y lácteos básicos en D1 o Ara, marca propia.', '• Evita bebidas y mecato: suelen ser el 15 % de la cuenta.');
  else text = reply(txt.split('\n').pop()).text;
  opts.onText && opts.onText({ text, delta:text });
  return { text, truncated:false };
};
window.JARVIS_SAMPLE.json = async () => { throw { code:'invalid_json', message:'local' }; };

analyzeFood = async function ({ text, image, answers, priorItems }) {
  const extra = (answers || []).map(a => a.a).join(', ');
  if (priorItems && priorItems.length) {
    const items = priorItems.map(i => { const f = matchFood(i.name); return f ? { ...foodItem(f, i.grams || unitGrams(f) * (Number(i.qty) || 1), i.qty, i.unit, i.grams ? 'high' : 'medium'), name:i.name, prep:i.preparation || '' } : { ...i, id:uid(), kcal:i.kcal || 0, conf:'low' }; });
    return { name:'', type:null, items, notes:['Recalculado con la base de alimentos de JARVIS.'], questions:[], digestive:null };
  }
  const src = [text, extra].filter(Boolean).join(', ');
  if (!src.trim()) return { name:'Comida', type:null, items:[], notes:['Las fotos se guardan como referencia: el reconocimiento de imágenes necesita IA en línea.'], questions:['¿Qué hay en la foto? Escríbelo, por ejemplo "arroz, pollo sudado y ensalada", o búscalo abajo.'], digestive:null };
  const { items, unknown } = parseMealText(src);
  const tt = itemTotals(items);
  const notes = ['Calculado con la base de alimentos de JARVIS. Ajusta los gramos si tu porción fue distinta.'];
  if (unknown.length) notes.push(`No reconocí: ${unknown.join(', ')}. Búscalo abajo o agrégalo a mano.`);
  if (items.some(i => i.conf === 'low')) notes.push('Donde no dijiste cantidad usé tu porción habitual o una porción típica.');
  const fried = items.filter(i => FOOD_BY_ID[i.foodId]?.tags.includes('frito')).length;
  return { name:items.slice(0, 3).map(i => i.name).join(', ').slice(0, 80) || 'Comida', type:null, items, notes,
    questions: unknown.length && !items.length ? [`¿Qué es "${unknown[0]}"? Escribe a qué se parece (por ejemplo "arepa", "sopa") o búscalo abajo.`] : [],
    digestive: tt.f >= 35 || fried >= 2 ? 'Es una comida alta en grasa o con varios fritos: fíjate cómo te cae; con tu cirugía, porciones más pequeñas suelen sentar mejor.' : null };
};
estimateItem = async function (item) {
  const f = matchFood(item.name); if (!f) throw { code:'refused', message:'No está en la base' };
  return { ...item, ...foodItem(f, item.grams || unitGrams(f) * (Number(item.qty) || 1), item.qty, item.unit, 'medium'), id:item.id, name:item.name, prep:item.prep };
};
runAIBriefing = async function () {
  const box = $('#aiBrief'); box.classList.remove('hidden');
  const dp = dayPlan(dkey()), r = remainingNow(), ci = today().checkin, ex = expiring(2), st = learnStats(), nextType = guessType(), sug = suggestMeals(nextType, 1)[0];
  const text = lines(
    dp.kind === 'match' ? 'Hoy todo gira alrededor del partido: come bien 3 horas antes, hidrátate y calienta completo.' : dp.kind === 'rugby' ? 'Hoy tu prioridad es el entreno de rugby; lo demás, suave.' : dp.code && dp.kind === 'train' ? `Prioridad de hoy: ${dp.title.toLowerCase()} (~${buildProgramWO(dp.code, dkey()).est} min), ya está listo en Entreno.` : 'Hoy es día libre: una caminata suma sin cansarte.',
    r.tg ? `Comida: llevas ${r0(r.t.kcal)} de ${r.tg.kcal} kcal y ${r0(r.t.p)} de ${r.tg.p} g de proteína.` : 'Activa tu plan en Nutrición → Mi plan para que te diga cuánto te queda.',
    sug ? `Para tu ${TYPE_LABEL[nextType]} te sugiero ${sug.r.n.toLowerCase()} (~${Math.round(sug.r.est.kcal * sug.x)} kcal).` : '',
    ex.length ? `Usa pronto: ${ex.slice(0, 3).map(i => i.name).join(', ')}.` : '',
    !ci ? 'Falta tu chequeo de hoy: energía, hombro y digestión, 30 segundos.' : '',
    st.byType[nextType]?.time ? `Sueles comer tu ${TYPE_LABEL[nextType]} hacia las ${st.byType[nextType].time}.` : '');
  S.aiBrief = text; box.innerHTML = fmtText(text);
};
runDayInsight = async function () {
  const box = $('#dayInsight'); box.classList.remove('hidden');
  const k = S.nday, meals = mealsOn(k), t = dayTotals(k), tg = targetsFor(k);
  const veg = meals.some(m => m.items.some(i => { const f = matchFood(i.name); return f && (f.cat === 'Verduras' || f.cat === 'Frutas'); }));
  const protMeals = meals.filter(m => itemTotals(m.items).p >= 20).length;
  const text = lines(
    `Llevas ${meals.length} ${meals.length === 1 ? 'comida' : 'comidas'} con unas ${r0(t.kcal)} kcal${tg ? ` de ${tg.kcal}` : ''} y ${r0(t.p)} g de proteína${tg ? ` de ${tg.p}` : ''}.`,
    protMeals >= Math.min(2, meals.length) ? 'Bien: la proteína está repartida en tus comidas.' : 'La proteína está concentrada en pocas comidas; intenta 25 a 35 g en cada una.',
    veg ? 'Hay frutas o verduras en el día, eso suma fibra y saciedad.' : 'Aún no hay verduras ni frutas hoy: agrega ensalada o una fruta en la próxima comida.',
    r0(t.f) > (tg ? tg.f : 75) ? 'La grasa del día ya va alta: la próxima comida que sea asada o sudada, no frita.' : '',
    waterOn(k) < 1500 ? `Agua: ${(waterOn(k) / 1000).toFixed(1)} L; súmale un vaso ahora.` : '');
  S.dayInsight = text; box.innerHTML = fmtText(text);
  $('#dayInsightBtn').disabled = false;
};
runPlan = async function () {
  S.planBusy = true; S.planErr = ''; render();
  await new Promise(r => setTimeout(r, 250));
  try { const plan = buildPlan(S.planDays || 3, { focus:S.planFocus || [] }); delete plan.shoppingRaw; S.nutri.plan = plan; await saveDoc('nutri'); }
  catch (e) { console.error(e); S.planErr = 'No se pudo armar el menú. Intenta de nuevo.'; }
  S.planBusy = false; render();
};
swapPlanMeal = async function (di, mi) {
  const plan = S.nutri.plan, cur = plan.days[di].meals[mi], used = plan.days.flatMap(d => d.meals.map(m => m.libId));
  const tgK = cur.estimate?.kcal || 450;
  const pick = pickRecipe(cur.type, tgK, { dt:dayTypeOf(plan.days[di].date || dkey()), focus:S.planFocus || [], used:[...used, cur.libId, cur.libId], toks:dislikeTokens() });
  plan.days[di].meals[mi] = recipeToPlanMeal(pick.r, pick.x, 'Cambio sugerido.', cur.type);
  await saveDoc('nutri'); render();
};
makeRecipe = async function (request) {
  const res = searchRecipes(request).filter(x => !x.blocked);
  let r = res[0]?.r;
  if (!r) { const words = BN(request).split(' ').filter(w => w.length > 3); r = RECIPES.map(x => ({ x, s:words.filter(w => BN(x.n + ' ' + x.ing.map(i => i.food?.n).join(' ')).includes(w)).length })).sort((a, b) => b.s - a.s).find(o => o.s > 0)?.x; }
  if (!r) { S.rcErr = `No encontré una receta para "${request}". Mira el recetario completo en la pestaña Biblioteca.`; render(); return; }
  const rec = recipeToApp(r); S.nutri.recipes = [rec, ...(S.nutri.recipes || []).filter(x => x.libId !== r.id)].slice(0, 30);
  await saveDoc('nutri'); S.rcDraft = ''; S.rcErr = ''; render(); openRecipe(rec.id);
};
runPatterns = async function () {
  const n = S.trendN || 7, d = trendData(n), box = $('#patOut'); box.classList.remove('hidden');
  const st = learnStats(), tg = TG();
  const text = lines(
    `Registraste comida ${d.logged.length} de ${n} días.${d.logged.length < n * .6 ? ' Con más días registrados la lectura será más precisa.' : ''}`,
    d.first ? `Tu primera comida suele ser hacia las ${d.first} y la última hacia las ${d.last}.` : '',
    `En los días registrados promedias ~${r0(d.avg.kcal)} kcal, ${r0(d.avg.p)} g de proteína y ${r0(d.avg.fib)} g de fibra${tg ? ` (metas: ${tg.base.kcal} kcal, ${tg.base.protein} g de proteína, ${tg.base.fiber} g de fibra)` : ''}.`,
    d.avg.fib < 20 ? 'La fibra está baja: más fríjol, lenteja, avena, frutas enteras y verduras.' : 'Buena fibra.',
    d.top.length ? `Tus básicos: ${d.top.slice(0, 5).map(([f]) => f).join(', ')}.` : '',
    'Experimentos para la próxima semana:', `• Agrega una porción de verduras al almuerzo y la cena.`, `• ${d.avg.p < (tg ? tg.base.protein * .85 : 120) ? 'Sube la proteína del desayuno (huevos, yogur griego o atún).' : 'Mantén la proteína: vas bien.'}`);
  S.nutri.insight = { text, at:new Date().toISOString(), days:n }; await saveDoc('nutri'); render();
};
scanPhotos = async function () { throw { code:'images_unavailable' }; };
cookNow = async function () {
  if (!pantryItems().length) { toast('Tu despensa está vacía. Agrega productos en Mercado.', true); return; }
  const type = guessType(), toks = dislikeTokens();
  const ideas = RECIPES.filter(r => (r.type === type || (type === 'dinner' && r.type === 'lunch')) && !recipeBlocked(r, toks)).map(r => ({ r, c:pantryCover(r) })).filter(x => x.c > 0).sort((a, b) => b.c - a.c).slice(0, 3);
  S.cookIdeas = ideas.map(({ r }) => ({ name:r.n, emoji:r.e, uses:r.ing.filter(i => { const m = i.food && pantryMatch(i.food.n); return m && !m.staple; }).map(i => i.food.n), prep:r.t, est:{ kcal:r.est.kcal, p:r.est.p, c:r.est.c, f:r.est.f }, steps:r.steps, why:`Tienes ${Math.round(pantryCover(r) * 100)} % de los ingredientes.`, type, libId:r.id }));
  S.cookErr = S.cookIdeas.length ? '' : 'Con lo que hay en la despensa no armo una receta completa. Mira la Biblioteca o arma tu mercado.';
  render();
};
buildWeek = async function () {
  const W = S.weekCfg; S.weekBusy = true; S.weekErr = ''; render();
  await new Promise(r => setTimeout(r, 300));
  try {
    const plan = buildPlan(W.days, { focus:['Económico'], pantryFirst:true, people:W.people });
    const known = S.market.prices || {};
    const list = plan.shoppingRaw.map(s => { const kp = known[normName(s.item)]; const st = W.stores.length ? (W.stores.includes(guessStore(s.item)) ? guessStore(s.item) : W.stores[0]) : 'D1';
      return { id:uid(), item:s.item, qty:s.qty, cat:s.cat, store:st, est:kp?.price || 0, priceSrc:kp ? 'receipt' : 'ai', essential:true, why:'', checked:false, source:'ai' }; });
    delete plan.shoppingRaw; plan.source = 'market'; plan.title = `Semana de ${W.days} días con lo que tienes`;
    S.nutri.plan = plan;
    S.market.list = [...marketList().filter(x => x.source !== 'ai' || x.checked), ...list];
    S.market.week = { generatedAt:plan.generatedAt, use_first:expiring(4).slice(0, 6).map(i => { const r = RECIPES.find(rr => rr.ing.some(g => { const m = g.food && pantryMatch(g.food.n); return m && m.id === i.id; })); return { item:i.name, how:r ? `En ${r.n.toLowerCase()}.` : 'Úsalo en la próxima comida.' }; }),
      budget_note:'Los precios aparecen cuando escaneas facturas o escribes lo que pagas: JARVIS aprende tus precios reales.', tripBudget:W.budget || null, stores:W.stores };
    await Promise.all([saveDoc('nutri'), saveDoc('market')]);
    S.mtab = 'list'; toast('Tu semana está planeada y la lista de compras está lista.');
  } catch (e) { console.error(e); S.weekErr = 'No se pudo armar la semana. Intenta de nuevo.'; }
  S.weekBusy = false; render();
};
deductMeal = async function (meal) {
  if (!pantryItems().length) return toast('Tu despensa está vacía, no hay nada que restar.', true);
  const ch = [];
  (meal.items || []).forEach(it => { const m = pantryMatch(it.name); if (!m || m.staple || ch.some(c => c.item.id === m.id)) return;
    const g = Number(it.grams) || 0; let sub = 1;
    if (m.unit === 'g' || m.unit === 'ml') sub = g || 100; else if (m.unit === 'kg' || m.unit === 'l') sub = r1((g || 100) / 1000); else if (m.unit === 'libra') sub = r1((g || 250) / 500); else sub = Math.max(1, Math.round(Number(it.qty) || 1));
    ch.push({ item:m, subtract:Math.min(m.qty, sub) }); });
  if (!ch.length) return toast('Ningún producto de la despensa coincide con esta comida.');
  modal(`<h3>¿Actualizar despensa?</h3><p class="muted" style="font-size:14px;margin:0 0 12px">Productos usados en “${esc(meal.name)}”. Ajusta las cantidades antes de confirmar.</p>
    ${ch.map((c, i) => `<div class="ded-row"><span>${esc(c.item.name)}<small class="muted"> tienes ${c.item.qty} ${esc(c.item.unit)}</small></span><div class="input-unit"><input class="input mono" type="text" inputmode="decimal" value="${r1(c.subtract)}" data-ded="${i}" style="width:90px"><span>${esc(c.item.unit)}</span></div></div>`).join('')}
    <div class="modal-actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="dedOk">Restar de la despensa</button></div>`, (L, close) => {
    $('#dedOk', L).addEventListener('click', async () => { const logs = [];
      $$('[data-ded]', L).forEach(inp => { const c = ch[Number(inp.dataset.ded)]; const v = Math.max(0, num(inp.value) || 0); if (!v) return; c.item.qty = Math.max(0, r1(c.item.qty - v)); logs.push({ name:c.item.name, delta:-v, unit:c.item.unit, reason:'meal: ' + meal.name }); });
      S.pantry.items = pantryItems().filter(i => i.qty > 0); pantryLog(logs); await saveDoc('pantry'); close(); toast('Despensa actualizada.'); render(); });
  });
};
const FOCUS_CODE = { 'Fuerza tren inferior':'A', 'Fuerza cuerpo completo':'D', 'Acondicionamiento bajo impacto':'C', 'Rugby: velocidad y cambios de dirección':'C', 'Core y estabilidad':'A', 'Movilidad':'R', 'Recuperación':'R' };
generateWorkout = async function () {
  const G = S.genCfg; S.genBusy = true; S.genErr = ''; render();
  try {
    let code = FOCUS_CODE[G.focus] || 'A';
    const w = buildProgramWO(code, dkey());
    if (G.focus === 'Core y estabilidad') w.blocks = w.blocks.filter(b => b.name === 'Core').map(b => ({ ...b, rounds:b.rounds + 1 }));
    if (G.focus.startsWith('Rugby')) w.blocks = w.blocks.filter(b => !b.name.startsWith('Core'));
    let guard = 0;
    while (estMinutes(w) > G.minutes * 1.1 && guard++ < 40) {
      const big = [...w.blocks].sort((a, b) => b.ex.length - a.ex.length)[0];
      const st = w.blocks.find(b => b.format !== 'circuit' && b.ex.some(x => x.sets > 2));
      if (st) st.ex.forEach(x => { if (x.sets > 2) x.sets--; });
      else if (w.blocks.some(b => b.format === 'circuit' && b.rounds > 1)) w.blocks.forEach(b => { if (b.format === 'circuit' && b.rounds > 1) b.rounds--; });
      else if (big && big.ex.length > 2) big.ex.pop();
      else if (w.warmup.length > 2) w.warmup.pop();
      else if (w.cooldown.length > 1) w.cooldown.pop();
      else break;
    }
    w.id = uid(); w.program = false; w.window = G.window; w.focus = G.focus;
    w.title = `${G.focus} · ${G.minutes} min`;
    w.est = estMinutes(w);
    w.rationale = `Armado con los ejercicios permitidos hoy para tu hombro y tu equipo.${defaultGen().focus === 'Recuperación' && G.focus !== 'Recuperación' ? ' Ojo: por tu chequeo o el rugby, JARVIS recomendaba recuperación hoy.' : ''}`;
    S.plannedWO = w; try { localStorage.setItem('jarvis-planned-wo', JSON.stringify(w)); } catch {}
  } catch (e) { console.error(e); S.genErr = 'No se pudo armar el entreno. Cambia el enfoque e intenta de nuevo.'; }
  S.genBusy = false; render();
};
runReview = async function () {
  const st = weekStats(); S.revBusy = true; render();
  const good = [st.workouts ? `${st.workouts} entrenos` : '', st.missions >= 4 ? `${st.missions} misiones cumplidas` : '', st.mealDays >= 4 ? `${st.mealDays} días con comidas registradas` : '', st.rugby ? `${st.rugby} sesiones de rugby` : ''].filter(Boolean);
  const text = lines(
    good.length ? `Lo bueno: ${good.join(', ')}.` : 'Esta semana fue de arranque: lo importante es volver a encender el sistema.',
    st.wChange != null ? `Peso promedio ${st.weight} kg (${st.wChange > 0 ? '+' : ''}${st.wChange} kg vs la semana anterior). El peso semana a semana tiene ruido; mira la tendencia de 3 a 4 semanas.` : 'Pésate 2 veces por semana para tener tendencia.',
    st.mealDays < 4 ? 'El reto principal: registrar comida más días. Una frase basta.' : st.prot && st.protTgt && st.prot < st.protTgt * .85 ? `El reto principal: la proteína (${st.prot} de ${st.protTgt} g).` : st.workouts < st.planned ? `El reto principal: completar los entrenos del programa (${st.workouts} de ${st.planned}).` : 'Sin un reto grande: sostén lo que vienes haciendo.',
    'Tres ajustes para la próxima semana:',
    `• Entreno: ${st.workouts < st.planned ? 'agenda tus días de entreno en el celular con Google Calendar desde Ajustes.' : 'sube una repetición o un poco de carga donde lo sugiera JARVIS.'}`,
    `• Comida: ${st.prot && st.protTgt && st.prot < st.protTgt ? 'proteína en el desayuno todos los días.' : 'arma tu menú semanal en Nutrición → Menús y compra con la lista.'}`,
    `• Hábito: ${st.water < 2000 ? 'agua: un vaso con cada comida.' : st.checkins < 5 ? 'chequeo diario de 30 segundos para que JARVIS ajuste el día.' : 'acostarte 30 minutos antes dos noches.'}`);
  SET().reviews = [{ week:st.from, at:new Date().toISOString(), text, stats:st }, ...(SET().reviews || []).filter(r => r.week !== st.from)].slice(0, 12);
  await saveSettings(); toast('Revisión semanal guardada.'); S.revBusy = false; render();
};
sendChat = async function (text) {
  text = String(text || '').trim(); if (!text || S.chatBusy) return;
  S.chat.messages = [...(S.chat.messages || []), { role:'user', content:text.slice(0, 2000), at:new Date().toISOString() }];
  S.chatBusy = true; render();
  const log = $('#chatLog'); const bubble = document.createElement('div'); bubble.className = 'msg jarvis'; bubble.innerHTML = '<span class="who">JARVIS</span><span class="pulse">Pensando…</span>'; log.appendChild(bubble); log.scrollTop = log.scrollHeight;
  await new Promise(r => setTimeout(r, 450));
  let res; try { res = reply(text); } catch (e) { console.error(e); res = { text:'Tuve un problema con esa pregunta. Intenta con otras palabras.', logs:[], mems:[] }; }
  S.pendingMem = [...(S.pendingMem || []), ...res.mems.filter(t => !(S.memory.items || []).some(i => i.text.toLowerCase() === t.toLowerCase()))].slice(-3);
  S.pendingLogs = [...(S.pendingLogs || []), ...res.logs].slice(-2);
  S.chat.messages = [...S.chat.messages, { role:'assistant', content:res.text, at:new Date().toISOString() }].slice(-80);
  S.chatBusy = false; try { await saveDoc('chat'); } catch {}
  render(); onJarvisReply(res.text);
};
const _saveReview = saveReview;
saveReview = async function () { if (S.review) learnFromItems(S.review.items); return _saveReview(); };

/* ---------- 8. Sugerencias y buscador en el registro ---------- */
const _nToday = nToday;
nToday = function () {
  let h = _nToday();
  if (!S.review) {
    const type = guessType(), sug = suggestionsFor(type), learned = learnStats().byType[type];
    const chips = `<div class="fav-row" style="border-top:0;padding-top:0;margin-top:12px"><span class="muted" style="font-size:13px">${learned ? 'Tus básicos de ' : 'Rápido para '}${TYPE_LABEL[type]}:</span>${sug.map(f => `<button class="chip" data-qf="${f.id}">${esc(f.n.replace(/ \(.*\)/, ''))}</button>`).join('')}<button class="chip" data-ntab-go="library">🔍 Buscar alimento</button></div>`;
    h = h.replace('<div class="log-actions">', chips + '<div class="log-actions">');
  }
  return h;
};
const _bindNToday = bindNToday;
bindNToday = function () {
  _bindNToday();
  $$('[data-qf]').forEach(b => b.addEventListener('click', () => { const f = FOOD_BY_ID[b.dataset.qf]; newReview({ type:$('#logType')?.value || guessType(), source:'manual', analyzed:true, items:[foodItem(f, B().portions[f.id] ? B().portions[f.id] * portionCount(f) : f.g, portionCount(f), f.por.replace(/^\d+\s*/, ''), 'medium')], notes:['Agrega más alimentos con el buscador o los botones.'] }); render(); window.scrollTo({ top:($('.review')?.offsetTop || 0) - 20, behavior:'smooth' }); }));
  $$('[data-ntab-go]').forEach(b => b.addEventListener('click', () => { S.ntab = 'library'; S.libTab = 'foods'; render(); }));
};
const _reviewPanel = reviewPanel;
reviewPanel = function (R) {
  const find = `<div class="field" style="margin:14px 0 0"><label for="rvFind">Agregar alimento de la base</label><input class="input" id="rvFind" placeholder="Busca: arepa, pollo, jugo, ajiaco…" autocomplete="off" value="${esc(S.rvFind || '')}"><div id="rvFindRes" class="chips" style="margin-top:8px"></div></div>`;
  return _reviewPanel(R).replace('<div class="rv-actions">', find + '<div class="rv-actions">');
};
const _bindReview = bindReview;
bindReview = function () {
  _bindReview();
  const inp = $('#rvFind'), out = $('#rvFindRes'); if (!inp) return;
  const show = () => { S.rvFind = inp.value; const res = inp.value.trim() ? findFoods(inp.value, 8) : suggestionsFor(S.review?.type || guessType()).slice(0, 6);
    out.innerHTML = res.map(f => `<button class="chip" data-rvadd="${f.id}">+ ${esc(f.n)} <small class="muted">${esc(f.por)}</small></button>`).join('') || '<span class="muted" style="font-size:13px">No lo encuentro. Usa "Agregar" para escribirlo a mano.</span>';
    $$('[data-rvadd]', out).forEach(b => b.addEventListener('click', () => { const f = FOOD_BY_ID[b.dataset.rvadd]; S.review.items.push(foodItem(f, B().portions[f.id] ? B().portions[f.id] * portionCount(f) : f.g, portionCount(f), f.por.replace(/^\d+\s*/, ''), 'medium')); S.review.analyzed = true; S.review.error = ''; S.rvFind = ''; render(); })); };
  inp.addEventListener('input', show); show();
};

/* ---------- 9. Mercado: agregar rápido a la despensa ---------- */
mScan = function () {
  const q = S.mkq || '', res = q.trim() ? findFoods(q, 12) : FOODS.filter(f => ['huevo','pechuga','arroz','frijol','lenteja','atun-agua','arepa','papa','tomate','cebolla','banano','leche-desc','avena','queso-campesino','platano-verde','maduro'].includes(f.id));
  return `<section class="card">
    <div class="card-head"><h2>Agregar rápido a la despensa</h2><span class="sub">Toca para sumar una porción típica</span></div>
    <input class="input" id="mkq" placeholder="Busca un producto: pollo, arroz, huevos…" value="${esc(q)}" autocomplete="off">
    <div class="exgrid" style="margin-top:12px">${res.map(f => `<button class="exc" data-mkadd="${f.id}"><b>${esc(f.n)}</b><small class="muted">${esc(catL(CAT_APP[f.cat] || 'Other'))} · se guarda en ${locLabel(DEF_LOC[CAT_APP[f.cat]] || 'pantry').toLowerCase()}</small><span class="tag plain">+ Agregar</span></button>`).join('')}</div>
    <p class="muted" style="font-size:12px;margin:12px 0 0">Para algo que no está aquí usa <b>Agregar</b> en Despensa. Al terminar una compra en la Lista, todo pasa solo a la despensa.</p>
  </section>`;
};
bindMScan = function () {
  const i = $('#mkq'); i?.addEventListener('input', e => { S.mkq = e.target.value; const pos = e.target.selectionStart; render(); const n = $('#mkq'); n.focus(); n.setSelectionRange(pos, pos); });
  $$('[data-mkadd]').forEach(b => b.addEventListener('click', async () => { const f = FOOD_BY_ID[b.dataset.mkadd], cat = CAT_APP[f.cat] || 'Other';
    const unit = /unidad|huevo|arepa|lata|filete/.test(f.por) && !/taza/.test(f.por) ? 'unidad' : f.cat === 'Bebidas' || /leche/.test(f.id) ? 'l' : 'libra';
    const qty = f.id === 'huevo' ? 30 : unit === 'unidad' ? 1 : 1;
    await addToPantry([{ name:f.n, cat, qty, unit, loc:DEF_LOC[cat] || 'pantry', expires:dkey(addDays(new Date(), SHELF[cat] || 30)), expEst:true, opened:false, cost:null }], 'manual');
    toast(`${f.n}: agregado (${qty} ${unit}). Ajusta la cantidad en Despensa.`); }));
};

/* ---------- 10. Biblioteca ---------- */
function nLibrary() {
  const tab = S.libTab || 'recipes';
  const tabs = [['recipes', `Recetas (${RECIPES.length})`], ['menus', 'Menús'], ['foods', `Alimentos (${FOODS.length})`], ['guides', 'Guías']];
  const body = { recipes:libRecipes, menus:libMenus, foods:libFoods, guides:libGuides }[tab]();
  return `<div class="seg" role="tablist" style="margin-bottom:14px;width:max-content;max-width:100%;overflow-x:auto">${tabs.map(([id, l]) => `<button role="tab" aria-checked="${tab === id}" data-libtab="${id}">${l}</button>`).join('')}</div>${body}`;
}
const LIB_FILTERS = [['breakfast','Desayuno'],['lunch','Almuerzo'],['dinner','Cena'],['snack','Algo'],['proteina','Alta proteína'],['bajo-grasa','Bajo en grasa'],['rugby','Rugby'],['suave','Suave'],['economico','Económico'],['rapido','Rápido'],['vegetariano','Sin carne'],['pantry','Con lo que tengo']];
function libRecipes() {
  const f = S.libF || [], res = searchRecipes(S.libQ || '', f);
  return `<input class="input" id="libQ" placeholder="Busca por nombre o ingrediente: pollo, lenteja, ajiaco…" value="${esc(S.libQ || '')}" autocomplete="off">
    <div class="chips" style="margin:10px 0 14px">${LIB_FILTERS.map(([v, l]) => `<button class="chip" aria-pressed="${f.includes(v)}" data-libf="${v}">${l}</button>`).join('')}</div>
    ${res.length ? `<div class="grid recipe-grid" style="margin-top:0">${res.map(({ r, blocked }) => `<button class="recipe" data-libr="${r.id}" style="${blocked ? 'opacity:.5' : ''}"><span class="r-cover" aria-hidden="true">${r.e}</span><span class="r-body"><b>${esc(r.n)}</b><small class="muted">${TYPE_LABEL[r.type]}, ${r.t} min${blocked ? ', tiene algo que evitas' : ''}${B().ratings[r.id] > 0 ? ' · 👍' : B().ratings[r.id] < 0 ? ' · 👎' : ''}</small><small class="mono">~${r.est.kcal} kcal · P ${Math.round(r.est.p)} · G ${Math.round(r.est.f)}</small></span></button>`).join('')}</div>` : '<p class="muted" style="font-size:14px">Nada con esos filtros. Quita alguno.</p>'}`;
}
function openLibRecipe(id) {
  const r = RECIPE_BY_ID[id]; let x = S.libX || 1;
  const html = () => { const e = r.est; return `<div class="rmodal"><div class="r-hero"><span>${r.e}</span><div><h3>${esc(r.n)}</h3><p class="muted" style="margin:0;font-size:12px">${TYPE_LABEL[r.type]} · ${r.t} min · ${r.tags.map(t => ({ proteina:'alta proteína', 'bajo-grasa':'bajo en grasa', rugby:'rugby', suave:'suave', economico:'económico', rapido:'rápido', fibra:'fibra', vegetariano:'sin carne' }[t] || t)).join(', ')}</p></div></div>
    <div class="chips" style="margin:12px 0 4px" id="rx">${[.5, .75, 1, 1.25, 1.5, 2].map(v => `<button class="chip" aria-pressed="${x === v}" data-x="${v}">×${fmtQty(v)}</button>`).join('')}<span class="muted" style="font-size:12px;align-self:center">porciones</span></div>
    <div class="pm-est mono" style="margin:8px 0"><span>~${Math.round(e.kcal * x)} kcal</span><span>P ${Math.round(e.p * x)} g</span><span>C ${Math.round(e.c * x)} g</span><span>G ${Math.round(e.f * x)} g</span><span>Fibra ${Math.round(e.fib * x)} g</span></div>
    <h4>Ingredientes</h4><ul class="shop">${r.ing.map(i => `<li><span>${esc(i.food?.n || i.id)}${(() => { const m = i.food && pantryMatch(i.food.n); return m && !m.staple ? ' <small style="color:var(--ok)">✓ en casa</small>' : ''; })()}</span><span class="muted" style="font-size:13px;text-align:right;flex:none;max-width:48%">${esc(i.label)}${x !== 1 ? ` ×${fmtQty(x)}` : ''}<br><span class="mono">${Math.round(i.g * x)} g</span></span></li>`).join('')}</ul>
    <h4>Preparación</h4><ol class="steps-ol">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <p class="muted" style="font-size:12px;margin:10px 0 0">Calorías y macros calculados con la base de alimentos de JARVIS: son estimados.</p></div>
    <div class="modal-actions" style="flex-wrap:wrap;justify-content:flex-start"><button class="btn sm ${B().ratings[r.id] > 0 ? 'primary' : ''}" data-rate="1" aria-label="Me gusta">👍</button><button class="btn sm ${B().ratings[r.id] < 0 ? 'primary' : ''}" data-rate="-1" aria-label="No me gusta">👎</button><span style="flex:1"></span><button class="btn sm ghost" data-close>Cerrar</button><button class="btn sm" id="rList">${ic('cart')}Faltantes a la lista</button><button class="btn sm" id="rSave">Guardar</button><button class="btn sm primary" id="rLogLib">Lo comí</button></div>`; };
  modal(html(), (L, close) => {
    $('.modal', L).classList.add('wide');
    const bind = () => {
      $$('[data-x]', L).forEach(b => b.addEventListener('click', () => { x = S.libX = Number(b.dataset.x); $('.modal', L).innerHTML = html(); bind(); }));
      $$('[data-rate]', L).forEach(b => b.addEventListener('click', async () => { const v = Number(b.dataset.rate); B().ratings[r.id] = B().ratings[r.id] === v ? 0 : v; await saveDoc('brain'); $('.modal', L).innerHTML = html(); bind(); toast(v > 0 ? 'Anotado: te lo sugeriré más.' : 'Anotado: te lo sugeriré menos.'); }));
      $('#rList', L).addEventListener('click', () => { const miss = r.ing.filter(i => i.food && !['aceite','agua','tinto','azucar','miel'].includes(i.id)).map(i => i.food.n).filter(n => !pantryMatch(n)); if (!miss.length) return toast('Ya tienes todo en la despensa.'); addMissingToList(miss); });
      $('#rSave', L).addEventListener('click', async () => { const rec = recipeToApp(r, x); S.nutri.recipes = [rec, ...(S.nutri.recipes || []).filter(z => z.libId !== r.id)].slice(0, 30); await saveDoc('nutri'); toast('Guardada en Mis recetas.'); });
      $('#rLogLib', L).addEventListener('click', async () => { await logRecipe(r, x, r.type === 'lunch' && guessType() === 'dinner' ? 'dinner' : guessType()); if (!B().ratings[r.id]) { B().ratings[r.id] = .5; saveDoc('brain'); } close(); toast('Registrada en tu día. ¡Buen provecho!'); render(); });
      $('[data-close]', L)?.addEventListener('click', close);
    };
    bind();
  });
}
function libMenus() {
  const tg = TG(), wk = mondayOf(new Date()), days = Array.from({ length:7 }, (_, i) => dkey(addDays(wk, i))), plan = S.nutri.plan;
  return `<section class="card tg-hero"><div class="card-head"><h2>Menús hechos a tu medida</h2><span class="tag ${tg ? 'reported' : 'estimate'}">${tg ? 'Con tus metas' : 'Sin metas activas'}</span></div>
    <p class="muted" style="margin:-4px 0 12px;font-size:14px">JARVIS elige del recetario, ajusta las porciones a las calorías de cada día (más en días de rugby), evita lo que no te gusta, prioriza lo que tienes en casa y aprende de las recetas que calificas.</p>
    ${tg ? `<div class="week-k">${days.map(d => { const t = targetsFor(d); return `<div class="${d === dkey() ? 'today' : ''}"><small>${dowL(DOW[parseKey(d).getDay()])}</small><b class="mono">${t.kcal}</b><i>${t.dt === 'rugby' ? '🏉' : t.dt === 'rest' ? '😴' : '💪'}</i></div>`; }).join('')}</div>` : `<div class="banner info" style="margin-bottom:12px">${ic('info')}<div style="flex:1">Activa tus metas en Mi plan para que las porciones cuadren exacto. Mientras tanto uso ~${refKcal()} kcal al día.</div><button class="btn sm" data-ntab-go2="targets">Mi plan</button></div>`}
    <div class="log-actions"><button class="btn primary" data-menu="1">${ic('sparkle')}Menú de hoy</button><button class="btn primary" data-menu="3">3 días</button><button class="btn primary" data-menu="7">Semana completa</button><button class="btn" data-menu-mk>${ic('cart')}Semana + mercado</button></div>
    ${plan ? `<p class="muted" style="font-size:13px;margin:12px 0 0">Tienes un menú: ${esc(plan.title)}. <button class="btn sm ghost" data-ntab-go2="plan">Verlo</button></p>` : ''}</section>`;
}
function libFoods() {
  const q = S.libFq || '', cat = S.libCat || '';
  const cats = [...new Set(FOODS.map(f => f.cat))];
  let res = q.trim() ? findFoods(q, 40) : FOODS.filter(f => !cat || f.cat === cat);
  if (q.trim() && cat) res = res.filter(f => f.cat === cat);
  return `<input class="input" id="libFq" placeholder="Busca un alimento o plato" value="${esc(q)}" autocomplete="off">
    <div class="chips" style="margin:10px 0 14px"><button class="chip" aria-pressed="${!cat}" data-libcat="">Todos</button>${cats.map(c => `<button class="chip" aria-pressed="${cat === c}" data-libcat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <section class="card" style="padding:6px 16px"><ul class="shop">${res.slice(0, 80).map(f => { const k = f.g / 100; return `<li><span><b style="font-weight:500">${esc(f.n)}</b>${f.tags.includes('bajo-grasa') ? ' <span class="tag measured" style="font-size:10px;padding:2px 5px">bajo en grasa</span>' : f.tags.includes('frito') || f.tags.includes('alto-grasa') ? ' <span class="tag estimate" style="font-size:10px;padding:2px 5px">alto en grasa</span>' : ''}<br><small class="muted">${esc(f.por)} (${f.g} g): ~${Math.round(f.kcal * k)} kcal · P ${r1(f.p * k)} · C ${r1(f.c * k)} · G ${r1(f.f * k)}</small></span><button class="btn sm" data-fadd="${f.id}">+ Hoy</button></li>`; }).join('')}</ul></section>
    <p class="muted" style="font-size:12px;margin:10px 0 0">Valores aproximados por porción típica, preparación casera. Referencia: tablas de composición de alimentos.</p>`;
}
function libGuides() {
  return `<div class="pexl">${GUIDES.map(g => `<details class="card flat" style="padding:14px 16px"><summary style="cursor:pointer;list-style:none;display:flex;gap:12px;align-items:center"><span style="font-size:24px">${g.e}</span><span style="flex:1"><b style="font-weight:600">${esc(g.t)}</b><br><small class="muted">${esc(g.s)}</small></span><span class="muted">›</span></summary><ul class="notes" style="margin-top:12px;font-size:14px">${g.b.map(b => `<li>${esc(b)}</li>`).join('')}</ul></details>`).join('')}</div>
    <p class="muted" style="font-size:12px;margin:12px 0 0">Conocimiento general de nutrición. No reemplaza a tu médico ni a tu nutricionista, sobre todo por tu cirugía.</p>`;
}
function bindNLibrary() {
  $$('[data-libtab]').forEach(b => b.addEventListener('click', () => { S.libTab = b.dataset.libtab; render(); }));
  const live = (id, key) => $(id)?.addEventListener('input', e => { S[key] = e.target.value; const pos = e.target.selectionStart; render(); const n = $(id); n.focus(); n.setSelectionRange(pos, pos); });
  live('#libQ', 'libQ'); live('#libFq', 'libFq');
  $$('[data-libf]').forEach(b => b.addEventListener('click', () => { const v = b.dataset.libf, f = S.libF || []; S.libF = f.includes(v) ? f.filter(x => x !== v) : [...f.filter(x => !(['breakfast','lunch','dinner','snack'].includes(v) && ['breakfast','lunch','dinner','snack'].includes(x))), v]; render(); }));
  $$('[data-libcat]').forEach(b => b.addEventListener('click', () => { S.libCat = b.dataset.libcat; render(); }));
  $$('[data-libr]').forEach(b => b.addEventListener('click', () => { S.libX = 1; openLibRecipe(b.dataset.libr); }));
  $$('[data-menu]').forEach(b => b.addEventListener('click', async () => { S.planDays = Number(b.dataset.menu); S.planFocus = S.planFocus || []; await runPlan(); S.ntab = 'plan'; render(); window.scrollTo(0, 0); }));
  $('[data-menu-mk]')?.addEventListener('click', () => { S.mtab = 'week'; location.hash = '#market'; });
  $$('[data-ntab-go2]').forEach(b => b.addEventListener('click', () => { S.ntab = b.dataset.ntabGo2; render(); }));
  $$('[data-fadd]').forEach(b => b.addEventListener('click', () => { const f = FOOD_BY_ID[b.dataset.fadd]; S.ntab = 'today'; S.nday = dkey();
    newReview({ type:guessType(), source:'manual', analyzed:true, items:[foodItem(f, B().portions[f.id] ? B().portions[f.id] * portionCount(f) : f.g, portionCount(f), f.por.replace(/^\d+\s*/, ''), 'medium')], notes:['Ajusta los gramos si tu porción fue distinta y agrega más alimentos abajo.'] }); render(); window.scrollTo(0, 0); }));
}

/* ---------- 11. Memoria y aprendizaje ---------- */
const _viewJarvis = viewJarvis, _bindJarvis = bindJarvis;
viewJarvis = function () {
  const t = S.jtab || 'chat';
  const seg = `<div class="seg" role="tablist" style="margin-bottom:12px;width:max-content"><button role="tab" aria-checked="${t === 'chat'}" data-jtab="chat">${ic('chat').replace('<svg', '<svg width="15" height="15" style="vertical-align:-2px;margin-right:6px"')}Chat</button><button role="tab" aria-checked="${t === 'mem'}" data-jtab="mem">${ic('sparkle').replace('<svg', '<svg width="15" height="15" style="vertical-align:-2px;margin-right:6px"')}Memoria y aprendizaje</button></div>`;
  return seg + (t === 'mem' ? memoryView() : _viewJarvis().replace('Ve tu perfil, chequeos, medidas y memoria guardada', 'Funciona sin conexión con tus datos, el recetario y lo que aprende de ti'));
};
bindJarvis = function () {
  $$('[data-jtab]').forEach(b => b.addEventListener('click', () => { S.jtab = b.dataset.jtab; render(); }));
  if ((S.jtab || 'chat') === 'mem') return bindMemory();
  _bindJarvis();
};
function memoryView() {
  const st = learnStats(), items = S.memory.items || [], por = Object.entries(B().portions), rat = Object.entries(B().ratings).filter(([, v]) => v);
  const typeCard = type => { const b = st.byType[type]; return `<div class="metric"><div class="lbl">${typeLabel(type)}</div>${b ? `<div class="val" style="font-size:18px">${b.time || '—'}</div><div class="muted" style="font-size:12px">${b.n} registros · ~${b.avgKcal} kcal</div><div style="font-size:12px;color:var(--text2)">${b.top.slice(0, 3).map(x => esc(x.name)).join(', ')}</div>` : '<div class="val empty">Aún aprendiendo</div>'}</div>`; };
  const bestDay = Object.entries(st.weekdays).filter(([, v]) => v.n >= 2).sort((a, b) => b[1].done / b[1].n - a[1].done / a[1].n)[0];
  return `<section class="card tg-hero"><div class="card-head"><h2>Lo que JARVIS ha aprendido de ti</h2><span class="tag reported">En este teléfono</span></div>
    <div class="ls-n" style="margin-bottom:14px"><div><span class="mono">${st.meals}</span><small>comidas analizadas</small></div><div><span class="mono">${st.days}</span><small>días con registro</small></div><div><span class="mono">${por.length}</span><small>porciones personales</small></div><div><span class="mono">${rat.length}</span><small>recetas calificadas</small></div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">${['breakfast','lunch','snack','dinner'].map(typeCard).join('')}</div>
    <ul class="notes" style="font-size:14px;margin-top:14px">
      ${st.days ? `<li>Comes en promedio ~${st.avgKcal} kcal y ${st.avgP} g de proteína en los días que registras.</li>` : ''}
      ${st.trainTime ? `<li>Sueles entrenar hacia las ${st.trainTime} (${st.workouts} entrenos registrados).</li>` : ''}
      ${bestDay ? `<li>Tu día más constante es el ${dowL(bestDay[0]).toLowerCase()}.</li>` : ''}
      ${!st.meals ? '<li>Registra tus comidas unos días y aquí verás tus horarios, tus básicos y tus porciones.</li>' : ''}
    </ul></section>

  ${por.length ? `<section class="card" style="margin-top:16px"><div class="card-head"><h2>Tus porciones</h2><button class="btn sm ghost" id="porReset">Olvidar porciones</button></div><p class="muted" style="margin:-6px 0 10px;font-size:13px">Cuando corriges los gramos, JARVIS aprende tu porción real y la usa la próxima vez.</p>
    <ul class="shop">${por.map(([id, g]) => `<li><span>${esc(FOOD_BY_ID[id]?.n || id)}</span><span class="mono muted">${g} g por ${esc((FOOD_BY_ID[id]?.por || 'porción').replace(/^\d+\s*/, ''))} <small>(típica ${Math.round((FOOD_BY_ID[id]?.g || 0) / portionCount(FOOD_BY_ID[id] || { por:'1' }))} g)</small></span></li>`).join('')}</ul></section>` : ''}

  ${rat.length ? `<section class="card" style="margin-top:16px"><div class="card-head"><h2>Tus gustos en recetas</h2></div><div class="chips">${rat.map(([id, v]) => `<button class="chip static" data-libr2="${id}">${v > 0 ? '👍' : '👎'} ${esc(RECIPE_BY_ID[id]?.n || id)}</button>`).join('')}</div></section>` : ''}

  <section class="card" style="margin-top:16px"><div class="card-head"><h2>Lo que le has contado</h2><span class="sub mono">${items.length}</span></div>
    <p class="muted" style="margin:-6px 0 12px;font-size:13px">Gustos, alergias, horarios o cualquier dato. Si dice "no me gusta" o "soy alérgico", JARVIS lo saca de recetas y menús.</p>
    ${items.length ? items.map(m => `<div class="check" style="gap:12px"><span style="flex:1">${esc(m.text)}</span><button class="btn sm ghost" data-mem-del2="${esc(m.id)}" aria-label="Borrar">${ic('trash')}</button></div>`).join('') : ''}
    <div style="display:flex;gap:8px;margin-top:12px"><input class="input" id="memNew2" maxlength="200" placeholder="Ej.: No me gusta el pescado · Entreno a las 6 a. m."><button class="btn" id="memAdd2">${ic('plus')}Agregar</button></div>
    ${dislikeTokens().length ? `<p class="muted" style="font-size:12px;margin:10px 0 0">Evitando en recetas: ${dislikeTokens().map(esc).join(', ')}.</p>` : ''}
  </section>

  <section class="card flat" style="margin-top:16px"><div class="card-head"><h2>Cómo aprende</h2></div>
    <ul class="notes" style="font-size:13px;margin-top:0"><li><b>Tus horarios y básicos</b>: de cada comida que registras, para sugerirte primero lo que sueles comer.</li><li><b>Tus porciones</b>: cuando corriges gramos.</li><li><b>Tus gustos</b>: de los 👍/👎 en recetas y de lo que le cuentas.</li><li><b>Tus metas</b>: ajusta las calorías cada semana según la tendencia real de tu peso (Mi plan).</li><li>Todo queda en este teléfono. Respáldalo con Exportar en Perfil y ajustes.</li></ul>
    <button class="btn sm danger" id="brainReset">Borrar todo lo aprendido</button></section>`;
}
function bindMemory() {
  $('#memAdd2')?.addEventListener('click', async () => { const t = $('#memNew2').value.trim(); if (!t) return; S.memory.items = [...(S.memory.items || []), { id:uid(), text:t.slice(0, 200), kind:'fact', source:'user', created:new Date().toISOString() }]; await saveDoc('memory'); toast('Guardado en memoria.'); render(); });
  $('#memNew2')?.addEventListener('keydown', e => { if (e.key === 'Enter') $('#memAdd2').click(); });
  $$('[data-mem-del2]').forEach(b => b.addEventListener('click', async () => { S.memory.items = S.memory.items.filter(i => i.id !== b.dataset.memDel2); await saveDoc('memory'); render(); }));
  $$('[data-libr2]').forEach(b => b.addEventListener('click', () => openLibRecipe(b.dataset.libr2)));
  $('#porReset')?.addEventListener('click', async () => { B().portions = {}; await saveDoc('brain'); render(); });
  $('#brainReset')?.addEventListener('click', () => confirmModal('¿Borrar lo aprendido?', 'Se olvidan tus porciones y calificaciones de recetas. Tus comidas, entrenos y memoria se mantienen.', 'Borrar', true, async () => { S.brain = { ratings:{}, portions:{}, dislikes:[] }; await saveDoc('brain'); render(); }));
}

/* ---------- 12. Arranque ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {})); }

