// End-to-end check of every API route over real HTTP: `npm run smoke`.
// Starts the server on a spare port with a throwaway in-memory database (seeded like a first run),
// walks through each route as the roles that use it, and prints one line per call. Never touches real data.
import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, ensureDefaultAdmin } from '../src/bootstrap.js';
import { openDb } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import { seedEvents } from '../src/seed.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const db = await openDb({ dataDir: 'memory' });
await migrate(db, join(root, 'migrations'));
await seedEvents(db, join(root, 'seed'));
await ensureDefaultAdmin(db);
const server = createApp({ db, config: { publicSiteOrigin: 'http://localhost:3005' } }).listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

let failures = 0;
let calls = 0;

interface Reply {
  status: number;
  body: unknown;
  type: string;
  bytes: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// One signed-in person: keeps their session cookie between calls
function client(name: string) {
  let cookie = '';
  return async function call(method: string, path: string, expected: number, body?: unknown, raw?: { type: string; data: Uint8Array }): Promise<Reply> {
    const res = await fetch(base + path, {
      method,
      headers: { ...(cookie ? { cookie } : {}), ...(raw ? { 'content-type': raw.type } : body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: raw ? raw.data : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const type = res.headers.get('content-type') ?? '';
    const buffer = Buffer.from(await res.arrayBuffer());
    const parsed: unknown = type.includes('json') && buffer.length ? JSON.parse(buffer.toString()) : null;
    const errorBody = isRecord(parsed) ? parsed : undefined;
    const ok = res.status === expected;
    calls += 1;
    if (!ok) failures += 1;
    const detail = ok ? '' : `  <-- expected ${expected}${errorBody?.error ? `: ${errorBody.error} ${JSON.stringify(errorBody.fields ?? '')}` : ''}`;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(res.status).padEnd(4)} ${name.padEnd(8)} ${method.padEnd(6)} ${path}${detail}`);
    return { status: res.status, body: parsed, type, bytes: buffer.length };
  };
}

function check(label: string, pass: boolean) {
  calls += 1;
  if (!pass) failures += 1;
  console.log(`${pass ? 'ok  ' : 'FAIL'}      check    ${label}`);
}

const section = (title: string) => console.log(`\n== ${title} ==`);
const password = () => `Smoke-${randomBytes(9).toString('base64url')}`;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const NONE = '00000000-0000-0000-0000-000000000000';

const anon = client('public');
const admin = client('admin');
const sales = client('sales');
const events = client('events');
const finance = client('finance');

section('Health, sign-in and first-run password change');
await anon('GET', '/api/health', 200);
await anon('GET', '/api/auth/me', 401);
await anon('GET', '/api/nothing-here', 401);
await admin('POST', '/api/auth/login', 401, { email: DEFAULT_ADMIN_EMAIL, password: 'wrong-password' });
await admin('POST', '/api/auth/login', 200, { email: DEFAULT_ADMIN_EMAIL, password: DEFAULT_ADMIN_PASSWORD });
check('default admin must change password', (await admin('GET', '/api/auth/me', 200)).body.must_change_password === true);
await admin('GET', '/api/series', 403);
const adminPassword = password();
await admin('POST', '/api/auth/change-password', 400, { current_password: DEFAULT_ADMIN_PASSWORD, new_password: 'short' });
await admin('POST', '/api/auth/change-password', 204, { current_password: DEFAULT_ADMIN_PASSWORD, new_password: adminPassword });
await admin('GET', '/api/nothing-here', 404);

section('Staff');
const staffIds: Record<string, string> = {};
for (const [role, person] of [['sales', sales], ['events', events], ['finance', finance]] as const) {
  const temp = password();
  const own = password();
  const created = await admin('POST', '/api/staff', 201, { email: `${role}@smoke.test`, full_name: `Smoke ${role}`, role, temp_password: temp });
  staffIds[role] = created.body.id;
  await person('POST', '/api/auth/login', 200, { email: `${role}@smoke.test`, password: temp });
  await person('POST', '/api/auth/change-password', 204, { current_password: temp, new_password: own });
}
await admin('POST', '/api/staff', 409, { email: 'sales@smoke.test', full_name: 'Twice', role: 'sales', temp_password: password() });
await admin('GET', '/api/staff', 200);
check('non-admins see names and roles only', !('email' in (await sales('GET', '/api/staff', 200)).body[0]));
await admin('PATCH', `/api/staff/${staffIds.sales}`, 200, { full_name: 'Smoke Sales' });
await sales('PATCH', `/api/staff/${staffIds.events}`, 403, { full_name: 'x' });
await admin('POST', `/api/staff/${staffIds.finance}/reset-password`, 204, { temp_password: password() });
// The reset signed finance out; give them a working session again
{
  const temp = password();
  await admin('POST', `/api/staff/${staffIds.finance}/reset-password`, 204, { temp_password: temp });
  await finance('POST', '/api/auth/login', 200, { email: 'finance@smoke.test', password: temp });
  await finance('POST', '/api/auth/change-password', 204, { current_password: temp, new_password: password() });
}

section('Events: series, editions, partners, files');
const seeded = await sales('GET', '/api/series', 200);
check(`seeded series are listed (${seeded.body.length})`, seeded.body.length > 0);
await sales('GET', `/api/series/${seeded.body[0].id}`, 200);
const series = (await events('POST', '/api/series', 201, { slug: 'smoke-forum', name: 'Smoke Forum', label: 'Smoke Forum', short_name: 'SF' })).body;
await events('POST', '/api/series', 409, { slug: 'smoke-forum', name: 'Again', label: 'Again', short_name: 'A' });
await sales('POST', '/api/series', 403, { slug: 'nope', name: 'Nope', label: 'Nope', short_name: 'N' });
await events('PATCH', `/api/series/${series.id}`, 200, { tagline: 'Checked end to end.' });
const banner = (await events('POST', '/api/files?filename=banner.jpg', 201, undefined, { type: 'image/jpeg', data: JPEG })).body;
await events('POST', '/api/files?filename=notes.txt', 400, undefined, { type: 'text/plain', data: JPEG });
check('uploaded image is served back', (await sales('GET', `/api/files/${banner.id}`, 200)).type === 'image/jpeg');
const edition = (
  await events('POST', '/api/editions', 201, { series_id: series.id, name: 'Smoke Forum 2026', start_date: '2026-11-01', end_date: '2026-11-02', venue: 'Malé', status: 'past', banner_file_id: banner.id })
).body;
await events('POST', '/api/editions', 400, { series_id: series.id, name: 'Backwards', start_date: '2026-11-02', end_date: '2026-11-01' });
await finance('GET', '/api/editions', 200);
await finance('GET', `/api/editions?series_id=${series.id}`, 200);
await finance('GET', `/api/editions/${edition.id}`, 200);
await events('PATCH', `/api/editions/${edition.id}`, 200, { attendance: 180, rsvp_count: 220, outcome_notes: 'Full house.' });
await events('DELETE', `/api/files/${banner.id}`, 409);
const partner = (await events('POST', '/api/partners', 201, { name: 'Smoke Association', role: 'Endorsing association', edition_id: edition.id })).body;
await events('GET', `/api/partners?edition_id=${edition.id}`, 200);
await events('PATCH', `/api/partners/${partner.id}`, 200, { role: 'Strategic partner' });
const spare = (await events('POST', '/api/partners', 201, { name: 'Spare', series_id: series.id })).body;
await events('DELETE', `/api/partners/${spare.id}`, 204);

section('Programme: speakers and sessions');
const speaker = (await events('POST', '/api/speakers', 201, { edition_id: edition.id, full_name: 'Aminath Speaker', organisation: 'Ministry' })).body;
await events('POST', '/api/speakers', 400, { edition_id: edition.id, full_name: '' });
await sales('POST', '/api/speakers', 403, { edition_id: edition.id, full_name: 'x' });
await events('PATCH', `/api/speakers/${speaker.id}`, 200, { job_title: 'Minister' });
const session = (await events('POST', '/api/sessions', 201, { edition_id: edition.id, title: 'Opening keynote', day: '2026-11-01', start_time: '09:00', end_time: '09:45', kind: 'keynote', speaker_ids: [speaker.id] })).body;
check('session carries its speaker', session.speakers?.[0]?.full_name === 'Aminath Speaker');
await events('POST', '/api/sessions', 400, { edition_id: edition.id, title: 'Too late', day: '2026-11-05', start_time: '09:00' });
await events('PATCH', `/api/sessions/${session.id}`, 200, { room: 'Main hall' });
await finance('GET', `/api/sessions?edition_id=${edition.id}`, 200);
check('speaker shows a session count', (await finance('GET', `/api/speakers?edition_id=${edition.id}`, 200)).body[0].session_count === 1);
const spareSession = (await events('POST', '/api/sessions', 201, { edition_id: edition.id, title: 'Coffee', day: '2026-11-01', start_time: '10:00', kind: 'break' })).body;
await events('DELETE', `/api/sessions/${spareSession.id}`, 204);
const spareSpeaker = (await events('POST', '/api/speakers', 201, { edition_id: edition.id, full_name: 'Spare' })).body;
await events('DELETE', `/api/speakers/${spareSpeaker.id}`, 204);

section('Tasks');
const task = (await events('POST', '/api/tasks', 201, { edition_id: edition.id, title: 'Book the hall', due_date: '2026-10-01', assignee_id: staffIds.events })).body;
await events('POST', '/api/tasks', 400, { edition_id: edition.id, title: '' });
await sales('POST', '/api/tasks', 403, { edition_id: edition.id, title: 'x' });
await sales('GET', `/api/tasks?edition_id=${edition.id}`, 200);
check('"assignee=me" finds my task', (await events('GET', '/api/tasks?assignee=me', 200)).body.length === 1);
await sales('GET', `/api/tasks/${task.id}`, 200);
check('done stamps the finish time', (await events('PATCH', `/api/tasks/${task.id}`, 200, { status: 'done' })).body.completed_at !== null);
const spareTask = (await events('POST', '/api/tasks', 201, { edition_id: edition.id, title: 'Spare' })).body;
await events('DELETE', `/api/tasks/${spareTask.id}`, 204);
await events('GET', `/api/tasks/${NONE}`, 404);

section('Delegates and check-in');
const delegate = (await events('POST', '/api/delegates', 201, { edition_id: edition.id, full_name: 'Mariyam Delegate', company: 'Island Builders', email: 'mariyam@smoke.test', status: 'confirmed' })).body;
await events('POST', '/api/delegates', 409, { edition_id: edition.id, full_name: 'Same Email', email: 'MARIYAM@smoke.test' });
await events('POST', '/api/delegates', 400, { edition_id: edition.id, full_name: '' });
await sales('POST', '/api/delegates', 403, { edition_id: edition.id, full_name: 'x' });
await finance('GET', '/api/delegates', 403);
await sales('GET', `/api/delegates/${delegate.id}`, 200);
await events('PATCH', `/api/delegates/${delegate.id}`, 200, { job_title: 'Director' });
check('check-in marks attended', (await events('POST', `/api/delegates/${delegate.id}/check-in`, 200)).body.status === 'attended');
await events('POST', `/api/delegates/${delegate.id}/check-in`, 409);
const register = await sales('GET', `/api/delegates?edition_id=${edition.id}&q=island`, 200);
check('register summary counts the check-in', register.body.summary.checked_in === 1 && register.body.total === 1);
await events('DELETE', `/api/delegates/${delegate.id}/check-in`, 200);
await events('DELETE', `/api/delegates/${delegate.id}/check-in`, 409);
await events('POST', `/api/delegates/${delegate.id}/check-in`, 200);
const spareDelegate = (await events('POST', '/api/delegates', 201, { edition_id: edition.id, full_name: 'Spare' })).body;
await events('DELETE', `/api/delegates/${spareDelegate.id}`, 204);
await admin('DELETE', `/api/editions/${edition.id}`, 409);

section('Publish and the public website API');
await anon('GET', '/api/public/site-data', 404);
await sales('GET', '/api/publish/latest', 200);
await sales('POST', '/api/publish', 403);
const published = await events('POST', '/api/publish', 200);
check(`publish reports what went out (${published.body.series} series, ${published.body.events} events)`, published.body.events > 0);
check('latest publish names who did it', (await sales('GET', '/api/publish/latest', 200)).body.published_by_name === 'Smoke events');
check('public site data lists the new series', (await anon('GET', '/api/public/site-data', 200)).body.series.some((x: { slug: string }) => x.slug === 'smoke-forum'));
await anon('GET', `/api/public/files/${banner.id}`, 200);
await anon('GET', `/api/public/files/${NONE}`, 404);
await anon('POST', '/api/public/enquiries', 201, { name: 'Website Visitor', email: 'visitor@smoke.test', message: 'A stand, please.' });
await anon('POST', '/api/public/enquiries', 400, { name: 'No Contact' });
await anon('POST', '/api/public/enquiries', 200, { name: 'Bot', email: 'bot@smoke.test', botcheck: 'filled' });

section('Enquiries');
const enquiries = await sales('GET', '/api/enquiries', 200);
check('the website enquiry arrived, the bot one did not', enquiries.body.total === 1 && enquiries.body.rows[0].source === 'website');
const enquiry = (await sales('POST', '/api/enquiries', 201, { full_name: 'Phone Caller', phone: '7771234', source: 'phone' })).body;
await sales('POST', '/api/enquiries', 400, { full_name: '', source: 'phone' });
await events('GET', '/api/enquiries', 403);
await sales('GET', `/api/enquiries/${enquiry.id}`, 200);
await sales('PATCH', `/api/enquiries/${enquiry.id}`, 200, { status: 'contacted', assignee_id: staffIds.sales, edition_id: edition.id });
await sales('PATCH', `/api/enquiries/${enquiry.id}`, 400, { assignee_id: staffIds.finance });
await sales('POST', `/api/enquiries/${enquiry.id}/notes`, 201, { body: 'Called back, sending the pack.' });
await sales('GET', '/api/enquiries?status=contacted&q=caller', 200);

section('Sponsors, deals and payments');
const sponsor = (await sales('POST', '/api/sponsors', 201, { company: 'Smoke Telecom', contact_name: 'Ahmed', email: 'ahmed@smoke.test' })).body;
await sales('POST', '/api/sponsors', 409, { company: 'smoke telecom' });
await events('POST', '/api/sponsors', 403, { company: 'x' });
await finance('GET', '/api/sponsors', 200);
await sales('PATCH', `/api/sponsors/${sponsor.id}`, 200, { phone: '3330000' });
const deal = (await sales('POST', '/api/deals', 201, { sponsor_id: sponsor.id, edition_id: edition.id, package: 'Platinum', amount: '150,000', currency: 'MVR', status: 'confirmed', enquiry_id: enquiry.id })).body;
await sales('POST', '/api/deals', 400, { sponsor_id: sponsor.id, edition_id: edition.id, package: 'Bad', amount: '-1', currency: 'EUR' });
await sales('PATCH', `/api/deals/${deal.id}`, 200, { notes: 'Logo on the main backdrop.' });
check('events staff never see amounts', !('amount' in (await events('GET', `/api/deals/${deal.id}`, 200)).body) && !('totals' in (await events('GET', '/api/deals', 200)).body));
check('sponsor page lists its deal', (await finance('GET', `/api/sponsors/${sponsor.id}`, 200)).body.deals.length === 1);
await sales('POST', `/api/deals/${deal.id}/payments`, 403, { amount: 1, paid_on: '2026-10-01', method: 'cash' });
const payment = (await finance('POST', `/api/deals/${deal.id}/payments`, 201, { amount: '50,000', paid_on: '2026-10-01', method: 'bank_transfer', invoice_no: 'INV-1' })).body;
await finance('POST', `/api/deals/${deal.id}/payments`, 400, { amount: 'lots', paid_on: '2026-10-01', method: 'cash' });
await events('GET', `/api/deals/${deal.id}/payments`, 403);
await sales('GET', `/api/deals/${deal.id}/payments`, 200);
check('outstanding follows the payment', (await finance('GET', `/api/deals?edition_id=${edition.id}`, 200)).body.totals[0].outstanding === 100000);
const mistake = (await finance('POST', `/api/deals/${deal.id}/payments`, 201, { amount: 1, paid_on: '2026-10-02', method: 'cash' })).body;
await finance('DELETE', `/api/payments/${mistake.id}`, 403);
await admin('DELETE', `/api/payments/${mistake.id}`, 204);
check('payment is kept', payment.invoice_no === 'INV-1');

section('Expenses and budget');
const expense = (await finance('POST', '/api/expenses', 201, { edition_id: edition.id, category: 'venue', description: 'Hall hire', vendor: 'Smoke Hotel', amount: '45,000', currency: 'MVR' })).body;
await finance('POST', '/api/expenses', 400, { edition_id: edition.id, category: 'venue', description: 'Paid, no date', amount: 10, currency: 'MVR', status: 'paid' });
await events('GET', '/api/expenses', 403);
await sales('POST', '/api/expenses', 403, {});
await finance('GET', `/api/expenses?edition_id=${edition.id}`, 200);
await admin('GET', `/api/expenses/${expense.id}`, 200);
await finance('PATCH', `/api/expenses/${expense.id}`, 200, { status: 'paid', paid_on: '2026-10-05', invoice_no: 'SH-88' });
const budget = (await finance('GET', `/api/expenses/summary?edition_id=${edition.id}`, 200)).body[0];
check(`budget: confirmed ${budget.income_confirmed}, expenses ${budget.expenses_total}, projected ${budget.projected_result}, cash ${budget.cash_result}`, budget.projected_result === 105000 && budget.cash_result === 5000);
await events('GET', '/api/expenses/summary', 403);
const spareExpense = (await finance('POST', '/api/expenses', 201, { edition_id: edition.id, category: 'other', description: 'Spare', amount: 1, currency: 'USD' })).body;
await finance('DELETE', `/api/expenses/${spareExpense.id}`, 204);

section('Reports');
const isFile = (reply: Reply, type: string) => reply.type.includes(type) && reply.bytes > 500;
check('post-event PDF', isFile(await events('GET', `/api/reports/post-event/${edition.id}.pdf`, 200), 'pdf'));
await sales('GET', `/api/reports/post-event/${edition.id}.pdf`, 403);
await events('GET', `/api/reports/post-event/${NONE}.pdf`, 404);
check('sponsorship Excel', isFile(await finance('GET', `/api/reports/sponsorship.xlsx?edition_id=${edition.id}`, 200), 'spreadsheet'));
check('sponsorship PDF', isFile(await sales('GET', '/api/reports/sponsorship.pdf?from=2026-01-01&to=2026-12-31', 200), 'pdf'));
await events('GET', '/api/reports/sponsorship.xlsx', 403);
check('enquiries Excel', isFile(await sales('GET', '/api/reports/enquiries.xlsx?status=contacted', 200), 'spreadsheet'));
await finance('GET', '/api/reports/enquiries.xlsx', 403);
check('delegates Excel', isFile(await events('GET', `/api/reports/delegates.xlsx?edition_id=${edition.id}`, 200), 'spreadsheet'));
await sales('GET', '/api/reports/delegates.xlsx', 403);
check('budget Excel', isFile(await finance('GET', `/api/reports/budget.xlsx?edition_id=${edition.id}`, 200), 'spreadsheet'));
await events('GET', '/api/reports/budget.xlsx', 403);

section('Dashboard and activity log');
for (const [name, person] of [['admin', admin], ['sales', sales], ['events', events], ['finance', finance]] as const) {
  const cards = (await person('GET', '/api/dashboard', 200)).body.cards as { id: string }[];
  console.log(`          ${name} sees: ${cards.map((c) => c.id).join(', ')}`);
}
const everything = await admin('GET', '/api/activity', 200);
check(`activity log recorded the run (${everything.body.total} entries)`, everything.body.total > 50);
await admin('GET', '/api/activity?action=export', 200);
const mine = await sales('GET', '/api/activity', 200);
check('non-admins see only their own activity', mine.body.rows.every((r: { actor_id: string }) => r.actor_id === staffIds.sales));

section('Tidying up and sign-out');
await admin('DELETE', `/api/editions/${edition.id}`, 409);
await admin('DELETE', `/api/series/${series.id}`, 409);
await admin('PATCH', `/api/staff/${staffIds.sales}`, 200, { active: false });
await sales('GET', '/api/auth/me', 401);
await events('POST', '/api/auth/logout', 204);
await events('GET', '/api/auth/me', 401);

server.close();
await db.close();
console.log(`\n${calls - failures} of ${calls} checks passed${failures ? `, ${failures} FAILED` : ''}.`);
process.exit(failures ? 1 : 0);
