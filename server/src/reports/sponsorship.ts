import ExcelJS from 'exceljs';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { validationError } from '../http.js';
import { DEAL_SQL } from '../sales/routes.js';
import { formatMoney } from '../sales/money.js';
import { day, heading, renderPdf, table } from './pdf.js';
import { styleSheet } from './xlsx.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-31.');
const filterSchema = z.object({
  edition_id: z.string().regex(/^[0-9a-f-]{36}$/i, 'Choose an edition.').optional(),
  from: date.optional(),
  to: date.optional(),
});
export type SponsorshipFilters = z.infer<typeof filterSchema>;

interface DealRow {
  id: string;
  sponsor_company: string;
  edition_name: string;
  package: string;
  status: 'proposed' | 'confirmed' | 'cancelled';
  amount: number;
  currency: string;
  paid: number;
  outstanding: number;
}
interface PaymentRow {
  paid_on: string;
  sponsor_company: string;
  edition_name: string;
  package: string;
  currency: string;
  amount: number;
  method: string;
  invoice_no: string;
  recorded_by_name: string | null;
}

const STATUS = { proposed: 'Proposed', confirmed: 'Confirmed', cancelled: 'Cancelled' };
const METHOD: Record<string, string> = { bank_transfer: 'Bank transfer', cash: 'Cash', cheque: 'Cheque', card: 'Card', other: 'Other' };

export function parseSponsorshipFilters(query: unknown): SponsorshipFilters {
  const parsed = filterSchema.safeParse(query);
  if (!parsed.success) throw validationError(parsed.error);
  return Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v)) as SponsorshipFilters;
}

// Deals for one edition, or for editions starting within a date range, with their payments and per-currency totals
export async function loadSponsorship(db: Db, f: SponsorshipFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.edition_id) where.push(`d.edition_id = $${params.push(f.edition_id)}`);
  if (f.from) where.push(`e.start_date >= $${params.push(f.from)}::date`);
  if (f.to) where.push(`e.start_date <= $${params.push(f.to)}::date`);
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const deals = await db.query<DealRow>(`${DEAL_SQL} ${whereSql} order by d.currency, e.start_date desc, lower(sp.company)`, params);
  const payments = await db.query<PaymentRow>(
    `select p.paid_on::text as paid_on, sp.company as sponsor_company, e.name as edition_name, d.package, d.currency, p.amount::float8 as amount,
            p.method, p.invoice_no, u.full_name as recorded_by_name
       from payments p join deals d on d.id = p.deal_id join sponsors sp on sp.id = d.sponsor_id join editions e on e.id = d.edition_id
       left join users u on u.id = p.recorded_by ${whereSql}
      order by p.paid_on, sp.company`,
    params,
  );
  const totals = new Map<string, { amount: number; paid: number; outstanding: number }>();
  for (const d of deals.filter((x) => x.status !== 'cancelled')) {
    const t = totals.get(d.currency) ?? { amount: 0, paid: 0, outstanding: 0 };
    t.amount += d.amount;
    t.paid += d.paid;
    t.outstanding += d.outstanding;
    totals.set(d.currency, t);
  }
  // Rounded to cents so float sums never show as 0.30000000000000004
  const round = (n: number) => Math.round(n * 100) / 100;
  const totalList = [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, t]) => ({ currency, amount: round(t.amount), paid: round(t.paid), outstanding: round(t.outstanding) }));
  return { deals, payments, totals: totalList };
}

async function scopeLabel(db: Db, f: SponsorshipFilters) {
  if (f.edition_id) {
    const [e] = await db.query<{ name: string }>('select name from editions where id = $1', [f.edition_id]);
    return e?.name ?? 'Unknown edition';
  }
  if (f.from && f.to) return `Events from ${day(f.from)} to ${day(f.to)}`;
  if (f.from) return `Events from ${day(f.from)}`;
  if (f.to) return `Events up to ${day(f.to)}`;
  return 'All events';
}

export async function sponsorshipXlsx(db: Db, f: SponsorshipFilters): Promise<Buffer> {
  const { deals, payments, totals } = await loadSponsorship(db, f);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MEDIUM Admin';

  const dealSheet = wb.addWorksheet('Deals');
  dealSheet.columns = [
    { header: 'Sponsor', width: 30 },
    { header: 'Event', width: 32 },
    { header: 'Package', width: 24 },
    { header: 'Status', width: 12 },
    { header: 'Currency', width: 10 },
    { header: 'Amount', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Received', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Outstanding', width: 15, style: { numFmt: '#,##0.00' } },
  ];
  for (const d of deals) dealSheet.addRow([d.sponsor_company, d.edition_name, d.package, STATUS[d.status], d.currency, d.amount, d.paid, d.status === 'cancelled' ? null : d.outstanding]);
  styleSheet(dealSheet, deals.length);
  if (totals.length) {
    dealSheet.addRow([]);
    for (const t of totals) dealSheet.addRow([`Total ${t.currency}`, 'Proposed and confirmed; cancelled excluded', null, null, t.currency, t.amount, t.paid, t.outstanding]).font = { bold: true };
  }

  const paymentSheet = wb.addWorksheet('Payments');
  paymentSheet.columns = [
    { header: 'Date', width: 13, style: { numFmt: 'd mmm yyyy' } },
    { header: 'Sponsor', width: 30 },
    { header: 'Event', width: 32 },
    { header: 'Package', width: 24 },
    { header: 'Currency', width: 10 },
    { header: 'Amount', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Method', width: 15 },
    { header: 'Invoice', width: 14 },
    { header: 'Recorded by', width: 22 },
  ];
  for (const p of payments) {
    paymentSheet.addRow([new Date(`${p.paid_on}T00:00:00Z`), p.sponsor_company, p.edition_name, p.package, p.currency, p.amount, METHOD[p.method] ?? p.method, p.invoice_no, p.recorded_by_name ?? '']);
  }
  styleSheet(paymentSheet, payments.length);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function sponsorshipPdf(db: Db, f: SponsorshipFilters, now: Date): Promise<Buffer> {
  const { deals, totals } = await loadSponsorship(db, f);
  const scope = await scopeLabel(db, f);
  const columns: [string, number, 'left' | 'right'][] = [
    ['Sponsor', 95],
    ['Event', 90],
    ['Package', 70],
    ['Status', 55],
    ['Amount', 65, 'right'],
    ['Received', 58, 'right'],
    ['Outstanding', 62, 'right'],
  ].map(([h, w, a]) => [h as string, w as number, (a ?? 'left') as 'left' | 'right']);
  const n = (x: number) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return renderPdf('Sponsorship report', scope, now, (doc) => {
    if (!deals.length) doc.text('No deals for this selection.');
    for (const t of totals) {
      heading(doc, `Deals in ${t.currency}`);
      const rows = deals
        .filter((d) => d.currency === t.currency && d.status !== 'cancelled')
        .map((d) => [d.sponsor_company, d.edition_name, d.package, STATUS[d.status], n(d.amount), n(d.paid), n(d.outstanding)]);
      table(doc, columns, [...rows, [`Total ${t.currency}`, '', '', '', n(t.amount), n(t.paid), n(t.outstanding)]], { boldLast: 1 });
    }
    const cancelled = deals.filter((d) => d.status === 'cancelled');
    if (cancelled.length) {
      heading(doc, 'Cancelled deals (not in totals)');
      doc.text(cancelled.map((d) => `${d.sponsor_company}, ${d.edition_name}: ${d.package} (${formatMoney(d.amount, d.currency)})`).join('\n'));
    }
  });
}
