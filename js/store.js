/* =========================================================
   JARVIS — almacenamiento en el teléfono
   Da a la app la misma interfaz que tenía dentro de Claude
   (claude.use('db' | 'user' | 'sample' | 'downloads')), pero todo local:
   los datos viven en este dispositivo y la "IA" es el cerebro local (brain.js).
   ========================================================= */
(function () {
  'use strict';
  const PFX = 'jarvis-db:';
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}

  const listeners = {};
  const read = path => { try { const v = localStorage.getItem(PFX + path); return v == null ? null : JSON.parse(v); } catch { return null; } };
  const snap = (path, data) => ({ id: path.split('/').pop(), exists: data != null, data: () => (data == null ? undefined : JSON.parse(JSON.stringify(data))), metadata: { fromCache: false } });
  const notify = path => (listeners[path] || []).forEach(cb => { try { cb(snap(path, read(path))); } catch (e) { console.error(e); } });
  window.addEventListener('storage', e => { if (e.key && e.key.startsWith(PFX)) notify(e.key.slice(PFX.length)); });

  function docRef(path) {
    return {
      id: path.split('/').pop(),
      async get() { return snap(path, read(path)); },
      async set(data) {
        try { localStorage.setItem(PFX + path, JSON.stringify(data)); }
        catch (e) { throw { code: 'quota_exceeded', message: 'El almacenamiento del teléfono para JARVIS está lleno. Exporta tus datos y borra el historial viejo.' }; }
      },
      async update(part) { return this.set({ ...(read(path) || {}), ...part }); },
      async delete() { localStorage.removeItem(PFX + path); setTimeout(() => notify(path), 0); },
      onSnapshot(cb) {
        (listeners[path] = listeners[path] || []).push(cb);
        setTimeout(() => cb(snap(path, read(path))), 0);
        return () => { listeners[path] = (listeners[path] || []).filter(x => x !== cb); };
      },
    };
  }
  function collectionRef(path) {
    return {
      doc: id => docRef(path + '/' + id),
      async get() {
        const docs = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith(PFX + path + '/')) continue;
          const rest = k.slice((PFX + path + '/').length);
          if (rest.includes('/')) continue;
          docs.push(snap(path + '/' + rest, read(path + '/' + rest)));
        }
        return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f) };
      },
    };
  }
  const db = { collection: collectionRef, doc: docRef };
  const user = { async id() { let id = null; try { id = localStorage.getItem('jarvis-uid'); if (!id) { id = 'me'; localStorage.setItem('jarvis-uid', id); } } catch { id = 'me'; } return id; } };
  const downloads = {
    async save({ filename, data, mimeType }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || 'application/json' });
      const file = new File([blob], filename || 'jarvis.json', { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Respaldo de JARVIS' }); return; } catch (e) { if (e && e.name === 'AbortError') throw { code: 'cancelled' }; } }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
  };
  // El cerebro local se conecta aquí desde brain.js
  const sample = (input, opts) => window.JARVIS_SAMPLE(input, opts);
  sample.json = (input, opts) => window.JARVIS_SAMPLE.json(input, opts);
  sample.limits = async () => ({ images: { maxCount: 5, maxInputBytes: 20 * 1024 * 1024 } });

  const caps = { db, user, sample, downloads };
  window.claude = { use: async name => caps[name] || null };
})();
