import type { RowDataPacket } from 'mysql2';
import { execute, getConnection, query } from '@/lib/db';
import { DEFAULT_CASH_ACCOUNT } from '@/lib/coa-utils';
import {
  decodeVoucherDescription,
  encodeVoucherDescription,
  type VoucherMeta,
} from '@/lib/voucher-meta';
import type { JournalEntry, VoucherType, VoucherWithEntries } from '@/lib/types';

interface VoucherRow extends RowDataPacket {
  id: number;
  association_id: number;
  voucher_type: VoucherType;
  voucher_number: string;
  voucher_date: string | Date;
  total_amount: number;
  beneficiary_name: string | null;
  description: string | null;
  created_at: string | Date;
}

interface JournalRow extends RowDataPacket {
  id: number;
  voucher_id: number;
  account_code: string;
  debit_amount: number;
  credit_amount: number;
}

export interface CreateVoucherInput {
  associationId: number;
  voucherType: VoucherType;
  voucherDate: string;
  beneficiaryName: string;
  amount: number;
  accountCode: string;
  purpose: string;
  method?: string;
  ref?: string;
  notes?: string;
}

export interface VoucherListItem extends VoucherWithEntries {
  meta: VoucherMeta;
  account_name?: string;
}

function formatDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

async function nextVoucherNumber(
  associationId: number,
  voucherType: VoucherType,
): Promise<string> {
  const prefix = voucherType === 'receipt' ? 'قبض' : 'صرف';
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM financial_vouchers
     WHERE association_id = ? AND voucher_type = ?`,
    [associationId, voucherType],
  );
  const next = Number(rows[0]?.cnt ?? 0) + 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

function buildJournalLines(
  voucherType: VoucherType,
  amount: number,
  accountCode: string,
) {
  if (voucherType === 'receipt') {
    return [
      { account_code: DEFAULT_CASH_ACCOUNT, debit: amount, credit: 0 },
      { account_code: accountCode, debit: 0, credit: amount },
    ];
  }

  return [
    { account_code: accountCode, debit: amount, credit: 0 },
    { account_code: DEFAULT_CASH_ACCOUNT, debit: 0, credit: amount },
  ];
}

export async function createVoucherWithJournal(
  input: CreateVoucherInput,
): Promise<number> {
  const voucherNumber = await nextVoucherNumber(
    input.associationId,
    input.voucherType,
  );
  const meta: VoucherMeta = {
    purpose: input.purpose,
    method: input.method ?? 'نقداً',
    ref: input.ref ?? '',
    notes: input.notes ?? '',
    account_code: input.accountCode,
  };

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const [voucherResult] = await conn.execute(
      `INSERT INTO financial_vouchers
       (association_id, voucher_type, voucher_number, voucher_date, total_amount, beneficiary_name, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.associationId,
        input.voucherType,
        voucherNumber,
        input.voucherDate,
        input.amount,
        input.beneficiaryName,
        encodeVoucherDescription(meta),
      ],
    );

    const voucherId = (voucherResult as { insertId: number }).insertId;
    const lines = buildJournalLines(
      input.voucherType,
      input.amount,
      input.accountCode,
    );

    for (const line of lines) {
      await conn.execute(
        `INSERT INTO journal_entries (voucher_id, account_code, debit_amount, credit_amount)
         VALUES (?, ?, ?, ?)`,
        [voucherId, line.account_code, line.debit, line.credit],
      );
    }

    await conn.commit();
    return voucherId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function listVouchers(
  associationId: number,
  voucherType?: VoucherType,
): Promise<VoucherListItem[]> {
  const params: unknown[] = [associationId];
  let sql = `SELECT id, association_id, voucher_type, voucher_number, voucher_date,
                    total_amount, beneficiary_name, description, created_at
             FROM financial_vouchers
             WHERE association_id = ?`;

  if (voucherType) {
    sql += ' AND voucher_type = ?';
    params.push(voucherType);
  }

  sql += ' ORDER BY voucher_date DESC, id DESC';

  const vouchers = await query<VoucherRow[]>(sql, params);
  if (!vouchers.length) return [];

  const ids = vouchers.map((v) => v.id);
  const placeholders = ids.map(() => '?').join(',');
  const entries = await query<JournalRow[]>(
    `SELECT id, voucher_id, account_code, debit_amount, credit_amount
     FROM journal_entries
     WHERE voucher_id IN (${placeholders})`,
    ids,
  );

  const accountRows = await query<RowDataPacket[]>(
    'SELECT account_code, account_name FROM chart_of_accounts WHERE association_id = ?',
    [associationId],
  );
  const accountMap = new Map(
    accountRows.map((row) => [String(row.account_code), String(row.account_name)]),
  );

  return vouchers.map((voucher) => {
    const meta = decodeVoucherDescription(voucher.description);
    const voucherEntries: JournalEntry[] = entries
      .filter((entry) => entry.voucher_id === voucher.id)
      .map((entry) => ({
        id: entry.id,
        voucher_id: entry.voucher_id,
        account_code: entry.account_code,
        debit_amount: Number(entry.debit_amount),
        credit_amount: Number(entry.credit_amount),
      }));

    return {
      id: voucher.id,
      association_id: voucher.association_id,
      voucher_type: voucher.voucher_type,
      voucher_number: voucher.voucher_number,
      voucher_date: formatDate(voucher.voucher_date),
      total_amount: Number(voucher.total_amount),
      beneficiary_name: voucher.beneficiary_name,
      description: voucher.description,
      created_at: voucher.created_at,
      entries: voucherEntries,
      meta,
      account_name: accountMap.get(meta.account_code) ?? meta.account_code,
    };
  });
}

export async function getVoucherById(
  associationId: number,
  voucherId: number,
): Promise<VoucherListItem | null> {
  const items = await listVouchers(associationId);
  return items.find((item) => item.id === voucherId) ?? null;
}

export async function deleteVoucher(
  associationId: number,
  voucherId: number,
): Promise<boolean> {
  const result = await execute(
    'DELETE FROM financial_vouchers WHERE id = ? AND association_id = ?',
    [voucherId, associationId],
  );
  return result.affectedRows > 0;
}

export async function getDashboardStats(associationId: number) {
  const receipts = await listVouchers(associationId, 'receipt');
  const payments = await listVouchers(associationId, 'disbursement');

  const totalDonations = receipts.reduce((sum, item) => sum + item.total_amount, 0);
  const totalExpenses = payments.reduce((sum, item) => sum + item.total_amount, 0);

  return {
    total_donations: totalDonations,
    total_expenses: totalExpenses,
    receipt_count: receipts.length,
    payment_count: payments.length,
    net: totalDonations - totalExpenses,
    recent_receipts: receipts.slice(0, 5),
    recent_payments: payments.slice(0, 5),
  };
}
