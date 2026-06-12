import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { employeeStatusLabel } from '@/lib/hr-export';
import { fmtAmt, fmtDate } from '@/lib/format';
import type { Employee, PayrollPreview } from '@/lib/types';
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

async function createHrReportPdf(
  user: PdfPageHeaderUser,
  title: string,
  subtitleLines: string[],
  tableHead: string[],
  tableBody: string[][],
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
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
    margin: { left: 10, right: 10 },
  });

  addPdfPageNumbers(doc);
  return Buffer.from(doc.output('arraybuffer'));
}

export async function buildEmployeesPdf(
  user: PdfPageHeaderUser,
  employees: Employee[],
): Promise<Buffer> {
  const tableBody = employees.map((employee, index) => [
    String(index + 1),
    employee.name,
    employee.job_title,
    employee.id_number ?? '—',
    fmtAmt(employee.basic_salary),
    fmtAmt(employee.housing_allowance),
    fmtAmt(employee.transport_allowance),
    fmtAmt(employee.commission),
    fmtAmt(employee.gross_salary),
    employee.hire_date ? fmtDate(employee.hire_date) : '—',
    employeeStatusLabel(employee.status),
  ]);

  const totalGross = employees.reduce((sum, emp) => sum + emp.gross_salary, 0);
  tableBody.push([
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'الإجمالي',
    fmtAmt(totalGross),
    '',
    `${employees.length} موظف`,
  ]);

  return createHrReportPdf(
    user,
    'سجلات الموظفين',
    [`عدد الموظفين: ${employees.length}`],
    [
      '#',
      'اسم الموظف',
      'المسمى',
      'رقم الهوية',
      'الأساسي',
      'السكن',
      'المواصلات',
      'العمولات',
      'الإجمالي',
      'التعيين',
      'الحالة',
    ],
    tableBody,
  );
}

export async function buildPayrollPdf(
  user: PdfPageHeaderUser,
  preview: PayrollPreview,
): Promise<Buffer> {
  const tableBody = preview.employees.map((employee, index) => [
    String(index + 1),
    employee.name,
    employee.job_title,
    fmtAmt(employee.basic_salary),
    fmtAmt(employee.housing_allowance),
    fmtAmt(employee.transport_allowance),
    fmtAmt(employee.gross_salary),
    fmtAmt(employee.gosi_amount),
    fmtAmt(employee.net_salary),
  ]);

  tableBody.push([
    '',
    '',
    'الإجمالي',
    '',
    '',
    '',
    fmtAmt(preview.total_gross),
    fmtAmt(preview.total_gosi),
    fmtAmt(preview.total_net),
  ]);

  return createHrReportPdf(
    user,
    'مسير الرواتب',
    [
      `الفترة: ${preview.month_label} ${preview.year}م`,
      `${preview.employees.length} موظف نشط`,
      preview.posted ? 'تم ترحيل القيد المحاسبي' : 'لم يُرحّل بعد',
    ],
    ['#', 'الموظف', 'المسمى', 'الأساسي', 'السكن', 'المواصلات', 'الإجمالي', 'التأمينات', 'الصافي'],
    tableBody,
  );
}
