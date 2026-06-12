import type { RowDataPacket } from 'mysql2';
import { execute, query } from '@/lib/db';
import { createManualJournal } from '@/lib/journal-service';
import { listActiveEmployees } from '@/lib/employee-service';
import type { PayrollPreview } from '@/lib/types';

const MONTH_LABELS: Record<string, string> = {
  '01': 'يناير',
  '02': 'فبراير',
  '03': 'مارس',
  '04': 'أبريل',
  '05': 'مايو',
  '06': 'يونيو',
  '07': 'يوليو',
  '08': 'أغسطس',
  '09': 'سبتمبر',
  '10': 'أكتوبر',
  '11': 'نوفمبر',
  '12': 'ديسمبر',
};

interface PayrollRunRow extends RowDataPacket {
  id: number;
  payroll_month: number;
  payroll_year: number;
}

function isMissingPayrollTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('payroll_runs') || message.includes("doesn't exist");
}

function normalizeMonth(month: string | number): string {
  return String(month).padStart(2, '0');
}

export function getMonthLabel(month: string): string {
  return MONTH_LABELS[normalizeMonth(month)] ?? month;
}

async function isPayrollPosted(
  associationId: number,
  month: string,
  year: number,
): Promise<boolean> {
  try {
    const rows = await query<PayrollRunRow[]>(
      `SELECT id, payroll_month, payroll_year
       FROM payroll_runs
       WHERE association_id = ? AND payroll_year = ? AND payroll_month = ?`,
      [associationId, year, Number(normalizeMonth(month))],
    );
    return rows.length > 0;
  } catch (error) {
    if (isMissingPayrollTable(error)) return false;
    throw error;
  }
}

export async function getPayrollPreview(
  associationId: number,
  month: string,
  year: number,
): Promise<PayrollPreview> {
  const monthKey = normalizeMonth(month);
  const employees = await listActiveEmployees(associationId);
  const totalGross = employees.reduce((sum, emp) => sum + emp.gross_salary, 0);
  const totalGosi = employees.reduce((sum, emp) => sum + emp.gosi_amount, 0);
  const totalNet = employees.reduce((sum, emp) => sum + emp.net_salary, 0);
  const posted = await isPayrollPosted(associationId, monthKey, year);

  return {
    month: monthKey,
    year,
    month_label: getMonthLabel(monthKey),
    employees,
    total_gross: totalGross,
    total_gosi: totalGosi,
    total_net: totalNet,
    posted,
  };
}

export async function postPayrollJournal(
  associationId: number,
  month: string,
  year: number,
): Promise<{ journalId: number; description: string }> {
  const monthKey = normalizeMonth(month);
  const preview = await getPayrollPreview(associationId, monthKey, year);

  if (!preview.employees.length) {
    throw new Error('لا يوجد موظفون نشطون');
  }

  if (preview.posted) {
    throw new Error('تم ترحيل هذا المسير مسبقاً');
  }

  const description = `مسير رواتب ${preview.month_label} ${year}م`;
  const journalDate = `${year}-${monthKey}-28`;

  const journalId = await createManualJournal({
    associationId,
    journalDate,
    description,
    reference: 'رواتب',
    entryType: 'مسير رواتب',
    lines: [
      {
        account_code: '41101001',
        debit_amount: preview.total_gross,
        credit_amount: 0,
        line_description: description,
      },
      {
        account_code: '21401001',
        debit_amount: 0,
        credit_amount: preview.total_net,
        line_description: description,
      },
      {
        account_code: '21401002',
        debit_amount: 0,
        credit_amount: preview.total_gosi,
        line_description: description,
      },
    ],
  });

  try {
    await execute(
      `INSERT INTO payroll_runs
       (association_id, payroll_month, payroll_year, total_gross, total_gosi,
        total_net, employee_count, manual_journal_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        associationId,
        Number(monthKey),
        year,
        preview.total_gross,
        preview.total_gosi,
        preview.total_net,
        preview.employees.length,
        journalId,
      ],
    );
  } catch (error) {
    if (!isMissingPayrollTable(error)) throw error;
  }

  return { journalId, description };
}
