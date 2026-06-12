import type { RowDataPacket } from 'mysql2';
import { execute, query } from '@/lib/db';
import { calcEmployeeTotals } from '@/lib/employee-utils';
import type { Employee, EmployeeInput, EmployeeStatus } from '@/lib/types';

interface EmployeeRow extends RowDataPacket {
  id: number;
  association_id: number;
  name: string;
  job_title: string;
  id_number: string | null;
  hire_date: string | Date | null;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  commission: number;
  gosi_percent: number;
  status: EmployeeStatus;
}

function formatDate(value: string | Date | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function isMissingEmployeeTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('employees') || message.includes("doesn't exist");
}

export { calcEmployeeTotals } from '@/lib/employee-utils';

function mapEmployee(row: EmployeeRow): Employee {
  const totals = calcEmployeeTotals(row);
  return {
    id: row.id,
    association_id: row.association_id,
    name: row.name,
    job_title: row.job_title,
    id_number: row.id_number,
    hire_date: formatDate(row.hire_date),
    basic_salary: Number(row.basic_salary),
    housing_allowance: Number(row.housing_allowance),
    transport_allowance: Number(row.transport_allowance),
    commission: Number(row.commission),
    gosi_percent: Number(row.gosi_percent),
    status: row.status,
    ...totals,
  };
}

export async function listEmployees(associationId: number): Promise<Employee[]> {
  try {
    const rows = await query<EmployeeRow[]>(
      `SELECT id, association_id, name, job_title, id_number, hire_date,
              basic_salary, housing_allowance, transport_allowance, commission,
              gosi_percent, status
       FROM employees
       WHERE association_id = ?
       ORDER BY name ASC`,
      [associationId],
    );
    return rows.map(mapEmployee);
  } catch (error) {
    if (isMissingEmployeeTable(error)) return [];
    throw error;
  }
}

export async function createEmployee(
  associationId: number,
  input: EmployeeInput,
): Promise<number> {
  try {
    const result = await execute(
      `INSERT INTO employees
       (association_id, name, job_title, id_number, hire_date, basic_salary,
        housing_allowance, transport_allowance, commission, gosi_percent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        associationId,
        input.name,
        input.job_title,
        input.id_number ?? null,
        input.hire_date ?? null,
        input.basic_salary,
        input.housing_allowance ?? 0,
        input.transport_allowance ?? 0,
        input.commission ?? 0,
        input.gosi_percent ?? 9,
        input.status ?? 'active',
      ],
    );
    return result.insertId;
  } catch (error) {
    if (isMissingEmployeeTable(error)) {
      throw new Error('يرجى تشغيل database/patch-employees-payroll.sql على قاعدة البيانات');
    }
    throw error;
  }
}

export async function updateEmployee(
  associationId: number,
  employeeId: number,
  input: EmployeeInput,
): Promise<boolean> {
  try {
    const result = await execute(
      `UPDATE employees SET
         name = ?, job_title = ?, id_number = ?, hire_date = ?,
         basic_salary = ?, housing_allowance = ?, transport_allowance = ?,
         commission = ?, gosi_percent = ?, status = ?
       WHERE id = ? AND association_id = ?`,
      [
        input.name,
        input.job_title,
        input.id_number ?? null,
        input.hire_date ?? null,
        input.basic_salary,
        input.housing_allowance ?? 0,
        input.transport_allowance ?? 0,
        input.commission ?? 0,
        input.gosi_percent ?? 9,
        input.status ?? 'active',
        employeeId,
        associationId,
      ],
    );
    return result.affectedRows > 0;
  } catch (error) {
    if (isMissingEmployeeTable(error)) {
      throw new Error('يرجى تشغيل database/patch-employees-payroll.sql على قاعدة البيانات');
    }
    throw error;
  }
}

export async function deleteEmployee(
  associationId: number,
  employeeId: number,
): Promise<boolean> {
  try {
    const result = await execute(
      'DELETE FROM employees WHERE id = ? AND association_id = ?',
      [employeeId, associationId],
    );
    return result.affectedRows > 0;
  } catch (error) {
    if (isMissingEmployeeTable(error)) {
      throw new Error('يرجى تشغيل database/patch-employees-payroll.sql على قاعدة البيانات');
    }
    throw error;
  }
}

export async function listActiveEmployees(associationId: number): Promise<Employee[]> {
  const all = await listEmployees(associationId);
  return all.filter((employee) => employee.status === 'active');
}
