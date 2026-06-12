import type { RowDataPacket } from 'mysql2';
import { execute, query } from '@/lib/db';
import { createManualJournal, listUnifiedJournals } from '@/lib/journal-service';
import {
  getAssociationSettings,
  upsertAssociationSettings,
} from '@/lib/org-settings-service';
import { getDashboardStats } from '@/lib/vouchers';
import type { FiscalStatus, FiscalYearRecord } from '@/lib/types';

interface FiscalRow extends RowDataPacket {
  id: number;
  fiscal_year: number;
  closed_date: string | Date;
  journal_count: number;
  total_income: number;
  total_expenses: number;
}

function formatDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function isMissingFiscalTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('fiscal_years') || message.includes("doesn't exist");
}

async function listClosedYears(associationId: number): Promise<FiscalYearRecord[]> {
  try {
    const rows = await query<FiscalRow[]>(
      `SELECT id, fiscal_year, closed_date, journal_count, total_income, total_expenses
       FROM fiscal_years
       WHERE association_id = ?
       ORDER BY fiscal_year DESC`,
      [associationId],
    );
    return rows.map((row) => ({
      id: row.id,
      fiscal_year: Number(row.fiscal_year),
      closed_date: formatDate(row.closed_date),
      journal_count: Number(row.journal_count),
      total_income: Number(row.total_income),
      total_expenses: Number(row.total_expenses),
    }));
  } catch (error) {
    if (isMissingFiscalTable(error)) return [];
    throw error;
  }
}

export async function getFiscalStatus(associationId: number): Promise<FiscalStatus> {
  const settings = await getAssociationSettings(associationId);
  const closedYears = await listClosedYears(associationId);
  const latestClosed = closedYears[0]?.fiscal_year ?? 0;

  return {
    current_fiscal_year: settings.current_fiscal_year,
    can_open_new: latestClosed === settings.current_fiscal_year,
    closed_years: closedYears,
  };
}

export async function closeFiscalYear(associationId: number): Promise<void> {
  const settings = await getAssociationSettings(associationId);
  const year = settings.current_fiscal_year;

  const existing = await listClosedYears(associationId);
  if (existing.some((item) => item.fiscal_year === year)) {
    throw new Error(`السنة المالية ${year}م مقفلة مسبقاً`);
  }

  const stats = await getDashboardStats(associationId);
  const totalIncome = stats.total_donations;
  const totalExp = stats.total_expenses;
  const surplus = totalIncome - totalExp;
  const closeDate = `${year}-12-31`;
  const description = `قيد إقفال السنة المالية ${year}م`;

  const journalId = await createManualJournal({
    associationId,
    journalDate: closeDate,
    description,
    reference: 'إقفال',
    entryType: 'قيد إقفال',
    lines: [
      {
        account_code: '31201001',
        debit_amount: totalIncome,
        credit_amount: 0,
        line_description: 'إقفال الإيرادات',
      },
      {
        account_code: '41101001',
        debit_amount: 0,
        credit_amount: totalExp,
        line_description: 'إقفال المصروفات',
      },
      {
        account_code: '23101001',
        debit_amount: 0,
        credit_amount: Math.max(surplus, 0),
        line_description: 'ترحيل الفائض',
      },
    ].filter((line) => line.debit_amount > 0 || line.credit_amount > 0),
  });

  const journals = await listUnifiedJournals(associationId);

  try {
    await execute(
      `INSERT INTO fiscal_years
       (association_id, fiscal_year, closed_date, journal_count, total_income,
        total_expenses, manual_journal_id)
       VALUES (?, ?, CURDATE(), ?, ?, ?, ?)`,
      [
        associationId,
        year,
        journals.length,
        totalIncome,
        totalExp,
        journalId,
      ],
    );
  } catch (error) {
    if (!isMissingFiscalTable(error)) throw error;
  }
}

export async function openNewFiscalYear(
  associationId: number,
  newYear: number,
): Promise<void> {
  const settings = await getAssociationSettings(associationId);
  const closedYears = await listClosedYears(associationId);

  if (!closedYears.some((item) => item.fiscal_year === settings.current_fiscal_year)) {
    throw new Error('يجب إقفال السنة المالية الحالية أولاً');
  }

  if (newYear <= settings.current_fiscal_year) {
    throw new Error('السنة الجديدة يجب أن تكون أكبر من السنة الحالية');
  }

  if (closedYears.some((item) => item.fiscal_year === newYear)) {
    throw new Error('هذه السنة المالية موجودة مسبقاً');
  }

  await upsertAssociationSettings(associationId, {
    ...settings,
    current_fiscal_year: newYear,
    journal_seq_start: 1,
  });
}
