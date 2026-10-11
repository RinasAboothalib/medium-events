import type { NextFunction, Request, Response } from 'express';

// Lets the public website (and only it) call /api/public from the browser
export function publicCors(origin: string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (origin && req.headers.origin === origin) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  };
}
