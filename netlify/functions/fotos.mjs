// Fotos reales de referencia para una pieza.
//  POST {q, titulo}  → Claude busca en la web (herramienta web_search) y devuelve páginas con fotos.
//  GET  ?u=<url>     → lee esa página y devuelve su foto principal (og:image).
// Usa la misma ANTHROPIC_API_KEY. Cada búsqueda web cuesta aparte (ver README).
const UA = 'Mozilla/5.0 (compatible; AtelierGuadi/1.0; +https://atelierguadi.netlify.app)';

export default async (req) => {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin };
  const url = new URL(req.url);

  if (req.method === 'GET' && url.searchParams.get('u')) {
    const u = url.searchParams.get('u');
    let target;
    try { target = new URL(u); if (!/^https?:$/.test(target.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[|0\.)/.test(target.hostname)) throw 0; } catch { return new Response(JSON.stringify({ error: 'url' }), { status: 400, headers }); }
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(target, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: ctl.signal });
      clearTimeout(tm);
      const html = (await r.text()).slice(0, 400000);
      const meta = (prop) => {
        const a = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]*content=["\']([^"\']+)', 'i'));
        const b = html.match(new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']' + prop + '["\']', 'i'));
        return (a && a[1]) || (b && b[1]) || '';
      };
      let img = meta('og:image:secure_url') || meta('og:image') || meta('twitter:image') || meta('twitter:image:src');
      if (!img) return new Response(JSON.stringify({ img: '' }), { status: 200, headers });
      img = new URL(img.replace(/&amp;/g, '&'), r.url || target).href;
      const title = meta('og:title') || ((html.match(/<title[^>]*>([^<]{1,140})/i) || [])[1] || '');
      const site = meta('og:site_name') || target.hostname.replace(/^www\./, '');
      return new Response(JSON.stringify({ img, title: title.trim(), site, page: target.href }), { status: 200, headers: { ...headers, 'Cache-Control': 'public, max-age=86400' } });
    } catch { return new Response(JSON.stringify({ img: '' }), { status: 200, headers }); }
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return new Response(JSON.stringify({ error: 'Falta ANTHROPIC_API_KEY' }), { status: 501, headers });
  let body; try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers }); }
  const q = String(body.q || '').slice(0, 200), titulo = String(body.titulo || '').slice(0, 200), ref = String(body.ref || '').slice(0, 200);
  if (!q && !titulo) return new Response(JSON.stringify({ error: 'Falta la búsqueda' }), { status: 400, headers });

  const model = process.env.CLAUDE_MODEL_QUICK || 'claude-haiku-5-5';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: 1200,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
      messages: [{ role: 'user', content: 'Buscá en la web fotos reales de piezas de cerámica como esta, para usarlas de referencia visual: "' + titulo + '"' + (ref ? ' (referente: ' + ref + ')' : '') + '. Búsqueda sugerida: "' + q + '". Preferí páginas de producto, tiendas, galerías, museos o artistas que muestren la pieza en foto. Hacé una o dos búsquedas y respondé solo "listo".' }]
    })
  });
  if (!r.ok) {
    let msg = ''; try { const j = await r.json(); msg = (j.error && j.error.message) || ''; } catch {}
    return new Response(JSON.stringify({ error: 'upstream', status: r.status, message: msg }), { status: 502, headers });
  }
  const j = await r.json(), seen = new Set(), pages = [];
  for (const blk of j.content || []) {
    if (blk.type !== 'web_search_tool_result' || !Array.isArray(blk.content)) continue;
    for (const it of blk.content) {
      if (!it || !it.url || seen.has(it.url)) continue;
      seen.add(it.url); pages.push({ url: it.url, title: it.title || '' });
    }
  }
  return new Response(JSON.stringify({ pages: pages.slice(0, 10) }), { status: 200, headers });
};
