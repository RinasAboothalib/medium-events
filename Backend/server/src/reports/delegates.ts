import ExcelJS from 'exceljs';
import type { Db } from '../db/index.js';
import { DELEGATE_SQL, delegateFilters } from '../delegates/routes.js';
import { styleSheet } from './xlsx.js';

const CATEGORY: Record<string, string> = { delegate: 'Delegate', speaker: 'Speaker', sponsor: 'Sponsor', exhibitor: 'Exhibitor', vip: 'VIP', media: 'Media', staff: 'Staff' };
const STATUS: Record<string, string> = { invited: 'Invited', registered: 'Registered', confirmed: 'Confirmed', attended: 'Attended', cancelled: 'Cancelled', no_show: 'No-show' };

// The delegate register matching the filters (edition_id, status, category), one row per person
export async function delegatesXlsx(db: Db, query: Record<string, unknown>): Promise<Buffer> {
  const w = delegateFilters(query);
  const rows = await db.query<Record<string, string | Date | null>>(`${DELEGATE_SQL} ${w.sql} order by e.start_date desc, lower(g.full_name)`, w.params);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MEDIUM Admin';
  const sheet = wb.addWorksheet('Delegates');
  sheet.columns = [
    { header: 'Event', width: 32 },
    { header: 'Name', width: 26 },
    { header: 'Company', width: 26 },
    { header: 'Job title', width: 24 },
    { header: 'Email', width: 28 },
    { header: 'Phone', width: 16 },
    { header: 'Category', width: 12 },
    { header: 'Status', width: 12 },
    { header: 'Checked in', width: 18, style: { numFmt: 'd mmm yyyy hh:mm' } },
    { header: 'Notes', width: 40 },
  ];
  for (const g of rows) {
    // Excel has no time zones: show the Maldives wall-clock time
    const checkedIn = g.checked_in_at ? new Date(new Date(g.checked_in_at).getTime() + 5 * 60 * 60 * 1000) : null;
    sheet.addRow([
      g.edition_name,
      g.full_name,
      g.company,
      g.job_title,
      g.email,
      g.phone,
      CATEGORY[g.category as string] ?? g.category,
      STATUS[g.status as string] ?? g.status,
      checkedIn,
      g.notes,
    ]);
  }
  styleSheet(sheet, rows.length);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
