import ExcelJS from 'exceljs';
import { fmtAmt, fmtDate } from '@/lib/format';
import type {
  LedgerResult,
  TrialBalanceRow,
  UnifiedJournalView,
} from '@/lib/journal-service';

export function balanceLabel(value: number): string {
  return `${fmtAmt(Math.abs(value))} ${value >= 0 ? 'مدين' : 'دائن'}`;
}

export function formatPeriodLabel(from?: string, to?: string): string {
  const fromLabel = from ? fmtDate(from) : 'البداية';
  const toLabel = to ? fmtDate(to) : 'النهاية';
  return `${fromLabel} — ${toLabel}`;
}

export function journalBookFilename(month: string, extension: 'xlsx' | 'pdf') {
  return `daftar-yawmiya-${month}.${extension}`;
}

export function ledgerFilename(
  accountCode: string,
  from: string | undefined,
  to: string | undefined,
  extension: 'xlsx' | 'pdf',
) {
  const datePart = from || to || new Date().toISOString().slice(0, 10);
  return `daftar-ustadh-${accountCode}-${datePart}.${extension}`;
}

export function statementFilename(
  accountCode: string,
  from: string | undefined,
  to: string | undefined,
  extension: 'xlsx' | 'pdf',
  monthly = false,
) {
  const prefix = monthly ? 'daftar-ustadh-shahri' : 'kashf-hisab';
  const datePart = from?.slice(0, 7) || from || to || new Date().toISOString().slice(0, 10);
  return `${prefix}-${accountCode}-${datePart}.${extension}`;
}

export function trialBalanceFilename(
  from: string | undefined,
  to: string | undefined,
  extension: 'xlsx' | 'pdf',
) {
  const datePart = from || to || new Date().toISOString().slice(0, 10);
  return `mizan-murajaah-${datePart}.${extension}`;
}

async function writeWorkbook(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).font = { bold: true };
}

export async function buildJournalBookExcel(
  month: string,
  items: UnifiedJournalView[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rikaz';
  const sheet = workbook.addWorksheet('دفتر اليومية', {
    views: [{ rightToLeft: true }],
  });

  sheet.columns = [
    { header: '#', key: 'index', width: 6 },
    { header: 'رقم القيد', key: 'journal_number', width: 14 },
    { header: 'التاريخ', key: 'journal_date', width: 14 },
    { header: 'البيان', key: 'description', width: 28 },
    { header: 'المرجع', key: 'reference', width: 14 },
    { header: 'نوع القيد', key: 'entry_type', width: 14 },
    { header: 'رمز الحساب', key: 'account_code', width: 14 },
    { header: 'اسم الحساب', key: 'account_name', width: 24 },
    { header: 'بيان السطر', key: 'line_description', width: 24 },
    { header: 'مدين (ر.س)', key: 'debit_amount', width: 14 },
    { header: 'دائن (ر.س)', key: 'credit_amount', width: 14 },
  ];
  styleHeaderRow(sheet);

  let rowIndex = 0;
  items.forEach((item) => {
    item.lines.forEach((line) => {
      rowIndex += 1;
      sheet.addRow({
        index: rowIndex,
        journal_number: item.journal_number,
        journal_date: fmtDate(item.journal_date),
        description: item.description,
        reference: item.reference ?? '—',
        entry_type: item.entry_type,
        account_code: line.account_code,
        account_name: line.account_name,
        line_description: line.line_description,
        debit_amount: line.debit_amount > 0 ? line.debit_amount : '',
        credit_amount: line.credit_amount > 0 ? line.credit_amount : '',
      });
    });
  });

  sheet.addRow({});
  sheet.addRow({
    description: `الشهر: ${month}`,
    account_name: `عدد القيود: ${items.length}`,
  });

  return writeWorkbook(workbook);
}

export async function buildLedgerExcel(
  title: string,
  data: LedgerResult,
  from?: string,
  to?: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rikaz';
  const sheet = workbook.addWorksheet(title, {
    views: [{ rightToLeft: true }],
  });

  sheet.addRow([title]);
  sheet.addRow([`الحساب: ${data.account_code} - ${data.account_name}`]);
  sheet.addRow([`الفترة: ${formatPeriodLabel(from, to)}`]);
  sheet.addRow([]);

  sheet.addRow([
    'التاريخ',
    'رقم القيد',
    'البيان',
    'مدين (ر.س)',
    'دائن (ر.س)',
    'الرصيد (ر.س)',
  ]);
  const headerRowNumber = sheet.lastRow?.number ?? 4;
  sheet.getRow(headerRowNumber).font = { bold: true };

  if (data.opening_balance !== 0) {
    sheet.addRow([
      '—',
      '—',
      'رصيد أول المدة',
      data.opening_balance > 0 ? data.opening_balance : '',
      data.opening_balance < 0 ? Math.abs(data.opening_balance) : '',
      balanceLabel(data.opening_balance),
    ]);
  }

  data.movements.forEach((movement) => {
    sheet.addRow([
      fmtDate(movement.journal_date),
      movement.journal_number,
      movement.description,
      movement.debit_amount > 0 ? movement.debit_amount : '',
      movement.credit_amount > 0 ? movement.credit_amount : '',
      balanceLabel(movement.running_balance),
    ]);
  });

  sheet.addRow([
    '—',
    '—',
    'إجمالي الفترة',
    data.period_debit,
    data.period_credit,
    balanceLabel(data.closing_balance),
  ]);

  const totalRow = sheet.lastRow;
  if (totalRow) totalRow.font = { bold: true };

  return writeWorkbook(workbook);
}

export async function buildTrialBalanceExcel(
  rows: TrialBalanceRow[],
  from?: string,
  to?: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rikaz';
  const sheet = workbook.addWorksheet('ميزان المراجعة', {
    views: [{ rightToLeft: true }],
  });

  sheet.addRow(['ميزان المراجعة']);
  sheet.addRow([`الفترة: ${formatPeriodLabel(from, to)}`]);
  sheet.addRow([]);
  sheet.addRow(['رمز الحساب', 'اسم الحساب', 'مدين (ر.س)', 'دائن (ر.س)']);
  sheet.getRow(4).font = { bold: true };

  rows.forEach((row) => {
    sheet.addRow([
      row.account_code,
      row.account_name,
      row.debit_balance > 0 ? row.debit_balance : '',
      row.credit_balance > 0 ? row.credit_balance : '',
    ]);
  });

  const totalDebit = rows.reduce((sum, row) => sum + row.debit_balance, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit_balance, 0);
  const totalRow = sheet.addRow(['', 'الإجمالي', totalDebit, totalCredit]);
  totalRow.font = { bold: true };

  return writeWorkbook(workbook);
}
