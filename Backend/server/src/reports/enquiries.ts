import ExcelJS from 'exceljs';
import type { Db } from '../db/index.js';
import { ENQUIRY_SQL, enquiryFilters } from '../enquiries/routes.js';
import { styleSheet } from './xlsx.js';

const SOURCE: Record<string, string> = { website: 'Website', whatsapp: 'WhatsApp', phone: 'Phone', email: 'Email', walk_in: 'Walk-in', other: 'Other' };
const STATUS: Record<string, string> = { new: 'New', contacted: 'Contacted', proposal_sent: 'Proposal sent', won: 'Won', lost: 'Lost' };

// Every enquiry matching the filters (status, source, from, to), with its latest note
export async function enquiriesXlsx(db: Db, query: Record<string, unknown>): Promise<Buffer> {
  const { where, params } = enquiryFilters(query);
  const rows = await db.query<Record<string, string | Date | null>>(`${ENQUIRY_SQL} ${where} order by q.created_at desc`, params);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MEDIUM Admin';
  const sheet = wb.addWorksheet('Enquiries');
  sheet.columns = [
    { header: 'Received', width: 18, style: { numFmt: 'd mmm yyyy hh:mm' } },
    { header: 'Name', width: 24 },
    { header: 'Company', width: 24 },
    { header: 'Email', width: 28 },
    { header: 'Phone', width: 16 },
    { header: 'Interested in', width: 28 },
    { header: 'Event', width: 28 },
    { header: 'Timeline', width: 16 },
    { header: 'Budget', width: 14 },
    { header: 'Message', width: 50 },
    { header: 'Source', width: 12 },
    { header: 'Status', width: 14 },
    { header: 'Assigned to', width: 20 },
    { header: 'Latest note', width: 50 },
  ];
  for (const q of rows) {
    // Excel has no time zones: show the Maldives wall-clock time
    const received = new Date(new Date(q.created_at as string | Date).getTime() + 5 * 60 * 60 * 1000);
    sheet.addRow([
      received,
      q.full_name,
      q.company,
      q.email,
      q.phone,
      q.service,
      q.event,
      q.timeline,
      q.budget,
      q.message,
      SOURCE[q.source as string] ?? q.source,
      STATUS[q.status as string] ?? q.status,
      q.assignee_name ?? '',
      q.latest_note ?? '',
    ]);
  }
  styleSheet(sheet, rows.length);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
