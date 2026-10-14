import { handleApi } from '../scripts/server.js';

/**
 * Vercel Node.js catch-all for the app's online music and update API routes.
 * The shared handler only processes /api/* paths; all other requests are static Vite assets.
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
    res.end(JSON.stringify({ ok: false, error: 'The API request failed.' }));
  }
}
