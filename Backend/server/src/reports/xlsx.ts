import type ExcelJS from 'exceljs';

// One bold, frozen header row with a filter over the data rows
export function styleSheet(sheet: ExcelJS.Worksheet, dataRows: number) {
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12229D' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, dataRows + 1), column: sheet.columnCount } };
}
