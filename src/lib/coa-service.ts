import type { RowDataPacket } from 'mysql2';
import { execute, query } from '@/lib/db';
import { flattenCoaTemplate } from '@/lib/coa-utils';
import type { ChartOfAccount } from '@/lib/types';

interface CoaRow extends RowDataPacket, ChartOfAccount {}

export async function ensureCoaSeeded(associationId: number): Promise<void> {
  const existing = await query<RowDataPacket[]>(
    'SELECT id FROM chart_of_accounts WHERE association_id = ? LIMIT 1',
    [associationId],
  );
  if (existing.length > 0) return;

  const template = flattenCoaTemplate();
  for (const account of template) {
    await execute(
      `INSERT INTO chart_of_accounts
       (association_id, account_code, account_name, account_type, parent_code, allow_payment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        associationId,
        account.code,
        account.name,
        account.type,
        account.parent_code,
        account.type === 'expenses' ? 'Yes' : 'No',
      ],
    );
  }
}

export async function listCoaAccounts(associationId: number): Promise<CoaRow[]> {
  await ensureCoaSeeded(associationId);
  return query<CoaRow[]>(
    `SELECT id, association_id, account_code, account_name, account_type, parent_code,
            allow_payment, is_custom
     FROM chart_of_accounts
     WHERE association_id = ?
     ORDER BY account_code`,
    [associationId],
  );
}

export async function addCoaAccount(
  associationId: number,
  input: {
    account_code: string;
    account_name: string;
    account_type: string;
    parent_code?: string | null;
    allow_payment?: 'Yes' | 'No';
    is_custom?: boolean;
  },
): Promise<number> {
  const result = await execute(
    `INSERT INTO chart_of_accounts
     (association_id, account_code, account_name, account_type, parent_code, allow_payment, is_custom)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      associationId,
      input.account_code,
      input.account_name,
      input.account_type,
      input.parent_code ?? null,
      input.allow_payment ?? 'No',
      input.is_custom ? 1 : 0,
    ],
  );
  return result.insertId;
}

export async function updateCoaAccount(
  associationId: number,
  accountId: number,
  input: {
    account_name: string;
    allow_payment?: 'Yes' | 'No';
  },
): Promise<boolean> {
  const result = await execute(
    `UPDATE chart_of_accounts
     SET account_name = ?, allow_payment = ?
     WHERE id = ? AND association_id = ? AND is_custom = 1`,
    [input.account_name, input.allow_payment ?? 'No', accountId, associationId],
  );
  return result.affectedRows > 0;
}

export async function deleteCoaAccount(
  associationId: number,
  accountId: number,
): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    'SELECT account_code FROM chart_of_accounts WHERE id = ? AND association_id = ? AND is_custom = 1',
    [accountId, associationId],
  );
  if (!rows.length) return false;

  const accountCode = String(rows[0].account_code);
  const used = await query<RowDataPacket[]>(
    `SELECT id FROM journal_entries WHERE account_code = ? LIMIT 1`,
    [accountCode],
  );
  if (used.length) {
    throw new Error('لا يمكن حذف حساب مستخدم في قيود أو سندات');
  }

  const manualUsed = await query<RowDataPacket[]>(
    `SELECT id FROM manual_journal_lines WHERE account_code = ? LIMIT 1`,
    [accountCode],
  ).catch(() => [] as RowDataPacket[]);
  if (manualUsed.length) {
    throw new Error('لا يمكن حذف حساب مستخدم في قيود');
  }

  const result = await execute(
    'DELETE FROM chart_of_accounts WHERE id = ? AND association_id = ? AND is_custom = 1',
    [accountId, associationId],
  );
  return result.affectedRows > 0;
}
