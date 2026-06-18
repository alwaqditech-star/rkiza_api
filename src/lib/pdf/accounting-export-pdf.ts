import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  balanceLabel,
  formatPeriodLabel,
} from '../accounting-export';
import { fmtAmt, fmtDate } from '../format';
import type {
  LedgerResult,
  TrialBalanceRow,
  UnifiedJournalView,
} from '../journal-service';
import {
  drawPdfPageHeader,
  getArabicFontBase64,
  getPdfContentStartY,
  loadAvatarImage,
  PDF_BRAND_PALE_RGB,
  PDF_BRAND_RGB,
  PDF_MIST_RGB,
  registerArabicFont,
  setPdfTextColor,
  type PdfPageHeaderUser,
} from './arabic-pdf-helpers';

type TableCell = string | {
  content: string;
  colSpan?: number;
  rowSpan?: number;
  styles?: Record<string, unknown>;
};

interface CreateReportPdfOptions {
  orientation?: 'portrait' | 'landscape';
  columnStyles?: Record<number, Record<string, unknown>>;
  stripeRows?: boolean;
  footerRows?: number;
  footnote?: string;
}

const AMOUNT_COLUMN_STYLE = {
  halign: 'center' as const,
  cellWidth: 32,
};

function drawPdfSubtitle(doc: jsPDF, lines: string[], startY: number): number {
  doc.setFontSize(10);
  setPdfTextColor(doc, PDF_MIST_RGB);
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
    setPdfTextColor(doc, PDF_MIST_RGB);
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
  tableBody: TableCell[][],
  options: CreateReportPdfOptions = {},
): Promise<Buffer> {
  const {
    orientation = 'portrait',
    columnStyles = {},
    stripeRows = true,
    footerRows = 0,
    footnote,
  } = options;

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const fontBase64 = await getArabicFontBase64();
  registerArabicFont(doc, fontBase64);

  const avatar = await loadAvatarImage(user.avatar_url);
  drawPdfPageHeader(doc, user, avatar, title, new Date());
  const startY = drawPdfSubtitle(doc, subtitleLines, getPdfContentStartY(24));
  const sideMargin = orientation === 'landscape' ? 10 : 14;

  autoTable(doc, {
    startY,
    head: [tableHead],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'Amiri',
      fontSize: 9,
      halign: 'right',
      valign: 'middle',
      cellPadding: 3,
      overflow: 'linebreak',
      lineColor: [196, 206, 222],
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: [...PDF_BRAND_RGB],
      textColor: [255, 255, 255],
      fontStyle: 'normal',
      halign: 'right',
      fontSize: 10,
    },
    columnStyles,
    alternateRowStyles: stripeRows ? { fillColor: [...PDF_BRAND_PALE_RGB] } : undefined,
    margin: { left: sideMargin, right: sideMargin },
    didParseCell: (data) => {
      if (footerRows > 0 && data.section === 'body') {
        const footerStart = tableBody.length - footerRows;
        if (data.row.index >= footerStart) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [...PDF_BRAND_PALE_RGB];
        }
      }
    },
  });

  if (footnote) {
    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
    if (finalY) {
      doc.setFontSize(9);
      setPdfTextColor(doc, PDF_MIST_RGB);
      doc.text(footnote, doc.internal.pageSize.getWidth() / 2, finalY + 8, { align: 'center' });
    }
  }

  addPdfPageNumbers(doc);
  return Buffer.from(doc.output('arraybuffer'));
}

export async function buildJournalBookPdf(
  user: PdfPageHeaderUser,
  month: string,
  items: UnifiedJournalView[],
): Promise<Buffer> {
  const tableBody: TableCell[][] = [];
  const columnCount = 5;

  items.forEach((item, itemIndex) => {
    const totalDr = item.lines.reduce((sum, line) => sum + line.debit_amount, 0);
    const totalCr = item.lines.reduce((sum, line) => sum + line.credit_amount, 0);
    const headerParts = [
      item.journal_number,
      fmtDate(item.journal_date),
      item.entry_type,
      item.description,
    ];
    if (item.reference) {
      headerParts.push(`المرجع: ${item.reference}`);
    }

    tableBody.push([
      {
        content: headerParts.join('  |  '),
        colSpan: columnCount,
        styles: {
          fillColor: [...PDF_BRAND_RGB],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'right',
          fontSize: 9,
        },
      },
    ]);

    item.lines.forEach((line) => {
      tableBody.push([
        line.account_code,
        line.account_name,
        line.line_description || '—',
        line.debit_amount > 0 ? fmtAmt(line.debit_amount) : '—',
        line.credit_amount > 0 ? fmtAmt(line.credit_amount) : '—',
      ]);
    });

    tableBody.push([
      {
        content: 'إجمالي القيد',
        colSpan: 3,
        styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 247, 252] },
      },
      {
        content: fmtAmt(totalDr),
        styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 247, 252] },
      },
      {
        content: fmtAmt(totalCr),
        styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 247, 252] },
      },
    ]);

    if (itemIndex < items.length - 1) {
      tableBody.push([
        {
          content: '',
          colSpan: columnCount,
          styles: { minCellHeight: 2, fillColor: [255, 255, 255], lineWidth: 0 },
        },
      ]);
    }
  });

  return createReportPdf(
    user,
    'دفتر اليومية',
    [`الشهر: ${month}`, `عدد القيود: ${items.length}`],
    ['رمز الحساب', 'اسم الحساب', 'البيان', 'مدين (ر.س)', 'دائن (ر.س)'],
    tableBody,
    {
      orientation: 'landscape',
      stripeRows: false,
      columnStyles: {
        0: { cellWidth: 24, halign: 'center' },
        1: { cellWidth: 62 },
        2: { cellWidth: 88 },
        3: AMOUNT_COLUMN_STYLE,
        4: AMOUNT_COLUMN_STYLE,
      },
    },
  );
}

export async function buildLedgerPdf(
  user: PdfPageHeaderUser,
  title: string,
  data: LedgerResult,
  from?: string,
  to?: string,
): Promise<Buffer> {
  const tableBody: TableCell[][] = [];

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
    {
      orientation: 'landscape',
      footerRows: 1,
      columnStyles: {
        0: { cellWidth: 24, halign: 'center' },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 72 },
        3: AMOUNT_COLUMN_STYLE,
        4: AMOUNT_COLUMN_STYLE,
        5: { ...AMOUNT_COLUMN_STYLE, cellWidth: 38 },
      },
    },
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
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const tableBody: TableCell[][] = rows.map((row) => [
    row.account_code,
    row.account_name,
    row.debit_balance > 0 ? fmtAmt(row.debit_balance) : '—',
    row.credit_balance > 0 ? fmtAmt(row.credit_balance) : '—',
  ]);

  tableBody.push(['', 'الإجمالي', fmtAmt(totalDebit), fmtAmt(totalCredit)]);

  const footnote = balanced
    ? '✓ ميزان المراجعة متوازن'
    : `⚠ فرق الميزان: ${fmtAmt(Math.abs(totalDebit - totalCredit))} ر.س`;

  return createReportPdf(
    user,
    'ميزان المراجعة',
    [`الفترة: ${formatPeriodLabel(from, to)}`, `عدد الحسابات: ${rows.length}`],
    ['رمز الحساب', 'اسم الحساب', 'مدين (ر.س)', 'دائن (ر.س)'],
    tableBody,
    {
      footerRows: 1,
      footnote,
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        1: {},
        2: AMOUNT_COLUMN_STYLE,
        3: AMOUNT_COLUMN_STYLE,
      },
    },
  );
}
