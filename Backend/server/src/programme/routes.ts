import { Router, type Response } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app.js';
import type { Db } from '../db/index.js';
import { diff, recordActivity } from '../activity.js';
import { currentUser, requirePermission } from '../auth/middleware.js';
import { insertRow, updateRow } from '../crud.js';
import { route } from '../http.js';
import { date, editionFilter, fieldError, one, parse, requireEdition, text, uuid, type EditionDates, type Row } from '../validate.js';

export const SESSION_KINDS = ['keynote', 'panel', 'presentation', 'workshop', 'ceremony', 'networking', 'break', 'other'] as const;

const time = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Use a time like 09:30.');

const speakerFields = {
  edition_id: uuid('Choose an edition.'),
  full_name: z.string().trim().min(1, "Enter the speaker's name.").max(200),
  job_title: text,
  organisation: text,
  bio: text,
  sort_order: z.number().int(),
};
const speakerPatch = z.object(speakerFields).omit({ edition_id: true }).partial();
const speakerCreate = z.object(speakerFields).partial().extend({ edition_id: speakerFields.edition_id, full_name: speakerFields.full_name });

const sessionFields = {
  edition_id: uuid('Choose an edition.'),
  title: z.string().trim().min(1, 'Enter the session title.').max(300),
  day: date,
  start_time: time,
  end_time: time.nullable(),
  room: text,
  kind: z.enum(SESSION_KINDS, { message: 'Choose a session type.' }),
  description: text,
  speaker_ids: z.array(uuid('Choose speakers from this edition.')).max(30),
};
const sessionPatch = z.object(sessionFields).omit({ edition_id: true }).partial();
const sessionCreate = z
  .object(sessionFields)
  .partial()
  .extend({ edition_id: sessionFields.edition_id, title: sessionFields.title, day: sessionFields.day, start_time: sessionFields.start_time });

const SPEAKER_SQL = `select sp.id, sp.edition_id, sp.full_name, sp.job_title, sp.organisation, sp.bio, sp.sort_order,
  (select count(*)::int from programme_session_speakers ss where ss.speaker_id = sp.id) as session_count
  from speakers sp`;
const SESSION_SQL = `select s.id, s.edition_id, s.title, s.day::text as day, s.start_time, s.end_time, s.room, s.kind, s.description,
  coalesce((select json_agg(json_build_object('id', sp.id, 'full_name', sp.full_name) order by sp.sort_order, sp.full_name)
              from programme_session_speakers ss join speakers sp on sp.id = ss.speaker_id where ss.session_id = s.id), '[]'::json) as speakers
  from programme_sessions s`;
const NO_SPEAKER = 'That speaker was not found.';
const NO_SESSION = 'That session was not found.';

// A session's day must fall within its edition, and it can't end before it starts
function assertTimes(edition: EditionDates, s: { day: string; start_time: string; end_time: string | null }) {
  if (s.day < edition.start_date || s.day > (edition.end_date ?? edition.start_date)) throw fieldError('day', `Choose a day during ${edition.name}.`);
  if (s.end_time && s.end_time <= s.start_time) throw fieldError('end_time', 'The end time must be after the start time.');
}

// Replaces a session's speakers; every one must belong to the session's edition
async function setSpeakers(tx: Db, sessionId: string, editionId: string, speakerIds: string[]) {
  const ids = [...new Set(speakerIds)];
  if (ids.length) {
    const found = await tx.query('select 1 from speakers where edition_id = $1 and id = any($2::uuid[])', [editionId, ids]);
    if (found.length !== ids.length) throw fieldError('speaker_ids', 'Choose speakers from this edition.');
  }
  await tx.query('delete from programme_session_speakers where session_id = $1', [sessionId]);
  for (const speakerId of ids) await tx.query('insert into programme_session_speakers (session_id, speaker_id) values ($1, $2)', [sessionId, speakerId]);
}

const speakerIdsOf = (session: Row) => (session.speakers as { id: string }[]).map((sp) => sp.id).sort();

