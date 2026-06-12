import type { RowDataPacket } from 'mysql2';
import { execute, getConnection, query } from '@/lib/db';
import { listCoaAccounts } from '@/lib/coa-service';
import { decodeVoucherDescription } from '@/lib/voucher-meta';
import { listVouchers } from '@/lib/vouchers';

export interface JournalLineView {
  account_code: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
  line_description: string;
}

export interface UnifiedJournalView {
  id: string;
  journal_number: string;
  journal_date: string;
  description: string;
  reference: string | null;
  entry_type: string;
  source: 'voucher' | 'manual';
  lines: JournalLineView[];
}

export interface AccountMovement {
  journal_date: string;
  journal_number: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
}

export interface LedgerResult {
  account_code: string;
  account_name: string;
  opening_balance: number;
  movements: Array<AccountMovement & { running_balance: number }>;
  closing_balance: number;
  period_debit: number;
  period_credit: number;
}

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  debit_balance: number;
  credit_balance: number;
}

interface ManualJournalRow extends RowDataPacket {
  id: number;
  association_id: number;
  journal_number: string;
  journal_date: string | Date;
  description: string;
  reference: string | null;
  entry_type: string;
}

interface ManualLineRow extends RowDataPacket {
  id: number;
  manual_journal_id: number;
  account_code: string;
  debit_amount: number;
  credit_amount: number;
  line_description: string | null;
}

export interface CreateManualJournalInput {
  associationId: number;
  journalDate: string;
  description: string;
  reference?: string;
  entryType?: string;
  lines: Array<{
    account_code: string;
    debit_amount: number;
    credit_amount: number;
    line_description?: string;
  }>;
}

function formatDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function isMissingManualJournalTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('manual_journals') || message.includes("doesn't exist");
}

async function buildAccountNameMap(associationId: number): Promise<Map<string, string>> {
  const accounts = await listCoaAccounts(associationId);
  return new Map(accounts.map((row) => [row.account_code, row.account_name]));
}

export async function nextManualJournalNumber(associationId: number): Promise<string> {
  try {
    const rows = await query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM manual_journals WHERE association_id = ?',
      [associationId],
    );
    const next = Number(rows[0]?.cnt ?? 0) + 1;
    return `قيد-${String(next).padStart(4, '0')}`;
  } catch (error) {
    if (isMissingManualJournalTable(error)) return 'قيد-0001';
    throw error;
  }
}

async function listManualJournals(associationId: number): Promise<UnifiedJournalView[]> {
  try {
    const journals = await query<ManualJournalRow[]>(
      `SELECT id, association_id, journal_number, journal_date, description, reference, entry_type
       FROM manual_journals
       WHERE association_id = ?
       ORDER BY journal_date DESC, id DESC`,
      [associationId],
    );
    if (!journals.length) return [];

    const ids = journals.map((j) => j.id);
    const placeholders = ids.map(() => '?').join(',');
    const lines = await query<ManualLineRow[]>(
      `SELECT id, manual_journal_id, account_code, debit_amount, credit_amount, line_description
       FROM manual_journal_lines
       WHERE manual_journal_id IN (${placeholders})`,
      ids,
    );

    const accountMap = await buildAccountNameMap(associationId);

    return journals.map((journal) => ({
      id: `m-${journal.id}`,
      journal_number: journal.journal_number,
      journal_date: formatDate(journal.journal_date),
      description: journal.description,
      reference: journal.reference,
      entry_type: journal.entry_type,
      source: 'manual' as const,
      lines: lines
        .filter((line) => line.manual_journal_id === journal.id)
        .map((line) => ({
          account_code: line.account_code,
          account_name: accountMap.get(line.account_code) ?? line.account_code,
          debit_amount: Number(line.debit_amount),
          credit_amount: Number(line.credit_amount),
          line_description: line.line_description ?? journal.description,
        })),
    }));
  } catch (error) {
    if (isMissingManualJournalTable(error)) return [];
    throw error;
  }
}

async function listVoucherJournals(associationId: number): Promise<UnifiedJournalView[]> {
  const vouchers = await listVouchers(associationId);
  if (!vouchers.length) return [];

  const accountMap = await buildAccountNameMap(associationId);
  const results: UnifiedJournalView[] = [];

  for (const voucher of vouchers) {
    if (!voucher.entries?.length) continue;
    const meta = voucher.meta ?? decodeVoucherDescription(voucher.description);
    const purpose = meta?.purpose ?? voucher.description ?? '';
    const isReceipt = voucher.voucher_type === 'receipt';
    const desc = isReceipt
      ? `سند قبض رقم ${voucher.voucher_number} - ${purpose}`
      : `سند صرف رقم ${voucher.voucher_number} - ${purpose}`;

    results.push({
      id: `v-${voucher.id}`,
      journal_number: voucher.voucher_number,
      journal_date: voucher.voucher_date,
      description: desc,
      reference: voucher.voucher_number,
      entry_type: 'قيد آلي',
      source: 'voucher',
      lines: voucher.entries.map((entry) => ({
        account_code: entry.account_code,
        account_name: accountMap.get(entry.account_code) ?? entry.account_code,
        debit_amount: Number(entry.debit_amount),
        credit_amount: Number(entry.credit_amount),
        line_description: purpose,
      })),
    });
  }

  return results;
}

export async function listUnifiedJournals(
  associationId: number,
  month?: string,
): Promise<UnifiedJournalView[]> {
  const manual = await listManualJournals(associationId);
  const voucher = await listVoucherJournals(associationId);
  let all = [...manual, ...voucher].sort((a, b) => {
    if (a.journal_date === b.journal_date) {
      return a.journal_number.localeCompare(b.journal_number, 'ar');
    }
    return a.journal_date < b.journal_date ? 1 : -1;
  });

  if (month) {
    all = all.filter((journal) => journal.journal_date.startsWith(month));
  }

  return all;
}

