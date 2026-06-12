import ExcelJS from 'exceljs';
import { fmtAmt, fmtDate } from '@/lib/format';
import type { Employee, EmployeeStatus, PayrollPreview } from '@/lib/types';

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'نشط',
  inactive: 'غير نشط',
  leave: 'إجازة',
};

async function writeWorkbook(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function employeesFilename(extension: 'xlsx' | 'pdf') {
  return `sijil-muwazzafin-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export function payrollFilename(month: string, year: number, extension: 'xlsx' | 'pdf') {
  return `masir-rawatib-${year}-${month}.${extension}`;
}

export async function buildEmployeesExcel(employees: Employee[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rikaz';
  const sheet = workbook.addWorksheet('سجلات الموظفين', {
    views: [{ rightToLeft: true }],
  });

  sheet.columns = [
    { header: '#', key: 'index', width: 6 },
    { header: 'اسم الموظف', key: 'name', width: 24 },
    { header: 'المسمى الوظيفي', key: 'job_title', width: 20 },
    { header: 'رقم الهوية', key: 'id_number', width: 16 },
    { header: 'الراتب الأساسي (ر.س)', key: 'basic_salary', width: 16 },
    { header: 'بدل السكن (ر.س)', key: 'housing_allowance', width: 14 },
    { header: 'بدل المواصلات (ر.س)', key: 'transport_allowance', width: 16 },
    { header: 'العمولات (ر.س)', key: 'commission', width: 14 },
    { header: 'إجمالي الراتب (ر.س)', key: 'gross_salary', width: 16 },
    { header: 'تاريخ التعيين', key: 'hire_date', width: 14 },
    { header: 'الحالة', key: 'status', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  employees.forEach((employee, index) => {
    sheet.addRow({
      index: index + 1,
      name: employee.name,
      job_title: employee.job_title,
      id_number: employee.id_number ?? '—',
      basic_salary: employee.basic_salary,
      housing_allowance: employee.housing_allowance,
      transport_allowance: employee.transport_allowance,
      commission: employee.commission,
      gross_salary: employee.gross_salary,
      hire_date: employee.hire_date ? fmtDate(employee.hire_date) : '—',
      status: STATUS_LABELS[employee.status],
    });
  });

  const totalGross = employees.reduce((sum, emp) => sum + emp.gross_salary, 0);
  const totalRow = sheet.addRow({
    index: '',
    name: '',
    job_title: '',
    id_number: '',
    basic_salary: '',
    housing_allowance: '',
    transport_allowance: '',
    commission: 'الإجمالي',
    gross_salary: totalGross,
    hire_date: '',
    status: `${employees.length} موظف`,
  });
  totalRow.font = { bold: true };

  return writeWorkbook(workbook);
}

export async function buildPayrollExcel(preview: PayrollPreview): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rikaz';
  const sheet = workbook.addWorksheet('مسير الرواتب', {
    views: [{ rightToLeft: true }],
  });

  sheet.addRow([`مسير رواتب ${preview.month_label} ${preview.year}م`]);
  sheet.addRow([
    preview.posted ? 'الحالة: تم الترحيل' : 'الحالة: لم يُرحّل بعد',
  ]);
  sheet.addRow([]);

  sheet.addRow([
    '#',
    'الموظف',
    'المسمى',
    'الأساسي (ر.س)',
    'السكن (ر.س)',
    'المواصلات (ر.س)',
    'الإجمالي (ر.س)',
    'التأمينات (ر.س)',
    'الصافي (ر.س)',
  ]);
  sheet.getRow(4).font = { bold: true };

  preview.employees.forEach((employee, index) => {
    sheet.addRow([
      index + 1,
      employee.name,
      employee.job_title,
      employee.basic_salary,
      employee.housing_allowance,
      employee.transport_allowance,
      employee.gross_salary,
      employee.gosi_amount,
      employee.net_salary,
    ]);
  });

  const totalRow = sheet.addRow([
    '',
    '',
    'الإجمالي',
    '',
    '',
    '',
    preview.total_gross,
    preview.total_gosi,
    preview.total_net,
  ]);
  totalRow.font = { bold: true };

  return writeWorkbook(workbook);
}

export function employeeStatusLabel(status: EmployeeStatus): string {
  return STATUS_LABELS[status];
}

export { STATUS_LABELS as employeeStatusLabels };