// The programme of an edition: its speakers and the sessions they take part in.
// Part of the event itself, so it follows the events permissions.
export function programmeRoutes(ctx: AppContext) {
  const speakers = Router();
  const sessions = Router();
  const read = requirePermission('events.read');
  const write = requirePermission('events.write');

  const log = (tx: Db, res: Response, entity: string, entityId: string, action: 'create' | 'update' | 'delete', changes?: Record<string, unknown>) =>
    recordActivity(tx, { actorId: currentUser(res).id, entity, entityId, action, changes, at: ctx.now() });

  // ---- speakers ----
  speakers.get(
    '/',
    read,
    route(async (req, res) => {
      const editionId = editionFilter(req.query);
      res.json(await ctx.db.query(`${SPEAKER_SQL} ${editionId ? 'where sp.edition_id = $1' : ''} order by sp.sort_order, lower(sp.full_name)`, editionId ? [editionId] : []));
    }),
  );

  speakers.post(
    '/',
    write,
    route(async (req, res) => {
      const body = parse(speakerCreate, req.body);
      const id = await ctx.db.transaction(async (tx) => {
        await requireEdition(tx, body.edition_id);
        const newId = await insertRow(tx, 'speakers', { ...body, created_at: ctx.now(), updated_at: ctx.now() });
        await log(tx, res, 'speakers', newId, 'create', { full_name: body.full_name, edition_id: body.edition_id });
        return newId;
      });
      res.status(201).json(await one(ctx.db, SPEAKER_SQL, 'sp', id, NO_SPEAKER));
    }),
  );

  speakers.patch(
    '/:id',
    write,
    route(async (req, res) => {
      const patch = parse(speakerPatch, req.body);
      const before = await one(ctx.db, SPEAKER_SQL, 'sp', req.params.id, NO_SPEAKER);
      await ctx.db.transaction(async (tx) => {
        const changes = diff(before, patch);
        if (!Object.keys(changes).length) return;
        await updateRow(tx, 'speakers', req.params.id, { ...patch, updated_at: ctx.now() });
        await log(tx, res, 'speakers', req.params.id, 'update', changes);
      });
      res.json(await one(ctx.db, SPEAKER_SQL, 'sp', req.params.id, NO_SPEAKER));
    }),
  );

  // Removing a speaker also takes them off their sessions
  speakers.delete(
    '/:id',
    write,
    route(async (req, res) => {
      const before = await one(ctx.db, SPEAKER_SQL, 'sp', req.params.id, NO_SPEAKER);
      await ctx.db.transaction(async (tx) => {
        await tx.query('delete from speakers where id = $1', [req.params.id]);
        await log(tx, res, 'speakers', req.params.id, 'delete', { full_name: before.full_name });
      });
      res.status(204).end();
    }),
  );

  // ---- sessions ----
  sessions.get(
    '/',
    read,
    route(async (req, res) => {
      const editionId = editionFilter(req.query);
      res.json(await ctx.db.query(`${SESSION_SQL} ${editionId ? 'where s.edition_id = $1' : ''} order by s.day, s.start_time, s.title`, editionId ? [editionId] : []));
    }),
  );

  sessions.post(
    '/',
    write,
    route(async (req, res) => {
      const { speaker_ids = [], ...body } = parse(sessionCreate, req.body);
      const id = await ctx.db.transaction(async (tx) => {
        assertTimes(await requireEdition(tx, body.edition_id), { ...body, end_time: body.end_time ?? null });
        const newId = await insertRow(tx, 'programme_sessions', { ...body, created_at: ctx.now(), updated_at: ctx.now() });
        await setSpeakers(tx, newId, body.edition_id, speaker_ids);
        await log(tx, res, 'programme_sessions', newId, 'create', { title: body.title, day: body.day, start_time: body.start_time });
        return newId;
      });
      res.status(201).json(await one(ctx.db, SESSION_SQL, 's', id, NO_SESSION));
    }),
  );

  sessions.patch(
    '/:id',
    write,
    route(async (req, res) => {
      const { speaker_ids, ...patch } = parse(sessionPatch, req.body);
      const before = await one(ctx.db, SESSION_SQL, 's', req.params.id, NO_SESSION);
      const editionId = before.edition_id as string;
      await ctx.db.transaction(async (tx) => {
        assertTimes(await requireEdition(tx, editionId), {
          day: patch.day ?? (before.day as string),
          start_time: patch.start_time ?? (before.start_time as string),
          end_time: patch.end_time === undefined ? (before.end_time as string | null) : patch.end_time,
        });
        const changes: Record<string, unknown> = diff(before, patch);
        if (Object.keys(changes).length) await updateRow(tx, 'programme_sessions', req.params.id, { ...patch, updated_at: ctx.now() });
        const next = speaker_ids && [...new Set(speaker_ids)].sort();
        if (next && JSON.stringify(next) !== JSON.stringify(speakerIdsOf(before))) {
          await setSpeakers(tx, req.params.id, editionId, next);
          changes.speaker_ids = { old: speakerIdsOf(before), new: next };
        }
        if (Object.keys(changes).length) await log(tx, res, 'programme_sessions', req.params.id, 'update', changes);
      });
      res.json(await one(ctx.db, SESSION_SQL, 's', req.params.id, NO_SESSION));
    }),
  );

  sessions.delete(
    '/:id',
    write,
    route(async (req, res) => {
      const before = await one(ctx.db, SESSION_SQL, 's', req.params.id, NO_SESSION);
      await ctx.db.transaction(async (tx) => {
        await tx.query('delete from programme_sessions where id = $1', [req.params.id]);
        await log(tx, res, 'programme_sessions', req.params.id, 'delete', { title: before.title });
      });
      res.status(204).end();
    }),
  );

  return { speakers, sessions };
}
