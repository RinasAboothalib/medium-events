import type { Db } from '../db/index.js';
import { isUuid } from '../files/routes.js';
import { HttpError } from '../http.js';
import { day, facts, heading, renderPdf } from './pdf.js';

// Post-event report: what happened at an edition. Confirmed sponsors are listed by name and package only, never amounts.
export async function postEventPdf(db: Db, editionId: string, now: Date): Promise<{ name: string; pdf: Buffer }> {
  const [e] = isUuid(editionId)
    ? await db.query<{
        name: string;
        series_name: string;
        start_date: string;
        end_date: string | null;
        venue: string;
        description: string;
        rsvp_count: number | null;
        attendance: number | null;
        outcome_notes: string;
        status: string;
        content_type: string | null;
        data: Uint8Array | null;
      }>(
        `select e.name, s.name as series_name, e.start_date::text as start_date, e.end_date::text as end_date, e.venue, e.description,
                e.rsvp_count, e.attendance, e.outcome_notes, e.status, f.content_type, f.data
           from editions e join event_series s on s.id = e.series_id left join files f on f.id = e.banner_file_id
          where e.id = $1`,
        [editionId],
      )
    : [];
  if (!e) throw new HttpError(404, 'That edition was not found.');

  const partners = await db.query<{ name: string; role: string }>(
    `select p.name, p.role from partners p join editions e on e.id = $1
      where p.edition_id = e.id or p.series_id = e.series_id order by p.edition_id nulls last, p.sort_order, p.name`,
    [editionId],
  );
  const sponsors = await db.query<{ company: string; package: string }>(
    `select sp.company, d.package from deals d join sponsors sp on sp.id = d.sponsor_id
      where d.edition_id = $1 and d.status = 'confirmed' order by lower(sp.company)`,
    [editionId],
  );

  const sessions = await db.query<{ day: string; start_time: string; end_time: string | null; title: string; speakers: string | null }>(
    `select s.day::text as day, s.start_time, s.end_time, s.title,
            (select string_agg(sp.full_name, ', ' order by sp.sort_order, sp.full_name)
               from programme_session_speakers ss join speakers sp on sp.id = ss.speaker_id where ss.session_id = s.id) as speakers
       from programme_sessions s where s.edition_id = $1 order by s.day, s.start_time, s.title`,
    [editionId],
  );
  const [register] = await db.query<{ registered: number; checked_in: number }>(
    "select count(*) filter (where status <> 'cancelled')::int as registered, count(checked_in_at)::int as checked_in from delegates where edition_id = $1",
    [editionId],
  );

  const dates = e.end_date && e.end_date !== e.start_date ? `${day(e.start_date)} – ${day(e.end_date)}` : day(e.start_date);
  const pdf = await renderPdf(`${e.name} post-event report`, e.series_name, now, (doc) => {
    // pdfkit draws JPEG and PNG banners; WebP ones are left out
    if (e.data && (e.content_type === 'image/jpeg' || e.content_type === 'image/png')) {
      try {
        doc.image(Buffer.from(e.data), { fit: [doc.page.width - 100, 220], align: 'center' });
        doc.moveDown();
      } catch {
        // An unreadable image never stops the report
      }
    }
    heading(doc, 'The event');
    facts(doc, [
      ['Dates', dates],
      ['Venue', e.venue],
      ['Status', e.status === 'cancelled' ? 'Cancelled' : e.status === 'past' ? 'Held' : 'Upcoming'],
      ['RSVPs', e.rsvp_count],
      ['Attendance', e.attendance],
      // From the delegate register, when it was used for this edition
      ['Delegates registered', register.registered || null],
      ['Delegates checked in', register.registered ? register.checked_in : null],
    ]);
    if (e.description) {
      doc.moveDown(0.5);
      doc.text(e.description);
    }
    if (sessions.length) {
      heading(doc, 'Programme');
      const multiDay = new Set(sessions.map((x) => x.day)).size > 1;
      doc.text(
        sessions
          .map((x) => `${multiDay ? `${day(x.day)}, ` : ''}${x.start_time}${x.end_time ? `-${x.end_time}` : ''}  ${x.title}${x.speakers ? ` (${x.speakers})` : ''}`)
          .join('\n'),
      );
    }
    heading(doc, 'Partners');
    doc.text(partners.length ? partners.map((p) => (p.role ? `${p.name} (${p.role})` : p.name)).join('\n') : 'None recorded.');
    heading(doc, 'Confirmed sponsors');
    doc.text(sponsors.length ? sponsors.map((s) => `${s.company}: ${s.package}`).join('\n') : 'None recorded.');
    heading(doc, 'Outcome');
    doc.text(e.outcome_notes || 'No outcome notes recorded yet.');
  });
  return { name: e.name, pdf };
}
