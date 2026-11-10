/* =========================================================
   JARVIS 2.0 — voz masculina, inicio rediseñado, tiendas y consciencia de compra
   ========================================================= */
'use strict';

/* ---------- 1. Voz de JARVIS ---------- */
const MALE_V = /(jorge|juan|diego|carlos|pablo|andr[eé]s|enrique|[aá]lvaro|miguel|alonso|gonzalo|tom[aá]s|eddy|reed|rocko|grandpa|abuelo|abuel[oa] ?\(?m|fred|ralph|daniel|male|hombre|masculin|alberto|antonio|mateo|sergio|rodrigo|federico|lorenzo|arturo|teo)/i;
const FEMALE_V = /(m[oó]nica|paulina|marisol|ang[eé]lica|soledad|helena|laura|luc[ií]a|sabina|esperanza|flo\b|grandma|abuela\b|sandy|shelley|isabela|francisca|ximena|carmen|elvira|dalia|camila|paloma|salom[eé]|valentina|google espa|female|mujer|femenin|rosa|ana\b|sara|marta|nora|elena|pilar|conchita|penélope|lupe|mia\b)/i;
function voiceGender(v) { const n = v.name + ' ' + v.voiceURI; return MALE_V.test(n) ? 'm' : FEMALE_V.test(n) ? 'f' : 'u'; }
function voiceQuality(v) { return /premium|enhanced|mejorad|neural|natural|siri/i.test(v.name + ' ' + v.voiceURI) ? 1 : 0; }
pickVoice = function () {
  const v = VS(); if (!VOICES.length) loadVoices();
  if (v.uri) { const f = VOICES.find(x => x.voiceURI === v.uri); if (f) return f; }
  const lang = l => /es-CO/i.test(l) ? 3 : /es-(MX|US|419)/i.test(l) ? 2.5 : /es-ES/i.test(l) ? 2 : 1;
  const score = x => (voiceGender(x) === 'm' ? 20 : voiceGender(x) === 'f' ? -20 : 0) + voiceQuality(x) * 4 + lang(x.lang) - (/eddy|reed|rocko|grandpa/i.test(x.name) ? 3 : 0);
  return [...VOICES].sort((a, b) => score(b) - score(a))[0] || null;
};
ttsSpeak = function (text, o = {}) {
  if (!ttsAvail()) return false; const v = VS();
  if (v.textOnly && !o.force) return false;
  try {
    const u = new SpeechSynthesisUtterance(speechText(text)); u.lang = 'es-CO';
    const vo = pickVoice(); if (vo) { u.voice = vo; u.lang = vo.lang; }
    // Si el teléfono no tiene voz masculina instalada, se baja el tono para que suene más grave
    const male = vo && voiceGender(vo) === 'm';
    u.rate = v.rate ?? 1; u.pitch = v.pitchSet ? v.pitch : (male ? .9 : .62);
    if (o.onend) u.onend = o.onend; if (o.interrupt !== false) speechSynthesis.cancel();
    speechSynthesis.speak(u); S.speaking = true; u.addEventListener('end', () => S.speaking = false); return true;
  } catch { return false; }
};
function voiceView() {
  if (!VOICES.length) loadVoices();
  const v = VS(), cur = pickVoice(), list = [...VOICES].sort((a, b) => (voiceGender(a) === 'm' ? -1 : 0) - (voiceGender(b) === 'm' ? -1 : 0) || a.lang.localeCompare(b.lang));
  const hasMale = VOICES.some(x => voiceGender(x) === 'm');
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return `<section class="card tg-hero"><div class="card-head"><h2>Voz de JARVIS</h2>${cur ? `<span class="gtag ${voiceGender(cur)}">${voiceGender(cur) === 'm' ? 'masculina' : voiceGender(cur) === 'f' ? 'femenina' : 'sin dato'}</span>` : ''}</div>
    <p class="muted" style="margin:-4px 0 14px;font-size:14px">Ahora: <b style="color:var(--text)">${cur ? esc(cur.name) : 'voz del sistema'}</b>${cur ? ` (${esc(cur.lang)})` : ''}. ${hasMale ? '' : 'Tu teléfono aún no tiene una voz masculina en español; mientras tanto JARVIS baja el tono para que suene más grave.'}</p>
    <div class="log-actions" style="margin-top:0"><button class="btn primary" id="vTest">${ic('speaker')}Probar voz</button><button class="btn" id="vJarvis">Tono JARVIS</button>${v.uri ? '<button class="btn ghost" id="vAuto">Automática</button>' : ''}</div>
    <div class="two" style="margin-top:16px"><div class="field"><label for="vRate">Velocidad <span class="mono muted" id="vRateL">${(v.rate ?? 1).toFixed(2)}</span></label><input type="range" id="vRate" min=".8" max="1.25" step=".01" value="${v.rate ?? 1}"></div>
    <div class="field"><label for="vPitch">Tono <span class="mono muted" id="vPitchL">${(v.pitchSet ? v.pitch : (cur && voiceGender(cur) === 'm' ? .9 : .62)).toFixed(2)}</span></label><input type="range" id="vPitch" min=".5" max="1.2" step=".01" value="${v.pitchSet ? v.pitch : (cur && voiceGender(cur) === 'm' ? .9 : .62)}"></div></div>
    <label class="check" style="cursor:pointer"><input type="checkbox" id="vAuto2" ${v.autoRead ? 'checked' : ''} style="accent-color:var(--cyan);width:18px;height:18px"> Leer en voz alta las respuestas del chat</label>
  </section>
  ${isIOS ? `<section class="card" style="margin-top:14px"><div class="card-head"><h2>Instala una voz masculina en tu iPhone</h2></div>
    <ol class="steps-ol" style="font-size:14px"><li>Abre <b>Ajustes → Accesibilidad → Contenido leído → Voces</b>.</li><li>Entra a <b>Español</b> y descarga <b>Jorge (Mejorada)</b> (España) o <b>Juan (Mejorada)</b> (México). <b>Diego</b> (Argentina) también sirve.</li><li>Cierra JARVIS desde el selector de apps, vuelve a abrirlo y elígela aquí abajo.</li></ol></section>` : ''}
  <section class="card" style="margin-top:14px"><div class="card-head"><h2>Micrófono</h2><span class="gtag ${!SRC ? 'u' : S.micBlocked ? 'f' : 'm'}">${!SRC ? 'no disponible' : S.micBlocked ? 'bloqueado' : 'disponible'}</span></div>
    <p class="muted" style="margin:-4px 0 12px;font-size:14px">${!SRC ? 'Este navegador no trae reconocimiento de voz. Dicta con el \uD83C\uDF99\uFE0F del teclado: funciona en cualquier campo de texto.' : S.micBlocked ? 'El iPhone bloqueó el micrófono para esta app. Dicta con el \uD83C\uDF99\uFE0F del teclado, o revisa Ajustes → Safari → Micrófono y permite el acceso.' : 'Toca Probar y di una frase. Si no te entiende, usa el \uD83C\uDF99\uFE0F del teclado.'}</p>
    <div class="log-actions" style="margin-top:0">${SRC ? `<button class="btn" id="vMic">${ic('mic')}Probar micrófono</button>` : ''}${S.micBlocked ? '<button class="btn ghost" id="vMicReset">Intentar de nuevo</button>' : ''}</div>
    <p class="mono" id="vMicOut" style="font-size:13px;color:var(--text2);margin:10px 0 0;min-height:18px"></p>
    <p class="muted" style="font-size:11px;margin:10px 0 0">Diagnóstico: voz ${ttsAvail() ? 'sí' : 'no'} · ${VOICES.length} voces (${VOICES.filter(x => voiceGender(x) === 'm').length} de hombre) · micrófono ${SRC ? (S.micBlocked ? 'bloqueado' : 'sí') : 'no'} · idioma ${esc(SET().micLang || 'es-CO')} · ${matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'abierta como app' : 'en el navegador'}</p></section>
  <section class="card" style="margin-top:14px"><div class="card-head"><h2>Voces en español de este teléfono</h2><span class="sub mono">${VOICES.length}</span></div>
    ${list.length ? list.map(x => `<div class="vrow ${cur && cur.voiceURI === x.voiceURI ? 'sel' : ''}"><div class="bd"><b>${esc(x.name)}</b><small>${esc(x.lang)}${voiceQuality(x) ? ' · alta calidad' : ''}</small></div><span class="gtag ${voiceGender(x)}">${voiceGender(x) === 'm' ? 'hombre' : voiceGender(x) === 'f' ? 'mujer' : '?'}</span><button class="btn sm" data-vtry="${esc(x.voiceURI)}" aria-label="Escuchar">${ic('speaker')}</button><button class="btn sm ${cur && cur.voiceURI === x.voiceURI ? 'primary' : ''}" data-vuse="${esc(x.voiceURI)}">Usar</button></div>`).join('') : '<p class="muted" style="font-size:14px;margin:0">El teléfono aún no reporta voces. Toca Probar voz y vuelve a esta pestaña.</p>'}
  </section>`;
}
function bindVoice() {
  const set = (k, val) => { SET().voice = { ...VS(), [k]:val }; clearTimeout(S.vT); S.vT = setTimeout(saveSettings, 500); };
  const sample = 'Hola, soy JARVIS. Hoy toca piernas y core, y te quedan mil doscientas calorías. Vamos con todo.';
  $('#vTest')?.addEventListener('click', () => { ttsSpeak(sample, { force:true }); setTimeout(() => { if (!VOICES.length) { loadVoices(); render(); } }, 800); });
  $('#vJarvis')?.addEventListener('click', () => { SET().voice = { ...VS(), rate:1.02, pitch:pickVoice() && voiceGender(pickVoice()) === 'm' ? .85 : .6, pitchSet:true }; saveSettings(); render(); ttsSpeak(sample, { force:true }); });
  $('#vAuto')?.addEventListener('click', () => { set('uri', ''); render(); });
  $('#vRate')?.addEventListener('input', e => { set('rate', Number(e.target.value)); $('#vRateL').textContent = Number(e.target.value).toFixed(2); });
  $('#vRate')?.addEventListener('change', () => ttsSpeak('Así hablo ahora.', { force:true }));
  $('#vPitch')?.addEventListener('input', e => { SET().voice = { ...VS(), pitch:Number(e.target.value), pitchSet:true }; clearTimeout(S.vT); S.vT = setTimeout(saveSettings, 500); $('#vPitchL').textContent = Number(e.target.value).toFixed(2); });
  $('#vPitch')?.addEventListener('change', () => ttsSpeak('Así hablo ahora.', { force:true }));
  $('#vAuto2')?.addEventListener('change', e => set('autoRead', e.target.checked));
  $('#vMicReset')?.addEventListener('click', () => { S.micBlocked = false; render(); });
  $('#vMic')?.addEventListener('click', () => { const out = $('#vMicOut'), btn = $('#vMic'); if (S._vrec) { S._vrec.stop(); return; }
    out.textContent = 'Te escucho\u2026'; btn.classList.add('primary');
    S._vrec = sttStart({ onPartial: p => out.textContent = p, onFinal: f => { out.textContent = '\u2713 Entendí: ' + f; ttsSpeak('Te entendí: ' + f, { force:true }); }, onEnd: () => { S._vrec = null; btn?.classList.remove('primary'); if (out.textContent === 'Te escucho\u2026') out.textContent = 'No escuché nada. Intenta de nuevo, más cerca.'; },
      onError: er => { S._vrec = null; btn?.classList.remove('primary'); out.textContent = (MIC_ERR[er] || 'No pude escucharte.') + ' (' + er + ')'; if (er === 'not-allowed' || er === 'service-not-allowed') setTimeout(render, 1500); } }); });
  $$('[data-vtry]').forEach(b => b.addEventListener('click', () => { const vo = VOICES.find(x => x.voiceURI === b.dataset.vtry); if (!vo) return; speakSafe(buildUtt('Hola, soy JARVIS, tu sistema de rendimiento.', vo)); }));
  $$('[data-vuse]').forEach(b => b.addEventListener('click', () => { set('uri', b.dataset.vuse); SET().voice.pitchSet = false; render(); setTimeout(() => ttsSpeak('Listo. Desde ahora hablo con esta voz.', { force:true }), 100); }));
}
viewJarvis = function () {
  const t = S.jtab || 'chat', b = (id, icon, l) => `<button role="tab" aria-checked="${t === id}" data-jtab="${id}">${ic(icon).replace('<svg', '<svg width="15" height="15" style="vertical-align:-2px;margin-right:6px"')}${l}</button>`;
  const seg = `<div class="seg" role="tablist" style="margin-bottom:12px;width:max-content;max-width:100%;overflow-x:auto">${b('chat', 'chat', 'Chat')}${b('mem', 'sparkle', 'Memoria')}${b('voice', 'speaker', 'Voz')}</div>`;
  return seg + (t === 'mem' ? memoryView() : t === 'voice' ? voiceView() : _viewJarvis().replace('Ve tu perfil, chequeos, medidas y memoria guardada', 'Funciona sin conexión con tus datos, el recetario y lo que aprende de ti'));
};
bindJarvis = function () {
  $$('[data-jtab]').forEach(b => b.addEventListener('click', () => { S.jtab = b.dataset.jtab; render(); }));
  const t = S.jtab || 'chat';
  if (t === 'mem') return bindMemory();
  if (t === 'voice') return bindVoice();
  _bindJarvis();
};

/* ---------- 1b. Voz confiable en iPhone ---------- */
// iOS descarta una frase si se pide justo después de cancel(): se espera un momento.
// iOS además exige que la primera vez que suena sea dentro de un toque: se "desbloquea" con el primer toque.
window._jUtt = null;
function speakSafe(u) {
  try {
    window._jUtt = u; // evita que iOS libere la frase antes de decirla
    const ss = window.speechSynthesis;
    if (ss.speaking || ss.pending) { ss.cancel(); setTimeout(() => { try { ss.resume(); ss.speak(u); } catch {} }, 260); }
    else { ss.resume(); ss.speak(u); }
    return true;
  } catch { return false; }
}
let _ttsUnlocked = false;
function unlockTTS() {
  if (_ttsUnlocked || !ttsAvail()) return; _ttsUnlocked = true;
  try { const u = new SpeechSynthesisUtterance('.'); u.volume = 0; u.rate = 2; speechSynthesis.speak(u); } catch {}
  loadVoices();
}
['touchend', 'click'].forEach(ev => document.addEventListener(ev, unlockTTS, { once:true, capture:true }));
// En iPhone la lista de voces llega tarde: se revisa varias veces
if (ttsAvail()) { let tries = 0; const poll = setInterval(() => { loadVoices(); if (VOICES.length || ++tries > 20) { clearInterval(poll); if (currentView === 'jarvis' && S.jtab === 'voice') render(); } }, 500); document.addEventListener('visibilitychange', () => { if (!document.hidden) loadVoices(); }); }
function buildUtt(text, vo) {
  const v = VS(), u = new SpeechSynthesisUtterance(speechText(text));
  vo = vo || pickVoice();
  if (vo) { u.voice = vo; u.lang = vo.lang; } else u.lang = 'es-MX';
  const male = vo && voiceGender(vo) === 'm';
  u.rate = v.rate ?? 1; u.pitch = v.pitchSet ? v.pitch : (male ? .9 : .62); u.volume = 1;
  return u;
}
ttsSpeak = function (text, o = {}) {
  if (!ttsAvail()) return false; const v = VS();
  if (v.textOnly && !o.force) return false;
  const u = buildUtt(text);
  if (o.onend) u.onend = o.onend;
  u.addEventListener('end', () => S.speaking = false); u.addEventListener('error', () => S.speaking = false);
  S.speaking = true;
  if (o.interrupt === false && (speechSynthesis.speaking || speechSynthesis.pending)) { try { speechSynthesis.speak(u); window._jUtt = u; return true; } catch { return false; } }
  return speakSafe(u);
};

/* ---------- 1c. Micrófono que funciona en iPhone ---------- */
// El micrófono solo se enciende al tocar el botón (iOS lo exige). Si iOS lo bloquea, se pasa al dictado del teclado.
const MIC_LANGS = ['es-CO', 'es-MX', 'es-US', 'es-ES'];
sttStart = function ({ continuous = false, onPartial, onFinal, onEnd, onError } = {}) {
  if (!SRC) { onError?.('unsupported'); return null; }
  let langI = MIC_LANGS.indexOf(SET().micLang); if (langI < 0) langI = 0;
  let r; try { r = new SRC(); } catch { onError?.('unsupported'); return null; }
  r.lang = MIC_LANGS[langI]; r.interimResults = true; r.continuous = continuous; r.maxAlternatives = 1;
  let got = false;
  r.onresult = e => { let fin = '', part = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t; else part += t; } if (part) onPartial?.(part); if (fin.trim()) { got = true; onFinal?.(fin.trim()); } };
  r.onerror = e => {
    if (e.error === 'language-not-supported' && langI < MIC_LANGS.length - 1) { SET().micLang = MIC_LANGS[langI + 1]; saveSettings(); onError?.('lang-retry'); return; }
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') S.micBlocked = true;
    if (e.error !== 'aborted') onError?.(e.error);
  };
  r.onend = () => { if (!got && continuous === false) {} onEnd?.(); };
  try { if (speechSynthesis.speaking) speechSynthesis.cancel(); r.start(); } catch { onError?.('start-failed'); return null; }
  return r;
};
MIC_ERR['lang-retry'] = 'Ajusté el idioma del micrófono. Tócalo de nuevo.';
MIC_ERR['not-allowed'] = 'El iPhone no deja usar el micrófono aquí. Toca el campo de texto y usa el 🎙️ del teclado para dictar.';
MIC_ERR['service-not-allowed'] = MIC_ERR['not-allowed'];
openPalette = function () {
  ttsStop();
  const canMic = SRC && !S.micBlocked;
  modal(`<div class="pal"><button class="pal-mic" id="palMic" aria-label="${canMic ? 'Hablar' : 'Dictar con el teclado'}">${ic('mic')}</button>
    <p class="pal-t" id="palT">${canMic ? 'Toca el micrófono y habla' : 'Toca el campo y dicta con el teclado'}</p>
    <p class="muted pal-hint" id="palHint">${canMic ? 'JARVIS solo escucha mientras el micrófono está encendido.' : 'Usa el 🎙️ del teclado del iPhone: funciona siempre.'}</p>
    <div class="pal-in"><input class="input" id="palIn" placeholder="p. ej. Registra mi cena: sudado de pollo" maxlength="300" aria-label="Comando" enterkeyhint="send"><button class="btn primary" id="palGo">${ic('send')}</button></div>
    <div class="chips" style="margin-top:12px">${CMD_EXAMPLES.map(x => `<button class="chip" data-pex="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`, (L, close) => {
    $('.modal', L).classList.add('wide');
    const go = (txt, v) => { if (!String(txt || '').trim()) return; close(); handleCommand(txt, v); };
    $('#palGo', L).addEventListener('click', () => go($('#palIn', L).value, false));
    $('#palIn', L).addEventListener('keydown', e => { if (e.key === 'Enter') go(e.target.value, false); });
    $$('[data-pex]', L).forEach(b => b.addEventListener('click', () => { $('#palIn', L).value = b.dataset.pex; $('#palIn', L).focus(); }));
    const mic = $('#palMic', L); let rec = null;
    const dictate = msg => { $('#palT', L).textContent = 'Dicta con el teclado'; $('#palHint', L).textContent = msg || 'Toca el 🎙️ del teclado del iPhone y habla.'; const i = $('#palIn', L); i.focus(); i.click(); };
    mic.addEventListener('click', () => {
      if (!SRC || S.micBlocked) return dictate();
      if (rec) { rec.stop(); return; }
      rec = sttStart({ onPartial: p => { $('#palT', L).textContent = p; $('#palIn', L).value = p; }, onFinal: f => { $('#palT', L).textContent = f; $('#palIn', L).value = f; setTimeout(() => go(f, true), 300); },
        onEnd: () => { rec = null; mic.classList.remove('on'); }, onError: er => { mic.classList.remove('on'); rec = null; if (er === 'not-allowed' || er === 'service-not-allowed' || er === 'unsupported' || er === 'start-failed') dictate(MIC_ERR[er]); else { $('#palHint', L).textContent = MIC_ERR[er] || 'No pude escucharte. Tócalo de nuevo.'; $('#palT', L).textContent = 'Toca el micrófono y habla'; } } });
      if (rec) { mic.classList.add('on'); $('#palT', L).textContent = 'Te escucho…'; }
    });
  });
};
const _chatMic = chatMic;
chatMic = function () { if (!SRC || S.micBlocked) { const i = $('#chatIn'); i?.focus(); toast('Toca el \uD83C\uDF99\uFE0F del teclado y dicta.'); return; } _chatMic(); };
/* ---------- 2. Inicio 2.0 ---------- */
function ringSVG(pct, color) {
  const r = 24, c = 2 * Math.PI * r, p = clamp(pct, 0, 1);
  return `<svg viewBox="0 0 58 58"><circle class="bgc" cx="29" cy="29" r="${r}"/><circle class="fg" cx="29" cy="29" r="${r}" stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/></svg>`;
}
function tipOfDay() { const all = GUIDES.flatMap(g => g.b.map(b => ({ g, b }))); const d = Math.floor(Date.now() / 864e5); return all[d % all.length]; }
viewHome = function () {
  const now = new Date(), m = currentMission(), t = today(), ci = t.checkin, k = dkey();
  const tg = targetsFor(k), tot = dayTotals(k), water = waterOn(k), wTg = tg?.water || Math.round((curWeight() || 90) * 35 / 250) * 250;
  const sess = sessionsOn(k), movMin = sess.reduce((s, x) => s + (+x.minutes || 0), 0), dp = dayPlan(k);
  const movTg = dp.code ? (buildProgramWO(dp.code, k).est || 30) : dp.kind === 'rugby' || dp.kind === 'match' ? 60 : 30;
  const days = weekDays(), done7 = days.filter(missionDone).length, ob = P().onboarding || {}, needsSetup = !ob.done?.medical || !ob.done?.profile;
  const lw = lastOf('weight'), tr = weightTrend(), lwa = lastOf('waist');
  const nextType = guessType(), sug = suggestMeals(nextType, 1)[0], tip = tipOfDay();
  const ring = (id, pct, color, icon, val, lbl) => `<button class="ring" data-ring="${id}">${`<div class="rv">${ringSVG(pct, color)}<span>${icon}</span></div>`}<b>${val}</b><small>${lbl}</small></button>`;
  const brief = briefingLines()[0] || '';
  const mets = [
    lw && `<div><small>Peso</small><b>${Number(lw.weight).toFixed(1)}</b><i>kg</i></div>`,
    tr && `<div><small>Tendencia</small><b class="${tr.delta <= 0 ? 'dn' : 'upc'}">${tr.delta > 0 ? '+' : ''}${tr.delta.toFixed(1)}</b><i>kg</i></div>`,
    lwa && `<div><small>Cintura</small><b>${Number(lwa.waist).toFixed(1)}</b><i>cm</i></div>`,
    ci && num(ci.energy) != null && `<div><small>Energía</small><b>${ci.energy}</b><i>/5</i></div>`,
    ci && num(ci.shoulder) != null && `<div><small>Hombro</small><b class="${ci.shoulder >= 4 ? 'upc' : ''}">${ci.shoulder}</b><i>/10 dolor</i></div>`,
    `<div><small>Racha</small><b>${streak()}</b><i>días</i></div>`,
  ].filter(Boolean);
  return `
  <section class="h2-hero" aria-label="Estado">
    <div class="txt"><div class="when">${now.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })}</div>
      <h1>${esc(greeting())}</h1><p>${esc(brief)}</p>
      <div class="h2-acts"><button class="btn primary" data-act="checkin">${ic('pulse')}${ci ? 'Actualizar chequeo' : 'Chequeo de hoy'}</button><button class="btn" id="aiBriefBtn">${ic('sparkle')}Informe</button><button class="btn" id="speakBrief" aria-label="Escuchar informe">${ic('speaker')}</button></div></div>
    <div class="h2-core">${coreSVG()}<div class="t" id="clock">${pad(now.getHours())}:${pad(now.getMinutes())}</div></div>
  </section>
  <div id="aiBrief" class="ai-brief ${S.aiBrief ? '' : 'hidden'}" style="margin-top:12px">${S.aiBrief ? fmtText(S.aiBrief) : ''}</div>
  ${needsSetup ? `<div class="banner info" style="margin-top:14px">${ic('info')}<div style="flex:1">Termina tu configuración para que JARVIS ajuste entreno y comida a ti.</div><button class="btn sm" data-go="setup">Continuar</button></div>` : ''}

  <div class="rings">
    ${ring('kcal', tg ? tot.kcal / tg.kcal : tot.kcal / 2400, '#35D6F2', '🔥', tg ? `${Math.max(0, tg.kcal - r0(tot.kcal))}` : r0(tot.kcal), tg ? 'kcal restantes' : 'kcal hoy')}
    ${ring('prot', tg ? tot.p / tg.p : tot.p / 160, '#367CFF', '🥩', `${r0(tot.p)}${tg ? `<span class="muted" style="font-size:11px">/${tg.p}</span>` : ''}`, 'g proteína')}
    ${ring('water', water / wTg, '#4FC3F7', '💧', `${(water / 1000).toFixed(1)}`, `de ${(wTg / 1000).toFixed(1)} L · toca +1`)}
    ${ring('move', movMin / movTg, '#35D07F', '⚡', movMin, `de ${movTg} min`)}
  </div>

  <section class="card mission ${m.done ? 'done' : ''}" aria-labelledby="mh">
    <div class="card-head"><h2 id="mh">Misión de hoy</h2>${m.saved ? (m.done ? '<span class="tag measured">Hecha</span>' : '<span class="tag reported">Aceptada</span>') : '<span class="tag plain">Sugerida</span>'}</div>
    <p class="mission-title">${esc(m.title)}</p><p class="mission-why">${esc(m.why || '')}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${m.done ? '<button class="btn sm ghost" id="mUndo">Marcar como no hecha</button>' : `<button class="btn primary" id="mDone">${ic('check')}Marcar hecha</button>${m.saved ? '<button class="btn ghost" id="mChange">Elegir otra</button>' : '<button class="btn" id="mAccept">Aceptar</button><button class="btn ghost" id="mSwap">Otra</button>'}`}</div>
    <div class="week" style="margin-top:16px">${days.map((d, i) => `<div><i class="${missionDone(d) ? 'on' : ''} ${i === 6 ? 'today' : ''}"></i>${dowL(DOW[parseKey(d).getDay()])}</div>`).join('')}</div>
    <p class="muted" style="font-size:12.5px;margin:10px 0 0">${done7}/7 misiones esta semana. Los días que faltan no reinician nada.</p>
  </section>

  <div class="h-label">Lo siguiente</div>
  <div class="next"><div class="ico">${dp.kind === 'match' || dp.kind === 'rugby' ? '🏉' : dp.code ? '🏋️' : '🚶'}</div><div class="bd"><b>${esc(dp.title)}</b><small>${dp.code && dp.kind === 'train' ? `~${movTg} min · listo para empezar` : esc(dp.sub || 'Día libre: una caminata suma.')}</small></div><button class="btn sm primary" data-go="training">${S.wo ? 'Seguir' : 'Ir'}</button></div>
  ${sug ? `<div class="next"><div class="ico">${sug.r.e}</div><div class="bd"><b>${esc(sug.r.n)}</b><small>Para tu ${TYPE_LABEL[nextType]} · ~${Math.round(sug.r.est.kcal * sug.x)} kcal · ${Math.round(sug.r.est.p * sug.x)} g proteína</small></div><button class="btn sm" data-hrec="${sug.r.id}">Ver</button></div>` : ''}
  ${(() => { const ex = expiring(2); return ex.length ? `<div class="next"><div class="ico">⏳</div><div class="bd"><b>Usa pronto: ${esc(ex.slice(0, 3).map(i => i.name).join(', '))}</b><small>Vence en tu despensa</small></div><button class="btn sm" data-go="market">Ver</button></div>` : ''; })()}

  <div class="h-label">Accesos rápidos</div>
  <div class="pills">
    <button class="pill" data-go="nutrition">${ic('food')}Registrar comida</button>
    <button class="pill" data-act="weight">${ic('scale')}Peso</button>
    <button class="pill" data-hshop>${ic('cart')}Ir de compras</button>
    <button class="pill" data-ask="Solo tengo 20 minutos">${ic('play')}Tengo 20 min</button>
    <button class="pill" data-ask="No tengo ganas">${ic('bolt')}Sin ganas</button>
    <button class="pill" data-go="jarvis">${ic('chat')}JARVIS</button>
  </div>

  <div class="h-label">Tus números</div>
  <div class="minimet">${mets.join('')}${!lw ? `<div style="display:flex;flex-direction:column;justify-content:space-between;gap:8px"><small>Sin peso registrado</small><button class="btn sm" data-act="weight">Registrar</button></div>` : ''}</div>

  <div class="h-label">Consejo del día</div>
  <div class="tip"><span>${tip.g.e}</span><div><b>${esc(tip.g.t)}</b><p>${esc(tip.b)}</p></div></div>
  <div style="margin-top:16px">${motivationCard()}</div>`;
};
const _bindHome = bindHome;
bindHome = function () {
  _bindHome();
  $$('[data-ring]').forEach(b => b.addEventListener('click', async () => {
    const r = b.dataset.ring;
    if (r === 'water') { S.nutri.water = S.nutri.water || {}; S.nutri.water[dkey()] = waterOn(dkey()) + 250; await saveDoc('nutri'); toast('+250 ml de agua. ¡Bien!'); render(); }
    else if (r === 'move') location.hash = '#training';
    else { S.ntabInit = true; S.ntab = 'today'; S.nday = dkey(); location.hash = '#nutrition'; }
  }));
  $$('[data-hrec]').forEach(b => b.addEventListener('click', () => { S.libX = 1; openLibRecipe(b.dataset.hrec); }));
  $('[data-hshop]')?.addEventListener('click', () => { S.mtab = marketList().some(x => !x.checked) ? 'list' : 'stores'; location.hash = '#market'; });
};

