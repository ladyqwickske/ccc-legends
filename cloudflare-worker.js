/**
 * Cloudflare Worker: CORS Proxy, Google Token Verifier and edge cache for cCc Legends
 *
 * Deploy this as a Cloudflare Worker, then set its URL in pages/config.js
 */

// TODO: Replace with the LEG Google Apps Script Web App URL after deploying (do NOT reuse the SK6 URL)
const GAS_URL = 'https://script.google.com/macros/s/AKfycby8ilp-Sj4ij-CKExiMX8lzoJiZE-m99mv4ZwiN8edvNgaIsx3OwCcWcvLdj8NqR3B12A/exec';

// Read-only API functions that may be served from the edge, with their TTL in seconds.
// The portal posts { action: 'api', fn: '<name>', args: [...] }, so the key is the fn.
const CACHEABLE_FUNCTIONS = {
  getStatsSummary: 300,
  getPlayerStats: 300,
  getSplits: 300,
  getChestTypeSplitsForDateRange: 300,
  getActivePeriodDates: 300,
  getPreviousPeriodDates: 300,
  getRecentActivePeriodChestPoints: 300,
  getAllEvents: 300,
  getAllEventTypes: 600,
  getAvailableChestTypes: 600,
  getEventParticipation: 120,
  getMembersList: 300,
  getAllMembers: 300,
  getMemberGoogleAccounts: 300,
  getExemptMembers: 300,
  getAllTroopLevelsSummary: 300,
  getTroopCategories: 300,
  getHeroLevels: 300,
  getWarnings: 300,
  getWarningTypes: 3600,
  getPointTargets: 300,
  getProfilingBundle: 600,
  getBankTransactions: 120,
  getBankMemberBalances: 120,
  getBankMemberOptions: 600,
  getChestPointsReference: 86400,
  getLastImportTimestamp: 60
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function isJson(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return false;
  try { JSON.parse(trimmed); return true; } catch (e) { return false; }
}

function buildCacheKey(requestUrl, fn, args) {
  const url = new URL(requestUrl);
  url.pathname = '/__cache/' + fn + '/' + encodeURIComponent(JSON.stringify(args || []));
  url.search = '';
  return new Request(url.toString(), { method: 'GET' });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'POST') {
      try {
        const requestBody = await request.text();
        const requestData = JSON.parse(requestBody);

        // Token verification request
        if (requestData.idToken && !requestData.action) {
          return await verifyGoogleToken(requestData.idToken);
        }

        // Apps Script asks us to drop cached reads after a write
        if (requestData.action === '__purgeEdgeCache') {
          const cache = caches.default;
          const fns = Array.isArray(requestData.fns) && requestData.fns.length
            ? requestData.fns
            : Object.keys(CACHEABLE_FUNCTIONS);
          // Entries are keyed by fn + args, so sweep the argument shapes the portal actually sends
          const argShapes = [[], ['active'], ['previous'], [''], [500], [5, 3000]];
          const keys = [];
          fns.forEach(fn => argShapes.forEach(args => keys.push(buildCacheKey(request.url, fn, args))));
          await Promise.all(keys.map(key => cache.delete(key)));
          return new Response(JSON.stringify({ success: true, purged: keys.length }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }

        const fn = requestData.action === 'api' ? String(requestData.fn || '') : String(requestData.action || '');
        const cacheTtl = CACHEABLE_FUNCTIONS[fn];

        if (cacheTtl) {
          const cacheKey = buildCacheKey(request.url, fn, requestData.args);
          const cache = caches.default;

          const cachedResponse = await cache.match(cacheKey);
          if (cachedResponse) {
            const cachedBody = await cachedResponse.text();
            if (isJson(cachedBody)) {
              return new Response(cachedBody, {
                status: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
              });
            }
            // Poisoned entry (e.g. a GAS error page) — drop it and refetch
            ctx.waitUntil(cache.delete(cacheKey));
          }

          const gasResponse = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody
          });
          const responseBody = await gasResponse.text();

          // Never cache an error page; surface it as JSON so the client can report it
          if (!gasResponse.ok || !isJson(responseBody)) {
            return new Response(JSON.stringify({
              ok: false,
              error: `Apps Script returned ${gasResponse.status} for "${fn}"`,
              status: gasResponse.status
            }), {
              status: 502,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'X-Cache': 'BYPASS' }
            });
          }

          const response = new Response(responseBody, {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=' + cacheTtl,
              'X-Cache': 'MISS'
            }
          });
          ctx.waitUntil(cache.put(cacheKey, response.clone()));
          return response;
        }

        // Non-cacheable: forward directly to Google Apps Script
        const response = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody
        });
        const responseBody = await response.text();
        const newHeaders = new Headers(response.headers);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
        newHeaders.set('Content-Type', 'application/json');
        return new Response(responseBody, { status: response.status, headers: newHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }
};

async function verifyGoogleToken(idToken) {
  try {
    const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
    const response = await fetch(url);
    const data = await response.json();

    if (response.status !== 200 || !data.email_verified) {
      return new Response(JSON.stringify({
        success: false,
        error: response.status !== 200 ? 'Token verification failed' : 'Email not verified',
        email: data.email || null
      }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      email: data.email,
      token_verified: true
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Token verification error: ' + error.message
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}
