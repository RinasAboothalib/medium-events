import type { NextFunction, Request, Response } from 'express';

// "https://medium.mv, https://www.medium.mv/" → ["https://medium.mv", "https://www.medium.mv"]
export function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

// Lets the public website (and only it) call /api/public from the browser.
// `origins` is one address or a comma-separated list (e.g. with and without www).
export function publicCors(origins: string | undefined) {
  const allowed = parseOrigins(origins);
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && allowed.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  };
}
