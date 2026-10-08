import http from 'node:http';

const proxyPort = Number(process.env.PMS_API_PROXY_PORT ?? 3001);
const controlPort = Number(process.env.PMS_API_PROXY_CONTROL_PORT ?? 3101);
const upstreamPort = Number(process.env.PMS_API_UPSTREAM_PORT ?? 3002);
let nextFault = null;
let bookingKeys = [];
let quoteTotalOverride = null;

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

const control = http.createServer(async (request, response) => {
  if (request.method === 'POST' && request.url === '/fault') {
    let body = '';
    for await (const chunk of request) body += chunk;
    let input;
    try { input = JSON.parse(body); } catch { sendJson(response, 400, { error: 'invalid_json' }); return; }
    if (input.mode !== 'lose-response' && input.mode !== 'status') {
      sendJson(response, 400, { error: 'invalid_mode' }); return;
    }
    if (input.mode === 'status' && (!Number.isInteger(input.status) || input.status < 400 || input.status > 599)) {
      sendJson(response, 400, { error: 'invalid_status' }); return;
    }
    nextFault = input;
    bookingKeys = [];
    quoteTotalOverride = input.mode === 'status' && input.body?.error === 'price_changed' && Number.isFinite(input.body.currentTotal)
      ? input.body.currentTotal : null;
    sendJson(response, 200, { armed: true });
    return;
  }
  if (request.method === 'GET' && request.url === '/stats') {
    sendJson(response, 200, { bookingKeys });
    return;
  }
  sendJson(response, 404, { error: 'not_found' });
});

const proxy = http.createServer((request, response) => {
  const isBooking = request.method === 'POST' && request.url?.split('?')[0] === '/api/bookings';
  if (isBooking) bookingKeys.push(request.headers['idempotency-key'] ?? '');
  const fault = isBooking ? nextFault : null;
  if (fault) nextFault = null;

  if (fault?.mode === 'status') {
    request.resume();
    sendJson(response, fault.status, fault.body ?? { error: 'unavailable', message: 'Injected test response.' });
    return;
  }

  const headers = { ...request.headers, host: `localhost:${upstreamPort}` };
  delete headers['accept-encoding'];
  const upstream = http.request({ hostname: '127.0.0.1', port: upstreamPort, path: request.url, method: request.method, headers }, (upstreamResponse) => {
    if (fault?.mode === 'lose-response') {
      upstreamResponse.resume();
      upstreamResponse.on('end', () => response.destroy());
      return;
    }
    if (request.method === 'POST' && request.url?.split('?')[0] === '/api/quotes' && quoteTotalOverride !== null) {
      const total = quoteTotalOverride;
      quoteTotalOverride = null;
      const chunks = [];
      upstreamResponse.on('data', (chunk) => chunks.push(chunk));
      upstreamResponse.on('end', () => {
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          payload.quote.price.total = total;
          response.writeHead(upstreamResponse.statusCode ?? 200, {
            'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
          });
          response.end(JSON.stringify(payload));
        } catch {
          sendJson(response, 502, { error: 'invalid_upstream_json' });
        }
      });
      return;
    }
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.destroyed) sendJson(response, 502, { error: 'upstream_unavailable' });
  });
  request.pipe(upstream);
});

control.listen(controlPort, '127.0.0.1');
proxy.listen(proxyPort, '127.0.0.1');
console.log(`Test-only PMS proxy listening on ${proxyPort}; controls on 127.0.0.1:${controlPort}`);

function stop() {
  control.close();
  proxy.close();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
