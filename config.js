// Cloudflare Worker (public, CORS-friendly)
// TODO: Replace with your LEG Cloudflare Worker URL after deployment
window.CLOUDFLARE_WORKER_URL = 'https://ccc-legends.lady-qwickske.workers.dev/';

// Frontend should call the worker to avoid GAS CORS restrictions.
window.GAS_WEB_APP_URL = window.CLOUDFLARE_WORKER_URL;