/* ---------- 3. Mercado conectado a tus tiendas ---------- */
const AISLE_CAT = { 'Frutas y verduras':'Vegetables', 'Carnes y pollo':'Proteins', 'Pescados':'Proteins', 'Huevos y lácteos':'Dairy', 'Granos y arroz':'Grains', 'Panadería y arepas':'Carbohydrates', 'Despensa':'Condiments', 'Enlatados':'Proteins', 'Bebidas':'Drinks', 'Mecato y dulces':'Snacks', 'Congelados':'Frozen', 'Aseo y hogar':'Other' };
const myStores = () => (S.market.myStores && S.market.myStores.length) ? S.market.myStores : ['D1', 'Ara', 'Éxito', 'Frutería'];
function healthOf(name) {
  const k = BN(name);
  const c = CATALOG.find(p => BN(p.n) === k) || CATALOG.find(p => k.includes(BN(p.n)) || BN(p.n).includes(k));
  if (c) return c.health;
  const f = matchFood(name);
  if (!f) return 'a';
  if (f.tags.some(t => ['frito', 'alto-grasa', 'azucar', 'alcohol'].includes(t))) return 'r';
  if (f.tags.some(t => ['verdura', 'fruta', 'bajo-grasa', 'fibra', 'proteina'].includes(t))) return 'v';
  return 'a';
}
function priceHistory() {
  const h = {};
  (S.market.purchases || []).forEach(p => (p.items || []).forEach(i => { if (i.estimated || !(+i.price > 0)) return; const key = BN(i.name); (h[key] = h[key] || { name:i.name, rows:[] }).rows.push({ price:+i.price, store:p.store, date:p.date, qty:i.qty }); }));
  Object.values(S.market.prices || {}).forEach(p => { const key = BN(p.name); const e = h[key] = h[key] || { name:p.name, rows:[] }; if (!e.rows.some(r => r.date === p.date && r.store === p.store && r.price === p.price)) e.rows.push({ price:p.price, store:p.store, date:p.date, qty:p.qty }); });
  Object.values(h).forEach(e => { e.rows.sort((a, b) => (a.date || '').localeCompare(b.date || '')); e.last = e.rows[e.rows.length - 1]; const bs = {}; e.rows.forEach(r => { if (!bs[r.store] || r.date >= bs[r.store].date) bs[r.store] = r; }); e.byStore = bs; e.cheapest = Object.values(bs).sort((a, b) => a.price - b.price)[0]; });
  return h;
}
function priceFor(name, store) { const e = priceHistory()[BN(name)]; if (!e) return null; return (store && e.byStore[store]) || e.last; }
function healthSplit(items, priceKey) {
  const s = { v:0, a:0, r:0 }; let tot = 0;
  items.forEach(i => { const w = priceKey ? (+i[priceKey] || 0) || 1 : 1; s[healthOf(i.item || i.name)] += w; tot += w; });
  return { ...s, tot, pv:tot ? s.v / tot : 0, pa:tot ? s.a / tot : 0, pr:tot ? s.r / tot : 0 };
}
function hbarHTML(h, label = 'de la lista') {
  return `<div class="hbar"><i class="v" style="width:${h.pv * 100}%"></i><i class="a" style="width:${h.pa * 100}%"></i><i class="r" style="width:${h.pr * 100}%"></i></div>
    <div class="hleg"><span><i class="hdot v"></i>${Math.round(h.pv * 100)}% para comer más</span><span><i class="hdot a"></i>${Math.round(h.pa * 100)}% con medida</span><span><i class="hdot r"></i>${Math.round(h.pr * 100)}% ocasional</span></div>`;
}
function addCatalogToList(p, store) {
  const st = store || (p.stores.find(s => myStores().includes(s)) || p.stores[0]);
  const exist = marketList().find(x => !x.checked && BN(x.item) === BN(p.n) && x.store === st);
  if (exist) { toast(`${p.n} ya está en la lista de ${st}.`); return false; }
  const kp = priceFor(p.n, st);
  S.market.list = [...marketList(), { id:uid(), item:p.n, qty:p.pres, cat:AISLE_CAT[p.aisle] || 'Other', store:st, est:kp?.price || 0, priceSrc:kp ? 'receipt' : 'ai', essential:p.health !== 'r', why:'', checked:false, source:'user', catId:p.id }];
  clearTimeout(S.listT); S.listT = setTimeout(() => saveDoc('market'), 400);
  return true;
}
function mStores() {
  const ms = myStores(), store = S.shopStore && ms.includes(S.shopStore) ? S.shopStore : ms[0], aisle = S.shopAisle || '', q = S.shopQ || '';
  const inList = new Set(marketList().filter(x => !x.checked && x.store === store).map(x => BN(x.item)));
  let prods = CATALOG.filter(p => p.stores.includes(store));
  if (q.trim()) { const k = BN(q); prods = prods.filter(p => BN(p.n + ' ' + p.aisle).includes(k)); } else if (aisle) prods = prods.filter(p => p.aisle === aisle);
  const ph = priceHistory();
  const lh = healthSplit(marketList().filter(x => !x.checked));
  const groups = {}; prods.forEach(p => (groups[p.aisle] = groups[p.aisle] || []).push(p));
  return `<section class="card" style="padding:16px">
    <div class="card-head" style="margin-bottom:10px"><h2>Tus tiendas</h2><button class="btn sm ghost" id="stEdit">Editar</button></div>
    <div class="storebar">${ms.map(s => `<button class="store-chip" aria-pressed="${s === store}" data-st="${esc(s)}">${esc(s)}</button>`).join('')}</div>
  </section>
  ${marketList().some(x => !x.checked) ? `<section class="card" style="margin-top:12px;padding:16px"><div class="card-head" style="margin-bottom:8px"><h2>Qué tan sana va tu lista</h2><button class="btn sm" data-mtab-go="list">Ver lista (${marketList().filter(x => !x.checked).length})</button></div>${hbarHTML(lh)}</section>` : ''}
  <input class="input" id="shopQ" style="margin-top:14px" placeholder="Busca en ${esc(store)}: pollo, avena, huevos…" value="${esc(q)}" autocomplete="off">
  <div class="aisles"><button class="aisle" aria-pressed="${!aisle && !q}" data-ai=""><span>🛒</span>Todo</button>${AISLES.filter(a => CATALOG.some(p => p.aisle === a && p.stores.includes(store))).map(a => `<button class="aisle" aria-pressed="${aisle === a && !q}" data-ai="${esc(a)}"><span>${AISLE_ICON[a]}</span>${esc(a)}</button>`).join('')}</div>
  ${Object.entries(groups).map(([a, ps]) => `<section class="card" style="margin-top:12px;padding:6px 16px"><div class="h-label" style="margin:12px 0 4px">${AISLE_ICON[a]} ${esc(a)}</div>
    ${ps.map(p => { const e = ph[BN(p.n)], mine = e?.byStore[store], ch = e?.cheapest, on = inList.has(BN(p.n));
      return `<div class="prod"><i class="hdot ${p.health}" title="${p.health === 'v' ? 'Para comer más' : p.health === 'a' ? 'Con medida' : 'Ocasional'}"></i><div class="bd"><b>${esc(p.n)}</b><small>${esc(p.pres)}${ch && ch.store !== store && mine && ch.price < mine.price ? ` · más barato en ${esc(ch.store)}` : ''}</small></div>
        <div class="pr">${mine ? cop(mine.price) : e?.last ? `<span class="muted">${cop(e.last.price)}<br><small>${esc(e.last.store)}</small></span>` : ''}</div>
        <button class="add ${on ? 'on' : ''}" data-cadd="${p.id}" aria-label="${on ? 'Ya en la lista' : 'Agregar a la lista'}">${on ? '✓' : '+'}</button></div>`; }).join('')}</section>`).join('') || '<p class="muted" style="font-size:14px;margin-top:14px">Nada con esa búsqueda en esta tienda. Agrégalo a mano desde la Lista.</p>'}
  <p class="muted" style="font-size:12px;margin:14px 2px 0">Catálogo de productos habituales en cada tipo de tienda. Las tiendas no publican sus precios para apps como esta: JARVIS usa los precios que tú pagas (al comprar o desde tus facturas) y te dice dónde te salió más barato.</p>`;
}
function bindMStores() {
  $$('[data-st]').forEach(b => b.addEventListener('click', () => { S.shopStore = b.dataset.st; render(); }));
  $$('[data-ai]').forEach(b => b.addEventListener('click', () => { S.shopAisle = b.dataset.ai; S.shopQ = ''; render(); }));
  $('#shopQ')?.addEventListener('input', e => { S.shopQ = e.target.value; const pos = e.target.selectionStart; render(); const n = $('#shopQ'); n.focus(); n.setSelectionRange(pos, pos); });
  $$('[data-cadd]').forEach(b => b.addEventListener('click', () => { const p = CATALOG_BY_ID[b.dataset.cadd]; const ms = myStores(); const store = S.shopStore && ms.includes(S.shopStore) ? S.shopStore : ms[0];
    if (b.classList.contains('on')) { S.market.list = marketList().filter(x => !(x.checked === false && BN(x.item) === BN(p.n) && x.store === store)); saveDoc('market'); render(); return; }
    if (addCatalogToList(p, store)) { toast(`${p.n} → lista de ${store}${p.health === 'r' ? '. Ojo: es de consumo ocasional.' : '.'}`); render(); } }));
  $('#stEdit')?.addEventListener('click', () => { let sel = [...myStores()];
    modal(`<h3>¿Dónde haces mercado?</h3><p class="muted" style="font-size:14px;margin:0 0 12px">Elige tus tiendas; JARVIS arma la lista por tienda y compara tus precios entre ellas.</p><div class="chips" id="stPick">${STORES.map(s => `<button class="chip" aria-pressed="${sel.includes(s)}" data-sp="${esc(s)}">${esc(s)}</button>`).join('')}</div><div class="modal-actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="stOk">Guardar</button></div>`, (L, close) => {
      $$('[data-sp]', L).forEach(b => b.addEventListener('click', () => { const s = b.dataset.sp; sel = sel.includes(s) ? sel.filter(x => x !== s) : [...sel, s]; b.setAttribute('aria-pressed', sel.includes(s)); }));
      $('#stOk', L).addEventListener('click', async () => { if (!sel.length) return toast('Elige al menos una tienda.', true); S.market.myStores = STORES.filter(s => sel.includes(s)); S.shopStore = S.market.myStores[0]; await saveDoc('market'); close(); render(); }); }); });
}
/* Modo compra: en la tienda, con total en vivo */
function openShopMode(store) {
  const stores = [...new Set(marketList().map(x => x.store))];
  let st = store || stores.find(s => marketList().some(x => x.store === s && !x.checked)) || stores[0];
  const tb = S.market.week?.tripBudget || null;
  const html = () => {
    const items = marketList().filter(x => x.store === st), got = items.filter(x => x.checked);
    const total = got.reduce((s, x) => s + (num(x.price) ?? (+x.est || 0)), 0), allTot = marketList().filter(x => x.checked).reduce((s, x) => s + (num(x.price) ?? (+x.est || 0)), 0);
    const h = healthSplit(got.length ? got : items);
    return `<div class="shop-total"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px"><div><small class="muted">En el carrito · ${esc(st)}</small><div class="big">${cop(total)}</div></div><div style="text-align:right"><small class="muted">${got.length}/${items.length} productos</small>${tb ? `<div class="mono" style="font-size:13px;color:${allTot > tb ? 'var(--bad)' : 'var(--ok)'}">${allTot > tb ? 'Pasado ' + cop(allTot - tb) : 'Quedan ' + cop(tb - allTot)}</div>` : ''}</div></div>
      ${tb ? `<div class="bud"><i class="${allTot > tb ? 'over' : ''}" style="width:${Math.min(100, allTot / tb * 100)}%"></i></div>` : ''}<div style="margin-top:10px">${hbarHTML(h)}</div></div>
      ${stores.length > 1 ? `<div class="storebar" style="margin-bottom:8px">${stores.map(s => `<button class="store-chip" aria-pressed="${s === st}" data-sms="${esc(s)}">${esc(s)} <small class="mono">${marketList().filter(x => x.store === s && !x.checked).length}</small></button>`).join('')}</div>` : ''}
      <div>${items.sort((a, b) => a.checked - b.checked || (a.cat || '').localeCompare(b.cat || '')).map(x => `<div class="srow ${x.checked ? 'done' : ''}"><button class="cbig" data-sck="${esc(x.id)}" aria-label="Marcar ${esc(x.item)}">${x.checked ? ic('check') : ''}</button><i class="hdot ${healthOf(x.item)}"></i><div class="nm">${esc(x.item)}<small>${esc(x.qty || '')}${x.est && !x.checked ? ` · antes ${cop(x.est)}` : ''}</small></div>${x.checked ? `<input class="input mono" type="text" inputmode="numeric" data-spr="${esc(x.id)}" value="${x.price ?? ''}" placeholder="${x.est || 'Precio'}" aria-label="Precio pagado">` : ''}</div>`).join('') || '<p class="muted">Sin productos para esta tienda.</p>'}</div>
      <button class="btn" id="smAdd" style="margin-top:12px;width:100%">${ic('plus')}Agregar algo que no estaba en la lista</button>
      <div class="modal-actions"><button class="btn ghost" data-close>Cerrar</button><button class="btn primary" id="smFin" ${marketList().some(x => x.checked) ? '' : 'disabled'}>${ic('check')}Terminar compra</button></div>`;
  };
  modal(html(), (L, close) => {
    $('.modal', L).classList.add('wide');
    const persist = () => { clearTimeout(S.listT); S.listT = setTimeout(() => saveDoc('market'), 400); };
    const bind = () => {
      $('[data-close]', L)?.addEventListener('click', () => { close(); render(); });
      $$('[data-sms]', L).forEach(b => b.addEventListener('click', () => { st = b.dataset.sms; re(); }));
      $$('[data-sck]', L).forEach(b => b.addEventListener('click', () => { const x = marketList().find(i => i.id === b.dataset.sck); x.checked = !x.checked; persist(); re(); if (x.checked) setTimeout(() => $(`[data-spr="${x.id}"]`, L)?.focus(), 50); }));
      $$('[data-spr]', L).forEach(i => i.addEventListener('change', () => { const x = marketList().find(z => z.id === i.dataset.spr); x.price = num(String(i.value).replace(/[.\s$]/g, '')); persist(); re(); }));
      $('#smAdd', L).addEventListener('click', () => { const n = prompt('¿Qué agregaste?'); if (!n || !n.trim()) return; const pr = num(String(prompt('¿Cuánto costó? (opcional)') || '').replace(/[.\s$]/g, ''));
        S.market.list = [...marketList(), { id:uid(), item:n.trim(), qty:'', cat:'Other', store:st, est:0, priceSrc:'user', essential:false, why:'Fuera de la lista', checked:true, price:pr, source:'user', impulse:true }]; persist(); re();
        if (healthOf(n) === 'r') toast('Anotado. Es de consumo ocasional: tenlo en cuenta.'); });
      $('#smFin', L).addEventListener('click', () => { close(); S.mtab = 'list'; render(); setTimeout(() => $('#lFinish')?.click(), 60); });
    };
    const re = () => { $('.modal', L).innerHTML = html(); bind(); };
    bind();
  });
}
const _mList = mList, _bindMList = bindMList;
mList = function () {
  const open = marketList().filter(x => !x.checked);
  const head = marketList().length ? `<section class="card" style="margin-bottom:14px;padding:16px"><div class="card-head" style="margin-bottom:8px"><h2>Tu lista de un vistazo</h2><span class="sub mono">${open.length} por comprar</span></div>${hbarHTML(healthSplit(open.length ? open : marketList()))}
    <div class="log-actions" style="margin-top:14px"><button class="btn primary" id="shopMode">${ic('cart')}Modo compra</button><button class="btn" data-mtab-go="stores">${ic('plus')}Agregar desde tus tiendas</button></div></section>` : `<section class="card" style="margin-bottom:14px"><p class="muted" style="margin:0 0 12px;font-size:14px">Arma tu lista tocando + en el catálogo de tus tiendas, o deja que JARVIS la arme con tu menú semanal.</p><div class="log-actions" style="margin-top:0"><button class="btn primary" data-mtab-go="stores">${ic('cart')}Ver tiendas</button><button class="btn" data-mtab-go="week">Planear mi semana</button></div></section>`;
  return head + _mList().replace(/Finish shopping/g, 'Terminar compra').replace(/>AI</g, '>estimado<');
};
bindMList = function () { _bindMList(); $('#shopMode')?.addEventListener('click', () => openShopMode()); };
/* Gastos y consciencia */
const _mSpend = mSpend;
mSpend = function () {
  const k = dkey(), month = (S.market.purchases || []).filter(p => (p.date || '').startsWith(k.slice(0, 7)));
  const items = month.flatMap(p => (p.items || []).map(i => ({ name:i.name, price:+i.price || 0, store:p.store })));
  const h = healthSplit(items, 'price'), tot = items.reduce((s, i) => s + i.price, 0);
  const cat = {}; items.forEach(i => { const c = CATALOG.find(p => BN(p.n) === BN(i.name)); const a = c ? c.aisle : (matchFood(i.name)?.cat || 'Otros'); cat[a] = (cat[a] || 0) + i.price; });
  const treats = items.filter(i => healthOf(i.name) === 'r').reduce((s, i) => s + i.price, 0);
  const ph = Object.values(priceHistory()).filter(e => e.rows.length >= 2);
  const ups = ph.map(e => { const a = e.rows[e.rows.length - 2], b = e.rows[e.rows.length - 1]; return { name:e.name, d:b.price - a.price, pct:(b.price - a.price) / a.price, b }; }).filter(x => Math.abs(x.pct) >= .05).sort((a, b) => b.pct - a.pct).slice(0, 5);
  const save = Object.values(priceHistory()).filter(e => Object.keys(e.byStore).length >= 2).map(e => { const ss = Object.values(e.byStore).sort((a, b) => a.price - b.price); return { name:e.name, cheap:ss[0], exp:ss[ss.length - 1] }; }).filter(x => x.exp.price > x.cheap.price).slice(0, 5);
  const top = Object.entries(items.reduce((m, i) => (m[i.name] = (m[i.name] || 0) + i.price, m), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxC = Math.max(1, ...Object.values(cat));
  const card = `<section class="card tg-hero" style="margin-bottom:14px"><div class="card-head"><h2>Consciencia de compra · este mes</h2><span class="sub mono">${cop(tot)}</span></div>
    ${items.length ? `${hbarHTML(h)}
      <div style="margin-top:16px">${Object.entries(cat).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([a, v]) => `<div class="sbar"><span>${AISLE_ICON[a] || ''} ${esc(a)}</span><div><i style="width:${v / maxC * 100}%"></i></div><span class="mono">${cop(v)}</span></div>`).join('')}</div>
      <div style="margin-top:8px">
        ${treats ? `<div class="insight"><span>🍫</span><div>Gastaste <b>${cop(treats)}</b> (${Math.round(treats / tot * 100)}%) en productos de consumo ocasional (mecato, bebidas azucaradas, embutidos, fritos).</div></div>` : '<div class="insight"><span>✅</span><div>Nada de mecato ni bebidas azucaradas este mes. Excelente.</div></div>'}
        ${top.length ? `<div class="insight"><span>🧾</span><div>Donde más se va la plata: ${top.map(([n, v]) => `${esc(n)} (${cop(v)})`).join(', ')}.</div></div>` : ''}
        ${ups.map(u => `<div class="insight"><span>${u.d > 0 ? '📈' : '📉'}</span><div><b>${esc(u.name)}</b> ${u.d > 0 ? 'subió' : 'bajó'} ${Math.round(Math.abs(u.pct) * 100)}% (ahora ${cop(u.b.price)} en ${esc(u.b.store)}).</div></div>`).join('')}
        ${save.map(s => `<div class="insight"><span>💡</span><div><b>${esc(s.name)}</b>: ${cop(s.cheap.price)} en ${esc(s.cheap.store)} vs ${cop(s.exp.price)} en ${esc(s.exp.store)}.</div></div>`).join('')}
      </div>` : '<p class="muted" style="font-size:14px;margin:0">Cuando termines una compra con precios (Modo compra) verás aquí qué tan sano compras, en qué se va la plata, qué subió y dónde está más barato.</p>'}
  </section>`;
  return card + _mSpend().replace(/% used/g, '% usado');
};
viewMarket = function () {
  const n = marketList().filter(x => !x.checked).length;
  const tabs = [['list', `Lista${n ? ` (${n})` : ''}`], ['stores', 'Tiendas'], ['pantry', 'Despensa'], ['week', 'Planear semana'], ['spend', 'Gastos']];
  const body = { pantry:mPantry, scan:mScan, stores:mStores, week:mWeek, list:mList, spend:mSpend }[S.mtab] || mList;
  return `<h1 class="section-title">Mercado</h1><p class="section-sub" style="margin-bottom:0">Tus tiendas, tu lista y en qué se va tu plata.</p>
  <div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button role="tab" aria-selected="${(S.mtab || 'list') === id || (id === 'pantry' && S.mtab === 'scan')}" data-mtab="${id}">${l}</button>`).join('')}</div>${body()}`;
};
bindMarket = function () {
  $$('[data-mtab]').forEach(b => b.addEventListener('click', () => { S.mtab = b.dataset.mtab; render(); }));
  $$('[data-mtab-go]').forEach(b => b.addEventListener('click', () => { S.mtab = b.dataset.mtabGo; render(); window.scrollTo(0, 0); }));
  ({ pantry:bindMPantry, scan:bindMScan, stores:bindMStores, week:bindMWeek, list:bindMList, spend:bindMSpend }[S.mtab] || bindMList)();
};
// El chat también entiende el mercado
const _reply = reply;
reply = function (text) {
  const n = BN(text);
  const addM = n.match(/^(?:agrega|anade|pon|apunta)\s+(.+?)\s+(?:a|en)\s+(?:la\s+)?lista/);
  if (addM) { const names = addM[1].split(/,|\s+y\s+/).map(s => s.trim()).filter(Boolean); const added = [];
    names.forEach(nm => { const p = CATALOG.find(c => BN(c.n).includes(BN(nm)) || BN(nm).includes(BN(c.n))); if (p) { if (addCatalogToList(p)) added.push(`${p.n} (${p.stores.find(s => myStores().includes(s)) || p.stores[0]})`); } else { S.market.list = [...marketList(), { id:uid(), item:nm, qty:'', cat:'Other', store:myStores()[0], est:0, priceSrc:'ai', essential:true, why:'', checked:false, source:'user' }]; added.push(nm); } });
    saveDoc('market'); return { text:`Listo, agregué a tu lista: ${added.join(', ')}. La ves en Mercado → Lista.`, logs:[], mems:[] }; }
  if (/(cuanto he gastado|cuanto llevo gastado|gasto del mes|cuanto gaste|en que se me va)/.test(n)) {
    const k = dkey(), month = (S.market.purchases || []).filter(p => (p.date || '').startsWith(k.slice(0, 7))), tot = month.reduce((s, p) => s + (+p.total || 0), 0), b = budget();
    return { text: month.length ? `Este mes llevas **${cop(tot)}** en ${month.length} ${month.length === 1 ? 'compra' : 'compras'}${b ? ` de un presupuesto de ${cop(b)}` : ''}. El detalle de en qué se va está en Mercado → Gastos.` : 'Aún no hay compras registradas este mes. Usa el Modo compra en la tienda y escribe lo que pagas.', logs:[], mems:[] };
  }
  if (/(que me falta|mi lista|lista de mercado|que tengo que comprar)/.test(n)) {
    const open = marketList().filter(x => !x.checked), by = {}; open.forEach(x => (by[x.store] = by[x.store] || []).push(x.item));
    return { text: open.length ? 'Te falta comprar:\n' + Object.entries(by).map(([s, xs]) => `**${s}**: ${xs.join(', ')}`).join('\n') : 'Tu lista está vacía. Dime "agrega huevos y avena a la lista" o arma tu semana en Mercado.', logs:[], mems:[] };
  }
  return _reply(text);
};

/* ---------- 4. Arreglos de textos ---------- */
const _render = render;
render = function () { _render(); try { const m = $('main') || document.body; m.querySelectorAll('.foot span, .muted, small, .sub').forEach(el => { if (el.childElementCount === 0) { const t = el.textContent; const r = t.replace(/\blogged\b/g, 'registradas').replace(/^Current run: /, 'Racha actual: ').replace(/\/10 pain/, '/10 dolor').replace(/^down$/, 'bajando').replace(/^up$/, 'subiendo'); if (r !== t) el.textContent = r; } }); } catch {} };


