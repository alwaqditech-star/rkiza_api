import { NextResponse } from 'next/server';
import { requireClientSession, requireClientSettings } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import { createBankAccount, listBankAccounts } from '@/lib/bank-service';
import type { BankAccountStatus } from '@/lib/types';

export async function GET() {
  try {
    const session = await requireClientSession();
    const data = await listBankAccounts(session.id);
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, message: 'صلاحية الجمعية مطلوبة' },
      { status: 403 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireClientSettings();
    const body = await request.json();

    const description = String(body.description ?? '').trim();
    const bankName = String(body.bank_name ?? '').trim();
    const accountNumber = String(body.account_number ?? '').trim();
    const iban = String(body.iban ?? '').trim();

    if (!description || !bankName || !accountNumber || !iban) {
      return NextResponse.json(
        { success: false, message: 'يرجى تعبئة الحقول المطلوبة' },
        { status: 400 },
      );
    }

    const id = await createBankAccount(session.id, {
      description,
      bank_name: bankName,
      account_number: accountNumber,
      iban,
      account_owner: String(body.account_owner ?? '').trim() || null,
      account_code: String(body.account_code ?? '11101001'),
      opening_balance: Number(body.opening_balance ?? 0),
      status: (body.status ?? 'active') as BankAccountStatus,
    });

    return NextResponse.json({
      success: true,
      message: 'تم حفظ الحساب البنكي',
      data: { id },
    });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'فشل الحفظ';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
