import type { RowDataPacket } from 'mysql2';
import { execute, getConnection, query } from './db';
import { DEFAULT_CASH_ACCOUNT } from './coa-utils';
import { createManualJournal } from './journal-service';
import { listActiveEmployees } from './employee-service';
import { createVoucherWithJournalDetailed } from './vouchers';
import type { PayrollEmployee, PayrollPreview } from './types';

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

const PAYABLE_ACCOUNT = '21401001';
const GOSI_PAYABLE_ACCOUNT = '21401002';
const SALARY_EXPENSE_ACCOUNT = '41101001';

interface PayrollRunRow extends RowDataPacket {
  id: number;
  payroll_month: number;
  payroll_year: number;
}

interface PayrollDisbursementRow extends RowDataPacket {
  employee_id: number;
  net_amount: number;
  voucher_id: number;
  disbursed_at: string | Date;
  voucher_number: string;
}

function isMissingPayrollTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('payroll_runs') || message.includes("doesn't exist");
}

function isMissingDisbursementTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('payroll_disbursements') || message.includes("doesn't exist");
}

let disbursementTableReady: Promise<void> | null = null;
let payrollRunsTableReady: Promise<void> | null = null;

async function ensurePayrollRunsTable(): Promise<void> {
  if (!payrollRunsTableReady) {
    payrollRunsTableReady = execute(`
      CREATE TABLE IF NOT EXISTS payroll_runs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        association_id INT UNSIGNED NOT NULL,
        payroll_month TINYINT UNSIGNED NOT NULL,
        payroll_year YEAR NOT NULL,
        total_gross DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        total_gosi DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        total_net DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        employee_count INT UNSIGNED NOT NULL DEFAULT 0,
        manual_journal_id INT UNSIGNED DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_payroll_period (association_id, payroll_year, payroll_month)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).then(() => undefined);
  }
  await payrollRunsTableReady;
}

async function ensurePayrollDisbursementsTable(): Promise<void> {
  if (!disbursementTableReady) {
    disbursementTableReady = execute(`
      CREATE TABLE IF NOT EXISTS payroll_disbursements (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        association_id INT UNSIGNED NOT NULL,
        employee_id INT UNSIGNED NOT NULL,
        payroll_month TINYINT UNSIGNED NOT NULL,
        payroll_year YEAR NOT NULL,
        net_amount DECIMAL(15, 2) NOT NULL,
        voucher_id INT UNSIGNED NOT NULL,
        disbursed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_payroll_employee_period (association_id, employee_id, payroll_year, payroll_month),
        INDEX idx_payroll_disbursements_period (association_id, payroll_year, payroll_month)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).then(() => undefined);
  }
  await disbursementTableReady;
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

async function listPayrollDisbursements(
  associationId: number,
  month: string,
  year: number,
): Promise<Map<number, PayrollDisbursementRow>> {
  try {
    await ensurePayrollDisbursementsTable();
    const rows = await query<PayrollDisbursementRow[]>(
      `SELECT pd.employee_id, pd.net_amount, pd.voucher_id, pd.disbursed_at,
              fv.voucher_number
       FROM payroll_disbursements pd
       INNER JOIN financial_vouchers fv ON fv.id = pd.voucher_id
       WHERE pd.association_id = ? AND pd.payroll_year = ? AND pd.payroll_month = ?`,
      [associationId, year, Number(normalizeMonth(month))],
    );
    return new Map(rows.map((row) => [row.employee_id, row]));
  } catch (error) {
    if (isMissingDisbursementTable(error)) return new Map();
    throw error;
  }
}

function buildAccrualLines(employees: PayrollEmployee[], description: string) {
  const lines: {
    account_code: string;
    debit_amount: number;
    credit_amount: number;
    line_description: string;
  }[] = [];

  employees.forEach((employee) => {
    const lineDescription = `${employee.name} — ${description}`;
    if (employee.gross_salary > 0) {
      lines.push({
        account_code: SALARY_EXPENSE_ACCOUNT,
        debit_amount: employee.gross_salary,
        credit_amount: 0,
        line_description: lineDescription,
      });
    }
    if (employee.net_salary > 0) {
      lines.push({
        account_code: PAYABLE_ACCOUNT,
        debit_amount: 0,
        credit_amount: employee.net_salary,
        line_description: lineDescription,
      });
    }
    if (employee.gosi_amount > 0) {
      lines.push({
        account_code: GOSI_PAYABLE_ACCOUNT,
        debit_amount: 0,
        credit_amount: employee.gosi_amount,
        line_description: lineDescription,
      });
    }
  });

  return lines;
}

export async function getPayrollPreview(
  associationId: number,
  month: string,
  year: number,
): Promise<PayrollPreview> {
  const monthKey = normalizeMonth(month);
  const employees = await listActiveEmployees(associationId);
  const disbursements = await listPayrollDisbursements(associationId, monthKey, year);
  const posted = await isPayrollPosted(associationId, monthKey, year);

  const payrollEmployees: PayrollEmployee[] = employees.map((employee) => {
    const disbursement = disbursements.get(employee.id);
    return {
      ...employee,
      disbursed: Boolean(disbursement),
      disbursed_at: disbursement
        ? String(disbursement.disbursed_at).slice(0, 19).replace('T', ' ')
        : null,
      voucher_id: disbursement?.voucher_id ?? null,
      voucher_number: disbursement?.voucher_number ?? null,
    };
  });

  const totalGross = payrollEmployees.reduce((sum, emp) => sum + emp.gross_salary, 0);
  const totalGosi = payrollEmployees.reduce((sum, emp) => sum + emp.gosi_amount, 0);
  const totalNet = payrollEmployees.reduce((sum, emp) => sum + emp.net_salary, 0);
  const disbursedCount = payrollEmployees.filter((emp) => emp.disbursed).length;

  return {
    month: monthKey,
    year,
    month_label: getMonthLabel(monthKey),
    employees: payrollEmployees,
    total_gross: totalGross,
    total_gosi: totalGosi,
    total_net: totalNet,
    posted,
    disbursed_count: disbursedCount,
    pending_count: payrollEmployees.length - disbursedCount,
    all_disbursed: payrollEmployees.length > 0 && disbursedCount === payrollEmployees.length,
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
    lines: buildAccrualLines(preview.employees, description),
  });

  try {
    await ensurePayrollRunsTable();
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
    if (isMissingPayrollTable(error)) {
      throw new Error('يرجى تشغيل database/patch-employees-payroll.sql على قاعدة البيانات');
    }
    throw error;
  }

  return { journalId, description };
}

export async function disburseEmployeePayroll(input: {
  associationId: number;
  employeeId: number;
  month: string;
  year: number;
  paymentAccountCode?: string;
}): Promise<{ voucherId: number; voucherNumber: string }> {
  const monthKey = normalizeMonth(input.month);
  const preview = await getPayrollPreview(input.associationId, monthKey, input.year);

  if (!preview.posted) {
    throw new Error('يجب ترحيل مسير الرواتب قبل صرف رواتب الموظفين');
  }

  const employee = preview.employees.find((item) => item.id === input.employeeId);
  if (!employee) {
    throw new Error('الموظف غير موجود في هذا المسير');
  }

  if (employee.disbursed) {
    throw new Error('تم صرف راتب هذا الموظف مسبقاً لهذا الشهر');
  }

  if (employee.net_salary <= 0) {
    throw new Error('صافي راتب الموظف يجب أن يكون أكبر من صفر');
  }

  const purpose = `راتب ${employee.name} — ${preview.month_label} ${input.year}م`;
  const voucherDate = `${input.year}-${monthKey}-28`;

  await ensurePayrollDisbursementsTable();
  const conn = await getConnection();

  try {
    await conn.beginTransaction();

    const { voucherId, voucherNumber } = await createVoucherWithJournalDetailed(
      {
        associationId: input.associationId,
        voucherType: 'disbursement',
        voucherDate,
        beneficiaryName: employee.name,
        amount: employee.net_salary,
        accountCode: PAYABLE_ACCOUNT,
        purpose,
        method: 'تحويل',
        ref: `رواتب-${monthKey}-${input.year}`,
        notes: employee.job_title,
        cashAccountCode: input.paymentAccountCode || DEFAULT_CASH_ACCOUNT,
      },
      conn,
    );

    await conn.execute(
      `INSERT INTO payroll_disbursements
       (association_id, employee_id, payroll_month, payroll_year, net_amount, voucher_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.associationId,
        employee.id,
        Number(monthKey),
        input.year,
        employee.net_salary,
        voucherId,
      ],
    );

    await conn.commit();
    return { voucherId, voucherNumber };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
