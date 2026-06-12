import type { RowDataPacket } from 'mysql2';
import { execute, query } from '@/lib/db';
import type { SafetyFinancialInput } from '@/lib/types';

interface SafetyRow extends RowDataPacket, SafetyFinancialInput {}

export async function getSafetyInput(
  associationId: number,
  fiscalYear?: number,
): Promise<SafetyRow | null> {
  const year = fiscalYear ?? new Date().getFullYear();
  const rows = await query<SafetyRow[]>(
    'SELECT * FROM safety_financial_inputs WHERE association_id = ? AND fiscal_year = ?',
    [associationId, year],
  );
  return rows[0] ?? null;
}

export async function upsertSafetyInput(
  associationId: number,
  input: Omit<SafetyFinancialInput, 'id' | 'association_id' | 'created_at' | 'updated_at'>,
): Promise<void> {
  await execute(
    `INSERT INTO safety_financial_inputs (
      association_id, fiscal_year, total_expenses, admin_expenses, program_expenses,
      activity_admin_expenses, total_activity_expenses, sustainability_returns,
      sustainability_expenses, sustainability_assets, total_donations, fundraising_expenses,
      cash_equivalents, net_restricted_assets, net_endowment_cash, current_liabilities,
      net_current_cash_investments, estimated_annual_admin_expenses
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      total_expenses = VALUES(total_expenses),
      admin_expenses = VALUES(admin_expenses),
      program_expenses = VALUES(program_expenses),
      activity_admin_expenses = VALUES(activity_admin_expenses),
      total_activity_expenses = VALUES(total_activity_expenses),
      sustainability_returns = VALUES(sustainability_returns),
      sustainability_expenses = VALUES(sustainability_expenses),
      sustainability_assets = VALUES(sustainability_assets),
      total_donations = VALUES(total_donations),
      fundraising_expenses = VALUES(fundraising_expenses),
      cash_equivalents = VALUES(cash_equivalents),
      net_restricted_assets = VALUES(net_restricted_assets),
      net_endowment_cash = VALUES(net_endowment_cash),
      current_liabilities = VALUES(current_liabilities),
      net_current_cash_investments = VALUES(net_current_cash_investments),
      estimated_annual_admin_expenses = VALUES(estimated_annual_admin_expenses)`,
    [
      associationId,
      input.fiscal_year,
      input.total_expenses,
      input.admin_expenses,
      input.program_expenses,
      input.activity_admin_expenses,
      input.total_activity_expenses,
      input.sustainability_returns,
      input.sustainability_expenses,
      input.sustainability_assets,
      input.total_donations,
      input.fundraising_expenses,
      input.cash_equivalents,
      input.net_restricted_assets,
      input.net_endowment_cash,
      input.current_liabilities,
      input.net_current_cash_investments,
      input.estimated_annual_admin_expenses,
    ],
  );
}
