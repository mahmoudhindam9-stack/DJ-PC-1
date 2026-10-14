import { handleApi } from '../app/scripts/server.js';

/**
 * Vercel Node.js catch-all for API endpoints shared with the desktop app.
 * The Vite frontend is built from ./app by the root vercel.json configuration.
 */
export default async function handler(req, res) {
  try {
    const handled = await handleApi(req, res);
    if (!handled && !res.writableEnded) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'API endpoint not found.' }));
    }
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : 'The API request failed.',
    }));
  }
}
