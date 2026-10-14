import ExcelJS from 'exceljs';
import type { Db } from '../db/index.js';
import { EXPENSE_SQL, budgetSummary, expenseFilters } from '../expenses/routes.js';
import { editionFilter } from '../validate.js';
import { styleSheet } from './xlsx.js';

const CATEGORY: Record<string, string> = {
  venue: 'Venue',
  catering: 'Catering',
  av_production: 'AV and production',
  marketing: 'Marketing',
  printing: 'Printing',
  travel: 'Travel',
  accommodation: 'Accommodation',
  staffing: 'Staffing',
  speakers: 'Speakers',
  decor: 'Decor',
  other: 'Other',
};
const STATUS: Record<string, string> = { planned: 'Planned', committed: 'Committed', paid: 'Paid' };
const MONEY = { numFmt: '#,##0.00' };

// Budget for one edition (edition_id) or every edition: a per-currency summary sheet and every expense
export async function budgetXlsx(db: Db, query: Record<string, unknown>): Promise<Buffer> {
  const editionId = editionFilter(query);
  const summary = await budgetSummary(db, editionId);
  const w = expenseFilters({ edition_id: editionId ?? undefined });
  const expenses = await db.query<Record<string, string | number | null>>(`${EXPENSE_SQL} ${w.sql} order by e.start_date desc, x.currency, x.category, x.created_at`, w.params);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MEDIUM Admin';

  const summarySheet = wb.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Currency', width: 10 },
    { header: 'Sponsorship confirmed', width: 22, style: MONEY },
    { header: 'Sponsorship received', width: 22, style: MONEY },
    { header: 'Expenses planned', width: 18, style: MONEY },
    { header: 'Expenses committed', width: 20, style: MONEY },
    { header: 'Expenses paid', width: 16, style: MONEY },
    { header: 'Expenses total', width: 16, style: MONEY },
    { header: 'Projected result', width: 18, style: MONEY },
    { header: 'Cash result', width: 14, style: MONEY },
  ];
  for (const s of summary) {
    summarySheet.addRow([s.currency, s.income_confirmed, s.income_received, s.expenses_planned, s.expenses_committed, s.expenses_paid, s.expenses_total, s.projected_result, s.cash_result]);
  }
  styleSheet(summarySheet, summary.length);

  const sheet = wb.addWorksheet('Expenses');
  sheet.columns = [
    { header: 'Event', width: 32 },
    { header: 'Category', width: 18 },
    { header: 'Description', width: 36 },
    { header: 'Vendor', width: 24 },
    { header: 'Status', width: 12 },
    { header: 'Currency', width: 10 },
    { header: 'Amount', width: 15, style: MONEY },
    { header: 'Paid on', width: 13, style: { numFmt: 'd mmm yyyy' } },
    { header: 'Invoice', width: 14 },
    { header: 'Notes', width: 40 },
  ];
  for (const x of expenses) {
    sheet.addRow([
      x.edition_name,
      CATEGORY[x.category as string] ?? x.category,
      x.description,
      x.vendor,
      STATUS[x.status as string] ?? x.status,
      x.currency,
      x.amount,
      x.paid_on ? new Date(`${x.paid_on}T00:00:00Z`) : null,
      x.invoice_no,
      x.notes,
    ]);
  }
  styleSheet(sheet, expenses.length);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
