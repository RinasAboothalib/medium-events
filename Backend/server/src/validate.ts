// Request checks shared by the edition modules (tasks, programme, delegates, expenses).
import { z } from 'zod';
import type { Db } from './db/index.js';
import { isUuid } from './files/routes.js';
import { HttpError, validationError } from './http.js';

export const uuid = (message: string) => z.string().regex(/^[0-9a-f-]{36}$/i, message);
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-31.');
export const text = z.string().trim().max(5000);
export const email = z.union([z.literal(''), z.string().trim().toLowerCase().email('Enter a valid email address.')]);

export function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

export type Row = Record<string, unknown>;

// One row of `sql` (which selects from a table aliased `alias`) or a 404 with `missing`
export async function one(db: Db, sql: string, alias: string, id: string, missing: string): Promise<Row> {
  const [row] = isUuid(id) ? await db.query<Row>(`${sql} where ${alias}.id = $1`, [id]) : [];
  if (!row) throw new HttpError(404, missing);
  return row;
}

export const fieldError = (field: string, message: string) => new HttpError(400, 'Check the highlighted fields.', { [field]: message });

export interface EditionDates {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
}

// The edition a new row belongs to; a missing one is a field error, not a 404
export async function requireEdition(tx: Db, editionId: string): Promise<EditionDates> {
  const [edition] = isUuid(editionId)
    ? await tx.query<EditionDates>('select id, name, start_date::text as start_date, end_date::text as end_date from editions where id = $1', [editionId])
    : [];
  if (!edition) throw fieldError('edition_id', 'Choose an edition.');
  return edition;
}

// `?edition_id=` when it is a real id, otherwise null (no filter)
export const editionFilter = (query: Record<string, unknown>) =>
  typeof query.edition_id === 'string' && isUuid(query.edition_id) ? query.edition_id : null;

// Builds "where a = $1 and b = $2" one condition at a time; `?` stands for the value's placeholder
export function whereBuilder() {
  const where: string[] = [];
  const params: unknown[] = [];
  return {
    params,
    add(sql: string, value: unknown) {
      params.push(value);
      where.push(sql.replaceAll('?', `$${params.length}`));
    },
    get sql() {
      return where.length ? `where ${where.join(' and ')}` : '';
    },
  };
}
