/* Puente para usar Claude fuera de claude.ai.
   En Netlify, la app llama a /.netlify/functions/claude (que guarda la clave de API).
   Si la función no está configurada, la app funciona igual pero sin las funciones de IA. */
(function () {
  if (window.claude && window.claude.use) return; // dentro de claude.ai se usa lo nativo
  window.__STANDALONE = true;
  var ENDPOINT = '/.netlify/functions/claude';
  var available = null;

  function blobToBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result); res({ media_type: blob.type || 'image/jpeg', data: s.slice(s.indexOf(',') + 1) }); };
      r.onerror = rej; r.readAsDataURL(blob);
    });
  }
  async function call(input, opts) {
    opts = opts || {};
    var prompt = typeof input === 'string' ? input : (input || []).map(function (m) { return m.content; }).join('\n\n');
    var images = [];
    if (opts.images && opts.images.length) images = await Promise.all(opts.images.slice(0, 2).map(blobToBase64));
    var r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt, images: images, tier: opts.modelTier || 'default' }) });
    if (r.status === 501 || r.status === 404) { available = false; throw { code: 'not_granted', message: 'Claude no está configurado en este sitio.' }; }
    if (r.status === 429) throw { code: 'rate_limited', message: 'Demasiados pedidos.' };
    if (!r.ok) { var ej = {}; try { ej = await r.json(); } catch (e) {} throw { code: 'upstream', message: 'Error ' + r.status + (ej.message ? ': ' + ej.message : '') }; }
    var j = await r.json();
    return { text: String(j.text || ''), truncated: !!j.truncated };
  }
  function parseJSON(t) {
    var s = t.replace(/```json|```/g, '').trim(), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
    return JSON.parse(s);
  }
  var sample = function (input, opts) { return call(input, opts); };
  sample.json = async function (input, opts) { var r = await call(input + '\n\nRespondé únicamente con el JSON pedido, sin texto antes ni después.', opts); return parseJSON(r.text); };
  sample.limits = async function () { return { images: true }; };

  async function check() {
    if (available !== null) return available;
    try { var r = await fetch(ENDPOINT, { method: 'GET' }); available = r.ok; } catch (e) { available = false; }
    return available;
  }
  window.claude = {
    use: async function (name) {
      if (name === 'sample') return (await check()) ? sample : null;
      return null; // db, assets y user no existen fuera de claude.ai: la app usa el guardado local
    }
  };
})();
