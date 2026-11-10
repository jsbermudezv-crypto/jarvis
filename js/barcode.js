/* =========================================================
   JARVIS — lector de códigos de barras (EAN-13, EAN-8, UPC-A)
   Corre 100 % en el teléfono, sin librerías externas.
   Usa el lector nativo del sistema si existe (BarcodeDetector) y si no, este decodificador.
   ========================================================= */
(function (root) {
  'use strict';
  const L = ['3211','2221','2122','1411','1132','1231','1114','1312','1213','3112'].map(s => s.split('').map(Number));
  const G = L.map(p => [...p].reverse());
  const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

  function bestDigit(runs, table) {
    const sum = runs[0] + runs[1] + runs[2] + runs[3];
    const n = runs.map(r => r * 7 / sum);
    let best = -1, bd = 1e9, second = 1e9;
    for (let d = 0; d < 10; d++) {
      const p = table[d]; let dist = 0;
      for (let k = 0; k < 4; k++) dist += Math.abs(n[k] - p[k]);
      if (dist < bd) { second = bd; bd = dist; best = d; } else if (dist < second) second = dist;
    }
    return bd < 1.6 && second - bd > 0.15 ? { d:best, dist:bd } : null;
  }
  function guardOK(runs, unit) { return runs.every(r => r > unit * 0.4 && r < unit * 2.2); }
  function eanCheck(digits) {
    const body = digits.slice(0, -1), n = body.length;
    let s = 0; for (let i = 0; i < n; i++) s += body[n - 1 - i] * (i % 2 === 0 ? 3 : 1);
    return (10 - (s % 10)) % 10 === digits[digits.length - 1];
  }
  // runs: anchos alternos empezando por una barra oscura en el índice 0
  function tryEAN13(runs, i) {
    if (i + 59 > runs.length) return null;
    const seg = runs.slice(i, i + 59), total = seg.reduce((a, b) => a + b, 0), unit = total / 95;
    if (!guardOK(seg.slice(0, 3), unit) || !guardOK(seg.slice(27, 32), unit) || !guardOK(seg.slice(56, 59), unit)) return null;
    // la zona en blanco antes y después debe ser amplia
    if (i > 0 && runs[i - 1] < unit * 3) return null;
    if (i + 59 < runs.length && runs[i + 59] < unit * 3) return null;
    const digits = [], par = [];
    for (let k = 0; k < 6; k++) {
      const r = seg.slice(3 + k * 4, 7 + k * 4), a = bestDigit(r, L), b = bestDigit(r, G);
      if (!a && !b) return null;
      if (a && (!b || a.dist <= b.dist)) { digits.push(a.d); par.push('L'); } else { digits.push(b.d); par.push('G'); }
    }
    for (let k = 0; k < 6; k++) { const r = seg.slice(32 + k * 4, 36 + k * 4), a = bestDigit(r, L); if (!a) return null; digits.push(a.d); }
    const first = PARITY.indexOf(par.join('')); if (first < 0) return null;
    const all = [first, ...digits];
    return eanCheck(all) ? all.join('') : null;
  }
  function tryEAN8(runs, i) {
    if (i + 43 > runs.length) return null;
    const seg = runs.slice(i, i + 43), total = seg.reduce((a, b) => a + b, 0), unit = total / 67;
    if (!guardOK(seg.slice(0, 3), unit) || !guardOK(seg.slice(19, 24), unit) || !guardOK(seg.slice(40, 43), unit)) return null;
    if (i > 0 && runs[i - 1] < unit * 3) return null;
    if (i + 43 < runs.length && runs[i + 43] < unit * 3) return null;
    const digits = [];
    for (let k = 0; k < 4; k++) { const a = bestDigit(seg.slice(3 + k * 4, 7 + k * 4), L); if (!a) return null; digits.push(a.d); }
    for (let k = 0; k < 4; k++) { const a = bestDigit(seg.slice(24 + k * 4, 28 + k * 4), L); if (!a) return null; digits.push(a.d); }
    return eanCheck(digits) ? digits.join('') : null;
  }
  function runsOf(line, mode = 'mid') {
    const n = line.length;
    const sm = new Float32Array(n);
    for (let x = 0; x < n; x++) sm[x] = (line[Math.max(0, x - 1)] + 2 * line[x] + line[Math.min(n - 1, x + 1)]) / 4;
    let gmin = 255, gmax = 0; for (let x = 0; x < n; x++) { if (sm[x] < gmin) gmin = sm[x]; if (sm[x] > gmax) gmax = sm[x]; }
    if (gmax - gmin < 30) return null;
    const gmid = (gmin + gmax) / 2, bits = new Uint8Array(n);
    if (mode === 'mid') { for (let x = 0; x < n; x++) bits[x] = sm[x] < gmid ? 1 : 0; }
    else if (mode === 'mean') {
      const win = Math.max(16, Math.round(n / 12)), pre = new Float64Array(n + 1);
      for (let x = 0; x < n; x++) pre[x + 1] = pre[x] + sm[x];
      for (let x = 0; x < n; x++) { const a = Math.max(0, x - win), b = Math.min(n, x + win); bits[x] = sm[x] < (pre[b] - pre[a]) / (b - a) ? 1 : 0; }
    } else { // envolvente local: punto medio entre el mínimo y el máximo cercanos
      const k = mode;
      for (let x = 0; x < n; x++) {
        let lo = 255, hi = 0; const a = Math.max(0, x - k), b = Math.min(n - 1, x + k);
        for (let i = a; i <= b; i++) { const v = sm[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
        bits[x] = hi - lo < (gmax - gmin) * 0.18 ? (sm[x] < gmid ? 1 : 0) : (sm[x] < (lo + hi) / 2 ? 1 : 0);
      }
    }
    const runs = []; let start = 0, cur = bits[0];
    for (let x = 1; x <= n; x++) { if (x === n || bits[x] !== cur) { runs.push({ dark:cur === 1, w:x - start }); start = x; cur = bits[x]; } }
    return runs;
  }
  const MODES = ['mid', 'mean', 6, 10, 16];
  function scanLine(line) {
    const out = [];
    const tryDir = (arr, mode) => {
      const rr = runsOf(arr, mode); if (!rr) return;
      const lead = rr[0].dark ? [0, ...rr.map(r => r.w)] : rr.map(r => r.w); // índices impares = barras
      for (let i = 1; i < lead.length; i += 2) { const c = tryEAN13(lead, i) || tryEAN8(lead, i); if (c) out.push(c); }
    };
    const rev = Array.from(line).reverse();
    for (const m of MODES) { tryDir(line, m); tryDir(rev, m); if (out.length) break; }
    return out;
  }
  function decodeGray(gray, w, h) {
    const votes = {};
    const add = cs => cs.forEach(c => votes[c] = (votes[c] || 0) + 1);
    const rows = 28;
    for (let k = 1; k < rows; k++) { const y = Math.floor(h * k / rows); add(scanLine(gray.subarray(y * w, y * w + w))); }
    for (let k = 1; k < rows; k++) { const x = Math.floor(w * k / rows); const col = new Uint8ClampedArray(h); for (let y = 0; y < h; y++) col[y] = gray[y * w + x]; add(scanLine(col)); }
    // diagonales suaves para fotos un poco torcidas
    const quick = () => Object.keys(votes).length > 0;
    for (const ang of [-4, 4, -8, 8, -12, 12]) {
      if (quick()) break;
      const t = Math.tan(ang * Math.PI / 180);
      for (let k = 2; k < 14; k++) { // líneas inclinadas horizontales
        const y0 = h * k / 15, line = []; for (let x = 0; x < w; x++) { const y = Math.round(y0 + (x - w / 2) * t); if (y >= 0 && y < h) line.push(gray[y * w + x]); }
        if (line.length > w * .5) add(scanLine(Uint8ClampedArray.from(line))); }
      for (let k = 2; k < 14; k++) { // líneas inclinadas verticales
        const x0 = w * k / 15, line = []; for (let y = 0; y < h; y++) { const x = Math.round(x0 + (y - h / 2) * t); if (x >= 0 && x < w) line.push(gray[y * w + x]); }
        if (line.length > h * .5) add(scanLine(Uint8ClampedArray.from(line))); }
    }
    const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : null;
  }
  function grayFromCanvas(c) {
    const ctx = c.getContext('2d', { willReadFrequently:true }), d = ctx.getImageData(0, 0, c.width, c.height).data, g = new Uint8ClampedArray(c.width * c.height);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    return g;
  }
  async function imageFromBlob(blob) {
    if (root.createImageBitmap) { try { return await createImageBitmap(blob); } catch {} }
    const url = URL.createObjectURL(blob);
    try { return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
  }
  async function decodeBlob(blob) {
    const img = await imageFromBlob(blob);
    if ('BarcodeDetector' in root) {
      try { const det = new root.BarcodeDetector({ formats:['ean_13', 'ean_8', 'upc_a', 'upc_e'] }); const r = await det.detect(img); if (r && r.length) { const v = r[0].rawValue; return v.length === 12 ? '0' + v : v; } } catch {}
    }
    const W = img.width || img.naturalWidth, H = img.height || img.naturalHeight;
    for (const max of [1100, 1600, 800]) {
      const s = Math.min(1, max / Math.max(W, H)), c = document.createElement('canvas');
      c.width = Math.round(W * s); c.height = Math.round(H * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const code = decodeGray(grayFromCanvas(c), c.width, c.height);
      if (code) return code;
    }
    return null;
  }
  root.JBarcode = { decodeGray, decodeBlob, scanLine, eanCheck, runsOf, tryEAN13 };
})(typeof window !== 'undefined' ? window : globalThis);
