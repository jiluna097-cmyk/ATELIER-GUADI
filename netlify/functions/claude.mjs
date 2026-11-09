// Función de Netlify que conecta la app con la API de Claude.
// Variables de entorno (Netlify → Site configuration → Environment variables):
//   ANTHROPIC_API_KEY  (obligatoria) tu clave de https://console.anthropic.com
//   CLAUDE_MODEL       (opcional) modelo para pedidos normales. Por defecto: claude-sonnet-5-5
//   CLAUDE_MODEL_QUICK (opcional) modelo para pedidos rápidos. Por defecto: claude-haiku-5-5
//   ALLOWED_ORIGIN     (opcional) tu dominio, ej. https://atelier-guadi.netlify.app

const MAX_PROMPT = 20000;
const MAX_IMAGE_B64 = 6_000_000; // ~4,5 MB por imagen

export default async (req) => {
  const key = process.env.ANTHROPIC_API_KEY;
  const origin = process.env.ALLOWED_ORIGIN || '*';
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin };

  if (!key) return new Response(JSON.stringify({ error: 'Falta ANTHROPIC_API_KEY' }), { status: 501, headers });
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (!url.searchParams.has('test')) return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    // Diagnóstico: /.netlify/functions/claude?test=1
    const t = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5', max_tokens: 20, messages: [{ role: 'user', content: 'Respondé solo: funciona' }] })
    });
    const tj = await t.json().catch(() => ({}));
    const ok = t.ok;
    return new Response(JSON.stringify({
      clave_cargada: true,
      modelo: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
      resultado: ok ? 'OK: Claude responde' : 'ERROR ' + t.status,
      detalle: ok ? (tj.content || []).map((c) => c.text).join('') : (tj.error && tj.error.message) || tj
    }, null, 2), { status: 200, headers });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });

  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers }); }

  const prompt = String(body.prompt || '').slice(0, MAX_PROMPT);
  if (!prompt) return new Response(JSON.stringify({ error: 'Falta el pedido' }), { status: 400, headers });
  const images = Array.isArray(body.images) ? body.images.slice(0, 2) : [];
  const content = [];
  for (const im of images) {
    if (!im || typeof im.data !== 'string' || im.data.length > MAX_IMAGE_B64) continue;
    const mt = /^image\/(jpeg|png|gif|webp)$/.test(im.media_type) ? im.media_type : 'image/jpeg';
    content.push({ type: 'image', source: { type: 'base64', media_type: mt, data: im.data } });
  }
  content.push({ type: 'text', text: prompt });

  const model = body.tier === 'quick'
    ? (process.env.CLAUDE_MODEL_QUICK || 'claude-haiku-5-5')
    : (process.env.CLAUDE_MODEL || 'claude-sonnet-5-5');

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: 'user', content }] })
  });
  if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers });
  if (!r.ok) {
    const detail = await r.text();
    let msg = detail.slice(0, 300);
    try { const dj = JSON.parse(detail); msg = (dj.error && dj.error.message) || msg; } catch {}
    return new Response(JSON.stringify({ error: 'upstream', status: r.status, message: msg }), { status: 502, headers });
  }
  const j = await r.json();
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return new Response(JSON.stringify({ text, truncated: j.stop_reason === 'max_tokens' }), { status: 200, headers });
};
