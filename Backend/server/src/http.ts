import type { NextFunction, Request, Response } from 'express';
import type { ZodError } from 'zod';

// Thrown anywhere in a request (including inside a transaction) to send a specific status and message
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function validationError(error: ZodError): HttpError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'body');
    fields[key] ??= issue.message;
  }
  return new HttpError(400, 'Check the highlighted fields.', fields);
}

// Wraps an async route so thrown errors reach Express's error handler
export const route =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);
