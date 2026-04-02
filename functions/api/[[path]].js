export async function onRequest(context) {
  const { request, params, env } = context;

  const origin = (env.API_ORIGIN || '').replace(/\/$/, '');
  if (!origin) {
    return new Response(
      JSON.stringify({ error: 'API_ORIGIN is not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }

  const url = new URL(request.url);
  const splat = Array.isArray(params.path)
    ? params.path.join('/')
    : (params.path || '');

  const targetUrl = `${origin}/api/${splat}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set('Host', new URL(origin).host);

  const init = {
    method: request.method,
    headers,
    redirect: 'manual'
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  const upstream = await fetch(targetUrl, init);

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set('Access-Control-Allow-Origin', url.origin);
  responseHeaders.set('Vary', 'Origin');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });
}