export async function createManualJournal(
  input: CreateManualJournalInput,
): Promise<number> {
  const journalNumber = await nextManualJournalNumber(input.associationId);
  const validLines = input.lines.filter(
    (line) => line.account_code && (line.debit_amount > 0 || line.credit_amount > 0),
  );

  if (validLines.length < 2) {
    throw new Error('القيد يحتاج سطرين على الأقل');
  }

  const totalDebit = validLines.reduce((sum, line) => sum + line.debit_amount, 0);
  const totalCredit = validLines.reduce((sum, line) => sum + line.credit_amount, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.009) {
    throw new Error('القيد غير متوازن — المدين ≠ الدائن');
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO manual_journals
       (association_id, journal_number, journal_date, description, reference, entry_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.associationId,
        journalNumber,
        input.journalDate,
        input.description,
        input.reference ?? null,
        input.entryType ?? 'قيد عادي',
      ],
    );

    const journalId = (result as { insertId: number }).insertId;

    for (const line of validLines) {
      await conn.execute(
        `INSERT INTO manual_journal_lines
         (manual_journal_id, account_code, debit_amount, credit_amount, line_description)
         VALUES (?, ?, ?, ?, ?)`,
        [
          journalId,
          line.account_code,
          line.debit_amount,
          line.credit_amount,
          line.line_description ?? input.description,
        ],
      );
    }

    await conn.commit();
    return journalId;
  } catch (error) {
    await conn.rollback();
    if (isMissingManualJournalTable(error)) {
      throw new Error('يرجى تشغيل database/patch-manual-journals.sql على قاعدة البيانات');
    }
    throw error;
  } finally {
    conn.release();
  }
}

export async function listAccountsForReports(associationId: number) {
  const accountMap = await buildAccountNameMap(associationId);
  const used = new Set<string>();

  const journals = await listUnifiedJournals(associationId);
  journals.forEach((journal) => {
    journal.lines.forEach((line) => used.add(line.account_code));
  });

  const fromCoa = await listCoaAccounts(associationId);
  fromCoa.forEach((acc) => used.add(acc.account_code));

  return [...used]
    .sort()
    .map((code) => ({
      account_code: code,
      account_name: accountMap.get(code) ?? code,
    }));
}

function collectMovements(
  journals: UnifiedJournalView[],
  accountCode: string,
  from?: string,
  to?: string,
) {
  const movements: AccountMovement[] = [];
  let openingBalance = 0;
  let accountName = '';

  journals.forEach((journal) => {
    journal.lines.forEach((line) => {
      if (line.account_code !== accountCode) return;
      accountName = line.account_name;
      const inRange =
        (!from || journal.journal_date >= from) &&
        (!to || journal.journal_date <= to);
      const beforeFrom = from && journal.journal_date < from;

      if (beforeFrom) {
        openingBalance += line.debit_amount - line.credit_amount;
      } else if (inRange) {
        movements.push({
          journal_date: journal.journal_date,
          journal_number: journal.journal_number,
          description: line.line_description || journal.description,
          debit_amount: line.debit_amount,
          credit_amount: line.credit_amount,
        });
      }
    });
  });

  movements.sort((a, b) =>
    a.journal_date === b.journal_date
      ? a.journal_number.localeCompare(b.journal_number, 'ar')
      : a.journal_date > b.journal_date
        ? 1
        : -1,
  );

  let running = openingBalance;
  const withBalance = movements.map((movement) => {
    running += movement.debit_amount - movement.credit_amount;
    return { ...movement, running_balance: running };
  });

  return {
    account_name: accountName,
    opening_balance: openingBalance,
    movements: withBalance,
    closing_balance: running,
    period_debit: movements.reduce((sum, m) => sum + m.debit_amount, 0),
    period_credit: movements.reduce((sum, m) => sum + m.credit_amount, 0),
  };
}

export async function getAccountLedger(
  associationId: number,
  accountCode: string,
  from?: string,
  to?: string,
): Promise<LedgerResult | null> {
  if (!accountCode) return null;
  const journals = await listUnifiedJournals(associationId);
  const data = collectMovements(journals, accountCode, from, to);
  return {
    account_code: accountCode,
    account_name: data.account_name,
    opening_balance: data.opening_balance,
    movements: data.movements,
    closing_balance: data.closing_balance,
    period_debit: data.period_debit,
    period_credit: data.period_credit,
  };
}

export async function getTrialBalance(
  associationId: number,
  from?: string,
  to?: string,
): Promise<TrialBalanceRow[]> {
  const journals = await listUnifiedJournals(associationId);
  const accountMap = await buildAccountNameMap(associationId);
  const balances = new Map<string, number>();

  journals.forEach((journal) => {
    const inRange =
      (!from || journal.journal_date >= from) &&
      (!to || journal.journal_date <= to);
    if (!inRange) return;

    journal.lines.forEach((line) => {
      const current = balances.get(line.account_code) ?? 0;
      balances.set(
        line.account_code,
        current + line.debit_amount - line.credit_amount,
      );
    });
  });

  return [...balances.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ar'))
    .map(([account_code, balance]) => ({
      account_code,
      account_name: accountMap.get(account_code) ?? account_code,
      debit_balance: balance > 0 ? balance : 0,
      credit_balance: balance < 0 ? Math.abs(balance) : 0,
    }));
}
