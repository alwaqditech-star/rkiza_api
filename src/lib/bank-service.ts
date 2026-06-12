import type { RowDataPacket } from 'mysql2';
import { execute, query } from '@/lib/db';
import type { BankAccount, BankAccountStatus } from '@/lib/types';

interface BankRow extends RowDataPacket {
  id: number;
  association_id: number;
  description: string;
  bank_name: string;
  account_number: string;
  iban: string;
  account_owner: string | null;
  account_code: string;
  opening_balance: number;
  status: BankAccountStatus;
}

function isMissingBankTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('bank_accounts') || message.includes("doesn't exist");
}

function mapBank(row: BankRow): BankAccount {
  return {
    id: row.id,
    association_id: row.association_id,
    description: row.description,
    bank_name: row.bank_name,
    account_number: row.account_number,
    iban: row.iban,
    account_owner: row.account_owner,
    account_code: row.account_code,
    opening_balance: Number(row.opening_balance),
    status: row.status,
  };
}

export async function listBankAccounts(associationId: number): Promise<BankAccount[]> {
  try {
    const rows = await query<BankRow[]>(
      `SELECT id, association_id, description, bank_name, account_number, iban,
              account_owner, account_code, opening_balance, status
       FROM bank_accounts
       WHERE association_id = ?
       ORDER BY id DESC`,
      [associationId],
    );
    return rows.map(mapBank);
  } catch (error) {
    if (isMissingBankTable(error)) return [];
    throw error;
  }
}

export async function createBankAccount(
  associationId: number,
  input: Omit<BankAccount, 'id' | 'association_id'>,
): Promise<number> {
  try {
    const result = await execute(
      `INSERT INTO bank_accounts
       (association_id, description, bank_name, account_number, iban, account_owner,
        account_code, opening_balance, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        associationId,
        input.description,
        input.bank_name,
        input.account_number,
        input.iban,
        input.account_owner,
        input.account_code,
        input.opening_balance,
        input.status,
      ],
    );
    return result.insertId;
  } catch (error) {
    if (isMissingBankTable(error)) {
      throw new Error('يرجى تشغيل database/patch-settings.sql على قاعدة البيانات');
    }
    throw error;
  }
}

export async function updateBankAccount(
  associationId: number,
  bankId: number,
  input: Omit<BankAccount, 'id' | 'association_id'>,
): Promise<boolean> {
  try {
    const result = await execute(
      `UPDATE bank_accounts SET
         description = ?, bank_name = ?, account_number = ?, iban = ?,
         account_owner = ?, account_code = ?, opening_balance = ?, status = ?
       WHERE id = ? AND association_id = ?`,
      [
        input.description,
        input.bank_name,
        input.account_number,
        input.iban,
        input.account_owner,
        input.account_code,
        input.opening_balance,
        input.status,
        bankId,
        associationId,
      ],
    );
    return result.affectedRows > 0;
  } catch (error) {
    if (isMissingBankTable(error)) {
      throw new Error('يرجى تشغيل database/patch-settings.sql على قاعدة البيانات');
    }
    throw error;
  }
}

export async function deleteBankAccount(
  associationId: number,
  bankId: number,
): Promise<boolean> {
  try {
    const result = await execute(
      'DELETE FROM bank_accounts WHERE id = ? AND association_id = ?',
      [bankId, associationId],
    );
    return result.affectedRows > 0;
  } catch (error) {
    if (isMissingBankTable(error)) {
      throw new Error('يرجى تشغيل database/patch-settings.sql على قاعدة البيانات');
    }
    throw error;
  }
}
