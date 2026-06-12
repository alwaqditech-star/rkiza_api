import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  balanceLabel,
  formatPeriodLabel,
} from '@/lib/accounting-export';
import { fmtAmt, fmtDate } from '@/lib/format';
import type {
  LedgerResult,
  TrialBalanceRow,
  UnifiedJournalView,
} from '@/lib/journal-service';
import {
  drawPdfPageHeader,
  getArabicFontBase64,
  getPdfContentStartY,
  loadAvatarImage,
  PDF_BRAND_PALE_RGB,
  PDF_BRAND_RGB,
  PDF_MIST_RGB,
  registerArabicFont,
  type PdfPageHeaderUser,
} from '@/lib/pdf/arabic-pdf-helpers';

function drawPdfSubtitle(doc: jsPDF, lines: string[], startY: number): number {
  doc.setFontSize(10);
  doc.setTextColor(...PDF_MIST_RGB);
  let y = startY;
  lines.forEach((line) => {
    doc.text(line, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    y += 5;
  });
  return y + 4;
}

function addPdfPageNumbers(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(...PDF_MIST_RGB);
    doc.text(
      `صفحة ${i} من ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
  }
}

async function createReportPdf(
  user: PdfPageHeaderUser,
  title: string,
  subtitleLines: string[],
  tableHead: string[],
  tableBody: string[][],
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontBase64 = await getArabicFontBase64();
  registerArabicFont(doc, fontBase64);

  const avatar = await loadAvatarImage(user.avatar_url);
  drawPdfPageHeader(doc, user, avatar, title, new Date());
  const startY = drawPdfSubtitle(doc, subtitleLines, getPdfContentStartY(24));

  autoTable(doc, {
    startY,
    head: [tableHead],
    body: tableBody,
    styles: {
      font: 'Amiri',
      fontSize: 9,
      halign: 'right',
      cellPadding: 2.5,
    },
    headStyles: {
      fillColor: [...PDF_BRAND_RGB],
      textColor: [255, 255, 255],
      fontStyle: 'normal',
      halign: 'right',
    },
    alternateRowStyles: { fillColor: [...PDF_BRAND_PALE_RGB] },
    margin: { left: 14, right: 14 },
  });

  addPdfPageNumbers(doc);
  return Buffer.from(doc.output('arraybuffer'));
}

export async function buildJournalBookPdf(
  user: PdfPageHeaderUser,
  month: string,
  items: UnifiedJournalView[],
): Promise<Buffer> {
  const tableBody: string[][] = [];
  let index = 0;

  items.forEach((item) => {
    item.lines.forEach((line) => {
      index += 1;
      tableBody.push([
        String(index),
        item.journal_number,
        fmtDate(item.journal_date),
        item.description,
        item.reference ?? '—',
        item.entry_type,
        line.account_code,
        line.account_name,
        line.line_description,
        line.debit_amount > 0 ? fmtAmt(line.debit_amount) : '—',
        line.credit_amount > 0 ? fmtAmt(line.credit_amount) : '—',
      ]);
    });
  });

  return createReportPdf(
    user,
    'دفتر اليومية',
    [`الشهر: ${month}`, `عدد القيود: ${items.length}`],
    [
      '#',
      'رقم القيد',
      'التاريخ',
      'البيان',
      'المرجع',
      'نوع القيد',
      'رمز الحساب',
      'اسم الحساب',
      'بيان السطر',
      'مدين',
      'دائن',
    ],
    tableBody,
  );
}

export async function buildLedgerPdf(
  user: PdfPageHeaderUser,
  title: string,
  data: LedgerResult,
  from?: string,
  to?: string,
): Promise<Buffer> {
  const tableBody: string[][] = [];

  if (data.opening_balance !== 0) {
    tableBody.push([
      '—',
      '—',
      'رصيد أول المدة',
      data.opening_balance > 0 ? fmtAmt(data.opening_balance) : '—',
      data.opening_balance < 0 ? fmtAmt(Math.abs(data.opening_balance)) : '—',
      balanceLabel(data.opening_balance),
    ]);
  }

  data.movements.forEach((movement) => {
    tableBody.push([
      fmtDate(movement.journal_date),
      movement.journal_number,
      movement.description,
      movement.debit_amount > 0 ? fmtAmt(movement.debit_amount) : '—',
      movement.credit_amount > 0 ? fmtAmt(movement.credit_amount) : '—',
      balanceLabel(movement.running_balance),
    ]);
  });

  tableBody.push([
    '—',
    '—',
    'إجمالي الفترة',
    fmtAmt(data.period_debit),
    fmtAmt(data.period_credit),
    balanceLabel(data.closing_balance),
  ]);

  return createReportPdf(
    user,
    title,
    [
      `الحساب: ${data.account_code} - ${data.account_name}`,
      `الفترة: ${formatPeriodLabel(from, to)}`,
    ],
    ['التاريخ', 'رقم القيد', 'البيان', 'مدين (ر.س)', 'دائن (ر.س)', 'الرصيد (ر.س)'],
    tableBody,
  );
}

export async function buildTrialBalancePdf(
  user: PdfPageHeaderUser,
  rows: TrialBalanceRow[],
  from?: string,
  to?: string,
): Promise<Buffer> {
  const totalDebit = rows.reduce((sum, row) => sum + row.debit_balance, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit_balance, 0);

  const tableBody = rows.map((row) => [
    row.account_code,
    row.account_name,
    row.debit_balance > 0 ? fmtAmt(row.debit_balance) : '—',
    row.credit_balance > 0 ? fmtAmt(row.credit_balance) : '—',
  ]);

  tableBody.push(['', 'الإجمالي', fmtAmt(totalDebit), fmtAmt(totalCredit)]);

  return createReportPdf(
    user,
    'ميزان المراجعة',
    [`الفترة: ${formatPeriodLabel(from, to)}`],
    ['رمز الحساب', 'اسم الحساب', 'مدين (ر.س)', 'دائن (ر.س)'],
    tableBody,
  );
}
